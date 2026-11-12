package com.red404.dao;

import com.red404.util.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Data Access Object for real-time user session tracking and remote termination.
 */
public class SessionDao {

    public void recordSession(String sessionId, int userId, String userType,
                              String ipAddress, String userAgent,
                              String device, String browser, String location) {
        recordSession(sessionId, String.valueOf(userId), userType, ipAddress, userAgent, device, browser, location);
    }

    public void recordSession(String sessionId, String userId, String userType,
                              String ipAddress, String userAgent,
                              String device, String browser, String location) {
        if (sessionId == null || sessionId.isBlank() || userId == null || userId.isBlank()) return;
        try (Connection conn = DBConnection.getConnection()) {
            boolean exists = false;
            String checkSql = "SELECT session_id FROM user_sessions WHERE session_id = ?";
            try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
                ps.setString(1, sessionId.trim());
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) exists = true;
                }
            }

            if (exists) {
                String updateSql = "UPDATE user_sessions SET user_id = ?, ip_address = ?, user_agent = ?, " +
                        "device = ?, browser = ?, location = ?, last_active = CURRENT_TIMESTAMP, is_active = TRUE " +
                        "WHERE session_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                    ps.setString(1, userId.trim());
                    ps.setString(2, ipAddress);
                    ps.setString(3, userAgent);
                    ps.setString(4, device);
                    ps.setString(5, browser);
                    ps.setString(6, location);
                    ps.setString(7, sessionId.trim());
                    ps.executeUpdate();
                }
            } else {
                String insertSql = "INSERT INTO user_sessions (session_id, user_id, user_type, ip_address, " +
                        "user_agent, device, browser, location, is_active, created_at, last_active) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
                try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                    ps.setString(1, sessionId.trim());
                    ps.setString(2, userId.trim());
                    ps.setString(3, userType != null ? userType : "DONOR");
                    ps.setString(4, ipAddress);
                    ps.setString(5, userAgent);
                    ps.setString(6, device);
                    ps.setString(7, browser);
                    ps.setString(8, location);
                    ps.executeUpdate();
                }
            }
        } catch (Exception ignored) {
            // Non-blocking database session audit
        }
    }

    public void updateSessionLocation(String sessionId, String location) {
        if (sessionId == null || sessionId.isBlank() || location == null || location.isBlank()) return;
        String sql = "UPDATE user_sessions SET location = ? WHERE session_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, location.trim());
            ps.setString(2, sessionId.trim());
            ps.executeUpdate();
        } catch (Exception ignored) {}
    }

    public List<Map<String, Object>> getActiveSessions(int userId, String userType, String currentSessionId) {
        return getActiveSessions(String.valueOf(userId), userType, currentSessionId);
    }

    public List<Map<String, Object>> getActiveSessions(String userId, String userType, String currentSessionId) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (userId == null || userId.isBlank()) return list;
        // Match user_id either directly or via alternate ID format (e.g. integer or Smart Donor ID)
        String sql = "SELECT * FROM user_sessions WHERE (user_id = ? OR user_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1) OR user_id = (SELECT CAST(id AS CHAR) FROM donors WHERE donor_id = ? LIMIT 1)) AND user_type = ? AND is_active = TRUE ORDER BY last_active DESC";
        SimpleDateFormat sdf = new SimpleDateFormat("MMM d, yyyy, hh:mm a");
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, userId.trim());
            int numericId = 0;
            try { numericId = Integer.parseInt(userId.trim()); } catch (Exception ignored) {}
            ps.setInt(2, numericId);
            ps.setString(3, userId.trim());
            ps.setString(4, userType != null ? userType : "DONOR");
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new LinkedHashMap<>();
                    String sid = rs.getString("session_id");
                    map.put("sessionId", sid);
                    map.put("device", rs.getString("device") != null ? rs.getString("device") : "Unknown Device");
                    map.put("browser", rs.getString("browser") != null ? rs.getString("browser") : "Web Browser");
                    map.put("location", rs.getString("location") != null ? rs.getString("location") : "Unknown Location");
                    map.put("ipAddress", rs.getString("ip_address") != null ? rs.getString("ip_address") : "127.0.0.1");

                    Timestamp created = rs.getTimestamp("created_at");
                    Timestamp lastActive = rs.getTimestamp("last_active");
                    map.put("loginTimestamp", created != null ? sdf.format(created) : "Recently");
                    map.put("lastActive", lastActive != null ? sdf.format(lastActive) : "Active now");
                    map.put("isCurrent", sid != null && sid.equals(currentSessionId));
                    list.add(map);
                }
            }
        } catch (Exception ignored) {}
        return list;
    }

    public boolean killSession(int userId, String userType, String sessionId) {
        return killSession(String.valueOf(userId), userType, sessionId);
    }

    public boolean killSession(String userId, String userType, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return false;
        String sql = "UPDATE user_sessions SET is_active = FALSE WHERE (user_id = ? OR user_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1) OR user_id = (SELECT CAST(id AS CHAR) FROM donors WHERE donor_id = ? LIMIT 1)) AND user_type = ? AND session_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, userId.trim());
            int numericId = 0;
            try { numericId = Integer.parseInt(userId.trim()); } catch (Exception ignored) {}
            ps.setInt(2, numericId);
            ps.setString(3, userId.trim());
            ps.setString(4, userType != null ? userType : "DONOR");
            ps.setString(5, sessionId.trim());
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean killAllExceptCurrent(int userId, String userType, String currentSessionId) {
        return killAllExceptCurrent(String.valueOf(userId), userType, currentSessionId);
    }

    public boolean killAllExceptCurrent(String userId, String userType, String currentSessionId) {
        String sql = "UPDATE user_sessions SET is_active = FALSE WHERE (user_id = ? OR user_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1) OR user_id = (SELECT CAST(id AS CHAR) FROM donors WHERE donor_id = ? LIMIT 1)) AND user_type = ? AND session_id <> ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, userId.trim());
            int numericId = 0;
            try { numericId = Integer.parseInt(userId.trim()); } catch (Exception ignored) {}
            ps.setInt(2, numericId);
            ps.setString(3, userId.trim());
            ps.setString(4, userType != null ? userType : "DONOR");
            ps.setString(5, currentSessionId != null ? currentSessionId.trim() : "");
            return ps.executeUpdate() >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isSessionActive(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return false;
        String sql = "SELECT is_active FROM user_sessions WHERE session_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sessionId.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getBoolean("is_active");
                }
            }
        } catch (Exception e) {
            return true; // Fallback to avoid locking user out if transient
        }
        return true;
    }

    public void touchSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return;
        String sql = "UPDATE user_sessions SET last_active = CURRENT_TIMESTAMP WHERE session_id = ? AND is_active = TRUE";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, sessionId.trim());
            ps.executeUpdate();
        } catch (Exception ignored) {}
    }
}

