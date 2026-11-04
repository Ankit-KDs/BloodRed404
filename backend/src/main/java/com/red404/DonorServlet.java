package com.red404;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.red404.DBConnection;
import com.red404.ApiResponse;

// Javax ko hata kar Jakarta packages lagaye hain
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
import java.util.HashMap;
import java.util.Map;

@WebServlet({"/api/donors/register", "/api/donors/login"})
public class DonorServlet extends HttpServlet {
    
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
                handleRegistration(rootNode, response);
            } else if (path.contains("/login")) {
                handleLogin(rootNode, request, response);
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            sendErrorResponse(response, "Server failure: " + e.getMessage());
        }
    }

    private void handleRegistration(JsonNode rootNode, HttpServletResponse response) throws Exception {
        try (Connection dbConn = DBConnection.getConnection()) {
            String sql = "INSERT INTO donors (name, email, phone, dob, gender, password, blood_type, weight, " +
                         "last_donation, availability, address, city, state, pincode, latitude, longitude, zone, " +
                         "sms_notif, push_notif, email_notif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            try (PreparedStatement ps = dbConn.prepareStatement(sql)) {
                String firstName = rootNode.has("firstName") ? rootNode.get("firstName").asText() : "";
                String lastName = rootNode.has("lastName") ? rootNode.get("lastName").asText() : "";
                ps.setString(1, (firstName + " " + lastName).trim());
                ps.setString(2, rootNode.has("email") ? rootNode.get("email").asText() : "");
                ps.setString(3, rootNode.has("phone") ? rootNode.get("phone").asText() : "");
                
                String dobStr = rootNode.has("dateOfBirth") ? rootNode.get("dateOfBirth").asText() : null;
                ps.setDate(4, (dobStr != null && !dobStr.isEmpty()) ? java.sql.Date.valueOf(dobStr) : null);
                
                ps.setString(5, rootNode.has("gender") ? rootNode.get("gender").asText() : "");
                ps.setString(6, rootNode.has("password") ? rootNode.get("password").asText() : ""); 
                ps.setString(7, rootNode.has("bloodType") ? rootNode.get("bloodType").asText() : "");
                ps.setDouble(8, rootNode.has("weight") ? rootNode.get("weight").asDouble() : 0.0);
                
                String lastDonStr = rootNode.has("lastDonation") ? rootNode.get("lastDonation").asText() : null;
                if (lastDonStr != null && !lastDonStr.isEmpty() && !lastDonStr.equals("null")) {
                    ps.setDate(9, java.sql.Date.valueOf(lastDonStr));
                } else {
                    ps.setNull(9, java.sql.Types.DATE);
                }
                
                ps.setString(10, rootNode.has("availability") ? rootNode.get("availability").asText() : "Available");
                ps.setString(11, rootNode.has("address") ? rootNode.get("address").asText() : "");
                ps.setString(12, rootNode.has("city") ? rootNode.get("city").asText() : "");
                ps.setString(13, rootNode.has("state") ? rootNode.get("state").asText() : "");
                ps.setString(14, rootNode.has("pincode") ? rootNode.get("pincode").asText() : "");
                
                if (rootNode.has("latitude") && !rootNode.get("latitude").isNull()) ps.setDouble(15, rootNode.get("latitude").asDouble());
                else ps.setNull(15, java.sql.Types.DOUBLE);
                
                if (rootNode.has("longitude") && !rootNode.get("longitude").isNull()) ps.setDouble(16, rootNode.get("longitude").asDouble());
                else ps.setNull(16, java.sql.Types.DOUBLE);
                
                ps.setString(17, rootNode.has("zone") ? rootNode.get("zone").asText() : null);
                ps.setBoolean(18, rootNode.has("smsNotif") ? rootNode.get("smsNotif").asBoolean() : true);
                ps.setBoolean(19, rootNode.has("pushNotif") ? rootNode.get("pushNotif").asBoolean() : true);
                ps.setBoolean(20, rootNode.has("emailNotif") ? rootNode.get("emailNotif").asBoolean() : false);

                int rows = ps.executeUpdate();
                if (rows > 0) {
                    response.setStatus(HttpServletResponse.SC_CREATED);
                    response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Donor Registered Successfully!")));
                } else {
                    response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Registration Failed.")));
                }
            }
        }
    }

    private void handleLogin(JsonNode rootNode, HttpServletRequest request, HttpServletResponse response) throws Exception {
        String identifier = rootNode.has("identifier") ? rootNode.get("identifier").asText() : "";
        String password = rootNode.has("password") ? rootNode.get("password").asText() : "";

        try (Connection dbConn = DBConnection.getConnection()) {
            String sql = "SELECT * FROM donors WHERE (email = ? OR phone = ?) AND password = ?";
            try (PreparedStatement ps = dbConn.prepareStatement(sql)) {
                ps.setString(1, identifier);
                ps.setString(2, identifier);
                ps.setString(3, password);

                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        Map<String, Object> donorData = new HashMap<>();
                        donorData.put("id", rs.getInt("id"));
                        donorData.put("name", rs.getString("name"));
                        donorData.put("email", rs.getString("email"));
                        donorData.put("bloodType", rs.getString("blood_type"));
                        donorData.put("city", rs.getString("city"));
                        donorData.put("zone", rs.getString("zone"));
                        donorData.put("availability", rs.getString("availability"));

                        Map<String, Object> sessionWrapper = new HashMap<>();
                        sessionWrapper.put("donor", donorData);
                        sessionWrapper.put("token", "JWT-SIMULATED-DONOR-" + rs.getInt("id"));

                        HttpSession session = request.getSession();
                        session.setAttribute("user", donorData);

                        response.setStatus(HttpServletResponse.SC_OK);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Login Successful", sessionWrapper)));
                    } else {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Invalid credentials. Please try again.")));
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