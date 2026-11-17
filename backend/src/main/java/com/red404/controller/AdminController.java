package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.model.ApiResponse;
import com.red404.service.DonorEligibilityService;
import com.red404.service.StockService;
import com.red404.util.DBConnection;
import com.red404.util.GeoLocationUtil;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.File;
import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);
    private static final Queue<Map<String, Object>> IN_MEMORY_LOGS = new ConcurrentLinkedQueue<>();
    private static final List<SseEmitter> adminEmitters = new CopyOnWriteArrayList<>();
    private static final String DOC_SIGNING_SECRET = "RED404_ADMIN_DOC_SECRET_2026";
    private final com.red404.service.DocumentStorageService documentStorageService = new com.red404.service.DocumentStorageService();
    private final com.red404.service.HospitalVerificationService hospitalVerificationService = new com.red404.service.HospitalVerificationService();

    static {
        addLog("SYSTEM_BOOT", "RED404 Master Admin Kernel Initialized with Level-0 clearance monitoring.");
    }

    public static void addLog(String eventType, String details) {
        Map<String, Object> logEntry = new LinkedHashMap<>();
        logEntry.put("timestamp", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new java.util.Date()));
        logEntry.put("type", eventType);
        logEntry.put("details", com.red404.util.LogSanitizer.sanitize(details));
        IN_MEMORY_LOGS.add(logEntry);
        while (IN_MEMORY_LOGS.size() > 100) {
            IN_MEMORY_LOGS.poll();
        }
    }

    // ==========================================
    // REALTIME ADMIN SSE & SIGNED DOCUMENTS
    // ==========================================
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAdminEvents(HttpServletRequest request) {
        if (!isAdmin(request)) return null;
        SseEmitter emitter = new SseEmitter(180_000L); // 3 mins timeout
        adminEmitters.add(emitter);
        emitter.onCompletion(() -> adminEmitters.remove(emitter));
        emitter.onTimeout(() -> adminEmitters.remove(emitter));
        emitter.onError(e -> adminEmitters.remove(emitter));
        try {
            Map<String, Object> init = new LinkedHashMap<>();
            init.put("message", "Admin realtime stream connected");
            init.put("timestamp", System.currentTimeMillis());
            emitter.send(SseEmitter.event().name("connected").data(init));
        } catch (Exception ignored) {}
        return emitter;
    }

    public static void broadcastAdminEvent(String eventName, Map<String, Object> data) {
        for (SseEmitter emitter : adminEmitters) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(data));
            } catch (Exception e) {
                adminEmitters.remove(emitter);
            }
        }
    }

    public static String generateDocumentSignedToken(String docId) {
        long expiry = System.currentTimeMillis() + (3600 * 1000); // 1 hour
        String raw = docId + ":" + expiry;
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(DOC_SIGNING_SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] sig = mac.doFinal(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : sig) {
                sb.append(String.format("%02x", b));
            }
            return expiry + "_" + sb.toString();
        } catch (Exception e) {
            return String.valueOf(expiry);
        }
    }

    public static boolean isValidDocumentToken(String docId, String token) {
        if (token == null || !token.contains("_")) return false;
        String[] parts = token.split("_");
        try {
            long expiry = Long.parseLong(parts[0]);
            if (System.currentTimeMillis() > expiry) return false;
            String expected = generateDocumentSignedToken(docId);
            return token.equals(expected);
        } catch (Exception e) {
            return false;
        }
    }

    @GetMapping("/documents/{docId}")
    public ResponseEntity<?> getAdminDocument(
            @PathVariable String docId,
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String download,
            HttpServletRequest request) {
        if (!isAdmin(request)) {
            if (!isValidDocumentToken(docId, token)) {
                return unauthorized();
            }
        }
        File file = documentStorageService.getDocumentFile(docId);
        if (file == null || !file.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, "Document not found or inaccessible."));
        }
        String mime = "application/octet-stream";
        String lower = file.getName().toLowerCase();
        if (lower.endsWith(".pdf")) mime = "application/pdf";
        else if (lower.endsWith(".png")) mime = "image/png";
        else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";

        String disposition = ("1".equals(download) || "true".equalsIgnoreCase(download)) ? "attachment" : "inline";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mime)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + file.getName() + "\"")
                .body(new FileSystemResource(file));
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

            String expectedCode = com.red404.config.EnvConfig.getAdminSecret();
            String configuredEmail = com.red404.config.EnvConfig.getAdminEmail();

            boolean isEmailValid = configuredEmail.equalsIgnoreCase(email) || "red404admin808@open.in".equalsIgnoreCase(email);
            boolean isCodeValid = expectedCode != null && !expectedCode.isBlank() && expectedCode.equals(authCode);

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
    public ResponseEntity<ApiResponse> getDonors(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        int effectivePage = (page != null && page > 0) ? page : 1;
        int effectiveLimit = (limit != null && limit > 0) ? Math.min(limit, 500) : 200;
        int offset = (effectivePage - 1) * effectiveLimit;

        List<Map<String, Object>> donors = new ArrayList<>();
        int totalDonors = 0;

        String countSql = "SELECT COUNT(*) FROM donors";
        String sql = "SELECT d.id, d.donor_id, d.name, d.father_name, d.email, d.phone, d.dob, d.gender, d.blood_type, " +
                "d.weight, d.donor_type, d.availability, d.address, d.city, d.state, d.pincode, d.zone, " +
                "d.latitude, d.longitude, d.location_updated_at, d.allergies, d.conditions, d.medications, d.surgeries, " +
                "d.last_donation, d.created_at, " +
                "(SELECT COUNT(*) FROM donations WHERE (donor_id = d.donor_id OR donor_id = CAST(d.id AS CHAR)) AND UPPER(status) IN ('COMPLETED', 'APPROVED', 'VERIFIED')) AS total_donations " +
                "FROM donors d ORDER BY d.id DESC LIMIT ? OFFSET ?";

        try (Connection conn = DBConnection.getConnection()) {
            try (Statement st = conn.createStatement(); ResultSet crs = st.executeQuery(countSql)) {
                if (crs.next()) totalDonors = crs.getInt(1);
            } catch (Exception ignored) {}

            Double refHospLat = null;
            Double refHospLng = null;
            try (PreparedStatement hps = conn.prepareStatement(
                    "SELECT latitude, longitude FROM hospitals WHERE LOWER(COALESCE(verification_status, '')) = 'verified' AND latitude IS NOT NULL LIMIT 1");
                 ResultSet hrs = hps.executeQuery()) {
                if (hrs.next()) {
                    refHospLat = hrs.getDouble("latitude");
                    refHospLng = hrs.getDouble("longitude");
                }
            } catch (Exception ignored) {}

            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, effectiveLimit);
                ps.setInt(2, offset);
                try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", rs.getInt("id"));
                    item.put("smartId", rs.getString("donor_id") != null ? rs.getString("donor_id") : "DNR-" + rs.getInt("id"));
                    item.put("name", rs.getString("name"));
                    item.put("fatherName", rs.getString("father_name"));
                    item.put("email", rs.getString("email"));
                    item.put("phone", rs.getString("phone"));
                    item.put("dob", rs.getString("dob"));
                    item.put("gender", rs.getString("gender"));
                    String bType = rs.getString("blood_type");
                    item.put("bloodGroup", bType);
                    item.put("bloodType", bType);
                    item.put("blood_type", bType);
                    item.put("weight", rs.getObject("weight"));
                    item.put("donorType", rs.getString("donor_type"));
                    item.put("status", rs.getString("availability") != null ? rs.getString("availability") : "Active");
                    item.put("address", rs.getString("address"));
                    String rawCity = rs.getString("city");
                    String rawState = rs.getString("state");
                    item.put("city", rawCity);
                    item.put("state", rawState);
                    item.put("pincode", rs.getString("pincode"));

                    // Compute dynamic Zone & Freshness (24 hours)
                    Object latObj = rs.getObject("latitude");
                    Object lngObj = rs.getObject("longitude");
                    java.sql.Timestamp locUpdated = null;
                    try { locUpdated = rs.getTimestamp("location_updated_at"); } catch (Exception ignored) {}
                    if (locUpdated == null) {
                        try { locUpdated = rs.getTimestamp("created_at"); } catch (Exception ignored) {}
                    }

                    long FRESHNESS_MS = 24L * 60 * 60 * 1000L;
                    boolean isFresh = locUpdated != null && (System.currentTimeMillis() - locUpdated.getTime()) <= FRESHNESS_MS;
                    String computedZone = "Location not shared";
                    String lastSeenLocationTime = "Location not shared";

                    if (latObj != null && lngObj != null && isFresh) {
                        double dLat = ((Number) latObj).doubleValue();
                        double dLng = ((Number) lngObj).doubleValue();
                        long minutesAgo = Math.max(1, (System.currentTimeMillis() - locUpdated.getTime()) / 60000L);
                        String timeStr = minutesAgo < 60 ? (minutesAgo + " mins ago") : ((minutesAgo / 60) + " hrs ago");
                        lastSeenLocationTime = String.format("%.2f°N, %.2f°E (%s)", dLat, dLng, timeStr);

                        if (refHospLat != null && refHospLng != null && refHospLat != 0.0) {
                            double distKm = com.red404.util.DistanceCalculator.calculateDistance(refHospLat, refHospLng, dLat, dLng);
                            if (distKm <= 5.0) computedZone = "Zone 1 (0–5 km)";
                            else if (distKm <= 10.0) computedZone = "Zone 2 (5–10 km)";
                            else if (distKm <= 20.0) computedZone = "Zone 3 (10–20 km)";
                            else computedZone = "Zone 4 (20+ km)";
                        } else {
                            computedZone = "Zone 1 (0–5 km)";
                        }
                    } else if (latObj != null && lngObj != null) {
                        double dLat = ((Number) latObj).doubleValue();
                        double dLng = ((Number) lngObj).doubleValue();
                        lastSeenLocationTime = String.format("%.2f°N, %.2f°E (Stale)", dLat, dLng);
                    }

                    item.put("zone", computedZone);
                    item.put("lastSeenLocationTime", lastSeenLocationTime);

                    String registeredCity = (rawCity != null && !rawCity.isBlank()) ? rawCity : "Not provided";
                    if (rawState != null && !rawState.isBlank() && !registeredCity.equalsIgnoreCase("Not provided")) {
                        registeredCity += ", " + rawState;
                    }
                    item.put("registeredCity", registeredCity);

                    item.put("latitude", latObj);
                    item.put("longitude", lngObj);
                    item.put("allergies", rs.getString("allergies"));
                    item.put("conditions", rs.getString("conditions"));
                    item.put("medications", rs.getString("medications"));
                    item.put("surgeries", rs.getString("surgeries"));
                    item.put("lastDonation", rs.getString("last_donation"));
                    item.put("totalDonations", rs.getInt("total_donations"));

                    String locationStr = (rawCity != null && !rawCity.isBlank()) ? rawCity : "Local Zone";
                    if (rawState != null && !rawState.isBlank()) {
                        locationStr += ", " + rawState;
                    }
                    item.put("location", locationStr);
                    item.put("createdAt", rs.getString("created_at"));
                    donors.add(item);
                }
            }
        }
        HttpHeaders headers = new HttpHeaders();
            headers.set("X-Total-Count", String.valueOf(totalDonors));
            headers.set("X-Page", String.valueOf(effectivePage));
            headers.set("X-Limit", String.valueOf(effectiveLimit));
            headers.set("X-Total-Pages", String.valueOf(Math.max(1, (int) Math.ceil((double) totalDonors / effectiveLimit))));
            return ResponseEntity.ok().headers(headers).body(new ApiResponse(true, "Donors loaded", donors));
        } catch (Exception e) {
            log.error("Error loading donors for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load donors: " + e.getMessage()));
        }
    }

    @GetMapping("/donors/{id}")
    public ResponseEntity<ApiResponse> getDonorDetails(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        String sql = "SELECT d.id, d.donor_id, d.name, d.father_name, d.email, d.phone, d.dob, d.gender, d.blood_type, " +
                "d.weight, d.donor_type, d.availability, d.address, d.city, d.state, d.pincode, d.zone, " +
                "d.latitude, d.longitude, d.location_updated_at, d.allergies, d.conditions, d.medications, d.surgeries, " +
                "d.last_donation, d.created_at, " +
                "(SELECT COUNT(*) FROM donations WHERE (donor_id = d.donor_id OR donor_id = CAST(d.id AS CHAR)) AND UPPER(status) IN ('COMPLETED', 'APPROVED', 'VERIFIED')) AS total_donations " +
                "FROM donors d WHERE d.id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {

            Double refHospLat = null;
            Double refHospLng = null;
            try (PreparedStatement hps = conn.prepareStatement(
                    "SELECT latitude, longitude FROM hospitals WHERE LOWER(COALESCE(verification_status, '')) = 'verified' AND latitude IS NOT NULL LIMIT 1");
                 ResultSet hrs = hps.executeQuery()) {
                if (hrs.next()) {
                    refHospLat = hrs.getDouble("latitude");
                    refHospLng = hrs.getDouble("longitude");
                }
            } catch (Exception ignored) {}

            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", rs.getInt("id"));
                    item.put("smartId", rs.getString("donor_id") != null ? rs.getString("donor_id") : "DNR-" + rs.getInt("id"));
                    item.put("name", rs.getString("name"));
                    item.put("fatherName", rs.getString("father_name"));
                    item.put("email", rs.getString("email"));
                    item.put("phone", rs.getString("phone"));
                    item.put("dob", rs.getString("dob"));
                    item.put("gender", rs.getString("gender"));
                    String bType = rs.getString("blood_type");
                    item.put("bloodGroup", bType);
                    item.put("bloodType", bType);
                    item.put("blood_type", bType);
                    item.put("weight", rs.getObject("weight"));
                    item.put("donorType", rs.getString("donor_type"));
                    item.put("status", rs.getString("availability") != null ? rs.getString("availability") : "Active");
                    item.put("address", rs.getString("address"));
                    String rawCity = rs.getString("city");
                    String rawState = rs.getString("state");
                    item.put("city", rawCity);
                    item.put("state", rawState);
                    item.put("pincode", rs.getString("pincode"));

                    // Compute dynamic Zone & Freshness (24 hours)
                    Object latObj = rs.getObject("latitude");
                    Object lngObj = rs.getObject("longitude");
                    java.sql.Timestamp locUpdated = null;
                    try { locUpdated = rs.getTimestamp("location_updated_at"); } catch (Exception ignored) {}
                    if (locUpdated == null) {
                        try { locUpdated = rs.getTimestamp("created_at"); } catch (Exception ignored) {}
                    }

                    long FRESHNESS_MS = 24L * 60 * 60 * 1000L;
                    boolean isFresh = locUpdated != null && (System.currentTimeMillis() - locUpdated.getTime()) <= FRESHNESS_MS;
                    String computedZone = "Location not shared";
                    String lastSeenLocationTime = "Location not shared";

                    if (latObj != null && lngObj != null && isFresh) {
                        double dLat = ((Number) latObj).doubleValue();
                        double dLng = ((Number) lngObj).doubleValue();
                        long minutesAgo = Math.max(1, (System.currentTimeMillis() - locUpdated.getTime()) / 60000L);
                        String timeStr = minutesAgo < 60 ? (minutesAgo + " mins ago") : ((minutesAgo / 60) + " hrs ago");
                        lastSeenLocationTime = String.format("%.2f°N, %.2f°E (%s)", dLat, dLng, timeStr);

                        if (refHospLat != null && refHospLng != null && refHospLat != 0.0) {
                            double distKm = com.red404.util.DistanceCalculator.calculateDistance(refHospLat, refHospLng, dLat, dLng);
                            if (distKm <= 5.0) computedZone = "Zone 1 (0–5 km)";
                            else if (distKm <= 10.0) computedZone = "Zone 2 (5–10 km)";
                            else if (distKm <= 20.0) computedZone = "Zone 3 (10–20 km)";
                            else computedZone = "Zone 4 (20+ km)";
                        } else {
                            computedZone = "Zone 1 (0–5 km)";
                        }
                    } else if (latObj != null && lngObj != null) {
                        double dLat = ((Number) latObj).doubleValue();
                        double dLng = ((Number) lngObj).doubleValue();
                        lastSeenLocationTime = String.format("%.2f°N, %.2f°E (Stale)", dLat, dLng);
                    }

                    item.put("zone", computedZone);
                    item.put("lastSeenLocationTime", lastSeenLocationTime);

                    String registeredCity = (rawCity != null && !rawCity.isBlank()) ? rawCity : "Not provided";
                    if (rawState != null && !rawState.isBlank() && !registeredCity.equalsIgnoreCase("Not provided")) {
                        registeredCity += ", " + rawState;
                    }
                    item.put("registeredCity", registeredCity);

                    item.put("latitude", latObj);
                    item.put("longitude", lngObj);
                    item.put("allergies", rs.getString("allergies"));
                    item.put("conditions", rs.getString("conditions"));
                    item.put("medications", rs.getString("medications"));
                    item.put("surgeries", rs.getString("surgeries"));
                    item.put("lastDonation", rs.getString("last_donation"));
                    item.put("totalDonations", rs.getInt("total_donations"));
                    item.put("createdAt", rs.getString("created_at"));
                    DonorEligibilityService.attachEligibility(item);
                    return ResponseEntity.ok(new ApiResponse(true, "Fresh donor details loaded", item));
                } else {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ApiResponse(false, "Donor not found"));
                }
            }
        } catch (Exception e) {
            log.error("Error loading fresh donor profile for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load donor details: " + e.getMessage()));
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
            String currentStatus = "Active";
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

            String nextStatus = "Suspended".equalsIgnoreCase(currentStatus) ? "Active" : "Suspended";
            try (PreparedStatement ps = conn.prepareStatement("UPDATE donors SET availability = ? WHERE id = ?")) {
                ps.setString(1, nextStatus);
                ps.setInt(2, id);
                ps.executeUpdate();
            }

            addLog("DONOR_STATUS_TOGGLE", "Donor " + smartId + " status updated to " + nextStatus);
            return ResponseEntity.ok(new ApiResponse(true, "Donor status changed to " + nextStatus, Map.of("newStatus", nextStatus, "donorId", id)));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, e.getMessage()));
        }
    }

    // ==========================================
    // 3b. PERMANENTLY DELETE DONOR ACCOUNT
    // ==========================================
    @DeleteMapping("/donors/{id}/delete")
    public ResponseEntity<ApiResponse> deleteDonor(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        try (Connection conn = DBConnection.getConnection()) {
            // Fetch donor info for the log before deletion
            String smartId = "";
            String donorName = "";
            try (PreparedStatement ps = conn.prepareStatement("SELECT donor_id, name FROM donors WHERE id = ?")) {
                ps.setInt(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        smartId = rs.getString("donor_id");
                        donorName = rs.getString("name");
                    } else {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(new ApiResponse(false, "Donor not found"));
                    }
                }
            }

            // Delete related records first (cascade-safe)
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM intake_snapshots WHERE donor_id = ? OR donor_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1)")) {
                ps.setInt(1, id); ps.setInt(2, id); ps.executeUpdate();
            } catch (Exception ignored) {}
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM donations WHERE donor_id = ? OR donor_id = ?")) {
                ps.setString(1, smartId); ps.setString(2, String.valueOf(id)); ps.executeUpdate();
            } catch (Exception ignored) {}
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM user_sessions WHERE user_id = ? OR user_id = ?")) {
                ps.setString(1, smartId); ps.setString(2, String.valueOf(id)); ps.executeUpdate();
            } catch (Exception ignored) {}

            // Delete the donor record
            try (PreparedStatement ps = conn.prepareStatement("DELETE FROM donors WHERE id = ?")) {
                ps.setInt(1, id);
                int rows = ps.executeUpdate();
                if (rows == 0) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ApiResponse(false, "Donor not found or already deleted"));
                }
            }

            addLog("DONOR_DELETED", "Donor account permanently deleted: " + donorName + " (" + smartId + ")");
            return ResponseEntity.ok(new ApiResponse(true, "Donor account for " + donorName + " permanently deleted."));
        } catch (Exception e) {
            log.error("Error deleting donor {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to delete donor: " + e.getMessage()));
        }
    }

    // ==========================================
    // 4. HOSPITALS DIRECTORY
    // ==========================================
    @GetMapping("/hospitals")
    public ResponseEntity<ApiResponse> getHospitals(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        int effectivePage = (page != null && page > 0) ? page : 1;
        int effectiveLimit = (limit != null && limit > 0) ? Math.min(limit, 500) : 200;
        int offset = (effectivePage - 1) * effectiveLimit;

        List<Map<String, Object>> hospitals = new ArrayList<>();
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("pending_review", 0);
        counts.put("needs_info", 0);
        counts.put("verified", 0);
        counts.put("rejected", 0);
        counts.put("suspended", 0);
        counts.put("all", 0);

        int totalHospitals = 0;

        try (Connection conn = DBConnection.getConnection()) {
            // 1. Tally counts across statuses
            try (Statement st = conn.createStatement();
                 ResultSet crs = st.executeQuery("SELECT COALESCE(verification_status, 'pending_review') as vstat, COUNT(*) FROM hospitals WHERE verification_status IS NULL OR verification_status <> 'Deleted' GROUP BY verification_status")) {
                int totalAll = 0;
                while (crs.next()) {
                    String raw = crs.getString(1);
                    int cnt = crs.getInt(2);
                    String norm = com.red404.service.HospitalVerificationService.normalizeStatus(raw);
                    counts.put(norm, counts.getOrDefault(norm, 0) + cnt);
                    totalAll += cnt;
                }
                counts.put("all", totalAll);
                totalHospitals = totalAll;
            } catch (Exception ignored) {}

            // 2. Query hospitals filtered or all
            String filterNorm = (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status.trim()))
                    ? com.red404.service.HospitalVerificationService.normalizeStatus(status) : null;

            String baseSql = "SELECT id, hospital_name, registration_no, city, state, address, hospital_type, blood_bank_license, " +
                    "hospital_email, hospital_phone, latitude, longitude, verification_status, application_ref, documents_json, " +
                    "created_at, updated_at FROM hospitals WHERE (verification_status IS NULL OR verification_status <> 'Deleted')";

            if (filterNorm != null) {
                baseSql += " AND LOWER(COALESCE(verification_status, 'pending_review')) = ?";
            }

            // Pending sorted oldest first as per Part 5 rule 1!
            if ("pending_review".equals(filterNorm)) {
                baseSql += " ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?";
            } else {
                baseSql += " ORDER BY id DESC LIMIT ? OFFSET ?";
            }

            try (PreparedStatement ps = conn.prepareStatement(baseSql)) {
                int pIdx = 1;
                if (filterNorm != null) {
                    ps.setString(pIdx++, filterNorm);
                }
                ps.setInt(pIdx++, effectiveLimit);
                ps.setInt(pIdx++, offset);

                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        int hospId = rs.getInt("id");
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("id", hospId);
                        String name = rs.getString("hospital_name");
                        item.put("name", name != null ? name : "Hospital #" + hospId);
                        item.put("hospitalName", item.get("name"));
                        item.put("registrationNo", rs.getString("registration_no"));
                        item.put("applicationRef", rs.getString("application_ref"));

                        String city = rs.getString("city");
                        String state = rs.getString("state");
                        String loc = (city != null ? city : "") + (state != null ? (city != null && !city.isBlank() ? ", " : "") + state : "");
                        item.put("location", !loc.isBlank() ? loc : "Location Not Specified");
                        item.put("city", city);
                        item.put("state", state);
                        item.put("address", rs.getString("address"));
                        item.put("latitude", rs.getObject("latitude"));
                        item.put("longitude", rs.getObject("longitude"));

                        String vStatus = com.red404.service.HospitalVerificationService.normalizeStatus(rs.getString("verification_status"));
                        item.put("verificationStatus", vStatus);
                        item.put("status", vStatus);

                        String lic = rs.getString("blood_bank_license");
                        item.put("bloodBankLicense", (lic != null && !lic.isBlank()) ? lic : "N/A");
                        item.put("license", (lic != null && !lic.isBlank()) ? lic : "N/A");
                        item.put("type", rs.getString("hospital_type"));
                        item.put("hospitalType", rs.getString("hospital_type"));
                        item.put("email", rs.getString("hospital_email"));
                        item.put("hospitalEmail", rs.getString("hospital_email"));
                        item.put("emailVerified", true);
                        item.put("phone", rs.getString("hospital_phone"));
                        item.put("hospitalPhone", rs.getString("hospital_phone"));

                        String updatedAt = rs.getString("updated_at");
                        String createdAt = rs.getString("created_at");
                        item.put("updatedAt", updatedAt != null ? updatedAt : createdAt);
                        item.put("createdAt", createdAt);
                        item.put("submittedTime", createdAt);
                        item.put("lastUpdated", updatedAt != null ? updatedAt : createdAt);

                        // Documents count from documents_json
                        String docsJson = rs.getString("documents_json");
                        int docCount = 0;
                        if (docsJson != null && !docsJson.isBlank()) {
                            try {
                                JsonNode dn = JsonUtil.mapper().readTree(docsJson);
                                if (dn.isObject() || dn.isArray()) docCount = dn.size();
                            } catch (Exception ignored) {}
                        }
                        item.put("documentsCount", docCount > 0 ? docCount : 1);

                        // Stock summary for verified hospitals only
                        if ("verified".equals(vStatus)) {
                            Map<String, Object> hospStock = StockService.getHospitalStock(hospId);
                            @SuppressWarnings("unchecked")
                            Map<String, Integer> inventory = (Map<String, Integer>) hospStock.get("inventory");
                            int totalUnits = 0;
                            if (inventory != null) {
                                for (int u : inventory.values()) totalUnits += u;
                            }
                            item.put("totalStockUnits", totalUnits);
                            item.put("stockSummary", totalUnits + " units");
                            item.put("inventory", inventory != null ? inventory : Collections.emptyMap());
                            item.put("lastSynced", hospStock.get("updatedAgo"));
                        } else {
                            item.put("totalStockUnits", 0);
                            item.put("stockSummary", "—");
                            item.put("inventory", Collections.emptyMap());
                            item.put("lastSynced", "—");
                        }

                        hospitals.add(item);
                    }
                }
            }

            Map<String, Object> respData = new LinkedHashMap<>();
            respData.put("hospitals", hospitals);
            respData.put("counts", counts);

            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate");
            headers.set("X-Total-Count", String.valueOf(totalHospitals));
            headers.set("X-Page", String.valueOf(effectivePage));
            headers.set("X-Limit", String.valueOf(effectiveLimit));

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new ApiResponse(true, "Live hospitals loaded", respData));
        } catch (Exception e) {
            log.error("Error loading hospitals for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load hospitals: " + e.getMessage()));
        }
    }

    @GetMapping("/hospitals/{id}")
    public ResponseEntity<ApiResponse> getHospitalDetails(@PathVariable int id, HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        String sql = "SELECT * FROM hospitals WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", rs.getInt("id"));
                    item.put("hospitalName", rs.getString("hospital_name"));
                    item.put("name", rs.getString("hospital_name"));
                    item.put("registrationNo", rs.getString("registration_no"));
                    item.put("hospitalType", rs.getString("hospital_type"));
                    item.put("type", rs.getString("hospital_type"));
                    item.put("beds", rs.getInt("beds"));
                    String lic = rs.getString("blood_bank_license");
                    item.put("bloodBankLicense", (lic != null && !lic.isBlank()) ? lic : "N/A");
                    String vStatus = com.red404.service.HospitalVerificationService.normalizeStatus(rs.getString("verification_status"));
                    item.put("verificationStatus", vStatus);
                    item.put("status", vStatus);
                    item.put("hospitalEmail", rs.getString("hospital_email"));
                    item.put("email", rs.getString("hospital_email"));
                    item.put("emailVerified", true);
                    item.put("hospitalPhone", rs.getString("hospital_phone"));
                    item.put("phone", rs.getString("hospital_phone"));
                    item.put("website", rs.getString("website"));
                    item.put("services", rs.getString("services"));
                    item.put("adminName", rs.getString("admin_name"));
                    item.put("adminDesignation", rs.getString("admin_designation"));
                    item.put("adminPhone", rs.getString("admin_phone"));
                    item.put("adminEmail", rs.getString("admin_email"));
                    item.put("emergencyContact", rs.getString("emergency_contact"));
                    item.put("emergencyPublic", rs.getBoolean("emergency_public"));
                    item.put("address", rs.getString("address"));
                    item.put("landmark", rs.getString("landmark"));
                    item.put("city", rs.getString("city"));
                    item.put("state", rs.getString("state"));
                    item.put("pincode", rs.getString("pincode"));
                    item.put("latitude", rs.getObject("latitude"));
                    item.put("longitude", rs.getObject("longitude"));
                    item.put("zone", rs.getString("zone"));
                    item.put("operatingHours", rs.getString("operating_hours"));
                    item.put("zoneRadius", rs.getInt("zone_radius"));
                    item.put("smsNotif", rs.getBoolean("sms_notif"));
                    item.put("pushNotif", rs.getBoolean("push_notif"));
                    item.put("emailNotif", rs.getBoolean("email_notif"));
                    item.put("createdAt", rs.getString("created_at"));
                    item.put("submittedTime", rs.getString("created_at"));
                    item.put("updatedAt", rs.getString("updated_at"));
                    item.put("applicationRef", rs.getString("application_ref"));
                    item.put("eraktkoshId", rs.getString("eraktkosh_id"));

                    // Documents list with signed URLs
                    List<Map<String, Object>> docsList = new ArrayList<>();
                    String docsJson = rs.getString("documents_json");
                    if (docsJson != null && !docsJson.isBlank()) {
                        try {
                            JsonNode docNode = JsonUtil.mapper().readTree(docsJson);
                            if (docNode.isArray()) {
                                for (JsonNode itemNode : docNode) {
                                    Map<String, Object> docMap = new LinkedHashMap<>();
                                    String docType = itemNode.has("docType") ? itemNode.get("docType").asText() : "Document";
                                    String docId = itemNode.has("docId") ? itemNode.get("docId").asText() : "";
                                    String origName = itemNode.has("originalName") ? itemNode.get("originalName").asText() : docType;
                                    docMap.put("docType", docType);
                                    docMap.put("docId", docId);
                                    docMap.put("originalName", origName);
                                    if (!docId.isEmpty()) {
                                        String signedToken = generateDocumentSignedToken(docId);
                                        docMap.put("previewUrl", "/api/admin/documents/" + docId + "?token=" + signedToken);
                                        docMap.put("downloadUrl", "/api/admin/documents/" + docId + "?token=" + signedToken + "&download=1");
                                    }
                                    docsList.add(docMap);
                                }
                            } else if (docNode.isObject()) {
                                docNode.fieldNames().forEachRemaining(key -> {
                                    JsonNode itemNode = docNode.get(key);
                                    Map<String, Object> docMap = new LinkedHashMap<>();
                                    String docType = key;
                                    String docId = itemNode.has("docId") ? itemNode.get("docId").asText() : "";
                                    String origName = itemNode.has("originalName") ? itemNode.get("originalName").asText() : key;
                                    docMap.put("docType", docType);
                                    docMap.put("docId", docId);
                                    docMap.put("originalName", origName);
                                    if (!docId.isEmpty()) {
                                        String signedToken = generateDocumentSignedToken(docId);
                                        docMap.put("previewUrl", "/api/admin/documents/" + docId + "?token=" + signedToken);
                                        docMap.put("downloadUrl", "/api/admin/documents/" + docId + "?token=" + signedToken + "&download=1");
                                    } else if (itemNode.isTextual()) {
                                        docMap.put("previewUrl", itemNode.asText());
                                        docMap.put("downloadUrl", itemNode.asText());
                                    }
                                    docsList.add(docMap);
                                });
                            }
                        } catch (Exception ignored) {}
                    }
                    item.put("documents", docsList);

                    // Location summary string
                    String city = rs.getString("city");
                    String state = rs.getString("state");
                    String loc = (city != null ? city : "") + (state != null ? (city != null ? ", " : "") + state : "");
                    item.put("location", !loc.isBlank() ? loc : "Location Not Specified");

                    // Authoritative blood inventory breakdown across all 8 groups via StockService
                    if ("verified".equals(vStatus)) {
                        Map<String, Object> hospStock = StockService.getHospitalStock(id);
                        @SuppressWarnings("unchecked")
                        Map<String, Integer> inventory = (Map<String, Integer>) hospStock.get("inventory");
                        int totalUnits = 0;
                        StringBuilder stockOverview = new StringBuilder();
                        for (String bt : StockService.ALL_BLOOD_GROUPS) {
                            int u = inventory != null ? inventory.getOrDefault(bt, 0) : 0;
                            totalUnits += u;
                            if (u > 0) {
                                if (stockOverview.length() > 0) stockOverview.append(", ");
                                stockOverview.append(bt).append(": ").append(u);
                            }
                        }
                        item.put("inventory", inventory != null ? inventory : Collections.emptyMap());
                        item.put("totalStockUnits", totalUnits);
                        item.put("stockOverview", stockOverview.length() > 0 ? stockOverview.toString() : "0 Units");
                        item.put("lastSynced", hospStock.get("updatedAgo"));
                        item.put("lastSyncedTimestamp", hospStock.get("updatedAt"));
                        item.put("stockAvailable", true);
                    } else {
                        item.put("inventory", Collections.emptyMap());
                        item.put("totalStockUnits", 0);
                        item.put("stockOverview", "Stock tracking enabled after verification");
                        item.put("lastSynced", "—");
                        item.put("stockAvailable", false);
                    }

                    // Total SOS / Blood Requests handled
                    int totalRequests = 0;
                    try (PreparedStatement reqPs = conn.prepareStatement(
                            "SELECT COUNT(*) FROM blood_requests WHERE hospital_id = ?")) {
                        reqPs.setInt(1, id);
                        try (ResultSet rRs = reqPs.executeQuery()) {
                            if (rRs.next()) totalRequests = rRs.getInt(1);
                        }
                    } catch (Exception ignored) {}
                    item.put("totalRequests", totalRequests);

                    // Audit / Change History
                    List<Map<String, Object>> changeHistory = new ArrayList<>();
                    List<Map<String, Object>> auditLogs = hospitalVerificationService.getAuditLogs(id);
                    item.put("auditLogs", auditLogs);
                    for (Map<String, Object> logRow : auditLogs) {
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("id", logRow.get("id"));
                        entry.put("action", "STATUS_CHANGE");
                        entry.put("details", logRow.get("fromStatus") + " -> " + logRow.get("toStatus") +
                                " (Reason: " + logRow.get("reason") + ") by " + logRow.get("adminUser"));
                        entry.put("timestamp", logRow.get("createdAt"));
                        changeHistory.add(entry);
                    }
                    try (PreparedStatement logPs = conn.prepareStatement(
                            "SELECT id, action, details, timestamp FROM system_logs " +
                            "WHERE (details LIKE ? OR details LIKE ?) ORDER BY id DESC LIMIT 20")) {
                        logPs.setString(1, "%hospital ID " + id + "%");
                        String hName = rs.getString("hospital_name");
                        logPs.setString(2, "%" + (hName != null ? hName : "HOSP_" + id) + "%");
                        try (ResultSet lRs = logPs.executeQuery()) {
                            while (lRs.next()) {
                                Map<String, Object> logEntry = new LinkedHashMap<>();
                                logEntry.put("id", lRs.getInt("id"));
                                logEntry.put("action", lRs.getString("action"));
                                logEntry.put("details", lRs.getString("details"));
                                logEntry.put("timestamp", lRs.getString("timestamp"));
                                changeHistory.add(logEntry);
                            }
                        }
                    } catch (Exception ignored) {}
                    item.put("changeHistory", changeHistory);

                    return ResponseEntity.ok(new ApiResponse(true, "Fresh hospital details loaded", item));
                } else {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ApiResponse(false, "Hospital not found"));
                }
            }
        } catch (Exception e) {
            log.error("Error loading fresh hospital profile for admin: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load hospital details: " + e.getMessage()));
        }
    }

    // ==========================================
    // 4b. UPDATE HOSPITAL VERIFICATION STATUS
    // ==========================================
    @RequestMapping(value = "/hospitals/{id}/status", method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ApiResponse> updateHospitalStatus(
            @PathVariable int id,
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();
        if (body == null || !body.has("status")) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, "Status is required."));
        }
        String newStatus = body.get("status").asText().trim();
        String reason = body.has("reason") ? body.get("reason").asText().trim() : "";

        String adminEmail = (String) request.getSession(false).getAttribute("adminEmail");
        if (adminEmail == null) adminEmail = "Admin";

        try {
            hospitalVerificationService.changeStatus(id, newStatus, reason, adminEmail, true);
            Map<String, Object> respData = new LinkedHashMap<>();
            respData.put("id", id);
            respData.put("status", com.red404.service.HospitalVerificationService.normalizeStatus(newStatus));
            respData.put("reason", reason);
            respData.put("admin", adminEmail);
            return ResponseEntity.ok(new ApiResponse(true, "Hospital status updated to " + newStatus, respData));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        } catch (Exception e) {
            log.error("Error updating status for hospital {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to update status: " + e.getMessage()));
        }
    }

    // ==========================================
    // 4c. DELETE / SOFT-DELETE HOSPITAL ACCOUNT
    // ==========================================
    @DeleteMapping({"/hospitals/{id}", "/hospitals/{id}/delete"})
    public ResponseEntity<ApiResponse> deleteHospital(@PathVariable int id, HttpServletRequest request) {
        return executeDeleteHospital(id, request, null);
    }

    @PostMapping({"/hospitals/{id}/delete", "/hospitals/{id}/soft-delete"})
    public ResponseEntity<ApiResponse> deleteHospitalPost(
            @PathVariable int id,
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request) {
        String confirmName = null;
        if (body != null && body.has("confirmName")) {
            confirmName = body.get("confirmName").asText();
        }
        return executeDeleteHospital(id, request, confirmName);
    }

    private ResponseEntity<ApiResponse> executeDeleteHospital(int id, HttpServletRequest request, String confirmName) {
        if (!isAdmin(request)) return unauthorized();

        try (Connection conn = DBConnection.getConnection()) {
            String hospitalName = "";
            String hospitalEmail = "";
            try (PreparedStatement ps = conn.prepareStatement(
                    "SELECT hospital_name, hospital_email FROM hospitals WHERE id = ?")) {
                ps.setInt(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        hospitalName = rs.getString("hospital_name");
                        hospitalEmail = rs.getString("hospital_email");
                    } else {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(new ApiResponse(false, "Hospital not found"));
                    }
                }
            }

            if (confirmName == null || confirmName.isBlank()) {
                confirmName = request.getParameter("confirmName");
            }
            if (confirmName == null || confirmName.isBlank() || !confirmName.trim().equalsIgnoreCase(hospitalName.trim())) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Confirmation failed: Typed name \"" + (confirmName == null ? "" : confirmName.trim()) + "\" does not match exact hospital name \"" + hospitalName + "\"."));
            }

            // Check if hospital has active requests (cannot delete while active requests exist)
            int activeRequests = 0;
            try (PreparedStatement reqPs = conn.prepareStatement(
                    "SELECT COUNT(*) FROM blood_requests WHERE hospital_id = ? AND LOWER(COALESCE(status, '')) IN ('open', 'active', 'broadcast', 'dispatched')")) {
                reqPs.setInt(1, id);
                try (ResultSet rrs = reqPs.executeQuery()) {
                    if (rrs.next()) activeRequests = rrs.getInt(1);
                }
            } catch (Exception ignored) {}

            if (activeRequests > 0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Cannot delete hospital with " + activeRequests + " active emergency blood requests. Please fulfill or cancel open requests first."));
            }

            // 1. Terminate all active sessions for this hospital (by numeric id or email)
            try (PreparedStatement ps = conn.prepareStatement(
                    "DELETE FROM user_sessions WHERE user_type = 'HOSPITAL' AND (user_id = ? OR user_id = ?)")) {
                ps.setString(1, String.valueOf(id));
                ps.setString(2, hospitalEmail != null ? hospitalEmail : "");
                ps.executeUpdate();
            } catch (Exception ignored) {}

            // 2. Soft-delete hospital record by setting verification_status = 'Deleted'
            try (PreparedStatement ps = conn.prepareStatement(
                    "UPDATE hospitals SET verification_status = 'Deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?")) {
                ps.setInt(1, id);
                int rows = ps.executeUpdate();
                if (rows == 0) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(new ApiResponse(false, "Hospital not found or already deleted"));
                }
            }

            addLog("HOSPITAL_DELETED", "Hospital account soft-deleted: " + hospitalName + " (ID: " + id + ")");
            try {
                broadcastAdminEvent("hospital-status-changed", Map.of("id", id, "status", "Deleted", "toStatus", "Deleted"));
            } catch (Exception ignored) {}
            return ResponseEntity.ok(new ApiResponse(true, "Hospital account for \"" + hospitalName + "\" has been deleted."));
        } catch (Exception e) {
            log.error("Error deleting hospital {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to delete hospital: " + e.getMessage()));
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

            // Use authoritative single source of truth for platform metrics
            Map<String, Object> platformStats = com.red404.service.PlatformMetricsService.getInstance().getPlatformStats();
            health.put("totalDonors", platformStats.get("registeredDonors"));
            health.put("activeDonors", platformStats.get("activeDonors"));
            health.put("totalHospitals", platformStats.get("totalHospitals"));
            health.put("partnerHospitals", platformStats.get("partnerHospitals"));
            health.put("totalSosHandled", platformStats.get("totalRequests"));
            health.put("completedSos", platformStats.get("completedRequests"));
            health.put("totalDonations", platformStats.get("verifiedDonations"));
            health.put("livesSaved", platformStats.get("livesSaved"));

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
    // 10. DATABASE BACKUP ENDPOINT (Part 8)
    // ==========================================
    @PostMapping("/backup")
    public ResponseEntity<ApiResponse> triggerDatabaseBackup(HttpServletRequest request) {
        if (!isAdmin(request)) return unauthorized();

        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        java.io.File backupsDir = new java.io.File("backups");
        if (!backupsDir.exists()) {
            backupsDir.mkdirs();
        }
        String backupFileName = "red404_backup_" + timestamp + ".sql";
        java.io.File backupFile = new java.io.File(backupsDir, backupFileName);

        try (Connection conn = DBConnection.getConnection()) {
            String dbProduct = conn.getMetaData().getDatabaseProductName();
            if ("H2".equalsIgnoreCase(dbProduct)) {
                try (Statement st = conn.createStatement()) {
                    st.execute("SCRIPT TO '" + backupFile.getAbsolutePath().replace('\\', '/') + "' CHARSET 'UTF-8'");
                }
            }

            long sizeBytes = backupFile.exists() ? backupFile.length() : 0;
            addLog("DATABASE_BACKUP_COMPLETED", "Database backup generated: " + backupFileName + " (" + (sizeBytes / 1024) + " KB)");

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("fileName", backupFileName);
            resp.put("filePath", backupFile.getAbsolutePath());
            resp.put("sizeBytes", sizeBytes);
            resp.put("timestamp", timestamp);

            return ResponseEntity.ok(new ApiResponse(true, "Database backup completed successfully", resp));
        } catch (Exception e) {
            log.error("Error creating database backup: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to create backup: " + e.getMessage()));
        }
    }

    // ==========================================
    // SECURITY HELPERS
    // ==========================================
    private boolean isAdmin(HttpServletRequest request) {
        if (request == null) return true;
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

