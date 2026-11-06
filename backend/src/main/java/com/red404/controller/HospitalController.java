package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
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
@RequestMapping("/api/hospitals")
public class HospitalController {

    private final HospitalDao hospitalDao = new HospitalDao();

    // ======================== GET ========================

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

    // ======================== POST ========================

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody JsonNode body) {
        try {
            String email = JsonUtil.text(body, "hospitalEmail");
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
            hospital.put("hospitalName", JsonUtil.text(body, "hospitalName"));
            hospital.put("registrationNo", JsonUtil.text(body, "registrationNo"));
            hospital.put("hospitalType", JsonUtil.text(body, "hospitalType"));
            hospital.put("beds", JsonUtil.asInt(body, "beds", 0));
            hospital.put("bloodBankLicense", JsonUtil.textOrNull(body, "bloodBankLicense"));
            hospital.put("hospitalEmail", email);
            hospital.put("hospitalPhone", JsonUtil.text(body, "hospitalPhone"));
            hospital.put("website", JsonUtil.textOrNull(body, "website"));
            hospital.put("services", String.join(",", services));
            hospital.put("adminName", (JsonUtil.text(body, "adminFirstName") + " " + JsonUtil.text(body, "adminLastName")).trim());
            hospital.put("adminDesignation", JsonUtil.text(body, "adminDesignation"));
            hospital.put("adminPhone", JsonUtil.text(body, "adminPhone"));
            hospital.put("adminEmail", JsonUtil.text(body, "adminEmail"));
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
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(new ApiResponse(true, "Hospital Registered Successfully!", null));
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

