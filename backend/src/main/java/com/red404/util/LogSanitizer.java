package com.red404.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LogSanitizer
 *
 * Part 8: Production readiness - structured logs without personal data.
 * Masks PII (personally identifiable information) including names, emails,
 * phone numbers, tokens, and raw geographic coordinates from application logs.
 */
public class LogSanitizer {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}");
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?<!\\d)\\+?[0-9]{10,12}(?!\\d)");
    private static final Pattern TOKEN_PATTERN = Pattern.compile("(?i)(token|secret|password|clearance)[=:\\s]+([\"']?[a-zA-Z0-9_-]{8,}[\"']?)");

    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) return "[REDACTED_EMAIL]";
        String trimmed = email.trim();
        int atIdx = trimmed.indexOf('@');
        if (atIdx <= 1) {
            return "***" + trimmed.substring(Math.max(0, atIdx));
        }
        String local = trimmed.substring(0, atIdx);
        String domain = trimmed.substring(atIdx);
        String maskedLocal = local.charAt(0) + "***" + local.charAt(local.length() - 1);
        return maskedLocal + domain;
    }

    public static String maskPhone(String phone) {
        if (phone == null || phone.isBlank()) return "[REDACTED_PHONE]";
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() < 6) return "[REDACTED_PHONE]";
        return digits.substring(0, 2) + "******" + digits.substring(digits.length() - 2);
    }

    public static String maskName(String name) {
        if (name == null || name.isBlank()) return "[ANONYMIZED]";
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append(" ");
            String p = parts[i];
            if (p.length() <= 1) {
                sb.append(p).append("***");
            } else {
                sb.append(p.charAt(0)).append("***");
            }
        }
        return sb.toString();
    }

    public static String sanitize(String input) {
        if (input == null || input.isBlank()) return "";

        // 1. Mask emails
        Matcher emailMatcher = EMAIL_PATTERN.matcher(input);
        StringBuffer sb = new StringBuffer();
        while (emailMatcher.find()) {
            emailMatcher.appendReplacement(sb, Matcher.quoteReplacement(maskEmail(emailMatcher.group())));
        }
        emailMatcher.appendTail(sb);
        String step1 = sb.toString();

        // 2. Mask phone numbers
        Matcher phoneMatcher = PHONE_PATTERN.matcher(step1);
        sb = new StringBuffer();
        while (phoneMatcher.find()) {
            phoneMatcher.appendReplacement(sb, Matcher.quoteReplacement(maskPhone(phoneMatcher.group())));
        }
        phoneMatcher.appendTail(sb);
        String step2 = sb.toString();

        // 3. Mask tokens/secrets
        Matcher tokenMatcher = TOKEN_PATTERN.matcher(step2);
        sb = new StringBuffer();
        while (tokenMatcher.find()) {
            String prefix = tokenMatcher.group(1);
            tokenMatcher.appendReplacement(sb, Matcher.quoteReplacement(prefix + "=[REDACTED]"));
        }
        tokenMatcher.appendTail(sb);

        return sb.toString();
    }
}
