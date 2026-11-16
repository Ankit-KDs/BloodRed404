package com.red404.service;

import com.red404.util.DBConnection;
import com.red404.util.BloodCompatibilityUtil;
import com.red404.util.DistanceCalculator;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * PublicSearchService
 *
 * Implements Round 5 Part 3: Public Blood Availability Search (no login
 * required).
 * 
 * Guarantees:
 * 1. AGGREGATES ONLY:
 * - Verified hospitals in radius: name, area, distance, units of requested
 * group +
 * collapsible compatible groups breakdown, updated ago, directions link, public
 * emergency number.
 * - Eligible donors as COUNTS only per band (0-5km, 5-10km, 10-20km).
 * - Masked count: 0 -> "None", 1 or 2 -> "Fewer than 3", >=3 -> raw count
 * string.
 * - ZERO personal donor details returned, logged, or rendered (no names, IDs,
 * phones, exact coords, map pins).
 * 2. Privacy & Rate Limits:
 * - Visitor coordinates rounded to ~1 km grid (2 decimal places).
 * - IP rate limits: 120/min and 1500/hour.
 * - Anonymous client cookie rate limits: 20/min and 200/hour.
 * - Max 12 distinct grid cells per client per hour.
 * - Global circuit breaker if > N req/s.
 * - Cache public results per (group, grid cell, radius) for 10 seconds,
 * invalidated on stock.updated.
 */
public class PublicSearchService {

    private static final Logger log = LoggerFactory.getLogger(PublicSearchService.class);

    private static final String ANON_COOKIE_NAME = "RED404_ANON_ID";
    private static final long CACHE_TTL_MS = 10_000L; // 10 seconds

    // Configuration defaults (overrideable via System properties or environment
    // variables)
    private static int getEnvInt(String key, int fallback) {
        String prop = System.getProperty(key);
        if (prop == null || prop.isBlank())
            prop = System.getenv(key);
        if (prop != null && !prop.isBlank()) {
            try {
                return Integer.parseInt(prop.trim());
            } catch (Exception ignored) {
            }
        }
        return fallback;
    }

    public static int getRateLimitIpMin() {
        return getEnvInt("RATE_LIMIT_IP_PER_MIN", 120);
    }

    public static int getRateLimitIpHour() {
        return getEnvInt("RATE_LIMIT_IP_PER_HOUR", 1500);
    }

    public static int getRateLimitAnonMin() {
        return getEnvInt("RATE_LIMIT_ANON_PER_MIN", 20);
    }

    public static int getRateLimitAnonHour() {
        return getEnvInt("RATE_LIMIT_ANON_PER_HOUR", 200);
    }

    public static int getMaxGridCellsPerHour() {
        return getEnvInt("MAX_GRID_CELLS_PER_CLIENT_PER_HOUR", 12);
    }

    public static int getGlobalBreakerRps() {
        return getEnvInt("GLOBAL_RATE_BREAKER_RPS", 100);
    }

    public static int getFreshnessHours() {
        return getEnvInt("DONOR_LOCATION_FRESHNESS_HOURS", 24);
    }

    // Rate Limiting Tracking Structures
    private static final Map<String, List<Long>> ipRequests = new ConcurrentHashMap<>();
    private static final Map<String, List<Long>> anonRequests = new ConcurrentHashMap<>();
    private static final Map<String, Map<String, Long>> anonGridCells = new ConcurrentHashMap<>();

    // Global Request Rate Breaker
    private static final AtomicInteger globalSecCounter = new AtomicInteger(0);
    private static volatile long currentSecTimestamp = System.currentTimeMillis() / 1000L;

    // 10-Second Aggregate Cache
    private static final Map<String, CacheEntry> publicCache = new ConcurrentHashMap<>();

    private static class CacheEntry {
        final Map<String, Object> data;
        final long expiresAt;

        CacheEntry(Map<String, Object> data, long expiresAt) {
            this.data = data;
            this.expiresAt = expiresAt;
        }

        boolean isValid() {
            return System.currentTimeMillis() < expiresAt;
        }
    }

    public static void clearCache() {
        publicCache.clear();
        log.info("Public search aggregate cache cleared.");
    }

    /**
     * Checks rate limits and client anonymity tracking.
     * Returns null if allowed, or an error map if rate limited.
     */
    public static Map<String, Object> checkRateLimits(HttpServletRequest request, HttpServletResponse response,
            double gridLat, double gridLng) {
        long now = System.currentTimeMillis();
        long nowSec = now / 1000L;

        // 1. Global Circuit Breaker check
        if (nowSec != currentSecTimestamp) {
            currentSecTimestamp = nowSec;
            globalSecCounter.set(1);
        } else {
            if (globalSecCounter.incrementAndGet() > getGlobalBreakerRps()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 2);
                err.put("message", "Service temporarily under heavy load. Please retry in a few moments.");
                return err;
            }
        }

        // 2. IP Rate Limiting
        String clientIp = getClientIp(request);
        String ipHash = hashString(clientIp);

        cleanSlidingWindow(ipRequests, ipHash, now, 3600_000L);
        List<Long> ipTimestamps = ipRequests.computeIfAbsent(ipHash,
                k -> Collections.synchronizedList(new ArrayList<>()));

        long oneMinAgo = now - 60_000L;
        long oneHourAgo = now - 3600_000L;
        int ipCountMin = 0;
        int ipCountHour = 0;
        synchronized (ipTimestamps) {
            for (Long t : ipTimestamps) {
                if (t >= oneHourAgo) {
                    ipCountHour++;
                    if (t >= oneMinAgo)
                        ipCountMin++;
                }
            }
            if (ipCountMin >= getRateLimitIpMin()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 60);
                err.put("message", "Rate limit exceeded (IP per minute). Please retry in 60 seconds.");
                return err;
            }
            if (ipCountHour >= getRateLimitIpHour()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 3600);
                err.put("message", "Hourly search rate limit exceeded for your network. Please retry later.");
                return err;
            }
            ipTimestamps.add(now);
        }

        // 3. Anonymous Client Cookie Limit & Grid Cell Tracking
        String anonId = getOrSetAnonCookie(request, response);
        cleanSlidingWindow(anonRequests, anonId, now, 3600_000L);
        List<Long> anonTimestamps = anonRequests.computeIfAbsent(anonId,
                k -> Collections.synchronizedList(new ArrayList<>()));

        int anonCountMin = 0;
        int anonCountHour = 0;
        synchronized (anonTimestamps) {
            for (Long t : anonTimestamps) {
                if (t >= oneHourAgo) {
                    anonCountHour++;
                    if (t >= oneMinAgo)
                        anonCountMin++;
                }
            }
            if (anonCountMin >= getRateLimitAnonMin()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 60);
                err.put("message", "Search rate limit exceeded. Please wait 60 seconds.");
                return err;
            }
            if (anonCountHour >= getRateLimitAnonHour()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 3600);
                err.put("message", "Hourly limit reached for this session. Please retry later.");
                return err;
            }
            anonTimestamps.add(now);
        }

        // 4. Grid Cell Hopping Check (max distinct cells per hour)
        String cellKey = String.format(Locale.US, "%.2f,%.2f", gridLat, gridLng);
        Map<String, Long> cells = anonGridCells.computeIfAbsent(anonId, k -> new ConcurrentHashMap<>());
        cells.entrySet().removeIf(e -> (now - e.getValue()) > 3600_000L);
        if (!cells.containsKey(cellKey)) {
            if (cells.size() >= getMaxGridCellsPerHour()) {
                Map<String, Object> err = new HashMap<>();
                err.put("status", 429);
                err.put("retryAfter", 3600);
                err.put("message", "Location query variance limit reached. Please wait before querying other areas.");
                return err;
            }
            cells.put(cellKey, now);
        }

        return null;
    }

    /**
     * Executes the public blood availability aggregate search.
     */
    public static Map<String, Object> searchAvailability(
            String rawBloodGroup,
            Double rawLat,
            Double rawLng,
            double radiusKm,
            String manualLocation,
            HttpServletRequest request,
            HttpServletResponse response) {

        // Canonical blood group check
        String bloodGroup = (rawBloodGroup == null || rawBloodGroup.isBlank()) ? "ALL"
                : rawBloodGroup.trim().toUpperCase();
        if (!"ALL".equals(bloodGroup) && !BloodCompatibilityUtil.CANONICAL_GROUPS.contains(bloodGroup)) {
            bloodGroup = "ALL";
        }

        // Clamp radius to 5, 10, or 20
        if (radiusKm <= 5.0)
            radiusKm = 5.0;
        else if (radiusKm <= 10.0)
            radiusKm = 10.0;
        else
            radiusKm = 20.0;

        // Resolve coordinates
        Double searchLat = rawLat;
        Double searchLng = rawLng;
        if ((searchLat == null || searchLng == null || (searchLat == 0.0 && searchLng == 0.0)) && manualLocation != null
                && !manualLocation.isBlank()) {
            double[] resolved = resolveManualLocation(manualLocation.trim());
            if (resolved != null) {
                searchLat = resolved[0];
                searchLng = resolved[1];
            }
        }

        if (searchLat == null || searchLng == null || (searchLat == 0.0 && searchLng == 0.0)) {
            Map<String, Object> missingLoc = new LinkedHashMap<>();
            missingLoc.put("success", false);
            missingLoc.put("message", "Location is required. Please enable GPS or enter a city / PIN code.");
            missingLoc.put("requiresLocation", true);
            return missingLoc;
        }

        // Round coordinates to ~1 km grid cell (2 decimal places) for privacy
        double gridLat = Math.round(searchLat * 100.0) / 100.0;
        double gridLng = Math.round(searchLng * 100.0) / 100.0;
        String gridCell = String.format(Locale.US, "%.2f,%.2f", gridLat, gridLng);

        // Check Rate Limits
        if (request != null && response != null) {
            Map<String, Object> rateErr = checkRateLimits(request, response, gridLat, gridLng);
            if (rateErr != null) {
                return rateErr;
            }
        }

        // Check 10s Public Aggregate Cache
        String cacheKey = bloodGroup + ":" + gridCell + ":" + (int) radiusKm;
        CacheEntry cached = publicCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            return cached.data;
        }

        // Log search anonymously (only IP hash, blood group, grid cell, radius - NEVER
        // exact coords or personal info)
        String ipHash = request != null ? hashString(getClientIp(request)) : "local";
        log.info("Public search executed: ipHash={}, group={}, grid={}, radius={}km", ipHash, bloodGroup, gridCell,
                radiusKm);

        // Perform live database aggregation
        Map<String, Object> result = executeAggregateQuery(bloodGroup, gridLat, gridLng, radiusKm, gridCell);

        // Cache for 10s
        publicCache.put(cacheKey, new CacheEntry(result, System.currentTimeMillis() + CACHE_TTL_MS));

        return result;
    }

    private static Map<String, Object> executeAggregateQuery(String bloodGroup, double gridLat, double gridLng,
            double radiusKm, String gridCell) {
        List<Map<String, Object>> hospitalsList = new ArrayList<>();

        // 1. Query Verified Partner Hospitals within Radius
        String hospSql = "SELECT id, hospital_name, city, state, address, pincode, latitude, longitude, emergency_contact, hospital_phone "
                +
                "FROM hospitals " +
                "WHERE LOWER(COALESCE(verification_status, '')) = 'verified' " +
                "AND (deleted_at IS NULL) " +
                "AND latitude IS NOT NULL AND longitude IS NOT NULL";

        try (Connection conn = DBConnection.getConnection();
                Statement st = conn.createStatement();
                ResultSet rs = st.executeQuery(hospSql)) {

            while (rs.next()) {
                double hLat = rs.getDouble("latitude");
                double hLng = rs.getDouble("longitude");
                if (hLat == 0.0 && hLng == 0.0)
                    continue;

                double dist = DistanceCalculator.calculateDistance(gridLat, gridLng, hLat, hLng);
                if (dist > radiusKm)
                    continue;

                int hospId = rs.getInt("id");
                String hName = rs.getString("hospital_name");
                String city = rs.getString("city");
                String state = rs.getString("state");
                String address = rs.getString("address");
                String pincode = rs.getString("pincode");
                String emergencyContact = rs.getString("emergency_contact");
                String hospitalPhone = rs.getString("hospital_phone");

                String area = formatHospitalArea(city, state, address, pincode);
                String publicPhone = (emergencyContact != null && !emergencyContact.isBlank()) ? emergencyContact.trim()
                        : ((hospitalPhone != null && !hospitalPhone.isBlank()) ? hospitalPhone.trim() : null);

                // Fetch stock for this verified hospital
                Map<String, Integer> stockMap = getHospitalStock(conn, hospId);
                int requestedUnits = 0;
                int totalCompatibleUnits = 0;
                Map<String, Integer> compatibleBreakdown = new LinkedHashMap<>();

                if ("ALL".equals(bloodGroup)) {
                    for (String bg : StockService.ALL_BLOOD_GROUPS) {
                        int u = stockMap.getOrDefault(bg, 0);
                        requestedUnits += u;
                        compatibleBreakdown.put(bg, u);
                    }
                    totalCompatibleUnits = requestedUnits;
                } else {
                    requestedUnits = stockMap.getOrDefault(bloodGroup, 0);
                    List<String> compatGroups = BloodCompatibilityUtil.getCompatibleDonorGroups(bloodGroup);
                    for (String cg : compatGroups) {
                        int u = stockMap.getOrDefault(cg, 0);
                        compatibleBreakdown.put(cg, u);
                        totalCompatibleUnits += u;
                    }
                }

                Map<String, Object> hItem = new LinkedHashMap<>();
                hItem.put("name", hName);
                hItem.put("area", area);
                hItem.put("distanceKm", Math.round(dist * 10.0) / 10.0);
                hItem.put("requestedGroupUnits", requestedUnits);
                hItem.put("compatibleUnits", totalCompatibleUnits);
                hItem.put("compatibleStock", compatibleBreakdown);
                hItem.put("updatedAgo", getHospitalStockUpdatedAgo(conn, hospId));
                hItem.put("directionsUrl", String.format(Locale.US,
                        "https://www.google.com/maps/dir/?api=1&destination=%.4f,%.4f", hLat, hLng));
                hItem.put("emergencyPhone", publicPhone);

                hospitalsList.add(hItem);
            }
        } catch (Exception e) {
            log.error("Error querying verified hospitals in radius: {}", e.getMessage());
        }

        // Sort hospitals by distance ascending
        hospitalsList.sort(Comparator.comparingDouble(h -> ((Number) h.get("distanceKm")).doubleValue()));

        // 2. Query Eligible Donors as COUNTS ONLY per band (0-5, 5-10, 10-20 km)
        int exact0_5 = 0;
        int comp0_5 = 0;
        int exact5_10 = 0;
        int comp5_10 = 0;
        int exact10_20 = 0;
        int comp10_20 = 0;

        int freshnessHours = getFreshnessHours();
        long freshnessCutoff = System.currentTimeMillis() - (freshnessHours * 3600_000L);

        String donorSql = "SELECT * FROM donors WHERE (availability IS NULL OR (LOWER(availability) NOT IN ('unavailable', 'busy', 'paused') AND (paused_until IS NULL OR paused_until <= CURRENT_DATE)))";

        try (Connection conn = DBConnection.getConnection();
                Statement st = conn.createStatement();
                ResultSet rs = st.executeQuery(donorSql)) {

            while (rs.next()) {
                Map<String, Object> donorMap = mapDonorRow(rs);

                // Authoritative Eligibility Check
                if (!DonorEligibilityService.isEligible(donorMap)) {
                    continue;
                }

                Object latObj = donorMap.get("latitude");
                Object lngObj = donorMap.get("longitude");
                if (!(latObj instanceof Number) || !(lngObj instanceof Number))
                    continue;
                double dLat = ((Number) latObj).doubleValue();
                double dLng = ((Number) lngObj).doubleValue();
                if (dLat == 0.0 && dLng == 0.0)
                    continue;

                // Location Freshness Check
                Timestamp locUpdated = (Timestamp) donorMap.get("location_updated_at");
                if (locUpdated == null)
                    locUpdated = (Timestamp) donorMap.get("created_at");
                if (locUpdated != null && locUpdated.getTime() < freshnessCutoff) {
                    continue; // Stale location
                }

                double dist = DistanceCalculator.calculateDistance(gridLat, gridLng, dLat, dLng);
                if (dist > radiusKm || dist > 20.0)
                    continue;

                String donorBlood = (String) donorMap.get("blood_type");
                if (donorBlood == null)
                    donorBlood = (String) donorMap.get("bloodType");
                if (donorBlood == null)
                    continue;
                donorBlood = donorBlood.trim().toUpperCase();

                boolean isExact = "ALL".equals(bloodGroup) || donorBlood.equalsIgnoreCase(bloodGroup);
                boolean isCompatible = !isExact && BloodCompatibilityUtil.isCompatible(donorBlood, bloodGroup);

                if (!isExact && !isCompatible && !"ALL".equals(bloodGroup)) {
                    continue;
                }

                // Increment band count
                if (dist < 5.0) {
                    if (isExact)
                        exact0_5++;
                    else
                        comp0_5++;
                } else if (dist < 10.0) {
                    if (isExact)
                        exact5_10++;
                    else
                        comp5_10++;
                } else {
                    if (isExact)
                        exact10_20++;
                    else
                        comp10_20++;
                }
            }
        } catch (Exception e) {
            log.error("Error aggregating eligible donors in radius: {}", e.getMessage());
        }

        // Build Masked Count Representations: 0 -> "None", 1-2 -> "Fewer than 3", >=3
        // -> raw count
        Map<String, Object> donorBands = new LinkedHashMap<>();
        donorBands.put("band_0_5", createBandSummary("0 - 5 km", exact0_5, comp0_5));
        donorBands.put("band_5_10", createBandSummary("5 - 10 km", exact5_10, comp5_10));
        donorBands.put("band_10_20", createBandSummary("10 - 20 km", exact10_20, comp10_20));

        int totalDonorsFound = exact0_5 + comp0_5 + exact5_10 + comp5_10 + exact10_20 + comp10_20;
        String totalDonorsDisplay = maskCount(totalDonorsFound);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("bloodGroup", bloodGroup);
        result.put("radiusKm", radiusKm);
        result.put("gridCell", gridCell);
        result.put("hospitals", hospitalsList);
        result.put("totalHospitals", hospitalsList.size());
        result.put("donorCounts", donorBands);
        result.put("totalEligibleDonors", totalDonorsDisplay);
        result.put("infoLine", "Only hospitals can send requests to donors.");
        result.put("timestamp", Instant.now().toString());

        return result;
    }

    private static Map<String, Object> createBandSummary(String label, int exact, int compatible) {
        Map<String, Object> band = new LinkedHashMap<>();
        band.put("range", label);
        band.put("exactDisplay", maskCount(exact));
        band.put("compatibleDisplay", maskCount(compatible));
        band.put("totalDisplay", maskCount(exact + compatible));
        return band;
    }

    public static String maskCount(int count) {
        if (count <= 0)
            return "None";
        if (count < 3)
            return "Fewer than 3";
        return String.valueOf(count);
    }

    private static Map<String, Integer> getHospitalStock(Connection conn, int hospitalId) {
        Map<String, Integer> stock = new HashMap<>();
        String sql = "SELECT blood_type, units FROM hospital_inventory WHERE hospital_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    stock.put(rs.getString("blood_type"), rs.getInt("units"));
                }
            }
        } catch (Exception ignored) {
        }
        return stock;
    }

    private static String getHospitalStockUpdatedAgo(Connection conn, int hospitalId) {
        String sql = "SELECT MAX(updated_at) FROM hospital_inventory WHERE hospital_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Timestamp ts = rs.getTimestamp(1);
                    if (ts != null) {
                        long diffSec = (System.currentTimeMillis() - ts.getTime()) / 1000L;
                        if (diffSec < 60)
                            return "Just now";
                        long diffMin = diffSec / 60;
                        if (diffMin < 60)
                            return diffMin + "m ago";
                        long diffHr = diffMin / 60;
                        if (diffHr < 24)
                            return diffHr + "h ago";
                        return (diffHr / 24) + "d ago";
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "Just now";
    }

    private static String formatHospitalArea(String city, String state, String address, String pincode) {
        List<String> parts = new ArrayList<>();
        if (city != null && !city.isBlank())
            parts.add(city.trim());
        if (state != null && !state.isBlank())
            parts.add(state.trim());
        if (parts.isEmpty() && address != null && !address.isBlank()) {
            parts.add(address.trim());
        }
        if (pincode != null && !pincode.isBlank()) {
            parts.add(pincode.trim());
        }
        return parts.isEmpty() ? "Local Area" : String.join(", ", parts);
    }

    private static double[] resolveManualLocation(String loc) {
        String lower = loc.toLowerCase().trim();
        // 1. Check if input is a 6-digit pincode or city name matching in database
        try (Connection conn = DBConnection.getConnection()) {
            String sql = "SELECT AVG(latitude), AVG(longitude) FROM hospitals WHERE (pincode = ? OR LOWER(city) = ?) AND latitude IS NOT NULL AND longitude IS NOT NULL";
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, loc);
                ps.setString(2, lower);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        double lat = rs.getDouble(1);
                        double lng = rs.getDouble(2);
                        if (lat != 0.0 && lng != 0.0)
                            return new double[] { lat, lng };
                    }
                }
            }
            // Check in donors
            String dSql = "SELECT AVG(latitude), AVG(longitude) FROM donors WHERE (pincode = ? OR LOWER(city) = ?) AND latitude IS NOT NULL AND longitude IS NOT NULL";
            try (PreparedStatement ps = conn.prepareStatement(dSql)) {
                ps.setString(1, loc);
                ps.setString(2, lower);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        double lat = rs.getDouble(1);
                        double lng = rs.getDouble(2);
                        if (lat != 0.0 && lng != 0.0)
                            return new double[] { lat, lng };
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // Fallback reference coordinates for common regions/pincodes in project context
        if (lower.contains("bhimtal") || lower.contains("263136"))
            return new double[] { 29.3500, 79.5200 };
        if (lower.contains("nainital") || lower.contains("263001") || lower.contains("263002"))
            return new double[] { 29.3803, 79.4636 };
        if (lower.contains("haldwani") || lower.contains("263139"))
            return new double[] { 29.2183, 79.5130 };
        if (lower.contains("delhi") || lower.contains("110001"))
            return new double[] { 28.6139, 77.2090 };
        if (lower.contains("mumbai") || lower.contains("400001"))
            return new double[] { 19.0760, 72.8777 };
        if (lower.contains("meerut") || lower.contains("250001"))
            return new double[] { 28.9845, 77.7064 };

        return null;
    }

    private static Map<String, Object> mapDonorRow(ResultSet rs) {
        Map<String, Object> map = new HashMap<>();
        try {
            ResultSetMetaData meta = rs.getMetaData();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                map.put(meta.getColumnLabel(i), rs.getObject(i));
            }
        } catch (Exception ignored) {
        }
        return map;
    }

    private static String getClientIp(HttpServletRequest request) {
        if (request == null)
            return "127.0.0.1";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }

    private static String hashString(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; i < 8; i++) { // 16-hex char prefix
                hex.append(String.format("%02x", hash[i]));
            }
            return hex.toString();
        } catch (Exception e) {
            return Integer.toHexString(input.hashCode());
        }
    }

    private static String getOrSetAnonCookie(HttpServletRequest request, HttpServletResponse response) {
        if (request != null && request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (ANON_COOKIE_NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                    return c.getValue().trim();
                }
            }
        }
        String newAnonId = UUID.randomUUID().toString();
        if (response != null) {
            Cookie cookie = new Cookie(ANON_COOKIE_NAME, newAnonId);
            cookie.setPath("/");
            cookie.setHttpOnly(true);
            cookie.setMaxAge(86400 * 30); // 30 days
            response.addCookie(cookie);
        }
        return newAnonId;
    }

    private static void cleanSlidingWindow(Map<String, List<Long>> map, String key, long now, long windowMs) {
        List<Long> list = map.get(key);
        if (list == null)
            return;
        long cutoff = now - windowMs;
        synchronized (list) {
            list.removeIf(t -> t < cutoff);
        }
    }
}
