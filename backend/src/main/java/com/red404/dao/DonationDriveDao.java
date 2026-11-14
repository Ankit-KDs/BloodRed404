package com.red404.dao;

import com.red404.util.BloodCompatibilityUtil;
import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class DonationDriveDao {

    private static final Logger log = LoggerFactory.getLogger(DonationDriveDao.class);
    private static volatile boolean tablesEnsured = false;

    public DonationDriveDao() {
        ensureTablesExist();
    }

    public synchronized void ensureTablesExist() {
        if (tablesEnsured) return;
        try (Connection conn = DBConnection.getConnection();
             Statement st = conn.createStatement()) {

            st.execute("CREATE TABLE IF NOT EXISTS donation_drives (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "title VARCHAR(200) NOT NULL DEFAULT 'Blood donation drive', " +
                    "blood_groups VARCHAR(150) NOT NULL, " +
                    "drive_date DATE NOT NULL, " +
                    "start_time VARCHAR(20) NOT NULL, " +
                    "end_time VARCHAR(20) NOT NULL, " +
                    "venue VARCHAR(255) NOT NULL, " +
                    "target_units INT DEFAULT NULL, " +
                    "radius INT NOT NULL DEFAULT 10, " +
                    "notes TEXT DEFAULT NULL, " +
                    "status VARCHAR(30) NOT NULL DEFAULT 'upcoming', " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            st.execute("CREATE TABLE IF NOT EXISTS donation_drive_rsvps (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "drive_id INT NOT NULL, " +
                    "donor_id VARCHAR(50) NOT NULL, " +
                    "status VARCHAR(20) NOT NULL DEFAULT 'ATTENDING', " +
                    "responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "UNIQUE KEY uq_drive_donor (drive_id, donor_id)" +
                    ")");

            st.execute("CREATE TABLE IF NOT EXISTS donation_drive_invitations (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "drive_id INT NOT NULL, " +
                    "donor_id VARCHAR(50) NOT NULL, " +
                    "sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "UNIQUE KEY uq_inv_drive_donor (drive_id, donor_id)" +
                    ")");

            tablesEnsured = true;
            log.info("Donation drive tables initialized successfully.");
        } catch (Exception e) {
            log.warn("Notice ensuring donation drive tables: {}", e.getMessage());
        }
    }

    public int createDrive(int hospitalId, String title, String bloodGroups, String driveDate,
                           String startTime, String endTime, String venue, Integer targetUnits,
                           int radius, String notes) throws SQLException {
        ensureTablesExist();
        String sql = "INSERT INTO donation_drives " +
                "(hospital_id, title, blood_groups, drive_date, start_time, end_time, venue, target_units, radius, notes, status) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, hospitalId);
            ps.setString(2, (title != null && !title.isBlank()) ? title.trim() : "Blood donation drive");
            ps.setString(3, (bloodGroups != null && !bloodGroups.isBlank()) ? bloodGroups.trim() : "All");
            ps.setDate(4, Date.valueOf(driveDate));
            ps.setString(5, (startTime != null && !startTime.isBlank()) ? startTime.trim() : "09:00");
            ps.setString(6, (endTime != null && !endTime.isBlank()) ? endTime.trim() : "17:00");
            ps.setString(7, (venue != null && !venue.isBlank()) ? venue.trim() : "Hospital Blood Bank");
            if (targetUnits != null && targetUnits > 0) {
                ps.setInt(8, targetUnits);
            } else {
                ps.setNull(8, Types.INTEGER);
            }
            ps.setInt(9, radius > 0 ? radius : 10);
            ps.setString(10, notes != null ? notes.trim() : null);

            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    public List<Map<String, Object>> listDrivesForHospital(int hospitalId) throws SQLException {
        ensureTablesExist();
        String sql = "SELECT d.*, " +
                "  (SELECT COUNT(*) FROM donation_drive_rsvps r WHERE r.drive_id = d.id AND UPPER(r.status) = 'ATTENDING') AS attending_count " +
                "FROM donation_drives d " +
                "WHERE d.hospital_id = ? " +
                "ORDER BY CASE WHEN d.status = 'upcoming' THEN 0 ELSE 1 END, d.drive_date ASC, d.created_at DESC";

        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getInt("id"));
                    row.put("hospitalId", rs.getInt("hospital_id"));
                    row.put("title", rs.getString("title"));
                    row.put("bloodGroups", rs.getString("blood_groups"));
                    row.put("driveDate", rs.getString("drive_date"));
                    row.put("startTime", rs.getString("start_time"));
                    row.put("endTime", rs.getString("end_time"));
                    row.put("venue", rs.getString("venue"));
                    row.put("targetUnits", rs.getObject("target_units"));
                    row.put("radius", rs.getInt("radius"));
                    row.put("notes", rs.getString("notes"));
                    row.put("status", rs.getString("status"));
                    row.put("attendingCount", rs.getInt("attending_count"));
                    row.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(row);
                }
            }
        }
        return list;
    }

    public boolean updateStatus(int driveId, int hospitalId, String status) throws SQLException {
        ensureTablesExist();
        String sql = "UPDATE donation_drives SET status = ? WHERE id = ? AND hospital_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setInt(2, driveId);
            ps.setInt(3, hospitalId);
            return ps.executeUpdate() > 0;
        }
    }

    public void recordInvitations(int driveId, List<String> donorIds) {
        if (donorIds == null || donorIds.isEmpty()) return;
        ensureTablesExist();
        String sql = "INSERT IGNORE INTO donation_drive_invitations (drive_id, donor_id) VALUES (?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (String did : donorIds) {
                ps.setInt(1, driveId);
                ps.setString(2, did);
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (Exception e) {
            log.warn("Notice recording drive invitations: {}", e.getMessage());
        }
    }

    public boolean saveRsvp(int driveId, String donorId, String status) throws SQLException {
        ensureTablesExist();
        String sql = "INSERT INTO donation_drive_rsvps (drive_id, donor_id, status, responded_at) " +
                "VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
                "ON DUPLICATE KEY UPDATE status = VALUES(status), responded_at = CURRENT_TIMESTAMP";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, driveId);
            ps.setString(2, donorId);
            ps.setString(3, status);
            return ps.executeUpdate() > 0;
        }
    }

    public List<Map<String, Object>> listUpcomingInvitationsForDonor(String donorId, String bloodType, Double lat, Double lng) throws SQLException {
        ensureTablesExist();
        String sql = "SELECT d.*, h.hospital_name, h.address AS hospital_address, h.city AS hospital_city, " +
                "  h.latitude AS hosp_lat, h.longitude AS hosp_lng, " +
                "  r.status AS rsvp_status " +
                "FROM donation_drives d " +
                "JOIN hospitals h ON d.hospital_id = h.id " +
                "LEFT JOIN donation_drive_rsvps r ON r.drive_id = d.id AND r.donor_id = ? " +
                "WHERE d.status = 'upcoming' AND d.drive_date >= CURRENT_DATE " +
                "ORDER BY d.drive_date ASC, d.created_at DESC";

        List<Map<String, Object>> matches = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String neededGroups = rs.getString("blood_groups");
                    int radius = rs.getInt("radius");
                    Double hLat = rs.getObject("hosp_lat") != null ? rs.getDouble("hosp_lat") : null;
                    Double hLng = rs.getObject("hosp_lng") != null ? rs.getDouble("hosp_lng") : null;

                    // Compatibility check
                    boolean compatible = false;
                    if (neededGroups == null || neededGroups.equalsIgnoreCase("All") || neededGroups.isBlank()) {
                        compatible = true;
                    } else if (bloodType != null) {
                        String[] reqGroups = neededGroups.split("[,;/ ]+");
                        for (String rg : reqGroups) {
                            if (!rg.isBlank() && BloodCompatibilityUtil.isCompatible(bloodType, rg.trim())) {
                                compatible = true;
                                break;
                            }
                        }
                    }

                    if (!compatible) continue;

                    // Radius filter
                    double distance = 0.0;
                    if (lat != null && lng != null && hLat != null && hLng != null) {
                        distance = DistanceCalculator.calculateDistance(lat, lng, hLat, hLng);
                        if (distance > radius) continue;
                    }

                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getInt("id"));
                    row.put("hospitalId", rs.getInt("hospital_id"));
                    row.put("hospitalName", rs.getString("hospital_name"));
                    row.put("title", rs.getString("title"));
                    row.put("bloodGroups", neededGroups);
                    row.put("driveDate", rs.getString("drive_date"));
                    row.put("startTime", rs.getString("start_time"));
                    row.put("endTime", rs.getString("end_time"));
                    row.put("venue", rs.getString("venue"));
                    row.put("targetUnits", rs.getObject("target_units"));
                    row.put("radius", radius);
                    row.put("distanceKm", Math.round(distance * 10.0) / 10.0);
                    row.put("notes", rs.getString("notes"));
                    row.put("status", rs.getString("status"));
                    row.put("rsvpStatus", rs.getString("rsvp_status"));
                    matches.add(row);
                }
            }
        }
        return matches;
    }
}
