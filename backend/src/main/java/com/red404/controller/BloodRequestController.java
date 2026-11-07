package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.model.ApiResponse;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/requests", "/api/blood-requests"})
public class BloodRequestController {

    private final BloodRequestDao requestDao = new BloodRequestDao();

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
            Integer hospitalId = JsonUtil.asInt(body, "hospitalId", 0);
            if (hospitalId == 0) {
                hospitalId = hospitalIdFromSession(request);
            }
            if (hospitalId == null || hospitalId == 0) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Hospital login required to dispatch a request."));
            }
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
    public ResponseEntity<ApiResponse> accept(@PathVariable int id, HttpServletRequest request) {
        try {
            requestDao.updateStatus(id, "Accepted");
            Map<String, Object> req = requestDao.findById(id);
            HttpSession session = request.getSession(true);
            if (session != null) {
                session.setAttribute("activeMission", req);
            }
            return ok("Request accepted", req);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<ApiResponse> decline(@PathVariable int id) {
        try {
            requestDao.updateStatus(id, "Declined");
            return ok("Request declined", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== PUT ========================

    @PutMapping("/{id}/complete")
    public ResponseEntity<ApiResponse> complete(@PathVariable int id) {
        try {
            requestDao.updateStatus(id, "Fulfilled");
            return ok("Request fulfilled", requestDao.findById(id));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== DELETE ========================

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> cancel(@PathVariable int id) {
        try {
            requestDao.updateStatus(id, "Cancelled");
            return ok("Request cancelled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== HELPERS ========================

    @SuppressWarnings("unchecked")
    private Integer hospitalIdFromSession(HttpServletRequest request) {
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

