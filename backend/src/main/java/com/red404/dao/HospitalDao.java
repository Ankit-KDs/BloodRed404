package com.red404.dao;

import com.red404.util.DBConnection;
import com.red404.util.PasswordUtil;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class HospitalDao {

    public boolean emailExists(String email) throws SQLException {
        String sql = "SELECT id FROM hospitals WHERE hospital_email = ? LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public boolean insert(Map<String, Object> hospital) throws SQLException {
        String sql = "INSERT INTO hospitals (hospital_name, registration_no, hospital_type, beds, blood_bank_license, " +
                "hospital_email, hospital_phone, website, services, admin_name, admin_designation, admin_phone, " +
                "admin_email, password, emergency_contact, address, landmark, city, state, pincode, " +
                "latitude, longitude, zone, operating_hours, zone_radius, sms_notif, push_notif, email_notif) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, str(hospital.get("hospitalName")));
            ps.setString(2, str(hospital.get("registrationNo")));
            ps.setString(3, str(hospital.get("hospitalType")));
            ps.setInt(4, num(hospital.get("beds"), 0));
            ps.setString(5, (String) hospital.get("bloodBankLicense"));
            ps.setString(6, str(hospital.get("hospitalEmail")));
            ps.setString(7, str(hospital.get("hospitalPhone")));
            ps.setString(8, (String) hospital.get("website"));
            ps.setString(9, str(hospital.get("services")));
            ps.setString(10, str(hospital.get("adminName")));
            ps.setString(11, str(hospital.get("adminDesignation")));
            ps.setString(12, str(hospital.get("adminPhone")));
            ps.setString(13, str(hospital.get("adminEmail")));
            String rawPw = str(hospital.get("password")).trim();
            String pwToStore = PasswordUtil.isBCrypt(rawPw) ? rawPw : PasswordUtil.hashPassword(rawPw);
            ps.setString(14, pwToStore);
            ps.setString(15, str(hospital.get("emergencyContact")));
            ps.setString(16, str(hospital.get("address")));
            ps.setString(17, (String) hospital.get("landmark"));
            ps.setString(18, str(hospital.get("city")));
            ps.setString(19, str(hospital.get("state")));
            ps.setString(20, str(hospital.get("pincode")));
            setDouble(ps, 21, (Double) hospital.get("latitude"));
            setDouble(ps, 22, (Double) hospital.get("longitude"));
            ps.setString(23, (String) hospital.get("zone"));
            ps.setString(24, str(hospital.getOrDefault("operatingHours", "24x7")));
            ps.setInt(25, num(hospital.get("zoneRadius"), 10));
            ps.setBoolean(26, bool(hospital.get("smsNotif"), true));
            ps.setBoolean(27, bool(hospital.get("pushNotif"), true));
            ps.setBoolean(28, bool(hospital.get("emailNotif"), false));
            return ps.executeUpdate() > 0;
        }
    }

    public Map<String, Object> findByLogin(String email, String password) throws SQLException {
        if (email == null || password == null) return null;
        String cleanEmail = email.trim();
        String cleanPw = password.trim();
        String digits = cleanEmail.replaceAll("[^0-9]", "");
        String last10 = digits.length() >= 10 ? digits.substring(digits.length() - 10) : digits;

        String sql = "SELECT * FROM hospitals WHERE (" +
                "LOWER(TRIM(hospital_email)) = LOWER(?) " +
                "OR LOWER(TRIM(admin_email)) = LOWER(?) " +
                "OR TRIM(hospital_phone) = ? " +
                "OR TRIM(admin_phone) = ? " +
                "OR (LENGTH(?) >= 10 AND RIGHT(REPLACE(REPLACE(REPLACE(hospital_phone, ' ', ''), '-', ''), '+91', ''), 10) = ?) " +
                "OR (LENGTH(?) >= 10 AND RIGHT(REPLACE(REPLACE(REPLACE(admin_phone, ' ', ''), '-', ''), '+91', ''), 10) = ?) " +
                ")";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanEmail);
            ps.setString(3, cleanEmail);
            ps.setString(4, cleanEmail);
            ps.setString(5, last10);
            ps.setString(6, last10);
            ps.setString(7, last10);
            ps.setString(8, last10);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String storedPw = rs.getString("password");
                    if (PasswordUtil.checkPassword(cleanPw, storedPw)) {
                        int hospId = rs.getInt("id");
                        if (!PasswordUtil.isBCrypt(storedPw)) {
                            try (PreparedStatement up = conn.prepareStatement("UPDATE hospitals SET password = ? WHERE id = ?")) {
                                up.setString(1, PasswordUtil.hashPassword(cleanPw));
                                up.setInt(2, hospId);
                                up.executeUpdate();
                            } catch (Exception ignored) {}
                        }
                        return mapHospital(rs);
                    }
                }
                return null;
            }
        }
    }

    public Map<String, Object> findById(int id) throws SQLException {
        String sql = "SELECT * FROM hospitals WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapHospital(rs) : null;
            }
        }
    }

    public List<Map<String, Object>> listAll() throws SQLException {
        String sql = "SELECT * FROM hospitals ORDER BY hospital_name ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            List<Map<String, Object>> list = new ArrayList<>();
            while (rs.next()) {
                list.add(mapHospital(rs));
            }
            return list;
        }
    }

    public boolean delete(int id) throws SQLException {
        String sql = "DELETE FROM hospitals WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateHospitalName(int hospitalId, String name) throws SQLException {
        if (name == null || name.isBlank()) return false;
        String sql = "UPDATE hospitals SET hospital_name = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, name.trim());
            ps.setInt(2, hospitalId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateHospitalInventory(int hospitalId, String bloodType, int change, Integer exactUnits) throws SQLException {
        if (bloodType == null || bloodType.isBlank()) return false;
        String bt = bloodType.trim().toUpperCase();
        if (exactUnits != null && exactUnits >= 0) {
            String sql = "INSERT INTO hospital_inventory (hospital_id, blood_type, units) VALUES (?, ?, ?) " +
                         "ON DUPLICATE KEY UPDATE units = VALUES(units)";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, hospitalId);
                ps.setString(2, bt);
                ps.setInt(3, exactUnits);
                return ps.executeUpdate() > 0;
            }
        } else {
            String sql = "INSERT INTO hospital_inventory (hospital_id, blood_type, units) VALUES (?, ?, GREATEST(0, ?)) " +
                         "ON DUPLICATE KEY UPDATE units = GREATEST(0, units + ?)";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setInt(1, hospitalId);
                ps.setString(2, bt);
                ps.setInt(3, Math.max(0, change));
                ps.setInt(4, change);
                return ps.executeUpdate() > 0;
            }
        }
    }

    public Map<String, Integer> getHospitalInventory(int hospitalId) throws SQLException {
        Map<String, Integer> map = new java.util.LinkedHashMap<>();
        String sql = "SELECT blood_type, units FROM hospital_inventory WHERE hospital_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String bt = rs.getString("blood_type");
                    int u = rs.getInt("units");
                    if (bt != null) {
                        map.put(bt.toUpperCase(), Math.max(0, u));
                    }
                }
            }
        }
        return map;
    }

    private Map<String, Object> mapHospital(ResultSet rs) throws SQLException {
        Map<String, Object> hospital = new HashMap<>();
        hospital.put("id", rs.getInt("id"));
        hospital.put("name", rs.getString("hospital_name"));
        hospital.put("hospitalName", rs.getString("hospital_name"));
        hospital.put("hospital_name", rs.getString("hospital_name"));
        hospital.put("email", rs.getString("hospital_email"));
        hospital.put("hospitalEmail", rs.getString("hospital_email"));
        hospital.put("phone", rs.getString("hospital_phone"));
        hospital.put("hospitalPhone", rs.getString("hospital_phone"));
        hospital.put("city", rs.getString("city"));
        hospital.put("state", rs.getString("state"));
        hospital.put("zone", rs.getString("zone"));
        hospital.put("radius", rs.getInt("zone_radius"));
        hospital.put("zoneRadius", rs.getInt("zone_radius"));
        hospital.put("type", rs.getString("hospital_type"));
        hospital.put("hospitalType", rs.getString("hospital_type"));
        hospital.put("registrationNo", rs.getString("registration_no"));
        hospital.put("beds", rs.getInt("beds"));
        hospital.put("bloodBankLicense", rs.getString("blood_bank_license"));
        hospital.put("website", rs.getString("website"));
        hospital.put("services", rs.getString("services"));
        hospital.put("adminName", rs.getString("admin_name"));
        hospital.put("adminDesignation", rs.getString("admin_designation"));
        hospital.put("adminPhone", rs.getString("admin_phone"));
        hospital.put("adminEmail", rs.getString("admin_email"));
        hospital.put("emergencyContact", rs.getString("emergency_contact"));
        hospital.put("address", rs.getString("address"));
        hospital.put("landmark", rs.getString("landmark"));
        hospital.put("pincode", rs.getString("pincode"));
        hospital.put("latitude", rs.getObject("latitude"));
        hospital.put("longitude", rs.getObject("longitude"));
        hospital.put("operatingHours", rs.getString("operating_hours"));
        hospital.put("smsNotif", rs.getBoolean("sms_notif"));
        hospital.put("pushNotif", rs.getBoolean("push_notif"));
        hospital.put("emailNotif", rs.getBoolean("email_notif"));
        java.sql.Timestamp ts = rs.getTimestamp("created_at");
        hospital.put("createdAt", ts != null ? ts.toString() : null);
        return hospital;
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

    private static int num(Object value, int fallback) {
        return value instanceof Number ? ((Number) value).intValue() : fallback;
    }

    private static boolean bool(Object value, boolean fallback) {
        return value instanceof Boolean ? (Boolean) value : fallback;
    }
}
