package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.DonorDao;
import com.red404.dao.SessionDao;
import com.red404.model.ApiResponse;
import com.red404.util.GeoLocationUtil;
import com.red404.util.JsonUtil;
import com.red404.util.UserAgentUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final DonorDao donorDao = new DonorDao();
    private final SessionDao sessionDao = new SessionDao();

    // ============================================================
    // SECTION 1: ACCOUNT SECURITY (CHANGE PASSWORD)
    // ============================================================

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request, body);
            if (donor == null || donor.get("id") == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to change password."));
            }

            int donorId = ((Number) donor.get("id")).intValue();
            String currentPassword = JsonUtil.text(body, "currentPassword").trim();
            String newPassword = JsonUtil.text(body, "newPassword").trim();
            String confirmPassword = JsonUtil.text(body, "confirmPassword").trim();

            if (currentPassword.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Current password is required."));
            }
            if (newPassword.length() < 6) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "New password must be at least 6 characters."));
            }
            if (!confirmPassword.isEmpty() && !newPassword.equals(confirmPassword)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "New passwords do not match."));
            }

            boolean updated = donorDao.updatePassword(donorId, currentPassword, newPassword);
            if (updated) {
                return ResponseEntity.ok(new ApiResponse(true,
                        "Password updated successfully with BCrypt encryption. Old credentials invalidated.", null));
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Current password does not match our records."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error updating password: " + e.getMessage()));
        }
    }

    // ============================================================
    // SECTION 2: ACTIVE SESSIONS (REAL-TIME LOGIN HISTORY)
    // ============================================================

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse> getActiveSessions(HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request, null);
            if (donor == null || donor.get("id") == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required."));
            }
            int donorId = ((Number) donor.get("id")).intValue();
            HttpSession session = request.getSession(true);
            String currentSid = session != null ? session.getId() : "";

            List<Map<String, Object>> sessions = sessionDao.getActiveSessions(donorId, "DONOR", currentSid);
            if (sessions.isEmpty()) {
                String clientIp = GeoLocationUtil.getClientIp(request);
                String userAgent = request.getHeader("User-Agent");
                String device = UserAgentUtil.parseDevice(userAgent);
                String browser = UserAgentUtil.parseBrowser(userAgent);
                String location = GeoLocationUtil.resolveLocation(clientIp);
                String sid = (currentSid != null && !currentSid.isBlank()) ? currentSid : "SESS-" + donorId + "-" + System.currentTimeMillis();
                sessionDao.recordSession(sid, donorId, "DONOR", clientIp, userAgent, device, browser, location);
                sessions = sessionDao.getActiveSessions(donorId, "DONOR", sid);
            }
            return ResponseEntity.ok(new ApiResponse(true, "Active sessions retrieved.", sessions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to load active sessions: " + e.getMessage()));
        }
    }

    @PostMapping("/sessions/kill")
    public ResponseEntity<ApiResponse> killSession(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request, body);
            if (donor == null || donor.get("id") == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required."));
            }
            int donorId = ((Number) donor.get("id")).intValue();
            String targetSessionId = JsonUtil.text(body, "sessionId").trim();

            if (targetSessionId.isEmpty()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Session ID is required."));
            }

            boolean killed = sessionDao.killSession(donorId, "DONOR", targetSessionId);

            // If user revoked their own current session, invalidate it
            HttpSession session = request.getSession(false);
            if (session != null && session.getId().equals(targetSessionId)) {
                session.invalidate();
            }

            if (killed) {
                return ResponseEntity.ok(new ApiResponse(true, "Session terminated successfully.", null));
            } else {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Session not found or already terminated."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to terminate session: " + e.getMessage()));
        }
    }

    @PostMapping("/sessions/kill-others")
    public ResponseEntity<ApiResponse> killAllOtherSessions(HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request, null);
            if (donor == null || donor.get("id") == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required."));
            }
            int donorId = ((Number) donor.get("id")).intValue();
            HttpSession session = request.getSession(false);
            String currentSid = session != null ? session.getId() : "";

            boolean success = sessionDao.killAllExceptCurrent(donorId, "DONOR", currentSid);
            if (success) {
                return ResponseEntity.ok(new ApiResponse(true, "Logged out of all other devices successfully.", null));
            } else {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Failed to terminate other sessions."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Error: " + e.getMessage()));
        }
    }

    // ============================================================
    // SECTION 3: DANGER ZONE (HARD DELETE ACCOUNT)
    // ============================================================

    @RequestMapping(value = "/delete-account", method = {RequestMethod.POST, RequestMethod.DELETE})
    public ResponseEntity<ApiResponse> deleteAccount(
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request, body);
            int donorId = donor != null && donor.get("id") != null ? ((Number) donor.get("id")).intValue() : 0;
            String donorEmail = donor != null && donor.get("email") != null ? donor.get("email").toString() : null;
            String donorPhone = donor != null && donor.get("phone") != null ? donor.get("phone").toString() : null;

            if (donorId <= 0 && body != null) {
                donorId = JsonUtil.asInt(body, "donorId", 0);
                if (donorId <= 0) donorId = JsonUtil.asInt(body, "id", 0);
            }
            if ((donorEmail == null || donorEmail.isBlank()) && body != null) {
                donorEmail = JsonUtil.text(body, "email");
            }
            if ((donorPhone == null || donorPhone.isBlank()) && body != null) {
                donorPhone = JsonUtil.text(body, "phone");
            }

            if (donorId <= 0 && (donorEmail == null || donorEmail.isBlank())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to delete account."));
            }

            boolean deleted = donorDao.hardDeleteDonor(donorId, donorEmail, donorPhone);
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }

            ResponseCookie clearCookie = ResponseCookie.from("JSESSIONID", "")
                    .path("/")
                    .maxAge(0)
                    .httpOnly(true)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, clearCookie.toString());

            return ResponseEntity.ok(new ApiResponse(true, "Account and all associated records permanently deleted.", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Account deletion failed: " + e.getMessage()));
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getAuthenticatedDonor(HttpServletRequest request, JsonNode body) {
        // 1. Check existing HTTP session
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute("user");
            if (user instanceof Map<?, ?> map && map.get("id") != null) {
                return (Map<String, Object>) map;
            }
        }

        // 2. Check headers
        String donorIdHeader = request.getHeader("X-Donor-Id");
        String donorEmailHeader = request.getHeader("X-Donor-Email");
        String authHeader = request.getHeader("Authorization");

        // 3. Check JSON body
        if ((donorIdHeader == null || donorIdHeader.isBlank()) && body != null) {
            int bodyId = JsonUtil.asInt(body, "donorId", 0);
            if (bodyId <= 0) bodyId = JsonUtil.asInt(body, "id", 0);
            if (bodyId > 0) donorIdHeader = String.valueOf(bodyId);
        }
        if ((donorEmailHeader == null || donorEmailHeader.isBlank()) && body != null) {
            String bEmail = JsonUtil.text(body, "email");
            if (!bEmail.isBlank()) donorEmailHeader = bEmail;
        }

        // 4. Check query params
        if (donorIdHeader == null || donorIdHeader.isBlank()) {
            donorIdHeader = request.getParameter("donorId");
        }
        if (donorEmailHeader == null || donorEmailHeader.isBlank()) {
            donorEmailHeader = request.getParameter("email");
        }

        Map<String, Object> donor = null;

        // Resolve by ID
        if (donorIdHeader != null && !donorIdHeader.isBlank()) {
            try {
                int id = Integer.parseInt(donorIdHeader.trim());
                if (id > 0) {
                    donor = donorDao.findById(id);
                }
            } catch (Exception ignored) {}
        }

        // Resolve by Email
        if (donor == null && donorEmailHeader != null && !donorEmailHeader.isBlank()) {
            try {
                donor = donorDao.findByEmail(donorEmailHeader.trim().toLowerCase());
            } catch (Exception ignored) {}
        }

        // Resolve by Token (Bearer <token>)
        if (donor == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (!token.isBlank()) {
                try {
                    donor = donorDao.findByToken(token);
                } catch (Exception ignored) {}
            }
        }

        // If found, re-bind to HTTP session
        if (donor != null) {
            HttpSession newSession = request.getSession(true);
            newSession.setAttribute("user", donor);
            newSession.setAttribute("role", "DONOR");
        }

        return donor;
    }
}
