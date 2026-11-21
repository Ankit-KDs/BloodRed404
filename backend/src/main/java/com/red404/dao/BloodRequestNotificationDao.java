package com.red404.dao;

import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.*;
import java.util.*;

public class BloodRequestNotificationDao {

    private static final Logger log = LoggerFactory.getLogger(BloodRequestNotificationDao.class);

    public static final int EXPIRY_MINUTES = 60;

    public void ensureTableExists() {
        String sql = "CREATE TABLE IF NOT EXISTS blood_request_notifications (" +
                     "    id INT AUTO_INCREMENT PRIMARY KEY," +
                     "    request_id INT NOT NULL," +
                     "    donor_id INT NOT NULL," +
                     "    hospital_id INT NOT NULL," +
                     "    blood_type VARCHAR(10) NOT NULL," +
                     "    units_requested INT DEFAULT 1," +
                     "    patient_name VARCHAR(150)," +
                     "    notes TEXT," +
                     "    status VARCHAR(20) DEFAULT 'NOTIFIED'," +
                     "    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
                     "    responded_at TIMESTAMP NULL" +
                     ")";
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
        expireOldNotifications();
        String sql = "SELECT n.status FROM blood_request_notifications n " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "WHERE n.donor_id = ? AND n.hospital_id = ? " +
                     "AND UPPER(br.status) IN ('OPEN', 'ACTIVE', 'PENDING', 'ACCEPTED', 'ARRIVED') " +
                     "AND (br.created_at IS NULL OR br.created_at >= NOW() - INTERVAL " + EXPIRY_MINUTES + " MINUTE) " +
                     "AND UPPER(n.status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') " +
                     "ORDER BY n.id DESC LIMIT 1";
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
        expireOldNotifications();
        Map<Integer, String> map = new HashMap<>();
        String sql = "SELECT n.donor_id, n.status FROM blood_request_notifications n " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "WHERE n.hospital_id = ? " +
                     "AND UPPER(br.status) IN ('OPEN', 'ACTIVE', 'PENDING', 'ACCEPTED', 'ARRIVED') " +
                     "AND (br.created_at IS NULL OR br.created_at >= NOW() - INTERVAL " + EXPIRY_MINUTES + " MINUTE) " +
                     "AND UPPER(n.status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') " +
                     "ORDER BY n.id ASC";
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

    public int getActiveRequestIdForDonorAndHospital(int donorId, int hospitalId) {
        ensureTableExists();
        expireOldNotifications();
        String sql = "SELECT n.request_id FROM blood_request_notifications n " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "WHERE n.donor_id = ? AND n.hospital_id = ? " +
                     "AND UPPER(br.status) IN ('OPEN', 'ACTIVE', 'PENDING', 'ACCEPTED', 'ARRIVED') " +
                     "AND (br.created_at IS NULL OR br.created_at >= NOW() - INTERVAL " + EXPIRY_MINUTES + " MINUTE) " +
                     "ORDER BY n.id DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            ps.setInt(2, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return rs.getInt(1);
            }
        } catch (Exception ignored) {}
        return 0;
    }

    public boolean markDonorArrived(int requestId, int donorId) {
        ensureTableExists();
        String sql = "UPDATE blood_request_notifications SET status = 'ARRIVED', responded_at = CURRENT_TIMESTAMP WHERE request_id = ? AND donor_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            ps.setInt(2, donorId);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            log.warn("Error marking donor arrived: {}", e.getMessage());
            return false;
        }
    }

    public boolean markDonorDonated(int requestId, int donorId) {
        ensureTableExists();
        String sql = "UPDATE blood_request_notifications SET status = 'DONATED', responded_at = CURRENT_TIMESTAMP WHERE request_id = ? AND donor_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            ps.setInt(2, donorId);
            return ps.executeUpdate() > 0;
        } catch (Exception e) {
            log.warn("Error marking donor donated: {}", e.getMessage());
            return false;
        }
    }

    public boolean updateDonorResponse(int requestId, int donorId, String status) throws SQLException {
        ensureTableExists();
        String sql = "UPDATE blood_request_notifications SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE request_id = ? AND donor_id = ?";
        try (Connection conn = DBConnection.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setString(1, status.toUpperCase());
                ps.setInt(2, requestId);
                ps.setInt(3, donorId);
                if (ps.executeUpdate() > 0) {
                    return true;
                }
            }
            if (donorId > 0) {
                String insertSql = "INSERT INTO blood_request_notifications (request_id, donor_id, hospital_id, blood_type, units_requested, patient_name, notes, status, notified_at, responded_at) " +
                        "SELECT id, ?, hospital_id, blood_type, units_requested, patient_name, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM blood_requests WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                    ps.setInt(1, donorId);
                    ps.setString(2, status.toUpperCase());
                    ps.setInt(3, requestId);
                    return ps.executeUpdate() > 0;
                }
            }
            return false;
        }
    }

    public boolean acceptRequestByDonor(int requestId, int donorId) {
        ensureTableExists();
        expireOldNotifications();
        String updateSql = "UPDATE blood_request_notifications SET status = 'ACCEPTED', responded_at = CURRENT_TIMESTAMP " +
                           "WHERE request_id = ? AND donor_id = ? AND UPPER(status) <> 'EXPIRED'";
        try (Connection conn = DBConnection.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                ps.setInt(1, requestId);
                ps.setInt(2, donorId);
                if (ps.executeUpdate() > 0) {
                    return true;
                }
            }
            String insertSql = "INSERT INTO blood_request_notifications (request_id, donor_id, hospital_id, blood_type, units_requested, patient_name, notes, status, notified_at, responded_at) " +
                    "SELECT id, ?, hospital_id, blood_type, units_requested, patient_name, '', 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM blood_requests WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                ps.setInt(1, donorId);
                ps.setInt(2, requestId);
                return ps.executeUpdate() > 0;
            }
        } catch (Exception e) {
            log.warn("Error marking request accepted by donor: {}", e.getMessage());
            return false;
        }
    }

    public Map<String, Object> getAcceptedDonorForRequest(int requestId) {
        ensureTableExists();
        String sql = "SELECT n.status, d.id as donor_pk, d.donor_id, d.name, d.email, d.blood_type, d.phone, d.latitude, d.longitude, " +
                     "br.latitude as hosp_lat, br.longitude as hosp_lng " +
                     "FROM blood_request_notifications n " +
                     "JOIN donors d ON n.donor_id = d.id " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "WHERE n.request_id = ? AND UPPER(n.status) = 'ACCEPTED' " +
                     "ORDER BY n.responded_at DESC, n.id DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    String dId = rs.getString("donor_id");
                    map.put("donorId", dId != null && !dId.isBlank() ? dId : "DNR-" + rs.getInt("donor_pk"));
                    map.put("donorName", maskDonorName(rs.getString("name"), rs.getString("email")));
                    map.put("donorBloodType", rs.getString("blood_type"));
                    map.put("donorPhone", rs.getString("phone"));
                    map.put("phone", rs.getString("phone"));
                    map.put("donorEmail", rs.getString("email"));
                    map.put("email", rs.getString("email"));

                    Object dLatObj = rs.getObject("latitude");
                    Object dLngObj = rs.getObject("longitude");
                    Object hLatObj = rs.getObject("hosp_lat");
                    Object hLngObj = rs.getObject("hosp_lng");
                    if (dLatObj instanceof Number && dLngObj instanceof Number && hLatObj instanceof Number && hLngObj instanceof Number) {
                        double dist = com.red404.util.DistanceCalculator.calculateDistance(
                                ((Number) hLatObj).doubleValue(), ((Number) hLngObj).doubleValue(),
                                ((Number) dLatObj).doubleValue(), ((Number) dLngObj).doubleValue()
                        );
                        map.put("donorDistance", Math.round(dist * 10.0) / 10.0);
                    } else {
                        map.put("donorDistance", null);
                    }
                    return map;
                }
            }
        } catch (Exception e) {
            log.warn("Error getting accepted donor for request {}: {}", requestId, e.getMessage());
        }
        return null;
    }

    public void expireOldNotifications() {
        Timestamp cutoff = new Timestamp(System.currentTimeMillis() - (EXPIRY_MINUTES * 60L * 1000L));
        String sql = "UPDATE blood_request_notifications SET status = 'EXPIRED' WHERE UPPER(status) = 'NOTIFIED' AND notified_at < ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, cutoff);
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice expiring old notifications: {}", e.getMessage());
        }
    }

    public static String maskDonorName(String fullName) {
        return maskDonorName(fullName, null);
    }

    public static String maskDonorName(String fullName, String email) {
        if (fullName != null && !fullName.isBlank() && !"Donor".equalsIgnoreCase(fullName.trim())) {
            String[] parts = fullName.trim().split("\\s+");
            if (parts.length == 1) return parts[0];
            return parts[0] + " " + parts[parts.length - 1].substring(0, 1).toUpperCase() + ".";
        }
        if (email != null && email.contains("@")) {
            String prefix = email.substring(0, email.indexOf('@')).replace('.', ' ').replace('_', ' ');
            String[] parts = prefix.trim().split("\\s+");
            if (parts.length >= 2) {
                return capitalize(parts[0]) + " " + parts[1].substring(0, 1).toUpperCase() + ".";
            } else if (parts.length == 1 && !parts[0].isBlank()) {
                return capitalize(parts[0]);
            }
        }
        return "Donor";
    }

    private static String capitalize(String s) {
        if (s == null || s.isBlank()) return "Available";
        String str = s.trim();
        return Character.toUpperCase(str.charAt(0)) + str.substring(1).toLowerCase();
    }

    public List<Map<String, Object>> getDonorsForRequest(int requestId) {
        ensureTableExists();
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT n.id, n.status as notif_status, n.notified_at, n.responded_at, " +
                     "d.id as donor_pk, d.donor_id, d.name, d.email, d.blood_type, d.phone, d.latitude, d.longitude, " +
                     "br.latitude as hosp_lat, br.longitude as hosp_lng, br.status as req_status " +
                     "FROM blood_request_notifications n " +
                     "JOIN donors d ON n.donor_id = d.id " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "WHERE n.request_id = ? " +
                     "ORDER BY n.id ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    String notifStatus = rs.getString("notif_status");
                    String reqStatus = rs.getString("req_status");
                    map.put("id", rs.getInt("id"));
                    map.put("donorId", rs.getString("donor_id") != null ? rs.getString("donor_id") : "DNR-" + rs.getInt("donor_pk"));
                    map.put("donorName", maskDonorName(rs.getString("name"), rs.getString("email")));
                    map.put("bloodType", rs.getString("blood_type"));
                    map.put("status", notifStatus);
                    
                    Object dLatObj = rs.getObject("latitude");
                    Object dLngObj = rs.getObject("longitude");
                    Object hLatObj = rs.getObject("hosp_lat");
                    Object hLngObj = rs.getObject("hosp_lng");
                    if (dLatObj instanceof Number && dLngObj instanceof Number && hLatObj instanceof Number && hLngObj instanceof Number) {
                        double dist = com.red404.util.DistanceCalculator.calculateDistance(
                                ((Number) hLatObj).doubleValue(), ((Number) hLngObj).doubleValue(),
                                ((Number) dLatObj).doubleValue(), ((Number) dLngObj).doubleValue()
                        );
                        double roundedDist = Math.round(dist * 10.0) / 10.0;
                        map.put("distanceKm", roundedDist);
                        map.put("etaMinutes", com.red404.util.DistanceCalculator.getEstimatedTravelTime(roundedDist, "DRIVING"));
                    } else {
                        map.put("distanceKm", null);
                        map.put("etaMinutes", null);
                    }

                    boolean isReqActive = reqStatus != null && (reqStatus.equalsIgnoreCase("Open") || reqStatus.equalsIgnoreCase("Accepted") || reqStatus.equalsIgnoreCase("Active") || reqStatus.equalsIgnoreCase("Arrived"));
                    boolean isDonorAccepted = notifStatus != null && (notifStatus.equalsIgnoreCase("ACCEPTED") || notifStatus.equalsIgnoreCase("ARRIVED") || notifStatus.equalsIgnoreCase("DONATED"));
                    if (isReqActive && isDonorAccepted) {
                        map.put("phone", rs.getString("phone"));
                        map.put("email", rs.getString("email"));
                    } else {
                        map.put("phone", null);
                        map.put("email", null);
                    }

                    Object notifAt = rs.getObject("notified_at");
                    map.put("notifiedAt", notifAt != null ? notifAt.toString() : null);
                    Object respAt = rs.getObject("responded_at");
                    map.put("respondedAt", respAt != null ? respAt.toString() : null);
                    list.add(map);
                }
            }
        } catch (Exception e) {
            log.warn("Error getting donors for request {}: {}", requestId, e.getMessage());
        }
        return list;
    }

    public Map<String, Object> getRequestMetrics(int requestId) {
        Map<String, Object> res = new HashMap<>();
        res.put("notified", 0);
        res.put("totalNotified", 0);
        res.put("accepted", 0);
        res.put("declined", 0);
        res.put("arrived", 0);
        res.put("firstResponseTime", null);
        res.put("firstResponseMin", null);

        String sql = "SELECT status, notified_at, responded_at FROM blood_request_notifications WHERE request_id = ? ORDER BY id ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            int totalNotified = 0;
            int activeNotified = 0;
            int accepted = 0;
            int declined = 0;
            int arrived = 0;
            Long firstRespSec = null;
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    totalNotified++;
                    String st = rs.getString("status");
                    if (st != null) {
                        String stUpper = st.toUpperCase();
                        if (stUpper.equals("DECLINED")) {
                            declined++;
                        } else {
                            activeNotified++;
                        }
                        if (stUpper.equals("ACCEPTED") || stUpper.equals("ARRIVED") || stUpper.equals("DONATED")) {
                            accepted++;
                        }
                        if (stUpper.equals("ARRIVED") || stUpper.equals("DONATED")) {
                            arrived++;
                        }
                    } else {
                        activeNotified++;
                    }
                    if (firstRespSec == null && rs.getTimestamp("notified_at") != null && rs.getTimestamp("responded_at") != null) {
                        long diff = (rs.getTimestamp("responded_at").getTime() - rs.getTimestamp("notified_at").getTime()) / 1000L;
                        if (diff >= 0) {
                            firstRespSec = diff;
                        }
                    }
                }
            }
            res.put("notified", activeNotified);
            res.put("totalNotified", totalNotified);
            res.put("accepted", accepted);
            res.put("declined", declined);
            res.put("arrived", arrived);
            if (firstRespSec != null) {
                long mins = Math.max(1, Math.round(firstRespSec / 60.0));
                res.put("firstResponseMin", mins);
                res.put("firstResponseTime", mins + " min");
            }
        } catch (Exception ignored) {}
        return res;
    }

    public List<Map<String, Object>> getNotificationsForDonor(int donorId, Double donorLat, Double donorLng) {
        ensureTableExists();
        expireOldNotifications();
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT n.id as notif_id, n.request_id, n.status as notif_status, n.notified_at, n.responded_at, " +
                     "n.arrival_deadline, n.release_reason, " +
                     "n.units_requested, n.patient_name, n.notes as hosp_notes, n.blood_type as notif_blood_type, " +
                     "br.hospital_id, br.latitude as hosp_lat, br.longitude as hosp_lng, " +
                     "br.urgency_level, br.needed_within_mins, br.status as req_status, br.created_at as req_created_at, " +
                     "br.expires_at, br.close_reason, br.cancelled_reason, br.fulfillment_note, " +
                     "h.address as h_address, h.hospital_name as h_name, h.hospital_phone as h_phone, h.emergency_contact as h_emergency_contact " +
                     "FROM blood_request_notifications n " +
                     "JOIN blood_requests br ON n.request_id = br.id " +
                     "LEFT JOIN hospitals h ON br.hospital_id = h.id " +
                     "WHERE n.donor_id = ? " +
                     "ORDER BY n.id DESC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    int notifId = rs.getInt("notif_id");
                    int reqId = rs.getInt("request_id");
                    String notifStatus = rs.getString("notif_status");
                    String reqStatus = rs.getString("req_status");
                    String closeReason = rs.getString("close_reason");
                    String cancelledReason = rs.getString("cancelled_reason");
                    String releaseReason = rs.getString("release_reason");
                    Timestamp arrivalDeadline = null;
                    try { arrivalDeadline = rs.getTimestamp("arrival_deadline"); } catch (Exception ignored) {}
                    Timestamp expiresAt = null;
                    try { expiresAt = rs.getTimestamp("expires_at"); } catch (Exception ignored) {}

                    String bType = rs.getString("notif_blood_type");
                    int units = rs.getInt("units_requested");
                    String patientName = rs.getString("patient_name");
                    String notes = rs.getString("hosp_notes");
                    Timestamp notifiedAt = rs.getTimestamp("notified_at");

                    String hospName = rs.getString("h_name");
                    if (hospName == null || hospName.isBlank()) hospName = "Hospital";

                    String hospAddr = rs.getString("h_address");
                    if (hospAddr == null || hospAddr.isBlank()) hospAddr = "Hospital Address";

                    Double hLat = rs.getObject("hosp_lat") != null ? rs.getDouble("hosp_lat") : null;
                    Double hLng = rs.getObject("hosp_lng") != null ? rs.getDouble("hosp_lng") : null;

                    double dist = 0.0;
                    int eta = 15;
                    String zone = "Zone 1 (0-5km)";
                    if (donorLat != null && donorLng != null && hLat != null && hLng != null && hLat != 0.0 && hLng != 0.0) {
                        dist = com.red404.util.DistanceCalculator.calculateDistance(donorLat, donorLng, hLat, hLng);
                        eta = com.red404.util.DistanceCalculator.getEstimatedTravelTime(dist, "DRIVING");
                        if (dist <= 5.0) {
                            zone = "Zone 1 (0-5km)";
                        } else if (dist <= 10.0) {
                            zone = "Zone 2 (5-10km)";
                        } else {
                            zone = "Zone 3 (10-20km)";
                        }
                    }

                    map.put("id", reqId);
                    map.put("notifId", notifId);
                    map.put("requestId", reqId);
                    String hospPhone = rs.getString("h_phone");
                    if (hospPhone == null || hospPhone.isBlank()) hospPhone = rs.getString("h_emergency_contact");
                    if (hospPhone == null || hospPhone.isBlank()) hospPhone = "+91 108";
                    map.put("phone", hospPhone);

                    String notifUpper = notifStatus != null ? notifStatus.toUpperCase() : "NOTIFIED";
                    String reqUpper = reqStatus != null ? reqStatus.toUpperCase() : "OPEN";

                    String displayStatus = "New";
                    String finalReason = null;
                    String helperNote = null;
                    boolean isActive = false;

                    // 1. Terminal Request Statuses take absolute precedence
                    if (reqUpper.equals("FULFILLED")) {
                        displayStatus = "Fulfilled";
                        if (notifUpper.equals("DONATED")) {
                            finalReason = "Verified donation completed";
                        } else {
                            finalReason = "Request fulfilled";
                            helperNote = "This request has been fulfilled. Thank you.";
                        }
                    } else if (reqUpper.equals("CLOSED")) {
                        displayStatus = "Closed";
                        finalReason = closeReason != null && !closeReason.isBlank() ? closeReason : "Closed by hospital";
                    } else if (reqUpper.equals("CANCELLED")) {
                        displayStatus = "Cancelled";
                        finalReason = cancelledReason != null && !cancelledReason.isBlank() ? cancelledReason : "Cancelled";
                    } else if (reqUpper.equals("EXPIRED")) {
                        displayStatus = "Expired";
                        finalReason = cancelledReason != null && !cancelledReason.isBlank() ? cancelledReason : "Request expired";
                    }
                    // 2. Terminal Recipient Statuses
                    else if (notifUpper.equals("DECLINED")) {
                        displayStatus = "Declined";
                        finalReason = "Declined by you";
                    } else if (notifUpper.equals("WITHDRAWN")) {
                        displayStatus = "Withdrawn";
                        finalReason = "Withdrawn by you";
                    } else if (notifUpper.equals("RELEASED")) {
                        displayStatus = "Released";
                        finalReason = releaseReason != null && !releaseReason.isBlank() ? releaseReason : "The hospital no longer needs you for this request";
                    } else if (notifUpper.equals("NO_SHOW") || notifUpper.equals("EXPIRED")) {
                        displayStatus = "Expired";
                        finalReason = notifUpper.equals("NO_SHOW") ? "Arrival deadline passed" : "Response time expired";
                    } else if (notifUpper.equals("DONATED")) {
                        displayStatus = "Fulfilled";
                        finalReason = "Verified donation completed";
                    }
                    // 3. Active Statuses
                    else if (notifUpper.equals("ARRIVED")) {
                        displayStatus = "Arrived";
                        isActive = true;
                    } else if (notifUpper.equals("ACCEPTED")) {
                        displayStatus = "Accepted";
                        isActive = true;
                    } else { // NOTIFIED
                        displayStatus = "New";
                        isActive = true;
                    }

                    map.put("status", displayStatus);
                    map.put("displayStatus", displayStatus);
                    map.put("reqStatus", reqStatus);
                    map.put("notifStatus", notifStatus);
                    map.put("isActive", isActive);
                    map.put("finalReason", finalReason);
                    map.put("reason", finalReason);
                    map.put("helperNote", helperNote);
                    map.put("closeReason", closeReason);
                    map.put("cancelledReason", cancelledReason);
                    map.put("releaseReason", releaseReason);
                    map.put("arrivalDeadline", arrivalDeadline != null ? arrivalDeadline.toString() : null);
                    map.put("arrivalDeadlineMs", arrivalDeadline != null ? arrivalDeadline.getTime() : null);
                    map.put("expiresAt", expiresAt != null ? expiresAt.toString() : null);
                    map.put("expiresAtMs", expiresAt != null ? expiresAt.getTime() : null);
                    map.put("bloodType", bType != null ? bType : "O-");
                    map.put("unitsNeeded", units > 0 ? units : 1);
                    map.put("units", units > 0 ? units : 1);
                    map.put("patientName", patientName);
                    map.put("notes", notes != null ? notes : "Emergency blood request");
                    map.put("hospitalName", hospName);
                    map.put("hospitalAddress", hospAddr);
                    map.put("latitude", hLat);
                    map.put("longitude", hLng);
                    map.put("hospLat", hLat);
                    map.put("hospLng", hLng);
                    map.put("reqLat", hLat);
                    map.put("reqLng", hLng);
                    map.put("distanceKm", Math.round(dist * 10.0) / 10.0);
                    map.put("etaMinutes", Math.max(eta, 5));
                    map.put("zone", zone);
                    map.put("notifiedAt", notifiedAt != null ? notifiedAt.toString() : null);
                    String urg = rs.getString("urgency_level");
                    map.put("urgencyLevel", urg);
                    map.put("urgency_level", urg);
                    try {
                        Object nw = rs.getObject("needed_within_mins");
                        map.put("neededWithinMinutes", nw);
                        map.put("neededWithinMins", nw);
                    } catch (SQLException ignored) {}

                    list.add(map);
                }
            }
        } catch (Exception e) {
            log.warn("Error getting notifications for donor {}: {}", donorId, e.getMessage());
        }
        return list;
    }

    public int withdrawOpenNotificationsForDonor(int donorId, Integer excludeRequestId) {
        ensureTableExists();
        String sql = "UPDATE blood_request_notifications SET status = 'WITHDRAWN', notes = CONCAT(COALESCE(notes, ''), ' [Withdrawn - not eligible]') " +
                     "WHERE donor_id = ? AND UPPER(status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED', 'NEW')" +
                     (excludeRequestId != null && excludeRequestId > 0 ? " AND request_id <> ?" : "");
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            if (excludeRequestId != null && excludeRequestId > 0) {
                ps.setInt(2, excludeRequestId);
            }
            return ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Error withdrawing open notifications for donor {}: {}", donorId, e.getMessage());
            return 0;
        }
    }
}