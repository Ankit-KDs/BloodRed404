package com.red404.dao;

import com.red404.util.DBConnection;
import com.red404.util.PasswordUtil;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
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
                "latitude, longitude, zone, operating_hours, zone_radius, sms_notif, push_notif, email_notif, " +
                "verification_status, application_ref, eraktkosh_id, emergency_public, documents_json) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
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
            setDouble(ps, 21, numDouble(hospital.get("latitude")));
            setDouble(ps, 22, numDouble(hospital.get("longitude")));
            ps.setString(23, (String) hospital.get("zone"));
            ps.setString(24, str(hospital.getOrDefault("operatingHours", "24x7")));
            ps.setInt(25, num(hospital.get("zoneRadius"), 10));
            ps.setBoolean(26, bool(hospital.get("smsNotif"), false));
            ps.setBoolean(27, bool(hospital.get("pushNotif"), true));
            ps.setBoolean(28, bool(hospital.get("emailNotif"), true));
            ps.setString(29, str(hospital.getOrDefault("verificationStatus", "pending_review")));
            ps.setString(30, (String) hospital.get("applicationRef"));
            ps.setString(31, (String) hospital.get("eraktkoshId"));
            ps.setBoolean(32, bool(hospital.get("emergencyPublic"), true));
            ps.setString(33, (String) hospital.get("documentsJson"));
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

    public Map<String, Object> findByEmail(String email) throws SQLException {
        String sql = "SELECT * FROM hospitals WHERE LOWER(hospital_email) = LOWER(?) LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
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

    public boolean updateHospitalLocation(int hospitalId, String address, Double latitude, Double longitude) throws SQLException {
        String sql = (address != null && !address.isBlank())
                ? "UPDATE hospitals SET address = ?, latitude = ?, longitude = ? WHERE id = ?"
                : "UPDATE hospitals SET latitude = ?, longitude = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            if (address != null && !address.isBlank()) {
                ps.setString(idx++, address.trim());
            }
            setDouble(ps, idx++, latitude);
            setDouble(ps, idx++, longitude);
            ps.setInt(idx, hospitalId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateHospitalProfile(int hospitalId, Map<String, Object> updates) throws SQLException {
        if (updates == null || updates.isEmpty()) return false;
        StringBuilder sql = new StringBuilder("UPDATE hospitals SET ");
        List<Object> values = new ArrayList<>();
        boolean first = true;

        String[] allowed = {
            "hospital_name", "hospital_type", "registration_no", "blood_bank_license",
            "address", "city", "district", "state", "pincode", "hospital_phone", "emergency_contact",
            "admin_name", "admin_designation", "operating_hours", "verification_status"
        };
        for (String col : allowed) {
            String camel = toCamel(col);
            if (updates.containsKey(col) || updates.containsKey(camel)) {
                Object val = updates.containsKey(col) ? updates.get(col) : updates.get(camel);
                if (!first) sql.append(", ");
                sql.append(col).append(" = ?");
                values.add(val != null ? String.valueOf(val).trim() : null);
                first = false;
            }
        }
        if (updates.containsKey("latitude") || updates.containsKey("lat")) {
            Object val = updates.containsKey("latitude") ? updates.get("latitude") : updates.get("lat");
            if (!first) sql.append(", ");
            sql.append("latitude = ?");
            values.add(val instanceof Number ? ((Number) val).doubleValue() : (val != null ? Double.valueOf(val.toString()) : null));
            first = false;
        }
        if (updates.containsKey("longitude") || updates.containsKey("lng")) {
            Object val = updates.containsKey("longitude") ? updates.get("longitude") : updates.get("lng");
            if (!first) sql.append(", ");
            sql.append("longitude = ?");
            values.add(val instanceof Number ? ((Number) val).doubleValue() : (val != null ? Double.valueOf(val.toString()) : null));
            first = false;
        }

        if (first) return false;
        sql.append(" WHERE id = ?");
        values.add(hospitalId);

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < values.size(); i++) {
                Object v = values.get(i);
                if (v == null) {
                    ps.setNull(i + 1, Types.VARCHAR);
                } else if (v instanceof Double d) {
                    ps.setDouble(i + 1, d);
                } else if (v instanceof Integer n) {
                    ps.setInt(i + 1, n);
                } else {
                    ps.setString(i + 1, v.toString());
                }
            }
            return ps.executeUpdate() > 0;
        }
    }

    private static String toCamel(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean upper = false;
        for (char c : snake.toCharArray()) {
            if (c == '_') {
                upper = true;
            } else if (upper) {
                sb.append(Character.toUpperCase(c));
                upper = false;
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public boolean updateHospitalInventory(int hospitalId, String bloodType, int change, Integer exactUnits) throws SQLException {
        if (bloodType == null || bloodType.isBlank()) return false;
        String bt = com.red404.service.StockService.normalizeGroup(bloodType);
        if (exactUnits != null && exactUnits >= 0) {
            com.red404.service.StockService.setExactStock(hospitalId, bt, exactUnits, "Inventory set to exact units: " + exactUnits, "Hospital Staff");
            return true;
        } else {
            com.red404.service.StockService.adjustStock(hospitalId, bt, change, "Inventory adjust: " + (change >= 0 ? "+" + change : change), "Hospital Staff");
            return true;
        }
    }

    public Map<String, Integer> getHospitalInventory(int hospitalId) throws SQLException {
        Map<String, Object> stock = com.red404.service.StockService.getHospitalStock(hospitalId);
        @SuppressWarnings("unchecked")
        Map<String, Integer> inv = (Map<String, Integer>) stock.get("inventory");
        return inv != null ? inv : Collections.emptyMap();
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
        try {
            hospital.put("district", rs.getString("district"));
        } catch (SQLException ignored) {
            hospital.put("district", null);
        }
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
        Object rawLat = rs.getObject("latitude");
        Object rawLng = rs.getObject("longitude");
        Double latVal = (rawLat instanceof Number) ? ((Number) rawLat).doubleValue() : null;
        Double lngVal = (rawLng instanceof Number) ? ((Number) rawLng).doubleValue() : null;
        hospital.put("latitude", latVal);
        hospital.put("longitude", lngVal);
        hospital.put("lat", latVal);
        hospital.put("lng", lngVal);
        hospital.put("operatingHours", rs.getString("operating_hours"));
        hospital.put("smsNotif", rs.getBoolean("sms_notif"));
        hospital.put("pushNotif", rs.getBoolean("push_notif"));
        hospital.put("emailNotif", rs.getBoolean("email_notif"));
        String vStatus = "pending_review";
        try {
            String dbStatus = rs.getString("verification_status");
            if (dbStatus != null && !dbStatus.isBlank()) {
                String s = dbStatus.trim().toLowerCase();
                if ("approved".equals(s) || "active".equals(s) || "verified".equals(s)) {
                    vStatus = "verified";
                } else {
                    vStatus = s;
                }
            }
        } catch (Exception ignored) {}
        hospital.put("verificationStatus", vStatus);
        hospital.put("verification_status", vStatus);
        try { hospital.put("applicationRef", rs.getString("application_ref")); } catch (Exception ignored) {}
        try { hospital.put("eraktkoshId", rs.getString("eraktkosh_id")); } catch (Exception ignored) {}
        try { hospital.put("emergencyPublic", rs.getBoolean("emergency_public")); } catch (Exception ignored) {}
        try { hospital.put("documentsJson", rs.getString("documents_json")); } catch (Exception ignored) {}
        java.sql.Timestamp ts = rs.getTimestamp("created_at");
        hospital.put("createdAt", ts != null ? ts.toString() : null);
        return hospital;
    }

    public boolean updateApplicationDocuments(int hospitalId, String documentsJson) throws SQLException {
        String sql = "UPDATE hospitals SET documents_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, documentsJson);
            ps.setInt(2, hospitalId);
            return ps.executeUpdate() > 0;
        }
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

    private static Double numDouble(Object value) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        if (value instanceof String s && !s.isBlank()) {
            try { return Double.parseDouble(s.trim()); } catch (Exception ignored) {}
        }
        return null;
    }

    private static boolean bool(Object value, boolean fallback) {
        return value instanceof Boolean ? (Boolean) value : fallback;
    }
}
