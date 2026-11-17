package com.red404.util;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * SecurityValidationUtil
 *
 * Part 7: Server-side validation, disposable email rejection,
 * 10-digit phone normalisation, and common password blacklist.
 */
public class SecurityValidationUtil {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?(?:91)?[6-9]\\d{9}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,24}$");

    private static final Set<String> DISPOSABLE_EMAIL_DOMAINS = Set.of(
            "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
            "trashmail.com", "dispostable.com", "yopmail.com", "sharklasers.com",
            "getairmail.com", "throwawaymail.com", "mytempmail.com", "maildrop.cc",
            "fakeinbox.com", "generator.email", "mohmal.com", "temp-mail.org"
    );

    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "password", "password123", "12345678", "123456789", "qwertyuiop",
            "admin123", "welcome123", "hospital123", "donor1234", "letmein123",
            "iloveyou", "password1", "red404pass", "secret123", "testing123"
    );

    public static String normalizePhone(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("\\D+", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        } else if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        return digits.length() == 10 ? digits : null;
    }

    public static boolean isValidPhone(String phone) {
        String normalized = normalizePhone(phone);
        return normalized != null && normalized.length() == 10;
    }

    public static boolean isValidEmail(String email) {
        if (email == null || email.isBlank()) return false;
        String clean = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.matcher(clean).matches()) return false;
        int atIdx = clean.lastIndexOf('@');
        if (atIdx <= 0 || atIdx >= clean.length() - 1) return false;
        String domain = clean.substring(atIdx + 1);
        return !DISPOSABLE_EMAIL_DOMAINS.contains(domain);
    }

    public static boolean isCommonPassword(String password) {
        if (password == null) return true;
        String lower = password.trim().toLowerCase();
        return COMMON_PASSWORDS.contains(lower);
    }
}
