package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.HospitalDao;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HospitalServlet extends HttpServlet {

    private final HospitalDao hospitalDao = new HospitalDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/profile")) {
                Map<String, Object> hospital = requireHospital(request, response);
                if (hospital == null) return;
                JsonUtil.ok(response, "Profile loaded", hospitalDao.findById((Integer) hospital.get("id")));
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown hospital endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server processing error: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/register")) {
                handleRegistration(request, response);
            } else if (path.equals("/login")) {
                handleLogin(request, response);
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown hospital endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server processing error: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        if (path.equals("/inventory") || path.equals("/settings")) {
            JsonUtil.ok(response, "Updated successfully", null);
            return;
        }
        JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown hospital endpoint");
    }

    private void handleRegistration(HttpServletRequest request, HttpServletResponse response) throws Exception {
        JsonNode body = JsonUtil.readBody(request);
        String email = JsonUtil.text(body, "hospitalEmail");
        if (hospitalDao.emailExists(email)) {
            JsonUtil.error(response, HttpServletResponse.SC_CONFLICT, "Hospital email already registered.");
            return;
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
            JsonUtil.created(response, "Hospital Registered Successfully!", null);
        } else {
            JsonUtil.error(response, HttpServletResponse.SC_BAD_REQUEST, "Registration Failed.");
        }
    }

    private void handleLogin(HttpServletRequest request, HttpServletResponse response) throws Exception {
        JsonNode body = JsonUtil.readBody(request);
        Map<String, Object> hospital = hospitalDao.findByLogin(JsonUtil.text(body, "email"), JsonUtil.text(body, "password"));
        if (hospital == null) {
            JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid credentials for hospital account.");
            return;
        }
        HttpSession session = request.getSession(true);
        session.setAttribute("hospitalUser", hospital);
        session.setAttribute("role", "HOSPITAL");
        Map<String, Object> wrapper = new HashMap<>();
        wrapper.put("hospital", hospital);
        wrapper.put("token", "SESSION-HOSPITAL-" + hospital.get("id"));
        JsonUtil.ok(response, "Login Successful", wrapper);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireHospital(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("hospitalUser") == null) {
            JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "Please login as a hospital first.");
            return null;
        }
        return (Map<String, Object>) session.getAttribute("hospitalUser");
    }
}
