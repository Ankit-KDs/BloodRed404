package com.red404.dao;

import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;
import com.red404.util.PasswordUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DonorDao {

    private static final Logger log = LoggerFactory.getLogger(DonorDao.class);

    /**
     * Location freshness threshold for emergency donor search matching.
     * Only donors whose location was synced within the last 24 hours are considered current.
     */
    public static final int FRESHNESS_HOURS = 24;

    public boolean emailOrPhoneExists(String email, String phone) throws SQLException {
        String cleanEmail = email != null ? email.trim().toLowerCase() : "";
        String cleanPhone = phone != null ? phone.trim() : "";
        String digits = cleanPhone.replaceAll("[^0-9]", "");
        String last10 = digits.length() >= 10 ? digits.substring(digits.length() - 10) : digits;

        String sql = "SELECT id FROM donors WHERE " +
                "(? != '' AND LOWER(TRIM(email)) = ?) " +
                "OR (? != '' AND (TRIM(phone) = ? OR (LENGTH(?) >= 10 AND RIGHT(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', ''), 10) = ?))) " +
                "LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanEmail);
            ps.setString(3, cleanPhone);
            ps.setString(4, cleanPhone);
            ps.setString(5, last10);
            ps.setString(6, last10);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    public boolean insert(Map<String, Object> donor) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "INSERT INTO donors (" +
                "donor_id, name, father_name, email, phone, dob, gender, password, blood_type, weight, " +
                "last_donation, availability, address, city, state, pincode, latitude, longitude, zone, " +
                "allergies, conditions, medications, surgeries, donor_type, pulse, hemoglobin, blood_pressure, body_temp, " +
                "verified_facility, verified_date, qr_token, sms_notif, push_notif, email_notif, " +
                "hospital_review_needed, health_answers_json, availability_pref, last_donation_self_reported, email_verified, email_verified_at, " +
                "blood_group_status, public_search_opt_in, public_display_name, public_consent_at" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            String name = str(donor.get("name")).trim();
            Object dobObj = donor.get("dob") != null ? donor.get("dob") : donor.get("dateOfBirth");
            Date dob = null;
            if (dobObj instanceof Date) dob = (Date) dobObj;
            else if (dobObj instanceof java.util.Date) dob = new Date(((java.util.Date) dobObj).getTime());
            else if (dobObj != null && !str(dobObj).isBlank()) {
                try { dob = Date.valueOf(str(dobObj).trim()); } catch (Exception ignored) {}
            }
            String smartId = str(donor.get("donor_id"));
            if (smartId.isBlank()) smartId = str(donor.get("donorId"));
            if (smartId.isBlank()) {
                smartId = com.red404.util.DonorIdGenerator.generateUniqueDonorId(conn, name, dob);
            } else {
                if (dob != null || (dobObj != null && !str(dobObj).isBlank())) {
                    smartId = com.red404.util.DonorIdGenerator.updateDonorIdDob(smartId, dob != null ? dob : dobObj, name);
                }
            }
            donor.put("donorId", smartId);
            donor.put("donor_id", smartId);

            String email = str(donor.get("email")).trim().toLowerCase();
            String phone = str(donor.get("phone")).trim();
            String rawPassword = str(donor.get("password")).trim();
            String password = PasswordUtil.isBCrypt(rawPassword) ? rawPassword : PasswordUtil.hashPassword(rawPassword);

            String bType = str(donor.get("bloodType") != null ? donor.get("bloodType") : donor.get("blood_type")).trim();
            String bgStatus = "self_declared";
            if (bType.equalsIgnoreCase("Not sure") || bType.equalsIgnoreCase("UNKNOWN") || bType.isBlank()) {
                bType = "Not sure";
                bgStatus = "unconfirmed";
            }
            if (donor.containsKey("blood_group_status") && donor.get("blood_group_status") != null) {
                bgStatus = str(donor.get("blood_group_status"));
            }

            int idx = 1;
            ps.setString(idx++, smartId);
            ps.setString(idx++, name);
            ps.setString(idx++, emptyToNull(str(donor.get("father_name") != null ? donor.get("father_name") : donor.get("fatherName"))));
            ps.setString(idx++, email);
            ps.setString(idx++, phone);
            setDate(ps, idx++, dob);
            ps.setString(idx++, emptyToNull(str(donor.get("gender"))));
            ps.setString(idx++, password);
            ps.setString(idx++, bType);
            setDouble(ps, idx++, donor.get("weight"));
            setDate(ps, idx++, donor.get("lastDonation"));
            ps.setString(idx++, str(donor.getOrDefault("availability", "Available")));
            ps.setString(idx++, emptyToNull(str(donor.get("address"))));
            ps.setString(idx++, emptyToNull(str(donor.get("city"))));
            ps.setString(idx++, emptyToNull(str(donor.get("state"))));
            ps.setString(idx++, emptyToNull(str(donor.get("pincode"))));
            setDouble(ps, idx++, donor.get("latitude"));
            setDouble(ps, idx++, donor.get("longitude"));
            ps.setString(idx++, emptyToNull(str(donor.get("zone"))));
            ps.setString(idx++, emptyToNull(str(donor.get("allergies"))));
            ps.setString(idx++, emptyToNull(str(donor.get("conditions"))));
            ps.setString(idx++, emptyToNull(str(donor.get("medications"))));
            ps.setString(idx++, emptyToNull(str(donor.get("surgeries"))));
            ps.setString(idx++, emptyToNull(str(donor.get("donor_type") != null ? donor.get("donor_type") : donor.get("donorType"))));
            setInt(ps, idx++, donor.get("pulse"));
            setDouble(ps, idx++, donor.get("hemoglobin"));
            ps.setString(idx++, emptyToNull(str(donor.get("blood_pressure") != null ? donor.get("blood_pressure") : donor.get("bloodPressure"))));
            setDouble(ps, idx++, donor.get("body_temp") != null ? donor.get("body_temp") : donor.get("bodyTemp"));
            ps.setString(idx++, emptyToNull(str(donor.get("verified_facility") != null ? donor.get("verified_facility") : donor.get("verifiedFacility"))));
            setDate(ps, idx++, donor.get("verified_date") != null ? donor.get("verified_date") : donor.get("verifiedDate"));
            ps.setString(idx++, emptyToNull(str(donor.get("qr_token") != null ? donor.get("qr_token") : donor.get("qrToken"))));
            ps.setBoolean(idx++, false); // SMS disabled by policy
            ps.setBoolean(idx++, bool(donor.get("pushNotif"), true));
            ps.setBoolean(idx++, bool(donor.get("emailNotif"), true));
            ps.setBoolean(idx++, bool(donor.get("hospitalReviewNeeded"), bool(donor.get("hospital_review_needed"), false)));
            ps.setString(idx++, emptyToNull(str(donor.get("healthAnswersJson") != null ? donor.get("healthAnswersJson") : donor.get("health_answers_json"))));
            ps.setString(idx++, str(donor.getOrDefault("availabilityPref", donor.getOrDefault("availability_pref", "Any time"))));
            setDate(ps, idx++, donor.get("lastDonationSelfReported") != null ? donor.get("lastDonationSelfReported") : donor.get("last_donation_self_reported"));
            ps.setBoolean(idx++, bool(donor.get("emailVerified"), bool(donor.get("email_verified"), true)));
            ps.setTimestamp(idx++, new java.sql.Timestamp(System.currentTimeMillis()));
            ps.setString(idx++, bgStatus);
            boolean optIn = bool(donor.get("publicSearchOptIn"), bool(donor.get("public_search_opt_in"), false));
            ps.setBoolean(idx++, optIn);
            ps.setString(idx++, emptyToNull(str(donor.get("publicDisplayName") != null ? donor.get("publicDisplayName") : donor.get("public_display_name"))));
            ps.setTimestamp(idx++, optIn ? new java.sql.Timestamp(System.currentTimeMillis()) : null);
            return ps.executeUpdate() > 0;
        }
    }

    public Map<String, Object> findByLogin(String identifier, String password) throws SQLException {
        if (identifier == null || password == null) return null;
        String cleanId = identifier.trim();
        String cleanPw = password.trim();
        String digits = cleanId.replaceAll("[^0-9]", "");
        String last10 = digits.length() >= 10 ? digits.substring(digits.length() - 10) : digits;

        String sql = "SELECT * FROM donors WHERE (" +
                "LOWER(TRIM(email)) = LOWER(?) " +
                "OR TRIM(phone) = ? " +
                "OR UPPER(TRIM(donor_id)) = UPPER(?) " +
                "OR REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', '') = ? " +
                "OR (LENGTH(?) >= 10 AND RIGHT(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+91', ''), 10) = ?) " +
                ")";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, cleanId);
            ps.setString(2, cleanId);
            ps.setString(3, cleanId);
            ps.setString(4, last10);
            ps.setString(5, last10);
            ps.setString(6, last10);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String storedPw = rs.getString("password");
                    if (PasswordUtil.checkPassword(cleanPw, storedPw)) {
                        int donorId = rs.getInt("id");
                        // Transparently upgrade legacy plain text to BCrypt hash
                        if (!PasswordUtil.isBCrypt(storedPw)) {
                            try (PreparedStatement up = conn.prepareStatement("UPDATE donors SET password = ? WHERE id = ?")) {
                                up.setString(1, PasswordUtil.hashPassword(cleanPw));
                                up.setInt(2, donorId);
                                up.executeUpdate();
                            } catch (Exception ignored) {}
                        }
                        return mapDonor(rs, true);
                    }
                }
                return null;
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

    public Map<String, Object> findByIdOrDonorId(String identifier) throws SQLException {
        if (identifier == null || identifier.isBlank()) return null;
        String clean = identifier.trim();
        if (clean.startsWith("RED404:")) clean = clean.substring("RED404:".length()).trim();
        String sql = "SELECT * FROM donors WHERE UPPER(TRIM(donor_id)) = UPPER(?) OR CAST(id AS CHAR) = ? OR UPPER(TRIM(qr_token)) = UPPER(?) LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, clean);
            ps.setString(2, clean);
            ps.setString(3, clean);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapDonor(rs, true) : null;
            }
        }
    }

    public static String buildOpaqueSignedQrToken(int donorId) {
        String randomId = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        String raw = donorId + ":" + randomId + ":RED404_SEC_PASS_SALT";
        String signature;
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(String.format("%02X", hash[i]));
            }
            signature = sb.toString();
        } catch (Exception e) {
            signature = "B404";
        }
        return "RED404-V1-" + randomId + "-" + signature;
    }

    public String regenerateQrToken(int donorId) throws SQLException {
        ensureDonorColumnsExist();
        String newToken = buildOpaqueSignedQrToken(donorId);
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("UPDATE donors SET qr_token = ?, qr_token_created_at = CURRENT_TIMESTAMP WHERE id = ?")) {
            ps.setString(1, newToken);
            ps.setInt(2, donorId);
            ps.executeUpdate();
        }
        return newToken;
    }

    public String generateOrGetQrToken(int donorId) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "SELECT qr_token, qr_token_created_at FROM donors WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String existing = rs.getString("qr_token");
                    Timestamp createdAt = rs.getTimestamp("qr_token_created_at");
                    if (existing != null && !existing.isBlank() && createdAt != null) {
                        long ageHours = (System.currentTimeMillis() - createdAt.getTime()) / (1000 * 60 * 60);
                        if (ageHours < 24) {
                            return existing;
                        }
                    }
                }
            }
        }
        return regenerateQrToken(donorId);
    }

    public boolean invalidateQrToken(int donorId) throws SQLException {
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement("UPDATE donors SET qr_token = NULL, qr_token_created_at = NULL WHERE id = ?")) {
            ps.setInt(1, donorId);
            return ps.executeUpdate() > 0;
        }
    }

    public void addDonorNotification(int donorId, String title, String message, String type) {
        String sql = "INSERT INTO donor_notifications (donor_id, title, message, type, read_status) VALUES (?, ?, ?, ?, false)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            ps.setString(2, title);
            ps.setString(3, message);
            ps.setString(4, type != null ? type : "general");
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice inserting donor notification: {}", e.getMessage());
        }
    }

    public boolean hasRecentCheckinNotification(int donorId, String hospitalName) {
        String sql = "SELECT created_at FROM donor_notifications WHERE donor_id = ? AND type = 'checkin' AND title LIKE ? ORDER BY id DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            ps.setString(2, "%" + (hospitalName != null ? hospitalName.trim() : "") + "%");
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Timestamp ts = rs.getTimestamp("created_at");
                    if (ts != null && System.currentTimeMillis() - ts.getTime() < 4 * 3600 * 1000L) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notice checking recent check-in notification: {}", e.getMessage());
        }
        return false;
    }

    public void updateDonorVitalsAndVerification(int donorId, Double weight, Integer pulse, Double hemoglobin, String bloodPressure, Double bodyTemp, String verifiedFacility) throws SQLException {
        String sql = "UPDATE donors SET weight = COALESCE(?, weight), pulse = ?, hemoglobin = ?, blood_pressure = ?, body_temp = ?, verified_facility = ?, verified_date = CURRENT_DATE WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (weight != null && weight > 0) ps.setDouble(1, weight); else ps.setNull(1, Types.DOUBLE);
            if (pulse != null && pulse > 0) ps.setInt(2, pulse); else ps.setNull(2, Types.INTEGER);
            if (hemoglobin != null && hemoglobin > 0) ps.setDouble(3, hemoglobin); else ps.setNull(3, Types.DOUBLE);
            if (bloodPressure != null && !bloodPressure.isBlank()) ps.setString(4, bloodPressure); else ps.setNull(4, Types.VARCHAR);
            if (bodyTemp != null && bodyTemp > 0) ps.setDouble(5, bodyTemp); else ps.setNull(5, Types.DOUBLE);
            ps.setString(6, verifiedFacility != null && !verifiedFacility.isBlank() ? verifiedFacility.trim() : "Verified Hospital");
            ps.setInt(7, donorId);
            ps.executeUpdate();
        }
    }

    public List<Map<String, Object>> getDonorNotifications(int donorId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT * FROM donor_notifications WHERE donor_id = ? ORDER BY created_at DESC LIMIT 50";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("title", rs.getString("title"));
                    map.put("message", rs.getString("message"));
                    map.put("type", rs.getString("type"));
                    map.put("read", rs.getBoolean("read_status"));
                    Timestamp cat = rs.getTimestamp("created_at");
                    map.put("createdAt", cat != null ? cat.toString() : null);
                    list.add(map);
                }
            }
        } catch (Exception e) {
            log.warn("Notice querying donor notifications: {}", e.getMessage());
        }
        return list;
    }

    public void logCheckinScan(int hospitalId, String staffUser, String queryId, Integer donorId, boolean success, String message) {
        String sql = "INSERT INTO donor_checkin_scans (hospital_id, staff_user, query_id, donor_id, success, message) VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            ps.setString(2, staffUser != null ? staffUser : "Staff");
            ps.setString(3, queryId != null ? queryId : "");
            if (donorId != null && donorId > 0) {
                ps.setInt(4, donorId);
            } else {
                ps.setNull(4, java.sql.Types.INTEGER);
            }
            ps.setBoolean(5, success);
            ps.setString(6, message != null ? message : "");
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice logging checkin scan: {}", e.getMessage());
        }
    }

    public Map<String, Object> findByEmail(String email) throws SQLException {
        if (email == null || email.isBlank()) return null;
        String sql = "SELECT * FROM donors WHERE LOWER(email) = ? LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email.trim().toLowerCase());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? mapDonor(rs, true) : null;
            }
        }
    }

    public boolean updateAvailability(int id, boolean available, Date pausedUntil) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "UPDATE donors SET availability = ?, paused_until = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, available ? "Available" : "Paused");
            if (!available && pausedUntil != null) {
                ps.setDate(2, pausedUntil);
            } else {
                ps.setNull(2, Types.DATE);
            }
            ps.setInt(3, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateAvailability(int id, boolean available) throws SQLException {
        return updateAvailability(id, available, null);
    }

    public boolean updateLocation(int donorId, double latitude, double longitude) throws SQLException {
        String sql = "UPDATE donors SET latitude = ?, longitude = ?, location_updated_at = CURRENT_TIMESTAMP WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDouble(1, latitude);
            ps.setDouble(2, longitude);
            ps.setInt(3, donorId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateProfile(int id, Map<String, Object> fields) throws SQLException {
        ensureDonorColumnsExist();
        if (fields == null || fields.isEmpty()) return true;

        // Never allow profile update to modify clinical/hospital-managed fields (Part 1, Requirement 1)
        fields.remove("last_donation");
        fields.remove("lastDonation");
        fields.remove("lastDonationDate");
        fields.remove("last_donation_date");
        fields.remove("pulse");
        fields.remove("hemoglobin");
        fields.remove("blood_pressure");
        fields.remove("bloodPressure");
        fields.remove("body_temp");
        fields.remove("bodyTemp");
        fields.remove("weight");
        fields.remove("verified_facility");
        fields.remove("verifiedFacility");
        fields.remove("verified_date");
        fields.remove("verifiedDate");
        fields.remove("health_status");
        fields.remove("healthStatus");

        List<String> setClauses = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (fields.containsKey("name") || fields.containsKey("fullName")) {
            setClauses.add("name = COALESCE(?, name)");
            params.add(emptyToNull(str(fields.get("name") != null ? fields.get("name") : fields.get("fullName"))));
        }
        if (fields.containsKey("father_name") || fields.containsKey("fatherName")) {
            setClauses.add("father_name = ?");
            params.add(emptyToNull(str(fields.get("father_name") != null ? fields.get("father_name") : fields.get("fatherName"))));
        }
        if (fields.containsKey("phone")) {
            setClauses.add("phone = ?");
            params.add(emptyToNull(str(fields.get("phone"))));
        }
        if (fields.containsKey("blood_type") || fields.containsKey("bloodType")) {
            setClauses.add("blood_type = COALESCE(?, blood_type)");
            params.add(emptyToNull(str(fields.get("blood_type") != null ? fields.get("blood_type") : fields.get("bloodType"))));
        }
        if (fields.containsKey("gender")) {
            setClauses.add("gender = COALESCE(?, gender)");
            String g = emptyToNull(str(fields.get("gender")));
            if (g != null) {
                String gl = g.trim().toLowerCase();
                if (gl.startsWith("m")) g = "Male";
                else if (gl.startsWith("f")) g = "Female";
                else if (gl.startsWith("o")) g = "Other";
            }
            params.add(g);
        }
        if (fields.containsKey("dob") || fields.containsKey("dateOfBirth")) {
            Date dob = null;
            Object dobObj = fields.get("dob") != null ? fields.get("dob") : fields.get("dateOfBirth");
            if (dobObj instanceof Date) dob = (Date) dobObj;
            else if (dobObj instanceof java.util.Date) dob = new Date(((java.util.Date) dobObj).getTime());
            else if (dobObj != null && !str(dobObj).isBlank()) {
                try { dob = Date.valueOf(str(dobObj).trim()); } catch (Exception ignored) {}
            }
            setClauses.add("dob = ?");
            params.add(dob);
        }
        if (fields.containsKey("address")) {
            setClauses.add("address = ?");
            params.add(emptyToNull(str(fields.get("address"))));
        }
        if (fields.containsKey("city")) {
            setClauses.add("city = ?");
            params.add(emptyToNull(str(fields.get("city"))));
        }
        if (fields.containsKey("state")) {
            setClauses.add("state = ?");
            params.add(emptyToNull(str(fields.get("state"))));
        }
        if (fields.containsKey("pincode")) {
            setClauses.add("pincode = ?");
            params.add(emptyToNull(str(fields.get("pincode"))));
        }
        if (fields.containsKey("allergies")) {
            setClauses.add("allergies = ?");
            params.add(emptyToNull(str(fields.get("allergies"))));
        }
        if (fields.containsKey("conditions")) {
            setClauses.add("conditions = ?");
            params.add(emptyToNull(str(fields.get("conditions"))));
        }
        if (fields.containsKey("medications")) {
            setClauses.add("medications = ?");
            params.add(emptyToNull(str(fields.get("medications"))));
        }
        if (fields.containsKey("surgeries")) {
            setClauses.add("surgeries = ?");
            params.add(emptyToNull(str(fields.get("surgeries"))));
        }
        if (fields.containsKey("donor_type") || fields.containsKey("donorType")) {
            setClauses.add("donor_type = ?");
            params.add(emptyToNull(str(fields.get("donor_type") != null ? fields.get("donor_type") : fields.get("donorType"))));
        }
        if (fields.containsKey("qr_token") || fields.containsKey("qrToken")) {
            setClauses.add("qr_token = COALESCE(?, qr_token)");
            params.add(emptyToNull(str(fields.get("qr_token") != null ? fields.get("qr_token") : fields.get("qrToken"))));
        }
        if (fields.containsKey("availability")) {
            setClauses.add("availability = COALESCE(?, availability)");
            params.add(emptyToNull(str(fields.get("availability"))));
        }
        if (fields.containsKey("preferred_language") || fields.containsKey("preferredLanguage")) {
            setClauses.add("preferred_language = ?");
            Object langObj = fields.get("preferred_language") != null ? fields.get("preferred_language") : fields.get("preferredLanguage");
            params.add((langObj != null && !str(langObj).isBlank()) ? str(langObj).trim().toLowerCase() : "en");
        }
        if (fields.containsKey("sms_notif") || fields.containsKey("smsNotif")) {
            setClauses.add("sms_notif = ?");
            Object b = fields.get(fields.containsKey("sms_notif") ? "sms_notif" : "smsNotif");
            params.add(b instanceof Boolean ? (Boolean) b : Boolean.parseBoolean(str(b)));
        }
        if (fields.containsKey("email_notif") || fields.containsKey("emailNotif")) {
            setClauses.add("email_notif = ?");
            Object b = fields.get(fields.containsKey("email_notif") ? "email_notif" : "emailNotif");
            params.add(b instanceof Boolean ? (Boolean) b : Boolean.parseBoolean(str(b)));
        }
        if (fields.containsKey("push_notif") || fields.containsKey("pushNotif")) {
            setClauses.add("push_notif = ?");
            Object b = fields.get(fields.containsKey("push_notif") ? "push_notif" : "pushNotif");
            params.add(b instanceof Boolean ? (Boolean) b : Boolean.parseBoolean(str(b)));
        }
        if (fields.containsKey("latitude") && fields.containsKey("longitude")) {
            setClauses.add("latitude = ?");
            params.add(fields.get("latitude"));
            setClauses.add("longitude = ?");
            params.add(fields.get("longitude"));
            setClauses.add("location_updated_at = CURRENT_TIMESTAMP");
        }
        if (fields.containsKey("public_search_opt_in") || fields.containsKey("publicSearchOptIn")) {
            setClauses.add("public_search_opt_in = ?");
            Object b = fields.get(fields.containsKey("public_search_opt_in") ? "public_search_opt_in" : "publicSearchOptIn");
            boolean optIn = b instanceof Boolean ? (Boolean) b : Boolean.parseBoolean(str(b));
            params.add(optIn);
            if (optIn) {
                setClauses.add("public_consent_at = CURRENT_TIMESTAMP");
            } else {
                setClauses.add("public_consent_at = NULL");
            }
        }
        if (fields.containsKey("public_display_name") || fields.containsKey("publicDisplayName")) {
            setClauses.add("public_display_name = ?");
            params.add(emptyToNull(str(fields.get(fields.containsKey("public_display_name") ? "public_display_name" : "publicDisplayName"))));
        }

        if (setClauses.isEmpty()) return true;

        String sql = "UPDATE donors SET " + String.join(", ", setClauses) + " WHERE id = ?";
        boolean updated = false;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            int idx = 1;
            for (Object param : params) {
                if (param == null) {
                    ps.setNull(idx++, Types.VARCHAR);
                } else if (param instanceof Date) {
                    ps.setDate(idx++, (Date) param);
                } else if (param instanceof Boolean) {
                    ps.setBoolean(idx++, (Boolean) param);
                } else if (param instanceof Double) {
                    ps.setDouble(idx++, (Double) param);
                } else if (param instanceof Integer) {
                    ps.setInt(idx++, (Integer) param);
                } else {
                    ps.setString(idx++, param.toString());
                }
            }
            ps.setInt(idx, id);
            updated = ps.executeUpdate() > 0;
        }

        if (updated && (fields.containsKey("dob") || fields.containsKey("dateOfBirth"))) {
            Object dobObj = fields.get("dob") != null ? fields.get("dob") : fields.get("dateOfBirth");
            Date dob = null;
            if (dobObj instanceof Date) dob = (Date) dobObj;
            else if (dobObj instanceof java.util.Date) dob = new Date(((java.util.Date) dobObj).getTime());
            else if (dobObj != null && !str(dobObj).isBlank()) {
                try { dob = Date.valueOf(str(dobObj).trim()); } catch (Exception ignored) {}
            }
            if (dob != null) {
                try (Connection conn = DBConnection.getConnection()) {
                    String currentDonorId = null;
                    String currentName = str(fields.get("name") != null ? fields.get("name") : fields.get("fullName"));
                    try (PreparedStatement checkPs = conn.prepareStatement("SELECT donor_id, name FROM donors WHERE id = ?")) {
                        checkPs.setInt(1, id);
                        try (ResultSet rs = checkPs.executeQuery()) {
                            if (rs.next()) {
                                currentDonorId = rs.getString("donor_id");
                                if (currentName.isBlank()) currentName = rs.getString("name");
                            }
                        }
                    }
                    if (currentDonorId != null && !currentDonorId.isBlank()) {
                        String updatedDonorId = com.red404.util.DonorIdGenerator.updateDonorIdDob(currentDonorId, dob, currentName);
                        if (updatedDonorId != null && !updatedDonorId.equalsIgnoreCase(currentDonorId)) {
                            try (PreparedStatement upPs = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                                upPs.setString(1, updatedDonorId);
                                upPs.setInt(2, id);
                                upPs.executeUpdate();
                                log.info("Updated Smart Donor ID on DOB change for donor {}: {} -> {}", id, currentDonorId, updatedDonorId);
                            }
                            try (PreparedStatement cs = conn.prepareStatement("UPDATE donations SET donor_id = ? WHERE donor_id = ?")) {
                                cs.setString(1, updatedDonorId);
                                cs.setString(2, currentDonorId);
                                cs.executeUpdate();
                            } catch (Exception ignored) {}
                            try (PreparedStatement cs = conn.prepareStatement("UPDATE intake_snapshots SET donor_id = ? WHERE donor_id = ?")) {
                                cs.setString(1, updatedDonorId);
                                cs.setString(2, currentDonorId);
                                cs.executeUpdate();
                            } catch (Exception ignored) {}
                            try (PreparedStatement cs = conn.prepareStatement("UPDATE user_sessions SET user_id = ? WHERE user_id = ?")) {
                                cs.setString(1, updatedDonorId);
                                cs.setString(2, currentDonorId);
                                cs.executeUpdate();
                            } catch (Exception ignored) {}

                            fields.put("donorId", updatedDonorId);
                            fields.put("donor_id", updatedDonorId);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Notice updating donor_id on DOB change: {}", e.getMessage());
                }
            }
        }
        return updated;
    }

    public boolean updateBloodGroupSelfDeclared(int donorId, String newGroup) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "UPDATE donors SET blood_type = ?, blood_group_status = 'self_declared', blood_group_edit_count = COALESCE(blood_group_edit_count, 0) + 1 WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newGroup);
            ps.setInt(2, donorId);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateBloodGroupHospitalVerified(int donorId, String newGroup, Integer hospitalId, String hospitalName) throws SQLException {
        ensureDonorColumnsExist();
        String sql = "UPDATE donors SET blood_type = ?, blood_group_status = 'hospital_verified', blood_group_verified_by_hospital_id = ?, blood_group_verified_by_hospital_name = ?, blood_group_verified_at = CURRENT_TIMESTAMP WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newGroup);
            if (hospitalId != null && hospitalId > 0) ps.setInt(2, hospitalId);
            else ps.setNull(2, Types.INTEGER);
            ps.setString(3, hospitalName);
            ps.setInt(4, donorId);
            return ps.executeUpdate() > 0;
        }
    }

    private void ensureDonorColumnsExist() {
        try (Connection conn = DBConnection.getConnection()) {
            ensureCol(conn, "donor_id", "VARCHAR(30) NULL DEFAULT NULL");
            ensureCol(conn, "father_name", "VARCHAR(150) NULL DEFAULT NULL");
            ensureCol(conn, "pulse", "INT NULL DEFAULT NULL");
            ensureCol(conn, "hemoglobin", "DOUBLE NULL DEFAULT NULL");
            ensureCol(conn, "blood_pressure", "VARCHAR(30) NULL DEFAULT NULL");
            ensureCol(conn, "body_temp", "DOUBLE NULL DEFAULT NULL");
            ensureCol(conn, "verified_facility", "VARCHAR(180) NULL DEFAULT NULL");
            ensureCol(conn, "verified_date", "DATE NULL DEFAULT NULL");
            ensureCol(conn, "allergies", "VARCHAR(255) NULL DEFAULT NULL");
            ensureCol(conn, "conditions", "VARCHAR(255) NULL DEFAULT NULL");
            ensureCol(conn, "medications", "VARCHAR(255) NULL DEFAULT NULL");
            ensureCol(conn, "surgeries", "VARCHAR(255) NULL DEFAULT NULL");
            ensureCol(conn, "donor_type", "VARCHAR(80) NULL DEFAULT NULL");
            ensureCol(conn, "qr_token", "VARCHAR(100) NULL DEFAULT NULL");
            ensureCol(conn, "last_donation", "DATE NULL DEFAULT NULL");
            ensureCol(conn, "blood_group_status", "VARCHAR(40) DEFAULT 'self_declared'");
            ensureCol(conn, "blood_group_verified_by_hospital_id", "INT NULL DEFAULT NULL");
            ensureCol(conn, "blood_group_verified_by_hospital_name", "VARCHAR(180) NULL DEFAULT NULL");
            ensureCol(conn, "blood_group_verified_at", "TIMESTAMP NULL DEFAULT NULL");
            ensureCol(conn, "blood_group_edit_count", "INT DEFAULT 0");
            ensureCol(conn, "preferred_language", "VARCHAR(10) DEFAULT 'en'");
            ensureCol(conn, "sms_notif", "BOOLEAN DEFAULT TRUE");
            ensureCol(conn, "email_notif", "BOOLEAN DEFAULT TRUE");
            ensureCol(conn, "push_notif", "BOOLEAN DEFAULT TRUE");
            ensureCol(conn, "public_search_opt_in", "BOOLEAN DEFAULT FALSE");
            ensureCol(conn, "public_display_name", "VARCHAR(100) NULL DEFAULT NULL");
            ensureCol(conn, "public_consent_at", "TIMESTAMP NULL DEFAULT NULL");
            ensureCol(conn, "hospital_review_needed", "BOOLEAN DEFAULT FALSE");
            ensureCol(conn, "health_answers_json", "TEXT NULL");
            ensureCol(conn, "availability_pref", "VARCHAR(50) DEFAULT 'Any time'");
            ensureCol(conn, "last_donation_self_reported", "DATE NULL DEFAULT NULL");
            ensureCol(conn, "email_verified", "BOOLEAN DEFAULT FALSE");
            ensureCol(conn, "email_verified_at", "TIMESTAMP NULL DEFAULT NULL");

            try (Statement st = conn.createStatement()) {
                st.executeUpdate("UPDATE donors SET father_name = NULL WHERE father_name LIKE '%Rajesh%'");
                st.executeUpdate("UPDATE donors SET allergies = NULL WHERE allergies LIKE '%No Known Drug%' OR allergies LIKE '%NKDA%'");
                st.executeUpdate("UPDATE donors SET conditions = NULL WHERE conditions LIKE '%Normal Screening%' OR conditions LIKE '%None Reported%'");
                st.executeUpdate("UPDATE donors SET medications = NULL WHERE medications LIKE '%Unrestricted%' OR medications LIKE 'None%'");
                st.executeUpdate("UPDATE donors SET surgeries = NULL WHERE surgeries LIKE '%None Reported%' OR surgeries LIKE '%< 12%'");
                st.executeUpdate("UPDATE donors SET verified_facility = NULL WHERE verified_facility LIKE '%City General%'");
            } catch (Exception ignored) {}
        } catch (Exception ignored) {}
        ensureDonationsTableCols();
    }

    private void ensureDonationsTableCols() {
        try (Connection conn = DBConnection.getConnection()) {
            ensureTableCol(conn, "donations", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            ensureTableCol(conn, "donations", "volume_ml", "INT DEFAULT 450");
            ensureTableCol(conn, "donations", "vitals_json", "TEXT NULL DEFAULT NULL");
            ensureTableCol(conn, "donations", "staff_user", "VARCHAR(100) NULL DEFAULT NULL");
            ensureTableCol(conn, "donations", "deferral_reason", "VARCHAR(255) NULL DEFAULT NULL");
            ensureTableCol(conn, "donations", "request_id", "INT NULL DEFAULT NULL");
        } catch (Exception ignored) {}
    }

    private void ensureTableCol(Connection conn, String tableName, String colName, String colDef) {
        try {
            boolean exists = false;
            try (ResultSet rs = conn.getMetaData().getColumns(null, null, tableName.toLowerCase(), colName.toLowerCase())) {
                if (rs.next()) exists = true;
            }
            if (!exists) {
                try (ResultSet rs = conn.getMetaData().getColumns(null, null, tableName.toUpperCase(), colName.toUpperCase())) {
                    if (rs.next()) exists = true;
                }
            }
            if (!exists) {
                try (Statement st = conn.createStatement()) {
                    st.executeUpdate("ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colDef);
                }
            }
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
            try (Statement st = conn.createStatement()) {
                if (!exists) {
                    st.executeUpdate("ALTER TABLE donors ADD COLUMN " + colName + " " + colDef);
                } else {
                    try {
                        st.executeUpdate("ALTER TABLE donors MODIFY COLUMN " + colName + " " + colDef);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}
    }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public Map<String, Object> findSnapshotByToken(String token) throws SQLException {
        if (token == null || token.isBlank()) return null;
        String sql = "SELECT snapshot_json FROM intake_snapshots WHERE token = ? LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, token.trim());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String json = rs.getString("snapshot_json");
                    if (json != null && !json.isBlank()) {
                        try {
                            return MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public Map<String, Object> findSnapshotByDonorId(Integer donorId) {
        if (donorId == null || donorId <= 0) return null;
        String sql = "SELECT snapshot_json FROM intake_snapshots WHERE donor_id = ? ORDER BY created_at DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String json = rs.getString("snapshot_json");
                    if (json != null && !json.isBlank()) {
                        try {
                            return MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public boolean saveSnapshot(String token, Integer donorId, Map<String, Object> data) {
        return saveSnapshot(token, donorId != null ? String.valueOf(donorId) : null, data);
    }

    public boolean saveSnapshot(String token, String donorId, Map<String, Object> data) {
        if (token == null || token.isBlank() || data == null) return false;
        String sql = "INSERT INTO intake_snapshots (token, donor_id, snapshot_json, created_at) " +
                "VALUES (?, ?, ?, NOW()) " +
                "ON DUPLICATE KEY UPDATE donor_id = VALUES(donor_id)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            String json = MAPPER.writeValueAsString(data);
            ps.setString(1, token.trim());
            if (donorId != null && !donorId.isBlank()) ps.setString(2, donorId.trim());
            else ps.setNull(2, Types.VARCHAR);
            ps.setString(3, json);
            return ps.executeUpdate() > 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    public Map<String, Object> findByToken(String token) throws SQLException {
        if (token == null || token.isBlank()) return null;
        String trimmed = token.trim();

        // 1. Return immutable frozen snapshot if this token was already accessed/generated
        Map<String, Object> snapshot = findSnapshotByToken(trimmed);
        if (snapshot != null) {
            return snapshot;
        }

        // 2. Lookup donor from donors table (by qr_token or Smart Donor ID)
        Map<String, Object> liveDonor = null;
        String sql = "SELECT * FROM donors WHERE qr_token = ? OR UPPER(TRIM(donor_id)) = UPPER(?) LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, trimmed);
            ps.setString(2, trimmed);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) liveDonor = mapDonor(rs, true);
            }
        }

        // 3. Fallback extraction of Smart Donor ID or numeric ID e.g. #RED-UP-7951 or 7951 or 1
        if (liveDonor == null) {
            liveDonor = findByIdOrDonorId(trimmed);
        }
        if (liveDonor == null) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)").matcher(trimmed);
            if (m.find()) {
                int num = Integer.parseInt(m.group(1));
                int id = num > 7950 ? num - 7950 : num;
                liveDonor = findById(id);
            }
        }

        // 4. Freeze this record permanently for this token so subsequent profile edits never alter it
        if (liveDonor != null) {
            String smartDonorId = str(liveDonor.get("donorId"));
            if (smartDonorId.isBlank()) smartDonorId = str(liveDonor.get("id"));
            String stamp = java.time.format.DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm:ss")
                    .withZone(java.time.ZoneId.of("Asia/Kolkata"))
                    .format(java.time.Instant.now());
            liveDonor.put("snapshotTimestamp", stamp);
            liveDonor.put("isSnapshot", true);
            saveSnapshot(trimmed, smartDonorId, liveDonor);
            return liveDonor;
        }
        return null;
    }

    public boolean updatePassword(int id, String currentPassword, String newPassword) throws SQLException {
        if (currentPassword == null || newPassword == null || newPassword.isBlank()) return false;
        String sqlSelect = "SELECT password FROM donors WHERE id = ?";
        String storedPassword = null;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sqlSelect)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    storedPassword = rs.getString("password");
                }
            }
        }

        if (storedPassword == null) return false;

        // Verify current password against BCrypt or fallback plain text
        if (!PasswordUtil.checkPassword(currentPassword, storedPassword)) {
            return false;
        }

        // Hash new password using BCrypt
        String hashedNew = PasswordUtil.hashPassword(newPassword);

        String sqlUpdate = "UPDATE donors SET password = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sqlUpdate)) {
            ps.setString(1, hashedNew);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean hardDeleteDonor(int id) throws SQLException {
        return hardDeleteDonor(id, null, null);
    }

    public boolean hardDeleteDonor(int id, String email, String phone) throws SQLException {
        return hardDeleteDonor((Object) id, email, phone);
    }

    public boolean hardDeleteDonor(Object idOrDonorId, String email, String phone) throws SQLException {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                String cleanEmail = email != null ? email.trim().toLowerCase() : "";
                String cleanPhone = phone != null ? phone.trim() : "";
                String rawId = idOrDonorId != null ? str(idOrDonorId).trim() : "";
                int numId = 0;
                try { numId = Integer.parseInt(rawId); } catch (Exception ignored) {}

                // 1. Locate the Smart Donor ID to burn before deleting
                String donorIdToBurn = null;
                String findSql = "SELECT id, donor_id FROM donors WHERE (donor_id IS NOT NULL AND donor_id = ?) OR (id > 0 AND id = ?)";
                if (!cleanEmail.isEmpty()) findSql += " OR LOWER(email) = ?";
                if (!cleanPhone.isEmpty()) findSql += " OR phone = ?";
                findSql += " LIMIT 1";

                try (PreparedStatement ps = conn.prepareStatement(findSql)) {
                    ps.setString(1, rawId);
                    ps.setInt(2, numId);
                    int pIdx = 3;
                    if (!cleanEmail.isEmpty()) ps.setString(pIdx++, cleanEmail);
                    if (!cleanPhone.isEmpty()) ps.setString(pIdx++, cleanPhone);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            if (numId <= 0) numId = rs.getInt("id");
                            donorIdToBurn = rs.getString("donor_id");
                        }
                    }
                }

                if ((donorIdToBurn == null || donorIdToBurn.isBlank()) && rawId.startsWith("DNR-")) {
                    donorIdToBurn = rawId;
                }

                // 2. The 'Burned ID' Rule: burn this donor_id permanently into burned_donor_ids
                if (donorIdToBurn != null && !donorIdToBurn.isBlank()) {
                    try (PreparedStatement ps = conn.prepareStatement(
                            "INSERT INTO burned_donor_ids (donor_id, burned_at, reason) VALUES (?, NOW(), 'ACCOUNT_DELETED') " +
                            "ON DUPLICATE KEY UPDATE burned_at = NOW()")) {
                        ps.setString(1, donorIdToBurn.trim());
                        ps.executeUpdate();
                    } catch (Exception ignored) {}
                }

                // 3. Delete associated intake snapshots
                try (PreparedStatement ps = conn.prepareStatement(
                        "DELETE FROM intake_snapshots WHERE (donor_id = ? OR (donor_id > 0 AND donor_id = CAST(? AS CHAR))) OR (email IS NOT NULL AND LOWER(email) = ?)")) {
                    ps.setString(1, donorIdToBurn != null ? donorIdToBurn : rawId);
                    ps.setInt(2, numId);
                    ps.setString(3, cleanEmail);
                    ps.executeUpdate();
                } catch (Exception ignored) {}

                // 4. Anonymize donation records for hospital records with donor identity scrubbed (Part 9 Item 15)
                try (PreparedStatement ps = conn.prepareStatement(
                        "UPDATE donations SET donor_id = 'ANONYMOUS' WHERE (donor_id = ? OR donor_id = CAST(? AS CHAR))")) {
                    ps.setString(1, donorIdToBurn != null ? donorIdToBurn : rawId);
                    ps.setInt(2, numId);
                    ps.executeUpdate();
                } catch (Exception ignored) {}

                // 5. Delete user sessions
                try (PreparedStatement ps = conn.prepareStatement(
                        "DELETE FROM user_sessions WHERE user_type = 'DONOR' AND (user_id = ? OR user_id = CAST(? AS CHAR))")) {
                    ps.setString(1, donorIdToBurn != null ? donorIdToBurn : rawId);
                    ps.setInt(2, numId);
                    ps.executeUpdate();
                } catch (Exception ignored) {}

                // 6. Delete the donor account row (matching id, donor_id, email, or phone)
                int rows = 0;
                String deleteDonorSql = "DELETE FROM donors WHERE (donor_id IS NOT NULL AND donor_id = ?) OR (id > 0 AND id = ?)";
                if (!cleanEmail.isEmpty()) {
                    deleteDonorSql += " OR LOWER(email) = ?";
                }
                if (!cleanPhone.isEmpty()) {
                    deleteDonorSql += " OR phone = ?";
                }
                try (PreparedStatement ps = conn.prepareStatement(deleteDonorSql)) {
                    ps.setString(1, donorIdToBurn != null ? donorIdToBurn : rawId);
                    ps.setInt(2, numId);
                    int paramIdx = 3;
                    if (!cleanEmail.isEmpty()) {
                        ps.setString(paramIdx++, cleanEmail);
                    }
                    if (!cleanPhone.isEmpty()) {
                        ps.setString(paramIdx++, cleanPhone);
                    }
                    rows = ps.executeUpdate();
                }

                conn.commit();
                return rows > 0;
            } catch (Exception e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    public List<Map<String, Object>> findNearby(Double lat, Double lng, double radiusKm, String bloodType) throws SQLException {
        String sql = "SELECT * FROM donors WHERE (availability IS NULL OR (LOWER(availability) NOT IN ('unavailable', 'busy', 'paused', 'deleted') AND (paused_until IS NULL OR paused_until <= CURRENT_DATE)))";
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

    public Map<String, Object> searchMatchingDonorsForHospital(
            Double hospLat, 
            Double hospLng, 
            double radiusKm, 
            String recipientBloodType, 
            int hospitalId) throws SQLException {
        
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> matches = new ArrayList<>();
        int compatibleRegisteredCount = 0;
        int ineligibleCount = 0;
        int withoutLocationCount = 0;
        int staleLocationCount = 0;
        int outsideRadiusCount = 0;

        if (recipientBloodType == null || recipientBloodType.isBlank()) {
            response.put("donors", matches);
            response.put("unlocatedCount", 0);
            response.put("totalMatches", 0);
            response.put("availableCount", 0);
            response.put("emptyReasonSummary", "Select a blood group and click Search Donors.");
            return response;
        }

        String targetBlood = recipientBloodType.trim().toUpperCase();
        List<String> compatibleGroups = com.red404.util.BloodCompatibilityUtil.getCompatibleDonorGroups(targetBlood);
        if (compatibleGroups.isEmpty()) {
            response.put("donors", matches);
            response.put("unlocatedCount", 0);
            response.put("totalMatches", 0);
            response.put("availableCount", 0);
            response.put("emptyReasonSummary", "No compatible blood groups configured for " + targetBlood + ".");
            return response;
        }

        Map<Integer, String> notificationStatuses = new com.red404.dao.BloodRequestNotificationDao().getDonorStatusesForHospital(hospitalId);

        String sql = "SELECT * FROM donors WHERE (availability IS NULL OR LOWER(availability) <> 'deleted')";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            
            while (rs.next()) {
                Map<String, Object> donor = mapDonor(rs, false);
                int donorId = ((Number) donor.get("id")).intValue();

                // 1. Blood compatibility funnel step
                String dBlood = str(donor.get("bloodType"));
                if (!com.red404.util.BloodCompatibilityUtil.isCompatible(dBlood, targetBlood)) {
                    continue;
                }
                compatibleRegisteredCount++;

                // 2. Authoritative ONE server function isEligible(donor)
                if (!com.red404.service.DonorEligibilityService.isEligible(donor)) {
                    ineligibleCount++;
                    continue;
                }

                // 3. Stored location & Freshness check funnel step
                Object latObj = donor.get("latitude");
                Object lngObj = donor.get("longitude");
                if (latObj == null || lngObj == null || !(latObj instanceof Number) || !(lngObj instanceof Number)) {
                    withoutLocationCount++;
                    continue;
                }
                double donorLat = ((Number) latObj).doubleValue();
                double donorLng = ((Number) lngObj).doubleValue();
                if ((donorLat == 0.0 && donorLng == 0.0) || donorLat < -90.0 || donorLat > 90.0 || donorLng < -180.0 || donorLng > 180.0) {
                    withoutLocationCount++;
                    continue;
                }

                // Freshness verification within FRESHNESS_HOURS (24 hours)
                java.sql.Timestamp locUpdated = null;
                try {
                    locUpdated = rs.getTimestamp("location_updated_at");
                } catch (Exception ignored) {}

                if (locUpdated == null) {
                    staleLocationCount++;
                    continue;
                } else {
                    long ageHours = (System.currentTimeMillis() - locUpdated.getTime()) / (1000L * 3600L);
                    if (ageHours >= FRESHNESS_HOURS) {
                        staleLocationCount++;
                        continue;
                    }
                }

                // 4. Distance calculation & radius filter funnel step
                double distance = 0.0;
                if (hospLat != null && hospLng != null && hospLat != 0.0 && hospLng != 0.0) {
                    distance = DistanceCalculator.calculateDistance(hospLat, hospLng, donorLat, donorLng);
                    if (distance > radiusKm) {
                        outsideRadiusCount++;
                        continue;
                    }
                }

                donor.put("distance", distance);
                donor.put("distanceKm", Math.round(distance * 10.0) / 10.0);
                donor.put("distanceFormatted", String.format(Locale.US, "%.1f km", distance));
                donor.put("eta", "-");
                donor.put("etaMinutes", null);

                // 5. Notification Status per donor
                String nStatus = notificationStatuses.getOrDefault(donorId, "Available");
                donor.put("status", nStatus);
                donor.put("requestStatus", nStatus);

                // 6. SERVER PHONE PRIVACY
                // Strip phone number completely in search results (privacy before donor accepts)
                if (!"Accepted".equalsIgnoreCase(nStatus) && !"Arrived".equalsIgnoreCase(nStatus)) {
                    donor.remove("phone");
                    donor.remove("contact_number");
                    donor.remove("contactNumber");
                    donor.remove("adminPhone");
                    donor.remove("emergencyContact");
                    donor.remove("donorPhone");
                    donor.put("phone", null);
                    donor.put("donorPhone", null);
                } else {
                    if (donor.get("phone") != null && donor.get("donorPhone") == null) {
                        donor.put("donorPhone", donor.get("phone"));
                    }
                }
                donor.remove("password");

                // Flag exact match for sorting
                boolean isExact = dBlood.equalsIgnoreCase(targetBlood);
                donor.put("isExactMatch", isExact);

                matches.add(donor);
            }
        }

        // Sort: Exact-group donors first, then by distance ascending
        matches.sort((a, b) -> {
            boolean exactA = Boolean.TRUE.equals(a.get("isExactMatch"));
            boolean exactB = Boolean.TRUE.equals(b.get("isExactMatch"));
            if (exactA != exactB) {
                return exactA ? -1 : 1;
            }
            double distA = ((Number) a.getOrDefault("distance", 0.0)).doubleValue();
            double distB = ((Number) b.getOrDefault("distance", 0.0)).doubleValue();
            return Double.compare(distA, distB);
        });

        long availableCount = 0;
        for (Map<String, Object> m : matches) {
            if ("Available".equalsIgnoreCase(str(m.get("status")))) {
                availableCount++;
            }
        }

        String emptySummary;
        int unavailableCount = ineligibleCount + withoutLocationCount + staleLocationCount;
        if (matches.isEmpty()) {
            if (compatibleRegisteredCount == 0) {
                emptySummary = "No registered donors found with compatible blood groups for " + targetBlood + ".";
            } else if (unavailableCount > 0) {
                emptySummary = unavailableCount + " matching " + (unavailableCount == 1 ? "donor is" : "donors are") + " not available right now (recently donated, paused or location not shared).";
            } else if (outsideRadiusCount > 0) {
                emptySummary = outsideRadiusCount + " matching " + (outsideRadiusCount == 1 ? "donor is" : "donors are") + " outside your selected " + (int) radiusKm + " km radius.";
            } else {
                emptySummary = "No matching donors within " + (int) radiusKm + " km. Try a larger radius.";
            }
        } else {
            emptySummary = matches.size() + " matching " + (matches.size() == 1 ? "donor" : "donors") + " found within " + (int) radiusKm + " km.";
        }

        response.put("donors", matches);
        response.put("unlocatedCount", withoutLocationCount);
        response.put("withoutLocationCount", withoutLocationCount);
        response.put("compatibleRegisteredCount", compatibleRegisteredCount);
        response.put("ineligibleCount", ineligibleCount);
        response.put("staleLocationCount", staleLocationCount);
        response.put("outsideRadiusCount", outsideRadiusCount);
        response.put("emptyReasonSummary", emptySummary);
        response.put("totalMatches", matches.size());
        response.put("availableCount", availableCount);
        response.put("recipientBloodType", targetBlood);
        response.put("radiusKm", radiusKm);

        return response;
    }

    public List<Map<String, Object>> searchPublicAvailability(String bloodGroup, double radiusKm, String pincode, Double userLat, Double userLng) throws SQLException {
        List<Map<String, Object>> results = new ArrayList<>();
        if (userLat == null || userLng == null || userLat == 0.0 || userLng == 0.0) {
            // Live radial search requires active user coordinates
            return results;
        }

        String sql = "SELECT donor_id, name, blood_type, latitude, longitude, pincode, city, state, zone, availability, created_at, last_donation FROM donors WHERE (availability IS NULL OR (LOWER(availability) <> 'unavailable' AND LOWER(availability) <> 'deleted'))";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            int rowIdx = 1;
            while (rs.next()) {
                String bType = rs.getString("blood_type");
                if (bType == null || bType.isBlank()) continue;

                // Match exact or compatible blood group
                if (bloodGroup != null && !bloodGroup.isBlank() && !"ALL".equalsIgnoreCase(bloodGroup.trim())) {
                    String cleanBg = bloodGroup.trim();
                    if (!cleanBg.equalsIgnoreCase(bType) && !DistanceCalculator.isCompatibleBloodType(bType, cleanBg)) {
                        continue;
                    }
                }

                Double donorLat = null;
                Double donorLng = null;
                Object latObj = rs.getObject("latitude");
                Object lngObj = rs.getObject("longitude");
                if (latObj instanceof Number) donorLat = ((Number) latObj).doubleValue();
                if (lngObj instanceof Number) donorLng = ((Number) lngObj).doubleValue();

                // Strict radial calculation: donor must have real coordinates in database
                if (donorLat == null || donorLng == null || donorLat == 0.0 || donorLng == 0.0) {
                    continue;
                }

                double distance = DistanceCalculator.calculateDistance(userLat, userLng, donorLat, donorLng);
                if (distance > radiusKm) {
                    continue; // Strictly outside the requested radial band
                }

                String donorId = rs.getString("donor_id");
                if (donorId == null || donorId.isBlank()) {
                    donorId = "DNR-0101-D" + (100 + rowIdx);
                }

                String rawName = rs.getString("name");
                String maskedName = com.red404.dao.BloodRequestNotificationDao.maskDonorName(rawName);

                Map<String, Object> item = new HashMap<>();
                item.put("id", donorId);
                item.put("donorId", donorId);
                item.put("name", maskedName);
                item.put("group", bType);
                item.put("bloodType", bType);
                item.put("rh", bType.contains("-") ? "RH-" : "RH+");
                item.put("distKm", Math.round(distance * 10.0) / 10.0);
                item.put("city", rs.getString("city"));
                item.put("state", rs.getString("state"));
                item.put("zone", rs.getString("zone"));
                item.put("status", "Ready to Donate");
                item.put("lastSeen", "Telemetry Active");
                results.add(item);
                rowIdx++;
            }
        }
        results.sort((a, b) -> Double.compare(
                ((Number) a.get("distKm")).doubleValue(),
                ((Number) b.get("distKm")).doubleValue()));
        return results;
    }

    public Map<String, Object> getPlatformStats() throws SQLException {
        return com.red404.service.PlatformMetricsService.getInstance().getPlatformStats();
    }

    public Map<String, Object> getNationalBloodStock() throws SQLException {
        return com.red404.service.PlatformMetricsService.getInstance().getPublicNationalBloodStock();
    }

    public List<Map<String, Object>> donationHistory(int donorId) throws SQLException {
        return donationHistory(String.valueOf(donorId));
    }

    public List<Map<String, Object>> donationHistory(String donorId) throws SQLException {
        ensureDonationsTableCols();
        List<Map<String, Object>> rows = new ArrayList<>();
        if (donorId == null || donorId.isBlank()) return rows;
        String sql = "SELECT d.id AS donationId, d.donation_date AS donationDate, d.created_at AS createdAt, h.hospital_name AS hospitalName, " +
                "d.blood_type AS bloodType, d.units, d.volume_ml AS volumeMl, d.status, d.request_id AS requestId, d.vitals_json AS vitalsJson FROM donations d " +
                "LEFT JOIN hospitals h ON d.hospital_id = h.id " +
                "WHERE (d.donor_id = ? OR d.donor_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1) OR d.donor_id = (SELECT CAST(id AS CHAR) FROM donors WHERE donor_id = ? LIMIT 1)) " +
                "AND UPPER(d.status) IN ('COMPLETED', 'APPROVED', 'VERIFIED') " +
                "ORDER BY d.donation_date DESC, d.id DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, donorId.trim());
            int numericId = 0;
            try { numericId = Integer.parseInt(donorId.trim()); } catch (Exception ignored) {}
            ps.setInt(2, numericId);
            ps.setString(3, donorId.trim());
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
                    String bType = rs.getString("bloodType");
                    row.put("bloodType", bType);
                    row.put("bloodGroup", bType);
                    row.put("blood_group", bType);
                    Timestamp createdAt = null;
                    try {
                        createdAt = rs.getTimestamp("createdAt");
                    } catch (Exception ignored) {}
                    if (createdAt != null) {
                        row.put("createdAt", createdAt.toInstant().toString());
                        row.put("created_at", createdAt.toInstant().toString());
                        row.put("timestamp", createdAt.toInstant().toString());
                    } else if (date != null) {
                        row.put("createdAt", date.toString() + "T06:30:00Z");
                        row.put("created_at", date.toString() + "T06:30:00Z");
                        row.put("timestamp", date.toString() + "T06:30:00Z");
                    }
                    int units = rs.getInt("units");
                    row.put("units", units > 0 ? units : 1);
                    row.put("unitsDonated", (units > 0 ? units : 1) + " Unit");
                    int vol = rs.getInt("volumeMl");
                    if (vol <= 0) vol = 450;
                    row.put("volumeMl", vol);
                    row.put("volume_ml", vol);
                    row.put("volume", vol + " mL");
                    row.put("donationType", "Whole Blood");
                    String status = rs.getString("status");
                    row.put("status", status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
                    try {
                        Object rId = rs.getObject("requestId");
                        if (rId != null) {
                            row.put("requestId", rId);
                            row.put("request_id", rId);
                        }
                    } catch (SQLException ignored) {}
                    try {
                        String vJson = rs.getString("vitalsJson");
                        if (vJson != null && !vJson.isBlank()) {
                            row.put("vitalsJson", vJson);
                        }
                    } catch (SQLException ignored) {}
                    rows.add(row);
                }
            }
        } catch (SQLException e) {
            if (isMissingTable(e)) {
                return rows;
            }
            // Fallback for schemas without request_id column
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("request_id")) {
                return donationHistoryLegacy(donorId);
            }
            throw e;
        }
        return rows;
    }

    private List<Map<String, Object>> donationHistoryLegacy(String donorId) throws SQLException {
        ensureDonationsTableCols();
        List<Map<String, Object>> rows = new ArrayList<>();
        String sql = "SELECT d.id AS donationId, d.donation_date AS donationDate, d.created_at AS createdAt, h.hospital_name AS hospitalName, " +
                "d.blood_type AS bloodType, d.units, d.volume_ml AS volumeMl, d.status, d.vitals_json AS vitalsJson FROM donations d " +
                "LEFT JOIN hospitals h ON d.hospital_id = h.id " +
                "WHERE (d.donor_id = ? OR d.donor_id = (SELECT donor_id FROM donors WHERE id = ? LIMIT 1) OR d.donor_id = (SELECT CAST(id AS CHAR) FROM donors WHERE donor_id = ? LIMIT 1)) " +
                "AND UPPER(d.status) IN ('COMPLETED', 'APPROVED', 'VERIFIED') " +
                "ORDER BY d.donation_date DESC, d.id DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, donorId.trim());
            int numericId = 0;
            try { numericId = Integer.parseInt(donorId.trim()); } catch (Exception ignored) {}
            ps.setInt(2, numericId);
            ps.setString(3, donorId.trim());
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
                    String bType = rs.getString("bloodType");
                    row.put("bloodType", bType);
                    row.put("bloodGroup", bType);
                    row.put("blood_group", bType);
                    Timestamp createdAt = null;
                    try {
                        createdAt = rs.getTimestamp("createdAt");
                    } catch (Exception ignored) {}
                    if (createdAt != null) {
                        row.put("createdAt", createdAt.toInstant().toString());
                        row.put("created_at", createdAt.toInstant().toString());
                        row.put("timestamp", createdAt.toInstant().toString());
                    } else if (date != null) {
                        row.put("createdAt", date.toString() + "T06:30:00Z");
                        row.put("created_at", date.toString() + "T06:30:00Z");
                        row.put("timestamp", date.toString() + "T06:30:00Z");
                    }
                    int units = rs.getInt("units");
                    row.put("units", units > 0 ? units : 1);
                    row.put("unitsDonated", (units > 0 ? units : 1) + " Unit");
                    int vol = rs.getInt("volumeMl");
                    if (vol <= 0) vol = 450;
                    row.put("volumeMl", vol);
                    row.put("volume_ml", vol);
                    row.put("volume", vol + " mL");
                    row.put("donationType", "Whole Blood");
                    String status = rs.getString("status");
                    row.put("status", status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
                    try {
                        String vJson = rs.getString("vitalsJson");
                        if (vJson != null && !vJson.isBlank()) {
                            row.put("vitalsJson", vJson);
                        }
                    } catch (SQLException ignored) {}
                    rows.add(row);
                }
            }
        }
        return rows;
    }

    public List<Map<String, Object>> findDonationsByRequestId(int requestId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        String sql = "SELECT d.id AS donationId, d.donation_date AS donationDate, h.hospital_name AS hospitalName, " +
                "d.blood_type AS bloodType, d.units, d.status, d.request_id AS requestId, d.donor_id AS donorId FROM donations d " +
                "LEFT JOIN hospitals h ON d.hospital_id = h.id " +
                "WHERE d.request_id = ? AND UPPER(d.status) IN ('COMPLETED', 'APPROVED', 'VERIFIED') " +
                "ORDER BY d.donation_date DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new HashMap<>();
                    int dId = rs.getInt("donationId");
                    row.put("donationId", dId);
                    row.put("id", "RED-" + String.format("%05d", dId));
                    row.put("refCode", "RED-" + String.format("%05d", dId));
                    Date date = rs.getDate("donationDate");
                    row.put("donationDate", date == null ? null : date.toString());
                    row.put("date", date == null ? null : date.toString());
                    String hospName = rs.getString("hospitalName");
                    row.put("hospitalName", hospName != null && !hospName.isBlank() ? hospName : "City General Hospital");
                    row.put("hospital", hospName != null && !hospName.isBlank() ? hospName : "City General Hospital");
                    row.put("bloodType", rs.getString("bloodType"));
                    int units = rs.getInt("units");
                    row.put("units", units > 0 ? units : 1);
                    row.put("donorId", rs.getString("donorId"));
                    row.put("requestId", requestId);
                    row.put("status", rs.getString("status"));
                    rows.add(row);
                }
            }
        } catch (Exception ignored) {}
        return rows;
    }

    public boolean recordDonation(int donorId, Integer hospitalId, String bloodType, int units, String status) throws SQLException {
        return recordDonation(String.valueOf(donorId), hospitalId, bloodType, units, status);
    }

    public boolean recordDonation(String donorId, Integer hospitalId, String bloodType, int units, String status) throws SQLException {
        return recordDonation(donorId, hospitalId, bloodType, units, 450, null, "Staff", status, null);
    }

    public boolean recordDonation(String donorId, Integer hospitalId, String bloodType, int units, int volumeMl, String vitalsJson, String staffUser, String status, String deferralReason) throws SQLException {
        return recordDonation(donorId, hospitalId, bloodType, units, volumeMl, vitalsJson, staffUser, status, deferralReason, null);
    }

    public int recordDonationWithId(Connection conn, String donorId, Integer hospitalId, String bloodType, int units, int volumeMl, String vitalsJson, String staffUser, String status, String deferralReason, Integer requestId) throws SQLException {
        ensureDonationsTableCols();
        String sql = "INSERT INTO donations (donor_id, hospital_id, blood_type, units, volume_ml, vitals_json, staff_user, donation_date, status, deferral_reason, request_id, created_at) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, donorId != null ? donorId.trim() : "DNR-0101-D1");
            if (hospitalId == null || hospitalId <= 0) {
                ps.setNull(2, Types.INTEGER);
            } else {
                ps.setInt(2, hospitalId);
            }
            ps.setString(3, bloodType != null && !bloodType.isBlank() ? bloodType : "O-");
            ps.setInt(4, units > 0 ? units : 1);
            ps.setInt(5, volumeMl > 0 ? volumeMl : 450);
            ps.setString(6, vitalsJson);
            ps.setString(7, staffUser != null ? staffUser : "Staff");
            ps.setString(8, status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
            ps.setString(9, deferralReason);
            if (requestId == null || requestId <= 0) {
                ps.setNull(10, Types.INTEGER);
            } else {
                ps.setInt(10, requestId);
            }
            int affected = ps.executeUpdate();
            if (affected > 0 && !"DEFERRED".equalsIgnoreCase(status)) {
                try (PreparedStatement upd = conn.prepareStatement("UPDATE donors SET last_donation = CURRENT_DATE WHERE donor_id = ? OR CAST(id AS CHAR) = ?")) {
                    upd.setString(1, donorId);
                    upd.setString(2, donorId);
                    upd.executeUpdate();
                } catch (SQLException ignored) {}
            }
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
            return affected > 0 ? 1 : -1;
        }
    }

    public boolean recordDonation(String donorId, Integer hospitalId, String bloodType, int units, int volumeMl, String vitalsJson, String staffUser, String status, String deferralReason, Integer requestId) throws SQLException {
        ensureDonationsTableCols();
        String sql = "INSERT INTO donations (donor_id, hospital_id, blood_type, units, volume_ml, vitals_json, staff_user, donation_date, status, deferral_reason, request_id, created_at) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, donorId != null ? donorId.trim() : "DNR-0101-D1");
            if (hospitalId == null || hospitalId <= 0) {
                ps.setNull(2, Types.INTEGER);
            } else {
                ps.setInt(2, hospitalId);
            }
            ps.setString(3, bloodType != null && !bloodType.isBlank() ? bloodType : "O-");
            ps.setInt(4, units > 0 ? units : 1);
            ps.setInt(5, volumeMl > 0 ? volumeMl : 450);
            ps.setString(6, vitalsJson);
            ps.setString(7, staffUser != null ? staffUser : "Staff");
            ps.setString(8, status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
            ps.setString(9, deferralReason);
            if (requestId == null || requestId <= 0) {
                ps.setNull(10, Types.INTEGER);
            } else {
                ps.setInt(10, requestId);
            }
            int inserted = ps.executeUpdate();
            if (inserted > 0 && !"DEFERRED".equalsIgnoreCase(status)) {
                try (PreparedStatement upd = conn.prepareStatement("UPDATE donors SET last_donation = CURRENT_DATE WHERE donor_id = ? OR CAST(id AS CHAR) = ?")) {
                    upd.setString(1, donorId);
                    upd.setString(2, donorId);
                    upd.executeUpdate();
                } catch (SQLException ignored) {}
            }
            return inserted > 0;
        } catch (SQLException e) {
            String fallbackSql = "INSERT INTO donations (donor_id, hospital_id, blood_type, units, volume_ml, vitals_json, staff_user, donation_date, status, deferral_reason, created_at) " +
                                 "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, CURRENT_TIMESTAMP)";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(fallbackSql)) {
                ps.setString(1, donorId != null ? donorId.trim() : "DNR-0101-D1");
                if (hospitalId == null || hospitalId <= 0) {
                    ps.setNull(2, Types.INTEGER);
                } else {
                    ps.setInt(2, hospitalId);
                }
                ps.setString(3, bloodType != null && !bloodType.isBlank() ? bloodType : "O-");
                ps.setInt(4, units > 0 ? units : 1);
                ps.setInt(5, volumeMl > 0 ? volumeMl : 450);
                ps.setString(6, vitalsJson);
                ps.setString(7, staffUser != null ? staffUser : "Staff");
                ps.setString(8, status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
                ps.setString(9, deferralReason);
                int inserted = ps.executeUpdate();
                if (inserted > 0 && !"DEFERRED".equalsIgnoreCase(status)) {
                    try (PreparedStatement upd = conn.prepareStatement("UPDATE donors SET last_donation = CURRENT_DATE WHERE donor_id = ? OR CAST(id AS CHAR) = ?")) {
                        upd.setString(1, donorId);
                        upd.setString(2, donorId);
                        upd.executeUpdate();
                    } catch (SQLException ignored) {}
                }
                return inserted > 0;
            } catch (SQLException ex) {
                String legacySql = "INSERT INTO donations (donor_id, hospital_id, blood_type, units, donation_date, status, created_at) VALUES (?, ?, ?, ?, CURRENT_DATE, ?, CURRENT_TIMESTAMP)";
                try (Connection conn = DBConnection.getConnection();
                     PreparedStatement ps = conn.prepareStatement(legacySql)) {
                    ps.setString(1, donorId != null ? donorId.trim() : "DNR-0101-D1");
                    if (hospitalId == null || hospitalId <= 0) {
                        ps.setNull(2, Types.INTEGER);
                    } else {
                        ps.setInt(2, hospitalId);
                    }
                    ps.setString(3, bloodType != null && !bloodType.isBlank() ? bloodType : "O-");
                    ps.setInt(4, units > 0 ? units : 1);
                    ps.setString(5, status != null && !status.isBlank() ? status.toUpperCase() : "COMPLETED");
                    int inserted = ps.executeUpdate();
                    if (inserted > 0 && !"DEFERRED".equalsIgnoreCase(status)) {
                        try (PreparedStatement upd = conn.prepareStatement("UPDATE donors SET last_donation = CURRENT_DATE WHERE donor_id = ? OR CAST(id AS CHAR) = ?")) {
                            upd.setString(1, donorId);
                            upd.setString(2, donorId);
                            upd.executeUpdate();
                        } catch (SQLException ignored) {}
                    }
                    return inserted > 0;
                } catch (SQLException ex2) {
                    if (isMissingTable(ex2)) {
                        return false;
                    }
                    throw ex2;
                }
            }
        }
    }

    private Map<String, Object> mapDonor(ResultSet rs, boolean includePrivate) throws SQLException {
        Map<String, Object> donor = new HashMap<>();
        int idVal = rs.getInt("id");
        donor.put("id", idVal);
        String donorIdVal = null;
        try {
            donorIdVal = rs.getString("donor_id");
        } catch (SQLException ignored) {}
        Date dob = null;
        try {
            dob = rs.getDate("dob");
        } catch (Exception ignored) {}
        String name = rs.getString("name");
        if (donorIdVal != null && !donorIdVal.isBlank() && donorIdVal.trim().startsWith("DNR-")) {
            donorIdVal = donorIdVal.trim();
            if (dob != null) {
                // If DOB exists, synchronize strictly the [DDMM] portion to match DOB, preserving the [Initial][3 Numbers] suffix intact
                String updatedDobId = com.red404.util.DonorIdGenerator.updateDonorIdDob(donorIdVal, dob, name);
                if (updatedDobId != null && !updatedDobId.equalsIgnoreCase(donorIdVal)) {
                    donorIdVal = updatedDobId;
                    try (Connection c = DBConnection.getConnection();
                         PreparedStatement upPs = c.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                        upPs.setString(1, donorIdVal);
                        upPs.setInt(2, idVal);
                        upPs.executeUpdate();
                    } catch (Exception ignored) {}
                }
            }
        } else {
            // Missing from database! Generate once using generator and PERMANENTLY store into MySQL
            try (Connection c = DBConnection.getConnection()) {
                donorIdVal = com.red404.util.DonorIdGenerator.generateUniqueDonorId(c, name, dob);
                try (PreparedStatement upPs = c.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                    upPs.setString(1, donorIdVal);
                    upPs.setInt(2, idVal);
                    upPs.executeUpdate();
                    log.info("Permanently assigned Smart Donor ID {} to donor #{}", donorIdVal, idVal);
                }
            } catch (Exception e) {
                // Deterministic fallback tied to idVal so the exact same donor ID is returned every single time
                char initial = com.red404.util.DonorIdGenerator.extractInitial(name);
                String ddmm = com.red404.util.DonorIdGenerator.extractDDMM(dob);
                int stableNum = 100 + ((idVal * 137 + 241) % 900);
                donorIdVal = String.format("DNR-%s-%c%d", ddmm, initial, stableNum);
            }
        }
        donor.put("donorId", donorIdVal);
        donor.put("donor_id", donorIdVal);
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
        String bTypeVal = rs.getString("blood_type");
        donor.put("bloodType", bTypeVal);
        donor.put("blood_type", bTypeVal);
        donor.put("bloodGroup", bTypeVal);
        donor.put("city", rs.getString("city"));
        donor.put("state", rs.getString("state"));
        donor.put("zone", rs.getString("zone"));
        donor.put("availability", rs.getString("availability"));
        donor.put("weight", rs.getObject("weight"));
        donor.put("address", rs.getString("address"));
        donor.put("pincode", rs.getString("pincode"));
        donor.put("latitude", rs.getObject("latitude"));
        donor.put("longitude", rs.getObject("longitude"));
        try {
            java.sql.Timestamp locUpdated = rs.getTimestamp("location_updated_at");
            donor.put("locationUpdatedAt", locUpdated == null ? null : locUpdated.toString());
        } catch (SQLException ignored) {
            donor.put("locationUpdatedAt", null);
        }
        Date lastDonation = rs.getDate("last_donation");
        // Derive from latest verified donation if cached column is null (Part 1, Requirement 1)
        if (lastDonation == null) {
            try {
                int dId = rs.getInt("id");
                String dCode = rs.getString("donor_id");
                try (Connection conn = DBConnection.getConnection();
                     PreparedStatement donPs = conn.prepareStatement(
                        "SELECT MAX(donation_date) FROM donations WHERE (donor_id = ? OR donor_id = CAST(? AS CHAR)) AND UPPER(status) IN ('COMPLETED', 'VERIFIED', 'APPROVED')")) {
                    donPs.setString(1, dCode != null ? dCode : String.valueOf(dId));
                    donPs.setInt(2, dId);
                    try (ResultSet drs = donPs.executeQuery()) {
                        if (drs.next()) {
                            lastDonation = drs.getDate(1);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        donor.put("lastDonation", lastDonation == null ? null : lastDonation.toString());
        donor.put("lastDonationDate", lastDonation == null ? null : lastDonation.toString());
        donor.put("dateOfBirth", dob == null ? null : dob.toString());
        donor.put("dob", dob == null ? null : dob.toString());
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
            donor.put("healthStatus", rs.getString("health_status"));
        } catch (SQLException ignored) {
            donor.put("healthStatus", null);
        }
        try {
            boolean optIn = rs.getBoolean("public_search_opt_in");
            donor.put("publicSearchOptIn", optIn);
            donor.put("public_search_opt_in", optIn);
        } catch (SQLException ignored) {
            donor.put("publicSearchOptIn", false);
            donor.put("public_search_opt_in", false);
        }
        try {
            String pName = rs.getString("public_display_name");
            donor.put("publicDisplayName", pName);
            donor.put("public_display_name", pName);
        } catch (SQLException ignored) {
            donor.put("publicDisplayName", null);
            donor.put("public_display_name", null);
        }
        try {
            Timestamp consent = rs.getTimestamp("public_consent_at");
            donor.put("publicConsentAt", consent != null ? consent.toString() : null);
            donor.put("public_consent_at", consent != null ? consent.toString() : null);
        } catch (SQLException ignored) {
            donor.put("publicConsentAt", null);
            donor.put("public_consent_at", null);
        }

        // Part 6: Donor's current values = the latest health_check that has values
        try {
            String dCode = rs.getString("donor_id");
            int dId = rs.getInt("id");
            HealthCheckDao hcDao = new HealthCheckDao();
            String queryId = dCode != null && !dCode.isBlank() ? dCode : String.valueOf(dId);
            // 1. Latest check with vitals populates clinical fields
            Map<String, Object> latestCheck = hcDao.getLatestHealthCheck(queryId);
            if (latestCheck != null) {
                if (latestCheck.get("weight") != null) donor.put("weight", latestCheck.get("weight"));
                if (latestCheck.get("pulse") != null) donor.put("pulse", latestCheck.get("pulse"));
                if (latestCheck.get("hemoglobin") != null) donor.put("hemoglobin", latestCheck.get("hemoglobin"));
                if (latestCheck.get("bloodPressure") != null) donor.put("bloodPressure", latestCheck.get("bloodPressure"));
                if (latestCheck.get("temperature") != null) donor.put("bodyTemp", latestCheck.get("temperature"));
                if (latestCheck.get("hospitalName") != null) {
                    donor.put("verifiedFacility", latestCheck.get("hospitalName"));
                }
                if (latestCheck.get("date") != null) {
                    donor.put("verifiedDate", latestCheck.get("date"));
                }
                if (latestCheck.get("hospitalName") != null && latestCheck.get("date") != null) {
                    donor.put("healthStatus", "Checked at " + latestCheck.get("hospitalName") + " on " + latestCheck.get("date"));
                }
            }

            // 2. Latest check overall (any outcome) determines active deferral state
            Map<String, Object> latestAny = hcDao.getLatestHealthCheckAny(queryId);
            if (latestAny != null) {
                String outcome = String.valueOf(latestAny.get("outcome"));
                if ("deferred".equalsIgnoreCase(outcome)) {
                    Object defUntil = latestAny.get("deferUntil");
                    if (defUntil != null) {
                        java.time.LocalDate defDate = null;
                        try {
                            defDate = java.time.LocalDate.parse(defUntil.toString().substring(0, 10));
                        } catch (Exception ignored) {}
                        if (defDate != null && defDate.isAfter(java.time.LocalDate.now())) {
                            donor.put("isDeferred", true);
                            donor.put("deferUntil", defUntil);
                            donor.put("deferredUntil", defUntil);
                            donor.put("deferral_until", defUntil);
                            donor.put("deferred_until", defUntil);
                        } else {
                            // Deferral period has expired, normal rules take over
                            donor.put("isDeferred", false);
                        }
                    } else {
                        // Indefinite deferral
                        donor.put("isDeferred", true);
                    }
                } else {
                    donor.put("isDeferred", false);
                }
            }
            // Deferral reason is confidential to hospital - ensure it's not exposed in donor object
            donor.remove("deferReasonCategory");
        } catch (Exception ignored) {}
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
        try {
            String bgStatus = rs.getString("blood_group_status");
            donor.put("bloodGroupStatus", (bgStatus != null && !bgStatus.isBlank()) ? bgStatus : "self_declared");
            donor.put("blood_group_status", donor.get("bloodGroupStatus"));
            donor.put("bloodGroupVerifiedByHospitalId", rs.getObject("blood_group_verified_by_hospital_id"));
            donor.put("bloodGroupVerifiedByHospitalName", rs.getString("blood_group_verified_by_hospital_name"));
            java.sql.Timestamp bgVerAt = rs.getTimestamp("blood_group_verified_at");
            donor.put("bloodGroupVerifiedAt", bgVerAt != null ? bgVerAt.toString() : null);
            donor.put("bloodGroupEditCount", rs.getInt("blood_group_edit_count"));
        } catch (SQLException ignored) {
            donor.put("bloodGroupStatus", "self_declared");
            donor.put("blood_group_status", "self_declared");
            donor.put("bloodGroupVerifiedByHospitalId", null);
            donor.put("bloodGroupVerifiedByHospitalName", null);
            donor.put("bloodGroupVerifiedAt", null);
            donor.put("bloodGroupEditCount", 0);
        }
        try {
            donor.put("preferredLanguage", rs.getString("preferred_language"));
            donor.put("preferred_language", rs.getString("preferred_language"));
            donor.put("smsNotif", false);
            donor.put("emailNotif", rs.getObject("email_notif") != null ? rs.getBoolean("email_notif") : true);
            donor.put("pushNotif", rs.getObject("push_notif") != null ? rs.getBoolean("push_notif") : true);
            donor.put("hospitalReviewNeeded", rs.getObject("hospital_review_needed") != null ? rs.getBoolean("hospital_review_needed") : false);
            donor.put("hospital_review_needed", donor.get("hospitalReviewNeeded"));
            donor.put("healthAnswersJson", rs.getString("health_answers_json"));
            donor.put("health_answers_json", rs.getString("health_answers_json"));
            donor.put("availabilityPref", rs.getString("availability_pref"));
            donor.put("availability_pref", rs.getString("availability_pref"));
            donor.put("lastDonationSelfReported", rs.getDate("last_donation_self_reported"));
            donor.put("last_donation_self_reported", rs.getDate("last_donation_self_reported"));
            donor.put("emailVerified", rs.getObject("email_verified") != null ? rs.getBoolean("email_verified") : false);
            donor.put("email_verified", donor.get("emailVerified"));
            donor.put("emailVerifiedAt", rs.getTimestamp("email_verified_at"));
            donor.put("publicSearchOptIn", rs.getObject("public_search_opt_in") != null ? rs.getBoolean("public_search_opt_in") : false);
            donor.put("public_search_opt_in", donor.get("publicSearchOptIn"));
            donor.put("publicDisplayName", rs.getString("public_display_name"));
        } catch (SQLException ignored) {
            donor.put("preferredLanguage", "en");
            donor.put("preferred_language", "en");
            donor.put("smsNotif", false);
            donor.put("emailNotif", true);
            donor.put("pushNotif", true);
            donor.put("hospitalReviewNeeded", false);
            donor.put("hospital_review_needed", false);
            donor.put("emailVerified", false);
            donor.put("email_verified", false);
            donor.put("publicSearchOptIn", false);
            donor.put("public_search_opt_in", false);
        }
        return donor;
    }

    private static void setDate(PreparedStatement ps, int index, Object date) throws SQLException {
        if (date == null) {
            ps.setNull(index, Types.DATE);
        } else if (date instanceof Date) {
            ps.setDate(index, (Date) date);
        } else if (date instanceof java.util.Date) {
            ps.setDate(index, new Date(((java.util.Date) date).getTime()));
        } else {
            try {
                ps.setDate(index, Date.valueOf(str(date).trim()));
            } catch (Exception e) {
                ps.setNull(index, Types.DATE);
            }
        }
    }

    private static void setDouble(PreparedStatement ps, int index, Object value) throws SQLException {
        if (value == null || str(value).isBlank()) {
            ps.setNull(index, Types.DOUBLE);
        } else if (value instanceof Number) {
            ps.setDouble(index, ((Number) value).doubleValue());
        } else {
            try {
                ps.setDouble(index, Double.parseDouble(str(value).trim()));
            } catch (Exception e) {
                ps.setNull(index, Types.DOUBLE);
            }
        }
    }

    private static void setInt(PreparedStatement ps, int index, Object value) throws SQLException {
        if (value == null || str(value).isBlank()) {
            ps.setNull(index, Types.INTEGER);
        } else if (value instanceof Number) {
            ps.setInt(index, ((Number) value).intValue());
        } else {
            try {
                ps.setInt(index, Integer.parseInt(str(value).trim()));
            } catch (Exception e) {
                ps.setNull(index, Types.INTEGER);
            }
        }
    }

    private static Double numDouble(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s && !s.isBlank()) {
            try { return Double.parseDouble(s.trim()); } catch (Exception ignored) {}
        }
        return null;
    }

    private static Integer numInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s && !s.isBlank()) {
            try { return Integer.parseInt(s.trim()); } catch (Exception ignored) {}
        }
        return null;
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
