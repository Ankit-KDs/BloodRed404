package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.DonorDao;
import com.red404.dao.SessionDao;
import com.red404.model.ApiResponse;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
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
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
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
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required."));
            }
            int donorId = ((Number) donor.get("id")).intValue();
            HttpSession session = request.getSession(false);
            String currentSid = session != null ? session.getId() : "";

            List<Map<String, Object>> sessions = sessionDao.getActiveSessions(donorId, "DONOR", currentSid);
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
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
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
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
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
    public ResponseEntity<ApiResponse> deleteAccount(HttpServletRequest request) {
        try {
            Map<String, Object> donor = getAuthenticatedDonor(request);
            if (donor == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required."));
            }
            int donorId = ((Number) donor.get("id")).intValue();

            boolean deleted = donorDao.hardDeleteDonor(donorId);
            if (deleted) {
                HttpSession session = request.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
                return ResponseEntity.ok(new ApiResponse(true, "Account and all associated records permanently deleted.", null));
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(new ApiResponse(false, "Failed to delete account. Please try again."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse(false, "Account deletion failed: " + e.getMessage()));
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getAuthenticatedDonor(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object user = session.getAttribute("user");
        if (user instanceof Map<?, ?>) {
            return (Map<String, Object>) user;
        }
        return null;
    }
}
