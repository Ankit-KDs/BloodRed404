package com.red404.controller;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import java.time.LocalDate;
import java.time.Period;
import java.util.LinkedHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import com.red404.dao.ConsentDao;
import com.red404.service.EmailVerificationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.DonorDao;
import com.red404.dao.SessionDao;
import com.red404.service.DonorEligibilityService;
import com.red404.model.ApiResponse;
import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;
import com.red404.util.GeoLocationUtil;
import com.red404.util.JsonUtil;
import com.red404.util.PasswordUtil;
import com.red404.util.UserAgentUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import com.red404.service.PublicSearchService;
import com.red404.service.RateLimitService;

@RestController
@RequestMapping({"/api/donors", "/api/donor"})
public class DonorController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(DonorController.class);

    private static final Map<Integer, List<SseEmitter>> donorEmitters = new ConcurrentHashMap<>();

    private static void removeDonorEmitter(int donorId, SseEmitter emitter) {
        List<SseEmitter> list = donorEmitters.get(donorId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) donorEmitters.remove(donorId);
        }
    }

    public static void broadcastDonorEvent(int donorId, String eventName, Object data) {
        List<SseEmitter> list = donorEmitters.get(donorId);
        if (list == null || list.isEmpty()) return;
        List<SseEmitter> dead = new java.util.ArrayList<>();
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        list.removeAll(dead);
    }

    public static final int FRESHNESS_HOURS = DonorDao.FRESHNESS_HOURS;

    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();
    private final SessionDao sessionDao = new SessionDao();
    private final com.red404.dao.DonationDriveDao donationDriveDao = new com.red404.dao.DonationDriveDao();
    private final com.red404.dao.BloodGroupAuditDao bloodGroupAuditDao = new com.red404.dao.BloodGroupAuditDao();
    private final com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();
    private final ConsentDao consentDao = new ConsentDao();
    private final RateLimitService rateLimitService = new RateLimitService();

    @Autowired(required = false)
    private EmailVerificationService emailVerificationService;

    // ======================== GET ========================

    @GetMapping({"/profile", "/profile-data", "/me"})
    public ResponseEntity<ApiResponse> getProfile(
            @RequestParam(required = false) String donorId,
            @RequestParam(required = false) String email,
            HttpServletRequest request) {
        try {
            Map<String, Object> loggedDonor = requireDonor(request);
            if (loggedDonor == null) {
                return unauthorized();
            }

            // Strict IDOR Protection: a donor can only access their own profile
            if (email != null && !email.isBlank()) {
                String sessEmail = (String) loggedDonor.get("email");
                if (sessEmail == null || !sessEmail.equalsIgnoreCase(email.trim())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse(false, "Forbidden: Access to another donor profile is denied."));
                }
            }
            if (donorId != null && !donorId.isBlank()) {
                String sessId = loggedDonor.get("id") != null ? loggedDonor.get("id").toString() : "";
                String sessCode = loggedDonor.get("donorId") != null ? loggedDonor.get("donorId").toString() : "";
                if (!donorId.trim().equalsIgnoreCase(sessId) && !donorId.trim().equalsIgnoreCase(sessCode)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse(false, "Forbidden: Access to another donor profile is denied."));
                }
            }

            String dId = loggedDonor.get("donorId") != null ? loggedDonor.get("donorId").toString() : loggedDonor.get("id").toString();
            Map<String, Object> donorProfile = donorDao.findByIdOrDonorId(dId);
            if (donorProfile == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Donor profile not found or account deleted."));
            }

            // Decrypt application-level encrypted health questionnaire answers for the donor
            String encHealth = (String) donorProfile.get("health_answers_json");
            if (encHealth == null) encHealth = (String) donorProfile.get("healthAnswersJson");
            if (encHealth != null) {
                String dec = com.red404.util.AesGcmEncryptionUtil.decrypt(encHealth);
                donorProfile.put("health_answers_json", dec);
                donorProfile.put("healthAnswersJson", dec);
            }

            if (donorProfile.get("id") instanceof Number num) {
                int dNumId = num.intValue();
                String qt = (String) donorProfile.get("qrToken");
                if (qt == null || qt.isBlank()) {
                    try {
                        String newQt = donorDao.generateOrGetQrToken(dNumId);
                        donorProfile.put("qrToken", newQt);
                        donorProfile.put("qr_token", newQt);
                    } catch (Exception ignored) {}
                }
            }
            DonorEligibilityService.attachEligibility(donorProfile);

            // Step 2 Requirement 3: Add "Health check history" (last 5).
            // The API returns this only to the donor himself, never to other donors, public pages, or the admin directory.
            String dCode = donorProfile.get("donorId") != null ? donorProfile.get("donorId").toString() : donorProfile.get("id").toString();
            List<Map<String, Object>> checks = new com.red404.dao.HealthCheckDao().getHealthCheckHistory(dCode, 5);
            if (checks != null) {
                for (Map<String, Object> c : checks) {
                    c.remove("deferReasonCategory");
                }
            }
            donorProfile.put("healthChecks", checks);
            Map<String, Object> latestCheck = new com.red404.dao.HealthCheckDao().getLatestHealthCheck(dCode);
            if (latestCheck != null) {
                latestCheck.remove("deferReasonCategory");
                donorProfile.put("latestHealthCheck", latestCheck);
            }
            donorProfile.remove("deferReasonCategory");

            return ok("Profile loaded", donorProfile);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/health-checks", "/health-check-history"})
    public ResponseEntity<ApiResponse> getHealthCheckHistory(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            String dCode = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            List<Map<String, Object>> history = new com.red404.dao.HealthCheckDao().getHealthCheckHistory(dCode, 5);
            if (history != null) {
                for (Map<String, Object> c : history) {
                    c.remove("deferReasonCategory");
                }
            }
            return ok("Health check history loaded", history);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/scan", "/scan-profile"})
    public ResponseEntity<ApiResponse> getScanProfile(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String donorId,
            @RequestParam(required = false) String donor) {
        try {
            Map<String, Object> profile = null;
            if (token != null && !token.isBlank()) {
                profile = donorDao.findByToken(token);
            }
            if (profile == null && donorId != null && !donorId.isBlank()) {
                profile = donorDao.findByToken(donorId);
                if (profile == null) {
                    profile = donorDao.findByIdOrDonorId(donorId);
                }
            }
            if (profile == null && donor != null && !donor.isBlank()) {
                profile = donorDao.findByToken(donor);
            }
            if (profile == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Donor intake record not found. Please re-scan QR code."));
            }
            DonorEligibilityService.attachEligibility(profile);
            return ok("Donor scan profile retrieved successfully", profile);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/qr-token", "/qr-pass"})
    public ResponseEntity<ApiResponse> getQrPass(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null || donor.get("id") == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();
            String token = donorDao.generateOrGetQrToken(donorId);
            return ok("QR Pass Token generated", Map.of(
                    "token", token,
                    "qrPayload", "RED404:" + token,
                    "ttlHours", 24
            ));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/qr-token/regenerate", "/regenerate-qr"})
    public ResponseEntity<ApiResponse> regenerateQrToken(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null || donor.get("id") == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();
            String token = donorDao.regenerateQrToken(donorId);
            return ok("QR Pass regenerated successfully. Previous pass has been invalidated.", Map.of(
                    "token", token,
                    "qrPayload", "RED404:" + token,
                    "ttlHours", 24
            ));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/snapshot")
    public ResponseEntity<ApiResponse> saveSnapshot(@RequestBody JsonNode body) {
        try {
            String token = JsonUtil.text(body, "token").trim();
            String donorId = JsonUtil.text(body, "donorId").trim();
            if (donorId.isEmpty()) donorId = JsonUtil.text(body, "id").trim();
            JsonNode dataNode = body.get("data");
            if (dataNode != null && !token.isBlank()) {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                Map<String, Object> dataMap = mapper.convertValue(dataNode, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                donorDao.saveSnapshot(token, donorId, dataMap);
                return ok("Snapshot frozen successfully", token);
            }
            return ResponseEntity.badRequest().body(new ApiResponse(false, "Invalid snapshot payload"));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse> getNearby(
            @RequestParam(required = false) String lat,
            @RequestParam(required = false) String lng,
            @RequestParam(defaultValue = "20") double radius,
            @RequestParam(required = false) String bloodType) {
        try {
            Double latD = parseDouble(lat);
            Double lngD = parseDouble(lng);
            List<Map<String, Object>> list = donorDao.findNearby(latD, lngD, radius, bloodType);
            return ok("Nearby donors loaded", sanitizePublicDonors(list));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/availability", "/availability-search", "/public-availability"})
    public ResponseEntity<?> searchPublicAvailability(
            @RequestParam(required = false, defaultValue = "ALL") String bloodGroup,
            @RequestParam(required = false, defaultValue = "10") double radius,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String pincode,
            @RequestParam(required = false) String lat,
            @RequestParam(required = false) String lng,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            Double latD = parseDouble(lat);
            Double lngD = parseDouble(lng);
            String manualLoc = (location != null && !location.isBlank()) ? location : pincode;
            Map<String, Object> result = PublicSearchService.searchAvailability(bloodGroup, latD, lngD, radius, manualLoc, request, response);

            if (result.containsKey("status") && ((Number) result.get("status")).intValue() == 429) {
                int retryAfter = ((Number) result.getOrDefault("retryAfter", 60)).intValue();
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header("Retry-After", String.valueOf(retryAfter))
                        .body(new ApiResponse(false, (String) result.get("message")));
            }

            if (Boolean.FALSE.equals(result.get("success"))) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, (String) result.get("message"), result));
            }

            return ResponseEntity.ok()
                    .header("Cache-Control", "public, max-age=10")
                    .body(new ApiResponse(true, "Public blood availability loaded", result));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    private List<Map<String, Object>> sanitizePublicDonors(List<Map<String, Object>> rawList) {
        if (rawList == null) return Collections.emptyList();
        List<Map<String, Object>> safe = new ArrayList<>();
        for (Map<String, Object> d : rawList) {
            if (d == null) continue;
            Map<String, Object> item = new HashMap<>();
            String donorId = (String) d.get("donorId");
            if (donorId == null) donorId = (String) d.get("donor_id");
            if (donorId == null && d.get("id") != null) donorId = "DNR-ANON-" + d.get("id");
            item.put("id", donorId);
            item.put("donorId", donorId);

            String rawName = (String) d.get("name");
            if (rawName == null) rawName = (String) d.get("fullName");
            item.put("name", com.red404.dao.BloodRequestNotificationDao.maskDonorName(rawName));

            String bType = (String) d.get("bloodType");
            if (bType == null) bType = (String) d.get("blood_type");
            if (bType == null) bType = (String) d.get("group");
            item.put("bloodType", bType);
            item.put("group", bType);
            item.put("rh", (bType != null && bType.contains("-")) ? "RH-" : "RH+");

            Object dist = d.get("distKm");
            if (dist == null) dist = d.get("distance");
            item.put("distKm", dist);
            item.put("distance", dist);

            // Geographic presence: city and state/zone only, NEVER street address
            item.put("city", d.get("city"));
            item.put("state", d.get("state"));
            item.put("zone", d.get("zone"));
            item.put("status", d.getOrDefault("status", "Ready to Donate"));
            item.put("lastSeen", d.getOrDefault("lastSeen", "Telemetry Active"));

            // Strictly enforce privacy: remove phone, email, password, address, vitals
            safe.add(item);
        }
        return safe;
    }

    @GetMapping({"/platform-stats", "/system-stats"})
    public ResponseEntity<ApiResponse> getPlatformStats() {
        try {
            return ok("Platform stats loaded", donorDao.getPlatformStats());
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/donations", "/donation-history", "/history"})
    public ResponseEntity<ApiResponse> getDonations(
            @RequestParam(required = false) String donorId,
            HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) {
                return unauthorized();
            }
            String sessionDonorId = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            if (donorId != null && !donorId.isBlank()) {
                String paramId = donorId.trim();
                String numId = donor.get("id") != null ? donor.get("id").toString() : "";
                if (!paramId.equalsIgnoreCase(sessionDonorId) && !paramId.equalsIgnoreCase(numId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse(false, "Forbidden: Access to another donor's donation records is denied."));
                }
            }
            return ok("History loaded", donorDao.donationHistory(sessionDonorId));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/dashboard-stats")
    public ResponseEntity<ApiResponse> getDashboardStats(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            Map<String, Object> freshDonor = donorDao.findById((Integer) donor.get("id"));
            if (freshDonor != null) donor = freshDonor;
            Map<String, Object> elig = DonorEligibilityService.computeEligibility(donor);
            List<Map<String, Object>> history = donorDao.donationHistory((Integer) donor.get("id"));
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalDonations", history.size());
            stats.put("livesImpacted", history.size() * 3);
            stats.put("badgesEarned", history.isEmpty() ? 0 : Math.min(history.size(), 6));
            stats.put("donationsThisYear", history.size());
            stats.put("daysToNextEligible", elig.get("days_until_eligible"));
            stats.put("days_until_eligible", elig.get("days_until_eligible"));
            stats.put("nextEligibleDate", elig.get("next_eligible_date"));
            stats.put("next_eligible_date", elig.get("next_eligible_date"));
            stats.put("lastDonationDate", elig.get("last_donation_date"));
            stats.put("last_donation_date", elig.get("last_donation_date"));
            stats.put("isEligible", elig.get("eligible"));
            stats.put("eligible", elig.get("eligible"));
            stats.put("progress_pct", elig.get("progress_pct"));
            stats.put("eligibilityReason", elig.get("reason"));
            stats.put("reason", elig.get("reason"));
            stats.put("eligibility", elig);
            stats.put("donorLevel", history.size() >= 5 ? "Active Donor" : "New Donor");
            stats.put("donorLevelNumber", 1);
            stats.put("donationsToNextLevel", Math.max(0, 5 - history.size()));
            stats.put("publicSearchOptIn", donor.get("publicSearchOptIn") != null ? donor.get("publicSearchOptIn") : donor.get("public_search_opt_in"));
            stats.put("publicConsentAt", donor.get("publicConsentAt") != null ? donor.get("publicConsentAt") : donor.get("public_consent_at"));
            stats.put("nextLevel", "Active Donor");
            stats.put("nextLevelThreshold", 5);
            return ok("Stats loaded", stats);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/donation-chart")
    public ResponseEntity<ApiResponse> getDonationChart() {
        return ok("Chart loaded", new int[12]);
    }

    @GetMapping("/donation-gaps")
    public ResponseEntity<ApiResponse> getDonationGaps() {
        return ok("Donation gap configuration", DonorEligibilityService.getDonationGapConfig());
    }

    @GetMapping("/badges")
    public ResponseEntity<ApiResponse> getBadges() {
        return ok("Badges loaded", defaultBadges());
    }

    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse> getNotifications(HttpServletRequest request) {
        Map<String, Object> donor = requireDonor(request);
        if (donor == null || donor.get("id") == null) return unauthorized();
        int donorId = ((Number) donor.get("id")).intValue();
        return ok("Notifications loaded", donorDao.getDonorNotifications(donorId));
    }



    @GetMapping("/blood-requests")
    public ResponseEntity<ApiResponse> getBloodRequests(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            if (!DonorEligibilityService.isEligible(donor)) {
                return ok("Donor is currently not eligible for emergency blood requests", Collections.emptyList());
            }
            Double lat = asDouble(donor.get("latitude"));
            Double lng = asDouble(donor.get("longitude"));
            return ok("Requests loaded", requestDao.listForDonor(lat, lng));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/alerts", "/active-alerts"})
    public ResponseEntity<ApiResponse> getAlerts(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String bloodGroup,
            HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            Integer donorId = null;
            if (donor != null && donor.get("id") != null) {
                // Authoritative ONE server function isEligible(donor)
                if (!DonorEligibilityService.isEligible(donor)) {
                    return ok("Donor is currently not eligible for emergency requests", Collections.emptyList());
                }

                donorId = ((Number) donor.get("id")).intValue();
                if (lat == null) lat = asDouble(donor.get("latitude"));
                if (lng == null) lng = asDouble(donor.get("longitude"));
                if (bloodGroup == null || bloodGroup.isBlank()) {
                    bloodGroup = (String) donor.get("bloodType");
                }
            }

            // First: Look for actual requests sent or broadcasted to this specific donor
            if (donorId != null) {
                List<Map<String, Object>> notifs = new com.red404.dao.BloodRequestNotificationDao().getNotificationsForDonor(donorId, lat, lng);
                if (!notifs.isEmpty()) {
                    return ok("Active alerts loaded", notifs);
                }
            }

            // Fallback: If no recipient notification records exist, return empty or matching active broadcasts
            List<Map<String, Object>> allRequests = requestDao.listActive();
            List<Map<String, Object>> result = new ArrayList<>();

            for (Map<String, Object> req : allRequests) {
                Double reqLat = asDouble(req.get("latitude"));
                Double reqLng = asDouble(req.get("longitude"));

                double dist = 0.0;
                int eta = 15;
                String zone = "Zone 1 (0-5km)";

                if (lat != null && lng != null && reqLat != null && reqLng != null && reqLat != 0.0 && reqLng != 0.0) {
                    dist = DistanceCalculator.calculateDistance(lat, lng, reqLat, reqLng);
                    eta = DistanceCalculator.getEstimatedTravelTime(dist, "DRIVING");
                    if (dist <= 5.0) {
                        zone = "Zone 1 (0-5km)";
                    } else if (dist <= 10.0) {
                        zone = "Zone 2 (5-10km)";
                    } else {
                        zone = "Zone 3 (10-20km)";
                    }
                }

                req.put("distanceKm", Math.round(dist * 10.0) / 10.0);
                req.put("etaMinutes", Math.max(eta, 5));
                req.put("zone", zone);

                String currentStatus = (String) req.get("status");
                if ("Active".equalsIgnoreCase(currentStatus) || "Open".equalsIgnoreCase(currentStatus) || "Pending".equalsIgnoreCase(currentStatus)) {
                    req.put("status", "New");
                }

                // Filter by blood compatibility if bloodGroup specified
                String reqBlood = (String) req.get("bloodType");
                if (bloodGroup != null && !bloodGroup.isBlank()) {
                    if (com.red404.util.BloodCompatibilityUtil.isCompatible(bloodGroup, reqBlood)) {
                        result.add(req);
                    }
                } else {
                    result.add(req);
                }
            }

            // Sort by distance ascending
            result.sort((a, b) -> Double.compare(((Number) a.getOrDefault("distanceKm", 0.0)).doubleValue(), ((Number) b.getOrDefault("distanceKm", 0.0)).doubleValue()));

            return ok("Active alerts loaded", result);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== DONATION DRIVES & INVITATIONS ========================

    @GetMapping("/drives/invitations")
    public ResponseEntity<ApiResponse> getDriveInvitations(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();

            // Exclude paused donors from drive invitations (Group C.5)
            String avail = (String) donor.get("availability");
            Object isAvail = donor.get("available");
            Object pUntil = donor.get("paused_until");
            boolean isPaused = (avail != null && (avail.equalsIgnoreCase("Paused") || avail.equalsIgnoreCase("Unavailable") || avail.equalsIgnoreCase("Busy")))
                    || (isAvail instanceof Boolean && !((Boolean) isAvail));
            if (!isPaused && pUntil != null) {
                try {
                    if (java.time.LocalDate.parse(pUntil.toString()).isAfter(java.time.LocalDate.now())) {
                        isPaused = true;
                    }
                } catch (Exception ignored) {}
            }
            if (isPaused) {
                return ok("Donor availability is paused", Collections.emptyList());
            }

            String donorId = String.valueOf(donor.get("id"));
            String bloodType = (String) donor.get("bloodType");
            Double lat = asDouble(donor.get("latitude"));
            Double lng = asDouble(donor.get("longitude"));

            List<Map<String, Object>> invitations = donationDriveDao.listUpcomingInvitationsForDonor(donorId, bloodType, lat, lng);
            return ok("Drive invitations loaded", invitations);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/drives/{id}/rsvp")
    public ResponseEntity<ApiResponse> rsvpDrive(@PathVariable int id, @RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();

            // Group C.5: Paused donor cannot RSVP to drives
            String avail = (String) donor.get("availability");
            Object availObj = donor.get("available");
            boolean availBool = (availObj == null || Boolean.TRUE.equals(availObj) || "1".equals(String.valueOf(availObj)));
            Object pausedUntilObj = donor.get("paused_until");
            if (pausedUntilObj == null) pausedUntilObj = donor.get("pausedUntil");
            boolean isPaused = (avail != null && ("paused".equalsIgnoreCase(avail) || "unavailable".equalsIgnoreCase(avail))) || !availBool;
            if (pausedUntilObj != null) {
                try {
                    java.time.LocalDate pausedUntil = java.time.LocalDate.parse(String.valueOf(pausedUntilObj).substring(0, 10));
                    if (!pausedUntil.isBefore(java.time.LocalDate.now())) {
                        isPaused = true;
                    }
                } catch (Exception ignored) {}
            }
            if (isPaused) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Your availability is currently paused. Resume availability to RSVP to donation drives."));
            }

            String donorId = String.valueOf(donor.get("id"));
            String status = JsonUtil.textOrNull(body, "status");
            if (status == null || status.isBlank()) status = "ATTENDING";
            status = status.toUpperCase().trim();
            if (!status.equals("ATTENDING") && !status.equals("DECLINED")) {
                status = "ATTENDING";
            }

            boolean ok = donationDriveDao.saveRsvp(id, donorId, status);
            return ok("RSVP recorded: " + status, Map.of("driveId", id, "status", status));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/current-mission")
    public ResponseEntity<ApiResponse> getCurrentMission(
            @RequestParam(required = false) Integer donorId,
            HttpServletRequest request) {
        try {
            HttpSession session = request.getSession(false);
            if (session != null && session.getAttribute("activeMission") != null) {
                return ok("Active mission found", session.getAttribute("activeMission"));
            }
            return ok("No active mission", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/complete-mission")
    public ResponseEntity<ApiResponse> completeMission(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.removeAttribute("activeMission");
            }
            if (body != null && body.has("requestId")) {
                int reqId = body.get("requestId").asInt();
                requestDao.updateStatus(reqId, "Arrived");
                Map<String, Object> donor = requireDonor(request);
                if (donor != null && donor.get("id") != null) {
                    int dId = ((Number) donor.get("id")).intValue();
                    notifDao.markDonorArrived(reqId, dId);
                }
            }
            return ok("Mission completed successfully (status marked Arrived)", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse> getSettings() {
        return ok("Settings loaded", defaultSettings());
    }

    // ======================== POST ========================

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            // Part 7: Rate limit - 10 donor registrations per hour per IP
            String clientIp = GeoLocationUtil.getClientIp(request);
            RateLimitService.RateLimitResult regCheck = rateLimitService.checkLimit("register_donor_ip:" + clientIp, 10, 3600);
            if (!regCheck.allowed) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header("Retry-After", String.valueOf(regCheck.retryAfterSeconds))
                        .body(new ApiResponse(false, "Too many donor registrations from this network. Please try again later."));
            }

            String firstName = JsonUtil.text(body, "firstName").trim();
            String lastName = JsonUtil.text(body, "lastName").trim();
            if (firstName.isEmpty() || lastName.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "First name and last name are required."));
            }

            String email = JsonUtil.text(body, "email").trim().toLowerCase();
            if (email.isEmpty() || !email.contains("@")) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "A valid email address is required."));
            }
            if (!com.red404.util.SecurityValidationUtil.isValidEmail(email)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "A valid email address is required (disposable email domains are not accepted)."));
            }

            String phone = JsonUtil.text(body, "phone").trim().replaceAll("\\s+", "").replaceAll("[-+]", "");
            if (phone.startsWith("91") && phone.length() == 12) {
                phone = phone.substring(2);
            }
            if (phone.length() != 10 || !phone.matches("\\d{10}")) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Please provide a valid 10-digit mobile number."));
            }

            String password = JsonUtil.text(body, "password").trim();
            if (password.length() < 8) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Password must be at least 8 characters."));
            }
            if (PasswordUtil.isCommonPassword(password) || com.red404.util.SecurityValidationUtil.isCommonPassword(password)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "The password you entered is too common. Please choose a more secure password."));
            }

            String gender = JsonUtil.text(body, "gender").trim();
            if (gender.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Gender is required (Male, Female, or Other)."));
            }

            Date dob = JsonUtil.asDate(body, "dateOfBirth");
            if (dob == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Date of birth is required."));
            }
            LocalDate birthDate = dob.toLocalDate();
            LocalDate today = LocalDate.now();
            int age = Period.between(birthDate, today).getYears();
            if (age < 18) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "You must be at least 18 years of age to register as a donor."));
            }
            if (age > 65) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Maximum donor registration age is 65 years."));
            }

            // Verify email token (Step 4)
            String emailToken = JsonUtil.textOrNull(body, "emailToken");
            if (emailToken == null || emailToken.isBlank()) {
                emailToken = JsonUtil.textOrNull(body, "verificationToken");
            }
            boolean codeVerified = emailVerificationService != null &&
                    emailVerificationService.validateAndConsumeToken(email, emailToken, "DONOR_REGISTRATION");
            if (!codeVerified) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Email verification required. Please verify the 6-digit code sent to your email."));
            }

            // Duplicate checks
            if (donorDao.emailOrPhoneExists(email, phone)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ApiResponse(false, "An account with this email or phone number is already registered. Please login."));
            }

            // Health questions processing
            boolean feverNow = JsonUtil.asBoolean(body, "feverNow", false);
            boolean antibioticsNow = JsonUtil.asBoolean(body, "antibioticsNow", false);
            boolean surgery6m = JsonUtil.asBoolean(body, "surgery6m", false);
            boolean tattoo6m = JsonUtil.asBoolean(body, "tattoo6m", false);
            boolean vaccine4w = JsonUtil.asBoolean(body, "vaccine4w", false);
            boolean travelOutside = JsonUtil.asBoolean(body, "travelOutside", false);
            boolean pregnantNursing = JsonUtil.asBoolean(body, "pregnantNursing", false);
            boolean chronicConditions = JsonUtil.asBoolean(body, "chronicConditions", false);
            boolean hospitalReviewNeeded = feverNow || antibioticsNow || surgery6m || tattoo6m || vaccine4w || travelOutside || pregnantNursing || chronicConditions;

            Map<String, Object> healthMap = new LinkedHashMap<>();
            healthMap.put("feverNow", feverNow);
            healthMap.put("antibioticsNow", antibioticsNow);
            healthMap.put("surgery6m", surgery6m);
            healthMap.put("tattoo6m", tattoo6m);
            healthMap.put("vaccine4w", vaccine4w);
            healthMap.put("travelOutside", travelOutside);
            healthMap.put("pregnantNursing", pregnantNursing);
            healthMap.put("chronicConditions", chronicConditions);
            String healthAnswersJson;
            try {
                healthAnswersJson = JsonUtil.mapper().writeValueAsString(healthMap);
            } catch (Exception ex) {
                healthAnswersJson = "{}";
            }

            String rawBloodType = JsonUtil.text(body, "bloodType").trim();
            String bloodType = rawBloodType.isEmpty() ? "Not sure" : rawBloodType;
            String bloodGroupStatus = (bloodType.equalsIgnoreCase("Not sure") || bloodType.equalsIgnoreCase("UNKNOWN")) ? "unconfirmed" : "self_declared";

            String city = JsonUtil.text(body, "city").trim();
            String state = JsonUtil.text(body, "state").trim();
            String pincode = JsonUtil.text(body, "pincode").trim();
            if (city.isEmpty() || state.isEmpty() || pincode.isEmpty() || !pincode.matches("\\d{6}")) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Valid city, state, and 6-digit PIN code are required."));
            }

            boolean publicSearchOptIn = JsonUtil.asBoolean(body, "publicSearchOptIn", false);

            Map<String, Object> donor = new HashMap<>();
            donor.put("name", (firstName + " " + lastName).trim());
            donor.put("email", email);
            donor.put("phone", phone);
            donor.put("dob", dob);
            donor.put("gender", gender);
            donor.put("password", password);
            donor.put("bloodType", bloodType);
            donor.put("blood_group_status", bloodGroupStatus);
            donor.put("weight", JsonUtil.asDouble(body, "weight"));
            donor.put("lastDonation", JsonUtil.asDate(body, "lastDonation"));
            donor.put("lastDonationSelfReported", JsonUtil.asDate(body, "lastDonation"));
            donor.put("availability", JsonUtil.textOrNull(body, "availability") == null ? "Available" : JsonUtil.text(body, "availability"));
            donor.put("availabilityPref", JsonUtil.textOrNull(body, "availabilityPref") == null ? "Any time" : JsonUtil.text(body, "availabilityPref"));
            donor.put("address", JsonUtil.textOrNull(body, "address"));
            donor.put("city", city);
            donor.put("state", state);
            donor.put("pincode", pincode);
            donor.put("latitude", JsonUtil.asDouble(body, "latitude"));
            donor.put("longitude", JsonUtil.asDouble(body, "longitude"));
            donor.put("smsNotif", false);
            donor.put("pushNotif", JsonUtil.asBoolean(body, "pushNotif", true));
            donor.put("emailNotif", JsonUtil.asBoolean(body, "emailNotif", true));
            donor.put("hospitalReviewNeeded", hospitalReviewNeeded);
            donor.put("healthAnswersJson", com.red404.util.AesGcmEncryptionUtil.encrypt(healthAnswersJson));
            donor.put("emailVerified", true);
            donor.put("publicSearchOptIn", publicSearchOptIn);
            donor.put("publicDisplayName", firstName);

            if (donorDao.insert(donor)) {
                Map<String, Object> registeredDonor = donorDao.findByLogin(email, password);
                if (registeredDonor == null) {
                    registeredDonor = donor;
                }
                String donorIdStr = registeredDonor.get("donorId") != null ? registeredDonor.get("donorId").toString() : registeredDonor.get("id").toString();

                // Store consent record
                consentDao.recordConsent("DONOR", donorIdStr, "v1.0", "v1.0", true, publicSearchOptIn, true,
                        GeoLocationUtil.getClientIp(request), request.getHeader("User-Agent"));

                HttpSession session = request.getSession(true);
                session.setAttribute("user", registeredDonor);
                session.setAttribute("role", "DONOR");

                // Audit & track real-time session
                try {
                    String ip = GeoLocationUtil.getClientIp(request);
                    String ua = request.getHeader("User-Agent");
                    String device = UserAgentUtil.parseDevice(ua);
                    String browser = UserAgentUtil.parseBrowser(ua);
                    String location = GeoLocationUtil.resolveLocation(ip);
                    sessionDao.recordSession(session.getId(), donorIdStr, "DONOR", ip, ua, device, browser, location);
                } catch (Exception ignored) {}

                // Dispatch Design System Donor Welcome Email (Part 2 & 3)
                try {
                    if (emailVerificationService != null && email != null && !email.isBlank()) {
                        String lang = JsonUtil.textOrNull(body, "language");
                        if (lang == null) lang = JsonUtil.textOrNull(body, "lang");
                        int dId = 0;
                        if (registeredDonor.get("id") instanceof Number) {
                            dId = ((Number) registeredDonor.get("id")).intValue();
                        }
                        emailVerificationService.sendDonorWelcomeEmail(
                                dId, email, firstName, donorIdStr, bloodType, city, lang
                        );
                    }
                } catch (Exception ex) {
                    log.warn("Notice initiating donor welcome email: {}", ex.getMessage());
                }

                Map<String, Object> wrapper = new HashMap<>();
                wrapper.put("donor", registeredDonor);
                wrapper.put("donorId", donorIdStr);
                wrapper.put("qrToken", registeredDonor.get("qrToken"));
                wrapper.put("token", "SESSION-DONOR-" + donorIdStr);
                wrapper.put("nextSteps", List.of(
                        "Visit your nearest partner hospital to verify your blood group and baseline vitals.",
                        "Keep your notification preferences active to receive emergency requests nearby.",
                        "Track your donation gap and eligibility status from your donor dashboard."
                ));
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(new ApiResponse(true, "Donor Registered Successfully!", wrapper));
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Registration Failed. Please try again."));
            }
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            boolean isHtmlSubmit = request.getHeader("Accept") != null && request.getHeader("Accept").contains("text/html");
            String clientIp = GeoLocationUtil.getClientIp(request);
            String identifier = body != null ? JsonUtil.text(body, "identifier").trim() : "";
            if (identifier.isEmpty() && body != null) {
                identifier = JsonUtil.text(body, "email").trim();
            }
            if (identifier.isEmpty() && request.getParameter("identifier") != null) {
                identifier = request.getParameter("identifier").trim();
            }
            if (identifier.isEmpty() && request.getParameter("loginEmail") != null) {
                identifier = request.getParameter("loginEmail").trim();
            }
            if (identifier.isEmpty() && request.getParameter("email") != null) {
                identifier = request.getParameter("email").trim();
            }
            String cleanId = identifier.toLowerCase();

            // Part 7: Check lockout - 10 failures per 15 min (900s) per account and per IP
            RateLimitService.RateLimitResult ipLock = rateLimitService.checkLimit("login_lock_ip:" + clientIp, 10, 900);
            RateLimitService.RateLimitResult accLock = rateLimitService.checkLimit("login_lock_donor:" + cleanId, 10, 900);
            if (!ipLock.allowed || !accLock.allowed) {
                long retryAfter = Math.max(ipLock.retryAfterSeconds, accLock.retryAfterSeconds);
                if (isHtmlSubmit) {
                    return ResponseEntity.status(HttpStatus.FOUND).header("Location", "donor-login.html?error=locked").build();
                }
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header("Retry-After", String.valueOf(retryAfter))
                        .body(new ApiResponse(false, "Too many failed login attempts. Temporarily locked for 15 minutes. Please try again later."));
            }

            String password = body != null ? JsonUtil.text(body, "password").trim() : "";
            if (password.isEmpty() && request.getParameter("password") != null) {
                password = request.getParameter("password").trim();
            }
            if (password.isEmpty() && request.getParameter("loginPassword") != null) {
                password = request.getParameter("loginPassword").trim();
            }

            Map<String, Object> donor = donorDao.findByLogin(identifier, password);
            if (donor == null) {
                rateLimitService.checkLimit("login_fail_ip:" + clientIp, 10, 900);
                rateLimitService.checkLimit("login_fail_donor:" + cleanId, 10, 900);
                if (isHtmlSubmit) {
                    return ResponseEntity.status(HttpStatus.FOUND).header("Location", "donor-login.html?error=invalid").build();
                }
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Invalid credentials. Please try again."));
            }
            HttpSession session = request.getSession(true);
            session.setAttribute("user", donor);
            session.setAttribute("role", "DONOR");
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();

            // Audit & track real-time session
            try {
                String ip = GeoLocationUtil.getClientIp(request);
                String ua = request.getHeader("User-Agent");
                String device = UserAgentUtil.parseDevice(ua);
                String browser = UserAgentUtil.parseBrowser(ua);
                String location = request.getHeader("X-Client-Location");
                if (location == null || location.isBlank() || location.toLowerCase().contains("ozar")) {
                    if (donor.get("city") != null && !donor.get("city").toString().isBlank()) {
                        location = donor.get("city").toString();
                        if (donor.get("state") != null && !donor.get("state").toString().isBlank()) {
                            location += ", " + donor.get("state").toString();
                        } else {
                            location += ", India";
                        }
                    } else {
                        location = GeoLocationUtil.resolveLocation(ip);
                    }
                }
                sessionDao.recordSession(session.getId(), donorIdStr, "DONOR", ip, ua, device, browser, location);
            } catch (Exception ignored) {}

            if (isHtmlSubmit) {
                String next = request.getParameter("next");
                String target = "dashboard.html";
                if (next != null && !next.isBlank() && !next.contains("://") && !next.startsWith("//") && !next.toLowerCase().startsWith("javascript:")) {
                    Set<String> allowed = Set.of("dashboard.html", "/dashboard.html", "donor-profile.html", "/donor-profile.html", "donor-alerts.html", "/donor-alerts.html", "my-donations.html", "/my-donations.html");
                    if (allowed.contains(next.trim())) target = next.trim();
                }
                return ResponseEntity.status(HttpStatus.FOUND).header("Location", target).build();
            }

            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("donor", donor);
            wrapper.put("donorId", donorIdStr);
            wrapper.put("token", "SESSION-DONOR-" + donorIdStr);
            return ok("Login Successful", wrapper);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            try {
                Object user = session.getAttribute("user");
                if (user instanceof Map<?, ?> donor && donor.get("id") != null) {
                    sessionDao.killSession(((Number) donor.get("id")).intValue(), "DONOR", session.getId());
                }
            } catch (Exception ignored) {}
            session.invalidate();
        }
        return ok("Logged out successfully", null);
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            boolean updated = donorDao.updatePassword(
                    (Integer) donor.get("id"),
                    JsonUtil.text(body, "currentPassword"),
                    JsonUtil.text(body, "newPassword"));
            if (updated) {
                return ok("Password updated", null);
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Current password is incorrect."));
            }
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/{donorId}/notify")
    public ResponseEntity<ApiResponse> notify(@PathVariable int donorId) {
        return ok("Notification queued", null);
    }

    @PostMapping("/blood-requests/{requestId}/accept")
    public ResponseEntity<ApiResponse> acceptRequest(@PathVariable int requestId, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        return handleRequestAction(requestId, "Accepted", body, request);
    }

    @PostMapping("/blood-requests/{requestId}/decline")
    public ResponseEntity<ApiResponse> declineRequest(@PathVariable int requestId, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        return handleRequestAction(requestId, "Declined", body, request);
    }

    @PostMapping("/blood-requests/{requestId}/withdraw")
    public ResponseEntity<ApiResponse> withdrawRequest(@PathVariable int requestId, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        return handleRequestAction(requestId, "Withdrawn", body, request);
    }

    @PostMapping({"/donations/record", "/record-donation"})
    public ResponseEntity<ApiResponse> recordDonation(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            int donorId = JsonUtil.asInt(body, "donorId", 0);
            if (donorId <= 0) {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null && donor.get("id") != null) {
                    donorId = ((Number) donor.get("id")).intValue();
                }
            }
            if (donorId <= 0) donorId = 1;
            int hospitalId = JsonUtil.asInt(body, "hospitalId", 1);
            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            int units = JsonUtil.asInt(body, "units", 1);
            String status = JsonUtil.textOrNull(body, "status");
            boolean success = donorDao.recordDonation(donorId, hospitalId, bloodType, units, status);
            return ok("Donation recorded and approved by hospital", Map.of("recorded", success));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/location")
    public ResponseEntity<ApiResponse> updateLocation(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            if (body == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Location payload is required."));
            }

            Double lat = JsonUtil.asDouble(body, "latitude");
            Double lng = JsonUtil.asDouble(body, "longitude");

            if (lat == null || lng == null || lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Invalid coordinates. Latitude must be in [-90, 90] and longitude in [-180, 180]."));
            }

            Integer donorId = null;
            Map<String, Object> sessionDonor = requireDonor(request);
            if (sessionDonor != null && sessionDonor.get("id") != null) {
                donorId = ((Number) sessionDonor.get("id")).intValue();
            } else if (body.has("donorId")) {
                donorId = JsonUtil.asInt(body, "donorId", 0);
            }

            if (donorId == null || donorId <= 0) {
                return unauthorized();
            }

            donorDao.updateLocation(donorId, lat, lng);

            HttpSession session = request.getSession(false);
            if (session != null) {
                Map<String, Object> updated = donorDao.findById(donorId);
                if (updated != null) {
                    session.setAttribute("user", updated);
                }
            }

            Map<String, Object> respData = new HashMap<>();
            respData.put("donorId", donorId);
            respData.put("latitude", lat);
            respData.put("longitude", lng);
            respData.put("locationUpdatedAt", new java.sql.Timestamp(System.currentTimeMillis()).toString());

            return ok("Donor location synchronized successfully", respData);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== PUT ========================

    @PutMapping("/availability")
    public ResponseEntity<ApiResponse> updateAvailability(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            boolean available = JsonUtil.asBoolean(body, "available", true);
            donorDao.updateAvailability((Integer) donor.get("id"), available);
            return ok("Availability updated", Map.of("available", available));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse> updateProfile(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            int targetId = 0;
            if (donor != null && donor.get("id") != null) {
                targetId = ((Number) donor.get("id")).intValue();
            } else {
                targetId = JsonUtil.asInt(body, "id", 0);
                if (targetId <= 0) targetId = JsonUtil.asInt(body, "donorId", 0);
            }
            if (targetId <= 0) {
                String email = JsonUtil.textOrNull(body, "email");
                if (email != null && !email.isBlank()) {
                    Map<String, Object> found = donorDao.findByEmail(email.trim().toLowerCase());
                    if (found != null && found.get("id") != null) {
                        targetId = ((Number) found.get("id")).intValue();
                    }
                }
            }
            if (targetId <= 0) {
                return unauthorized();
            }

            Map<String, Object> fields = new HashMap<>();
            String nameVal = JsonUtil.textOrNull(body, "name") != null ? JsonUtil.text(body, "name") : JsonUtil.textOrNull(body, "fullName");
            if (nameVal != null) fields.put("name", nameVal);

            if (body.has("fatherName") || body.has("father_name")) {
                String fNameVal = JsonUtil.textOrNull(body, "fatherName") != null ? JsonUtil.text(body, "fatherName") : JsonUtil.textOrNull(body, "father_name");
                fields.put("father_name", (fNameVal != null && !fNameVal.trim().isEmpty()) ? fNameVal.trim() : null);
            }

            if (body.has("phone")) {
                String phoneVal = JsonUtil.textOrNull(body, "phone");
                fields.put("phone", phoneVal);
            }

            if (body.has("bloodType") || body.has("blood_type")) {
                String bgVal = JsonUtil.textOrNull(body, "bloodType") != null ? JsonUtil.text(body, "bloodType") : JsonUtil.textOrNull(body, "blood_type");
                if (bgVal != null && !bgVal.isBlank()) {
                    String normBg = com.red404.util.BloodCompatibilityUtil.normalizeBloodGroup(bgVal);
                    if (normBg == null) {
                        return ResponseEntity.badRequest().body(new ApiResponse(false, "Invalid blood group: " + bgVal + ". Must be one of A+, A-, B+, B-, AB+, AB-, O+, O-."));
                    }
                    Map<String, Object> currentRecord = donorDao.findById(targetId);
                    if (currentRecord != null) {
                        String currentBg = (String) currentRecord.get("bloodType");
                        String status = (String) currentRecord.get("bloodGroupStatus");
                        if (status == null) status = "self_declared";
                        int editCount = currentRecord.get("bloodGroupEditCount") instanceof Number ? ((Number) currentRecord.get("bloodGroupEditCount")).intValue() : 0;

                        if (!normBg.equalsIgnoreCase(currentBg)) {
                            if ("hospital_verified".equalsIgnoreCase(status)) {
                                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiResponse(false,
                                        "Blood group has been verified by a hospital (" + currentRecord.get("bloodGroupVerifiedByHospitalName") + ") and cannot be edited directly. Please submit a correction request."));
                            }
                            if (editCount >= 1) {
                                return ResponseEntity.badRequest().body(new ApiResponse(false,
                                        "Blood group can only be self-edited once. Please request a correction from hospital staff during your next visit."));
                            }
                            fields.put("blood_type", normBg);
                            fields.put("blood_group_edit_count", editCount + 1);
                            bloodGroupAuditDao.insertAudit(targetId, currentBg, normBg, "donor", targetId, "Donor initial update");
                        }
                    }
                }
            }

            if (body.has("gender")) {
                String genderVal = JsonUtil.textOrNull(body, "gender");
                fields.put("gender", genderVal);
            }

            if (body.has("dob") || body.has("dateOfBirth")) {
                String dobVal = JsonUtil.textOrNull(body, "dob") != null ? JsonUtil.text(body, "dob") : JsonUtil.textOrNull(body, "dateOfBirth");
                fields.put("dob", (dobVal != null && !dobVal.isBlank()) ? dobVal.trim() : null);
            }

            if (body.has("address")) {
                String addrVal = JsonUtil.textOrNull(body, "address");
                fields.put("address", (addrVal != null && !addrVal.isBlank()) ? addrVal.trim() : null);
            }

            if (body.has("city")) {
                String cityVal = JsonUtil.textOrNull(body, "city");
                fields.put("city", (cityVal != null && !cityVal.isBlank()) ? cityVal.trim() : null);
            }

            if (body.has("state")) {
                String stateVal = JsonUtil.textOrNull(body, "state");
                fields.put("state", (stateVal != null && !stateVal.isBlank()) ? stateVal.trim() : null);
            }

            if (body.has("pincode")) {
                String pinVal = JsonUtil.textOrNull(body, "pincode");
                fields.put("pincode", (pinVal != null && !pinVal.isBlank()) ? pinVal.trim() : null);
            }

            if (body.has("availability")) {
                String availVal = JsonUtil.textOrNull(body, "availability");
                fields.put("availability", availVal);
            }

            if (body.has("allergies")) {
                String allergiesVal = JsonUtil.textOrNull(body, "allergies");
                fields.put("allergies", (allergiesVal != null && !allergiesVal.isBlank()) ? allergiesVal.trim() : null);
            }

            if (body.has("conditions")) {
                String conditionsVal = JsonUtil.textOrNull(body, "conditions");
                fields.put("conditions", (conditionsVal != null && !conditionsVal.isBlank()) ? conditionsVal.trim() : null);
            }

            if (body.has("medications")) {
                String medsVal = JsonUtil.textOrNull(body, "medications");
                fields.put("medications", (medsVal != null && !medsVal.isBlank()) ? medsVal.trim() : null);
            }

            if (body.has("surgeries")) {
                String surgVal = JsonUtil.textOrNull(body, "surgeries");
                fields.put("surgeries", (surgVal != null && !surgVal.isBlank()) ? surgVal.trim() : null);
            }

            if (body.has("qrToken") || body.has("qr_token")) {
                String tokenVal = JsonUtil.textOrNull(body, "qrToken") != null ? JsonUtil.text(body, "qrToken") : JsonUtil.textOrNull(body, "qr_token");
                fields.put("qr_token", tokenVal);
            }

            // Clinical vitals (weight, pulse, hemoglobin, BP, temp), verified facility, and last donation
            // are verified clinical records set by hospital staff during check-in only (Part 1, Requirement 1).
            // Direct profile edits by donors ignore any values supplied for these fields.

            if (body.has("preferredLanguage") || body.has("preferred_language")) {
                String lang = JsonUtil.textOrNull(body, "preferredLanguage") != null ? JsonUtil.text(body, "preferredLanguage") : JsonUtil.textOrNull(body, "preferred_language");
                fields.put("preferred_language", (lang != null && !lang.isBlank()) ? lang.trim().toLowerCase() : "en");
            }

            if (body.has("smsNotif") || body.has("sms_notif")) {
                fields.put("sms_notif", JsonUtil.asBoolean(body, body.has("smsNotif") ? "smsNotif" : "sms_notif", true));
            }
            if (body.has("emailNotif") || body.has("email_notif")) {
                fields.put("email_notif", JsonUtil.asBoolean(body, body.has("emailNotif") ? "emailNotif" : "email_notif", true));
            }
            if (body.has("pushNotif") || body.has("push_notif")) {
                fields.put("push_notif", JsonUtil.asBoolean(body, body.has("pushNotif") ? "pushNotif" : "push_notif", true));
            }

            if (body.has("latitude") && body.has("longitude")) {
                Double lat = JsonUtil.asDouble(body, "latitude");
                Double lng = JsonUtil.asDouble(body, "longitude");
                if (lat != null && lng != null && lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0) {
                    fields.put("latitude", lat);
                    fields.put("longitude", lng);
                    fields.put("location_updated_at", new java.sql.Timestamp(System.currentTimeMillis()));
                }
            }

            if (body.has("publicSearchOptIn") || body.has("public_search_opt_in")) {
                boolean optIn = body.has("publicSearchOptIn") ? JsonUtil.asBoolean(body, "publicSearchOptIn", false) : JsonUtil.asBoolean(body, "public_search_opt_in", false);
                fields.put("public_search_opt_in", optIn);
                com.red404.service.PublicSearchService.clearCache();
            }
            if (body.has("publicDisplayName") || body.has("public_display_name")) {
                String dName = JsonUtil.textOrNull(body, "publicDisplayName") != null ? JsonUtil.text(body, "publicDisplayName") : JsonUtil.textOrNull(body, "public_display_name");
                fields.put("public_display_name", (dName != null && !dName.isBlank()) ? dName.trim() : null);
                com.red404.service.PublicSearchService.clearCache();
            }

            // Clinical last_donation is written ONLY upon hospital check-in / verified donation completion.
            // Direct profile edits cannot arbitrarily modify last_donation.

            donorDao.updateProfile(targetId, fields);
            Map<String, Object> updated = donorDao.findById(targetId);

            // Update session cache
            HttpSession session = request.getSession(false);
            if (session != null && updated != null) {
                session.setAttribute("user", updated);
            }

            return ok("Profile updated successfully", updated);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/certificate", "/donations/certificate"})
    public ResponseEntity<?> downloadCertificate(
            @RequestParam(required = false) String certId,
            @RequestParam(required = false) String refCode,
            @RequestParam(required = false) String hospital,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String bloodType,
            @RequestParam(required = false) String volume,
            HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) {
                return unauthorized();
            }
            String donorName = donor.get("name") != null ? (String) donor.get("name") : "Clinical Blood Donor";
            String donorId = donor.get("donorId") != null ? (String) donor.get("donorId") : ("DNR-" + donor.get("id"));
            String blood = bloodType != null && !bloodType.isBlank() ? bloodType : (donor.get("bloodType") != null ? (String) donor.get("bloodType") : "O+");
            String hosp = hospital != null && !hospital.isBlank() ? hospital : "Verified Regional Trauma Center";
            String dDate = date != null && !date.isBlank() ? date : java.time.LocalDate.now().toString();
            String code = refCode != null && !refCode.isBlank() ? refCode : (certId != null && !certId.isBlank() ? certId : "RED-" + (System.currentTimeMillis() % 100000));
            String vol = volume != null && !volume.isBlank() ? volume : null;
            if (vol == null) {
                int dNum = 0;
                if (code.startsWith("RED-")) {
                    try { dNum = Integer.parseInt(code.substring(4)); } catch (Exception ignored) {}
                }
                if (dNum > 0) {
                    try (Connection c = DBConnection.getConnection();
                         PreparedStatement cps = c.prepareStatement("SELECT donor_id, volume_ml FROM donations WHERE id = ?")) {
                        cps.setInt(1, dNum);
                        try (ResultSet crs = cps.executeQuery()) {
                            if (crs.next()) {
                                String recordDonorId = crs.getString("donor_id");
                                String myNumId = donor.get("id") != null ? donor.get("id").toString() : "";
                                String myCode = donor.get("donorId") != null ? donor.get("donorId").toString() : "";
                                if (recordDonorId != null && !recordDonorId.equalsIgnoreCase(myNumId) && !recordDonorId.equalsIgnoreCase(myCode)) {
                                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                            .body(new ApiResponse(false, "Forbidden: Certificate ownership verification failed."));
                                }
                                int dbVol = crs.getInt("volume_ml");
                                if (dbVol > 0) vol = dbVol + " mL (1 Unit)";
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }
            if (vol == null) {
                vol = "450 mL (1 Unit)";
            } else if (!vol.contains("Unit")) {
                vol = vol.endsWith("mL") ? vol + " (1 Unit)" : vol + " mL (1 Unit)";
            }

            String format = request.getParameter("format");
            if (!"html".equalsIgnoreCase(format)) {
                byte[] pdfBytes = com.red404.util.PdfCertificateGenerator.generateCertificate(
                        donorName, donorId, blood, vol, dDate, code, hosp);
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_PDF);
                headers.setContentLength(pdfBytes.length);
                headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"RED404-Certificate-" + code + ".pdf\"");
                return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
            }

            String htmlCert = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>RED404 Clinical Rescue Certificate - " + code + "</title>"
                    + "<style>"
                    + "@page { size: landscape; margin: 0; }"
                    + "body { font-family: 'Inter', -apple-system, sans-serif; background: #0f1012; color: #ecebe8; margin: 0; padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 100vh; box-sizing: border-box; }"
                    + ".cert-frame { width: 900px; padding: 48px; border: 4px double #e5383b; background: #17181b; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); text-align: center; position: relative; }"
                    + ".cert-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 160px; color: rgba(229, 56, 59, 0.04); font-weight: 900; z-index: 1; pointer-events: none; }"
                    + ".cert-content { position: relative; z-index: 2; }"
                    + ".cert-logo { font-size: 28px; font-weight: 800; color: #e5383b; letter-spacing: 2px; margin-bottom: 8px; }"
                    + ".cert-title { font-size: 24px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 2px; margin: 12px 0 20px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 12px; }"
                    + ".cert-presented { font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }"
                    + ".cert-name { font-size: 34px; font-weight: 800; color: #fff; margin: 10px 0; text-decoration: underline; text-decoration-color: #e5383b; }"
                    + ".cert-body { font-size: 14px; line-height: 1.8; color: #cbd5e1; max-width: 680px; margin: 16px auto; }"
                    + ".cert-meta-grid { display: flex; justify-content: space-around; margin: 28px 0 20px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); }"
                    + ".cert-meta-item { text-align: center; }"
                    + ".cert-meta-val { font-size: 17px; font-weight: 700; color: #fff; }"
                    + ".cert-meta-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }"
                    + ".cert-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.15); }"
                    + ".cert-sig { text-align: left; font-size: 12px; color: #94a3b8; }"
                    + ".cert-sig-line { width: 180px; border-bottom: 1px solid #fff; margin-bottom: 6px; }"
                    + "@media print { body { background: #fff; color: #000; padding: 0; } .cert-frame { border-color: #c00; background: #fff; box-shadow: none; width: 100%; border-radius: 0; } .cert-name, .cert-title, .cert-meta-val { color: #000; } .cert-body { color: #333; } }"
                    + "</style></head><body>"
                    + "<div class='cert-frame'>"
                    + "<div class='cert-watermark'>RED404</div>"
                    + "<div class='cert-content'>"
                    + "<div class='cert-logo'>RED404 &bull; BLOOD RESCUE NETWORK</div>"
                    + "<div class='cert-title'>Certificate of Verified Blood Donation</div>"
                    + "<div class='cert-presented'>This certificate is proudly awarded to</div>"
                    + "<div class='cert-name'>" + donorName + "</div>"
                    + "<div class='cert-body'>In recognition of your voluntary and selfless clinical blood donation. Your contribution directly replenishes verified hospital reserves and saves human lives in emergency trauma situations.</div>"
                    + "<div class='cert-meta-grid'>"
                    + "<div class='cert-meta-item'><div class='cert-meta-val'>" + blood + "</div><div class='cert-meta-lbl'>Blood Group</div></div>"
                    + "<div class='cert-meta-item'><div class='cert-meta-val'>" + vol + "</div><div class='cert-meta-lbl'>Donation Volume</div></div>"
                    + "<div class='cert-meta-item'><div class='cert-meta-val'>" + dDate + "</div><div class='cert-meta-lbl'>Donation Date</div></div>"
                    + "<div class='cert-meta-item'><div class='cert-meta-val'>" + code + "</div><div class='cert-meta-lbl'>Record / Cert ID</div></div>"
                    + "</div>"
                    + "<div class='cert-footer'>"
                    + "<div class='cert-sig'><div class='cert-sig-line'></div>Verified Hospital Authority<br><strong>" + hosp + "</strong></div>"
                    + "<div class='cert-sig' style='text-align:right;'><div class='cert-sig-line' style='margin-left:auto;'></div>RED404 Medical Registry Authority<br>Smart ID: <strong>" + donorId + "</strong></div>"
                    + "</div>"
                    + "</div></div>"
                    + "<script>window.onload = function() { window.print(); };</script>"
                    + "</body></html>";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_HTML);
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"RED404-Certificate-" + code + ".html\"");
            return new ResponseEntity<>(htmlCert, headers, HttpStatus.OK);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/blood-group-correction-request", "/request-blood-group-correction"})
    public ResponseEntity<ApiResponse> requestBloodGroupCorrection(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null || donor.get("id") == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();
            String requestedGroup = JsonUtil.textOrNull(body, "requestedGroup");
            if (requestedGroup == null) requestedGroup = JsonUtil.textOrNull(body, "requestedBloodGroup");
            if (requestedGroup == null) requestedGroup = JsonUtil.textOrNull(body, "bloodType");
            String reason = JsonUtil.textOrNull(body, "reason");

            if (requestedGroup == null || requestedGroup.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Requested blood group is required."));
            }
            String normGroup = com.red404.util.BloodCompatibilityUtil.normalizeBloodGroup(requestedGroup);
            if (normGroup == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Invalid blood group format: " + requestedGroup));
            }
            if (reason == null || reason.trim().length() < 3) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Please provide a valid reason for the correction request."));
            }

            Map<String, Object> currentRecord = donorDao.findById(donorId);
            String currentBg = currentRecord != null ? (String) currentRecord.get("bloodType") : null;

            bloodGroupAuditDao.insertAudit(donorId, currentBg, normGroup, "donor_correction_request", donorId, reason.trim());
            donorDao.addDonorNotification(donorId, "Blood Group Correction Requested",
                    "Your request to correct blood group to " + normGroup + " has been logged. Please present your laboratory cross-match documentation at your next hospital check-in.", "correction_request");
            return ok("Correction request submitted successfully. Hospital staff will review and verify your blood group during check-in.", Map.of(
                    "donorId", donorId,
                    "currentGroup", currentBg != null ? currentBg : "Unknown",
                    "requestedGroup", normGroup
            ));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/availability")
    public ResponseEntity<ApiResponse> setAvailability(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null || donor.get("id") == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();

            boolean available = JsonUtil.asBoolean(body, "available", true);
            String pausedUntilStr = JsonUtil.textOrNull(body, "pausedUntil");
            Date pausedUntil = null;
            if (pausedUntilStr != null && !pausedUntilStr.isBlank()) {
                try {
                    pausedUntil = Date.valueOf(pausedUntilStr.trim());
                } catch (Exception ignored) {}
            }

            donorDao.updateAvailability(donorId, available, pausedUntil);
            return ok("Availability status updated successfully", Map.of(
                    "available", available,
                    "availability", available ? "Available" : "Paused",
                    "pausedUntil", pausedUntil != null ? pausedUntil.toString() : null
            ));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/public-search-opt-in", "/opt-in"})
    public ResponseEntity<ApiResponse> togglePublicSearchOptIn(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null || donor.get("id") == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();

            boolean optIn = body.has("optIn") ? JsonUtil.asBoolean(body, "optIn", false)
                    : (body.has("publicSearchOptIn") ? JsonUtil.asBoolean(body, "publicSearchOptIn", false) : false);
            String displayName = body.has("displayName") ? JsonUtil.textOrNull(body, "displayName")
                    : (body.has("publicDisplayName") ? JsonUtil.textOrNull(body, "publicDisplayName") : null);

            Map<String, Object> fields = new HashMap<>();
            fields.put("public_search_opt_in", optIn);
            if (displayName != null) {
                fields.put("public_display_name", displayName.trim().isEmpty() ? null : displayName.trim());
            }
            donorDao.updateProfile(donorId, fields);
            com.red404.service.PublicSearchService.clearCache();

            Map<String, Object> fresh = donorDao.findById(donorId);
            Map<String, Object> res = new HashMap<>();
            res.put("publicSearchOptIn", optIn);
            res.put("publicDisplayName", fresh != null ? fresh.get("publicDisplayName") : displayName);
            res.put("publicConsentAt", fresh != null ? fresh.get("publicConsentAt") : null);
            return ok("Public search opt-in updated successfully", res);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/intake-audit", "/verify-intake"})
    public ResponseEntity<ApiResponse> logIntakeAudit(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            int donorId = JsonUtil.asInt(body, "donorId", 1);
            int hospitalId = JsonUtil.asInt(body, "hospitalId", 1);
            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            int units = JsonUtil.asInt(body, "units", 1);
            boolean recorded = donorDao.recordDonation(donorId, hospitalId, bloodType, units, "VERIFIED_INTAKE");
            Map<String, Object> audit = new HashMap<>();
            audit.put("recorded", recorded);
            audit.put("donorId", donorId);
            audit.put("timestamp", java.time.Instant.now().toString());
            audit.put("status", "VERIFIED_INTAKE_AUDIT");
            return ok("Hospital verification intake audit logged successfully", audit);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PutMapping("/settings")
    public ResponseEntity<ApiResponse> updateSettings() {
        return ok("Settings saved", defaultSettings());
    }

    // ======================== HELPERS ========================

    private ResponseEntity<ApiResponse> handleRequestAction(int requestId, String status, Map<String, Object> body, HttpServletRequest request) {
        try {
            int donorId = 0;
            if (body != null && body.containsKey("donorId") && body.get("donorId") != null) {
                try {
                    donorId = Integer.parseInt(body.get("donorId").toString());
                } catch (Exception ignored) {}
            }
            Map<String, Object> donor = requireDonor(request);
            if (donor != null && donor.get("id") != null && donorId <= 0) {
                donorId = ((Number) donor.get("id")).intValue();
            }
            if (donorId <= 0) return unauthorized();
            if (donor == null) {
                donor = donorDao.findById(donorId);
            }

            if ("Accepted".equalsIgnoreCase(status)) {
                Map<String, Object> res = com.red404.service.RequestLifecycleService.getInstance().handleDonorAccept(requestId, donorId);
                Map<String, Object> bloodRequest = requestDao.findById(requestId);
                if (bloodRequest == null) bloodRequest = new HashMap<>();
                bloodRequest.putAll(res);
                return ok("Request accepted", bloodRequest);
            } else if ("Declined".equalsIgnoreCase(status)) {
                String reason = body != null && body.containsKey("reason") ? String.valueOf(body.get("reason")) : "Donor declined";
                Map<String, Object> res = com.red404.service.RequestLifecycleService.getInstance().handleDonorDecline(requestId, donorId, reason);
                return ok("Request declined", res);
            } else if ("Withdrawn".equalsIgnoreCase(status)) {
                String reason = body != null && body.containsKey("reason") ? String.valueOf(body.get("reason")) : "Donor withdrew";
                Map<String, Object> res = com.red404.service.RequestLifecycleService.getInstance().handleDonorWithdraw(requestId, donorId, reason);
                return ok("Request withdrawn", res);
            }

            Map<String, Object> bloodRequest = requestDao.findById(requestId);
            if (bloodRequest == null) {
                bloodRequest = new HashMap<>();
            }
            bloodRequest.put("status", status);
            bloodRequest.put("distanceKm", 0);
            bloodRequest.put("etaMinutes", 0);
            return ok("Request " + status.toLowerCase(), bloodRequest);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiResponse(false, e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping(value = {"/events", "/stream-events"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamDonorEvents(HttpServletRequest request) {
        Map<String, Object> donor = requireDonor(request);
        Integer donorId = null;
        if (donor != null && donor.get("id") != null) {
            donorId = ((Number) donor.get("id")).intValue();
        }
        if (donorId == null) {
            SseEmitter dead = new SseEmitter(0L);
            dead.complete();
            return dead;
        }

        SseEmitter emitter = new SseEmitter(1800000L); // 30 mins
        donorEmitters.computeIfAbsent(donorId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        final int did = donorId;
        emitter.onCompletion(() -> removeDonorEmitter(did, emitter));
        emitter.onTimeout(() -> removeDonorEmitter(did, emitter));
        emitter.onError((e) -> removeDonorEmitter(did, emitter));

        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("donorId", did, "status", "connected")));
        } catch (Exception ignored) {}

        return emitter;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireDonor(HttpServletRequest request) {
        // 1. Tab-isolated authentication via Authorization header, X-Red404-Token, or X-Donor-Id
        String authHeader = request.getHeader("Authorization");
        String token = request.getHeader("X-Red404-Token");
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
        if (token != null && token.startsWith("SESSION-DONOR-")) {
            String donorIdentifier = token.substring("SESSION-DONOR-".length()).trim();
            try {
                Map<String, Object> donor = donorDao.findByIdOrDonorId(donorIdentifier);
                if (donor != null) return donor;
            } catch (Exception ignored) {}
        }
        String xDonor = request.getHeader("X-Donor-Id");
        if (xDonor != null && !xDonor.isBlank()) {
            try {
                Map<String, Object> donor = donorDao.findByIdOrDonorId(xDonor.trim());
                if (donor != null) return donor;
            } catch (Exception ignored) {}
        }

        // 2. Fall back to HttpSession (for backward compatibility if no token passed)
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            return null;
        }
        return (Map<String, Object>) session.getAttribute("user");
    }

    private List<Map<String, Object>> defaultBadges() {
        List<Map<String, Object>> badges = new ArrayList<>();
        badges.add(Map.of("name", "First Savior", "description", "First verified donation", "icon", "🩸", "earned", false, "rule", "First verified donation"));
        badges.add(Map.of("name", "Golden Hour Hero", "description", "Verified donation completed within 45 min", "icon", "⚡", "earned", false, "rule", "Response within 45 minutes"));
        badges.add(Map.of("name", "Night Owl", "description", "Verified donation between 10 PM and 6 AM", "icon", "🦉", "earned", false, "rule", "Emergency donation at night"));
        badges.add(Map.of("name", "Rare Vanguard", "description", "Rare Rh-negative verified donation", "icon", "🛡️", "earned", false, "rule", "Rare Rh-negative verified donation"));
        badges.add(Map.of("name", "Life Giver V", "description", "5 verified donations", "icon", "💖", "earned", false, "rule", "5 verified donations"));
        badges.add(Map.of("name", "Apex Guardian", "description", "10 verified donations", "icon", "👑", "earned", false, "rule", "10 verified donations"));
        return badges;
    }

    private Map<String, Object> defaultSettings() {
        Map<String, Object> settings = new HashMap<>();
        settings.put("notifRequests", true);
        settings.put("notifSMS", true);
        settings.put("notifEmail", false);
        settings.put("notifBadges", true);
        settings.put("privProfile", true);
        settings.put("privLocation", true);
        settings.put("priv2FA", false);
        return settings;
    }

    private static ResponseEntity<ApiResponse> ok(String message, Object data) {
        return ResponseEntity.ok(new ApiResponse(true, message, data));
    }

    private static ResponseEntity<ApiResponse> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse(false, "Please login first."));
    }

    private static ResponseEntity<ApiResponse> serverError(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse(false, "Server failure: " + e.getMessage()));
    }

    private static Double parseDouble(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double asDouble(Object value) {
        return value instanceof Number ? ((Number) value).doubleValue() : null;
    }
}

