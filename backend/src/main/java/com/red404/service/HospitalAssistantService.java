package com.red404.service;

import com.red404.config.EnvConfig;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.DonorDao;
import com.red404.dao.HospitalDao;
import com.red404.util.BloodCompatibilityUtil;
import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.*;

@Service
public class HospitalAssistantService {

    private static final Logger log = LoggerFactory.getLogger(HospitalAssistantService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final Set<String> ALLOWED_READ_ONLY_TOOLS = Set.of(
            "donor_availability",
            "get_stock",
            "active_requests",
            "prepare_search"
    );

    public static final List<String> FORBIDDEN_WRITE_KEYWORDS = List.of(
            "send",
            "broadcast",
            "cancel",
            "edit",
            "stock_edit",
            "update",
            "delete",
            "insert",
            "create_request",
            "notify"
    );

    private final HospitalDao hospitalDao = new HospitalDao();
    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();
    private final com.red404.dao.BloodRequestNotificationDao notificationDao = new com.red404.dao.BloodRequestNotificationDao();

    @Autowired
    private RateLimitService rateLimitService;

    /**
     * Requirement 5: Test/enforce that no write tool can be registered or executed.
     */
    public boolean isToolAllowed(String toolName) {
        if (toolName == null) return false;
        String clean = toolName.trim().toLowerCase();
        if (!ALLOWED_READ_ONLY_TOOLS.contains(clean)) return false;
        for (String kw : FORBIDDEN_WRITE_KEYWORDS) {
            if (clean.contains(kw)) return false;
        }
        return true;
    }

    public void validateReadOnlyTool(String toolName) {
        if (!isToolAllowed(toolName)) {
            throw new SecurityException("Forbidden: Assistant is strictly read-only. Action '" + toolName + "' is not permitted.");
        }
    }

    /**
     * Rate Limiting check (env configurable):
     * - 20 tool calls/min per user
     * - 300 tool calls/day per hospital
     */
    public RateLimitService.RateLimitResult checkToolRateLimits(int hospitalId, String userIdentifier) {
        if (rateLimitService == null) {
            return new RateLimitService.RateLimitResult(true, 20, 20, 0);
        }
        int userLimit = EnvConfig.getAsInt("ASSISTANT_TOOL_RATE_PER_USER_PER_MIN", 20);
        int hospDailyLimit = EnvConfig.getAsInt("ASSISTANT_TOOL_DAILY_LIMIT_PER_HOSPITAL", 300);

        String userKey = "asst_tool_usr:" + (userIdentifier != null ? userIdentifier : "anon_" + hospitalId);
        RateLimitService.RateLimitResult userRes = rateLimitService.checkLimit(userKey, userLimit, 60);
        if (!userRes.allowed) {
            return userRes;
        }

        String today = LocalDate.now().toString();
        String hospKey = "asst_tool_hosp_day:" + hospitalId + ":" + today;
        return rateLimitService.checkLimit(hospKey, hospDailyLimit, 86400);
    }

    /**
     * TOOL 1: donor_availability
     * Aggregates only. Zero personal details, IDs, phones, addresses, coordinates.
     */
    public Map<String, Object> donorAvailability(int hospitalId, String bloodGroup, double radiusKm, boolean includeCompatible) throws SQLException {
        validateReadOnlyTool("donor_availability");

        Map<String, Object> hosp = hospitalDao.findById(hospitalId);
        if (hosp == null) {
            throw new IllegalArgumentException("Hospital not found");
        }
        Double hospLat = asDouble(hosp.get("latitude"));
        Double hospLng = asDouble(hosp.get("longitude"));
        if (hospLat == null || hospLng == null || (hospLat == 0.0 && hospLng == 0.0)) {
            throw new IllegalStateException("Hospital geographic coordinates are not configured. Please pin your facility location first.");
        }

        // Clamp radius 1 to 20 km (default 10)
        double radius = Math.max(1.0, Math.min(20.0, radiusKm > 0 ? radiusKm : 10.0));
        String targetBlood = BloodCompatibilityUtil.normalizeBloodGroup(bloodGroup);
        if (targetBlood == null) {
            throw new IllegalArgumentException("Invalid blood group specified. Allowed groups: " + BloodCompatibilityUtil.CANONICAL_GROUPS);
        }

        List<String> targetGroups = includeCompatible
                ? BloodCompatibilityUtil.getCompatibleDonorGroups(targetBlood)
                : List.of(targetBlood);

        // Prepare counting containers
        int totalEligible = 0;
        int exactCount = 0;
        Map<String, Integer> perGroupCounts = new LinkedHashMap<>();
        for (String g : targetGroups) {
            perGroupCounts.put(g, 0);
        }

        int band0to5 = 0;
        int band5to10 = 0;
        int band10to20 = 0;

        // Ineligibility reason tallies
        int recentlyDonated = 0;
        int deferred = 0;
        int paused = 0;
        int staleLocation = 0;
        int locationOff = 0;
        int unconfirmedBloodGroup = 0;
        int outsideRadius = 0;

        int freshnessHours = EnvConfig.getAsInt("DONOR_LOCATION_FRESHNESS_HOURS", 24);
        long nowMs = System.currentTimeMillis();

        String sql = "SELECT * FROM donors WHERE (availability IS NULL OR LOWER(availability) <> 'deleted')";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> donor = donorDao.mapDonor(rs, false);
                String rawBlood = str(donor.get("bloodType"));
                if (rawBlood == null || rawBlood.isBlank()) rawBlood = str(donor.get("blood_type"));
                String normBlood = BloodCompatibilityUtil.normalizeBloodGroup(rawBlood);

                // Blood group unconfirmed check
                if (normBlood == null) {
                    unconfirmedBloodGroup++;
                    continue;
                }

                // Location coordinates & freshness check
                Object latObj = donor.get("latitude");
                Object lngObj = donor.get("longitude");
                if (latObj == null || lngObj == null || !(latObj instanceof Number) || !(lngObj instanceof Number)) {
                    locationOff++;
                    continue;
                }
                double dLat = ((Number) latObj).doubleValue();
                double dLng = ((Number) lngObj).doubleValue();
                if ((dLat == 0.0 && dLng == 0.0) || dLat < -90.0 || dLat > 90.0 || dLng < -180.0 || dLng > 180.0) {
                    locationOff++;
                    continue;
                }

                Timestamp locUpdated = rs.getTimestamp("location_updated_at");
                if (locUpdated == null) {
                    try {
                        locUpdated = rs.getTimestamp("created_at");
                    } catch (Exception ignored) {}
                }
                if (locUpdated == null || (nowMs - locUpdated.getTime()) > (freshnessHours * 3600L * 1000L)) {
                    staleLocation++;
                    continue;
                }

                // Distance calculation
                double dist = DistanceCalculator.calculateDistance(hospLat, hospLng, dLat, dLng);
                if (dist > radius) {
                    outsideRadius++;
                    continue;
                }

                // Compatibility check against target evaluated groups
                if (!targetGroups.contains(normBlood)) {
                    continue;
                }

                // Authoritative Eligibility check
                Map<String, Object> elig = DonorEligibilityService.computeEligibility(donor);
                boolean isElig = Boolean.TRUE.equals(elig.get("eligible"));

                if (!isElig) {
                    String reason = str(elig.get("reason"));
                    if (Boolean.TRUE.equals(elig.get("deferred")) || (reason != null && reason.toLowerCase().contains("deferred"))) {
                        deferred++;
                    } else if (Boolean.TRUE.equals(elig.get("isPaused")) || (reason != null && reason.toLowerCase().contains("paused"))) {
                        paused++;
                    } else {
                        Object daysObj = elig.get("days_until_eligible");
                        int daysUntil = (daysObj instanceof Number n) ? n.intValue() : 0;
                        if (daysUntil > 0 || (reason != null && (reason.toLowerCase().contains("donated") || reason.toLowerCase().contains("cooldown")))) {
                            recentlyDonated++;
                        } else {
                            paused++;
                        }
                    }
                    continue;
                }

                // Donor is eligible within the radius!
                totalEligible++;
                if (normBlood.equals(targetBlood)) {
                    exactCount++;
                }
                perGroupCounts.put(normBlood, perGroupCounts.getOrDefault(normBlood, 0) + 1);

                // Distance Band Tally
                if (dist <= 5.0) {
                    band0to5++;
                } else if (dist <= 10.0) {
                    band5to10++;
                } else {
                    band10to20++;
                }
            }
        }

        // Distance bands formatted (only include bands inside the requested radius)
        Map<String, Integer> bands = new LinkedHashMap<>();
        bands.put("0-5 km", band0to5);
        if (radius > 5.0) {
            bands.put("5-10 km", band5to10);
        }
        if (radius > 10.0) {
            bands.put("10-20 km", band10to20);
        }

        // Compatible groups breakdown list (Exact group always first)
        List<Map<String, Object>> compList = new ArrayList<>();
        for (String g : targetGroups) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("group", g);
            item.put("isExact", g.equals(targetBlood));
            item.put("count", perGroupCounts.getOrDefault(g, 0));
            compList.add(item);
        }

        int notAvailableTotal = recentlyDonated + deferred + paused + staleLocation + locationOff + unconfirmedBloodGroup;
        Map<String, Integer> reasons = new LinkedHashMap<>();
        reasons.put("recentlyDonated", recentlyDonated);
        reasons.put("deferred", deferred);
        reasons.put("paused", paused);
        reasons.put("staleLocation", staleLocation);
        reasons.put("locationOff", locationOff);
        reasons.put("bloodGroupUnconfirmed", unconfirmedBloodGroup);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("bloodGroup", targetBlood);
        out.put("radiusKm", (int) Math.round(radius));
        out.put("includeCompatible", includeCompatible);
        out.put("totalEligible", totalEligible);
        out.put("exactGroup", Map.of("group", targetBlood, "count", exactCount));
        out.put("compatibleGroups", compList);
        out.put("distanceBands", bands);
        out.put("notAvailableTotal", notAvailableTotal);
        out.put("notAvailableReasons", reasons);
        out.put("dataFreshness", "Only active donors with verified coordinates refreshed within the last 24 hours are counted.");

        return out;
    }

    /**
     * TOOL 2: get_stock
     * This hospital's 8 groups with units, Critical/Low/OK status by shared thresholds, updated_at.
     */
    public Map<String, Object> getStock(int hospitalId) throws SQLException {
        validateReadOnlyTool("get_stock");

        Map<String, Object> rawStock = StockService.getHospitalStock(hospitalId);
        @SuppressWarnings("unchecked")
        Map<String, Integer> inv = (Map<String, Integer>) rawStock.get("inventory");

        List<Map<String, Object>> groups = new ArrayList<>();
        for (String bg : StockService.ALL_BLOOD_GROUPS) {
            int units = inv != null ? inv.getOrDefault(bg, 0) : 0;
            Map<String, String> statusMap = StockService.getStockStatus(bg, units);
            int[] th = StockService.THRESHOLDS.getOrDefault(bg, new int[]{3, 5});

            Map<String, Object> gData = new LinkedHashMap<>();
            gData.put("group", bg);
            gData.put("units", units);
            gData.put("status", statusMap.get("label"));
            gData.put("state", statusMap.get("state"));
            gData.put("criticalThreshold", th[0]);
            gData.put("lowThreshold", th[1]);
            groups.add(gData);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hospitalId", hospitalId);
        out.put("groups", groups);
        out.put("updatedAt", rawStock.get("updatedAt"));
        out.put("updatedAgo", rawStock.get("updatedAgo"));
        return out;
    }

    /**
     * TOOL 3: active_requests
     * This hospital's active requests: id, blood group, units, urgency, status, counts, time left.
     */
    public Map<String, Object> activeRequests(int hospitalId) throws SQLException {
        validateReadOnlyTool("active_requests");

        List<Map<String, Object>> list = requestDao.listByHospital(hospitalId);
        List<Map<String, Object>> activeOnly = new ArrayList<>();

        com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();

        if (list != null) {
            for (Map<String, Object> r : list) {
                String st = r.get("status") != null ? r.get("status").toString() : "";
                String stLower = st.toLowerCase();
                if (stLower.equals("active") || stLower.equals("open") || stLower.equals("accepted") || stLower.equals("arrived") || stLower.equals("pending")) {
                    int reqId = r.get("id") != null ? ((Number) r.get("id")).intValue() : 0;
                    Map<String, Object> metrics = notifDao.getRequestMetrics(reqId);

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", reqId);
                    item.put("bloodGroup", r.get("bloodType") != null ? r.get("bloodType") : r.get("blood_type"));
                    item.put("units", r.get("unitsRequested") != null ? r.get("unitsRequested") : r.get("units_requested"));
                    item.put("urgency", r.get("urgencyLevel") != null ? r.get("urgencyLevel") : r.get("urgency_level"));
                    item.put("status", st);

                    Map<String, Object> counts = new LinkedHashMap<>();
                    counts.put("notified", metrics.getOrDefault("notified", 0));
                    counts.put("accepted", metrics.getOrDefault("accepted", 0));
                    counts.put("arrived", metrics.getOrDefault("arrived", 0));
                    item.put("counts", counts);

                    // Compute time left from requiredBefore if available
                    Object reqBefore = r.get("requiredBefore");
                    if (reqBefore == null) reqBefore = r.get("required_before");
                    String timeLeft = "Normal standard priority";
                    if (reqBefore != null) {
                        try {
                            String s = reqBefore.toString();
                            if (s.contains("T") || s.contains(" ")) {
                                java.time.LocalDateTime dt = java.time.LocalDateTime.parse(s.replace(" ", "T"));
                                java.time.Duration dur = java.time.Duration.between(java.time.LocalDateTime.now(), dt);
                                if (dur.isNegative()) {
                                    timeLeft = "Deadline elapsed";
                                } else {
                                    long mins = dur.toMinutes();
                                    if (mins < 60) timeLeft = mins + " mins left";
                                    else timeLeft = (mins / 60) + " hrs " + (mins % 60) + " mins left";
                                }
                            }
                        } catch (Exception ignored) {}
                    }
                    item.put("timeLeft", timeLeft);
                    activeOnly.add(item);
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hospitalId", hospitalId);
        out.put("totalActive", activeOnly.size());
        out.put("requests", activeOnly);
        return out;
    }

    /**
     * TOOL 4: prepare_search
     * Returns prefill payload for Find Donors form. Sends nothing. Never accepts free text.
     */
    public Map<String, Object> prepareSearch(String bloodGroup, int radiusKm, boolean includeCompatible, int units, String urgency, Integer neededWithinMinutes) {
        validateReadOnlyTool("prepare_search");

        String targetBlood = BloodCompatibilityUtil.normalizeBloodGroup(bloodGroup);
        if (targetBlood == null) targetBlood = "O+";
        int rad = Math.max(1, Math.min(20, radiusKm > 0 ? radiusKm : 10));
        int u = Math.max(1, Math.min(20, units > 0 ? units : 1));
        String urg = (urgency != null && !urgency.isBlank()) ? urgency.trim().toUpperCase() : "NORMAL";
        if (!Set.of("CRITICAL", "HIGH", "NORMAL", "LOW").contains(urg)) urg = "NORMAL";

        Map<String, Object> prefill = new LinkedHashMap<>();
        prefill.put("bloodGroup", targetBlood);
        prefill.put("radiusKm", rad);
        prefill.put("includeCompatible", includeCompatible);
        prefill.put("unitsNeeded", u);
        prefill.put("urgency", urg);
        if (neededWithinMinutes != null && neededWithinMinutes > 0) {
            prefill.put("neededWithinMinutes", Math.min(1440, neededWithinMinutes));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("action", "PREPARE_ONLY");
        out.put("readyToSend", false);
        out.put("prefill", prefill);
        out.put("message", "Search parameters prefilled. Staff must review and initiate manual search.");
        return out;
    }

    /**
     * Audit log: user, tool, parameters, result counts, time (no raw text).
     */
    public void recordToolAudit(int hospitalId, String userIdentifier, String toolName, Map<String, Object> params, Map<String, Object> resultCounts) {
        String sql = "INSERT INTO assistant_tool_audits (hospital_id, user_identifier, tool_name, parameters_json, result_counts_json) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            ps.setInt(1, hospitalId);
            ps.setString(2, userIdentifier != null ? userIdentifier : "hospital_staff");
            ps.setString(3, toolName);

            // Sanitize params (never store free text, patient references, or coordinates)
            Map<String, Object> safeParams = new LinkedHashMap<>();
            if (params != null) {
                if (params.containsKey("bloodGroup")) safeParams.put("bloodGroup", params.get("bloodGroup"));
                if (params.containsKey("radiusKm")) safeParams.put("radiusKm", params.get("radiusKm"));
                if (params.containsKey("includeCompatible")) safeParams.put("includeCompatible", params.get("includeCompatible"));
                if (params.containsKey("units")) safeParams.put("units", params.get("units"));
                if (params.containsKey("urgency")) safeParams.put("urgency", params.get("urgency"));
            }
            ps.setString(4, MAPPER.writeValueAsString(safeParams));

            // Sanitize result counts (only integers/tallies)
            Map<String, Object> safeCounts = new LinkedHashMap<>();
            if (resultCounts != null) {
                if (resultCounts.containsKey("totalEligible")) safeCounts.put("totalEligible", resultCounts.get("totalEligible"));
                if (resultCounts.containsKey("exactGroupCount")) safeCounts.put("exactGroupCount", resultCounts.get("exactGroupCount"));
                if (resultCounts.containsKey("notAvailableTotal")) safeCounts.put("notAvailableTotal", resultCounts.get("notAvailableTotal"));
                if (resultCounts.containsKey("totalActive")) safeCounts.put("totalActive", resultCounts.get("totalActive"));
            }
            ps.setString(5, MAPPER.writeValueAsString(safeCounts));

            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice recording assistant tool audit: {}", e.getMessage());
        }
    }

    /**
     * Searches matching exact and compatible donors for the assistant
     * with reliability metrics, acceptance accuracy, and response speed.
     * Highlights top-accuracy and fastest-response donors (Requirement 3 & 4).
     */
    public List<Map<String, Object>> searchDonorsForAssistant(int hospitalId, String bloodGroup, double radiusKm, boolean includeCompatible) {
        List<Map<String, Object>> result = new ArrayList<>();
        try {
            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return result;
            Double lat = hosp.get("latitude") instanceof Number ? ((Number) hosp.get("latitude")).doubleValue() : null;
            Double lng = hosp.get("longitude") instanceof Number ? ((Number) hosp.get("longitude")).doubleValue() : null;
            if (lat == null || lng == null || (lat == 0.0 && lng == 0.0)) {
                return result;
            }

            Map<String, Object> searchRes = donorDao.searchMatchingDonorsForHospital(lat, lng, radiusKm, bloodGroup, hospitalId);
            Object donorsObj = searchRes.get("donors");
            if (donorsObj instanceof List<?>) {
                for (Object item : (List<?>) donorsObj) {
                    if (item instanceof Map<?, ?>) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> donorMap = (Map<String, Object>) item;
                        boolean isExact = Boolean.TRUE.equals(donorMap.get("isExactMatch"));
                        if (!includeCompatible && !isExact) {
                            continue;
                        }

                        int donorId = ((Number) donorMap.get("id")).intValue();
                        Map<String, Object> metrics = notificationDao.getDonorReliabilityMetrics(donorId);

                        Map<String, Object> card = new LinkedHashMap<>();
                        card.put("id", donorId);
                        // Name: first name + last initial or public display name
                        String name = (String) donorMap.get("publicDisplayName");
                        if (name == null || name.isBlank()) {
                            name = (String) donorMap.get("name");
                            if (name != null) {
                                String[] parts = name.trim().split("\\s+");
                                if (parts.length > 1) {
                                    name = parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
                                } else {
                                    name = parts[0];
                                }
                            } else {
                                name = "Donor #" + donorId;
                            }
                        }
                        card.put("name", name);
                        card.put("bloodType", donorMap.get("bloodType"));
                        card.put("isExact", isExact);
                        card.put("distanceKm", donorMap.get("distanceKm"));
                        card.put("distanceFormatted", donorMap.get("distanceFormatted"));
                        card.put("requestStatus", donorMap.getOrDefault("requestStatus", "Available"));
                        
                        // Reliability and Acceptance metrics (Requirement 4)
                        card.put("acceptanceRate", metrics.get("acceptanceRate"));
                        card.put("acceptanceAccuracy", metrics.get("acceptanceAccuracy"));
                        card.put("responseSpeed", metrics.get("responseSpeed"));
                        card.put("reliabilityBadge", metrics.get("reliabilityBadge"));
                        card.put("isHighReliability", metrics.get("isHighReliability"));
                        card.put("donationsCount", metrics.get("donationsCount"));

                        result.add(card);
                    }
                }
            }

            // Sort: Exact match first, high reliability first, closest distance first
            result.sort((a, b) -> {
                boolean exactA = Boolean.TRUE.equals(a.get("isExact"));
                boolean exactB = Boolean.TRUE.equals(b.get("isExact"));
                if (exactA != exactB) return exactA ? -1 : 1;

                boolean relA = Boolean.TRUE.equals(a.get("isHighReliability"));
                boolean relB = Boolean.TRUE.equals(b.get("isHighReliability"));
                if (relA != relB) return relA ? -1 : 1;

                double distA = ((Number) a.getOrDefault("distanceKm", 999.0)).doubleValue();
                double distB = ((Number) b.getOrDefault("distanceKm", 999.0)).doubleValue();
                return Double.compare(distA, distB);
            });

        } catch (Exception e) {
            log.warn("Error in searchDonorsForAssistant for hospital {}: {}", hospitalId, e.getMessage());
        }
        return result;
    }

    private static Double asDouble(Object val) {
        return val instanceof Number ? ((Number) val).doubleValue() : null;
    }

    private static String str(Object val) {
        return val != null ? val.toString().trim() : null;
    }
}
