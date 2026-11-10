package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.DonorDao;
import com.red404.dao.HospitalDao;
import com.red404.model.ApiResponse;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/hospitals", "/api/hospital"})
public class HospitalController {

    private final HospitalDao hospitalDao = new HospitalDao();
    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();

    // ======================== GET ========================

    @GetMapping({"/directory", "/public-list", "/search", "/list"})
    public ResponseEntity<ApiResponse> getRegisteredHospitals(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String district) {
        try {
            List<Map<String, Object>> allHospitals = hospitalDao.listAll();
            List<Map<String, Object>> filtered = new ArrayList<>();
            for (Map<String, Object> h : allHospitals) {
                String hState = (String) h.get("state");
                String hCity = (String) h.get("city");
                boolean matchesState = (state == null || state.isBlank() || (hState != null && hState.equalsIgnoreCase(state.trim())));
                String targetDistrict = (district != null && !district.isBlank()) ? district : city;
                boolean matchesDistrict = (targetDistrict == null || targetDistrict.isBlank() || targetDistrict.equalsIgnoreCase("ALL") || 
                        (hCity != null && (hCity.equalsIgnoreCase(targetDistrict.trim()) || hCity.toLowerCase().contains(targetDistrict.toLowerCase()))));
                if (matchesState && matchesDistrict) {
                    filtered.add(h);
                }
            }
            return ok("Registered hospitals loaded", filtered);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse> getProfile(HttpServletRequest request) {
        try {
            Map<String, Object> hospital = requireHospital(request);
            if (hospital == null) return unauthorized();
            return ok("Profile loaded", hospitalDao.findById((Integer) hospital.get("id")));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/donors/nearby", "/donors"})
    public ResponseEntity<ApiResponse> getNearbyDonors(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "50") double radius,
            @RequestParam(required = false) String bloodType,
            HttpServletRequest request) {
        try {
            if (lat == null || lng == null) {
                Map<String, Object> hospital = getHospitalFromSession(request);
                if (hospital != null) {
                    lat = asDouble(hospital.get("latitude"));
                    lng = asDouble(hospital.get("longitude"));
                }
            }
            List<Map<String, Object>> donors = donorDao.findNearby(lat, lng, radius, bloodType);
            return ok("Donors loaded", donors);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/requests/active", "/requests"})
    public ResponseEntity<ApiResponse> getActiveRequests(HttpServletRequest request) {
        try {
            Integer hospId = getHospitalId(request);
            List<Map<String, Object>> list = (hospId != null)
                    ? requestDao.listByHospital(hospId)
                    : requestDao.listActive();
            return ok("Requests loaded", list);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/requests/history")
    public ResponseEntity<ApiResponse> getRequestsHistory(HttpServletRequest request) {
        try {
            Integer hospId = getHospitalId(request);
            List<Map<String, Object>> list = (hospId != null)
                    ? requestDao.listByHospital(hospId)
                    : requestDao.listActive();
            return ok("History loaded", list);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/dispatch-log")
    public ResponseEntity<ApiResponse> getDispatchLog() {
        try {
            return ok("Log loaded", requestDao.listActive());
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/donors/{id}/notify")
    public ResponseEntity<ApiResponse> notifyDonor(@PathVariable int id) {
        return ok("Notification sent to donor #" + id, null);
    }

    @PostMapping("/requests/{id}/cancel")
    public ResponseEntity<ApiResponse> cancelRequest(@PathVariable int id) {
        try {
            requestDao.updateStatus(id, "Cancelled");
            return ok("Request cancelled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/requests/{id}/fulfill")
    public ResponseEntity<ApiResponse> fulfillRequest(@PathVariable int id) {
        try {
            requestDao.updateStatus(id, "Fulfilled");
            return ok("Request marked as fulfilled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/requests", "/requests/dispatch"})
    public ResponseEntity<ApiResponse> createRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) {
                hospitalId = JsonUtil.asInt(body, "hospitalId", 0);
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("hospitalId", hospitalId != null && hospitalId > 0 ? hospitalId : 1);
            payload.put("patientName", JsonUtil.textOrNull(body, "patientName"));
            payload.put("bloodType", JsonUtil.text(body, "bloodType"));
            payload.put("unitsRequested", JsonUtil.asInt(body, "unitsNeeded", 1));
            payload.put("urgencyLevel", JsonUtil.text(body, "urgencyLevel"));
            payload.put("requiredBefore", JsonUtil.textOrNull(body, "requiredBefore"));
            payload.put("latitude", JsonUtil.asDouble(body, "latitude"));
            payload.put("longitude", JsonUtil.asDouble(body, "longitude"));
            payload.put("notes", JsonUtil.textOrNull(body, "notes"));
            payload.put("notificationRadius", JsonUtil.asInt(body, "notificationRadius", 5));
            int id = requestDao.insert(payload);
            payload.put("id", id);
            payload.put("status", "Pending");
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Emergency blood request dispatched successfully!", payload));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== POST ========================

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            String email = JsonUtil.text(body, "hospitalEmail").trim().toLowerCase();
            String adminEmail = JsonUtil.text(body, "adminEmail").trim().toLowerCase();
            String hospitalPhone = JsonUtil.text(body, "hospitalPhone").trim().replaceAll("\\s+", "");
            String adminPhone = JsonUtil.text(body, "adminPhone").trim().replaceAll("\\s+", "");
            if (hospitalDao.emailExists(email)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ApiResponse(false, "Hospital email already registered."));
            }
            List<String> services = new ArrayList<>();
            if (body.has("services") && body.get("services").isArray()) {
                for (JsonNode node : body.get("services")) {
                    services.add(node.asText());
                }
            }
            Map<String, Object> hospital = new HashMap<>();
            hospital.put("hospitalName", JsonUtil.text(body, "hospitalName").trim());
            hospital.put("registrationNo", JsonUtil.text(body, "registrationNo").trim());
            hospital.put("hospitalType", JsonUtil.text(body, "hospitalType"));
            hospital.put("beds", JsonUtil.asInt(body, "beds", 0));
            hospital.put("bloodBankLicense", JsonUtil.textOrNull(body, "bloodBankLicense"));
            hospital.put("hospitalEmail", email);
            hospital.put("hospitalPhone", hospitalPhone);
            hospital.put("website", JsonUtil.textOrNull(body, "website"));
            hospital.put("services", String.join(",", services));
            hospital.put("adminName", (JsonUtil.text(body, "adminFirstName") + " " + JsonUtil.text(body, "adminLastName")).trim());
            hospital.put("adminDesignation", JsonUtil.text(body, "adminDesignation"));
            hospital.put("adminPhone", adminPhone);
            hospital.put("adminEmail", adminEmail);
            hospital.put("password", JsonUtil.text(body, "password"));
            hospital.put("emergencyContact", JsonUtil.text(body, "emergencyContact"));
            hospital.put("address", JsonUtil.text(body, "address"));
            hospital.put("landmark", JsonUtil.textOrNull(body, "landmark"));
            hospital.put("city", JsonUtil.text(body, "city"));
            hospital.put("state", JsonUtil.text(body, "state"));
            hospital.put("pincode", JsonUtil.text(body, "pincode"));
            hospital.put("latitude", JsonUtil.asDouble(body, "latitude"));
            hospital.put("longitude", JsonUtil.asDouble(body, "longitude"));
            hospital.put("zone", JsonUtil.textOrNull(body, "zone"));
            hospital.put("operatingHours", JsonUtil.textOrNull(body, "operatingHours") == null ? "24x7" : JsonUtil.text(body, "operatingHours"));
            hospital.put("zoneRadius", JsonUtil.asInt(body, "zoneRadius", 10));
            hospital.put("smsNotif", JsonUtil.asBoolean(body, "smsNotif", true));
            hospital.put("pushNotif", JsonUtil.asBoolean(body, "pushNotif", true));
            hospital.put("emailNotif", JsonUtil.asBoolean(body, "emailNotif", false));

            if (hospitalDao.insert(hospital)) {
                Map<String, Object> registeredHosp = hospitalDao.findByLogin(email, (String) hospital.get("password"));
                if (registeredHosp == null) {
                    registeredHosp = hospital;
                }
                HttpSession session = request.getSession(true);
                session.setAttribute("hospitalUser", registeredHosp);
                session.setAttribute("role", "HOSPITAL");
                Map<String, Object> wrapper = new HashMap<>();
                wrapper.put("hospital", registeredHosp);
                wrapper.put("token", "SESSION-HOSPITAL-" + registeredHosp.get("id"));
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(new ApiResponse(true, "Hospital Registered Successfully!", wrapper));
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Registration Failed."));
            }
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> hospital = hospitalDao.findByLogin(JsonUtil.text(body, "email"), JsonUtil.text(body, "password"));
            if (hospital == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Invalid credentials for hospital account."));
            }
            HttpSession session = request.getSession(true);
            session.setAttribute("hospitalUser", hospital);
            session.setAttribute("role", "HOSPITAL");
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("hospital", hospital);
            wrapper.put("token", "SESSION-HOSPITAL-" + hospital.get("id"));
            return ok("Login Successful", wrapper);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== PUT ========================

    @PutMapping("/inventory")
    public ResponseEntity<ApiResponse> updateInventory() {
        return ok("Updated successfully", null);
    }

    @PutMapping("/settings")
    public ResponseEntity<ApiResponse> updateSettings() {
        return ok("Updated successfully", null);
    }

    // ======================== HELPERS ========================

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireHospital(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("hospitalUser") == null) {
            return null;
        }
        return (Map<String, Object>) session.getAttribute("hospitalUser");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getHospitalFromSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null ? (Map<String, Object>) session.getAttribute("hospitalUser") : null;
    }

    private Integer getHospitalId(HttpServletRequest request) {
        Map<String, Object> h = getHospitalFromSession(request);
        if (h != null && h.get("id") instanceof Number num) {
            return num.intValue();
        }
        return null;
    }

    private static Double asDouble(Object val) {
        return val instanceof Number ? ((Number) val).doubleValue() : null;
    }

    private static ResponseEntity<ApiResponse> ok(String message, Object data) {
        return ResponseEntity.ok(new ApiResponse(true, message, data));
    }

    private static ResponseEntity<ApiResponse> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse(false, "Please login as a hospital first."));
    }

    private static ResponseEntity<ApiResponse> serverError(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse(false, "Server processing error: " + e.getMessage()));
    }
}

