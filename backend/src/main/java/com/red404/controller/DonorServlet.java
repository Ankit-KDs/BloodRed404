package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.DonorDao;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class DonorServlet extends HttpServlet {

    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/profile")) {
                Map<String, Object> donor = requireDonor(request, response);
                if (donor == null) return;
                JsonUtil.ok(response, "Profile loaded", donorDao.findById((Integer) donor.get("id")));
            } else if (path.equals("/nearby")) {
                handleNearby(request, response);
            } else if (path.equals("/donations") || path.equals("/donation-history")) {
                Map<String, Object> donor = requireDonor(request, response);
                if (donor == null) return;
                JsonUtil.ok(response, "History loaded", donorDao.donationHistory((Integer) donor.get("id")));
            } else if (path.equals("/dashboard-stats")) {
                handleStats(request, response);
            } else if (path.equals("/donation-chart")) {
                JsonUtil.ok(response, "Chart loaded", new int[12]);
            } else if (path.equals("/badges")) {
                JsonUtil.ok(response, "Badges loaded", defaultBadges());
            } else if (path.equals("/notifications")) {
                JsonUtil.ok(response, "Notifications loaded", new ArrayList<>());
            } else if (path.equals("/blood-requests")) {
                handleDonorRequests(request, response);
            } else if (path.equals("/settings")) {
                JsonUtil.ok(response, "Settings loaded", defaultSettings());
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown donor endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server failure: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/register")) {
                handleRegistration(request, response);
            } else if (path.equals("/login")) {
                handleLogin(request, response);
            } else if (path.equals("/change-password")) {
                handleChangePassword(request, response);
            } else if (path.matches("^/\\d+/notify$")) {
                JsonUtil.ok(response, "Notification queued", null);
            } else if (path.matches("^/blood-requests/\\d+/accept$")) {
                handleRequestAction(path, "Accepted", request, response);
            } else if (path.matches("^/blood-requests/\\d+/decline$")) {
                handleRequestAction(path, "Declined", request, response);
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown donor endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server failure: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/availability")) {
                Map<String, Object> donor = requireDonor(request, response);
                if (donor == null) return;
                JsonNode body = JsonUtil.readBody(request);
                boolean available = JsonUtil.asBoolean(body, "available", true);
                donorDao.updateAvailability((Integer) donor.get("id"), available);
                JsonUtil.ok(response, "Availability updated", Map.of("available", available));
            } else if (path.equals("/profile")) {
                Map<String, Object> donor = requireDonor(request, response);
                if (donor == null) return;
                JsonNode body = JsonUtil.readBody(request);
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
                JsonUtil.ok(response, "Profile updated", donorDao.findById((Integer) donor.get("id")));
            } else if (path.equals("/settings")) {
                JsonUtil.ok(response, "Settings saved", defaultSettings());
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown donor endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server failure: " + e.getMessage());
        }
    }

    private void handleRegistration(HttpServletRequest request, HttpServletResponse response) throws Exception {
        JsonNode body = JsonUtil.readBody(request);
        String email = JsonUtil.text(body, "email");
        String phone = JsonUtil.text(body, "phone");
        if (donorDao.emailOrPhoneExists(email, phone)) {
            JsonUtil.error(response, HttpServletResponse.SC_CONFLICT, "Email or phone already registered.");
            return;
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
            JsonUtil.created(response, "Donor Registered Successfully!", null);
        } else {
            JsonUtil.error(response, HttpServletResponse.SC_BAD_REQUEST, "Registration Failed.");
        }
    }

    private void handleLogin(HttpServletRequest request, HttpServletResponse response) throws Exception {
        JsonNode body = JsonUtil.readBody(request);
        String identifier = JsonUtil.text(body, "identifier");
        String password = JsonUtil.text(body, "password");
        Map<String, Object> donor = donorDao.findByLogin(identifier, password);
        if (donor == null) {
            JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid credentials. Please try again.");
            return;
        }
        HttpSession session = request.getSession(true);
        session.setAttribute("user", donor);
        session.setAttribute("role", "DONOR");
        Map<String, Object> wrapper = new HashMap<>();
        wrapper.put("donor", donor);
        wrapper.put("token", "SESSION-DONOR-" + donor.get("id"));
        JsonUtil.ok(response, "Login Successful", wrapper);
    }

    private void handleNearby(HttpServletRequest request, HttpServletResponse response) throws SQLException, IOException {
        Double lat = parseDouble(request.getParameter("lat"));
        Double lng = parseDouble(request.getParameter("lng"));
        double radius = request.getParameter("radius") == null ? 20 : Double.parseDouble(request.getParameter("radius"));
        String bloodType = request.getParameter("bloodType");
        JsonUtil.ok(response, "Nearby donors loaded", donorDao.findNearby(lat, lng, radius, bloodType));
    }

    private void handleStats(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> donor = requireDonor(request, response);
        if (donor == null) return;
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
        JsonUtil.ok(response, "Stats loaded", stats);
    }

    private void handleDonorRequests(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> donor = requireDonor(request, response);
        if (donor == null) return;
        Double lat = asDouble(donor.get("latitude"));
        Double lng = asDouble(donor.get("longitude"));
        JsonUtil.ok(response, "Requests loaded", requestDao.listForDonor(lat, lng));
    }

    private void handleChangePassword(HttpServletRequest request, HttpServletResponse response) throws Exception {
        Map<String, Object> donor = requireDonor(request, response);
        if (donor == null) return;
        JsonNode body = JsonUtil.readBody(request);
        boolean updated = donorDao.updatePassword(
                (Integer) donor.get("id"),
                JsonUtil.text(body, "currentPassword"),
                JsonUtil.text(body, "newPassword"));
        if (updated) {
            JsonUtil.ok(response, "Password updated", null);
        } else {
            JsonUtil.error(response, HttpServletResponse.SC_BAD_REQUEST, "Current password is incorrect.");
        }
    }

    private void handleRequestAction(String path, String status, HttpServletRequest request, HttpServletResponse response)
            throws Exception {
        Map<String, Object> donor = requireDonor(request, response);
        if (donor == null) return;
        int requestId = Integer.parseInt(path.replaceAll("\\D+", " ").trim().split(" ")[0]);
        requestDao.updateStatus(requestId, status);
        Map<String, Object> bloodRequest = requestDao.findById(requestId);
        if (bloodRequest == null) {
            bloodRequest = new HashMap<>();
        }
        bloodRequest.put("distanceKm", 0);
        bloodRequest.put("etaMinutes", 0);
        JsonUtil.ok(response, "Request " + status.toLowerCase(), bloodRequest);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireDonor(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("user") == null) {
            JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "Please login first.");
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
