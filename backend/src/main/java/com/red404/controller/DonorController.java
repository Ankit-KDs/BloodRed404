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

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse> getProfile(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            return ok("Profile loaded", donorDao.findById((Integer) donor.get("id")));
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

    @GetMapping({"/donations", "/donation-history"})
    public ResponseEntity<ApiResponse> getDonations(HttpServletRequest request) {
        try {
            Map<String, Object> donor = requireDonor(request);
            if (donor == null) return unauthorized();
            return ok("History loaded", donorDao.donationHistory((Integer) donor.get("id")));
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
            String email = JsonUtil.text(body, "email");
            String phone = JsonUtil.text(body, "phone");
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
            donor.put("password", JsonUtil.text(body, "password"));
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
                Map<String, Object> registeredDonor = donorDao.findByLogin(email, (String) donor.get("password"));
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
            String identifier = JsonUtil.text(body, "identifier");
            String password = JsonUtil.text(body, "password");
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
            if (donor == null) return unauthorized();
            Map<String, Object> fields = new HashMap<>();
            fields.put("name", JsonUtil.textOrNull(body, "fullName"));
            fields.put("phone", JsonUtil.textOrNull(body, "phone"));
            fields.put("address", JsonUtil.textOrNull(body, "address"));
            fields.put("city", JsonUtil.textOrNull(body, "city"));
            fields.put("availability", JsonUtil.textOrNull(body, "availability"));
            Double weight = JsonUtil.asDouble(body, "weight");
            if (weight != null) {
                fields.put("weight", weight);
            }
            donorDao.updateProfile((Integer) donor.get("id"), fields);
            return ok("Profile updated", donorDao.findById((Integer) donor.get("id")));
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

