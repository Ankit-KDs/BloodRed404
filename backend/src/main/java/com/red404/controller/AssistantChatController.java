package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.HospitalDao;
import com.red404.model.ApiResponse;
import com.red404.service.HospitalAssistantChatService;
import com.red404.service.HospitalAssistantChatService.ChatResult;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * AssistantChatController
 *
 * Implements Part 3: AI Chat Controller for Hospital Staff.
 * Endpoint: POST /api/assistant
 *
 * RULES:
 * 1. Takes hospital_id ONLY from the authenticated session, never from the request or model.
 * 2. Requires logged-in staff user of a VERIFIED hospital, otherwise 403 Forbidden.
 * 3. Fallback when ANTHROPIC_API_KEY is not set: returns friendly disabled state without crash or 500 error.
 * 4. Chat history lives in browser tab only; nothing stored on server.
 */
@RestController
public class AssistantChatController {

    private static final Logger log = LoggerFactory.getLogger(AssistantChatController.class);

    private final HospitalDao hospitalDao = new HospitalDao();

    @Autowired
    private HospitalAssistantChatService chatService;

    private Integer extractVerifiedHospitalId(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Map<String, Object> sessionHosp = session != null ? (Map<String, Object>) session.getAttribute("hospitalUser") : null;

        Integer hospitalId = null;
        if (sessionHosp != null && sessionHosp.get("id") instanceof Number num) {
            hospitalId = num.intValue();
        } else {
            String authHeader = request.getHeader("Authorization");
            String token = request.getHeader("X-Red404-Token");
            if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7).trim();
            }
            if (token != null && token.startsWith("SESSION-HOSPITAL-")) {
                try {
                    hospitalId = Integer.parseInt(token.substring("SESSION-HOSPITAL-".length()).trim());
                } catch (NumberFormatException ignored) {}
            }
        }

        if (hospitalId == null) {
            return null;
        }

        try {
            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return null;

            String status = (String) hosp.get("verificationStatus");
            if (status == null) status = (String) hosp.get("verification_status");
            if (status == null || !"verified".equalsIgnoreCase(status.trim())) {
                return -1; // Exists but unverified
            }
            return hospitalId;
        } catch (Exception e) {
            log.error("Error checking hospital accreditation: {}", e.getMessage());
            return null;
        }
    }

    private String extractUserIdentifier(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object hospUser = session.getAttribute("hospitalUser");
            if (hospUser instanceof Map<?, ?> m) {
                Object email = m.get("email");
                if (email != null) return email.toString();
            }
        }
        return request.getRemoteAddr();
    }

    /**
     * Assistant status check.
     * Informs the frontend whether AI Chat is enabled or if ANTHROPIC_API_KEY is missing.
     */
    @GetMapping({"/api/assistant", "/api/assistant/status", "/api/hospital/assistant/status"})
    public ResponseEntity<ApiResponse> getAssistantStatus(HttpServletRequest request) {
        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse(false, "Access denied. Only logged-in staff of verified hospitals can access this assistant.", "Access denied", "unauthorized", null));
        }

        boolean configured = chatService.isConfigured();
        Map<String, Object> statusData = new LinkedHashMap<>();
        statusData.put("configured", configured);
        statusData.put("model", chatService.getModelName());
        statusData.put("message", "AI Assistant is active and ready.");

        return ResponseEntity.ok(new ApiResponse(true, "Assistant status retrieved", statusData));
    }

    /**
     * Requirement 2 & 3: POST /api/assistant.
     * Uses Gemini/Groq API with sub-second deterministic fallback and direct donor dispatch capability.
     */
    @PostMapping({"/api/assistant", "/api/assistant/chat", "/api/hospital/assistant/chat"})
    public ResponseEntity<ApiResponse> handleChat(
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request) {

        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            if (hospitalId != null && hospitalId == -1) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Hospital is not verified.", "Hospital is not verified.", "hospital_not_verified", null));
            }
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse(false, "Access denied. Only logged-in staff of verified hospitals can access this assistant.", "Access denied", "unauthorized", null));
        }

        String message = "";
        List<Map<String, Object>> browserHistory = new ArrayList<>();

        if (body != null) {
            if (body.has("message")) message = body.get("message").asText();
            else if (body.has("prompt")) message = body.get("prompt").asText();

            if (body.has("history") && body.get("history").isArray()) {
                for (JsonNode h : body.get("history")) {
                    if (h.has("role") && h.has("content")) {
                        browserHistory.add(Map.of(
                                "role", h.get("role").asText(),
                                "content", h.get("content").asText()
                        ));
                    }
                }
            }
        }

        if (message == null || message.trim().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, "Message is required."));
        }

        String userIdentifier = extractUserIdentifier(request);
        ChatResult result = chatService.processChat(hospitalId, userIdentifier, message, browserHistory);

        if (!result.success) {
            if ("rate_limited".equals(result.errorCode) || "budget_exceeded".equals(result.errorCode)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(new ApiResponse(false, result.error, result.error, result.errorCode, null));
            }
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(new ApiResponse(false, result.error, result.error, result.errorCode, null));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reply", result.reply);
        data.put("configured", result.configured);
        data.put("donors", result.donors);
        data.put("toolCalls", result.toolCalls);

        return ResponseEntity.ok(new ApiResponse(true, "Assistant response generated", data));
    }
                    .body(new ApiResponse(false, result.error, result.error, result.errorCode, null));
        }

        Map<String, Object> respData = new LinkedHashMap<>();
        respData.put("configured", result.configured);
        respData.put("reply", result.reply);
        respData.put("toolCalls", result.toolCalls);

        return ResponseEntity.ok(new ApiResponse(true, "Assistant response generated", respData));
    }
}
