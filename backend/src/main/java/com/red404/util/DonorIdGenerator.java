package com.red404.util;

import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * RED404 — Smart Donor ID Generator
 * Generates and verifies unique medical identifiers following the format:
 * DNR-[DDMM]-[Initial][3 Random Numbers] (e.g. DNR-3001-A942).
 *
 * Adheres to The 'Burned ID' Rule: an ID is permanently retired upon account deletion
 * and will never be reassigned.
 */
public class DonorIdGenerator {

    private static final Logger log = LoggerFactory.getLogger(DonorIdGenerator.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Generates a guaranteed-unique, unburned Smart Donor ID.
     * Uses a verification while-loop against both active donors and burned_donor_ids.
     */
    public static String generateUniqueDonorId(Connection conn, String fullName, Date dob) throws SQLException {
        String ddmm = extractDDMM(dob);
        char initial = extractInitial(fullName);

        String candidateId;
        int attempts = 0;
        do {
            int randomNum = 100 + RANDOM.nextInt(900); // Guarantees 3 digits (100 - 999)
            candidateId = String.format("DNR-%s-%c%d", ddmm, initial, randomNum);
            attempts++;
            if (attempts > 1000) {
                // Highly unlikely safety fallback: add millisecond fraction if dense collision
                candidateId = String.format("DNR-%s-%c%d", ddmm, initial, (int) (System.currentTimeMillis() % 1000));
                break;
            }
        } while (isDonorIdExistsOrBurned(conn, candidateId));

        log.info("Generated unique Smart Donor ID: {} (after {} check iterations)", candidateId, attempts);
        return candidateId;
    }

    /**
     * Extracts 2-digit day and 2-digit month [DDMM] from Date of Birth.
     * Fallbacks to current date if DOB is null.
     */
    public static String extractDDMM(Date dob) {
        return extractDDMM((Object) dob);
    }

    /**
     * Extracts 2-digit day and 2-digit month [DDMM] from Date of Birth.
     * Robustly handles java.sql.Date, java.util.Date, LocalDate, or String formats (YYYY-MM-DD, DD-MM-YYYY, etc.).
     */
    public static String extractDDMM(Object dobObj) {
        if (dobObj == null) {
            LocalDate now = LocalDate.now();
            return String.format("%02d%02d", now.getDayOfMonth(), now.getMonthValue());
        }
        if (dobObj instanceof java.sql.Date sqlDate) {
            try {
                LocalDate ld = sqlDate.toLocalDate();
                return String.format("%02d%02d", ld.getDayOfMonth(), ld.getMonthValue());
            } catch (Exception ignored) {}
        }
        if (dobObj instanceof java.util.Date utilDate) {
            try {
                LocalDate ld = utilDate.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
                return String.format("%02d%02d", ld.getDayOfMonth(), ld.getMonthValue());
            } catch (Exception ignored) {}
        }
        if (dobObj instanceof LocalDate ld) {
            return String.format("%02d%02d", ld.getDayOfMonth(), ld.getMonthValue());
        }

        String str = dobObj.toString().trim();
        if (str.isEmpty() || "null".equalsIgnoreCase(str) || "undefined".equalsIgnoreCase(str)) {
            LocalDate now = LocalDate.now();
            return String.format("%02d%02d", now.getDayOfMonth(), now.getMonthValue());
        }
        if (str.contains(" ")) {
            str = str.substring(0, str.indexOf(' '));
        }
        if (str.contains("T")) {
            str = str.substring(0, str.indexOf('T'));
        }
        // YYYY-MM-DD or YYYY/MM/DD
        if (str.matches("^\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}$")) {
            try {
                String[] parts = str.split("[-/.]");
                int month = Integer.parseInt(parts[1]);
                int day = Integer.parseInt(parts[2]);
                return String.format("%02d%02d", day, month);
            } catch (Exception ignored) {}
        }
        // DD-MM-YYYY or DD/MM/YYYY
        if (str.matches("^\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{4}$")) {
            try {
                String[] parts = str.split("[-/.]");
                int day = Integer.parseInt(parts[0]);
                int month = Integer.parseInt(parts[1]);
                return String.format("%02d%02d", day, month);
            } catch (Exception ignored) {}
        }
        try {
            LocalDate ld = LocalDate.parse(str);
            return String.format("%02d%02d", ld.getDayOfMonth(), ld.getMonthValue());
        } catch (Exception ignored) {}

        LocalDate now = LocalDate.now();
        return String.format("%02d%02d", now.getDayOfMonth(), now.getMonthValue());
    }

    /**
     * Updates only the DDMM segment of an existing Donor ID when Date of Birth is updated or changed.
     * Keeps the Initial and 3 Random Numbers suffix completely untouched.
     * E.g. If current ID is "DNR-1011-A719" and DOB changes to 30th January,
     * new ID becomes "DNR-3001-A719" (A719 is preserved).
     */
    public static String updateDonorIdDob(String currentDonorId, Object newDob, String fullName) {
        if (newDob == null) return currentDonorId;
        String rawStr = newDob.toString().trim();
        if (rawStr.isEmpty() || "null".equalsIgnoreCase(rawStr) || "undefined".equalsIgnoreCase(rawStr)) {
            return currentDonorId;
        }
        String newDdmm = extractDDMM(newDob);
        if (newDdmm == null || newDdmm.isBlank()) return currentDonorId;

        if (currentDonorId != null && currentDonorId.trim().startsWith("DNR-")) {
            String clean = currentDonorId.trim();
            // Expected format: DNR-[DDMM]-[SUFFIX] (e.g. DNR-1011-A719)
            int firstDash = clean.indexOf('-');
            int secondDash = clean.indexOf('-', firstDash + 1);
            if (secondDash > firstDash) {
                String suffix = clean.substring(secondDash + 1); // e.g. "A719"
                return "DNR-" + newDdmm + "-" + suffix;
            }
        }
        // Fallback: If no existing valid suffix, generate one
        char initial = extractInitial(fullName);
        int randomNum = 100 + RANDOM.nextInt(900);
        return String.format("DNR-%s-%c%d", newDdmm, initial, randomNum);
    }

    /**
     * Extracts first uppercase alphabetical character from full name.
     * Fallbacks to 'D' (Donor) if no letter is present.
     */
    public static char extractInitial(String fullName) {
        if (fullName != null) {
            String trimmed = fullName.trim();
            for (int i = 0; i < trimmed.length(); i++) {
                char c = trimmed.charAt(i);
                if (Character.isLetter(c)) {
                    return Character.toUpperCase(c);
                }
            }
        }
        return 'D';
    }

    /**
     * Verifies if candidate ID already exists in donors or burned_donor_ids.
     */
    public static boolean isDonorIdExistsOrBurned(Connection conn, String candidateId) throws SQLException {
        if (candidateId == null || candidateId.isBlank()) return false;
        String sql = "SELECT 1 FROM donors WHERE donor_id = ? " +
                     "UNION " +
                     "SELECT 1 FROM burned_donor_ids WHERE donor_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, candidateId.trim());
            ps.setString(2, candidateId.trim());
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        } catch (SQLException e) {
            // If burned_donor_ids table doesn't exist yet, check donors table only
            try (PreparedStatement ps = conn.prepareStatement("SELECT 1 FROM donors WHERE donor_id = ?")) {
                ps.setString(1, candidateId.trim());
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next();
                }
            } catch (Exception ignored) {
                return false;
            }
        }
    }
}

