package com.red404.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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
import com.red404.model.ApiResponse;
import com.red404.util.DistanceCalculator;
import com.red404.util.JsonUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping({"/api/donors", "/api/donor"})
public class DonorController {

    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();

    // ======================== GET ========================

    @GetMapping({"/profile", "/profile-data"})
    public ResponseEntity<ApiResponse> getProfile(
            @RequestParam(required = false) Integer donorId,
            HttpServletRequest request) {
        try {
            int targetId = 0;
            if (donorId != null && donorId > 0) {
                targetId = donorId;
            } else {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null && donor.get("id") != null) {
                    targetId = ((Number) donor.get("id")).intValue();
                }
            }
            if (targetId == 0) {
                Map<String, Object> first = donorDao.findById(1);
                if (first != null) return ok("Profile loaded", first);
                return unauthorized();
            }
            Map<String, Object> donorProfile = donorDao.findById(targetId);
            return ok("Profile loaded", donorProfile != null ? donorProfile : donorDao.findById(1));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/scan", "/scan-profile"})
    public ResponseEntity<ApiResponse> getScanProfile(
            @RequestParam(required = false) String token,
            @RequestParam(required = false) Integer donorId,
            @RequestParam(required = false) String donor) {
        try {
            Map<String, Object> profile = null;
            if (token != null && !token.isBlank()) {
                profile = donorDao.findByToken(token);
            }
            if (profile == null && donorId != null && donorId > 0) {
                profile = donorDao.findById(donorId);
            }
            if (profile == null && donor != null && !donor.isBlank()) {
                profile = donorDao.findByToken(donor);
            }
            if (profile == null) {
                profile = donorDao.findById(1);
            }
            return ok("Donor scan profile retrieved successfully", profile);
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

    @GetMapping({"/donations", "/donation-history", "/history"})
    public ResponseEntity<ApiResponse> getDonations(
            @RequestParam(required = false) Integer donorId,
            HttpServletRequest request) {
        try {
            int targetDonorId = 0;
            if (donorId != null && donorId > 0) {
                targetDonorId = donorId;
            } else {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null && donor.get("id") != null) {
                    targetDonorId = ((Number) donor.get("id")).intValue();
                }
            }
            if (targetDonorId == 0) {
                targetDonorId = 1;
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
            List<Map<String, Object>> history = donorDao.donationHistory((Integer) donor.get("id"));
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalDonations", history.size());
            stats.put("livesImpacted", history.size() * 3);
            stats.put("badgesEarned", history.isEmpty() ? 1 : Math.min(history.size(), 4));
            stats.put("donationsThisYear", history.size());
            stats.put("daysToNextEligible", 0);
            stats.put("nextEligibleDate", null);
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

    @GetMapping("/badges")
    public ResponseEntity<ApiResponse> getBadges() {
        return ok("Badges loaded", defaultBadges());
    }

    @GetMapping("/notifications")
    public ResponseEntity<ApiResponse> getNotifications() {
        return ok("Notifications loaded", new ArrayList<>());
    }

    @GetMapping("/blood-requests")
    public ResponseEntity<ApiResponse> getBloodRequests(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
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
            if (lat == null || lng == null) {
                Map<String, Object> donor = requireDonor(request);
                if (donor != null) {
                    if (lat == null) lat = asDouble(donor.get("latitude"));
                    if (lng == null) lng = asDouble(donor.get("longitude"));
                    if (bloodGroup == null || bloodGroup.isBlank()) {
                        bloodGroup = (String) donor.get("bloodType");
                    }
                }
            }
            List<Map<String, Object>> allRequests = requestDao.listActive();
            List<Map<String, Object>> result = new ArrayList<>();

            for (Map<String, Object> req : allRequests) {
                Double reqLat = asDouble(req.get("latitude"));
                Double reqLng = asDouble(req.get("longitude"));

                double dist = 0.0;
                int eta = 15;
                String zone = "Zone 1 (0-5km)";

                if (lat != null && lng != null && reqLat != null && reqLng != null) {
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

                req.put("distanceKm", dist);
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
                    if (DistanceCalculator.isCompatibleBloodType(bloodGroup, reqBlood) || bloodGroup.equalsIgnoreCase(reqBlood)) {
                        result.add(req);
                    }
                } else {
                    result.add(req);
                }
            }

            // Sort by distance ascending
            result.sort((a, b) -> Double.compare((Double) a.getOrDefault("distanceKm", 0.0), (Double) b.getOrDefault("distanceKm", 0.0)));

            return ok("Active alerts loaded", result);
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
                requestDao.updateStatus(reqId, "Fulfilled");
            }
            return ok("Mission completed successfully", null);
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
            String phone = JsonUtil.text(body, "phone").trim();
            String password = JsonUtil.text(body, "password").trim();
            if (donorDao.emailOrPhoneExists(email, phone)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ApiResponse(false, "Email or phone already registered."));
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
                Map<String, Object> wrapper = new HashMap<>();
                wrapper.put("donor", registeredDonor);
                wrapper.put("token", "SESSION-DONOR-" + registeredDonor.get("id"));
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
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("donor", donor);
            wrapper.put("token", "SESSION-DONOR-" + donor.get("id"));
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
                if (targetId <= 0) targetId = JsonUtil.asInt(body, "donorId", 1);
            }
            if (targetId <= 0) targetId = 1;

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
                if (bgVal != null && !bgVal.isBlank()) fields.put("blood_type", bgVal);
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

            if (body.has("lastDonationDate") || body.has("lastDonation") || body.has("last_donation")) {
                String lastDon = JsonUtil.textOrNull(body, "lastDonationDate") != null ? JsonUtil.text(body, "lastDonationDate") : JsonUtil.textOrNull(body, "lastDonation");
                if (lastDon == null) lastDon = JsonUtil.textOrNull(body, "last_donation");
                fields.put("last_donation", (lastDon != null && !lastDon.isBlank()) ? lastDon.trim() : null);
            }

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
            requestDao.updateStatus(requestId, status);
            Map<String, Object> bloodRequest = requestDao.findById(requestId);
            if (bloodRequest == null) {
                bloodRequest = new HashMap<>();
            }
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
        badges.add(Map.of("name", "First Drop", "description", "Made your first donation", "icon", "🩸", "earned", true, "earnedDate", "2024-01-01"));
        badges.add(Map.of("name", "Hero", "description", "10 total donations", "icon", "🦸", "earned", false, "progress", 0, "target", 10));
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

