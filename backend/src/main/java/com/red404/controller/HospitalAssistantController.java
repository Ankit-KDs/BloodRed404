package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.HospitalDao;
import com.red404.model.ApiResponse;
import com.red404.service.HospitalAssistantService;
import com.red404.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Controller for Hospital Assistant Tools.
 *
 * CRITICAL SECURITY & ACCESS CONSTRAINTS:
 * 1. Read-only assistant: no send, broadcast, cancel, stock edit, or mutation tools.
 * 2. Hospital ID is taken STRICTLY from the authenticated server session, NEVER from request params or client body.
 * 3. Logged-in staff user of a VERIFIED hospital required for all tools, otherwise HTTP 403 Forbidden.
 * 4. Rate-limited and audited without storing raw text or PII.
 */
@RestController
@RequestMapping("/api/hospital/assistant")
public class HospitalAssistantController {

    private static final Logger log = LoggerFactory.getLogger(HospitalAssistantController.class);

    private final HospitalDao hospitalDao = new HospitalDao();

    @Autowired
    private HospitalAssistantService assistantService;

    /**
     * Session and Verification Guard:
     * Returns the verified hospitalId if authorized, or throws a SecurityException / returns null.
     */
    private Integer extractVerifiedHospitalId(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Map<String, Object> sessionHosp = session != null ? (Map<String, Object>) session.getAttribute("hospitalUser") : null;

        Integer hospitalId = null;
        if (sessionHosp != null && sessionHosp.get("id") instanceof Number num) {
            hospitalId = num.intValue();
        } else {
            // Check session bearer token
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

        // Verify hospital exists and is verified
        try {
            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return null;

            String status = (String) hosp.get("verificationStatus");
            if (status == null) status = (String) hosp.get("verification_status");
            if (status == null || !"verified".equalsIgnoreCase(status.trim())) {
                return -1; // Indicates hospital exists but is not verified
            }
            return hospitalId;
        } catch (Exception e) {
            log.error("Error checking hospital verification: {}", e.getMessage());
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

    private ResponseEntity<ApiResponse> handleUnauthorizedOrForbidden(Integer check) {
        if (check != null && check == -1) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("error", "Hospital account requires accreditation verification before accessing the assistant.");
            err.put("code", "hospital_not_verified");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse(false, "Hospital is not verified.", "Hospital is not verified.", "hospital_not_verified", err));
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiResponse(false, "Access denied. Only logged-in staff of verified hospitals can access this assistant.", "Access denied", "unauthorized", null));
    }

    /**
     * Tool 1: donor_availability
     * Aggregates only. Zero personal details, IDs, phones, addresses, coordinates.
     */
    @RequestMapping(value = {"/tool/donor-availability", "/tool/donor_availability"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ApiResponse> toolDonorAvailability(
            @RequestParam(required = false) String bloodGroup,
            @RequestParam(required = false, defaultValue = "10") Double radiusKm,
            @RequestParam(required = false, defaultValue = "true") Boolean includeCompatible,
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request) {

        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            return handleUnauthorizedOrForbidden(hospitalId);
        }

        String userIdentifier = extractUserIdentifier(request);
        RateLimitService.RateLimitResult rl = assistantService.checkToolRateLimits(hospitalId, userIdentifier);
        if (!rl.allowed) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiResponse(false, "Assistant rate limit exceeded. Please try again in a few moments.", "Rate limit exceeded", "rate_limited", null));
        }

        // Parse params from query or JSON body
        String bg = bloodGroup;
        Double rad = radiusKm;
        Boolean inc = includeCompatible;

        if (body != null) {
            if (body.has("bloodGroup")) bg = body.get("bloodGroup").asText();
            else if (body.has("blood_group")) bg = body.get("blood_group").asText();

            if (body.has("radiusKm")) rad = body.get("radiusKm").asDouble();
            else if (body.has("radius_km")) rad = body.get("radius_km").asDouble();

            if (body.has("includeCompatible")) inc = body.get("includeCompatible").asBoolean();
            else if (body.has("include_compatible")) inc = body.get("include_compatible").asBoolean();
        }

        if (bg == null || bg.isBlank()) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, "Blood group parameter is required."));
        }

        try {
            Map<String, Object> result = assistantService.donorAvailability(hospitalId, bg, rad != null ? rad : 10.0, inc != null ? inc : true);

            // Audit
            assistantService.recordToolAudit(hospitalId, userIdentifier, "donor_availability",
                    Map.of("bloodGroup", bg, "radiusKm", rad != null ? rad : 10.0, "includeCompatible", inc != null ? inc : true),
                    Map.of("totalEligible", result.get("totalEligible"), "notAvailableTotal", result.get("notAvailableTotal")));

            return ResponseEntity.ok(new ApiResponse(true, "Donor availability retrieved successfully", result));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        } catch (SQLException e) {
            log.error("Database error in donor_availability tool: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiResponse(false, "Internal database error"));
        }
    }

    /**
     * Tool 2: get_stock
     * This hospital's 8 groups with units, Critical/Low/OK status by shared thresholds, updated_at.
     */
    @RequestMapping(value = {"/tool/get-stock", "/tool/get_stock"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ApiResponse> toolGetStock(HttpServletRequest request) {
        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            return handleUnauthorizedOrForbidden(hospitalId);
        }

        String userIdentifier = extractUserIdentifier(request);
        RateLimitService.RateLimitResult rl = assistantService.checkToolRateLimits(hospitalId, userIdentifier);
        if (!rl.allowed) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiResponse(false, "Assistant rate limit exceeded. Please wait.", "Rate limit exceeded", "rate_limited", null));
        }

        try {
            Map<String, Object> result = assistantService.getStock(hospitalId);

            assistantService.recordToolAudit(hospitalId, userIdentifier, "get_stock", Map.of(), Map.of());

            return ResponseEntity.ok(new ApiResponse(true, "Hospital inventory stock retrieved successfully", result));
        } catch (SQLException e) {
            log.error("Database error in get_stock tool: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiResponse(false, "Internal database error"));
        }
    }

    /**
     * Tool 3: active_requests
     * This hospital's active requests: id, blood group, units, urgency, status, counts, time left.
     */
    @RequestMapping(value = {"/tool/active-requests", "/tool/active_requests"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ApiResponse> toolActiveRequests(HttpServletRequest request) {
        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            return handleUnauthorizedOrForbidden(hospitalId);
        }

        String userIdentifier = extractUserIdentifier(request);
        RateLimitService.RateLimitResult rl = assistantService.checkToolRateLimits(hospitalId, userIdentifier);
        if (!rl.allowed) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiResponse(false, "Assistant rate limit exceeded. Please wait.", "Rate limit exceeded", "rate_limited", null));
        }

        try {
            Map<String, Object> result = assistantService.activeRequests(hospitalId);

            assistantService.recordToolAudit(hospitalId, userIdentifier, "active_requests", Map.of(),
                    Map.of("totalActive", result.get("totalActive")));

            return ResponseEntity.ok(new ApiResponse(true, "Active requests retrieved successfully", result));
        } catch (SQLException e) {
            log.error("Database error in active_requests tool: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiResponse(false, "Internal database error"));
        }
    }

    /**
     * Tool 4: prepare_search
     * Prefill payload for Find Donors form. Sends nothing. Never accepts free text.
     */
    @RequestMapping(value = {"/tool/prepare-search", "/tool/prepare_search"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ApiResponse> toolPrepareSearch(
            @RequestParam(required = false) String bloodGroup,
            @RequestParam(required = false, defaultValue = "10") Integer radiusKm,
            @RequestParam(required = false, defaultValue = "true") Boolean includeCompatible,
            @RequestParam(required = false, defaultValue = "1") Integer units,
            @RequestParam(required = false, defaultValue = "NORMAL") String urgency,
            @RequestParam(required = false) Integer neededWithinMinutes,
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request) {

        Integer hospitalId = extractVerifiedHospitalId(request);
        if (hospitalId == null || hospitalId <= 0) {
            return handleUnauthorizedOrForbidden(hospitalId);
        }

        String userIdentifier = extractUserIdentifier(request);
        RateLimitService.RateLimitResult rl = assistantService.checkToolRateLimits(hospitalId, userIdentifier);
        if (!rl.allowed) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(new ApiResponse(false, "Assistant rate limit exceeded. Please wait.", "Rate limit exceeded", "rate_limited", null));
        }

        String bg = bloodGroup;
        Integer rad = radiusKm;
        Boolean inc = includeCompatible;
        Integer u = units;
        String urg = urgency;
        Integer needed = neededWithinMinutes;

        if (body != null) {
            if (body.has("bloodGroup")) bg = body.get("bloodGroup").asText();
            else if (body.has("blood_group")) bg = body.get("blood_group").asText();

            if (body.has("radiusKm")) rad = body.get("radiusKm").asInt();
            else if (body.has("radius_km")) rad = body.get("radius_km").asInt();

            if (body.has("includeCompatible")) inc = body.get("includeCompatible").asBoolean();
            else if (body.has("include_compatible")) inc = body.get("include_compatible").asBoolean();

            if (body.has("units")) u = body.get("units").asInt();
            else if (body.has("unitsNeeded")) u = body.get("unitsNeeded").asInt();

            if (body.has("urgency")) urg = body.get("urgency").asText();
            if (body.has("neededWithinMinutes")) needed = body.get("neededWithinMinutes").asInt();
        }

        Map<String, Object> result = assistantService.prepareSearch(bg, rad != null ? rad : 10, inc != null ? inc : true, u != null ? u : 1, urg, needed);

        assistantService.recordToolAudit(hospitalId, userIdentifier, "prepare_search",
                Map.of("bloodGroup", bg != null ? bg : "O+", "radiusKm", rad != null ? rad : 10), Map.of());

        return ResponseEntity.ok(new ApiResponse(true, "Search parameters prefilled successfully", result));
    }

    /**
     * Requirement 5: Generic Tool Dispatcher & Strict Read-Only Enforcer.
     * Rejects any write tool (send, broadcast, cancel, edit, etc.) with 403 Forbidden.
     */
    @PostMapping("/tool/{toolName}")
    public ResponseEntity<ApiResponse> dispatchTool(
            @PathVariable String toolName,
            @RequestBody(required = false) JsonNode body,
            HttpServletRequest request) {

        // Check if write tool attempt
        try {
            assistantService.validateReadOnlyTool(toolName);
        } catch (SecurityException se) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse(false, se.getMessage(), se.getMessage(), "forbidden_write_tool", null));
        }

        String clean = toolName.trim().toLowerCase();
        if ("donor_availability".equals(clean) || "donor-availability".equals(clean)) {
            return toolDonorAvailability(null, null, null, body, request);
        } else if ("get_stock".equals(clean) || "get-stock".equals(clean)) {
            return toolGetStock(request);
        } else if ("active_requests".equals(clean) || "active-requests".equals(clean)) {
            return toolActiveRequests(request);
        } else if ("prepare_search".equals(clean) || "prepare-search".equals(clean)) {
            return toolPrepareSearch(null, null, null, null, null, null, body, request);
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse(false, "Unknown tool: " + toolName));
        }
    }
}
