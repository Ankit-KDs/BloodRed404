package com.red404.dao;

import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BloodRequestDao {

    public int insert(Map<String, Object> request) throws SQLException {
        String sql = "INSERT INTO blood_requests (hospital_id, patient_name, blood_type, units_requested, " +
                "urgency_level, required_before, status, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, ((Number) request.get("hospitalId")).intValue());
            ps.setString(2, str(request.getOrDefault("patientName", "Emergency Patient")));
            ps.setString(3, str(request.get("bloodType")));
            ps.setInt(4, ((Number) request.getOrDefault("unitsRequested", 1)).intValue());
            ps.setString(5, str(request.getOrDefault("urgencyLevel", "HIGH")));
            Date requiredBefore = (Date) request.get("requiredBefore");
            if (requiredBefore == null) {
                ps.setNull(6, Types.DATE);
            } else {
                ps.setDate(6, requiredBefore);
            }
            setDouble(ps, 7, (Double) request.get("latitude"));
            setDouble(ps, 8, (Double) request.get("longitude"));
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getInt(1) : 0;
            }
        }
    }

    public List<Map<String, Object>> listActive() throws SQLException {
        String sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " +
                "JOIN hospitals h ON br.hospital_id = h.id " +
                "WHERE br.status IN ('Active', 'Accepted', 'PENDING') " +
                "ORDER BY br.created_at DESC";
        return queryList(sql, null);
    }

    public List<Map<String, Object>> listByHospital(int hospitalId) throws SQLException {
        String sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " +
                "JOIN hospitals h ON br.hospital_id = h.id WHERE br.hospital_id = ? ORDER BY br.created_at DESC";
        return queryList(sql, hospitalId);
    }

    public List<Map<String, Object>> listForDonor(Double lat, Double lng) throws SQLException {
        List<Map<String, Object>> requests = listActive();
        for (Map<String, Object> request : requests) {
            Double reqLat = asDouble(request.get("latitude"));
            Double reqLng = asDouble(request.get("longitude"));
            if (lat != null && lng != null && reqLat != null && reqLng != null) {
                double distance = DistanceCalculator.calculateDistance(lat, lng, reqLat, reqLng);
                request.put("distanceKm", distance);
                request.put("etaMinutes", DistanceCalculator.getEstimatedTravelTime(distance, "DRIVING"));
            } else {
                request.put("distanceKm", 0);
                request.put("etaMinutes", 0);
            }
        }
        return requests;
    }

    public boolean updateStatus(int id, String status) throws SQLException {
        String sql = "UPDATE blood_requests SET status = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    public Map<String, Object> findById(int id) throws SQLException {
        String sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " +
                "JOIN hospitals h ON br.hospital_id = h.id WHERE br.id = ?";
        List<Map<String, Object>> rows = queryList(sql, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Map<String, Object>> queryList(String sql, Integer idParam) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (idParam != null) {
                ps.setInt(1, idParam);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRequest(rs));
                }
            }
        } catch (SQLException e) {
            String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            if (message.contains("created_at") && sql.contains("created_at")) {
                String fallback = sql.replace("ORDER BY br.created_at DESC", "ORDER BY br.id DESC");
                return queryList(fallback, idParam);
            }
            throw e;
        }
        return list;
    }

    private Map<String, Object> mapRequest(ResultSet rs) throws SQLException {
        Map<String, Object> req = new HashMap<>();
        int id = rs.getInt("id");
        req.put("id", id);
        req.put("requestId", String.valueOf(id));
        req.put("hospitalId", rs.getInt("hospital_id"));
        req.put("patientName", rs.getString("patient_name"));
        req.put("bloodType", rs.getString("blood_type"));
        int units = rs.getInt("units_requested");
        req.put("unitsRequested", units);
        req.put("units", units);
        String urgency = rs.getString("urgency_level");
        req.put("urgencyLevel", urgency);
        req.put("urgency", urgency == null ? "high" : urgency.toLowerCase());
        Date requiredBefore = rs.getDate("required_before");
        req.put("requiredBefore", requiredBefore == null ? null : requiredBefore.toString());
        String status = rs.getString("status");
        req.put("status", status);
        req.put("latitude", rs.getObject("latitude"));
        req.put("longitude", rs.getObject("longitude"));
        req.put("hospitalName", rs.getString("hospital_name"));
        req.put("city", rs.getString("city"));
        req.put("phone", rs.getString("hospital_phone"));
        req.put("donorsAccepted", 0);
        req.put("donorsNotified", 0);
        try {
            Object created = rs.getObject("created_at");
            req.put("time", created == null ? null : created.toString());
            req.put("createdAt", created == null ? null : created.toString());
        } catch (SQLException ignored) {
            req.put("time", null);
        }
        return req;
    }

    private static void setDouble(PreparedStatement ps, int index, Double value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DOUBLE);
        } else {
            ps.setDouble(index, value);
        }
    }

    private static String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static Double asDouble(Object value) {
        return value instanceof Number ? ((Number) value).doubleValue() : null;
    }
}
