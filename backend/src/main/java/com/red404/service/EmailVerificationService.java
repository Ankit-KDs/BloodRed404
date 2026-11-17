package com.red404.service;

import com.red404.config.EnvConfig;
import com.red404.util.DBConnection;
import com.red404.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * EmailVerificationService
 *
 * Part 1, 2 & 6: Email verification codes for Donors & Hospitals.
 * - 6-digit code from SecureRandom (CSPRNG)
 * - Stored hashed (SHA-256)
 * - Single-use, constant-time compare
 * - 10-minute expiry
 * - Max 5 attempts
 * - 30s resend cooldown
 * - Brevo REST API adapter with safe dev fallback
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final SecureRandom CSPRNG = new SecureRandom();

    @Autowired
    private RateLimitService rateLimitService;

    public Map<String, Object> sendVerificationCode(String email, String purpose, String clientIp) {
        return sendVerificationCode(email, purpose, clientIp, null, null, null);
    }

    public Map<String, Object> sendVerificationCode(String email, String purpose, String clientIp, String role, String hospitalName, String language) {
        Map<String, Object> resp = new LinkedHashMap<>();
        if (email == null || email.isBlank() || !email.contains("@")) {
            resp.put("success", false);
            resp.put("message", "A valid email address is required.");
            return resp;
        }

        String cleanEmail = email.trim().toLowerCase();
        String cleanPurpose = purpose != null ? purpose.trim().toUpperCase() : "GENERAL";
        String resolvedRole = (role != null && !role.isBlank()) ? role.trim().toLowerCase()
                : (cleanPurpose.contains("HOSPITAL") ? "hospital" : "donor");

        // 1. Rate Limiting: Max 5 codes per hour per email and per IP
        RateLimitService.RateLimitResult ipCheck = rateLimitService.checkLimit("code_req_ip:" + clientIp, 5, 3600);
        if (!ipCheck.allowed) {
            resp.put("success", false);
            resp.put("code", "rate_limit_exceeded");
            resp.put("message", "Too many verification requests from this device. Please try again later.");
            return resp;
        }
        RateLimitService.RateLimitResult emailCheck = rateLimitService.checkLimit("code_req_email:" + cleanEmail, 5, 3600);
        if (!emailCheck.allowed) {
            resp.put("success", false);
            resp.put("code", "rate_limit_exceeded");
            resp.put("message", "Too many verification requests for this email. Please try again later.");
            return resp;
        }

        // 2. Cooldown check: 30 seconds
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT created_at FROM email_verification_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1")) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanPurpose);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Timestamp lastCreated = rs.getTimestamp("created_at");
                    if (lastCreated != null) {
                        long elapsedSeconds = (System.currentTimeMillis() - lastCreated.getTime()) / 1000;
                        if (elapsedSeconds < 30) {
                            resp.put("success", false);
                            resp.put("code", "cooldown");
                            resp.put("retryAfter", 30 - elapsedSeconds);
                            resp.put("message", "Please wait " + (30 - elapsedSeconds) + " seconds before requesting a new code.");
                            return resp;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notice checking code cooldown: {}", e.getMessage());
        }

        // 3. Generate 6-digit CSPRNG code
        int codeInt = 100000 + CSPRNG.nextInt(900000);
        String codeStr = String.valueOf(codeInt);
        String codeHash = sha256(codeStr);
        Timestamp expiresAt = Timestamp.from(Instant.now().plus(10, ChronoUnit.MINUTES));

        // 4. Store in database
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO email_verification_codes (email, code_hash, purpose, attempts, expires_at) VALUES (?, ?, ?, 0, ?)")) {
            ps.setString(1, cleanEmail);
            ps.setString(2, codeHash);
            ps.setString(3, cleanPurpose);
            ps.setTimestamp(4, expiresAt);
            ps.executeUpdate();
        } catch (Exception e) {
            log.error("Failed to store verification code: {}", e.getMessage());
            resp.put("success", false);
            resp.put("message", "Internal service error storing verification code.");
            return resp;
        }

        // 5. Dispatch Email (Design System Template A)
        boolean sent = dispatchEmail(cleanEmail, codeStr, cleanPurpose, resolvedRole, hospitalName, language);
        if (!sent) {
            log.info("[EMAIL SIMULATOR] To: {} | Role: {} | 6-Digit Code: {}", LogSanitizer.maskEmail(cleanEmail), resolvedRole, codeStr);
        }

        resp.put("success", true);
        resp.put("message", "A 6-digit verification code has been sent to " + LogSanitizer.maskEmail(cleanEmail));
        resp.put("cooldownSeconds", 30);
        resp.put("expiresInMinutes", 10);
        return resp;
    }

    public Map<String, Object> verifyCode(String email, String code, String purpose) {
        Map<String, Object> resp = new LinkedHashMap<>();
        if (email == null || code == null || code.trim().length() != 6) {
            resp.put("success", false);
            resp.put("message", "Enter a valid 6-digit numeric verification code.");
            return resp;
        }

        String cleanEmail = email.trim().toLowerCase();
        String cleanCode = code.trim();
        String cleanPurpose = purpose != null ? purpose.trim().toUpperCase() : "GENERAL";
        String inputHash = sha256(cleanCode);

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT id, code_hash, attempts, expires_at, verified_at FROM email_verification_codes " +
                     "WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1")) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanPurpose);

            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    resp.put("success", false);
                    resp.put("message", "No verification code requested for this email.");
                    return resp;
                }

                int recordId = rs.getInt("id");
                String storedHash = rs.getString("code_hash");
                int attempts = rs.getInt("attempts");
                Timestamp expiresAt = rs.getTimestamp("expires_at");
                Timestamp verifiedAt = rs.getTimestamp("verified_at");

                if (verifiedAt != null) {
                    resp.put("success", false);
                    resp.put("message", "This verification code has already been used. Please request a new code.");
                    return resp;
                }

                if (expiresAt != null && expiresAt.before(new Timestamp(System.currentTimeMillis()))) {
                    resp.put("success", false);
                    resp.put("message", "Verification code has expired. Please request a new code.");
                    return resp;
                }

                if (attempts >= 5) {
                    resp.put("success", false);
                    resp.put("message", "Too many incorrect attempts. This code is invalidated. Request a new one.");
                    return resp;
                }

                // Increment attempts
                try (PreparedStatement incPs = conn.prepareStatement(
                        "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?")) {
                    incPs.setInt(1, recordId);
                    incPs.executeUpdate();
                }

                // Constant-time compare
                boolean matches = MessageDigest.isEqual(
                        storedHash.getBytes(StandardCharsets.UTF_8),
                        inputHash.getBytes(StandardCharsets.UTF_8)
                );

                if (matches) {
                    String verificationToken = java.util.UUID.randomUUID().toString();
                    try (PreparedStatement okPs = conn.prepareStatement(
                            "UPDATE email_verification_codes SET verified_at = CURRENT_TIMESTAMP, verified_token = ? WHERE id = ?")) {
                        okPs.setString(1, verificationToken);
                        okPs.setInt(2, recordId);
                        okPs.executeUpdate();
                    }

                    resp.put("success", true);
                    resp.put("verified", true);
                    resp.put("verificationToken", verificationToken);
                    resp.put("message", "Email verified successfully!");
                    return resp;
                } else {
                    int remaining = 4 - attempts;
                    resp.put("success", false);
                    resp.put("verified", false);
                    resp.put("message", "Incorrect verification code. " + remaining + " attempts remaining.");
                    return resp;
                }
            }
        } catch (Exception e) {
            log.error("Error verifying code: {}", e.getMessage(), e);
            resp.put("success", false);
            resp.put("message", "Service error verifying code: " + e.getMessage());
            return resp;
        }
    }

    public boolean validateAndConsumeToken(String email, String token, String purpose) {
        if (email == null || token == null || token.isBlank()) return false;
        String cleanEmail = email.trim().toLowerCase();
        String cleanToken = token.trim();
        String cleanPurpose = purpose != null ? purpose.trim().toUpperCase() : "GENERAL";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT id, verified_at FROM email_verification_codes " +
                     "WHERE email = ? AND verified_token = ? AND purpose = ? AND verified_at IS NOT NULL " +
                     "ORDER BY id DESC LIMIT 1")) {
            ps.setString(1, cleanEmail);
            ps.setString(2, cleanToken);
            ps.setString(3, cleanPurpose);

            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    int id = rs.getInt("id");
                    Timestamp verifiedAt = rs.getTimestamp("verified_at");
                    // Token valid for 30 minutes after verification
                    if (verifiedAt != null && (System.currentTimeMillis() - verifiedAt.getTime()) < 1800000L) {
                        // Invalidate token (single-use)
                        try (PreparedStatement delPs = conn.prepareStatement(
                                "UPDATE email_verification_codes SET verified_token = NULL WHERE id = ?")) {
                            delPs.setInt(1, id);
                            delPs.executeUpdate();
                        }
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            log.error("Notice checking verification token: {}", e.getMessage());
        }
        return false;
    }

    private static final java.util.concurrent.atomic.AtomicInteger DAILY_EMAIL_COUNT = new java.util.concurrent.atomic.AtomicInteger(0);
    private static volatile long LAST_DAILY_RESET = System.currentTimeMillis();
    private static final java.util.concurrent.ExecutorService EMAIL_EXECUTOR = java.util.concurrent.Executors.newFixedThreadPool(2);

    private synchronized boolean checkAndIncrementDailyLimit(boolean isPriority) {
        long now = System.currentTimeMillis();
        if (now - LAST_DAILY_RESET > 86400000L) {
            DAILY_EMAIL_COUNT.set(0);
            LAST_DAILY_RESET = now;
        }
        int limit = EnvConfig.getAsInt("EMAIL_DAILY_LIMIT", 250);
        int current = DAILY_EMAIL_COUNT.get();
        if (current >= limit) {
            if (isPriority && current < 300) {
                DAILY_EMAIL_COUNT.incrementAndGet();
                return true;
            }
            log.warn("Email daily limit reached ({}/{}). Queued or delayed.", current, limit);
            return false;
        }
        DAILY_EMAIL_COUNT.incrementAndGet();
        return true;
    }

    public void sendHospitalStatusEmail(String toEmail, String hospitalName, String status, String reason) {
        sendHospitalStatusEmail(0, toEmail, hospitalName, status, reason);
    }

    public void sendHospitalStatusEmail(int hospitalId, String toEmail, String hospitalName, String status, String reason) {
        if (toEmail == null || toEmail.isBlank()) return;

        EMAIL_EXECUTOR.submit(() -> {
            try {
                String normStatus = (status != null) ? status.trim().toLowerCase() : "pending_review";
                boolean isPriority = "verified".equals(normStatus);

                if (!checkAndIncrementDailyLimit(isPriority)) {
                    log.info("Status email to {} delayed due to daily threshold.", LogSanitizer.maskEmail(toEmail));
                    recordDeliveryLog(hospitalId, "email", normStatus, "delayed", "Daily email threshold reached (queued for next day)");
                    return;
                }

                EmailTemplateService.EmailContent content;
                switch (normStatus) {
                    case "verified":
                        content = EmailTemplateService.buildHospitalApprovedEmail(hospitalName);
                        break;
                    case "needs_info":
                        content = EmailTemplateService.buildHospitalNeedsInfoEmail(hospitalName, reason);
                        break;
                    case "rejected":
                        content = EmailTemplateService.buildHospitalRejectedEmail(hospitalName, reason);
                        break;
                    case "suspended":
                        content = EmailTemplateService.buildHospitalSuspendedEmail(hospitalName, reason);
                        break;
                    case "reactivated":
                        content = EmailTemplateService.buildHospitalReactivatedEmail(hospitalName);
                        break;
                    default:
                        return;
                }

                boolean isLive = EnvConfig.isEmailLiveMode();
                if (!isLive) {
                    log.info("[EMAIL LOG MODE] Status email generated for {} ({}): Subject='{}'",
                            LogSanitizer.maskEmail(toEmail), normStatus, LogSanitizer.sanitize(content.getSubject()));
                    recordDeliveryLog(hospitalId, "email", normStatus, "sent", "[SIMULATED - LOG MODE] Delivered to " + LogSanitizer.maskEmail(toEmail));
                    return;
                }

                boolean sent = sendViaBrevo(toEmail, content.getSubject(), content.getTextContent(), content.getHtmlContent());
                recordDeliveryLog(hospitalId, "email", normStatus, sent ? "sent" : "failed", sent ? "Brevo dispatched" : "Brevo failed");
            } catch (Exception e) {
                log.warn("Asynchronous status email delivery notice: {}", e.getMessage());
                recordDeliveryLog(hospitalId, "email", status, "failed", "Error: " + e.getMessage());
            }
        });
    }

    public void sendDonorWelcomeEmail(int donorId, String toEmail, String firstName, String donorIdStr, String bloodType, String city, String language) {
        if (toEmail == null || toEmail.isBlank()) return;

        EMAIL_EXECUTOR.submit(() -> {
            try {
                if (!checkAndIncrementDailyLimit(false)) {
                    log.info("Donor welcome email to {} delayed due to daily threshold.", LogSanitizer.maskEmail(toEmail));
                    return;
                }

                EmailTemplateService.EmailContent content = EmailTemplateService.buildDonorWelcomeEmail(
                        firstName, donorIdStr, bloodType, city, language
                );

                boolean isLive = EnvConfig.isEmailLiveMode();
                if (!isLive) {
                    log.info("[EMAIL LOG MODE] Donor welcome email generated for {}: Subject='{}'",
                            LogSanitizer.maskEmail(toEmail), LogSanitizer.sanitize(content.getSubject()));
                    return;
                }

                sendViaBrevo(toEmail, content.getSubject(), content.getTextContent(), content.getHtmlContent());
            } catch (Exception e) {
                log.warn("Asynchronous donor welcome email delivery notice: {}", e.getMessage());
            }
        });
    }

    public void sendHospitalApplicationReceivedEmail(int hospitalId, String toEmail, String hospitalName, String applicationRef, List<String> docNames) {
        if (toEmail == null || toEmail.isBlank()) return;

        EMAIL_EXECUTOR.submit(() -> {
            try {
                if (!checkAndIncrementDailyLimit(false)) {
                    log.info("Hospital application received email to {} delayed due to daily threshold.", LogSanitizer.maskEmail(toEmail));
                    return;
                }

                EmailTemplateService.EmailContent content = EmailTemplateService.buildHospitalApplicationReceivedEmail(
                        hospitalName, applicationRef, docNames
                );

                boolean isLive = EnvConfig.isEmailLiveMode();
                if (!isLive) {
                    log.info("[EMAIL LOG MODE] Hospital application received email generated for {}: Subject='{}'",
                            LogSanitizer.maskEmail(toEmail), LogSanitizer.sanitize(content.getSubject()));
                    recordDeliveryLog(hospitalId, "email", "application_received", "sent", "[SIMULATED - LOG MODE] Delivered to " + LogSanitizer.maskEmail(toEmail));
                    return;
                }

                boolean sent = sendViaBrevo(toEmail, content.getSubject(), content.getTextContent(), content.getHtmlContent());
                recordDeliveryLog(hospitalId, "email", "application_received", sent ? "sent" : "failed", sent ? "Brevo dispatched" : "Brevo failed");
            } catch (Exception e) {
                log.warn("Asynchronous hospital application email delivery notice: {}", e.getMessage());
            }
        });
    }

    private void recordDeliveryLog(int hospitalId, String channel, String eventType, String status, String details) {
        if (hospitalId <= 0) return;
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO notification_delivery_logs (target_type, target_id, channel, event_type, status, details, created_at) " +
                     "VALUES ('hospital', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")) {
            ps.setInt(1, hospitalId);
            ps.setString(2, channel);
            ps.setString(3, eventType);
            ps.setString(4, status);
            ps.setString(5, details);
            ps.executeUpdate();
        } catch (Exception e) {
            log.warn("Notice recording notification delivery log: {}", e.getMessage());
        }
    }

    private boolean dispatchEmail(String toEmail, String code, String purpose, String role, String hospitalName, String language) {
        if (!checkAndIncrementDailyLimit(true)) {
            log.warn("Daily email limit exceeded for verification code to {}", LogSanitizer.maskEmail(toEmail));
            return false;
        }

        EmailTemplateService.EmailContent emailContent = EmailTemplateService.buildVerificationCodeEmail(
                code, role, hospitalName, LogSanitizer.maskEmail(toEmail), language
        );

        boolean isLive = EnvConfig.isEmailLiveMode();
        if (!isLive) {
            log.info("[EMAIL LOG MODE] Verification code generated for {} (Role: {}, Purpose: {}). Delivery suppressed in log mode.",
                    LogSanitizer.maskEmail(toEmail), role, purpose);
            return true;
        }

        return sendViaBrevo(toEmail, emailContent.getSubject(), emailContent.getTextContent(), emailContent.getHtmlContent());
    }

    public boolean sendViaBrevo(String toEmail, String subject, String textContent, String htmlContent) {
        String apiKey = EnvConfig.get("BREVO_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Brevo API key not configured. Cannot dispatch email.");
            return false;
        }

        String senderEmail = EnvConfig.getEmailFromAddress();
        String senderName = EnvConfig.get("EMAIL_FROM_NAME", "RED404");
        String dispatchToEmail = toEmail;
        String redirectTo = EnvConfig.getEmailRedirectTo();
        if (redirectTo != null && !redirectTo.isBlank()) {
            dispatchToEmail = redirectTo;
            log.info("Redirecting email intended for {} to {}",
                    LogSanitizer.maskEmail(toEmail), LogSanitizer.maskEmail(dispatchToEmail));
        }

        try {
            URL url = new URL("https://api.brevo.com/v3/smtp/email");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("api-key", apiKey);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            String replyToEmail = EnvConfig.getSupportEmail();
            String replyToJson = "";
            if (replyToEmail != null && !replyToEmail.isBlank()) {
                replyToJson = String.format(",\"replyTo\":{\"email\":\"%s\",\"name\":\"RED404 Support\"}", escapeJson(replyToEmail));
            }

            String payload = String.format(
                    "{\"sender\":{\"name\":\"%s\",\"email\":\"%s\"},\"to\":[{\"email\":\"%s\"}]%s,\"subject\":\"%s\",\"textContent\":\"%s\",\"htmlContent\":\"%s\"}",
                    escapeJson(senderName), escapeJson(senderEmail), escapeJson(dispatchToEmail),
                    replyToJson,
                    escapeJson(subject), escapeJson(textContent), escapeJson(htmlContent)
            );

            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }

            int codeResp = conn.getResponseCode();
            log.info("Brevo email dispatched to {}: HTTP {}", LogSanitizer.maskEmail(dispatchToEmail), codeResp);
            return codeResp >= 200 && codeResp < 300;
        } catch (Exception e) {
            log.warn("Brevo email delivery notice: {}", e.getMessage());
            return false;
        }
    }

    private static String sha256(String base) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(base.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
