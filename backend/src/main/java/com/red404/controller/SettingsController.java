package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.config.RoleSessionManager;
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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
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
            if (newPassword.length() < 8) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "New password must be at least 8 characters."));
            }
            if (com.red404.util.PasswordUtil.isCommonPassword(newPassword) || com.red404.util.SecurityValidationUtil.isCommonPassword(newPassword)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "The password you entered is too common. Please choose a more secure password."));
            }
            if (!confirmPassword.isEmpty() && !newPassword.equals(confirmPassword)) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "New passwords do not match."));
            }

            boolean updated = donorDao.updatePassword(donorId, currentPassword, newPassword);
            if (updated) {
                RoleSessionManager.invalidateDonorSessions(donorId);
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
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            int numericId = ((Number) donor.get("id")).intValue();
            HttpSession session = request.getSession(true);
            String currentSid = session != null ? session.getId() : "";

            String clientLoc = request.getHeader("X-Client-Location");
            if (clientLoc == null || clientLoc.isBlank() || clientLoc.toLowerCase().contains("ozar")) {
                if (donor.get("city") != null && !donor.get("city").toString().isBlank()) {
                    clientLoc = donor.get("city").toString();
                    if (donor.get("state") != null && !donor.get("state").toString().isBlank()) {
                        clientLoc += ", " + donor.get("state").toString();
                    } else {
                        clientLoc += ", India";
                    }
                }
            }

            List<Map<String, Object>> sessions = sessionDao.getActiveSessions(donorIdStr, "DONOR", currentSid);
            if (sessions.isEmpty()) {
                String clientIp = GeoLocationUtil.getClientIp(request);
                String userAgent = request.getHeader("User-Agent");
                String device = UserAgentUtil.parseDevice(userAgent);
                String browser = UserAgentUtil.parseBrowser(userAgent);
                String location = (clientLoc != null && !clientLoc.isBlank()) ? clientLoc : GeoLocationUtil.resolveLocation(clientIp);
                String sid = (currentSid != null && !currentSid.isBlank()) ? currentSid : "SESS-" + donorIdStr + "-" + System.currentTimeMillis();
                sessionDao.recordSession(sid, donorIdStr, "DONOR", clientIp, userAgent, device, browser, location);
                sessions = sessionDao.getActiveSessions(donorIdStr, "DONOR", sid);
            } else if (clientLoc != null && !clientLoc.isBlank()) {
                for (Map<String, Object> s : sessions) {
                    if (Boolean.TRUE.equals(s.get("isCurrent"))) {
                        String existingLoc = (String) s.get("location");
                        if (existingLoc == null || existingLoc.isBlank() || existingLoc.toLowerCase().contains("ozar") || existingLoc.equalsIgnoreCase("india")) {
                            s.put("location", clientLoc);
                            String sid = (String) s.get("sessionId");
                            if (sid != null) {
                                sessionDao.updateSessionLocation(sid, clientLoc);
                            }
                        }
                    }
                }
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
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            String targetSessionId = JsonUtil.text(body, "sessionId").trim();

            if (targetSessionId.isEmpty()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Session ID is required."));
            }

            boolean killed = sessionDao.killSession(donorIdStr, "DONOR", targetSessionId);

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
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            HttpSession session = request.getSession(false);
            String currentSid = session != null ? session.getId() : "";

            boolean success = sessionDao.killAllExceptCurrent(donorIdStr, "DONOR", currentSid);
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

    @GetMapping("/download-data")
    public ResponseEntity<?> downloadData(HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to download data."));
            }
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            Map<String, Object> fresh = donorDao.findByIdOrDonorId(donorIdStr);
            if (fresh == null) fresh = donor;

            Map<String, Object> export = new LinkedHashMap<>();
            export.put("exportTimestamp", java.time.Instant.now().toString());
            export.put("donorId", donorIdStr);
            export.put("name", fresh.get("name"));
            export.put("email", fresh.get("email"));
            export.put("phone", fresh.get("phone"));
            export.put("bloodType", fresh.get("bloodType") != null ? fresh.get("bloodType") : fresh.get("blood_type"));
            export.put("bloodGroupStatus", fresh.get("bloodGroupStatus") != null ? fresh.get("bloodGroupStatus") : fresh.get("blood_group_status"));
            export.put("gender", fresh.get("gender"));
            export.put("dob", fresh.get("dob"));
            export.put("weightKg", fresh.get("weight"));
            export.put("availability", fresh.get("availability"));
            export.put("city", fresh.get("city"));
            export.put("state", fresh.get("state"));
            export.put("pincode", fresh.get("pincode"));

            // Decrypt health questionnaire responses
            String encHealth = (String) fresh.get("health_answers_json");
            if (encHealth == null) encHealth = (String) fresh.get("healthAnswersJson");
            if (encHealth != null) {
                export.put("healthAnswers", com.red404.util.AesGcmEncryptionUtil.decrypt(encHealth));
            }

            // Consents
            try {
                com.red404.dao.ConsentDao consentDao = new com.red404.dao.ConsentDao();
                export.put("consents", consentDao.getConsents("DONOR", donorIdStr));
            } catch (Exception ignored) {}

            // Donation history
            try {
                export.put("donations", donorDao.donationHistory(donorIdStr));
            } catch (Exception ignored) {}

            byte[] jsonBytes = com.red404.util.JsonUtil.mapper().writerWithDefaultPrettyPrinter().writeValueAsBytes(export);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setContentLength(jsonBytes.length);
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"red404_donor_export_" + donorIdStr + ".json\"");
            return new ResponseEntity<>(jsonBytes, headers, HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Failed to export donor data: " + e.getMessage()));
        }
    }

    @RequestMapping(value = "/delete-account", method = {RequestMethod.POST, RequestMethod.DELETE})
    public ResponseEntity<ApiResponse> deleteAccount(
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to delete account."));
            }
            String donorIdStr = donor.get("donorId") != null ? donor.get("donorId").toString() : donor.get("id").toString();
            String donorEmail = donor.get("email") != null ? donor.get("email").toString() : null;
            String donorPhone = donor.get("phone") != null ? donor.get("phone").toString() : null;

            // IDOR Protection: If body provides donorId or email, verify it matches
            if (body != null) {
                String bDonorId = JsonUtil.text(body, "donorId");
                if (bDonorId.isBlank()) bDonorId = JsonUtil.text(body, "id");
                if (!bDonorId.isBlank() && !bDonorId.equalsIgnoreCase(donorIdStr) && !bDonorId.equals(String.valueOf(donor.get("id")))) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse(false, "Forbidden: Cannot delete another user's account."));
                }
                String bEmail = JsonUtil.text(body, "email");
                if (!bEmail.isBlank() && donorEmail != null && !bEmail.equalsIgnoreCase(donorEmail)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse(false, "Forbidden: Cannot delete another user's account."));
                }
            }

            boolean deleted = donorDao.hardDeleteDonor(donorIdStr, donorEmail, donorPhone);

            // Invalidate session and cookie
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            if (donor.get("id") instanceof Number n) {
                com.red404.config.RoleSessionManager.invalidateDonorSessions(n.intValue());
            }

            com.red404.config.RoleSessionManager.clearRoleCookie(response, com.red404.config.RoleSessionManager.Role.DONOR.cookieName, RoleSessionManager.isConnectionSecure(request));

            ResponseCookie clearCookie1 = ResponseCookie.from("RED404_SESSION", "")
                    .path("/")
                    .maxAge(0)
                    .httpOnly(true)
                    .build();
            ResponseCookie clearCookie2 = ResponseCookie.from("JSESSIONID", "")
                    .path("/")
                    .maxAge(0)
                    .httpOnly(true)
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, clearCookie1.toString());
            response.addHeader(HttpHeaders.SET_COOKIE, clearCookie2.toString());

            return ResponseEntity.ok(new ApiResponse(true, "Account and personal identifying records permanently anonymized and deleted.", null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Account deletion failed: " + e.getMessage()));
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getAuthenticatedDonor(HttpServletRequest request) {
        if (request == null) return null;
        // 1. Check existing HTTP session
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object user = session.getAttribute("user");
            if (user instanceof Map<?, ?> map && (map.get("id") != null || map.get("donorId") != null)) {
                return (Map<String, Object>) map;
            }
        }

        // 2. Check Authorization header or X-Red404-Token
        String authHeader = request.getHeader("Authorization");
        String token = request.getHeader("X-Red404-Token");
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
        if (token != null && !token.isBlank()) {
            if (token.startsWith("SESSION-DONOR-")) {
                String dStr = token.substring("SESSION-DONOR-".length()).trim();
                try {
                    return donorDao.findByIdOrDonorId(dStr);
                } catch (Exception ignored) {}
            }
            try {
                return donorDao.findByToken(token);
            } catch (Exception ignored) {}
        }

        return null;
    }

    private Map<String, Object> getAuthenticatedDonor(HttpServletRequest request, JsonNode body) {
        return getAuthenticatedDonor(request);
    }
}
