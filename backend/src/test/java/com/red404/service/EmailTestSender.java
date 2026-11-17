package com.red404.service;

import com.red404.config.EnvConfig;

import java.util.List;

/**
 * EmailTestSender
 *
 * Task Round 9 - Part 5:
 * Sends ONE test email of a chosen template to the single address in EMAIL_TEST_TO,
 * only when EMAIL_MODE=live.
 */
public class EmailTestSender {

    public static void main(String[] args) {
        String testTo = EnvConfig.get("EMAIL_TEST_TO");
        if (testTo == null || testTo.isBlank()) {
            System.err.println("ERROR: EMAIL_TEST_TO environment variable is required to send a test email.");
            System.exit(1);
        }

        if (!EnvConfig.isEmailLiveMode()) {
            System.err.println("ERROR: EMAIL_MODE must be set to 'live' to dispatch a test email. Current mode: " + EnvConfig.getEmailMode());
            System.exit(1);
        }

        String template = (args.length > 0 && args[0] != null && !args[0].isBlank()) ? args[0].trim().toLowerCase() : "verification";
        System.out.println("Dispatching ONE test email [Template: " + template + "] to: " + testTo + "...");

        EmailTemplateService.EmailContent content;
        switch (template) {
            case "welcome":
            case "donor_welcome":
                content = EmailTemplateService.buildDonorWelcomeEmail("Rahul", "D-74920", "B+", "Dehradun", "en");
                break;
            case "application_received":
                content = EmailTemplateService.buildHospitalApplicationReceivedEmail("City Care Hospital", "REF-2026-H8910", List.of("Certificate.pdf"));
                break;
            case "approved":
            case "hospital_approved":
                content = EmailTemplateService.buildHospitalApprovedEmail("City Care Hospital");
                break;
            case "needs_info":
                content = EmailTemplateService.buildHospitalNeedsInfoEmail("City Care Hospital", "Please upload clear ID scan.");
                break;
            case "rejected":
                content = EmailTemplateService.buildHospitalRejectedEmail("City Care Hospital", "Registration could not be verified.");
                break;
            case "suspended":
                content = EmailTemplateService.buildHospitalSuspendedEmail("City Care Hospital", "Account temporarily suspended.");
                break;
            case "reactivated":
                content = EmailTemplateService.buildHospitalReactivatedEmail("City Care Hospital");
                break;
            case "verification_hi":
                content = EmailTemplateService.buildVerificationCodeEmail("482910", "donor", null, "test@red404.org", "hi");
                break;
            case "verification":
            default:
                content = EmailTemplateService.buildVerificationCodeEmail("482910", "donor", null, "test@red404.org", "en");
                break;
        }

        EmailVerificationService service = new EmailVerificationService();
        boolean success = service.sendViaBrevo(testTo, content.getSubject(), content.getTextContent(), content.getHtmlContent());
        if (success) {
            System.out.println("SUCCESS: Test email dispatched successfully to " + testTo);
        } else {
            System.err.println("FAILED: Brevo email dispatch returned an error.");
            System.exit(1);
        }
    }
}
