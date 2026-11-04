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
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@WebServlet("/api/blood-requests")
public class BloodRequestServlet extends HttpServlet {
    
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        String hospitalIdParam = request.getParameter("hospitalId");
        List<Map<String, Object>> requestList = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection()) {
            String sql;
            PreparedStatement ps;

            if (hospitalIdParam != null && !hospitalIdParam.isEmpty()) {
                sql = "SELECT * FROM blood_requests WHERE hospital_id = ? ORDER BY created_at DESC";
                ps = conn.prepareStatement(sql);
                ps.setInt(1, Integer.parseInt(hospitalIdParam));
            } else {
                sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " + "JOIN hospitals h ON br.hospital_id = h.id WHERE br.status = 'Active' ORDER BY br.created_at DESC";
                ps = conn.prepareStatement(sql);
            }

            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> reqMap = new HashMap<>();
                    reqMap.put("id", rs.getInt("id"));
                    reqMap.put("patientName", rs.getString("patient_name"));
                    reqMap.put("bloodType", rs.getString("blood_type"));
                    reqMap.put("unitsRequested", rs.getInt("units_requested"));
                    reqMap.put("urgencyLevel", rs.getString("urgency_level"));
                    reqMap.put("requiredBefore", rs.getDate("required_before").toString());
                    reqMap.put("status", rs.getString("status"));
                    reqMap.put("latitude", rs.getDouble("latitude"));
                    reqMap.put("longitude", rs.getDouble("longitude"));
                    
                    if (hospitalIdParam == null) {
                        reqMap.put("hospitalName", rs.getString("hospital_name"));
                        reqMap.put("city", rs.getString("city"));
                        reqMap.put("phone", rs.getString("hospital_phone"));
                    }
                    requestList.add(reqMap);
                }
            }

            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Requests fetched successfully", requestList)));

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Error fetching feed: " + e.getMessage())));
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        try {
            BufferedReader reader = request.getReader();
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            JsonNode rootNode = objectMapper.readTree(sb.toString());

            try (Connection conn = DBConnection.getConnection()) {
                String sql = "INSERT INTO blood_requests (hospital_id, patient_name, blood_type, units_requested, " +
                             "urgency_level, required_before, status, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?)";
                
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setInt(1, rootNode.get("hospitalId").asInt());
                    ps.setString(2, rootNode.get("patientName").asText());
                    ps.setString(3, rootNode.get("bloodType").asText());
                    ps.setInt(4, rootNode.get("unitsRequested").asInt());
                    ps.setString(5, rootNode.get("urgencyLevel").asText());
                    ps.setDate(6, java.sql.Date.valueOf(rootNode.get("requiredBefore").asText()));
                    
                    if (rootNode.has("latitude") && !rootNode.get("latitude").isNull()) ps.setDouble(7, rootNode.get("latitude").asDouble());
                    else ps.setNull(7, java.sql.Types.DOUBLE);
                    
                    if (rootNode.has("longitude") && !rootNode.get("longitude").isNull()) ps.setDouble(8, rootNode.get("longitude").asDouble());
                    else ps.setNull(8, java.sql.Types.DOUBLE);

                    int rows = ps.executeUpdate();
                    if (rows > 0) {
                        response.setStatus(HttpServletResponse.SC_CREATED);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(true, "Emergency Blood Request Broadcasted Successfully!")));
                    } else {
                        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                        response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Failed to create request.")));
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().write(objectMapper.writeValueAsString(new ApiResponse(false, "Server insertion failure: " + e.getMessage())));
        }
    }
}