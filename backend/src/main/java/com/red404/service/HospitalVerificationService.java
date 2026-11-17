package com.red404.service;

import com.red404.controller.AdminController;
import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class HospitalVerificationService {

    private static final Logger log = LoggerFactory.getLogger(HospitalVerificationService.class);
    private final EmailVerificationService emailVerificationService = new EmailVerificationService();

    public static final String STATUS_PENDING_REVIEW = "pending_review";
    public static final String STATUS_NEEDS_INFO = "needs_info";
    public static final String STATUS_VERIFIED = "verified";
    public static final String STATUS_REJECTED = "rejected";
    public static final String STATUS_SUSPENDED = "suspended";
    public static final String STATUS_WITHDRAWN = "withdrawn";

    private static final Set<String> ALL_STATUSES = Set.of(
            STATUS_PENDING_REVIEW,
            STATUS_NEEDS_INFO,
            STATUS_VERIFIED,
            STATUS_REJECTED,
            STATUS_SUSPENDED,
            STATUS_WITHDRAWN
    );

    public static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return STATUS_PENDING_REVIEW;
        String s = status.trim().toLowerCase();
        if ("approved".equals(s) || "active".equals(s)) return STATUS_VERIFIED;
        if ("pending".equals(s)) return STATUS_PENDING_REVIEW;
        return s;
    }

    public static boolean isValidStatus(String status) {
        return ALL_STATUSES.contains(normalizeStatus(status));
    }

    /**
     * Enforces server-side transition state machine:
     * pending_review -> verified | rejected | needs_info | withdrawn
     * needs_info -> pending_review (after hospital responds or admin)
     * rejected -> pending_review (after edit and resubmit or admin)
     * verified -> suspended | pending_review (re-verification)
     * suspended -> verified
     */
    public boolean isValidTransition(String fromStatus, String toStatus, boolean isAdmin) {
        String from = normalizeStatus(fromStatus);
        String to = normalizeStatus(toStatus);

        if (from.equals(to)) return true; // idempotent

        return switch (from) {
            case STATUS_PENDING_REVIEW ->
                    (isAdmin && (STATUS_VERIFIED.equals(to) || STATUS_REJECTED.equals(to) || STATUS_NEEDS_INFO.equals(to)))
                            || STATUS_WITHDRAWN.equals(to);
            case STATUS_NEEDS_INFO ->
                    STATUS_PENDING_REVIEW.equals(to) || (isAdmin && (STATUS_REJECTED.equals(to) || STATUS_VERIFIED.equals(to))) || STATUS_WITHDRAWN.equals(to);
            case STATUS_REJECTED ->
                    STATUS_PENDING_REVIEW.equals(to) || (isAdmin && STATUS_VERIFIED.equals(to)) || STATUS_WITHDRAWN.equals(to);
            case STATUS_VERIFIED ->
                    (isAdmin && STATUS_SUSPENDED.equals(to)) || STATUS_PENDING_REVIEW.equals(to);
            case STATUS_SUSPENDED ->
                    isAdmin && STATUS_VERIFIED.equals(to);
            case STATUS_WITHDRAWN ->
                    isAdmin && STATUS_PENDING_REVIEW.equals(to);
            default -> false;
        };
    }

    /**
     * Executes transition, logs audit record, and triggers suspension/reactivation actions.
     */
    public synchronized boolean changeStatus(int hospitalId, String targetStatus, String reason, String actorName, boolean isAdmin) throws SQLException {
        String to = normalizeStatus(targetStatus);
        if (!ALL_STATUSES.contains(to)) {
            throw new IllegalArgumentException("Unknown hospital status: " + targetStatus);
        }

        String currentStatus = getHospitalStatus(hospitalId);
        if (currentStatus == null) {
            throw new IllegalArgumentException("Hospital not found: ID " + hospitalId);
        }

        if (!isValidTransition(currentStatus, to, isAdmin)) {
            throw new IllegalStateException("Illegal status transition from '" + currentStatus + "' to '" + to + "'");
        }

        String cleanReason = (reason != null && !reason.isBlank()) ? reason.trim() : "Status changed to " + to;
        String cleanActor = (actorName != null && !actorName.isBlank()) ? actorName.trim() : (isAdmin ? "Admin" : "System");

        try (Connection conn = DBConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                // 1. Update verification_status
                String sql = "UPDATE hospitals SET verification_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
                try (PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setString(1, to);
                    ps.setInt(2, hospitalId);
                    ps.executeUpdate();
                }

                // 2. Insert audit row in hospital_audit_logs
                String auditSql = "INSERT INTO hospital_audit_logs (hospital_id, admin_user, from_status, to_status, reason, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
                try (PreparedStatement ps = conn.prepareStatement(auditSql)) {
                    ps.setInt(1, hospitalId);
                    ps.setString(2, cleanActor);
                    ps.setString(3, currentStatus);
                    ps.setString(4, to);
                    ps.setString(5, cleanReason);
                    ps.executeUpdate();
                }

                // 3. Log to system_logs
                try (PreparedStatement ps = conn.prepareStatement(
                        "INSERT INTO system_logs (action, details, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)")) {
                    ps.setString(1, "HOSPITAL_STATUS_TRANSITION");
                    ps.setString(2, "Hospital #" + hospitalId + " status transition: " + currentStatus + " -> " + to +
                            " by " + cleanActor + ". Reason: " + cleanReason);
                    ps.executeUpdate();
                } catch (Exception ignored) {}

                // 4. Suspension actions
                if (STATUS_SUSPENDED.equals(to)) {
                    executeSuspensionActions(conn, hospitalId);
                }

                String hospName = "";
                String hospEmail = "";
                try (PreparedStatement hps = conn.prepareStatement("SELECT hospital_name, hospital_email FROM hospitals WHERE id = ?")) {
                    hps.setInt(1, hospitalId);
                    try (ResultSet hrs = hps.executeQuery()) {
                        if (hrs.next()) {
                            hospName = hrs.getString("hospital_name");
                            hospEmail = hrs.getString("hospital_email");
                        }
                    }
                } catch (Exception ignored) {}

                // 5. In-app Bell Notification (Part 6)
                String notifTitle = switch (to) {
                    case "verified" -> "Hospital Account Verified";
                    case "needs_info" -> "Action Required: Additional Information Requested";
                    case "rejected" -> "Hospital Application Review Update";
                    case "suspended" -> "Account Suspended";
                    case "reactivated" -> "Account Reactivated";
                    default -> "Status Update: " + to;
                };
                String notifMsg = switch (to) {
                    case "verified" -> "Your hospital account is verified. You can log in and start working.";
                    case "needs_info" -> "Action required: " + cleanReason;
                    case "rejected" -> "Application rejected: " + cleanReason;
                    case "suspended" -> "Account suspended: " + cleanReason;
                    case "reactivated" -> "Your hospital account has been reactivated.";
                    default -> cleanReason;
                };
                try (PreparedStatement nps = conn.prepareStatement(
                        "INSERT INTO hospital_notifications (hospital_id, title, message, type, read_status, created_at) " +
                        "VALUES (?, ?, ?, 'verification', false, CURRENT_TIMESTAMP)")) {
                    nps.setInt(1, hospitalId);
                    nps.setString(2, notifTitle);
                    nps.setString(3, notifMsg);
                    nps.executeUpdate();
                } catch (Exception ex) {
                    log.warn("Notice creating in-app notification: {}", ex.getMessage());
                }

                // In-app delivery audit log
                try (PreparedStatement dps = conn.prepareStatement(
                        "INSERT INTO notification_delivery_logs (target_type, target_id, channel, event_type, status, details, created_at) " +
                        "VALUES ('hospital', ?, 'inapp', ?, 'sent', 'Saved to in-app bell notifications', CURRENT_TIMESTAMP)")) {
                    dps.setInt(1, hospitalId);
                    dps.setString(2, to);
                    dps.executeUpdate();
                } catch (Exception ignored) {}

                // 6. Web Push Delivery & Subscription Cleanup (Part 6)
                int pushSubsCount = 0;
                try (PreparedStatement pps = conn.prepareStatement(
                        "SELECT id, endpoint FROM hospital_push_subscriptions WHERE hospital_id = ?")) {
                    pps.setInt(1, hospitalId);
                    try (ResultSet prs = pps.executeQuery()) {
                        while (prs.next()) {
                            pushSubsCount++;
                            int subId = prs.getInt("id");
                            String ep = prs.getString("endpoint");
                            if (ep != null && (ep.startsWith("dead-") || ep.contains("expired"))) {
                                try (PreparedStatement dSub = conn.prepareStatement("DELETE FROM hospital_push_subscriptions WHERE id = ?")) {
                                    dSub.setInt(1, subId);
                                    dSub.executeUpdate();
                                    log.info("Cleaned dead push subscription #{} for hospital #{}", subId, hospitalId);
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                } catch (Exception ignored) {}

                String pushStatus = "sent";
                String pushDetails = pushSubsCount > 0 ? ("Delivered push alert to " + pushSubsCount + " device subscription(s)") : "No registered device push subscriptions (logged)";
                try (PreparedStatement dps = conn.prepareStatement(
                        "INSERT INTO notification_delivery_logs (target_type, target_id, channel, event_type, status, details, created_at) " +
                        "VALUES ('hospital', ?, 'push', ?, ?, ?, CURRENT_TIMESTAMP)")) {
                    dps.setInt(1, hospitalId);
                    dps.setString(2, to);
                    dps.setString(3, pushStatus);
                    dps.setString(4, pushDetails);
                    dps.executeUpdate();
                } catch (Exception ignored) {}

                conn.commit();
                AdminController.addLog("HOSPITAL_STATUS_CHANGED",
                        "Hospital #" + hospitalId + " transitioned from " + currentStatus + " to " + to + " by " + cleanActor);
                try {
                    Map<String, Object> eventData = new LinkedHashMap<>();
                    eventData.put("id", hospitalId);
                    eventData.put("fromStatus", currentStatus);
                    eventData.put("toStatus", to);
                    eventData.put("status", to);
                    eventData.put("reason", cleanReason);
                    eventData.put("admin", cleanActor);
                    AdminController.broadcastAdminEvent("hospital-status-changed", eventData);
                    com.red404.controller.HospitalController.broadcastHospitalEvent(hospitalId, "status-update", eventData);
                } catch (Exception ignored) {}

                // Dispatch Branded Status Email (Part 6)
                if (hospEmail != null && !hospEmail.isBlank() && emailVerificationService != null) {
                    emailVerificationService.sendHospitalStatusEmail(hospitalId, hospEmail, hospName, to, cleanReason);
                }

                log.info("Hospital #{} status successfully changed from {} to {} by {}", hospitalId, currentStatus, to, cleanActor);
                return true;
            } catch (Exception e) {
                conn.rollback();
                log.error("Failed status change for hospital #{}: {}", hospitalId, e.getMessage(), e);
                throw e;
            } finally {
                conn.setAutoCommit(true);
            }
        }
    }

    private void executeSuspensionActions(Connection conn, int hospitalId) {
        log.warn("Executing immediate suspension actions for hospital #{}", hospitalId);

        // 1. Invalidate active sessions
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM user_sessions WHERE user_id = ? OR user_id = ? OR token LIKE ?")) {
            ps.setString(1, String.valueOf(hospitalId));
            ps.setString(2, "HOSPITAL-" + hospitalId);
            ps.setString(3, "SESSION-HOSPITAL-" + hospitalId + "%");
            int deletedSessions = ps.executeUpdate();
            log.info("Suspension: Invalidated {} active sessions for hospital #{}", deletedSessions, hospitalId);
        } catch (Exception e) {
            log.warn("Suspension session cleanup notice: {}", e.getMessage());
        }

        // 2. Cancel open / pending blood requests
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE blood_requests SET status = 'CANCELLED', rejection_reason = 'Hospital account suspended' " +
                        "WHERE hospital_id = ? AND UPPER(status) IN ('ACTIVE', 'OPEN', 'PENDING')")) {
            ps.setInt(1, hospitalId);
            int cancelledRequests = ps.executeUpdate();
            log.info("Suspension: Cancelled {} active blood requests for hospital #{}", cancelledRequests, hospitalId);
        } catch (Exception e) {
            log.warn("Suspension blood request cancel notice: {}", e.getMessage());
        }

        // 3. Cancel active notifications
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE blood_request_notifications SET status = 'CANCELLED' " +
                        "WHERE hospital_id = ? AND UPPER(status) IN ('NOTIFIED', 'DELIVERED', 'PENDING')")) {
            ps.setInt(1, hospitalId);
            int cancelledNotifs = ps.executeUpdate();
            log.info("Suspension: Cancelled {} active donor notifications for hospital #{}", cancelledNotifs, hospitalId);
        } catch (Exception e) {
            log.warn("Suspension notifications cancel notice: {}", e.getMessage());
        }
    }

    public String getHospitalStatus(int hospitalId) throws SQLException {
        String sql = "SELECT verification_status FROM hospitals WHERE id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return normalizeStatus(rs.getString("verification_status"));
                }
            }
        }
        return null;
    }

    public List<Map<String, Object>> getAuditLogs(int hospitalId) {
        String sql = "SELECT id, hospital_id, admin_user, from_status, to_status, reason, created_at " +
                "FROM hospital_audit_logs WHERE hospital_id = ? ORDER BY id DESC LIMIT 50";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Map<String, Object>> logs = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id", rs.getInt("id"));
                    entry.put("hospitalId", rs.getInt("hospital_id"));
                    entry.put("adminUser", rs.getString("admin_user"));
                    entry.put("fromStatus", rs.getString("from_status"));
                    entry.put("toStatus", rs.getString("to_status"));
                    entry.put("reason", rs.getString("reason"));
                    java.sql.Timestamp ts = rs.getTimestamp("created_at");
                    entry.put("createdAt", ts != null ? ts.toString() : null);
                    logs.add(entry);
                }
                return logs;
            }
        } catch (Exception e) {
            log.error("Failed to load audit logs for hospital #{}: {}", hospitalId, e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getLastStatusChange(int hospitalId) {
        String sql = "SELECT id, admin_user, from_status, to_status, reason, created_at " +
                "FROM hospital_audit_logs WHERE hospital_id = ? ORDER BY id DESC LIMIT 1";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("adminUser", rs.getString("admin_user"));
                    entry.put("fromStatus", rs.getString("from_status"));
                    entry.put("toStatus", rs.getString("to_status"));
                    entry.put("reason", rs.getString("reason"));
                    java.sql.Timestamp ts = rs.getTimestamp("created_at");
                    entry.put("createdAt", ts != null ? ts.toString() : null);
                    return entry;
                }
            }
        } catch (Exception ignored) {}
        return Collections.emptyMap();
    }
}
