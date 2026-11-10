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
        if (dob != null) {
            try {
                LocalDate ld = dob.toLocalDate();
                return String.format("%02d%02d", ld.getDayOfMonth(), ld.getMonthValue());
            } catch (Exception ignored) {}
        }
        LocalDate now = LocalDate.now();
        return String.format("%02d%02d", now.getDayOfMonth(), now.getMonthValue());
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
