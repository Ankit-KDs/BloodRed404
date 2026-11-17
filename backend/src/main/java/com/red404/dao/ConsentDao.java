package com.red404.dao;

import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

/**
 * ConsentDao
 *
 * Part 1 & Part 2: Audit and compliance recording for user consent.
 * Persists Terms of Service, Privacy Policy, age confirmation, and location consent.
 */
public class ConsentDao {

    private static final Logger log = LoggerFactory.getLogger(ConsentDao.class);

    public boolean recordConsent(String userType, String userId, String termsVersion,
                                 String privacyVersion, boolean locationConsent,
                                 boolean publicListingConsent, boolean ageConfirmed,
                                 String ipAddress, String userAgent) {
        String sql = "INSERT INTO consent_records (" +
                "user_type, user_id, terms_version, privacy_version, location_consent, " +
                "public_listing_consent, age_confirmed, ip_address, user_agent" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, userType != null ? userType.toUpperCase() : "DONOR");
            ps.setString(2, userId != null ? userId : "UNKNOWN");
            ps.setString(3, termsVersion != null ? termsVersion : "v1.0");
            ps.setString(4, privacyVersion != null ? privacyVersion : "v1.0");
            ps.setBoolean(5, locationConsent);
            ps.setBoolean(6, publicListingConsent);
            ps.setBoolean(7, ageConfirmed);
            ps.setString(8, ipAddress);
            ps.setString(9, userAgent != null && userAgent.length() > 250 ? userAgent.substring(0, 250) : userAgent);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            log.warn("Notice recording consent for {}: {}", userId, e.getMessage());
            return false;
        }
    }
}
