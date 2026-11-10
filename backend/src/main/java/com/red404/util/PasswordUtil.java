package com.red404.util;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/**
 * Utility for BCrypt password hashing and verification with backward-compatibility
 * for legacy plain text passwords.
 */
public class PasswordUtil {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(12);

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

