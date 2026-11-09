package com.red404.dao;

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

import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;

public class DonorDao {

    public boolean emailOrPhoneExists(String email, String phone) throws SQLException {
        String cleanEmail = email != null ? email.trim().toLowerCase() : "";
        String cleanPhone = phone != null ? phone.trim() : "";
        String sql = "SELECT id FROM donors WHERE LOWER(TRIM(email)) = ? OR TRIM(phone) = ? LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanPhone);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public boolean insert(Map<String, Object> donor) throws SQLException {
        String sql = "INSERT INTO donors (name, email, phone, dob, gender, password, blood_type, weight, " +
                "last_donation, availability, address, city, state, pincode, latitude, longitude, zone, " +
                "sms_notif, push_notif, email_notif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, str(donor.get("name")).trim());
            String email = str(donor.get("email")).trim().toLowerCase();
            String phone = str(donor.get("phone")).trim();
            String password = str(donor.get("password")).trim();
            ps.setString(2, email);
            ps.setString(3, phone);
            setDate(ps, 4, (Date) donor.get("dob"));
            ps.setString(5, str(donor.get("gender")));
            ps.setString(6, password);
            ps.setString(7, str(donor.get("bloodType")));
            ps.setDouble(8, donor.get("weight") == null ? 0 : ((Number) donor.get("weight")).doubleValue());
            setDate(ps, 9, (Date) donor.get("lastDonation"));
            ps.setString(10, str(donor.getOrDefault("availability", "Available")));
            ps.setString(11, str(donor.get("address")));
            ps.setString(12, str(donor.get("city")));
            ps.setString(13, str(donor.get("state")));
            ps.setString(14, str(donor.get("pincode")));
            setDouble(ps, 15, (Double) donor.get("latitude"));
            setDouble(ps, 16, (Double) donor.get("longitude"));
            ps.setString(17, (String) donor.get("zone"));
            ps.setBoolean(18, bool(donor.get("smsNotif"), true));
            ps.setBoolean(19, bool(donor.get("pushNotif"), true));
            ps.setBoolean(20, bool(donor.get("emailNotif"), false));
            return ps.executeUpdate() > 0;
        }
    }

    public Map<String, Object> findByLogin(String identifier, String password) throws SQLException {
        if (identifier == null || password == null) return null;
        String cleanId = identifier.trim();
        String cleanPw = password.trim();
        String sql = "SELECT * FROM donors WHERE (LOWER(TRIM(email)) = LOWER(?) OR TRIM(phone) = ?) AND TRIM(password) = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanId);
            ps.setString(2, cleanId);
            ps.setString(3, cleanPw);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapDonor(rs, true) : null;
            }
        }
    }

    public Map<String, Object> findById(int id) throws SQLException {
        String sql = "SELECT * FROM donors WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapDonor(rs, true) : null;
            }
        }
    }

    public boolean updateAvailability(int id, boolean available) throws SQLException {
        String sql = "UPDATE donors SET availability = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, available ? "Available" : "Unavailable");
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateProfile(int id, Map<String, Object> fields) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "UPDATE donors SET " +
                "name = COALESCE(?, name), " +
                "father_name = ?, " +
                "phone = COALESCE(?, phone), " +
                "blood_type = COALESCE(?, blood_type), " +
                "gender = COALESCE(?, gender), " +
                "dob = ?, " +
                "address = ?, " +
                "city = ?, " +
                "state = ?, " +
                "pincode = ?, " +
                "weight = ?, " +
                "pulse = ?, " +
                "hemoglobin = ?, " +
                "blood_pressure = ?, " +
                "body_temp = ?, " +
                "allergies = ?, " +
                "conditions = ?, " +
                "medications = ?, " +
                "surgeries = ?, " +
                "donor_type = ?, " +
                "verified_facility = ?, " +
                "last_donation = ?, " +
                "qr_token = COALESCE(?, qr_token), " +
                "availability = COALESCE(?, availability) " +
                "WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            ps.setString(idx++, emptyToNull(str(fields.get("name") != null ? fields.get("name") : fields.get("fullName"))));
            ps.setString(idx++, emptyToNull(str(fields.get("father_name") != null ? fields.get("father_name") : fields.get("fatherName"))));
            ps.setString(idx++, emptyToNull(str(fields.get("phone"))));
            ps.setString(idx++, emptyToNull(str(fields.get("blood_type") != null ? fields.get("blood_type") : fields.get("bloodType"))));
            ps.setString(idx++, emptyToNull(str(fields.get("gender"))));

            Date dob = null;
            Object dobObj = fields.get("dob") != null ? fields.get("dob") : fields.get("dateOfBirth");
            if (dobObj instanceof Date) dob = (Date) dobObj;
            else if (dobObj instanceof java.util.Date) dob = new Date(((java.util.Date) dobObj).getTime());
            else if (dobObj != null && !str(dobObj).isBlank()) {
                try { dob = Date.valueOf(str(dobObj).trim()); } catch (Exception ignored) {}
            }
            setDate(ps, idx++, dob);

            ps.setString(idx++, emptyToNull(str(fields.get("address"))));
            ps.setString(idx++, emptyToNull(str(fields.get("city"))));
            ps.setString(idx++, emptyToNull(str(fields.get("state"))));
            ps.setString(idx++, emptyToNull(str(fields.get("pincode"))));

            if (fields.get("weight") == null || str(fields.get("weight")).isBlank()) {
                ps.setNull(idx++, Types.DOUBLE);
            } else {
                ps.setDouble(idx++, ((Number) fields.get("weight")).doubleValue());
            }

            if (fields.get("pulse") == null || str(fields.get("pulse")).isBlank()) {
                ps.setNull(idx++, Types.INTEGER);
            } else {
                ps.setInt(idx++, ((Number) fields.get("pulse")).intValue());
            }

            if (fields.get("hemoglobin") == null || str(fields.get("hemoglobin")).isBlank()) {
                ps.setNull(idx++, Types.DOUBLE);
            } else {
                ps.setDouble(idx++, ((Number) fields.get("hemoglobin")).doubleValue());
            }

            ps.setString(idx++, emptyToNull(str(fields.get("blood_pressure") != null ? fields.get("blood_pressure") : fields.get("bloodPressure"))));

            if ((fields.get("body_temp") == null && fields.get("bodyTemp") == null) || str(fields.get("body_temp") != null ? fields.get("body_temp") : fields.get("bodyTemp")).isBlank()) {
                ps.setNull(idx++, Types.DOUBLE);
            } else {
                Object bt = fields.get("body_temp") != null ? fields.get("body_temp") : fields.get("bodyTemp");
                ps.setDouble(idx++, ((Number) bt).doubleValue());
            }

            ps.setString(idx++, emptyToNull(str(fields.get("allergies"))));
            ps.setString(idx++, emptyToNull(str(fields.get("conditions"))));
            ps.setString(idx++, emptyToNull(str(fields.get("medications"))));
            ps.setString(idx++, emptyToNull(str(fields.get("surgeries"))));
            ps.setString(idx++, emptyToNull(str(fields.get("donor_type") != null ? fields.get("donor_type") : fields.get("donorType"))));
            ps.setString(idx++, emptyToNull(str(fields.get("verified_facility") != null ? fields.get("verified_facility") : fields.get("verifiedFacility"))));

            Date lastDon = null;
            Object ldObj = fields.get("last_donation") != null ? fields.get("last_donation") : fields.get("lastDonationDate");
            if (ldObj == null) ldObj = fields.get("lastDonation");
            if (ldObj instanceof Date) lastDon = (Date) ldObj;
            else if (ldObj instanceof java.util.Date) lastDon = new Date(((java.util.Date) ldObj).getTime());
            else if (ldObj != null && !str(ldObj).isBlank()) {
                try { lastDon = Date.valueOf(str(ldObj).trim()); } catch (Exception ignored) {}
            }
            setDate(ps, idx++, lastDon);

            ps.setString(idx++, emptyToNull(str(fields.get("qr_token") != null ? fields.get("qr_token") : fields.get("qrToken"))));
            ps.setString(idx++, emptyToNull(str(fields.get("availability"))));
            ps.setInt(idx, id);

            return ps.executeUpdate() > 0;
        }
    }

    private void ensureDonorColumnsExist() {
        try (Connection conn = DBConnection.getConnection()) {
            ensureCol(conn, "father_name", "VARCHAR(150) NULL");
            ensureCol(conn, "pulse", "INT NULL");
            ensureCol(conn, "hemoglobin", "DOUBLE NULL");
            ensureCol(conn, "blood_pressure", "VARCHAR(30) NULL");
            ensureCol(conn, "body_temp", "DOUBLE NULL");
            ensureCol(conn, "verified_facility", "VARCHAR(150) NULL");
            ensureCol(conn, "verified_date", "DATE NULL");
            ensureCol(conn, "allergies", "VARCHAR(255) NULL");
            ensureCol(conn, "conditions", "VARCHAR(255) NULL");
            ensureCol(conn, "medications", "VARCHAR(255) NULL");
            ensureCol(conn, "surgeries", "VARCHAR(255) NULL");
            ensureCol(conn, "donor_type", "VARCHAR(80) NULL");
            ensureCol(conn, "qr_token", "VARCHAR(100) NULL");
            ensureCol(conn, "last_donation", "DATE NULL");

            try (Statement st = conn.createStatement()) {
                st.executeUpdate("UPDATE donors SET father_name = NULL WHERE father_name LIKE '%Rajesh%'");
                st.executeUpdate("UPDATE donors SET allergies = NULL WHERE allergies LIKE '%No Known Drug%' OR allergies LIKE '%NKDA%'");
                st.executeUpdate("UPDATE donors SET conditions = NULL WHERE conditions LIKE '%Normal Screening%' OR conditions LIKE '%None Reported%'");
                st.executeUpdate("UPDATE donors SET medications = NULL WHERE medications LIKE '%Unrestricted%' OR medications LIKE 'None%'");
                st.executeUpdate("UPDATE donors SET surgeries = NULL WHERE surgeries LIKE '%None Reported%' OR surgeries LIKE '%< 12%'");
                st.executeUpdate("UPDATE donors SET verified_facility = NULL WHERE verified_facility LIKE '%City General%'");
            } catch (Exception ignored) {}
        } catch (Exception ignored) {}
    }

    private void ensureCol(Connection conn, String colName, String colDef) {
        try {
            boolean exists = false;
            try (ResultSet rs = conn.getMetaData().getColumns(null, null, "donors", colName)) {
                if (rs.next()) exists = true;
            }
            if (!exists) {
                try (ResultSet rs = conn.getMetaData().getColumns(null, null, "DONORS", colName.toUpperCase())) {
                    if (rs.next()) exists = true;
                }
            }
            if (!exists) {
                try (Statement st = conn.createStatement()) {
                    st.executeUpdate("ALTER TABLE donors ADD COLUMN " + colName + " " + colDef);
                }
            }
        } catch (Exception ignored) {}
    }

    public Map<String, Object> findByToken(String token) throws SQLException {
        if (token == null || token.isBlank()) return null;
        String trimmed = token.trim();
        String sql = "SELECT * FROM donors WHERE qr_token = ? LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, trimmed);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapDonor(rs, true);
            }
        }
        // Extract numeric ID from token e.g. #RED-UP-7951 or 7951 or 1
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)").matcher(trimmed);
        if (m.find()) {
            int num = Integer.parseInt(m.group(1));
            int id = num > 7950 ? num - 7950 : num;
            Map<String, Object> found = findById(id);
            if (found != null) return found;
        }
        return null;
    }

    public boolean updatePassword(int id, String currentPassword, String newPassword) throws SQLException {
        String sql = "UPDATE donors SET password = ? WHERE id = ? AND password = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newPassword);
            ps.setInt(2, id);
            ps.setString(3, currentPassword);
            return ps.executeUpdate() > 0;
        }
    }

    public List<Map<String, Object>> findNearby(Double lat, Double lng, double radiusKm, String bloodType) throws SQLException {
        String sql = "SELECT * FROM donors WHERE (availability IS NULL OR availability <> 'Unavailable')";
        List<Map<String, Object>> results = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                Map<String, Object> donor = mapDonor(rs, false);
                Object latObj = donor.get("latitude");
                Object lngObj = donor.get("longitude");
                double distance = 0.0;
                if (lat != null && lng != null && latObj instanceof Number && lngObj instanceof Number) {
                    double donorLat = ((Number) latObj).doubleValue();
                    double donorLng = ((Number) lngObj).doubleValue();
                    distance = DistanceCalculator.calculateDistance(lat, lng, donorLat, donorLng);
                    if (distance > radiusKm) {
                        continue;
                    }
                }
                if (bloodType != null && !bloodType.isBlank()
                        && !DistanceCalculator.isCompatibleBloodType(str(donor.get("bloodType")), bloodType)
                        && !bloodType.equalsIgnoreCase(str(donor.get("bloodType")))) {
                    continue;
                }
                donor.put("distance", distance);
                donor.put("status", "online");
                results.add(donor);
            }
        }
        results.sort((a, b) -> Double.compare(
                ((Number) a.getOrDefault("distance", 0)).doubleValue(),
                ((Number) b.getOrDefault("distance", 0)).doubleValue()));
        return results;
    }

    public List<Map<String, Object>> donationHistory(int donorId) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        String sql = "SELECT d.id AS donationId, d.donation_date AS donationDate, h.hospital_name AS hospitalName, " +
                "d.blood_type AS bloodType, d.units, d.status FROM donations d " +
                "LEFT JOIN hospitals h ON d.hospital_id = h.id WHERE d.donor_id = ? ORDER BY d.donation_date DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("donationId", rs.getInt("donationId"));
                    row.put("id", "RED-" + String.format("%05d", rs.getInt("donationId")));
                    Date date = rs.getDate("donationDate");
                    row.put("donationDate", date == null ? null : date.toString());
                    row.put("date", date == null ? null : date.toString());
                    String hospName = rs.getString("hospitalName");
                    row.put("hospitalName", hospName != null && !hospName.isBlank() ? hospName : "City General Hospital");
                    row.put("hospital", hospName != null && !hospName.isBlank() ? hospName : "City General Hospital");
                    row.put("bloodType", rs.getString("bloodType"));
                    int units = rs.getInt("units");
                    row.put("units", units > 0 ? units : 1);
                    row.put("unitsDonated", (units > 0 ? units : 1) + " Unit");
                    row.put("donationType", "Whole Blood");
                    String status = rs.getString("status");
                    row.put("status", status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            if (isMissingTable(e)) {
                return rows;
            }
            throw e;
        }
        return rows;
    }

    public boolean recordDonation(int donorId, Integer hospitalId, String bloodType, int units, String status) throws SQLException {
        String sql = "INSERT INTO donations (donor_id, hospital_id, blood_type, units, donation_date, status) VALUES (?, ?, ?, ?, CURRENT_DATE, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            if (hospitalId == null || hospitalId <= 0) {
                ps.setNull(2, Types.INTEGER);
            } else {
                ps.setInt(2, hospitalId);
            }
            ps.setString(3, bloodType != null && !bloodType.isBlank() ? bloodType : "O-");
            ps.setInt(4, units > 0 ? units : 1);
            ps.setString(5, status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
            int inserted = ps.executeUpdate();
            if (inserted > 0) {
                try (PreparedStatement upd = conn.prepareStatement("UPDATE donors SET last_donation = CURRENT_DATE WHERE id = ?")) {
                    upd.setInt(1, donorId);
                    upd.executeUpdate();
                } catch (SQLException ignored) {}
            }
            return inserted > 0;
        } catch (SQLException e) {
            if (isMissingTable(e)) {
                return false;
            }
            throw e;
        }
    }

    private Map<String, Object> mapDonor(ResultSet rs, boolean includePrivate) throws SQLException {
        Map<String, Object> donor = new HashMap<>();
        donor.put("id", rs.getInt("id"));
        String name = rs.getString("name");
        donor.put("name", name);
        donor.put("fullName", name);
        if (name != null && name.contains(" ")) {
            int split = name.indexOf(' ');
            donor.put("firstName", name.substring(0, split));
            donor.put("lastName", name.substring(split + 1));
        } else {
            donor.put("firstName", name);
            donor.put("lastName", "");
        }
        try {
            String fName = rs.getString("father_name");
            donor.put("fatherName", fName);
            donor.put("father_name", fName);
        } catch (SQLException ignored) {
            donor.put("fatherName", null);
            donor.put("father_name", null);
        }
        donor.put("email", rs.getString("email"));
        donor.put("phone", rs.getString("phone"));
        donor.put("bloodType", rs.getString("blood_type"));
        donor.put("city", rs.getString("city"));
        donor.put("state", rs.getString("state"));
        donor.put("zone", rs.getString("zone"));
        donor.put("availability", rs.getString("availability"));
        donor.put("weight", rs.getObject("weight"));
        donor.put("address", rs.getString("address"));
        donor.put("pincode", rs.getString("pincode"));
        donor.put("latitude", rs.getObject("latitude"));
        donor.put("longitude", rs.getObject("longitude"));
        Date lastDonation = rs.getDate("last_donation");
        donor.put("lastDonation", lastDonation == null ? null : lastDonation.toString());
        donor.put("lastDonationDate", lastDonation == null ? null : lastDonation.toString());
        try {
            Date dob = rs.getDate("dob");
            donor.put("dateOfBirth", dob == null ? null : dob.toString());
            donor.put("dob", dob == null ? null : dob.toString());
        } catch (SQLException ignored) {}
        try {
            donor.put("pulse", rs.getObject("pulse"));
            donor.put("hemoglobin", rs.getObject("hemoglobin"));
            donor.put("bloodPressure", rs.getString("blood_pressure"));
            donor.put("bodyTemp", rs.getObject("body_temp"));
            donor.put("verifiedFacility", rs.getString("verified_facility"));
            Date vDate = rs.getDate("verified_date");
            donor.put("verifiedDate", vDate != null ? vDate.toString() : null);
        } catch (SQLException ignored) {
            donor.put("pulse", null);
            donor.put("hemoglobin", null);
            donor.put("bloodPressure", null);
            donor.put("bodyTemp", null);
            donor.put("verifiedFacility", null);
            donor.put("verifiedDate", null);
        }
        try {
            java.sql.Timestamp createdAt = rs.getTimestamp("created_at");
            if (createdAt != null) {
                donor.put("createdAt", createdAt.toInstant().toString());
                donor.put("created_at", createdAt.toInstant().toString());
                donor.put("memberSince", createdAt.toInstant().toString());
            }
        } catch (SQLException ignored) {}
        if (includePrivate) {
            donor.put("gender", rs.getString("gender"));
        }
        try {
            donor.put("allergies", rs.getString("allergies"));
            donor.put("conditions", rs.getString("conditions"));
            donor.put("medications", rs.getString("medications"));
            donor.put("surgeries", rs.getString("surgeries"));
            donor.put("donorType", rs.getString("donor_type"));
            donor.put("donor_type", rs.getString("donor_type"));
            donor.put("qrToken", rs.getString("qr_token"));
            donor.put("qr_token", rs.getString("qr_token"));
        } catch (SQLException ignored) {}
        return donor;
    }

    private static void setDate(PreparedStatement ps, int index, Date date) throws SQLException {
        if (date == null) {
            ps.setNull(index, Types.DATE);
        } else {
            ps.setDate(index, date);
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

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static boolean bool(Object value, boolean fallback) {
        return value instanceof Boolean ? (Boolean) value : fallback;
    }

    private static boolean isMissingTable(SQLException e) {
        String message = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
        return message.contains("doesn't exist") || message.contains("does not exist");
    }
}
