package com.red404.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Set;

/**
 * Utility for BCrypt password hashing and verification with backward-compatibility
 * for legacy plain text passwords, plus common password blacklist checks.
 */
public class PasswordUtil {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(12);

    private static final Set<String> COMMON_PASSWORDS = Set.of(
            "12345678", "password", "password1", "password123", "123456789", "1234567890",
            "admin123", "admin1234", "welcome1", "welcome123", "qwerty123", "letmein1", "secret123",
            "hospital123", "red404123", "red404admin", "iloveyou", "monkey123", "dragon123", "master123",
            "changeme", "football", "sunshine", "princess", "trustno1", "passw0rd", "abc12345"
    );

    /**
     * Checks if a password matches a known dictionary or common password pattern.
     */
    public static boolean isCommonPassword(String password) {
        if (password == null || password.isBlank()) return true;
        String clean = password.trim().toLowerCase();
        return COMMON_PASSWORDS.contains(clean);
    }

    /**
     * Hashes a raw password with BCrypt (12 rounds).
     */
    public static String hashPassword(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            return "";
        }
        return ENCODER.encode(rawPassword.trim());
    }

    /**
     * Checks if a raw password matches the stored password.
     * Supports both BCrypt hashes ($2a$, $2b$, $2y$) and legacy plain text.
     */
    public static boolean checkPassword(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null) {
            return false;
        }
        String cleanRaw = rawPassword.trim();
        String cleanStored = storedPassword.trim();

        if (isBCrypt(cleanStored)) {
            try {
                return ENCODER.matches(cleanRaw, cleanStored);
            } catch (Exception e) {
                return false;
            }
        }

        // Backward compatibility for legacy plain text passwords in MySQL
        return cleanStored.equals(cleanRaw);
    }

    /**
     * Checks whether a password string is a BCrypt hash.
     */
    public static boolean isBCrypt(String password) {
        if (password == null || password.length() < 20) {
            return false;
        }
        return password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$");
    }
}

