package com.red404.service;

import com.red404.config.EnvConfig;

import java.text.SimpleDateFormat;
import java.util.*;

/**
 * EmailTemplateService
 *
 * Task Round 9 - Part 2 & Part 3:
 * Single unified email design system and template factory for all RED404 transactional emails.
 *
 * - Email-client safe table layout (inline CSS, system font stack, no web fonts, no JS, zero external images).
 * - Outer background #f4f5f7; centered card max-width 600px, white, 1px border #e6e8eb, radius 8px, 4px #c92a2d top bar.
 * - Header: text wordmark "RED" (#111) + "404" (#c92a2d), 22px bold, and small grey role label chip.
 * - Hidden preheader text (inbox preview line).
 * - Bulletproof table-cell primary button (#c92a2d, 44px high) with full plain-text link below.
 * - Labelled info card for reference numbers and IDs.
 * - Current computed year, support email (from config), no marketing, no tracking pixels.
 * - Multipart HTML + textContent plain text alternative.
 * - Multi-language support: English & Hindi for donors (Devanagari font stack, line-height >= 1.6).
 * - HTML-escapes all dynamic user names, hospital names, and reviewer notes.
 */
public class EmailTemplateService {

    public static class EmailContent {
        private final String subject;
        private final String htmlContent;
        private final String textContent;

        public EmailContent(String subject, String htmlContent, String textContent) {
            this.subject = subject;
            this.htmlContent = htmlContent;
            this.textContent = textContent;
        }

        public String getSubject() { return subject; }
        public String getHtmlContent() { return htmlContent; }
        public String getTextContent() { return textContent; }
    }

    public static class InfoRow {
        private final String label;
        private final String value;

        public InfoRow(String label, String value) {
            this.label = label;
            this.value = value;
        }

        public String getLabel() { return label; }
        public String getValue() { return value; }
    }

    // =========================================================================
    // TEMPLATE A: VERIFICATION CODE
    // =========================================================================
    public static EmailContent buildVerificationCodeEmail(String code, String role, String hospitalName, String maskedEmail, String language) {
        boolean isHindi = isHindi(language);
        boolean isHospital = "hospital".equalsIgnoreCase(role);
        String cleanCode = code != null ? code.trim() : "000000";
        String cleanMasked = maskedEmail != null ? maskedEmail.trim() : "your email";
        String cleanHosp = escapeHtml(hospitalName);
        String dateIst = formatIstNow();

        String subject;
        String preheader;
        String roleChip;
        String title;
        String bodyText;
        String expiresNotice;
        String securityNote;
        String footerReason;

        if (isHindi) {
            // Hindi draft (marked needs human review)
            subject = cleanCode + " आपका RED404 " + (isHospital ? "अस्पताल" : "रक्तदाता") + " सत्यापन कोड है";
            preheader = "अपना ईमेल सत्यापित करने के लिए इस कोड का उपयोग करें। यह 10 मिनट में समाप्त हो जाएगा।";
            roleChip = isHospital ? ("अस्पताल पंजीकरण" + (cleanHosp.isEmpty() ? "" : ": " + cleanHosp)) : "रक्तदाता पंजीकरण";
            title = "अपना ईमेल सत्यापित करें";
            bodyText = "RED404 पर अपने " + (isHospital ? "अस्पताल" : "रक्तदाता") + " पंजीकरण को जारी रखने और " + cleanMasked + " को सत्यापित करने के लिए इस कोड का उपयोग करें।";
            expiresNotice = "यह कोड 10 मिनट में समाप्त हो जाएगा। अनुरोधित समय: " + dateIst + " (IST).";
            securityNote = "यह कोड कभी किसी के साथ साझा न करें। RED404 कर्मचारी इसे कभी नहीं मांगेंगे। यदि आपने यह अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें और कोई खाता नहीं बनाया जाएगा।";
            footerReason = "आपको यह ईमेल इसलिए प्राप्त हुआ क्योंकि इस पते के लिए पंजीकरण का अनुरोध किया गया था।";
        } else {
            // English
            subject = cleanCode + " is your RED404 " + (isHospital ? "hospital" : "donor") + " registration code";
            preheader = "Use this code to verify your email. It expires in 10 minutes.";
            roleChip = isHospital ? ("Hospital registration" + (cleanHosp.isEmpty() ? "" : ": " + cleanHosp)) : "Donor registration";
            title = "Verify your email";
            bodyText = "Use this code to verify " + cleanMasked + " and continue your " + (isHospital ? "hospital" : "donor") + " registration on RED404.";
            expiresNotice = "This code expires in 10 minutes. Requested on " + dateIst + " (IST).";
            securityNote = "Never share this code with anyone. RED404 staff will never ask for it. If you did not request it, ignore this email and no account will be created.";
            footerReason = "You received this email because a " + (isHospital ? "hospital" : "donor") + " registration was requested for this address.";
        }

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyText)).append("</p>");

        // Code box
        bodyHtml.append("<div style=\"background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:18px 24px;text-align:center;margin:24px 0;\">");
        bodyHtml.append("<div style=\"font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#111111;user-select:all;-webkit-user-select:all;\">")
                .append(cleanCode)
                .append("</div>");
        bodyHtml.append("<div style=\"font-size:13px;color:#6b7280;margin-top:10px;\">").append(expiresNotice).append("</div>");
        bodyHtml.append("</div>");

        // Security note
        bodyHtml.append("<p style=\"font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 8px 0;background:#fef2f2;border-left:3px solid #c92a2d;padding:10px 14px;border-radius:4px;\">")
                .append(escapeHtml(securityNote))
                .append("</p>");

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                null, null, footerReason, isHindi
        ));

        String text = renderTextLayout(
                subject, preheader, roleChip, title,
                bodyText + "\n\nVerification Code: " + cleanCode + "\n" + expiresNotice + "\n\nSecurity Note: " + securityNote,
                null, null, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE B: DONOR WELCOME
    // =========================================================================
    public static EmailContent buildDonorWelcomeEmail(String firstName, String donorId, String bloodType, String city, String language) {
        boolean isHindi = isHindi(language);
        String safeName = (firstName != null && !firstName.isBlank()) ? firstName.trim() : "Donor";
        String safeId = (donorId != null && !donorId.isBlank()) ? donorId.trim() : "-";
        String safeBlood = (bloodType != null && !bloodType.isBlank() && !bloodType.equalsIgnoreCase("not sure") && !bloodType.equalsIgnoreCase("unknown"))
                ? (bloodType.trim() + (isHindi ? " (स्व-घोषित)" : " (self-declared)"))
                : (isHindi ? "अभी निश्चित नहीं" : "Not sure yet");
        String safeCity = (city != null && !city.isBlank()) ? city.trim() : "-";
        String dashboardUrl = AppUrlService.appUrl("donorLogin");

        String subject;
        String preheader;
        String roleChip;
        String title;
        String bodyIntro;
        String privacyLine;
        String buttonText;
        String footerReason;
        List<InfoRow> infoRows = new ArrayList<>();
        List<String> nextSteps = new ArrayList<>();

        if (isHindi) {
            subject = "RED404 में आपका स्वागत है, " + safeName;
            preheader = "आपका रक्तदाता खाता तैयार है। जानिए आगे क्या होगा।";
            roleChip = "रक्तदाता";
            title = "बधाई हो, " + safeName + "! अब आप RED404 के रक्तदाता हैं";
            bodyIntro = "स्वैच्छिक रक्तदाता के रूप में पंजीकरण करने के लिए धन्यवाद। जब आपके नजदीकी सत्यापित अस्पताल को आपके रक्त समूह की आवश्यकता होगी, तो आपको सूचित किया जाएगा और आप मदद करना चुन सकते हैं।";
            infoRows.add(new InfoRow("रक्तदाता आईडी (Donor ID)", safeId));
            infoRows.add(new InfoRow("रक्त समूह (Blood Group)", safeBlood));
            infoRows.add(new InfoRow("शहर (City)", safeCity));

            nextSteps.add("अपना स्थान (Location) चालू रखें ताकि नजदीकी अस्पताल आप तक पहुँच सकें।");
            nextSteps.add("अपने ब्राउज़र में सूचनाओं (Notifications) की अनुमति दें ताकि कोई आपातकालीन अनुरोध न छूटे।");
            nextSteps.add("अपने पहले स्वास्थ्य परीक्षण के लिए नजदीकी भागीदार अस्पताल जाएँ; अस्पताल आपके रक्त समूह और माप की पुष्टि करेगा।");

            privacyLine = "अस्पताल केवल आपके अनुरोध स्वीकार करने के बाद ही आपका फ़ोन नंबर देख सकते हैं। आप जब चाहें अपनी उपलब्धता रोक सकते हैं।";
            buttonText = "मेरे डैशबोर्ड पर जाएँ";
            footerReason = "आपको यह ईमेल इसलिए प्राप्त हुआ क्योंकि आपने RED404 पर रक्तदाता के रूप में पंजीकरण किया है।";
        } else {
            subject = "Welcome to RED404, " + safeName;
            preheader = "Your donor account is ready. Here is what happens next.";
            roleChip = "Donor";
            title = "Congratulations, " + safeName + "! You are now a RED404 donor";
            bodyIntro = "Thank you for registering as a voluntary blood donor. When a verified hospital near you needs your blood group, you will be notified and can choose to help.";
            infoRows.add(new InfoRow("Donor ID", safeId));
            infoRows.add(new InfoRow("Blood Group", safeBlood));
            infoRows.add(new InfoRow("City", safeCity));

            nextSteps.add("Keep your location on so nearby hospitals can reach you.");
            nextSteps.add("Allow notifications in your browser so you do not miss a request.");
            nextSteps.add("Visit a participating hospital for your first health check; the hospital will confirm your blood group and measurements.");

            privacyLine = "Hospitals see your phone number only after you accept a request. You can pause your availability whenever you like.";
            buttonText = "Go to my dashboard";
            footerReason = "You received this email because you registered as a donor on RED404.";
        }

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");

        // Info Card
        bodyHtml.append(renderInfoCard(infoRows));

        // What to do next
        bodyHtml.append("<h3 style=\"font-size:16px;color:#111111;margin:20px 0 10px 0;font-weight:700;\">")
                .append(isHindi ? "आगे क्या करें:" : "What to do next:")
                .append("</h3>");
        bodyHtml.append("<ol style=\"margin:0 0 18px 0;padding-left:22px;color:#333333;font-size:15px;line-height:1.6;\">");
        for (String step : nextSteps) {
            bodyHtml.append("<li style=\"margin-bottom:8px;\">").append(escapeHtml(step)).append("</li>");
        }
        bodyHtml.append("</ol>");

        // Privacy line
        bodyHtml.append("<p style=\"font-size:13px;color:#6b7280;line-height:1.5;background:#f8fafc;border-left:3px solid #3b82f6;padding:10px 14px;border-radius:4px;margin:0 0 8px 0;\">")
                .append(escapeHtml(privacyLine))
                .append("</p>");

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                buttonText, dashboardUrl, footerReason, isHindi
        ));

        StringBuilder textBody = new StringBuilder(bodyIntro).append("\n\n");
        textBody.append("ACCOUNT DETAILS:\n");
        for (InfoRow r : infoRows) {
            textBody.append("- ").append(r.getLabel()).append(": ").append(r.getValue()).append("\n");
        }
        textBody.append("\nWHAT TO DO NEXT:\n");
        int stepIdx = 1;
        for (String step : nextSteps) {
            textBody.append(stepIdx++).append(". ").append(step).append("\n");
        }
        textBody.append("\nPrivacy: ").append(privacyLine);

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody.toString(),
                buttonText, dashboardUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE C: HOSPITAL APPLICATION RECEIVED
    // =========================================================================
    public static EmailContent buildHospitalApplicationReceivedEmail(String hospitalName, String applicationRef, List<String> docNames) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String safeRef = (applicationRef != null && !applicationRef.isBlank()) ? applicationRef.trim() : "-";
        String dateIst = formatIstNow();
        String statusUrl = AppUrlService.appUrl("hospitalLogin", Map.of("next", "hospitalStatus"));

        String subject = "We received your application for " + safeHosp;
        String preheader = "Your application is now with the RED404 review team.";
        String roleChip = "Hospital registration: " + safeHosp;
        String title = "Thank you for registering " + safeHosp;
        String bodyIntro = "Your application is now with the RED404 review team. You do not need to do anything else right now. We will email you as soon as there is a decision.";

        List<InfoRow> infoRows = new ArrayList<>();
        infoRows.add(new InfoRow("Reference number", safeRef));
        infoRows.add(new InfoRow("Submitted on (IST)", dateIst));
        infoRows.add(new InfoRow("Email verified", "Yes"));

        String docsStr = (docNames != null && !docNames.isEmpty()) ? String.join(", ", docNames) : "None uploaded";
        infoRows.add(new InfoRow("Documents received", docsStr));

        List<String> nextSteps = List.of(
                "Our team checks your institutional details and documents.",
                "You get an email with the verification decision.",
                "If we need something more, we tell you exactly what to fix."
        );

        String note = "Until your hospital is verified you can log in to check your status, but the hospital dashboard stays locked.";
        String reviewSla = EnvConfig.getHospitalReviewSlaText();
        if (reviewSla != null && !reviewSla.isBlank()) {
            note += " Expected review turnaround: " + reviewSla + ".";
        }

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");
        bodyHtml.append(renderInfoCard(infoRows));

        bodyHtml.append("<h3 style=\"font-size:16px;color:#111111;margin:20px 0 10px 0;font-weight:700;\">What happens next:</h3>");
        bodyHtml.append("<ol style=\"margin:0 0 18px 0;padding-left:22px;color:#333333;font-size:15px;line-height:1.6;\">");
        for (String step : nextSteps) {
            bodyHtml.append("<li style=\"margin-bottom:8px;\">").append(escapeHtml(step)).append("</li>");
        }
        bodyHtml.append("</ol>");

        bodyHtml.append("<p style=\"font-size:13px;color:#6b7280;line-height:1.5;background:#f8fafc;border-left:3px solid #6b7280;padding:10px 14px;border-radius:4px;margin:0 0 8px 0;\">")
                .append(escapeHtml(note))
                .append("</p>");

        String footerReason = "You received this email because an application was submitted for this hospital on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Check application status", statusUrl, footerReason, false
        ));

        StringBuilder textBody = new StringBuilder(bodyIntro).append("\n\nAPPLICATION DETAILS:\n");
        for (InfoRow r : infoRows) {
            textBody.append("- ").append(r.getLabel()).append(": ").append(r.getValue()).append("\n");
        }
        textBody.append("\nWHAT HAPPENS NEXT:\n");
        int stepIdx = 1;
        for (String step : nextSteps) {
            textBody.append(stepIdx++).append(". ").append(step).append("\n");
        }
        textBody.append("\nNote: ").append(note);

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody.toString(),
                "Check application status", statusUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE D: HOSPITAL APPROVED
    // =========================================================================
    public static EmailContent buildHospitalApprovedEmail(String hospitalName) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String loginUrl = AppUrlService.appUrl("hospitalLogin");

        String subject = "Congratulations! " + safeHosp + " is verified on RED404";
        String preheader = "Your hospital account is verified. You can now log in.";
        String roleChip = "Hospital";
        String title = "Your hospital is verified";
        String bodyIntro = "Your hospital " + safeHosp + " is verified on RED404. You can now log in and start using the platform.";

        List<String> getStarted = List.of(
                "Add your current blood stock to make it available for search.",
                "Confirm your hospital location on the map.",
                "Add your 24x7 emergency contact number."
        );

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");

        bodyHtml.append("<h3 style=\"font-size:16px;color:#111111;margin:20px 0 10px 0;font-weight:700;\">Get started:</h3>");
        bodyHtml.append("<ol style=\"margin:0 0 18px 0;padding-left:22px;color:#333333;font-size:15px;line-height:1.6;\">");
        for (String step : getStarted) {
            bodyHtml.append("<li style=\"margin-bottom:8px;\">").append(escapeHtml(step)).append("</li>");
        }
        bodyHtml.append("</ol>");

        String footerReason = "You received this email because your hospital is registered and verified on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Log in to your dashboard", loginUrl, footerReason, false
        ));

        StringBuilder textBody = new StringBuilder(bodyIntro).append("\n\nGET STARTED:\n");
        int stepIdx = 1;
        for (String step : getStarted) {
            textBody.append(stepIdx++).append(". ").append(step).append("\n");
        }

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody.toString(),
                "Log in to your dashboard", loginUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE E: NEEDS MORE INFORMATION
    // =========================================================================
    public static EmailContent buildHospitalNeedsInfoEmail(String hospitalName, String reviewerReason) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String safeReason = (reviewerReason != null && !reviewerReason.isBlank()) ? reviewerReason.trim() : "Please review documentation and credentials.";
        String statusUrl = AppUrlService.appUrl("hospitalLogin", Map.of("next", "hospitalStatus"));

        String subject = "Action needed: more information for " + safeHosp;
        String preheader = "Please review the requested updates to your application.";
        String roleChip = "Hospital";
        String title = "Action needed: more information";
        String bodyIntro = "The review team has checked your application for " + safeHosp + " and needs a bit more information before we can verify your account.";

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");
        bodyHtml.append(renderQuoteBlock(safeReason));
        bodyHtml.append("<p style=\"margin:16px 0;color:#333333;font-size:15px;\">Please open your Status page to update your details or upload new documents.</p>");

        String footerReason = "You received this email regarding your hospital application on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Open application status", statusUrl, footerReason, false
        ));

        String textBody = bodyIntro + "\n\nReviewer's Message:\n\"" + safeReason + "\"\n\nPlease open your Status page to update your details or upload new documents.";

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody,
                "Open application status", statusUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE F: REJECTED
    // =========================================================================
    public static EmailContent buildHospitalRejectedEmail(String hospitalName, String reviewerReason) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String safeReason = (reviewerReason != null && !reviewerReason.isBlank()) ? reviewerReason.trim() : "Credentials could not be verified.";
        String statusUrl = AppUrlService.appUrl("hospitalLogin", Map.of("next", "hospitalStatus"));

        String subject = "Update on your RED404 application for " + safeHosp;
        String preheader = "Your application for " + safeHosp + " could not be approved at this time.";
        String roleChip = "Hospital";
        String title = "Application update";
        String bodyIntro = "We reviewed the application for " + safeHosp + ". Unfortunately, we could not approve it based on the submitted information.";

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");
        bodyHtml.append(renderQuoteBlock(safeReason));
        bodyHtml.append("<p style=\"margin:16px 0;color:#333333;font-size:15px;\">You can correct the details and send your application again.</p>");

        String footerReason = "You received this email regarding your hospital application on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Review and resubmit", statusUrl, footerReason, false
        ));

        String textBody = bodyIntro + "\n\nReason:\n\"" + safeReason + "\"\n\nYou can correct the details and send your application again.";

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody,
                "Review and resubmit", statusUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE G: SUSPENDED
    // =========================================================================
    public static EmailContent buildHospitalSuspendedEmail(String hospitalName, String reviewerReason) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String safeReason = (reviewerReason != null && !reviewerReason.isBlank()) ? reviewerReason.trim() : "Administrative review.";
        String statusUrl = AppUrlService.appUrl("hospitalLogin", Map.of("next", "hospitalStatus"));

        String subject = "Your RED404 hospital account is on hold";
        String preheader = "Important notice regarding your hospital account.";
        String roleChip = "Hospital";
        String title = "Account on hold";
        String bodyIntro = "Your RED404 hospital account for " + safeHosp + " has been temporarily placed on hold.";

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");
        bodyHtml.append(renderQuoteBlock(safeReason));
        bodyHtml.append("<p style=\"margin:16px 0;color:#333333;font-size:15px;\">Please contact support to resolve this.</p>");

        String footerReason = "You received this email regarding your registered hospital account on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Open account status", statusUrl, footerReason, false
        ));

        String textBody = bodyIntro + "\n\nReason:\n\"" + safeReason + "\"\n\nPlease contact support to resolve this.";

        String text = renderTextLayout(
                subject, preheader, roleChip, title, textBody,
                "Open account status", statusUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // TEMPLATE H: REACTIVATED
    // =========================================================================
    public static EmailContent buildHospitalReactivatedEmail(String hospitalName) {
        String safeHosp = (hospitalName != null && !hospitalName.isBlank()) ? hospitalName.trim() : "Hospital";
        String loginUrl = AppUrlService.appUrl("hospitalLogin");

        String subject = "Your RED404 hospital account is active again";
        String preheader = "Your hospital account has been reactivated.";
        String roleChip = "Hospital";
        String title = "Your hospital account is active";
        String bodyIntro = "Your RED404 hospital account for " + safeHosp + " has been reactivated. You can now log in and resume using the platform.";

        StringBuilder bodyHtml = new StringBuilder();
        bodyHtml.append("<p style=\"margin:0 0 16px 0;\">").append(escapeHtml(bodyIntro)).append("</p>");

        String footerReason = "You received this email because your hospital account is active on RED404.";

        String html = renderLayout(new LayoutParams(
                subject, preheader, roleChip, title, bodyHtml.toString(),
                "Log in", loginUrl, footerReason, false
        ));

        String text = renderTextLayout(
                subject, preheader, roleChip, title, bodyIntro,
                "Log in", loginUrl, footerReason
        );

        return new EmailContent(subject, html, text);
    }

    // =========================================================================
    // SHARED BASE LAYOUT RENDERER (HTML)
    // =========================================================================
    private static class LayoutParams {
        final String subject;
        final String preheader;
        final String roleChip;
        final String title;
        final String bodyHtml;
        final String buttonText;
        final String buttonUrl;
        final String footerReason;
        final boolean isHindi;

        LayoutParams(String subject, String preheader, String roleChip, String title, String bodyHtml,
                     String buttonText, String buttonUrl, String footerReason, boolean isHindi) {
            this.subject = subject;
            this.preheader = preheader;
            this.roleChip = roleChip;
            this.title = title;
            this.bodyHtml = bodyHtml;
            this.buttonText = buttonText;
            this.buttonUrl = buttonUrl;
            this.footerReason = footerReason;
            this.isHindi = isHindi;
        }
    }

    private static String renderLayout(LayoutParams p) {
        int currentYear = Calendar.getInstance().get(Calendar.YEAR);
        String supportEmail = EnvConfig.getSupportEmail();
        String fontStack = p.isHindi
                ? "'Kohinoor Devanagari', 'Nirmala UI', 'Mangal', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        String lineHeight = p.isHindi ? "1.65" : "1.6";

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n");
        sb.append("<html lang=\"").append(p.isHindi ? "hi" : "en").append("\">\n");
        sb.append("<head>\n");
        sb.append("  <meta charset=\"UTF-8\">\n");
        sb.append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("  <meta name=\"color-scheme\" content=\"light dark\">\n");
        sb.append("  <meta name=\"supported-color-schemes\" content=\"light dark\">\n");
        sb.append("  <title>").append(escapeHtml(p.subject)).append("</title>\n");
        if (p.isHindi) {
            sb.append("  <!-- [i18n: hi - needs human review] -->\n");
        }
        sb.append("  <style>\n");
        sb.append("    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }\n");
        sb.append("    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }\n");
        sb.append("    img { border:0; line-height:100%; outline:none; text-decoration:none; }\n");
        sb.append("    @media only screen and (max-width: 620px) {\n");
        sb.append("      .email-card { width:100% !important; border-radius:0 !important; border-left:none !important; border-right:none !important; }\n");
        sb.append("      .email-pad { padding:24px 18px !important; }\n");
        sb.append("      .email-btn { width:100% !important; display:block !important; text-align:center !important; }\n");
        sb.append("    }\n");
        sb.append("  </style>\n");
        sb.append("</head>\n");
        sb.append("<body style=\"margin:0;padding:0;background-color:#f4f5f7;font-family:").append(fontStack).append(";\">\n");

        // Hidden preheader
        if (p.preheader != null && !p.preheader.isBlank()) {
            sb.append("  <div style=\"display:none;font-size:1px;color:#f4f5f7;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;\">\n");
            sb.append("    ").append(escapeHtml(p.preheader)).append(" &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;\n");
            sb.append("  </div>\n");
        }

        // Outer container
        sb.append("  <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" role=\"presentation\" style=\"background-color:#f4f5f7;padding:24px 12px;\">\n");
        sb.append("    <tr>\n");
        sb.append("      <td align=\"center\">\n");

        // Centered Card
        sb.append("        <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" class=\"email-card\" role=\"presentation\" style=\"max-width:600px;background-color:#ffffff;border:1px solid #e6e8eb;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);\">\n");

        // 4px Brand Red Top Bar
        sb.append("          <tr>\n");
        sb.append("            <td style=\"height:4px;background-color:#c92a2d;line-height:4px;font-size:4px;\">&nbsp;</td>\n");
        sb.append("          </tr>\n");

        // Content Area
        sb.append("          <tr>\n");
        sb.append("            <td class=\"email-pad\" style=\"padding:32px 36px;color:#333333;font-size:16px;line-height:").append(lineHeight).append(";\">\n");

        // Header: Wordmark + Role Chip
        sb.append("              <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" role=\"presentation\" style=\"margin-bottom:24px;\">\n");
        sb.append("                <tr>\n");
        sb.append("                  <td>\n");
        sb.append("                    <div style=\"font-size:22px;font-weight:700;letter-spacing:-0.4px;line-height:26px;\">\n");
        sb.append("                      <span style=\"color:#111111;\">RED</span><span style=\"color:#c92a2d;\">404</span>\n");
        sb.append("                    </div>\n");
        if (p.roleChip != null && !p.roleChip.isBlank()) {
            sb.append("                    <div style=\"display:inline-block;margin-top:6px;background-color:#f1f3f5;color:#495057;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;\">")
                    .append(escapeHtml(p.roleChip))
                    .append("</div>\n");
        }
        sb.append("                  </td>\n");
        sb.append("                </tr>\n");
        sb.append("              </table>\n");

        // Title
        sb.append("              <h1 style=\"color:#111111;font-size:22px;line-height:28px;font-weight:700;margin:0 0 16px 0;\">")
                .append(escapeHtml(p.title))
                .append("</h1>\n");

        // Body HTML
        sb.append("              <div style=\"color:#333333;font-size:16px;line-height:").append(lineHeight).append(";\">\n");
        sb.append(p.bodyHtml);
        sb.append("              </div>\n");

        // Primary Button (Bulletproof table-cell)
        if (p.buttonText != null && !p.buttonText.isBlank() && p.buttonUrl != null && !p.buttonUrl.isBlank()) {
            sb.append("              <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"margin:28px 0 12px 0;\">\n");
            sb.append("                <tr>\n");
            sb.append("                  <td align=\"center\" style=\"border-radius:6px;background-color:#c92a2d;\">\n");
            sb.append("                    <a href=\"").append(escapeHtml(p.buttonUrl)).append("\" target=\"_blank\" class=\"email-btn\" style=\"display:inline-block;padding:0 28px;height:44px;line-height:44px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;background-color:#c92a2d;box-sizing:border-box;\">")
                    .append(escapeHtml(p.buttonText))
                    .append("</a>\n");
            sb.append("                  </td>\n");
            sb.append("                </tr>\n");
            sb.append("              </table>\n");

            // Direct link fallback
            sb.append("              <p style=\"font-size:12px;color:#6b7280;line-height:1.5;margin:6px 0 24px 0;word-break:break-all;\">\n");
            sb.append("                Button not working? Copy this link:<br>\n");
            sb.append("                <a href=\"").append(escapeHtml(p.buttonUrl)).append("\" style=\"color:#c92a2d;text-decoration:underline;\">")
                    .append(escapeHtml(p.buttonUrl))
                    .append("</a>\n");
            sb.append("              </p>\n");
        }

        // Footer
        sb.append("              <table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" role=\"presentation\" style=\"margin-top:28px;border-top:1px solid #e6e8eb;padding-top:18px;\">\n");
        sb.append("                <tr>\n");
        sb.append("                  <td style=\"font-size:13px;color:#6b7280;line-height:1.5;text-align:center;\">\n");
        sb.append("                    <strong style=\"color:#4b5563;\">RED404 Emergency Blood Rescue Network</strong><br>\n");
        if (p.footerReason != null && !p.footerReason.isBlank()) {
            sb.append("                    <span>").append(escapeHtml(p.footerReason)).append("</span><br>\n");
        }
        if (supportEmail != null && !supportEmail.isBlank()) {
            sb.append("                    <span>Questions? Contact support at <a href=\"mailto:").append(escapeHtml(supportEmail)).append("\" style=\"color:#6b7280;text-decoration:underline;\">").append(escapeHtml(supportEmail)).append("</a></span><br>\n");
        }
        sb.append("                    <span>&copy; ").append(currentYear).append(" RED404. All rights reserved.</span>\n");
        sb.append("                  </td>\n");
        sb.append("                </tr>\n");
        sb.append("              </table>\n");

        sb.append("            </td>\n");
        sb.append("          </tr>\n");
        sb.append("        </table>\n");

        sb.append("      </td>\n");
        sb.append("    </tr>\n");
        sb.append("  </table>\n");
        sb.append("</body>\n");
        sb.append("</html>");
        return sb.toString();
    }

    // =========================================================================
    // SHARED BASE LAYOUT RENDERER (PLAIN TEXT)
    // =========================================================================
    private static String renderTextLayout(String subject, String preheader, String roleChip, String title,
                                           String bodyText, String buttonText, String buttonUrl, String footerReason) {
        int currentYear = Calendar.getInstance().get(Calendar.YEAR);
        String supportEmail = EnvConfig.getSupportEmail();

        StringBuilder sb = new StringBuilder();
        sb.append("================================================================\n");
        sb.append("RED404 - ").append(roleChip != null ? roleChip.toUpperCase() : "NOTIFICATION").append("\n");
        sb.append("================================================================\n\n");

        sb.append(title.toUpperCase()).append("\n");
        sb.append("----------------------------------------------------------------\n\n");

        sb.append(bodyText).append("\n\n");

        if (buttonText != null && !buttonText.isBlank() && buttonUrl != null && !buttonUrl.isBlank()) {
            sb.append(">>> ").append(buttonText).append(" <<<\n");
            sb.append(buttonUrl).append("\n\n");
        }

        sb.append("================================================================\n");
        sb.append("RED404 Emergency Blood Rescue Network\n");
        if (footerReason != null && !footerReason.isBlank()) {
            sb.append(footerReason).append("\n");
        }
        if (supportEmail != null && !supportEmail.isBlank()) {
            sb.append("Support: ").append(supportEmail).append("\n");
        }
        sb.append("(c) ").append(currentYear).append(" RED404. All rights reserved.\n");
        sb.append("================================================================\n");

        return sb.toString();
    }

    // =========================================================================
    // COMPONENT HELPERS
    // =========================================================================
    private static String renderInfoCard(List<InfoRow> rows) {
        if (rows == null || rows.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        sb.append("<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" role=\"presentation\" style=\"background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;margin:20px 0;padding:12px 16px;\">\n");
        for (int i = 0; i < rows.size(); i++) {
            InfoRow r = rows.get(i);
            sb.append("  <tr>\n");
            sb.append("    <td style=\"padding:7px 0;font-size:13px;color:#6b7280;width:45%;vertical-align:top;\">")
                    .append(escapeHtml(r.getLabel()))
                    .append("</td>\n");
            sb.append("    <td style=\"padding:7px 0;font-size:14px;color:#111111;font-weight:600;text-align:right;vertical-align:top;\">")
                    .append(escapeHtml(r.getValue()))
                    .append("</td>\n");
            sb.append("  </tr>\n");
        }
        sb.append("</table>\n");
        return sb.toString();
    }

    private static String renderQuoteBlock(String text) {
        return "<blockquote style=\"background-color:#f8fafc;border-left:4px solid #c92a2d;margin:18px 0;padding:12px 16px;border-radius:4px;color:#333333;font-size:14px;line-height:1.6;\">"
                + escapeHtml(text)
                + "</blockquote>";
    }

    private static boolean isHindi(String language) {
        if (language == null) return false;
        String clean = language.trim().toLowerCase();
        return clean.equals("hi") || clean.startsWith("hi-") || clean.contains("hindi");
    }

    private static String formatIstNow() {
        SimpleDateFormat sdf = new SimpleDateFormat("dd MMM yyyy, hh:mm a");
        sdf.setTimeZone(TimeZone.getTimeZone("Asia/Kolkata"));
        return sdf.format(new Date());
    }

    public static String escapeHtml(String text) {
        if (text == null) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '&':  sb.append("&amp;"); break;
                case '<':  sb.append("&lt;"); break;
                case '>':  sb.append("&gt;"); break;
                case '"':  sb.append("&quot;"); break;
                case '\'': sb.append("&#39;"); break;
                default:   sb.append(c); break;
            }
        }
        return sb.toString();
    }
}
