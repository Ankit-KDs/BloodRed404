package com.red404.dao;

import com.red404.util.DBConnection;

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
            ps.setString(14, str(hospital.get("password")));
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
        String sql = "SELECT * FROM hospitals WHERE hospital_email = ? AND password = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            ps.setString(2, password);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapHospital(rs) : null;
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

    private Map<String, Object> mapHospital(ResultSet rs) throws SQLException {
        Map<String, Object> hospital = new HashMap<>();
        hospital.put("id", rs.getInt("id"));
        hospital.put("name", rs.getString("hospital_name"));
        hospital.put("hospitalName", rs.getString("hospital_name"));
        hospital.put("email", rs.getString("hospital_email"));
        hospital.put("phone", rs.getString("hospital_phone"));
        hospital.put("city", rs.getString("city"));
        hospital.put("state", rs.getString("state"));
        hospital.put("zone", rs.getString("zone"));
        hospital.put("radius", rs.getInt("zone_radius"));
        hospital.put("type", rs.getString("hospital_type"));
        hospital.put("registrationNo", rs.getString("registration_no"));
        hospital.put("beds", rs.getInt("beds"));
        hospital.put("adminName", rs.getString("admin_name"));
        hospital.put("latitude", rs.getObject("latitude"));
        hospital.put("longitude", rs.getObject("longitude"));
        hospital.put("address", rs.getString("address"));
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
