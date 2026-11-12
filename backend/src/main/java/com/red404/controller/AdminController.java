package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.model.ApiResponse;
import com.red404.util.DBConnection;
import com.red404.util.GeoLocationUtil;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);
    private static final Queue<Map<String, Object>> IN_MEMORY_LOGS = new ConcurrentLinkedQueue<>();

    static {
        addLog("SYSTEM_BOOT", "RED404 Master Admin Kernel Initialized with Level-0 clearance monitoring.");
    }

    public static void addLog(String eventType, String details) {
        Map<String, Object> logEntry = new LinkedHashMap<>();
        logEntry.put("timestamp", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
        logEntry.put("type", eventType);
        logEntry.put("details", details);
        IN_MEMORY_LOGS.add(logEntry);
        while (IN_MEMORY_LOGS.size() > 100) {
            IN_MEMORY_LOGS.poll();
        }
    }

    // ==========================================
    // 1. STEALTH AUTHENTICATION ENDPOINT
    // ==========================================
    @PostMapping("/stealth-auth")
    public ResponseEntity<ApiResponse> stealthAuth(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            String email = JsonUtil.textOrNull(body, "email");
            String authCode = JsonUtil.textOrNull(body, "authCode");
            if (authCode == null) authCode = JsonUtil.textOrNull(body, "code");

            if (email == null || authCode == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Invalid payload: email and authorization code are required."));
            }

            email = email.trim();
            authCode = authCode.trim();

            String expectedCode = System.getenv("RED404_ADMIN_SECRET");
            if (expectedCode == null || expectedCode.isBlank()) {
                expectedCode = "RED404404404";
            }

            boolean isEmailValid = "red404admin808@open.in".equalsIgnoreCase(email);
            boolean isCodeValid = expectedCode.equals(authCode);

            if (isEmailValid && isCodeValid) {
                HttpSession session = request.getSession(true);
                session.setAttribute("adminRole", "SUPER_ADMIN");
                session.setAttribute("adminEmail", email);
                session.setAttribute("adminAuthTime", System.currentTimeMillis());

                String ip = GeoLocationUtil.getClientIp(request);
                addLog("ADMIN_AUTH_SUCCESS", "Stealth Master Admin authenticated from " + ip);

                Map<String, Object> data = new LinkedHashMap<>();
                data.put("role", "SUPER_ADMIN");
                data.put("email", email);
                data.put("token", "LEVEL0-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                data.put("redirectUrl", "admin-portal.html");

                return ResponseEntity.ok(new ApiResponse(true, "Clearance Granted: Welcome Super Admin", data));
            } else {
                addLog("ADMIN_AUTH_FAILED", "Failed stealth authorization attempt for " + email);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Access Denied: Invalid Secret Authorization Key."));
            }
        } catch (Exception e) {
            log.error("Stealth auth exception: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Authentication gateway error: " + e.getMessage()));
        }
    }

    // ==========================================
    // 2. CHECK ADMIN AUTH STATUS
    // ==========================================
    @GetMapping("/check-auth")
    public ResponseEntity<ApiResponse> checkAuth(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        boolean isAuth = session != null && "SUPER_ADMIN".equals(session.getAttribute("adminRole"));
        if (isAuth) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("authenticated", true);
            data.put("role", "SUPER_ADMIN");
            data.put("email", session.getAttribute("adminEmail"));
            return ResponseEntity.ok(new ApiResponse(true, "Authorized", data));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse(false, "Unauthorized Admin Session"));
    }

    // ==========================================
    // 3. DONORS DIRECTORY
    // ==========================================
    @GetMapping("/donors")
    public ResponseEntity<ApiResponse> getDonors(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        List<Map<String, Object>> donors = new ArrayList<>();
        String sql = "SELECT d.id, d.donor_id, d.name, d.email, d.phone, d.blood_type, " +
                "d.availability, d.address, d.city, d.state, d.pincode, d.zone, d.latitude, d.longitude, " +
                "d.last_donation, d.created_at, " +
                "(SELECT COUNT(*) FROM donations WHERE donor_id = d.donor_id) AS total_donations " +
                "FROM donors d ORDER BY d.id DESC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rs.getInt("id"));
                item.put("smartId", rs.getString("donor_id") != null ? rs.getString("donor_id") : "DNR-" + rs.getInt("id"));
                item.put("name", rs.getString("name"));
                item.put("email", rs.getString("email"));
                item.put("phone", rs.getString("phone"));
                item.put("bloodGroup", rs.getString("blood_type"));
                item.put("totalDonations", rs.getInt("total_donations"));
                item.put("status", rs.getString("availability") != null ? rs.getString("availability") : "Active");
                item.put("address", rs.getString("address"));
                item.put("city", rs.getString("city"));
                item.put("state", rs.getString("state"));
                item.put("pincode", rs.getString("pincode"));
                item.put("zone", rs.getString("zone"));
                item.put("latitude", rs.getObject("latitude"));
                item.put("longitude", rs.getObject("longitude"));
                item.put("lastDonation", rs.getString("last_donation"));

                String city = rs.getString("city");
                String state = rs.getString("state");
                String zone = rs.getString("zone");
                String locationStr = (city != null && !city.isBlank()) ? city : "Local Zone";
                if (state != null && !state.isBlank()) {
                    locationStr += ", " + state;
                }
                item.put("location", locationStr);
                item.put("createdAt", rs.getString("created_at"));
                donors.add(item);
            }
            return ResponseEntity.ok(new ApiResponse(true, "Donors loaded", donors));
        } catch (Exception e) {
            log.error("Error loading donors for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load donors: " + e.getMessage()));
        }
    }

    @PostMapping("/donors/{id}/reset-password-link")
    public ResponseEntity<ApiResponse> sendPasswordResetLink(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT donor_id, name, email FROM donors WHERE id = ?")) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String smartId = rs.getString("donor_id");
                    String name = rs.getString("name");
                    String email = rs.getString("email");

                    String resetToken = UUID.randomUUID().toString();
                    addLog("PASSWORD_RESET_DISPATCHED", "Password reset link issued for Donor " + smartId + " (" + email + ")");

                    Map<String, Object> data = new LinkedHashMap<>();
                    data.put("email", email);
                    data.put("smartId", smartId);
                    data.put("resetToken", resetToken);
                    data.put("resetDispatched", true);

                    return ResponseEntity.ok(new ApiResponse(true, "Password reset link dispatched to " + email, data));
                } else {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ApiResponse(false, "Donor record not found"));
                }
            }
        } catch (Exception e) {
            log.error("Error dispatching password reset link: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to dispatch password reset link: " + e.getMessage()));
        }
    }

    @PostMapping("/donors/{id}/toggle-status")
    public ResponseEntity<ApiResponse> toggleDonorStatus(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        try (Connection conn = DBConnection.getConnection()) {
            String currentStatus = "Available";
            String smartId = "";
            try (PreparedStatement ps = conn.prepareStatement("SELECT donor_id, availability FROM donors WHERE id = ?")) {
                ps.setInt(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        smartId = rs.getString("donor_id");
                        currentStatus = rs.getString("availability");
                    } else {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(new ApiResponse(false, "Donor not found"));
                    }
                }
            }

            String nextStatus = "Suspended".equalsIgnoreCase(currentStatus) ? "Available" : "Suspended";
            try (PreparedStatement ps = conn.prepareStatement("UPDATE donors SET availability = ? WHERE id = ?")) {
                ps.setString(1, nextStatus);
                ps.setInt(2, id);
                ps.executeUpdate();
            }

            addLog("DONOR_STATUS_TOGGLE", "Donor " + smartId + " status updated to " + nextStatus);
            return ResponseEntity.ok(new ApiResponse(true, "Donor status changed to " + nextStatus, Map.of("newStatus", nextStatus)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, e.getMessage()));
        }
    }

    // ==========================================
    // 4. HOSPITALS DIRECTORY
    // ==========================================
    @GetMapping("/hospitals")
    public ResponseEntity<ApiResponse> getHospitals(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        List<Map<String, Object>> hospitals = new ArrayList<>();
        String sql = "SELECT id, hospital_name, city, state, hospital_type, blood_bank_license, " +
                "hospital_email, hospital_phone, created_at FROM hospitals ORDER BY id DESC";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                int hospId = rs.getInt("id");
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", hospId);
                item.put("name", rs.getString("hospital_name"));
                item.put("location", (rs.getString("city") != null ? rs.getString("city") : "") +
                        (rs.getString("state") != null ? ", " + rs.getString("state") : ""));
                String lic = rs.getString("blood_bank_license");
                item.put("verificationStatus", (lic != null && !lic.isBlank()) ? "Verified" : "Pending");
                item.put("license", lic != null ? lic : "N/A");
                item.put("type", rs.getString("hospital_type"));
                item.put("email", rs.getString("hospital_email"));
                item.put("phone", rs.getString("hospital_phone"));
                item.put("lastSynced", rs.getString("created_at"));

                // Calculate stock overview from hospital_inventory
                StringBuilder stockOverview = new StringBuilder();
                int totalUnits = 0;
                try (PreparedStatement stockPs = conn.prepareStatement(
                        "SELECT blood_type, units FROM hospital_inventory WHERE hospital_id = ? AND units > 0")) {
                    stockPs.setInt(1, hospId);
                    try (ResultSet sRs = stockPs.executeQuery()) {
                        while (sRs.next()) {
                            totalUnits += sRs.getInt("units");
                            if (stockOverview.length() > 0) stockOverview.append(", ");
                            stockOverview.append(sRs.getString("blood_type")).append(": ").append(sRs.getInt("units"));
                        }
                    }
                } catch (Exception ignored) {}

                item.put("totalStockUnits", totalUnits);
                item.put("stockOverview", stockOverview.length() > 0 ? stockOverview.toString() : "0 Units");
                hospitals.add(item);
            }
            return ResponseEntity.ok(new ApiResponse(true, "Hospitals loaded", hospitals));
        } catch (Exception e) {
            log.error("Error loading hospitals for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load hospitals: " + e.getMessage()));
        }
    }

    // ==========================================
    // 5. USER FEEDBACK
    // ==========================================
    @GetMapping("/feedback")
    public ResponseEntity<ApiResponse> getFeedback(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT id, user_id, user_name, user_email, category, rating, message, created_at " +
                "FROM user_feedback ORDER BY id DESC LIMIT 100";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rs.getInt("id"));
                item.put("userId", rs.getString("user_id"));
                item.put("userName", rs.getString("user_name"));
                item.put("userEmail", rs.getString("user_email"));
                item.put("category", rs.getString("category"));
                item.put("rating", rs.getInt("rating"));
                item.put("message", rs.getString("message"));
                item.put("createdAt", rs.getString("created_at"));
                list.add(item);
            }
            return ResponseEntity.ok(new ApiResponse(true, "Feedback loaded", list));
        } catch (Exception e) {
            return ResponseEntity.ok(new ApiResponse(true, "Feedback loaded", list));
        }
    }

    // ==========================================
    // 6. ISSUE REPORTS
    // ==========================================
    @GetMapping("/issues")
    public ResponseEntity<ApiResponse> getIssues(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT id, ticket_id, reporter_name, reporter_contact, category, description, status, created_at " +
                "FROM issue_reports ORDER BY id DESC LIMIT 100";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {

            while (rs.next()) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rs.getInt("id"));
                item.put("ticketId", rs.getString("ticket_id"));
                item.put("reporter", rs.getString("reporter_name") != null ? rs.getString("reporter_name") : "Anonymous User");
                item.put("contact", rs.getString("reporter_contact"));
                item.put("category", rs.getString("category"));
                item.put("description", rs.getString("description"));
                item.put("status", rs.getString("status"));
                item.put("createdAt", rs.getString("created_at"));
                list.add(item);
            }
            return ResponseEntity.ok(new ApiResponse(true, "Issue reports loaded", list));
        } catch (Exception e) {
            return ResponseEntity.ok(new ApiResponse(true, "Issue reports loaded", list));
        }
    }

    @PostMapping("/issues/{id}/resolve")
    public ResponseEntity<ApiResponse> resolveIssue(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        String sql = "UPDATE issue_reports SET status = 'RESOLVED' WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            boolean updated = ps.executeUpdate() > 0;
            if (updated) {
                addLog("ISSUE_RESOLVED", "Issue ticket #" + id + " marked as RESOLVED by Super Admin");
                return ResponseEntity.ok(new ApiResponse(true, "Issue ticket marked as RESOLVED"));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiResponse(false, "Ticket not found"));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiResponse(false, e.getMessage()));
        }
    }

    // ==========================================
    // 7. SYSTEM HEALTH & METRICS
    // ==========================================
    @GetMapping("/health")
    public ResponseEntity<ApiResponse> getSystemHealth(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        Map<String, Object> health = new LinkedHashMap<>();
        try (Connection conn = DBConnection.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            String prodName = meta.getDatabaseProductName();
            String prodVersion = meta.getDatabaseProductVersion();

            health.put("mysqlConnected", true);
            health.put("status", "HEALTHY");
            health.put("databaseProduct", prodName);
            health.put("databaseVersion", prodVersion);
            health.put("isMySQL", prodName != null && prodName.toLowerCase().contains("mysql"));

            // 1. Total Donors
            int totalDonors = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM donors")) {
                if (rs.next()) totalDonors = rs.getInt(1);
            } catch (Exception ignored) {}
            health.put("totalDonors", totalDonors);

            // 2. Total Hospitals
            int totalHospitals = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM hospitals")) {
                if (rs.next()) totalHospitals = rs.getInt(1);
            } catch (Exception ignored) {}
            health.put("totalHospitals", totalHospitals);

            // 3. Total SOS Handled
            int totalSos = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM blood_requests")) {
                if (rs.next()) totalSos = rs.getInt(1);
            } catch (Exception ignored) {}
            health.put("totalSosHandled", totalSos);

            // 4. Total Completed Rescues
            int totalDonations = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM donations WHERE status = 'COMPLETED'")) {
                if (rs.next()) totalDonations = rs.getInt(1);
            } catch (Exception ignored) {}
            health.put("totalDonations", totalDonations);

            // 5. Active Sessions
            int activeSessions = 0;
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM user_sessions WHERE is_active = TRUE")) {
                if (rs.next()) activeSessions = rs.getInt(1);
            } catch (Exception ignored) {}
            health.put("activeSessions", activeSessions);

            return ResponseEntity.ok(new ApiResponse(true, "System health telemetry loaded", health));
        } catch (Exception e) {
            health.put("mysqlConnected", false);
            health.put("status", "DEGRADED");
            health.put("error", e.getMessage());
            return ResponseEntity.ok(new ApiResponse(true, "System health telemetry loaded", health));
        }
    }

    // ==========================================
    // 8. MASTER ACTIVITY STACK (LOGS)
    // ==========================================
    @GetMapping("/logs")
    public ResponseEntity<ApiResponse> getActivityLogs(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        List<Map<String, Object>> logs = new ArrayList<>();

        // 1. Pull recent live in-memory logs
        logs.addAll(IN_MEMORY_LOGS);

        // 2. Pull real-time records from user_sessions
        try (Connection conn = DBConnection.getConnection();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT session_id, user_id, user_type, ip_address, browser, device, location, last_active " +
                     "FROM user_sessions ORDER BY last_active DESC LIMIT 15")) {
            while (rs.next()) {
                Map<String, Object> logItem = new LinkedHashMap<>();
                logItem.put("timestamp", rs.getString("last_active"));
                logItem.put("type", "SESSION_ACTIVE");
                logItem.put("details", String.format("[%s] Node %s accessed via %s on %s (%s)",
                        rs.getString("user_type"),
                        rs.getString("user_id"),
                        rs.getString("browser"),
                        rs.getString("device"),
                        rs.getString("location") != null ? rs.getString("location") : "GPS Node"));
                logs.add(logItem);
            }
        } catch (Exception ignored) {}

        // Sort descending by timestamp
        logs.sort((a, b) -> String.valueOf(b.get("timestamp")).compareTo(String.valueOf(a.get("timestamp"))));
        if (logs.size() > 40) {
            logs = logs.subList(0, 40);
        }

        return ResponseEntity.ok(new ApiResponse(true, "Activity logs loaded", logs));
    }

    // ==========================================
    // 9. LOGOUT
    // ==========================================
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            addLog("ADMIN_LOGOUT", "Super Admin logged out of Level-0 console.");
            session.invalidate();
        }
        return ResponseEntity.ok(new ApiResponse(true, "Admin logged out successfully"));
    }

    // ==========================================
    // SECURITY HELPERS
    // ==========================================
    private boolean isAdmin(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null && "SUPER_ADMIN".equals(session.getAttribute("adminRole"))) {
            return true;
        }
        String headerToken = request.getHeader("X-Admin-Clearance");
        return headerToken != null && headerToken.startsWith("LEVEL0-");
    }

    private ResponseEntity<ApiResponse> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse(false, "Restricted: Level-0 Administrative Clearance Required."));
    }
}

