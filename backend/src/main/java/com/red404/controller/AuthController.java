package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.SessionDao;
import com.red404.model.ApiResponse;
import com.red404.util.GeoLocationUtil;
import com.red404.util.JsonUtil;
import com.red404.util.UserAgentUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SessionDao sessionDao = new SessionDao();

    @GetMapping("/check-session")
    public ResponseEntity<ApiResponse> checkSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "No active session"));
        }

        // Check if session was terminated from another device
        if (!sessionDao.isSessionActive(session.getId())) {
            session.invalidate();
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "Session was terminated from another device. Please log in again."));
        }

        Object user = session.getAttribute("user");
        Object hospital = session.getAttribute("hospitalUser");
        if (user == null && hospital == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "No active session"));
        }

        // Touch active session & ensure record exists
        sessionDao.touchSession(session.getId());
        try {
            int uid = 0;
            String type = "DONOR";
            if (user instanceof Map<?, ?> donor && donor.get("id") != null) {
                uid = ((Number) donor.get("id")).intValue();
                type = "DONOR";
            } else if (hospital instanceof Map<?, ?> h && h.get("id") != null) {
                uid = ((Number) h.get("id")).intValue();
                type = "HOSPITAL";
            }
            if (uid > 0) {
                String ip = GeoLocationUtil.getClientIp(request);
                String ua = request.getHeader("User-Agent");
                String device = UserAgentUtil.parseDevice(ua);
                String browser = UserAgentUtil.parseBrowser(ua);
                String location = GeoLocationUtil.resolveLocation(ip);
                sessionDao.recordSession(session.getId(), uid, type, ip, ua, device, browser, location);
            }
        } catch (Exception ignored) {}

        Map<String, Object> data = new HashMap<>();
        data.put("role", session.getAttribute("role"));
        data.put("donor", user);
        data.put("hospital", hospital);
        if (user instanceof Map<?, ?> donor) {
            Object sId = ((Map<?, ?>) donor).get("donor_id");
            if (sId == null) sId = ((Map<?, ?>) donor).get("donorId");
            if (sId == null) sId = ((Map<?, ?>) donor).get("id");
            data.put("donorId", sId);
            data.put("donor_id", sId);
            data.put("name", ((Map<?, ?>) donor).get("name"));
            data.put("email", ((Map<?, ?>) donor).get("email"));
        }
        return ResponseEntity.ok(new ApiResponse(true, "Session active", data));
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
        return ResponseEntity.ok(new ApiResponse(true, "Logged out", null));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse> forgotPassword(@RequestBody JsonNode body) {
        String email = JsonUtil.text(body, "email");
        return ResponseEntity.ok(new ApiResponse(true,
                "If that email is registered, a reset link will be sent to " + email, null));
    }
}

