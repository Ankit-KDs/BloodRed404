package com.red404.service;

import com.red404.config.EnvConfig;
import com.red404.util.LogSanitizer;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * EmailTestSender
 *
 * Task Round 9 - Part 5:
 * Command: npm run email:test <recipient@example.com>
 * Sends one of each template (or a single requested template) to that address
 * with a [TEST] prefix in the subject.
 */
public class EmailTestSender {

    public static void main(String[] args) {
        String testTo = null;
        String filterTemplate = null;

        for (String arg : args) {
            if (arg == null || arg.isBlank()) continue;
            String trimmed = arg.trim();
            if (trimmed.contains("@")) {
                testTo = trimmed;
            } else if (trimmed.startsWith("--template=")) {
                filterTemplate = trimmed.substring("--template=".length()).toLowerCase();
            } else if (filterTemplate == null && !trimmed.startsWith("-")) {
                filterTemplate = trimmed.toLowerCase();
            }
        }

        if (testTo == null || testTo.isBlank()) {
            testTo = EnvConfig.get("EMAIL_TEST_TO");
        }

        if (testTo == null || testTo.isBlank() || !testTo.contains("@")) {
            System.err.println("=================================================================");
            System.err.println("RED404 Email Test Dispatcher (Round 9 Part 5)");
            System.err.println("Usage: npm run email:test <recipient@example.com> [optional-template]");
            System.err.println("Example: npm run email:test recipient@example.com");
            System.err.println("         npm run email:test recipient@example.com hospital_approved");
            System.err.println("=================================================================");
            System.exit(1);
        }

        boolean isLive = EnvConfig.isEmailLiveMode();
        System.out.println("=================================================================");
        System.out.println("RED404 Test Email Dispatcher");
        System.out.println("Recipient : " + LogSanitizer.maskEmail(testTo));
        System.out.println("Mode      : " + (isLive ? "LIVE (Brevo SMTP API)" : "LOG MODE (simulated output)"));
        if (!isLive) {
            System.out.println("Notice    : Set EMAIL_MODE=live in .env to send real emails via Brevo.");
        }
        System.out.println("=================================================================");

        Map<String, EmailTemplateService.EmailContent> templates = buildAllTestTemplates();

        EmailVerificationService service = new EmailVerificationService();
        int sentCount = 0;
        int failedCount = 0;

        for (Map.Entry<String, EmailTemplateService.EmailContent> entry : templates.entrySet()) {
            String key = entry.getKey();
            if (filterTemplate != null && !filterTemplate.equalsIgnoreCase("all") && !key.toLowerCase().contains(filterTemplate)) {
                continue;
            }

            EmailTemplateService.EmailContent orig = entry.getValue();
            String testSubject = "[TEST] " + orig.getSubject();

            System.out.print("Sending [" + key + "] ... ");
            if (!isLive) {
                System.out.println("[OK - LOG MODE SIMULATION]");
                System.out.println("   Subject: " + testSubject);
                System.out.println("   Lines  : " + orig.getTextContent().lines().count() + " text lines, " + orig.getHtmlContent().length() + " html bytes");
                sentCount++;
                continue;
            }

            boolean ok = service.sendViaBrevo(testTo, testSubject, orig.getTextContent(), orig.getHtmlContent());
            if (ok) {
                System.out.println("[SUCCESS]");
                sentCount++;
            } else {
                System.out.println("[FAILED]");
                failedCount++;
            }

            // Small delay between Brevo requests to avoid rate limit spikes
            try {
                Thread.sleep(800);
            } catch (InterruptedException ignored) {}
        }

        System.out.println("=================================================================");
        System.out.println("Completed: " + sentCount + " dispatched, " + failedCount + " failed.");
        System.out.println("=================================================================");
    }

    private static Map<String, EmailTemplateService.EmailContent> buildAllTestTemplates() {
        Map<String, EmailTemplateService.EmailContent> map = new LinkedHashMap<>();

        // 1. Verification code (Donor English)
        map.put("01_verification_donor_en", EmailTemplateService.buildVerificationCodeEmail(
                "482910", "donor", null, "test@red404.org", "en"
        ));

        // 2. Verification code (Donor Hindi)
        map.put("02_verification_donor_hi", EmailTemplateService.buildVerificationCodeEmail(
                "482910", "donor", null, "test@red404.org", "hi"
        ));

        // 3. Verification code (Hospital)
        map.put("03_verification_hospital", EmailTemplateService.buildVerificationCodeEmail(
                "839201", "hospital", "City General Hospital", "test@red404.org", "en"
        ));

        // 4. Donor welcome (English)
        map.put("04_donor_welcome_en", EmailTemplateService.buildDonorWelcomeEmail(
                "Rahul", "D-74920", "B+", "Dehradun", "en"
        ));

        // 5. Donor welcome (Hindi)
        map.put("05_donor_welcome_hi", EmailTemplateService.buildDonorWelcomeEmail(
                "Rahul", "D-74920", "B+", "Dehradun", "hi"
        ));

        // 6. Hospital application received
        map.put("06_hospital_application_received", EmailTemplateService.buildHospitalApplicationReceivedEmail(
                "City Care Hospital", "REF-2026-H8910", List.of("Registration_Certificate.pdf", "License_2026.pdf")
        ));

        // 7. Hospital approved
        map.put("07_hospital_approved", EmailTemplateService.buildHospitalApprovedEmail(
                "City Care Hospital"
        ));

        // 8. Hospital needs more information
        map.put("08_hospital_needs_info", EmailTemplateService.buildHospitalNeedsInfoEmail(
                "City Care Hospital", "Please upload a clearer scan of the Medical Superintendent authorization letter."
        ));

        // 9. Hospital rejected
        map.put("09_hospital_rejected", EmailTemplateService.buildHospitalRejectedEmail(
                "City Care Hospital", "The institutional clinical registration number could not be validated with state registry."
        ));

        // 10. Hospital suspended
        map.put("10_hospital_suspended", EmailTemplateService.buildHospitalSuspendedEmail(
                "City Care Hospital", "Temporary suspension due to routine compliance verification audit."
        ));

        // 11. Hospital reactivated
        map.put("11_hospital_reactivated", EmailTemplateService.buildHospitalReactivatedEmail(
                "City Care Hospital"
        ));

        return map;
    }
}
