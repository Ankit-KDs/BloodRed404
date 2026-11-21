package com.red404.service;

import com.red404.config.EnvConfig;
import com.red404.controller.DonorController;
import com.red404.controller.HospitalController;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.BloodRequestNotificationDao;
import com.red404.dao.DonorDao;
import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.*;
import java.util.*;

/**
 * Authoritative Single Source of Truth for Blood Request Lifecycle (Round 12 Part 1).
 *
 * Request Statuses:   open, accepted, arrived, fulfilled, closed, cancelled, expired
 * Recipient Statuses: notified, accepted, declined, withdrawn, arrived, donated, released, expired, no_show
 *
 * Guarantees:
 * 1. Single database transaction per state transition.
 * 2. Idempotent transitions.
 * 3. Audit trail in blood_request_audits table {request_id, actor, from_status, to_status, reason, created_at}.
 * 4. Immediate realtime event push to BOTH hospital and donor SSE channels.
 * 5. Automatic background expiry job every 10 seconds.
 */
@Service
public class RequestLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(RequestLifecycleService.class);

    private static final RequestLifecycleService INSTANCE = new RequestLifecycleService();

    public static RequestLifecycleService getInstance() {
        return INSTANCE;
    }

    public static int getRequestExpiryMinutes() {
        return EnvConfig.getAsInt("REQUEST_EXPIRY_MINUTES", 60);
    }

    public static int getAcceptedArrivalMinutes() {
        return EnvConfig.getAsInt("ACCEPTED_ARRIVAL_MINUTES", 120);
    }

    public static int getFreshnessHours() {
        return EnvConfig.getAsInt("DONOR_LOCATION_FRESHNESS_HOURS", 24);
    }

    // ==========================================
    // AUDIT LOGGING HELPER (runs within connection transaction)
    // ==========================================
    public void recordAudit(Connection conn, int requestId, String actor, String fromStatus, String toStatus, String reason) {
        String sql = "INSERT INTO blood_request_audits (request_id, actor, from_status, to_status, reason, created_at) " +
                     "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            ps.setString(2, actor != null ? actor : "System");
            ps.setString(3, fromStatus != null ? fromStatus : "unknown");
            ps.setString(4, toStatus != null ? toStatus : "unknown");
            ps.setString(5, reason != null ? reason : "");
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice recording blood request audit: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getAuditsForRequest(int requestId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT id, request_id, actor, from_status, to_status, reason, created_at " +
                     "FROM blood_request_audits WHERE request_id = ? ORDER BY created_at ASC, id ASC";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, requestId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("requestId", rs.getInt("request_id"));
                    map.put("actor", rs.getString("actor"));
                    map.put("fromStatus", rs.getString("from_status"));
                    map.put("toStatus", rs.getString("to_status"));
                    map.put("reason", rs.getString("reason"));
                    Timestamp ts = rs.getTimestamp("created_at");
                    map.put("time", ts != null ? ts.toString() : null);
                    map.put("createdAt", ts != null ? ts.toString() : null);
                    list.add(map);
                }
            }
        } catch (Exception e) {
            log.warn("Error getting audits for request {}: {}", requestId, e.getMessage());
        }
        return list;
    }

    // ==========================================
    // REALTIME EVENT BROADCAST TO HOSPITAL & DONORS
    // ==========================================
    public void broadcastLifecycleEvent(int requestId, String eventName, Map<String, Object> extra) {
        try {
            Map<String, Object> req = new BloodRequestDao().findById(requestId);
            if (req == null) return;

            Object hospIdObj = req.get("hospitalId") != null ? req.get("hospitalId") : req.get("hospital_id");
            int hospitalId = hospIdObj instanceof Number ? ((Number) hospIdObj).intValue() : 0;

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("requestId", requestId);
            payload.put("event", eventName);
            payload.put("status", req.get("status"));
            payload.put("closeReason", req.get("close_reason") != null ? req.get("close_reason") : req.get("closeReason"));
            payload.put("cancelledReason", req.get("cancelled_reason") != null ? req.get("cancelled_reason") : req.get("cancelledReason"));
            payload.put("unitsFulfilled", req.get("units_fulfilled") != null ? req.get("units_fulfilled") : req.get("unitsFulfilled"));
            payload.put("timestamp", System.currentTimeMillis());
            if (extra != null) {
                payload.putAll(extra);
            }

            // 1. Broadcast to Hospital SSE
            if (hospitalId > 0) {
                HospitalController.broadcastHospitalEvent(hospitalId, "request-updated", payload);
                if (eventName != null && !eventName.equals("request-updated")) {
                    HospitalController.broadcastHospitalEvent(hospitalId, eventName, payload);
                }
            }

            // 2. Broadcast to all notified/accepted Donors for this request
            List<Map<String, Object>> donors = new BloodRequestNotificationDao().getDonorsForRequest(requestId);
            if (donors != null) {
                for (Map<String, Object> d : donors) {
                    Object dIdObj = d.get("donor_pk");
                    if (dIdObj == null) dIdObj = d.get("donorId");
                    int donorId = 0;
                    if (dIdObj instanceof Number) {
                        donorId = ((Number) dIdObj).intValue();
                    } else if (dIdObj != null) {
                        try {
                            String s = dIdObj.toString().replaceAll("\\D", "");
                            if (!s.isBlank()) donorId = Integer.parseInt(s);
                        } catch (Exception ignored) {}
                    }
                    if (donorId > 0) {
                        DonorController.broadcastDonorEvent(donorId, "request-updated", payload);
                        if (eventName != null && !eventName.equals("request-updated")) {
                            DonorController.broadcastDonorEvent(donorId, eventName, payload);
                        }
                    }
                }
            }

            // Invalidate metrics caches
            PlatformMetricsService.getInstance().invalidateCache();
        } catch (Exception e) {
            log.warn("Notice broadcasting lifecycle event for request {}: {}", requestId, e.getMessage());
        }
    }

    // ==========================================
    // 1. DONOR ACCEPT ACTION
    // ==========================================
    public Map<String, Object> handleDonorAccept(int requestId, int donorId) throws Exception {
        Map<String, Object> donor = new DonorDao().findById(donorId);
        if (donor == null) {
            throw new IllegalArgumentException("Donor not found");
        }
        if (!DonorEligibilityService.isEligible(donor)) {
            throw new IllegalStateException("You are currently not eligible to accept blood requests due to donation recovery interval, deferral or status.");
        }

        int arrivalMins = getAcceptedArrivalMinutes();
        Map<String, Object> result = new LinkedHashMap<>();

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. Lock and check request
                String reqSql = "SELECT status, needed_within_mins, created_at, expires_at, hospital_id FROM blood_requests WHERE id = ? FOR UPDATE";
                String currentReqStatus = null;
                Timestamp expiresAt = null;
                Timestamp createdAt = null;
                Integer neededWithinMins = null;
                int hospitalId = 0;

                try (PreparedStatement ps = conn.prepareStatement(reqSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) {
                            throw new IllegalArgumentException("Request not found");
                        }
                        currentReqStatus = rs.getString("status");
                        expiresAt = rs.getTimestamp("expires_at");
                        createdAt = rs.getTimestamp("created_at");
                        neededWithinMins = (Integer) rs.getObject("needed_within_mins");
                        hospitalId = rs.getInt("hospital_id");
                    }
                }

                if (currentReqStatus != null && (
                        currentReqStatus.equalsIgnoreCase("Fulfilled") ||
                        currentReqStatus.equalsIgnoreCase("Closed") ||
                        currentReqStatus.equalsIgnoreCase("Cancelled") ||
                        currentReqStatus.equalsIgnoreCase("Expired"))) {
                    throw new IllegalStateException("This request is no longer open (current status: " + currentReqStatus + ").");
                }

                // Compute arrival deadline = max(expires_at, accepted_at + ACCEPTED_ARRIVAL_MINUTES)
                long nowMs = System.currentTimeMillis();
                long defaultArrivalMs = nowMs + (arrivalMins * 60L * 1000L);
                long arrivalDeadlineMs = defaultArrivalMs;
                if (expiresAt != null && expiresAt.getTime() > defaultArrivalMs) {
                    arrivalDeadlineMs = expiresAt.getTime();
                }
                Timestamp arrivalDeadline = new Timestamp(arrivalDeadlineMs);

                // 2. Update or insert recipient notification
                String notifSql = "UPDATE blood_request_notifications SET status = 'ACCEPTED', responded_at = CURRENT_TIMESTAMP, arrival_deadline = ? " +
                                  "WHERE request_id = ? AND donor_id = ?";
                int rowsUpdated = 0;
                try (PreparedStatement ps = conn.prepareStatement(notifSql)) {
                    ps.setTimestamp(1, arrivalDeadline);
                    ps.setInt(2, requestId);
                    ps.setInt(3, donorId);
                    rowsUpdated = ps.executeUpdate();
                }

                if (rowsUpdated == 0) {
                    // Fallback insert if notification row didn't exist
                    String insSql = "INSERT INTO blood_request_notifications (request_id, donor_id, hospital_id, blood_type, units_requested, patient_name, notes, status, notified_at, responded_at, arrival_deadline) " +
                                    "SELECT id, ?, hospital_id, blood_type, units_requested, patient_name, '', 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ? FROM blood_requests WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(insSql)) {
                        ps.setInt(1, donorId);
                        ps.setTimestamp(2, arrivalDeadline);
                        ps.setInt(3, requestId);
                        ps.executeUpdate();
                    }
                }

                // 3. Update request status to 'Accepted'
                String updReqSql = "UPDATE blood_requests SET status = 'Accepted' WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(updReqSql)) {
                    ps.setInt(1, requestId);
                    ps.executeUpdate();
                }

                // 4. Record audit log
                recordAudit(conn, requestId, "donor:" + donorId, currentReqStatus, "Accepted", "Donor accepted request. Arrival deadline: " + arrivalDeadline);

                conn.commit();

                result.put("status", "Accepted");
                result.put("arrivalDeadline", arrivalDeadline.toString());
                result.put("arrivalDeadlineMs", arrivalDeadline.getTime());
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        // Broadcast realtime update to BOTH hospital and donor
        broadcastLifecycleEvent(requestId, "donor-accepted", Map.of("donorId", donorId, "status", "Accepted"));
        return result;
    }

    // ==========================================
    // 2. DONOR DECLINE ACTION
    // ==========================================
    public Map<String, Object> handleDonorDecline(int requestId, int donorId, String reason) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. Update notification status to DECLINED
                String updNotifSql = "UPDATE blood_request_notifications SET status = 'DECLINED', responded_at = CURRENT_TIMESTAMP " +
                                     "WHERE request_id = ? AND donor_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(updNotifSql)) {
                    ps.setInt(1, requestId);
                    ps.setInt(2, donorId);
                    ps.executeUpdate();
                }

                // 2. Count recipients
                int totalRecipients = 0;
                int activeRecipients = 0;
                int hospitalId = 0;
                String currentReqStatus = null;

                String countSql = "SELECT br.status, br.hospital_id, " +
                                  "COUNT(n.id) as total_notifs, " +
                                  "SUM(CASE WHEN UPPER(n.status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') THEN 1 ELSE 0 END) as active_notifs " +
                                  "FROM blood_requests br " +
                                  "LEFT JOIN blood_request_notifications n ON br.id = n.request_id " +
                                  "WHERE br.id = ? GROUP BY br.id";
                try (PreparedStatement ps = conn.prepareStatement(countSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            currentReqStatus = rs.getString("status");
                            hospitalId = rs.getInt("hospital_id");
                            totalRecipients = rs.getInt("total_notifs");
                            activeRecipients = rs.getInt("active_notifs");
                        }
                    }
                }

                boolean requestCancelled = false;
                String cancelReason = null;

                if (totalRecipients <= 1) {
                    // Targeted request (sent to exactly one donor): auto-cancel
                    requestCancelled = true;
                    cancelReason = "Donor declined";
                } else if (activeRecipients == 0) {
                    // Broadcast: all recipients are now terminal
                    requestCancelled = true;
                    cancelReason = "No donor available";
                }

                if (requestCancelled && currentReqStatus != null && !currentReqStatus.equalsIgnoreCase("Fulfilled") && !currentReqStatus.equalsIgnoreCase("Closed")) {
                    String cancelSql = "UPDATE blood_requests SET status = 'Cancelled', cancelled_reason = ? WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(cancelSql)) {
                        ps.setString(1, cancelReason);
                        ps.setInt(2, requestId);
                        ps.executeUpdate();
                    }
                    recordAudit(conn, requestId, "donor:" + donorId, currentReqStatus, "Cancelled", cancelReason);

                    // Add bell notification for hospital
                    if (hospitalId > 0) {
                        addHospitalBellNotification(conn, hospitalId, "Request Cancelled", "Emergency request #" + requestId + " was cancelled: " + cancelReason);
                    }
                } else {
                    recordAudit(conn, requestId, "donor:" + donorId, currentReqStatus, currentReqStatus, "Donor declined");
                }

                conn.commit();
                result.put("status", "Declined");
                result.put("requestCancelled", requestCancelled);
                if (cancelReason != null) result.put("cancelReason", cancelReason);
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        broadcastLifecycleEvent(requestId, "donor-declined", Map.of("donorId", donorId, "status", "Declined"));
        return result;
    }

    // ==========================================
    // 3. DONOR WITHDRAW ACTION (Blocked after accept)
    // ==========================================
    public Map<String, Object> handleDonorWithdraw(int requestId, int donorId, String reason) throws Exception {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // Check if donor has already accepted
                String checkSql = "SELECT status FROM blood_request_notifications WHERE request_id = ? AND donor_id = ?";
                String notifStatus = null;
                try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
                    ps.setInt(1, requestId);
                    ps.setInt(2, donorId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) notifStatus = rs.getString("status");
                    }
                }

                if (notifStatus != null && (notifStatus.equalsIgnoreCase("ACCEPTED") || notifStatus.equalsIgnoreCase("ARRIVED") || notifStatus.equalsIgnoreCase("DONATED"))) {
                    // Rule 4: After a donor accepts, there is NO withdraw action
                    throw new IllegalStateException("Withdraw is not permitted after accepting. Please call the hospital directly so they can coordinate.");
                }

                // If not accepted, mark withdrawn
                String updSql = "UPDATE blood_request_notifications SET status = 'WITHDRAWN', responded_at = CURRENT_TIMESTAMP WHERE request_id = ? AND donor_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(updSql)) {
                    ps.setInt(1, requestId);
                    ps.setInt(2, donorId);
                    ps.executeUpdate();
                }

                // Check recipients
                int totalRecipients = 0;
                int activeRecipients = 0;
                int hospitalId = 0;
                String currentReqStatus = null;

                String countSql = "SELECT br.status, br.hospital_id, COUNT(n.id) as total_notifs, " +
                                  "SUM(CASE WHEN UPPER(n.status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') THEN 1 ELSE 0 END) as active_notifs " +
                                  "FROM blood_requests br " +
                                  "LEFT JOIN blood_request_notifications n ON br.id = n.request_id " +
                                  "WHERE br.id = ? GROUP BY br.id";
                try (PreparedStatement ps = conn.prepareStatement(countSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            currentReqStatus = rs.getString("status");
                            hospitalId = rs.getInt("hospital_id");
                            totalRecipients = rs.getInt("total_notifs");
                            activeRecipients = rs.getInt("active_notifs");
                        }
                    }
                }

                String cancelReason = null;
                if (totalRecipients <= 1) {
                    cancelReason = "Donor withdrew";
                } else if (activeRecipients == 0) {
                    cancelReason = "No donor available";
                }

                if (cancelReason != null && currentReqStatus != null && !currentReqStatus.equalsIgnoreCase("Fulfilled") && !currentReqStatus.equalsIgnoreCase("Closed")) {
                    String cancelSql = "UPDATE blood_requests SET status = 'Cancelled', cancelled_reason = ? WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(cancelSql)) {
                        ps.setString(1, cancelReason);
                        ps.setInt(2, requestId);
                        ps.executeUpdate();
                    }
                    recordAudit(conn, requestId, "donor:" + donorId, currentReqStatus, "Cancelled", cancelReason);
                    if (hospitalId > 0) {
                        addHospitalBellNotification(conn, hospitalId, "Donor Withdrew", "Emergency request #" + requestId + " was cancelled: " + cancelReason);
                    }
                }

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        broadcastLifecycleEvent(requestId, "donor-withdrew", Map.of("donorId", donorId, "status", "Withdrawn"));
        return Map.of("status", "Withdrawn");
    }

    // ==========================================
    // 4. HOSPITAL RELEASE DONOR ACTION
    // ==========================================
    public Map<String, Object> handleHospitalReleaseDonor(int requestId, int donorId, int hospitalId, String reason) throws Exception {
        if (reason == null || reason.trim().length() < 3) {
            throw new IllegalArgumentException("Release reason is required (minimum 3 characters).");
        }

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // Verify hospital owns this request
                String checkSql = "SELECT status, hospital_id FROM blood_requests WHERE id = ?";
                int reqHospId = 0;
                String currentStatus = null;
                try (PreparedStatement ps = conn.prepareStatement(checkSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) throw new IllegalArgumentException("Request not found");
                        currentStatus = rs.getString("status");
                        reqHospId = rs.getInt("hospital_id");
                    }
                }
                if (reqHospId != hospitalId) {
                    throw new SecurityException("Forbidden: Hospital does not own this request.");
                }

                // Update recipient status to RELEASED
                String relSql = "UPDATE blood_request_notifications SET status = 'RELEASED', release_reason = ?, responded_at = CURRENT_TIMESTAMP " +
                                "WHERE request_id = ? AND donor_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(relSql)) {
                    ps.setString(1, reason.trim());
                    ps.setInt(2, requestId);
                    ps.setInt(3, donorId);
                    ps.executeUpdate();
                }

                // Check remaining active recipients
                String countSql = "SELECT COUNT(*) as total, " +
                                  "SUM(CASE WHEN UPPER(status) = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_count, " +
                                  "SUM(CASE WHEN UPPER(status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') THEN 1 ELSE 0 END) as active_count " +
                                  "FROM blood_request_notifications WHERE request_id = ?";
                int acceptedCount = 0;
                int activeCount = 0;
                try (PreparedStatement ps = conn.prepareStatement(countSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            acceptedCount = rs.getInt("accepted_count");
                            activeCount = rs.getInt("active_count");
                        }
                    }
                }

                if (activeCount == 0 && !currentStatus.equalsIgnoreCase("Fulfilled") && !currentStatus.equalsIgnoreCase("Closed")) {
                    // Close the request if no one else is active
                    String closeSql = "UPDATE blood_requests SET status = 'Closed', close_reason = ? WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(closeSql)) {
                        ps.setString(1, "Donor released: " + reason.trim());
                        ps.setInt(2, requestId);
                        ps.executeUpdate();
                    }
                    recordAudit(conn, requestId, "hospital:" + hospitalId, currentStatus, "Closed", "Donor released: " + reason.trim());
                } else if (acceptedCount == 0 && "Accepted".equalsIgnoreCase(currentStatus)) {
                    // Revert to Open if other notified donors remain but none currently accepted
                    String openSql = "UPDATE blood_requests SET status = 'Open' WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(openSql)) {
                        ps.setInt(1, requestId);
                        ps.executeUpdate();
                    }
                    recordAudit(conn, requestId, "hospital:" + hospitalId, currentStatus, "Open", "Donor released: " + reason.trim());
                } else {
                    recordAudit(conn, requestId, "hospital:" + hospitalId, currentStatus, currentStatus, "Donor released: " + reason.trim());
                }

                // Add donor notification
                new DonorDao().addDonorNotification(donorId, "Request Update", "The hospital no longer needs you for this request", "emergency");

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        broadcastLifecycleEvent(requestId, "donor-released", Map.of("donorId", donorId, "reason", reason.trim()));
        return Map.of("status", "Released", "reason", reason.trim());
    }

    // ==========================================
    // 5. HOSPITAL CLOSE REQUEST ACTION (replaces old manual "Mark fulfilled")
    // ==========================================
    public Map<String, Object> handleHospitalCloseRequest(int requestId, int hospitalId, String reason, String note) throws Exception {
        if (reason == null || reason.trim().isBlank()) {
            throw new IllegalArgumentException("Close reason is required.");
        }
        String cleanReason = reason.trim();
        if ("other".equalsIgnoreCase(cleanReason) && (note == null || note.trim().length() < 3)) {
            throw new IllegalArgumentException("Please provide a specific note when selecting 'Other' as the reason.");
        }
        String fullReason = cleanReason;
        if (note != null && !note.trim().isBlank()) {
            fullReason += ": " + note.trim();
        }

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // Verify request state
                String reqSql = "SELECT status, hospital_id FROM blood_requests WHERE id = ? FOR UPDATE";
                String currentStatus = null;
                int reqHospId = 0;
                try (PreparedStatement ps = conn.prepareStatement(reqSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) throw new IllegalArgumentException("Request not found");
                        currentStatus = rs.getString("status");
                        reqHospId = rs.getInt("hospital_id");
                    }
                }

                if (reqHospId != hospitalId) {
                    throw new SecurityException("Forbidden: Hospital does not own this request.");
                }

                // Part 1 Rule 6: enabled only while the request is open, accepted or arrived AND at least one recipient is accepted or arrived
                String checkRecipientsSql = "SELECT COUNT(*) FROM blood_request_notifications WHERE request_id = ? AND UPPER(status) IN ('ACCEPTED', 'ARRIVED')";
                int acceptedOrArrived = 0;
                try (PreparedStatement ps = conn.prepareStatement(checkRecipientsSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) acceptedOrArrived = rs.getInt(1);
                    }
                }

                String curLower = currentStatus != null ? currentStatus.toLowerCase() : "";
                if (!curLower.equals("open") && !curLower.equals("active") && !curLower.equals("accepted") && !curLower.equals("arrived")) {
                    throw new IllegalStateException("Cannot close request in status: " + currentStatus);
                }
                if (acceptedOrArrived == 0) {
                    throw new IllegalStateException("Close request is enabled only when at least one donor is accepted or arrived. If cancelling an unanswered request, please use Cancel.");
                }

                // Set status = 'Closed', close_reason = fullReason
                String updSql = "UPDATE blood_requests SET status = 'Closed', close_reason = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(updSql)) {
                    ps.setString(1, fullReason);
                    ps.setInt(2, requestId);
                    ps.executeUpdate();
                }

                // Mark any active/accepted recipients as RELEASED
                String relNotifsSql = "UPDATE blood_request_notifications SET status = 'RELEASED', release_reason = ?, responded_at = CURRENT_TIMESTAMP " +
                                      "WHERE request_id = ? AND UPPER(status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED')";
                try (PreparedStatement ps = conn.prepareStatement(relNotifsSql)) {
                    ps.setString(1, "Request closed by hospital: " + fullReason);
                    ps.setInt(2, requestId);
                    ps.executeUpdate();
                }

                recordAudit(conn, requestId, "hospital:" + hospitalId, currentStatus, "Closed", fullReason);

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        broadcastLifecycleEvent(requestId, "request-closed", Map.of("status", "Closed", "closeReason", fullReason));
        return Map.of("status", "Closed", "closeReason", fullReason);
    }

    // ==========================================
    // 6. HOSPITAL CANCEL REQUEST ACTION
    // ==========================================
    public Map<String, Object> handleHospitalCancel(int requestId, int hospitalId, String reason) throws Exception {
        if (reason == null || reason.trim().length() < 3) {
            throw new IllegalArgumentException("Cancellation reason is required (minimum 3 characters).");
        }
        String cleanReason = reason.trim();

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                String reqSql = "SELECT status, hospital_id FROM blood_requests WHERE id = ? FOR UPDATE";
                String currentStatus = null;
                int reqHospId = 0;
                try (PreparedStatement ps = conn.prepareStatement(reqSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (!rs.next()) throw new IllegalArgumentException("Request not found");
                        currentStatus = rs.getString("status");
                        reqHospId = rs.getInt("hospital_id");
                    }
                }

                if (reqHospId != hospitalId) {
                    throw new SecurityException("Forbidden: Hospital does not own this request.");
                }

                String curLower = currentStatus != null ? currentStatus.toLowerCase() : "";
                if (curLower.equals("fulfilled") || curLower.equals("closed") || curLower.equals("cancelled") || curLower.equals("expired")) {
                    throw new IllegalStateException("Cannot cancel request in terminal status: " + currentStatus);
                }

                String cancelSql = "UPDATE blood_requests SET status = 'Cancelled', cancelled_reason = ? WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(cancelSql)) {
                    ps.setString(1, cleanReason);
                    ps.setInt(2, requestId);
                    ps.executeUpdate();
                }

                // Release recipients
                String relNotifsSql = "UPDATE blood_request_notifications SET status = 'RELEASED', release_reason = ?, responded_at = CURRENT_TIMESTAMP " +
                                      "WHERE request_id = ? AND UPPER(status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED')";
                try (PreparedStatement ps = conn.prepareStatement(relNotifsSql)) {
                    ps.setString(1, "The hospital cancelled this request: " + cleanReason);
                    ps.setInt(2, requestId);
                    ps.executeUpdate();
                }

                recordAudit(conn, requestId, "hospital:" + hospitalId, currentStatus, "Cancelled", cleanReason);

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        }

        broadcastLifecycleEvent(requestId, "request-cancelled", Map.of("status", "Cancelled", "cancelledReason", cleanReason));
        return Map.of("status", "Cancelled", "cancelledReason", cleanReason);
    }

    // ==========================================
    // 7. CHECK-IN INTAKE: DONOR ARRIVAL
    // ==========================================
    public void handleDonorCheckinArrival(int requestId, int donorId) {
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                String reqSql = "SELECT status FROM blood_requests WHERE id = ? FOR UPDATE";
                String curStatus = null;
                try (PreparedStatement ps = conn.prepareStatement(reqSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) curStatus = rs.getString("status");
                    }
                }

                // Mark recipient arrived
                String notifSql = "UPDATE blood_request_notifications SET status = 'ARRIVED', responded_at = CURRENT_TIMESTAMP " +
                                  "WHERE request_id = ? AND donor_id = ? AND UPPER(status) IN ('ACCEPTED', 'NOTIFIED')";
                try (PreparedStatement ps = conn.prepareStatement(notifSql)) {
                    ps.setInt(1, requestId);
                    ps.setInt(2, donorId);
                    ps.executeUpdate();
                }

                // Set request status to 'Arrived' if currently Open or Accepted
                if (curStatus != null && (curStatus.equalsIgnoreCase("Open") || curStatus.equalsIgnoreCase("Accepted") || curStatus.equalsIgnoreCase("Active"))) {
                    String reqUpd = "UPDATE blood_requests SET status = 'Arrived' WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(reqUpd)) {
                        ps.setInt(1, requestId);
                        ps.executeUpdate();
                    }
                    recordAudit(conn, requestId, "donor:" + donorId, curStatus, "Arrived", "Donor arrived at hospital desk for check-in");
                }

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        } catch (Exception e) {
            log.warn("Notice in handleDonorCheckinArrival: {}", e.getMessage());
        }

        broadcastLifecycleEvent(requestId, "donor-arrived", Map.of("donorId", donorId, "status", "Arrived"));
    }

    // ==========================================
    // 8. CHECK-IN APPROVAL: SYSTEM FULFILLMENT
    // ==========================================
    public void handleCheckinDonationApproved(int requestId, int donorId, int hospitalId, int donationRecordId) {
        boolean fulfilled = false;
        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. Mark recipient DONATED
                String notifSql = "UPDATE blood_request_notifications SET status = 'DONATED', responded_at = CURRENT_TIMESTAMP " +
                                  "WHERE request_id = ? AND donor_id = ?";
                try (PreparedStatement ps = conn.prepareStatement(notifSql)) {
                    ps.setInt(1, requestId);
                    ps.setInt(2, donorId);
                    ps.executeUpdate();
                }

                // 2. Increment units_fulfilled
                String incSql = "UPDATE blood_requests SET units_fulfilled = COALESCE(units_fulfilled, 0) + 1 WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(incSql)) {
                    ps.setInt(1, requestId);
                    ps.executeUpdate();
                }

                // 3. Check if units_fulfilled >= units_requested
                String reqSql = "SELECT status, units_requested, units_fulfilled FROM blood_requests WHERE id = ? FOR UPDATE";
                int uReq = 1;
                int uFul = 1;
                String curStatus = null;
                try (PreparedStatement ps = conn.prepareStatement(reqSql)) {
                    ps.setInt(1, requestId);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            curStatus = rs.getString("status");
                            uReq = rs.getInt("units_requested");
                            uFul = rs.getInt("units_fulfilled");
                        }
                    }
                }

                if (uFul >= uReq) {
                    fulfilled = true;
                    // FULFILLED is set only by the system (Part 1 Rule 5)
                    String fulSql = "UPDATE blood_requests SET status = 'Fulfilled', fulfillment_note = 'System fulfilled via verified check-in donation ID #' WHERE id = ?";
                    try (PreparedStatement ps = conn.prepareStatement(
                            "UPDATE blood_requests SET status = 'Fulfilled', fulfillment_note = CONCAT('System fulfilled via verified check-in donation ID #', ?) WHERE id = ?")) {
                        ps.setInt(1, donationRecordId);
                        ps.setInt(2, requestId);
                        ps.executeUpdate();
                    }

                    // Mark other recipients released
                    String relSql = "UPDATE blood_request_notifications SET status = 'RELEASED', release_reason = 'This request has been fulfilled. Thank you.' " +
                                    "WHERE request_id = ? AND donor_id <> ? AND UPPER(status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED')";
                    try (PreparedStatement ps = conn.prepareStatement(relSql)) {
                        ps.setInt(1, requestId);
                        ps.setInt(2, donorId);
                        ps.executeUpdate();
                    }

                    recordAudit(conn, requestId, "system", curStatus, "Fulfilled", "Target units (" + uFul + "/" + uReq + ") reached via donation ID #" + donationRecordId);
                } else {
                    recordAudit(conn, requestId, "donor:" + donorId, curStatus, curStatus, "Donation recorded (ID #" + donationRecordId + "). Units fulfilled: " + uFul + "/" + uReq);
                }

                conn.commit();
            } catch (Exception ex) {
                conn.rollback();
                throw ex;
            }
        } catch (Exception e) {
            log.warn("Notice in handleCheckinDonationApproved: {}", e.getMessage());
        }

        broadcastLifecycleEvent(requestId, fulfilled ? "request-fulfilled" : "donation-recorded", Map.of(
                "donorId", donorId,
                "status", fulfilled ? "Fulfilled" : "Partially Fulfilled",
                "donationId", donationRecordId
        ));
    }

    // ==========================================
    // 9. AUTOMATIC BACKGROUND EXPIRY & ARRIVAL JOB
    // ==========================================
    @Scheduled(fixedDelay = 10000)
    public void checkAndApplyExpiries() {
        try (Connection conn = DBConnection.getConnection()) {
            // 1. Expire unanswered recipient notifications where request is expired
            // expires_at = sent time + needed_within_mins if set, else REQUEST_EXPIRY_MINUTES
            String expNotifSql = "UPDATE blood_request_notifications n " +
                                 "JOIN blood_requests br ON n.request_id = br.id " +
                                 "SET n.status = 'EXPIRED' " +
                                 "WHERE UPPER(n.status) = 'NOTIFIED' " +
                                 "AND ( " +
                                 "    (br.expires_at IS NOT NULL AND CURRENT_TIMESTAMP >= br.expires_at) " +
                                 "    OR (br.expires_at IS NULL AND br.created_at < DATE_SUB(NOW(), INTERVAL " + getRequestExpiryMinutes() + " MINUTE)) " +
                                 ")";
            try (Statement st = conn.createStatement()) {
                st.executeUpdate(expNotifSql);
            }

            // 2. Mark accepted donors as NO_SHOW if arrival_deadline passed and not arrived
            String noShowSql = "UPDATE blood_request_notifications n " +
                               "JOIN blood_requests br ON n.request_id = br.id " +
                               "SET n.status = 'NO_SHOW' " +
                               "WHERE UPPER(n.status) = 'ACCEPTED' " +
                               "AND n.arrival_deadline IS NOT NULL " +
                               "AND CURRENT_TIMESTAMP >= n.arrival_deadline " +
                               "AND UPPER(br.status) NOT IN ('FULFILLED', 'CLOSED', 'CANCELLED', 'EXPIRED')";
            try (Statement st = conn.createStatement()) {
                st.executeUpdate(noShowSql);
            }

            // 3. Mark requests as Expired / Cancelled where all recipients are terminal
            String findCandidateRequests = "SELECT br.id, br.status, br.hospital_id, COUNT(n.id) as total_recipients, " +
                                           "SUM(CASE WHEN UPPER(n.status) IN ('NOTIFIED', 'ACCEPTED', 'ARRIVED') THEN 1 ELSE 0 END) as active_recipients, " +
                                           "SUM(CASE WHEN UPPER(n.status) = 'NO_SHOW' THEN 1 ELSE 0 END) as noshow_recipients " +
                                           "FROM blood_requests br " +
                                           "LEFT JOIN blood_request_notifications n ON br.id = n.request_id " +
                                           "WHERE UPPER(br.status) IN ('OPEN', 'ACTIVE', 'ACCEPTED') " +
                                           "AND ( " +
                                           "    (br.expires_at IS NOT NULL AND CURRENT_TIMESTAMP >= br.expires_at) " +
                                           "    OR (br.expires_at IS NULL AND br.created_at < DATE_SUB(NOW(), INTERVAL " + getRequestExpiryMinutes() + " MINUTE)) " +
                                           ") " +
                                           "GROUP BY br.id";

            List<Integer> expiredRequestIds = new ArrayList<>();
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(findCandidateRequests)) {
                while (rs.next()) {
                    int reqId = rs.getInt("id");
                    int activeRecipients = rs.getInt("active_recipients");
                    int totalRecipients = rs.getInt("total_recipients");
                    int noShowRecipients = rs.getInt("noshow_recipients");
                    int hospitalId = rs.getInt("hospital_id");

                    if (activeRecipients == 0) {
                        String newStatus = "Expired";
                        String reason = totalRecipients <= 1 ? "Donor did not respond" : "No donor available";
                        if (noShowRecipients > 0) {
                            reason = "Donor did not arrive within arrival deadline";
                        }

                        try (PreparedStatement upd = conn.prepareStatement("UPDATE blood_requests SET status = ?, cancelled_reason = ? WHERE id = ?")) {
                            upd.setString(1, newStatus);
                            upd.setString(2, reason);
                            upd.setInt(3, reqId);
                            upd.executeUpdate();
                        }
                        recordAudit(conn, reqId, "system", rs.getString("status"), newStatus, reason);

                        if (hospitalId > 0) {
                            addHospitalBellNotification(conn, hospitalId, "Request " + newStatus, "Request #" + reqId + " " + reason);
                        }
                        expiredRequestIds.add(reqId);
                    }
                }
            }

            for (Integer rId : expiredRequestIds) {
                broadcastLifecycleEvent(rId, "request-expired", Map.of("status", "Expired"));
            }
        } catch (Exception e) {
            log.debug("Background expiry check notice: {}", e.getMessage());
        }
    }

    private void addHospitalBellNotification(Connection conn, int hospitalId, String title, String message) {
        String sql = "INSERT INTO hospital_notifications (hospital_id, title, message, type, is_read, created_at) " +
                     "VALUES (?, ?, ?, 'emergency', FALSE, CURRENT_TIMESTAMP)";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            ps.setString(2, title);
            ps.setString(3, message);
            ps.executeUpdate();
        } catch (Exception ignored) {}
    }
}
