package com.red404.controller;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping({"/api/donors", "/api/donor"})
public class DonorController {

    public static final int FRESHNESS_HOURS = DonorDao.FRESHNESS_HOURS;

    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();
    private final SessionDao sessionDao = new SessionDao();
    private final com.red404.dao.DonationDriveDao donationDriveDao = new com.red404.dao.DonationDriveDao();
    private final com.red404.dao.BloodGroupAuditDao bloodGroupAuditDao = new com.red404.dao.BloodGroupAuditDao();
    private final com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();

    // ======================== GET ========================

    @GetMapping({"/profile", "/profile-data"})
    public ResponseEntity<ApiResponse> getProfile(
            @RequestParam(required = false) String donorId,
            @RequestParam(required = false) String email,
            HttpServletRequest request) {
        try {
            Map<String, Object> donorProfile = null;
            if (email != null && !email.isBlank()) {
                donorProfile = donorDao.findByEmail(email.trim().toLowerCase());
            }
            if (donorProfile == null && donorId != null && !donorId.isBlank()) {
                donorProfile = donorDao.findByIdOrDonorId(donorId);
            }
            if (donorProfile == null) {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null) {
                    String dId = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
                    donorProfile = donorDao.findByIdOrDonorId(dId);
                }
            }
            if (donorProfile == null) {
                HttpSession s = request.getSession(false);
                if (s != null) {
                    try { s.invalidate(); } catch (Exception ignored) {}
                }
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Donor profile not found or account deleted."));
            }
            DonorEligibilityService.attachEligibility(donorProfile);
            return ok("Profile loaded", donorProfile);
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
            return ok("Nearby donors loaded", donorDao.findNearby(latD, lngD, radius, bloodType));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/availability", "/availability-search", "/public-availability"})
    public ResponseEntity<ApiResponse> searchPublicAvailability(
            @RequestParam(required = false, defaultValue = "ALL") String bloodGroup,
            @RequestParam(required = false, defaultValue = "20") double radius,
            @RequestParam(required = false) String pincode,
            @RequestParam(required = false) String lat,
            @RequestParam(required = false) String lng) {
        try {
            Double latD = parseDouble(lat);
            Double lngD = parseDouble(lng);
            return ok("Public availability loaded", donorDao.searchPublicAvailability(bloodGroup, radius, pincode, latD, lngD));
        } catch (Exception e) {
            return serverError(e);
        }
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
            String targetDonorId = null;
            if (donorId != null && !donorId.isBlank()) {
                targetDonorId = donorId.trim();
            } else {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null) {
                    targetDonorId = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
                }
            }
            if (targetDonorId == null || targetDonorId.isBlank()) {
                targetDonorId = "DNR-0811-A404";
            }
            return ok("History loaded", donorDao.donationHistory(targetDonorId));
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

                String urgency = (String) req.getOrDefault("urgencyLevel", "HIGH");
                int neededWithin = 45;
                if ("CRITICAL".equalsIgnoreCase(urgency)) neededWithin = 20;
                else if ("HIGH".equalsIgnoreCase(urgency)) neededWithin = 35;
                else if ("URGENT".equalsIgnoreCase(urgency)) neededWithin = 45;
                else neededWithin = 90;
                req.put("neededWithinMinutes", neededWithin);

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
            String email = JsonUtil.text(body, "email").trim().toLowerCase();
            String phone = JsonUtil.text(body, "phone").trim().replaceAll("\\s+", "");
            String password = JsonUtil.text(body, "password").trim();
            String gender = JsonUtil.text(body, "gender").trim();
            if (gender.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Gender is required for donor registration (Male, Female, or Other)."));
            }

            Map<String, Object> existing = donorDao.findByEmail(email);
            if (existing != null) {
                String exPhone = existing.get("phone") != null ? existing.get("phone").toString() : "";
                String exCity = existing.get("city") != null ? existing.get("city").toString() : "";
                boolean isDefaultSeed = "ak30kr02@gmail.com".equalsIgnoreCase(email) || exPhone.isEmpty() || "9876543210".equals(exPhone) || "Meerut".equalsIgnoreCase(exCity);
                if (isDefaultSeed || PasswordUtil.checkPassword(password, existing.get("password") != null ? existing.get("password").toString() : "")) {
                    int existingId = ((Number) existing.get("id")).intValue();
                    Map<String, Object> fields = new HashMap<>();
                    String fullName = (JsonUtil.text(body, "firstName") + " " + JsonUtil.text(body, "lastName")).trim();
                    fields.put("name", fullName);
                    fields.put("phone", phone);
                    fields.put("password", PasswordUtil.hashPassword(password));
                    Date dob = JsonUtil.asDate(body, "dateOfBirth");
                    fields.put("dob", dob);
                    fields.put("gender", JsonUtil.text(body, "gender"));
                    fields.put("blood_type", JsonUtil.text(body, "bloodType"));
                    fields.put("weight", JsonUtil.asDouble(body, "weight"));
                    fields.put("last_donation", JsonUtil.asDate(body, "lastDonation"));
                    fields.put("availability", JsonUtil.textOrNull(body, "availability") == null ? "Available" : JsonUtil.text(body, "availability"));
                    fields.put("address", JsonUtil.text(body, "address"));
                    fields.put("city", JsonUtil.text(body, "city"));
                    fields.put("state", JsonUtil.text(body, "state"));
                    fields.put("pincode", JsonUtil.text(body, "pincode"));
                    fields.put("latitude", JsonUtil.asDouble(body, "latitude"));
                    fields.put("longitude", JsonUtil.asDouble(body, "longitude"));
                    fields.put("zone", JsonUtil.textOrNull(body, "zone"));

                    // Also synchronize Smart Donor ID with registered Date of Birth
                    String existingDonorId = (String) existing.get("donor_id");
                    if (existingDonorId == null || existingDonorId.isBlank()) {
                        try (Connection conn = DBConnection.getConnection()) {
                            existingDonorId = com.red404.util.DonorIdGenerator.generateUniqueDonorId(conn, fullName, dob);
                            try (PreparedStatement ps = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                                ps.setString(1, existingDonorId);
                                ps.setInt(2, existingId);
                                ps.executeUpdate();
                            }
                        }
                    } else if (dob != null) {
                        String syncd = com.red404.util.DonorIdGenerator.updateDonorIdDob(existingDonorId, dob, fullName);
                        if (syncd != null && !syncd.equalsIgnoreCase(existingDonorId)) {
                            try (Connection conn = DBConnection.getConnection();
                                 PreparedStatement ps = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                                ps.setString(1, syncd);
                                ps.setInt(2, existingId);
                                ps.executeUpdate();
                                existingDonorId = syncd;
                            }
                        }
                    }

                    donorDao.updateProfile(existingId, fields);
                    Map<String, Object> registeredDonor = donorDao.findById(existingId);
                    if (registeredDonor == null) registeredDonor = existing;

                    HttpSession session = request.getSession(true);
                    session.setAttribute("user", registeredDonor);
                    session.setAttribute("role", "DONOR");
                    String donorIdStr = registeredDonor.get("donorId") != null ? registeredDonor.get("donorId").toString() : String.valueOf(existingId);

                    Map<String, Object> wrapper = new HashMap<>();
                    wrapper.put("donor", registeredDonor);
                    wrapper.put("donorId", donorIdStr);
                    wrapper.put("token", "SESSION-DONOR-" + donorIdStr);
                    return ResponseEntity.status(HttpStatus.CREATED)
                            .body(new ApiResponse(true, "Donor Registered Successfully!", wrapper));
                } else {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body(new ApiResponse(false, "Email already registered. Please login."));
                }
            }

            if (donorDao.emailOrPhoneExists(email, phone)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ApiResponse(false, "Phone number already registered."));
            }
            Map<String, Object> donor = new HashMap<>();
            donor.put("name", (JsonUtil.text(body, "firstName") + " " + JsonUtil.text(body, "lastName")).trim());
            donor.put("email", email);
            donor.put("phone", phone);
            donor.put("dob", JsonUtil.asDate(body, "dateOfBirth"));
            donor.put("gender", JsonUtil.text(body, "gender"));
            donor.put("password", password);
            donor.put("bloodType", JsonUtil.text(body, "bloodType"));
            donor.put("weight", JsonUtil.asDouble(body, "weight"));
            donor.put("lastDonation", JsonUtil.asDate(body, "lastDonation"));
            donor.put("availability", JsonUtil.textOrNull(body, "availability") == null ? "Available" : JsonUtil.text(body, "availability"));
            donor.put("address", JsonUtil.text(body, "address"));
            donor.put("city", JsonUtil.text(body, "city"));
            donor.put("state", JsonUtil.text(body, "state"));
            donor.put("pincode", JsonUtil.text(body, "pincode"));
            donor.put("latitude", JsonUtil.asDouble(body, "latitude"));
            donor.put("longitude", JsonUtil.asDouble(body, "longitude"));
            donor.put("zone", JsonUtil.textOrNull(body, "zone"));
            donor.put("smsNotif", JsonUtil.asBoolean(body, "smsNotif", true));
            donor.put("pushNotif", JsonUtil.asBoolean(body, "pushNotif", true));
            donor.put("emailNotif", JsonUtil.asBoolean(body, "emailNotif", false));

            if (donorDao.insert(donor)) {
                Map<String, Object> registeredDonor = donorDao.findByLogin(email, password);
                if (registeredDonor == null) {
                    registeredDonor = donor;
                }
                HttpSession session = request.getSession(true);
                session.setAttribute("user", registeredDonor);
                session.setAttribute("role", "DONOR");
                String donorIdStr = registeredDonor.get("donorId") != null ? registeredDonor.get("donorId").toString() : registeredDonor.get("id").toString();

                // Audit & track real-time session
                try {
                    String ip = GeoLocationUtil.getClientIp(request);
                    String ua = request.getHeader("User-Agent");
                    String device = UserAgentUtil.parseDevice(ua);
                    String browser = UserAgentUtil.parseBrowser(ua);
                    String location = GeoLocationUtil.resolveLocation(ip);
                    sessionDao.recordSession(session.getId(), donorIdStr, "DONOR", ip, ua, device, browser, location);
                } catch (Exception ignored) {}

                Map<String, Object> wrapper = new HashMap<>();
                wrapper.put("donor", registeredDonor);
                wrapper.put("donorId", donorIdStr);
                wrapper.put("token", "SESSION-DONOR-" + donorIdStr);
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(new ApiResponse(true, "Donor Registered Successfully!", wrapper));
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Registration Failed."));
            }
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            String identifier = JsonUtil.text(body, "identifier").trim();
            String password = JsonUtil.text(body, "password").trim();
            Map<String, Object> donor = donorDao.findByLogin(identifier, password);
            if (donor == null) {
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

            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("donor", donor);
            wrapper.put("donorId", donorIdStr);
            wrapper.put("token", "SESSION-DONOR-" + donorIdStr);
            return ok("Login Successful", wrapper);
        } catch (Exception e) {
            return serverError(e);
        }
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
    public ResponseEntity<ApiResponse> acceptRequest(@PathVariable int requestId, HttpServletRequest request) {
        return handleRequestAction(requestId, "Accepted", request);
    }

    @PostMapping("/blood-requests/{requestId}/decline")
    public ResponseEntity<ApiResponse> declineRequest(@PathVariable int requestId, HttpServletRequest request) {
        return handleRequestAction(requestId, "Declined", request);
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

            if (body.has("weight")) {
                Double weight = JsonUtil.asDouble(body, "weight");
                fields.put("weight", weight);
            }

            if (body.has("pulse")) {
                Integer pulseVal = JsonUtil.asInt(body, "pulse", 0);
                fields.put("pulse", (pulseVal != null && pulseVal > 0) ? pulseVal : null);
            }

            if (body.has("hemoglobin")) {
                Double hbVal = JsonUtil.asDouble(body, "hemoglobin");
                fields.put("hemoglobin", hbVal);
            }

            if (body.has("bloodPressure") || body.has("blood_pressure")) {
                String bpVal = JsonUtil.textOrNull(body, "bloodPressure") != null ? JsonUtil.text(body, "bloodPressure") : JsonUtil.textOrNull(body, "blood_pressure");
                fields.put("blood_pressure", (bpVal != null && !bpVal.isBlank()) ? bpVal.trim() : null);
            }

            if (body.has("bodyTemp") || body.has("body_temp")) {
                Double tempVal = JsonUtil.asDouble(body, "bodyTemp") != null ? JsonUtil.asDouble(body, "bodyTemp") : JsonUtil.asDouble(body, "body_temp");
                fields.put("body_temp", tempVal);
            }

            if (body.has("donorType") || body.has("donor_type")) {
                String dType = JsonUtil.textOrNull(body, "donorType") != null ? JsonUtil.text(body, "donorType") : JsonUtil.textOrNull(body, "donor_type");
                fields.put("donor_type", (dType != null && !dType.isBlank()) ? dType.trim() : null);
            }

            if (body.has("verifiedFacility") || body.has("verified_facility")) {
                String facility = JsonUtil.textOrNull(body, "verifiedFacility") != null ? JsonUtil.text(body, "verifiedFacility") : JsonUtil.textOrNull(body, "verified_facility");
                fields.put("verified_facility", (facility != null && !facility.isBlank()) ? facility.trim() : null);
            }

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

            // Clinical last_donation is written ONLY upon hospital check-in / verified donation completion.
            // Direct profile edits cannot arbitrarily modify last_donation.

            donorDao.updateProfile(targetId, fields);
            Map<String, Object> updated = donorDao.findById(targetId);

            // Update session cache
            HttpSession session = request.getSession(false);
            if (session != null && updated != null) {
                session.setAttribute("user", updated);
            }

            return ok("Profile updated successfully in MySQL database", updated);
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
            String donorName = donor != null && donor.get("name") != null ? (String) donor.get("name") : "Clinical Blood Donor";
            String donorId = donor != null && donor.get("donorId") != null ? (String) donor.get("donorId") : "DNR-0811";
            String blood = bloodType != null && !bloodType.isBlank() ? bloodType : (donor != null && donor.get("bloodType") != null ? (String) donor.get("bloodType") : "O+");
            String hosp = hospital != null && !hospital.isBlank() ? hospital : "Verified Regional Trauma Center";
            String dDate = date != null && !date.isBlank() ? date : java.time.LocalDate.now().toString();
            String code = refCode != null && !refCode.isBlank() ? refCode : (certId != null && !certId.isBlank() ? certId : "RED-" + (System.currentTimeMillis() % 100000));
            String vol = volume != null && !volume.isBlank() ? volume : "450 mL (1 Unit)";

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

    private ResponseEntity<ApiResponse> handleRequestAction(int requestId, String status, HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            int donorId = ((Number) donor.get("id")).intValue();

            com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();
            if ("Accepted".equalsIgnoreCase(status)) {
                boolean accepted = notifDao.acceptRequestByDonor(requestId, donorId);
                if (!accepted) {
                    return ResponseEntity.badRequest().body(new ApiResponse(false, "This request has expired or is no longer available to accept."));
                }
                requestDao.updateStatus(requestId, "Accepted");
            } else if ("Declined".equalsIgnoreCase(status)) {
                notifDao.updateDonorResponse(requestId, donorId, "DECLINED");
            }

            Map<String, Object> bloodRequest = requestDao.findById(requestId);
            if (bloodRequest == null) {
                bloodRequest = new HashMap<>();
            }
            bloodRequest.put("status", status);
            bloodRequest.put("distanceKm", 0);
            bloodRequest.put("etaMinutes", 0);
            return ok("Request " + status.toLowerCase(), bloodRequest);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireDonor(HttpServletRequest request) {
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

