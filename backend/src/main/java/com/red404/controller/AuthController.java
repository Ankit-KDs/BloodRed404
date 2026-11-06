package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.model.ApiResponse;
import com.red404.util.JsonUtil;
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

    @GetMapping("/check-session")
    public ResponseEntity<ApiResponse> checkSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "No active session"));
        }
        Object user = session.getAttribute("user");
        Object hospital = session.getAttribute("hospitalUser");
        if (user == null && hospital == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse(false, "No active session"));
        }
        Map<String, Object> data = new HashMap<>();
        data.put("role", session.getAttribute("role"));
        data.put("donor", user);
        data.put("hospital", hospital);
        if (user instanceof Map<?, ?> donor) {
            data.put("donorId", ((Map<?, ?>) donor).get("id"));
            data.put("name", ((Map<?, ?>) donor).get("name"));
            data.put("email", ((Map<?, ?>) donor).get("email"));
        }
        return ResponseEntity.ok(new ApiResponse(true, "Session active", data));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
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

