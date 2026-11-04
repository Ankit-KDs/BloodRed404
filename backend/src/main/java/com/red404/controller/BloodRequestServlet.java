package com.red404.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.Date;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BloodRequestServlet extends HttpServlet {

    private final BloodRequestDao requestDao = new BloodRequestDao();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/") || path.equals("/active") || path.equals("/blood-requests")) {
                String hospitalIdParam = request.getParameter("hospitalId");
                List<Map<String, Object>> list;
                if (hospitalIdParam != null && !hospitalIdParam.isBlank()) {
                    list = requestDao.listByHospital(Integer.parseInt(hospitalIdParam));
                } else {
                    Integer sessionHospitalId = hospitalIdFromSession(request);
                    list = sessionHospitalId == null
                            ? requestDao.listActive()
                            : requestDao.listByHospital(sessionHospitalId);
                }
                JsonUtil.ok(response, "Requests fetched successfully", list);
            } else if (path.equals("/log")) {
                JsonUtil.ok(response, "Log loaded", requestDao.listActive());
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown request endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error fetching feed: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.equals("/") || path.equals("/dispatch") || path.equals("/blood-requests")) {
                handleCreate(request, response);
            } else if (path.matches("^/\\d+/accept$")) {
                int id = idFromPath(path);
                requestDao.updateStatus(id, "Accepted");
                JsonUtil.ok(response, "Request accepted", requestDao.findById(id));
            } else if (path.matches("^/\\d+/decline$")) {
                int id = idFromPath(path);
                requestDao.updateStatus(id, "Declined");
                JsonUtil.ok(response, "Request declined", null);
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown request endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Server insertion failure: " + e.getMessage());
        }
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.matches("^/\\d+/complete$")) {
                int id = idFromPath(path);
                requestDao.updateStatus(id, "Fulfilled");
                JsonUtil.ok(response, "Request fulfilled", requestDao.findById(id));
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown request endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String path = JsonUtil.path(request);
        try {
            if (path.matches("^/\\d+$")) {
                int id = Integer.parseInt(path.substring(1));
                requestDao.updateStatus(id, "Cancelled");
                JsonUtil.ok(response, "Request cancelled", null);
            } else {
                JsonUtil.error(response, HttpServletResponse.SC_NOT_FOUND, "Unknown request endpoint");
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonUtil.error(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage());
        }
    }

    private void handleCreate(HttpServletRequest request, HttpServletResponse response) throws Exception {
        JsonNode body = JsonUtil.readBody(request);
        Integer hospitalId = JsonUtil.asInt(body, "hospitalId", 0);
        if (hospitalId == 0) {
            hospitalId = hospitalIdFromSession(request);
        }
        if (hospitalId == null || hospitalId == 0) {
            JsonUtil.error(response, HttpServletResponse.SC_UNAUTHORIZED, "Hospital login required to dispatch a request.");
            return;
        }
        String bloodType = JsonUtil.textOrNull(body, "bloodType");
        if (bloodType == null) {
            JsonUtil.error(response, HttpServletResponse.SC_BAD_REQUEST, "Blood type is required.");
            return;
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
        JsonUtil.created(response, "Emergency Blood Request Broadcasted Successfully!", Map.of("id", id));
    }

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

    private static int idFromPath(String path) {
        String digits = path.replaceAll("\\D+", " ").trim().split(" ")[0];
        return Integer.parseInt(digits);
    }
}
