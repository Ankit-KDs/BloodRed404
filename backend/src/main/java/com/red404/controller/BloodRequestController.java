package com.red404.controller;

import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.model.ApiResponse;
import com.red404.util.JsonUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping({"/api/requests", "/api/blood-requests"})
public class BloodRequestController {

    private final BloodRequestDao requestDao = new BloodRequestDao();
    private final com.red404.dao.HospitalDao hospitalDao = new com.red404.dao.HospitalDao();
    private final com.red404.dao.DonorDao donorDao = new com.red404.dao.DonorDao();

    // ======================== GET ========================

    @GetMapping({"", "/", "/active", "/blood-requests"})
    public ResponseEntity<ApiResponse> listRequests(
            @RequestParam(required = false) String hospitalId,
            HttpServletRequest request) {
        try {
            List<Map<String, Object>> list;
            if (hospitalId != null && !hospitalId.isBlank()) {
                list = requestDao.listByHospital(Integer.parseInt(hospitalId));
            } else {
                Integer sessionHospitalId = hospitalIdFromSession(request);
                list = sessionHospitalId == null
                        ? requestDao.listActive()
                        : requestDao.listByHospital(sessionHospitalId);
            }
            return ok("Requests fetched successfully", list);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/log")
    public ResponseEntity<ApiResponse> getLog() {
        try {
            return ok("Log loaded", requestDao.listActive());
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== POST ========================

    @PostMapping({"", "/", "/dispatch", "/blood-requests"})
    public ResponseEntity<ApiResponse> createRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            // Strictly require logged-in staff user of a VERIFIED hospital; unauthenticated and donor tokens get 403
            Integer sessionHospitalId = hospitalIdFromSession(request);
            if (sessionHospitalId == null || sessionHospitalId <= 0) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Forbidden: Only logged-in staff of a verified hospital can dispatch blood requests."));
            }

            Map<String, Object> hosp = hospitalDao.findById(sessionHospitalId);
            if (hosp == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Forbidden: Hospital account not found."));
            }
            String status = (String) hosp.get("verificationStatus");
            if (status == null) status = (String) hosp.get("verification_status");
            if (!"Verified".equalsIgnoreCase(status)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Forbidden: Only verified partner hospitals can broadcast blood requests. Current status: '" + status + "'."));
            }

            int hospitalId = sessionHospitalId;

            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            if (bloodType == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Blood type is required."));
            }
            Date requiredBefore = JsonUtil.asDate(body, "requiredBefore");
            if (requiredBefore == null) {
                requiredBefore = Date.valueOf(LocalDate.now().plusDays(1));
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("hospitalId", hospitalId);
            payload.put("patientName", JsonUtil.textOrNull(body, "patientName") == null ? "Emergency Patient" : JsonUtil.text(body, "patientName"));
            payload.put("bloodType", bloodType);
            payload.put("unitsRequested", JsonUtil.asInt(body, "unitsRequested", JsonUtil.asInt(body, "units", 1)));
            String urgency = JsonUtil.textOrNull(body, "urgencyLevel");
            if (urgency == null) {
                urgency = JsonUtil.textOrNull(body, "urgency");
            }
            payload.put("urgencyLevel", urgency == null ? "HIGH" : urgency);
            payload.put("requiredBefore", requiredBefore);
            payload.put("latitude", JsonUtil.asDouble(body, "latitude"));
            payload.put("longitude", JsonUtil.asDouble(body, "longitude"));
            int id = requestDao.insert(payload);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Emergency Blood Request Broadcasted Successfully!", Map.of("id", id)));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<ApiResponse> accept(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        try {
            Integer authenticatedDonorId = donorIdFromSession(request);
            if (authenticatedDonorId == null || authenticatedDonorId <= 0) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to accept request."));
            }
            if (body != null && body.containsKey("donorId") && body.get("donorId") != null) {
                try {
                    int bodyDonorId = Integer.parseInt(body.get("donorId").toString());
                    if (bodyDonorId > 0 && bodyDonorId != authenticatedDonorId) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new ApiResponse(false, "Forbidden: Cannot accept blood request for another donor."));
                    }
                } catch (NumberFormatException ignored) {}
            }
            int donorId = authenticatedDonorId;
            Map<String, Object> res = com.red404.service.RequestLifecycleService.getInstance().handleDonorAccept(id, donorId);
            Map<String, Object> req = requestDao.findById(id);
            if (req == null) req = new HashMap<>();
            req.putAll(res);
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.setAttribute("activeMission", req);
            }
            return ok("Request accepted", req);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiResponse(false, e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ApiResponse(false, e.getMessage()));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<ApiResponse> decline(@PathVariable int id, @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        try {
            Integer authenticatedDonorId = donorIdFromSession(request);
            if (authenticatedDonorId == null || authenticatedDonorId <= 0) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Authentication required to decline request."));
            }
            if (body != null && body.containsKey("donorId") && body.get("donorId") != null) {
                try {
                    int bodyDonorId = Integer.parseInt(body.get("donorId").toString());
                    if (bodyDonorId > 0 && bodyDonorId != authenticatedDonorId) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new ApiResponse(false, "Forbidden: Ownership verification failed."));
                    }
                } catch (NumberFormatException ignored) {}
            }
            int donorId = authenticatedDonorId;
            String reason = body != null && body.containsKey("reason") ? String.valueOf(body.get("reason")) : "Donor declined";
            Map<String, Object> res = com.red404.service.RequestLifecycleService.getInstance().handleDonorDecline(id, donorId, reason);
            return ok("Request declined", res);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== PUT ========================

    @PutMapping("/{id}/complete")
    public ResponseEntity<ApiResponse> complete(@PathVariable int id, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ApiResponse(false, "Manual fulfillment is deprecated. Requests are fulfilled automatically upon verified check-in donation approval, or closed via 'Close request'."));
    }

    // ======================== DELETE ========================

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> cancel(@PathVariable int id, HttpServletRequest request) {
        try {
            Map<String, Object> req = requestDao.findById(id);
            if (req == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiResponse(false, "Request not found"));
            }
            Integer sessionHospId = hospitalIdFromSession(request);
            boolean isAdmin = isAdminSession(request);
            Object reqHospId = req.get("hospitalId") != null ? req.get("hospitalId") : req.get("hospital_id");
            if (!isAdmin && (sessionHospId == null || reqHospId == null || !sessionHospId.toString().equals(reqHospId.toString()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Forbidden: Ownership verification failed."));
            }
            requestDao.updateStatus(id, "Cancelled");
            return ok("Request cancelled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== HELPERS ========================

    private boolean isAdminSession(HttpServletRequest request) {
        if (request == null) return false;
        HttpSession session = request.getSession(false);
        return session != null && "SUPER_ADMIN".equals(session.getAttribute("adminRole"));
    }

    private Integer donorIdFromSession(HttpServletRequest request) {
        if (request == null) return null;
        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute("user") != null) {
            Object u = session.getAttribute("user");
            if (u instanceof Map<?, ?> m && m.get("id") instanceof Number n) {
                return n.intValue();
            }
        }
        String authHeader = request.getHeader("Authorization");
        String token = request.getHeader("X-Red404-Token");
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
        if (token != null && token.startsWith("SESSION-DONOR-")) {
            String dStr = token.substring("SESSION-DONOR-".length()).trim();
            try {
                Map<String, Object> d = donorDao.findByIdOrDonorId(dStr);
                if (d != null && d.get("id") instanceof Number n) {
                    return n.intValue();
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Integer hospitalIdFromSession(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        String token = request.getHeader("X-Red404-Token");
        if (token == null && authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }
        if (token != null && token.startsWith("SESSION-HOSPITAL-")) {
            try {
                return Integer.parseInt(token.substring("SESSION-HOSPITAL-".length()).trim());
            } catch (NumberFormatException ignored) {}
        }
        String xHosp = request.getHeader("X-Hospital-Id");
        if (xHosp != null && !xHosp.isBlank()) {
            try {
                return Integer.parseInt(xHosp.trim());
            } catch (NumberFormatException ignored) {}
        }
        HttpSession session = request.getSession(false);
        if (session == null) return null;
        Object hospital = session.getAttribute("hospitalUser");
        if (hospital instanceof Map<?, ?> map && map.get("id") instanceof Number number) {
            return number.intValue();
        }
        return null;
    }

    private static ResponseEntity<ApiResponse> ok(String message, Object data) {
        return ResponseEntity.ok(new ApiResponse(true, message, data));
    }

    private static ResponseEntity<ApiResponse> serverError(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse(false, "Server failure: " + e.getMessage()));
    }
}

