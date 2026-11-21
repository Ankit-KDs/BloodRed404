package com.red404.dao;

import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;

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
import java.util.List;
import java.util.Map;

public class BloodRequestDao {

    private void ensureColumnsExist() {
        try (Connection conn = DBConnection.getConnection()) {
            ensureTableCol(conn, "blood_requests", "needed_within_mins", "INT NULL DEFAULT NULL");
            ensureTableCol(conn, "blood_requests", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
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

    private static Double parseDouble(Object val) {
        if (val instanceof Number n) return n.doubleValue();
        if (val != null && !String.valueOf(val).isBlank()) {
            try { return Double.parseDouble(String.valueOf(val).trim()); } catch (Exception ignored) {}
        }
        return null;
    }

    private static int parseInt(Object val, int fallback) {
        if (val instanceof Number n) return n.intValue();
        if (val != null && !String.valueOf(val).isBlank()) {
            try { return Integer.parseInt(String.valueOf(val).trim()); } catch (Exception ignored) {}
        }
        return fallback;
    }

    private static Date parseDate(Object val) {
        if (val instanceof Date d) return d;
        if (val instanceof java.util.Date ud) return new Date(ud.getTime());
        if (val != null && !String.valueOf(val).isBlank()) {
            String s = String.valueOf(val).trim();
            if (s.length() >= 10) s = s.substring(0, 10);
            try { return Date.valueOf(s); } catch (Exception ignored) {}
        }
        return null;
    }

    private static void setParamDouble(PreparedStatement ps, int index, Double value) throws SQLException {
        if (value == null) {
            ps.setNull(index, Types.DOUBLE);
        } else {
            ps.setDouble(index, value);
        }
    }

    public int insert(Map<String, Object> request) throws SQLException {
        ensureColumnsExist();

        int hospitalId = parseInt(request.get("hospitalId"), 0);
        Object pNameObj = request.getOrDefault("patientName", "Emergency Patient");
        String patientName = (pNameObj == null || String.valueOf(pNameObj).isBlank()) ? "Emergency Patient" : String.valueOf(pNameObj).trim();
        Object btObj = request.get("bloodType");
        String bloodType = (btObj == null || String.valueOf(btObj).isBlank()) ? "O-" : String.valueOf(btObj).trim();
        int units = parseInt(request.getOrDefault("unitsRequested", request.get("units")), 1);
        if (units <= 0) units = 1;
        Object urgObj = request.get("urgencyLevel");
        if (urgObj == null) urgObj = request.get("urgency");
        String urgency = (urgObj == null || String.valueOf(urgObj).isBlank()) ? "Urgent" : String.valueOf(urgObj).trim();
        Date requiredBefore = parseDate(request.get("requiredBefore"));
        Double latitude = parseDouble(request.get("latitude"));
        Double longitude = parseDouble(request.get("longitude"));

        Object nwObj = request.get("neededWithinMins");
        if (nwObj == null) nwObj = request.get("neededWithinMinutes");
        Integer neededWithinMins = null;
        if (nwObj != null && !String.valueOf(nwObj).isBlank()) {
            try { neededWithinMins = Integer.parseInt(String.valueOf(nwObj).trim()); } catch (Exception ignored) {}
        }

        int expiryMins = (neededWithinMins != null && neededWithinMins > 0) ? neededWithinMins : com.red404.service.RequestLifecycleService.getRequestExpiryMinutes();
        Timestamp expiresAt = new Timestamp(System.currentTimeMillis() + (expiryMins * 60L * 1000L));

        String sql = "INSERT INTO blood_requests (hospital_id, patient_name, blood_type, units_requested, " +
                "urgency_level, required_before, status, latitude, longitude, needed_within_mins, expires_at, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setInt(1, hospitalId);
            ps.setString(2, patientName);
            ps.setString(3, bloodType);
            ps.setInt(4, units);
            ps.setString(5, urgency);
            if (requiredBefore == null) {
                ps.setNull(6, Types.DATE);
            } else {
                ps.setDate(6, requiredBefore);
            }
            setParamDouble(ps, 7, latitude);
            setParamDouble(ps, 8, longitude);
            if (neededWithinMins == null) {
                ps.setNull(9, Types.INTEGER);
            } else {
                ps.setInt(9, neededWithinMins);
            }
            ps.setTimestamp(10, expiresAt);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) return keys.getInt(1);
            }
        } catch (SQLException e) {
            String fallbackSql = "INSERT INTO blood_requests (hospital_id, patient_name, blood_type, units_requested, " +
                    "urgency_level, required_before, status, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?)";
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement(fallbackSql, Statement.RETURN_GENERATED_KEYS)) {
                ps.setInt(1, hospitalId);
                ps.setString(2, patientName);
                ps.setString(3, bloodType);
                ps.setInt(4, units);
                ps.setString(5, urgency);
                if (requiredBefore == null) {
                    ps.setNull(6, Types.DATE);
                } else {
                    ps.setDate(6, requiredBefore);
                }
                setParamDouble(ps, 7, latitude);
                setParamDouble(ps, 8, longitude);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (keys.next()) return keys.getInt(1);
                }
            }
        }
        return 0;
    }

    public void expireOldRequests() {
        Timestamp cutoff = new Timestamp(System.currentTimeMillis() - 24L * 3600L * 1000L);
        String sql = "UPDATE blood_requests SET status = 'Expired' " +
                     "WHERE UPPER(status) IN ('ACTIVE', 'OPEN', 'PENDING') " +
                     "AND created_at < ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, cutoff);
            ps.executeUpdate();
        } catch (Exception ignored) {}
    }

    public List<Map<String, Object>> listActive() throws SQLException {
        expireOldRequests();
        Timestamp cutoff = new Timestamp(System.currentTimeMillis() - 24L * 3600L * 1000L);
        String sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " +
                "JOIN hospitals h ON br.hospital_id = h.id " +
                "WHERE UPPER(br.status) IN ('ACTIVE', 'OPEN', 'PENDING', 'ACCEPTED', 'ARRIVED') " +
                "AND (br.created_at IS NULL OR br.created_at >= ?) " +
                "ORDER BY br.created_at DESC";
        return queryListWithCutoff(sql, cutoff);
    }

    public List<Map<String, Object>> listByHospital(int hospitalId) throws SQLException {
        expireOldRequests();
        String sql = "SELECT br.*, h.hospital_name, h.city, h.hospital_phone FROM blood_requests br " +
                "JOIN hospitals h ON br.hospital_id = h.id WHERE br.hospital_id = ? ORDER BY br.created_at DESC";
        return queryList(sql, hospitalId);
    }

    public List<Map<String, Object>> listForDonor(Double lat, Double lng) throws SQLException {
        List<Map<String, Object>> requests = listActive();
        for (Map<String, Object> request : requests) {
            Double reqLat = parseDouble(request.get("latitude"));
            Double reqLng = parseDouble(request.get("longitude"));
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

    public boolean updateStatusWithReason(int id, String status, String reason) throws SQLException {
        String sql = "UPDATE blood_requests SET status = ?, cancelled_reason = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setString(2, reason);
            ps.setInt(3, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateStatusWithNote(int id, String status, String note) throws SQLException {
        String sql = "UPDATE blood_requests SET status = ?, fulfillment_note = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            ps.setString(2, note);
            ps.setInt(3, id);
            return ps.executeUpdate() > 0;
        }
    }

    public boolean updateRadius(int id, double radius) throws SQLException {
        String sql = "UPDATE blood_requests SET radius_km = ? WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setDouble(1, radius);
            ps.setInt(2, id);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            return false;
        }
    }

    public boolean incrementUnitsFulfilled(int id) throws SQLException {
        String sql = "UPDATE blood_requests SET units_fulfilled = COALESCE(units_fulfilled, 0) + 1, " +
                     "status = CASE WHEN COALESCE(units_fulfilled, 0) + 1 >= units_requested THEN 'Fulfilled' ELSE status END " +
                     "WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, id);
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
        }
        return list;
    }

    private List<Map<String, Object>> queryListWithCutoff(String sql, Timestamp cutoff) throws SQLException {
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (cutoff != null) {
                ps.setTimestamp(1, cutoff);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRequest(rs));
                }
            }
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
        req.put("urgency_level", urgency);
        req.put("urgency", urgency == null ? "normal" : urgency.toLowerCase());
        try {
            Object nw = rs.getObject("needed_within_mins");
            req.put("neededWithinMinutes", nw);
            req.put("neededWithinMins", nw);
        } catch (SQLException ignored) {}
        Date requiredBefore = rs.getDate("required_before");
        req.put("requiredBefore", requiredBefore == null ? null : requiredBefore.toString());
        String status = rs.getString("status");
        req.put("status", status);
        req.put("latitude", rs.getObject("latitude"));
        req.put("longitude", rs.getObject("longitude"));
        req.put("hospitalName", rs.getString("hospital_name"));
        req.put("city", rs.getString("city"));
        req.put("phone", rs.getString("hospital_phone"));
        try {
            Object rad = rs.getObject("radius_km");
            req.put("radiusKm", rad instanceof Number n ? n.doubleValue() : 10.0);
        } catch (SQLException ignored) {
            req.put("radiusKm", 10.0);
        }
        try {
            String ward = rs.getString("ward_info");
            req.put("wardInfo", ward != null && !ward.isBlank() ? ward : null);
            String staff = rs.getString("staff_user");
            req.put("staffUser", staff != null && !staff.isBlank() ? staff : "Hospital Staff");
        } catch (SQLException ignored) {
            req.put("wardInfo", null);
            req.put("staffUser", "Hospital Staff");
        }

        try {
            BloodRequestNotificationDao nDao = new BloodRequestNotificationDao();
            Map<String, Object> metrics = nDao.getRequestMetrics(id);
            req.put("donorsNotified", metrics.get("notified"));
            req.put("donorsAccepted", metrics.get("accepted"));
            req.put("donorsArrived", metrics.get("arrived"));
            req.put("firstResponseTime", metrics.get("firstResponseTime"));
            req.put("firstResponseMin", metrics.get("firstResponseMin"));
        } catch (Exception ignored) {
            req.put("donorsAccepted", 0);
            req.put("donorsNotified", 0);
            req.put("donorsArrived", 0);
            req.put("firstResponseTime", null);
        }
        try {
            req.put("unitsFulfilled", rs.getInt("units_fulfilled"));
            req.put("fulfillmentNote", rs.getString("fulfillment_note"));
            req.put("cancelledReason", rs.getString("cancelled_reason"));
            req.put("closeReason", rs.getString("close_reason"));
            req.put("close_reason", rs.getString("close_reason"));
            Timestamp exp = rs.getTimestamp("expires_at");
            req.put("expiresAt", exp == null ? null : exp.toString());
            req.put("expires_at", exp == null ? null : exp.toString());
            Timestamp cls = rs.getTimestamp("closed_at");
            req.put("closedAt", cls == null ? null : cls.toString());
        } catch (SQLException ignored) {
            req.put("unitsFulfilled", 0);
        }
        try {
            Object created = rs.getObject("created_at");
            req.put("time", created == null ? null : created.toString());
            req.put("createdAt", created == null ? null : created.toString());
            req.put("created_at", created == null ? null : created.toString());
        } catch (SQLException ignored) {
            req.put("time", null);
        }
        if ("Fulfilled".equalsIgnoreCase(status)) {
            try {
                DonorDao dDao = new DonorDao();
                List<Map<String, Object>> linked = dDao.findDonationsByRequestId(id);
                if (linked != null && !linked.isEmpty()) {
                    req.put("linkedDonations", linked);
                    req.put("donationRecord", linked.get(0));
                    req.put("donationId", linked.get(0).get("donationId"));
                    req.put("donationRef", linked.get(0).get("refCode"));
                }
            } catch (Exception ignored) {}
        }
        return req;
    }
}
