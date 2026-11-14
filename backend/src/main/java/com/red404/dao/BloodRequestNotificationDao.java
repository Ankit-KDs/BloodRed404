package com.red404.dao;

import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.*;
import java.util.*;

public class BloodRequestNotificationDao {

    private static final Logger log = LoggerFactory.getLogger(BloodRequestNotificationDao.class);

    public void ensureTableExists() {
        String sql = """
            CREATE TABLE IF NOT EXISTS blood_request_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                donor_id INT NOT NULL,
                hospital_id INT NOT NULL,
                blood_type VARCHAR(10) NOT NULL,
                units_requested INT DEFAULT 1,
                patient_name VARCHAR(150),
                notes TEXT,
                status VARCHAR(20) DEFAULT 'NOTIFIED',
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                responded_at TIMESTAMP NULL
            )
            """;
        try (Connection conn = DBConnection.getConnection();
             Statement st = conn.createStatement()) {
            st.execute(sql);
        } catch (Exception e) {
            log.warn("Notice ensuring blood_request_notifications table: {}", e.getMessage());
        }
    }

    public int notifyDonor(int requestId, int donorId, int hospitalId, String bloodType, int units, String patientName, String notes) throws SQLException {
        ensureTableExists();
        String sql = "INSERT INTO blood_request_notifications (request_id, donor_id, hospital_id, blood_type, units_requested, patient_name, notes, status, notified_at) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, 'NOTIFIED', CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, requestId);
            ps.setInt(2, donorId);
            ps.setInt(3, hospitalId);
            ps.setString(4, bloodType != null ? bloodType : "");
            ps.setInt(5, units > 0 ? units : 1);
            ps.setString(6, patientName != null ? patientName : "");
            ps.setString(7, notes != null ? notes : "");
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                return rs.next() ? rs.getInt(1) : 0;
            }
        }
    }

    public void broadcastToDonors(int requestId, List<Integer> donorIds, int hospitalId, String bloodType, int units, String patientName, String notes) throws SQLException {
        ensureTableExists();
        String sql = "INSERT INTO blood_request_notifications (request_id, donor_id, hospital_id, blood_type, units_requested, patient_name, notes, status, notified_at) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, 'NOTIFIED', CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (Integer dId : donorIds) {
                ps.setInt(1, requestId);
                ps.setInt(2, dId);
                ps.setInt(3, hospitalId);
                ps.setString(4, bloodType != null ? bloodType : "");
                ps.setInt(5, units > 0 ? units : 1);
                ps.setString(6, patientName != null ? patientName : "");
                ps.setString(7, notes != null ? notes : "");
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public String getDonorStatusForHospital(int donorId, int hospitalId) {
        ensureTableExists();
        String sql = "SELECT status FROM blood_request_notifications WHERE donor_id = ? AND hospital_id = ? ORDER BY id DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            ps.setInt(2, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String st = rs.getString("status");
                    if (st != null && !st.isBlank()) {
                        return capitalize(st);
                    }
                }
            }
        } catch (Exception ignored) {}
        return "Available";
    }

    public Map<Integer, String> getDonorStatusesForHospital(int hospitalId) {
        ensureTableExists();
        Map<Integer, String> map = new HashMap<>();
        String sql = "SELECT donor_id, status FROM blood_request_notifications WHERE hospital_id = ? ORDER BY id ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    map.put(rs.getInt("donor_id"), capitalize(rs.getString("status")));
                }
            }
        } catch (Exception ignored) {}
        return map;
    }

    public boolean updateDonorResponse(int requestId, int donorId, String status) throws SQLException {
        ensureTableExists();
        String sql = "UPDATE blood_request_notifications SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE request_id = ? AND donor_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.toUpperCase());
            ps.setInt(2, requestId);
            ps.setInt(3, donorId);
            return ps.executeUpdate() > 0;
        }
    }

    private static String capitalize(String str) {
        if (str == null || str.isBlank()) return "Available";
        String s = str.trim().toLowerCase();
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
