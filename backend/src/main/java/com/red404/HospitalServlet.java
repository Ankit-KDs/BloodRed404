package com.red404;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.red404.DBConnection;
import com.red404.ApiResponse;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@WebServlet({"/api/hospitals/register", "/api/hospitals/login"})
public class HospitalServlet extends HttpServlet {
    
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        
        String path = request.getRequestURI();
        
        try {
            BufferedReader reader = request.getReader();
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            JsonNode rootNode = objectMapper.readTree(sb.toString());

            if (path.contains("/register")) {
                handleHospitalRegistration(rootNode, response);
            } else if (path.contains("/login")) {
                handleHospitalLogin(rootNode, request, response);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            sendErrorResponse(response, "Server processing error: " + e.getMessage());
        }
    }

    private void handleHospitalRegistration(JsonNode rootNode, HttpServletResponse response) throws Exception {
        try (Connection dbConn = DBConnection.getConnection()) {
            String sql = "INSERT INTO hospitals (hospital_name, registration_no, hospital_type, beds, blood_bank_license, " +
                         "hospital_email, hospital_phone, website, services, admin_name, admin_designation, admin_phone, " +
                         "admin_email, password, emergency_contact, address, landmark, city, state, pincode, " +
                         "latitude, longitude, zone, operating_hours, zone_radius, sms_notif, push_notif, email_notif) " +
                         "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            try (PreparedStatement ps = dbConn.prepareStatement(sql)) {
                ps.setString(1, rootNode.has("hospitalName") ? rootNode.get("hospitalName").asText() : "");
                ps.setString(2, rootNode.has("registrationNo") ? rootNode.get("registrationNo").asText() : "");
                ps.setString(3, rootNode.has("hospitalType") ? rootNode.get("hospitalType").asText() : "");
                ps.setInt(4, rootNode.has("beds") ? rootNode.get("beds").asInt() : 0);
                ps.setString(5, rootNode.has("bloodBankLicense") ? rootNode.get("bloodBankLicense").asText() : null);
                ps.setString(6, rootNode.has("hospitalEmail") ? rootNode.get("hospitalEmail").asText() : "");
                ps.setString(7, rootNode.has("hospitalPhone") ? rootNode.get("hospitalPhone").asText() : "");
                ps.setString(8, rootNode.has("website") ? rootNode.get("website").asText() : null);
                
                List<String> serviceList = new ArrayList<>();
                if (rootNode.has("services") && rootNode.get("services").isArray()) {
                    for (JsonNode node : rootNode.get("services")) {
                        serviceList.add(node.asText());
                    }
                }
                ps.setString(9, String.join(",", serviceList));
                
                String adminFN = rootNode.has("adminFirstName") ? rootNode.get("adminFirstName").asText() : "";
                String adminLN = rootNode.has("adminLastName") ? rootNode.get("adminLastName").asText() : "";
                ps.setString(10, (adminFN + " " + adminLN).trim());
                
                ps.setString(11, rootNode.has("adminDesignation") ? rootNode.get("adminDesignation").asText() : "");
                ps.setString(12, rootNode.has("adminPhone") ? rootNode.get("adminPhone").asText() : "");
                ps.setString(13, rootNode.has("adminEmail") ? rootNode.get("adminEmail").asText() : "");
                ps.setString(14, rootNode.has("password") ? rootNode.get("password").asText() : "");
                ps.setString(15, rootNode.has("emergencyContact") ? rootNode.get("emergencyContact").asText() : "");
                ps.setString(16, rootNode.has("address") ? rootNode.get("address").asText() : "");
                ps.setString(17, rootNode.has("landmark") ? rootNode.get("landmark").asText() : null);
                ps.setString(18, rootNode.has("city") ? rootNode.get("city").asText() : "");
                ps.setString(19, rootNode.has("state") ? rootNode.get("state").asText() : "");
                ps.setString(20, rootNode.has("pincode") ? rootNode.get("pincode").asText() : "");
                
                if (rootNode.has("latitude") && !rootNode.get("latitude").isNull()) ps.setDouble(21, rootNode.get("latitude").asDouble());
                else ps.setNull(21, java.sql.Types.DOUBLE);
                
                if (rootNode.has("longitude") && !rootNode.get("longitude").isNull()) ps.setDouble(22, rootNode.get("longitude").asDouble());
                else ps.setNull(22, java.sql.Types.DOUBLE);
                
                ps.setString(23, rootNode.has("zone") ? rootNode.get("zone").asText() : null);
                ps.setString(24, rootNode.has("operatingHours") ? rootNode.get("operatingHours").asText() : "24x7");
                ps.setInt(25, rootNode.has("zoneRadius") ? rootNode.get("zoneRadius").asInt() : 10);
                ps.setBoolean(26, rootNode.has("smsNotif") ? rootNode.get("smsNotif").asBoolean() : true);
                ps.setBoolean(27, rootNode.has("pushNotif") ? rootNode.get("pushNotif").asBoolean() : true);
                ps.setBoolean(28, rootNode.has("emailNotif") ? rootNode.get("emailNotif").asBoolean() : false);

                int rows = ps.executeUpdate();
                if (rows > 0) {
                    response.setStatus(HttpServletResponse.SC_CREATED);
                    response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Hospital Registered Successfully!")));
                } else {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Registration Failed.")));
                }
            }
        }
    }

    private void handleHospitalLogin(JsonNode rootNode, HttpServletRequest request, HttpServletResponse response) throws Exception {
        String email = rootNode.has("email") ? rootNode.get("email").asText() : "";
        String password = rootNode.has("password") ? rootNode.get("password").asText() : "";

        try (Connection dbConn = DBConnection.getConnection()) {
            String sql = "SELECT * FROM hospitals WHERE hospital_email = ? AND password = ?";
            try (PreparedStatement ps = dbConn.prepareStatement(sql)) {
                ps.setString(1, email);
                ps.setString(2, password);

                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        Map<String, Object> hospitalData = new HashMap<>();
                        hospitalData.put("id", rs.getInt("id"));
                        hospitalData.put("name", rs.getString("hospital_name"));
                        hospitalData.put("email", rs.getString("hospital_email"));
                        hospitalData.put("city", rs.getString("city"));
                        hospitalData.put("zone", rs.getString("zone"));
                        hospitalData.put("radius", rs.getInt("zone_radius"));

                        Map<String, Object> sessionWrapper = new HashMap<>();
                        sessionWrapper.put("hospital", hospitalData);
                        sessionWrapper.put("token", "JWT-SIMULATED-HOSPITAL-" + rs.getInt("id"));

                        HttpSession session = request.getSession();
                        session.setAttribute("hospitalUser", hospitalData);

                        response.setStatus(HttpServletResponse.SC_OK);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Login Successful", sessionWrapper)));
                    } else {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Invalid credentials for hospital account.")));
                    }
                }
            }
        }
    }

    private void sendErrorResponse(HttpServletResponse response, String msg) throws IOException {
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, msg)));
    }
}