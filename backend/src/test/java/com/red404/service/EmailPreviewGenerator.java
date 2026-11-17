package com.red404.service;

import com.red404.config.EnvConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * EmailPreviewGenerator
 *
 * Task Round 9 - Part 5:
 * Generates sample HTML and plain-text files for every email template into email-previews/
 */
public class EmailPreviewGenerator {

    public static void main(String[] args) throws Exception {
        System.out.println("Generating email previews for all RED404 templates...");

        // Ensure APP_BASE_URL is set for preview generation
        if (System.getProperty("APP_BASE_URL") == null && EnvConfig.get("APP_BASE_URL") == null) {
            System.setProperty("APP_BASE_URL", "https://bloodred404-production.up.railway.app");
        }

        File outDir = new File("email-previews");
        if (!outDir.exists()) {
            outDir.mkdirs();
        }

        // 1. Verification code (Donor English)
        save("01_verification_donor_en", EmailTemplateService.buildVerificationCodeEmail(
                "482910", "donor", null, "a***r@gmail.com", "en"
        ), outDir);

        // 2. Verification code (Donor Hindi)
        save("02_verification_donor_hi", EmailTemplateService.buildVerificationCodeEmail(
                "482910", "donor", null, "a***r@gmail.com", "hi"
        ), outDir);

        // 3. Verification code (Hospital)
        save("03_verification_hospital", EmailTemplateService.buildVerificationCodeEmail(
                "739104", "hospital", "City Care Hospital", "info@citycare.org", "en"
        ), outDir);

        // 4. Donor Welcome (English)
        save("04_donor_welcome_en", EmailTemplateService.buildDonorWelcomeEmail(
                "Rahul", "D-74920", "B+", "Dehradun", "en"
        ), outDir);

        // 5. Donor Welcome (Hindi)
        save("05_donor_welcome_hi", EmailTemplateService.buildDonorWelcomeEmail(
                "राहुल", "D-74920", "B+", "देहरादून", "hi"
        ), outDir);

        // 6. Hospital Application Received
        save("06_hospital_application_received", EmailTemplateService.buildHospitalApplicationReceivedEmail(
                "City Care Hospital", "REF-2026-H8910",
                List.of("Clinical_Establishment_Certificate.pdf", "NOC_Blood_Bank.pdf", "Medical_Superintendent_ID.jpg")
        ), outDir);

        // 7. Hospital Approved
        save("07_hospital_approved", EmailTemplateService.buildHospitalApprovedEmail(
                "City Care Hospital"
        ), outDir);

        // 8. Hospital Needs More Info
        save("08_hospital_needs_info", EmailTemplateService.buildHospitalNeedsInfoEmail(
                "City Care Hospital",
                "The Medical Superintendent government ID scan is blurry and expiration date is unreadable. Please upload a clear color scan."
        ), outDir);

        // 9. Hospital Rejected
        save("09_hospital_rejected", EmailTemplateService.buildHospitalRejectedEmail(
                "City Care Hospital",
                "Hospital registration number could not be validated with state registry records."
        ), outDir);

        // 10. Hospital Suspended
        save("10_hospital_suspended", EmailTemplateService.buildHospitalSuspendedEmail(
                "City Care Hospital",
                "Institutional verification license has lapsed. Account suspended pending updated documentation."
        ), outDir);

        // 11. Hospital Reactivated
        save("11_hospital_reactivated", EmailTemplateService.buildHospitalReactivatedEmail(
                "City Care Hospital"
        ), outDir);

        System.out.println("All 11 email previews successfully generated in: " + outDir.getAbsolutePath());
    }

    private static void save(String name, EmailTemplateService.EmailContent content, File dir) throws Exception {
        File htmlFile = new File(dir, name + ".html");
        try (FileOutputStream fos = new FileOutputStream(htmlFile)) {
            fos.write(content.getHtmlContent().getBytes(StandardCharsets.UTF_8));
        }

        File txtFile = new File(dir, name + ".txt");
        try (FileOutputStream fos = new FileOutputStream(txtFile)) {
            fos.write(content.getTextContent().getBytes(StandardCharsets.UTF_8));
        }

        System.out.println(" + Saved " + name + " (.html, .txt)");
    }
}
