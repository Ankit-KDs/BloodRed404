package com.red404.config;

import java.sql.Connection;
import java.sql.Date;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSchemaMigrator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaMigrator.class);
    private final DataSource dataSource;

    public DatabaseSchemaMigrator(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection()) {
            log.info("Running RED404 database schema initialization & migration...");
            createAllTablesIfNotExists(conn);
            resetExistingDataOnce(conn);
            migrateBurnedDonorIdsTable(conn);
            migrateDonorsTable(conn);
            migrateHospitalsTable(conn);
            migrateBloodRequestsTable(conn);
            migrateBloodRequestNotificationsTable(conn);
            migrateDonationsTable(conn);
            migrateHospitalInventoryTable(conn);
            migrateIntakeSnapshotsTable(conn);
            migrateUserSessionsTable(conn);
            migrateHealthChecksTable(conn);
            ensureBhimtalHospital(conn);
            new com.red404.dao.HealthCheckDao().ensureChinmayJoshiHealthRecord(conn);
            ensureDatabaseIndexes(conn);
            log.info("RED404 database schema initialization & migration completed successfully.");
        } catch (Exception e) {
            log.warn("Database schema migration notice: {}", e.getMessage());
        }
    }

    private void createAllTablesIfNotExists(Connection conn) {
        String[] tableQueries = {
            "CREATE TABLE IF NOT EXISTS system_meta (" +
            "    meta_key VARCHAR(50) PRIMARY KEY," +
            "    meta_value VARCHAR(255)" +
            ")",

            "CREATE TABLE IF NOT EXISTS donors (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    donor_id VARCHAR(30) NULL DEFAULT NULL UNIQUE," +
            "    name VARCHAR(150) NOT NULL," +
            "    father_name VARCHAR(150) NULL DEFAULT NULL," +
            "    email VARCHAR(150) NOT NULL UNIQUE," +
            "    phone VARCHAR(20) NOT NULL UNIQUE," +
            "    dob DATE NULL DEFAULT NULL," +
            "    gender VARCHAR(20) NULL DEFAULT NULL," +
            "    password VARCHAR(255) NOT NULL," +
            "    blood_type VARCHAR(5) NOT NULL," +
            "    weight DOUBLE NULL DEFAULT NULL," +
            "    last_donation DATE NULL DEFAULT NULL," +
            "    availability VARCHAR(40) DEFAULT 'Available'," +
            "    address VARCHAR(255) NULL DEFAULT NULL," +
            "    city VARCHAR(80) NULL DEFAULT NULL," +
            "    state VARCHAR(80) NULL DEFAULT NULL," +
            "    pincode VARCHAR(10) NULL DEFAULT NULL," +
            "    latitude DOUBLE NULL DEFAULT NULL," +
            "    longitude DOUBLE NULL DEFAULT NULL," +
            "    location_updated_at TIMESTAMP NULL DEFAULT NULL," +
            "    zone VARCHAR(80) NULL DEFAULT NULL," +
            "    allergies VARCHAR(255) NULL DEFAULT NULL," +
            "    conditions VARCHAR(255) NULL DEFAULT NULL," +
            "    medications VARCHAR(255) NULL DEFAULT NULL," +
            "    surgeries VARCHAR(255) NULL DEFAULT NULL," +
            "    donor_type VARCHAR(80) NULL DEFAULT NULL," +
            "    pulse INT NULL DEFAULT NULL," +
            "    hemoglobin DOUBLE NULL DEFAULT NULL," +
            "    blood_pressure VARCHAR(30) NULL DEFAULT NULL," +
            "    body_temp DOUBLE NULL DEFAULT NULL," +
            "    verified_facility VARCHAR(180) NULL DEFAULT NULL," +
            "    verified_date DATE NULL DEFAULT NULL," +
            "    qr_token VARCHAR(100) NULL DEFAULT NULL," +
            "    sms_notif BOOLEAN DEFAULT TRUE," +
            "    push_notif BOOLEAN DEFAULT TRUE," +
            "    email_notif BOOLEAN DEFAULT FALSE," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS hospitals (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    hospital_name VARCHAR(180) NOT NULL," +
            "    registration_no VARCHAR(80) NOT NULL," +
            "    hospital_type VARCHAR(40)," +
            "    beds INT DEFAULT 0," +
            "    blood_bank_license VARCHAR(80)," +
            "    hospital_email VARCHAR(150) NOT NULL UNIQUE," +
            "    hospital_phone VARCHAR(20)," +
            "    website VARCHAR(150)," +
            "    services TEXT," +
            "    admin_name VARCHAR(150)," +
            "    admin_designation VARCHAR(80)," +
            "    admin_phone VARCHAR(20)," +
            "    admin_email VARCHAR(150)," +
            "    password VARCHAR(255) NOT NULL," +
            "    emergency_contact VARCHAR(20)," +
            "    address VARCHAR(255)," +
            "    landmark VARCHAR(150)," +
            "    city VARCHAR(80)," +
            "    state VARCHAR(80)," +
            "    pincode VARCHAR(10)," +
            "    latitude DOUBLE NULL," +
            "    longitude DOUBLE NULL," +
            "    zone VARCHAR(80)," +
            "    operating_hours VARCHAR(40) DEFAULT '24x7'," +
            "    zone_radius INT DEFAULT 10," +
            "    sms_notif BOOLEAN DEFAULT TRUE," +
            "    push_notif BOOLEAN DEFAULT TRUE," +
            "    email_notif BOOLEAN DEFAULT FALSE," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS blood_requests (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    hospital_id INT NOT NULL," +
            "    patient_name VARCHAR(150)," +
            "    blood_type VARCHAR(5) NOT NULL," +
            "    units_requested INT DEFAULT 1," +
            "    urgency_level VARCHAR(20) DEFAULT 'HIGH'," +
            "    required_before DATE NULL," +
            "    status VARCHAR(20) DEFAULT 'Active'," +
            "    latitude DOUBLE NULL," +
            "    longitude DOUBLE NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS donations (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    donor_id VARCHAR(30) NOT NULL," +
            "    hospital_id INT NULL," +
            "    blood_type VARCHAR(5)," +
            "    units INT DEFAULT 1," +
            "    donation_date DATE," +
            "    status VARCHAR(20) DEFAULT 'COMPLETED'" +
            ")",

            "CREATE TABLE IF NOT EXISTS intake_snapshots (" +
            "    token VARCHAR(120) PRIMARY KEY," +
            "    donor_id VARCHAR(30) NULL," +
            "    snapshot_json MEDIUMTEXT NOT NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS blood_request_audits (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    request_id INT NOT NULL," +
            "    actor VARCHAR(100) NOT NULL," +
            "    from_status VARCHAR(50)," +
            "    to_status VARCHAR(50)," +
            "    reason VARCHAR(255)," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS user_sessions (" +
            "    session_id VARCHAR(120) PRIMARY KEY," +
            "    user_id VARCHAR(30) NOT NULL," +
            "    user_type VARCHAR(20) NOT NULL DEFAULT 'DONOR'," +
            "    ip_address VARCHAR(60) NULL," +
            "    user_agent VARCHAR(350) NULL," +
            "    device VARCHAR(100) NULL," +
            "    browser VARCHAR(100) NULL," +
            "    location VARCHAR(150) NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
            "    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
            "    is_active BOOLEAN DEFAULT TRUE" +
            ")",

            "CREATE TABLE IF NOT EXISTS burned_donor_ids (" +
            "    donor_id VARCHAR(30) PRIMARY KEY," +
            "    burned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
            "    reason VARCHAR(255) DEFAULT 'ACCOUNT_DELETED'" +
            ")",

            "CREATE TABLE IF NOT EXISTS hospital_inventory (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    hospital_id INT NOT NULL," +
            "    blood_type VARCHAR(10) NOT NULL," +
            "    units INT DEFAULT 0," +
            "    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS user_feedback (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    user_id VARCHAR(50) NULL DEFAULT NULL," +
            "    user_name VARCHAR(150) NULL DEFAULT NULL," +
            "    user_email VARCHAR(150) NULL DEFAULT NULL," +
            "    category VARCHAR(80) NULL DEFAULT 'General'," +
            "    rating INT DEFAULT 5," +
            "    message TEXT NOT NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS issue_reports (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    ticket_id VARCHAR(50) NOT NULL UNIQUE," +
            "    reporter_name VARCHAR(150) NULL DEFAULT NULL," +
            "    reporter_contact VARCHAR(150) NULL DEFAULT NULL," +
            "    category VARCHAR(80) NOT NULL DEFAULT 'System'," +
            "    description TEXT NOT NULL," +
            "    status VARCHAR(30) NOT NULL DEFAULT 'OPEN'," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS donor_blood_group_audits (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    donor_id INT NOT NULL," +
            "    old_group VARCHAR(10)," +
            "    new_group VARCHAR(10) NOT NULL," +
            "    changed_by_role VARCHAR(50) NOT NULL," +
            "    changed_by_id INT NULL DEFAULT NULL," +
            "    reason VARCHAR(255) NULL DEFAULT NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS donor_checkin_scans (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    hospital_id INT NOT NULL," +
            "    staff_user VARCHAR(150)," +
            "    query_id VARCHAR(100)," +
            "    donor_id INT NULL DEFAULT NULL," +
            "    success BOOLEAN DEFAULT TRUE," +
            "    message VARCHAR(255)," +
            "    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS donor_notifications (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    donor_id INT NOT NULL," +
            "    title VARCHAR(255) NOT NULL," +
            "    message TEXT NOT NULL," +
            "    type VARCHAR(50) DEFAULT 'general'," +
            "    read_status BOOLEAN DEFAULT FALSE," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS health_checks (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    donor_id VARCHAR(30) NOT NULL," +
            "    hospital_id INT NOT NULL," +
            "    staff_id VARCHAR(100) NULL," +
            "    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
            "    outcome VARCHAR(20) NOT NULL," +
            "    weight DOUBLE NULL," +
            "    hemoglobin DOUBLE NULL," +
            "    bp_sys DOUBLE NULL," +
            "    bp_dia DOUBLE NULL," +
            "    pulse INT NULL," +
            "    temperature DOUBLE NULL," +
            "    defer_reason_category VARCHAR(100) NULL," +
            "    defer_until DATE NULL," +
            "    linked_donation_id INT NULL" +
            ")",

            "CREATE TABLE IF NOT EXISTS email_verification_codes (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    email VARCHAR(150) NOT NULL," +
            "    code_hash VARCHAR(255) NOT NULL," +
            "    purpose VARCHAR(50) NOT NULL," +
            "    attempts INT DEFAULT 0," +
            "    verified_token VARCHAR(100) NULL," +
            "    expires_at TIMESTAMP NOT NULL," +
            "    verified_at TIMESTAMP NULL," +
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")",

            "CREATE TABLE IF NOT EXISTS consent_records (" +
            "    id INT AUTO_INCREMENT PRIMARY KEY," +
            "    user_type VARCHAR(20) NOT NULL," +
            "    user_id VARCHAR(50) NOT NULL," +
            "    terms_version VARCHAR(20) NOT NULL," +
            "    privacy_version VARCHAR(20) NOT NULL," +
            "    location_consent BOOLEAN DEFAULT TRUE," +
            "    public_listing_consent BOOLEAN DEFAULT FALSE," +
            "    age_confirmed BOOLEAN DEFAULT TRUE," +
            "    ip_address VARCHAR(50) NULL," +
            "    user_agent VARCHAR(255) NULL," +
            "    consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
            ")"
        };

        try (Statement st = conn.createStatement()) {
            for (String sql : tableQueries) {
                try {
                    st.execute(sql);
                } catch (Exception ex) {
                    log.warn("Notice executing table creation: {}", ex.getMessage());
                }
            }
            log.info("Verified all core RED404 database tables exist.");
        } catch (Exception e) {
            log.warn("Notice creating tables: {}", e.getMessage());
        }
    }

    private void resetExistingDataOnce(Connection conn) {
        try (Statement st = conn.createStatement()) {
            boolean alreadyWiped = false;
            try (ResultSet rs = st.executeQuery("SELECT meta_value FROM system_meta WHERE meta_key = 'data_wipe_clean_v1'")) {
                if (rs.next()) alreadyWiped = true;
            } catch (Exception ignored) {}

            if (!alreadyWiped) {
                log.info("Executing requested one-time database reset: clearing all dummy donors, hospitals, and requests...");
                try { st.executeUpdate("DELETE FROM intake_snapshots"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM donations"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM blood_requests"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM user_sessions"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM hospital_inventory"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM donors"); } catch (Exception ignored) {}
                try { st.executeUpdate("DELETE FROM hospitals"); } catch (Exception ignored) {}
                try {
                    st.executeUpdate("INSERT INTO system_meta (meta_key, meta_value) VALUES ('data_wipe_clean_v1', 'done')");
                } catch (Exception ignored) {}
                log.info("Database reset complete: all tables are clean and ready for real registrations.");
            }
        } catch (Exception e) {
            log.warn("Notice during resetExistingDataOnce: {}", e.getMessage());
        }
    }

    private void migrateDonorsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("donor_id", "VARCHAR(30) NULL DEFAULT NULL");
        requiredColumns.put("father_name", "VARCHAR(150) NULL DEFAULT NULL");
        requiredColumns.put("dob", "DATE NULL DEFAULT NULL");
        requiredColumns.put("gender", "VARCHAR(20) NULL DEFAULT NULL");
        requiredColumns.put("weight", "DOUBLE NULL DEFAULT NULL");
        requiredColumns.put("last_donation", "DATE NULL DEFAULT NULL");
        requiredColumns.put("availability", "VARCHAR(40) DEFAULT 'Available'");
        requiredColumns.put("paused_until", "DATE NULL DEFAULT NULL");
        requiredColumns.put("address", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("city", "VARCHAR(80) NULL DEFAULT NULL");
        requiredColumns.put("state", "VARCHAR(80) NULL DEFAULT NULL");
        requiredColumns.put("pincode", "VARCHAR(10) NULL DEFAULT NULL");
        requiredColumns.put("latitude", "DOUBLE NULL DEFAULT NULL");
        requiredColumns.put("longitude", "DOUBLE NULL DEFAULT NULL");
        requiredColumns.put("location_updated_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("zone", "VARCHAR(80) NULL DEFAULT NULL");
        requiredColumns.put("sms_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("push_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("email_notif", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("pulse", "INT NULL DEFAULT NULL");
        requiredColumns.put("hemoglobin", "DOUBLE NULL DEFAULT NULL");
        requiredColumns.put("blood_pressure", "VARCHAR(30) NULL DEFAULT NULL");
        requiredColumns.put("body_temp", "DOUBLE NULL DEFAULT NULL");
        requiredColumns.put("verified_facility", "VARCHAR(180) NULL DEFAULT NULL");
        requiredColumns.put("verified_date", "DATE NULL DEFAULT NULL");
        requiredColumns.put("allergies", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("conditions", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("medications", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("surgeries", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("donor_type", "VARCHAR(80) NULL DEFAULT NULL");
        requiredColumns.put("blood_group_status", "VARCHAR(40) DEFAULT 'self_declared'");
        requiredColumns.put("blood_group_verified_by_hospital_id", "INT NULL DEFAULT NULL");
        requiredColumns.put("health_status", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("blood_group_verified_by_hospital_name", "VARCHAR(180) NULL DEFAULT NULL");
        requiredColumns.put("blood_group_verified_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("blood_group_edit_count", "INT DEFAULT 0");
        requiredColumns.put("qr_token", "VARCHAR(100) NULL DEFAULT NULL");
        requiredColumns.put("qr_token_created_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("preferred_language", "VARCHAR(10) DEFAULT 'en'");
        requiredColumns.put("sms_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("email_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("push_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        requiredColumns.put("hospital_review_needed", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("health_answers_json", "TEXT NULL");
        requiredColumns.put("availability_pref", "VARCHAR(50) DEFAULT 'Any time'");
        requiredColumns.put("last_donation_self_reported", "DATE NULL DEFAULT NULL");
        requiredColumns.put("email_verified", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("email_verified_at", "TIMESTAMP NULL DEFAULT NULL");

        ensureColumns(conn, "donors", requiredColumns);

        // Ensure blood_type column can hold "Not sure" / "UNKNOWN"
        try (Statement st = conn.createStatement()) {
            boolean isMySQL = conn.getMetaData().getDatabaseProductName().toLowerCase().contains("mysql");
            if (isMySQL) {
                st.executeUpdate("ALTER TABLE donors MODIFY COLUMN blood_type VARCHAR(20) NOT NULL");
            } else {
                st.executeUpdate("ALTER TABLE donors ALTER COLUMN blood_type VARCHAR(20)");
            }
        } catch (Exception ignored) {}

        // Explicitly ensure every nullable column has DEFAULT NULL so MySQL strict mode never fails
        String[] colsToSetNullDefault = {
            "donor_id", "father_name", "dob", "gender", "weight", "last_donation", "address",
            "city", "state", "pincode", "latitude", "longitude", "location_updated_at", "zone", "pulse",
            "hemoglobin", "blood_pressure", "body_temp", "verified_facility", "verified_date",
            "allergies", "conditions", "medications", "surgeries", "donor_type", "qr_token"
        };
        for (String col : colsToSetNullDefault) {
            try (Statement st = conn.createStatement()) {
                st.executeUpdate("ALTER TABLE donors ALTER COLUMN " + col + " SET DEFAULT NULL");
            } catch (Exception ignored) {}
        }

        // Clean out any legacy demo strings so database reflects only real user inputs
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("UPDATE donors SET father_name = NULL WHERE father_name = 'Rajesh Kumar' OR father_name LIKE '%Rajesh%'");
            st.executeUpdate("UPDATE donors SET address = NULL WHERE address LIKE '%Near Subharti%' OR address LIKE '%Delhi Road%'");
            st.executeUpdate("UPDATE donors SET last_donation = NULL WHERE last_donation = '2024-01-10'");
            st.executeUpdate("UPDATE donors SET verified_facility = NULL WHERE verified_facility LIKE '%City General%'");
            st.executeUpdate("UPDATE donors SET allergies = NULL WHERE allergies LIKE '%No Known Drug%' OR allergies LIKE '%NKDA%'");
            st.executeUpdate("UPDATE donors SET conditions = NULL WHERE conditions LIKE '%Normal Screening%' OR conditions LIKE '%None Reported%'");
            st.executeUpdate("UPDATE donors SET medications = NULL WHERE medications LIKE '%Unrestricted%' OR medications LIKE 'None%'");
            st.executeUpdate("UPDATE donors SET surgeries = NULL WHERE surgeries LIKE '%None Reported%' OR surgeries LIKE '%< 12%'");
            st.executeUpdate("UPDATE donors SET donor_type = NULL WHERE donor_type LIKE '%Voluntary%'");
        } catch (Exception ignored) {}

        // Ensure Smart Donor IDs are assigned to any legacy donors without a donor_id
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, name, dob FROM donors WHERE donor_id IS NULL OR donor_id = ''")) {
            java.util.List<Map<String, Object>> missingList = new java.util.ArrayList<>();
            while (rs.next()) {
                Map<String, Object> d = new java.util.HashMap<>();
                d.put("id", rs.getInt("id"));
                d.put("name", rs.getString("name"));
                d.put("dob", rs.getDate("dob"));
                missingList.add(d);
            }
            for (Map<String, Object> d : missingList) {
                int id = (int) d.get("id");
                String name = (String) d.get("name");
                java.sql.Date dob = (java.sql.Date) d.get("dob");
                String smartId = com.red404.util.DonorIdGenerator.generateUniqueDonorId(conn, name, dob);
                try (PreparedStatement ps = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                    ps.setString(1, smartId);
                    ps.setInt(2, id);
                    ps.executeUpdate();
                    log.info("Assigned Smart Donor ID {} to donor id {}", smartId, id);
                }
            }
        } catch (Exception e) {
            log.warn("Notice assigning Smart Donor IDs: {}", e.getMessage());
        }

        // Synchronize Smart Donor IDs with actual Date of Birth for all existing donors
        // Updates strictly the [DDMM] portion to match DOB, preserving the [Initial][3 Random Numbers] suffix intact
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT id, donor_id, name, dob FROM donors WHERE dob IS NOT NULL")) {
            java.util.List<Map<String, Object>> syncList = new java.util.ArrayList<>();
            while (rs.next()) {
                Map<String, Object> d = new java.util.HashMap<>();
                d.put("id", rs.getInt("id"));
                d.put("donor_id", rs.getString("donor_id"));
                d.put("name", rs.getString("name"));
                d.put("dob", rs.getDate("dob"));
                syncList.add(d);
            }
            for (Map<String, Object> d : syncList) {
                int id = (int) d.get("id");
                String oldId = (String) d.get("donor_id");
                String name = (String) d.get("name");
                java.sql.Date dob = (java.sql.Date) d.get("dob");
                if (dob != null && oldId != null && oldId.startsWith("DNR-")) {
                    String updatedId = com.red404.util.DonorIdGenerator.updateDonorIdDob(oldId, dob, name);
                    if (updatedId != null && !updatedId.equalsIgnoreCase(oldId)) {
                        try (PreparedStatement ps = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                            ps.setString(1, updatedId);
                            ps.setInt(2, id);
                            ps.executeUpdate();
                            log.info("Synchronized Smart Donor ID for donor id {}: {} -> {}", id, oldId, updatedId);
                        }
                        try (PreparedStatement cs = conn.prepareStatement("UPDATE donations SET donor_id = ? WHERE donor_id = ?")) {
                            cs.setString(1, updatedId);
                            cs.setString(2, oldId);
                            cs.executeUpdate();
                        } catch (Exception ignored) {}
                        try (PreparedStatement cs = conn.prepareStatement("UPDATE intake_snapshots SET donor_id = ? WHERE donor_id = ?")) {
                            cs.setString(1, updatedId);
                            cs.setString(2, oldId);
                            cs.executeUpdate();
                        } catch (Exception ignored) {}
                        try (PreparedStatement cs = conn.prepareStatement("UPDATE user_sessions SET user_id = ? WHERE user_id = ?")) {
                            cs.setString(1, updatedId);
                            cs.setString(2, oldId);
                            cs.executeUpdate();
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notice synchronizing Smart Donor IDs with DOB: {}", e.getMessage());
        }

        // Add unique index on donor_id if not present
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("ALTER TABLE donors ADD UNIQUE INDEX uq_donors_donor_id (donor_id)");
        } catch (Exception ignored) {}
    }

    private void migrateHospitalsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("hospital_name", "VARCHAR(180) NOT NULL DEFAULT ''");
        requiredColumns.put("registration_no", "VARCHAR(80) NOT NULL DEFAULT ''");
        requiredColumns.put("hospital_type", "VARCHAR(40) NULL");
        requiredColumns.put("beds", "INT DEFAULT 0");
        requiredColumns.put("blood_bank_license", "VARCHAR(80) NULL");
        requiredColumns.put("hospital_email", "VARCHAR(150) NOT NULL DEFAULT ''");
        requiredColumns.put("hospital_phone", "VARCHAR(20) NULL");
        requiredColumns.put("website", "VARCHAR(150) NULL");
        requiredColumns.put("services", "TEXT NULL");
        requiredColumns.put("admin_name", "VARCHAR(150) NULL");
        requiredColumns.put("admin_designation", "VARCHAR(80) NULL");
        requiredColumns.put("admin_phone", "VARCHAR(20) NULL");
        requiredColumns.put("admin_email", "VARCHAR(150) NULL");
        requiredColumns.put("password", "VARCHAR(255) NOT NULL DEFAULT ''");
        requiredColumns.put("emergency_contact", "VARCHAR(20) NULL");
        requiredColumns.put("address", "VARCHAR(255) NULL");
        requiredColumns.put("landmark", "VARCHAR(150) NULL");
        requiredColumns.put("city", "VARCHAR(80) NULL");
        requiredColumns.put("district", "VARCHAR(80) NULL DEFAULT NULL");
        requiredColumns.put("state", "VARCHAR(80) NULL");
        requiredColumns.put("pincode", "VARCHAR(10) NULL");
        requiredColumns.put("latitude", "DOUBLE NULL");
        requiredColumns.put("longitude", "DOUBLE NULL");
        requiredColumns.put("zone", "VARCHAR(80) NULL");
        requiredColumns.put("operating_hours", "VARCHAR(40) DEFAULT '24x7'");
        requiredColumns.put("zone_radius", "INT DEFAULT 10");
        requiredColumns.put("sms_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("push_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("email_notif", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("pulse", "INT NULL DEFAULT 72");
        requiredColumns.put("hemoglobin", "DOUBLE NULL DEFAULT 14.8");
        requiredColumns.put("blood_pressure", "VARCHAR(30) NULL DEFAULT '120/80'");
        requiredColumns.put("body_temp", "DOUBLE NULL DEFAULT 98.6");
        requiredColumns.put("verified_facility", "VARCHAR(180) NULL DEFAULT 'City General Hospital'");
        requiredColumns.put("verified_date", "DATE NULL");
        requiredColumns.put("verification_status", "VARCHAR(30) DEFAULT 'pending_review'");
        requiredColumns.put("application_ref", "VARCHAR(50) NULL");
        requiredColumns.put("eraktkosh_id", "VARCHAR(50) NULL");
        requiredColumns.put("emergency_public", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("documents_json", "TEXT NULL");
        requiredColumns.put("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        requiredColumns.put("hospital_review_needed", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("health_answers_json", "TEXT NULL");
        requiredColumns.put("availability_pref", "VARCHAR(50) DEFAULT 'Any time'");
        requiredColumns.put("last_donation_self_reported", "DATE NULL DEFAULT NULL");
        requiredColumns.put("email_verified", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("email_verified_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("deleted_at", "TIMESTAMP NULL DEFAULT NULL");

        ensureColumns(conn, "hospitals", requiredColumns);

        try (Statement st = conn.createStatement()) {
            // Reconcile deleted_at and verification_status consistency:
            // Any hospital that has deleted_at populated is marked Deleted.
            st.executeUpdate("UPDATE hospitals SET verification_status = 'Deleted' WHERE deleted_at IS NOT NULL AND (verification_status IS NULL OR verification_status <> 'Deleted')");

            // Part 3 Migration: Existing active verified hospital accounts stay verified
            st.executeUpdate("UPDATE hospitals SET verification_status = 'verified' " +
                    "WHERE LOWER(verification_status) IN ('verified', 'approved', 'active') AND deleted_at IS NULL");
            // Blank or legacy pending values normalize to 'pending_review'
            st.executeUpdate("UPDATE hospitals SET verification_status = 'pending_review' " +
                    "WHERE (verification_status IS NULL OR TRIM(verification_status) = '' OR LOWER(verification_status) IN ('pending', 'pending_review')) AND deleted_at IS NULL");

            // Ensure hospital push subscriptions table exists
            st.executeUpdate("CREATE TABLE IF NOT EXISTS hospital_push_subscriptions (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "endpoint TEXT NOT NULL, " +
                    "p256dh TEXT NULL, " +
                    "auth TEXT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Ensure hospital audit logs table exists
            st.executeUpdate("CREATE TABLE IF NOT EXISTS hospital_audit_logs (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "admin_user VARCHAR(150) NULL, " +
                    "from_status VARCHAR(50) NULL, " +
                    "to_status VARCHAR(50) NOT NULL, " +
                    "reason TEXT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Ensure hospital in-app bell notifications table exists (Part 6)
            st.executeUpdate("CREATE TABLE IF NOT EXISTS hospital_notifications (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "title VARCHAR(255) NOT NULL, " +
                    "message TEXT NOT NULL, " +
                    "type VARCHAR(50) DEFAULT 'verification', " +
                    "read_status BOOLEAN DEFAULT FALSE, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Ensure notification delivery audit log table exists (Part 6: email, push, in-app)
            st.executeUpdate("CREATE TABLE IF NOT EXISTS notification_delivery_logs (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "target_type VARCHAR(20) NOT NULL, " +
                    "target_id INT NOT NULL, " +
                    "channel VARCHAR(20) NOT NULL, " +
                    "event_type VARCHAR(50) NOT NULL, " +
                    "status VARCHAR(30) NOT NULL, " +
                    "details TEXT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");

            // Ensure email daily usage stats table exists (Round 9 Part 4)
            st.executeUpdate("CREATE TABLE IF NOT EXISTS email_daily_stats (" +
                    "stat_date DATE NOT NULL, " +
                    "category VARCHAR(20) NOT NULL DEFAULT 'TOTAL', " +
                    "sent_count INT NOT NULL DEFAULT 0, " +
                    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "PRIMARY KEY (stat_date, category)" +
                    ")");
        } catch (Exception ignored) {}
    }

    private void migrateBloodRequestsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("hospital_id", "INT NOT NULL DEFAULT 1");
        requiredColumns.put("patient_name", "VARCHAR(150) NULL");
        requiredColumns.put("blood_type", "VARCHAR(5) NOT NULL DEFAULT 'O+'");
        requiredColumns.put("units_requested", "INT DEFAULT 1");
        requiredColumns.put("units_fulfilled", "INT DEFAULT 0");
        requiredColumns.put("fulfillment_note", "TEXT NULL");
        requiredColumns.put("cancelled_reason", "TEXT NULL");
        requiredColumns.put("urgency_level", "VARCHAR(20) DEFAULT 'HIGH'");
        requiredColumns.put("required_before", "DATE NULL");
        requiredColumns.put("status", "VARCHAR(20) DEFAULT 'Active'");
        requiredColumns.put("latitude", "DOUBLE NULL");
        requiredColumns.put("longitude", "DOUBLE NULL");
        requiredColumns.put("radius_km", "DOUBLE DEFAULT 10.0");
        requiredColumns.put("ward_info", "VARCHAR(150) NULL");
        requiredColumns.put("staff_user", "VARCHAR(150) NULL DEFAULT 'Hospital Staff'");
        requiredColumns.put("first_response_time", "VARCHAR(50) NULL");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        requiredColumns.put("hospital_review_needed", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("health_answers_json", "TEXT NULL");
        requiredColumns.put("availability_pref", "VARCHAR(50) DEFAULT 'Any time'");
        requiredColumns.put("last_donation_self_reported", "DATE NULL DEFAULT NULL");
        requiredColumns.put("email_verified", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("email_verified_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("expires_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("closed_at", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("close_reason", "VARCHAR(255) NULL DEFAULT NULL");
        requiredColumns.put("needed_within_mins", "INT NULL DEFAULT NULL");

        ensureColumns(conn, "blood_requests", requiredColumns);

        // Data repair migration (Round 12 Part 1, Item 7)
        try (Statement st = conn.createStatement()) {
            // 1. Any request set to Fulfilled without a linked donation becomes closed (manual)
            st.executeUpdate(
                "UPDATE blood_requests br " +
                "SET br.status = 'Closed', " +
                "    br.close_reason = 'Closed without a recorded donation', " +
                "    br.fulfillment_note = 'Closed without a recorded donation' " +
                "WHERE UPPER(br.status) = 'FULFILLED' " +
                "AND NOT EXISTS (SELECT 1 FROM donations d WHERE d.request_id = br.id AND UPPER(d.status) IN ('COMPLETED', 'APPROVED', 'VERIFIED', 'VERIFIED_INTAKE'))"
            );

            // 2. REQ-037 gets reason "Donor withdrew"
            st.executeUpdate(
                "UPDATE blood_requests br " +
                "SET br.status = 'Cancelled', " +
                "    br.cancelled_reason = 'Donor withdrew' " +
                "WHERE br.id = 37 OR br.patient_name LIKE '%REQ-037%'"
            );
        } catch (Exception ignored) {}
    }

    private void migrateBloodRequestNotificationsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("arrival_deadline", "TIMESTAMP NULL DEFAULT NULL");
        requiredColumns.put("release_reason", "VARCHAR(255) NULL DEFAULT NULL");
        ensureColumns(conn, "blood_request_notifications", requiredColumns);
    }

    private void migrateDonationsTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            try { st.executeUpdate("ALTER TABLE donations DROP FOREIGN KEY fk_don_donor"); } catch (Exception ignored) {}
            try { st.executeUpdate("ALTER TABLE donations MODIFY COLUMN donor_id VARCHAR(30) NOT NULL"); } catch (Exception ignored) {}
        } catch (Exception ignored) {}

        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("donor_id", "VARCHAR(30) NOT NULL DEFAULT 'DNR-0101-D1'");
        requiredColumns.put("hospital_id", "INT NULL");
        requiredColumns.put("request_id", "INT NULL");
        requiredColumns.put("blood_type", "VARCHAR(5) NULL");
        requiredColumns.put("units", "INT DEFAULT 1");
        requiredColumns.put("volume_ml", "INT DEFAULT 450");
        requiredColumns.put("vitals_json", "TEXT NULL");
        requiredColumns.put("staff_user", "VARCHAR(100) NULL");
        requiredColumns.put("deferral_reason", "VARCHAR(255) NULL");
        requiredColumns.put("donation_date", "DATE NULL");
        requiredColumns.put("status", "VARCHAR(20) DEFAULT 'COMPLETED'");

        ensureColumns(conn, "donations", requiredColumns);
    }

    private void migrateHospitalInventoryTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            String sql = "CREATE TABLE IF NOT EXISTS hospital_inventory (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "blood_type VARCHAR(10) NOT NULL, " +
                    "units INT DEFAULT 0, " +
                    "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, " +
                    "UNIQUE KEY uq_hosp_blood (hospital_id, blood_type)" +
                    ")";
            st.executeUpdate(sql);
            log.info("hospital_inventory table verified/created in database.");
        } catch (Exception e) {
            log.warn("Notice checking hospital_inventory table: {}", e.getMessage());
        }
    }

    private void migrateIntakeSnapshotsTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            String sql = "CREATE TABLE IF NOT EXISTS intake_snapshots (" +
                    "token VARCHAR(120) PRIMARY KEY, " +
                    "donor_id VARCHAR(30) NULL, " +
                    "snapshot_json MEDIUMTEXT NOT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")";
            st.executeUpdate(sql);
            try { st.executeUpdate("ALTER TABLE intake_snapshots MODIFY COLUMN donor_id VARCHAR(30) NULL"); } catch (Exception ignored) {}
            log.info("intake_snapshots table verified/created in database.");
        } catch (Exception e) {
            log.warn("Notice checking intake_snapshots table: {}", e.getMessage());
        }
    }

    private void migrateUserSessionsTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            String sql = "CREATE TABLE IF NOT EXISTS user_sessions (" +
                    "session_id VARCHAR(120) PRIMARY KEY, " +
                    "user_id VARCHAR(30) NOT NULL, " +
                    "user_type VARCHAR(20) NOT NULL DEFAULT 'DONOR', " +
                    "ip_address VARCHAR(60) NULL, " +
                    "user_agent VARCHAR(350) NULL, " +
                    "device VARCHAR(100) NULL, " +
                    "browser VARCHAR(100) NULL, " +
                    "location VARCHAR(150) NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "is_active BOOLEAN DEFAULT TRUE" +
                    ")";
            st.executeUpdate(sql);
            try { st.executeUpdate("ALTER TABLE user_sessions MODIFY COLUMN user_id VARCHAR(30) NOT NULL"); } catch (Exception ignored) {}
            log.info("user_sessions table verified/created in database.");
        } catch (Exception e) {
            log.warn("Notice checking user_sessions table: {}", e.getMessage());
        }
    }

    private void migrateBurnedDonorIdsTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            String sql = "CREATE TABLE IF NOT EXISTS burned_donor_ids (" +
                    "donor_id VARCHAR(30) PRIMARY KEY, " +
                    "burned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "reason VARCHAR(255) DEFAULT 'ACCOUNT_DELETED'" +
                    ")";
            st.executeUpdate(sql);
            log.info("burned_donor_ids table verified/created in database.");
        } catch (Exception e) {
            log.warn("Notice checking burned_donor_ids table: {}", e.getMessage());
        }
    }

    private void migrateHealthChecksTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            String sql = "CREATE TABLE IF NOT EXISTS health_checks (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "donor_id VARCHAR(30) NOT NULL, " +
                    "hospital_id INT NOT NULL, " +
                    "staff_id VARCHAR(100) NULL, " +
                    "checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                    "outcome VARCHAR(20) NOT NULL, " +
                    "weight DOUBLE NULL, " +
                    "hemoglobin DOUBLE NULL, " +
                    "bp_sys DOUBLE NULL, " +
                    "bp_dia DOUBLE NULL, " +
                    "pulse INT NULL, " +
                    "temperature DOUBLE NULL, " +
                    "defer_reason_category VARCHAR(100) NULL, " +
                    "defer_until DATE NULL, " +
                    "linked_donation_id INT NULL" +
                    ")";
            st.executeUpdate(sql);
            try {
                st.executeUpdate("CREATE INDEX IF NOT EXISTS idx_hc_donor ON health_checks (donor_id, checked_at)");
            } catch (Exception ignored) {}
            log.info("health_checks table verified/created in database.");
        } catch (Exception e) {
            log.warn("Notice checking health_checks table: {}", e.getMessage());
        }
    }

    private void ensureColumns(Connection conn, String tableName, Map<String, String> columns) {
        try {
            Set<String> existingColumns = new HashSet<>();
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getColumns(conn.getCatalog(), null, tableName, "%")) {
                while (rs.next()) {
                    existingColumns.add(rs.getString("COLUMN_NAME").toLowerCase());
                }
            }

            // Fallback for case sensitivity or driver differences: try direct query
            if (existingColumns.isEmpty()) {
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery("SHOW COLUMNS FROM " + tableName)) {
                    while (rs.next()) {
                        existingColumns.add(rs.getString("Field").toLowerCase());
                    }
                } catch (Exception ignored) {}
            }

            if (existingColumns.isEmpty()) {
                log.info("Table '{}' may not exist yet; schema.sql will create it.", tableName);
                return;
            }

            try (Statement st = conn.createStatement()) {
                for (Map.Entry<String, String> entry : columns.entrySet()) {
                    String col = entry.getKey().toLowerCase();
                    String def = entry.getValue();
                    if (!existingColumns.contains(col)) {
                        String alterSql = "ALTER TABLE " + tableName + " ADD COLUMN " + col + " " + def;
                        log.info("Adding missing column to table {}: {}", tableName, alterSql);
                        try {
                            st.executeUpdate(alterSql);
                            log.info("Successfully added column '{}' to table '{}'", col, tableName);
                        } catch (Exception colEx) {
                            log.warn("Could not add column {} to {}: {}", col, tableName, colEx.getMessage());
                        }
                    } else if (def.contains("DEFAULT")) {
                        try {
                            st.executeUpdate("ALTER TABLE " + tableName + " MODIFY COLUMN " + col + " " + def);
                        } catch (Exception ignored) {}
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error checking table '{}': {}", tableName, e.getMessage());
        }
    }

    private void seedOrUpdatePrimaryDonor(Connection conn) {
        try (Statement st = conn.createStatement()) {
            // Clean up any legacy dummy defaults across donors
            try {
                st.executeUpdate("UPDATE donors SET phone = NULL WHERE phone = '9876543210'");
                st.executeUpdate("UPDATE donors SET city = NULL, state = NULL, pincode = NULL WHERE city = 'Meerut' AND pincode = '250002'");
            } catch (Exception ignored) {}

            String hashedPass = com.red404.util.PasswordUtil.hashPassword("12345678");
            try (ResultSet rs = st.executeQuery("SELECT id, donor_id, dob, name FROM donors WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' LIMIT 1")) {
                if (!rs.next()) {
                    String insertSql = "INSERT INTO donors (donor_id, name, email, password, blood_type, availability, created_at) " +
                            "VALUES ('DNR-0811-A404', 'Ankit Kumar', 'ak30kr02@gmail.com', '" + hashedPass + "', 'A+', 'Available', '2026-11-08 14:00:00')";
                    st.executeUpdate(insertSql);
                    log.info("Primary donor 'ak30kr02@gmail.com' verified in database with Smart Donor ID DNR-0811-A404 (zero dummy data).");
                } else {
                    int id = rs.getInt("id");
                    String currId = rs.getString("donor_id");
                    Date dob = rs.getDate("dob");
                    String name = rs.getString("name");
                    st.executeUpdate("UPDATE donors SET password = '" + hashedPass + "' WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' AND (password IS NULL OR password = '')");
                    if (currId == null || currId.isBlank()) {
                        String assignedId = com.red404.util.DonorIdGenerator.generateUniqueDonorId(conn, name != null ? name : "Ankit Kumar", dob);
                        try (PreparedStatement upPs = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                            upPs.setString(1, assignedId);
                            upPs.setInt(2, id);
                            upPs.executeUpdate();
                        }
                    } else if (dob != null && currId.startsWith("DNR-")) {
                        String syncd = com.red404.util.DonorIdGenerator.updateDonorIdDob(currId, dob, name);
                        if (syncd != null && !syncd.equalsIgnoreCase(currId)) {
                            try (PreparedStatement upPs = conn.prepareStatement("UPDATE donors SET donor_id = ? WHERE id = ?")) {
                                upPs.setString(1, syncd);
                                upPs.setInt(2, id);
                                upPs.executeUpdate();
                            }
                        }
                    }
                    log.info("Primary donor 'ak30kr02@gmail.com' synchronized.");
                }
            }
        } catch (Exception e) {
            log.warn("Notice ensuring primary donor in database: {}", e.getMessage());
        }
    }

    private void ensureBhimtalHospital(Connection conn) {
        try (Statement st = conn.createStatement()) {
            // First synchronize district for any existing Bhimtal hospitals that are active
            try {
                st.executeUpdate("UPDATE hospitals SET district = 'Nainital' WHERE (district IS NULL OR district = '') " +
                        "AND (LOWER(city) LIKE '%bhimtal%' OR LOWER(hospital_name) LIKE '%bhimtal%' OR LOWER(address) LIKE '%bhimtal%') " +
                        "AND deleted_at IS NULL AND (verification_status IS NULL OR verification_status <> 'Deleted')");
            } catch (Exception ignored) {}

            int hospId = 0;
            try (ResultSet rs = st.executeQuery("SELECT id, verification_status, deleted_at FROM hospitals WHERE LOWER(hospital_name) LIKE '%bhimtal%' LIMIT 1")) {
                if (rs.next()) {
                    hospId = rs.getInt("id");
                    String vStat = rs.getString("verification_status");
                    Object delAt = rs.getObject("deleted_at");
                    // If hospital was deleted or suspended by administrator, preserve that state! NEVER resurrect!
                    if (delAt != null || "Deleted".equalsIgnoreCase(vStat)) {
                        log.info("Bhimtal Hospital (id: {}) is soft-deleted; skipping re-verification on startup.", hospId);
                        return;
                    }
                }
            }

            if (hospId == 0) {
                String insertSql = "INSERT INTO hospitals (" +
                        "hospital_name, registration_no, hospital_type, beds, blood_bank_license, " +
                        "hospital_email, hospital_phone, website, services, admin_name, admin_designation, " +
                        "admin_phone, admin_email, password, emergency_contact, address, landmark, " +
                        "city, district, state, pincode, latitude, longitude, zone, operating_hours, " +
                        "zone_radius, sms_notif, push_notif, email_notif, verification_status" +
                        ") VALUES (" +
                        "'Bhimtal Hospital', 'REG-UK-NTL-0404', 'Community Health Centre', 80, 'BB-UK-2026-08', " +
                        "'bhimtal.hospital@red404.org', '+91 5942 247123', 'https://red404.org', 'Blood Bank, Trauma Care, 24x7 Emergency', " +
                        "'Dr. B. K. Joshi', 'Chief Medical Officer', '+91 5942 247123', 'cmo.bhimtal@red404.org', " +
                        "'$2a$10$wI5fHqU3Xp8jB1pZz6uL8eN7m4q9v8k7y6x5w4v3u2t1s0r9q8p7o', '+91 5942 247123', " +
                        "'Main Road, Bhowali-Bhimtal Road, Bhimtal, Nainital, Uttarakhand', 'Near Bhimtal Lake', " +
                        "'Bhimtal', 'Nainital', 'Uttarakhand', '263136', 29.3500, 79.5500, 'Zone 2', '24x7', " +
                        "15, TRUE, TRUE, FALSE, 'Verified'" +
                        ")";
                st.executeUpdate(insertSql);
                try (ResultSet rs = st.executeQuery("SELECT id FROM hospitals WHERE LOWER(hospital_name) LIKE '%bhimtal%' LIMIT 1")) {
                    if (rs.next()) hospId = rs.getInt("id");
                }
                log.info("Created verified Bhimtal Hospital with id {}", hospId);
            } else {
                st.executeUpdate("UPDATE hospitals SET " +
                        "hospital_name = 'Bhimtal Hospital', " +
                        "district = 'Nainital', " +
                        "city = 'Bhimtal', " +
                        "state = 'Uttarakhand', " +
                        "address = 'Main Road, Bhowali-Bhimtal Road, Bhimtal, Nainital, Uttarakhand', " +
                        "latitude = CASE WHEN latitude IS NULL OR latitude = 0.0 THEN 29.3500 ELSE latitude END, " +
                        "longitude = CASE WHEN longitude IS NULL OR longitude = 0.0 THEN 79.5500 ELSE longitude END, " +
                        "hospital_phone = CASE WHEN hospital_phone IS NULL OR hospital_phone = '' THEN '+91 5942 247123' ELSE hospital_phone END " +
                        "WHERE id = " + hospId + " AND deleted_at IS NULL AND (verification_status IS NULL OR verification_status <> 'Deleted')");
                log.info("Updated Bhimtal Hospital (id: {}) geo metadata in Nainital, Uttarakhand", hospId);
            }

            if (hospId > 0) {
                // Ensure real inventory units across all 8 blood groups
                String[][] stockData = {
                    {"O-", "6"}, {"O+", "14"}, {"A-", "5"}, {"A+", "16"},
                    {"B-", "6"}, {"B+", "12"}, {"AB-", "4"}, {"AB+", "8"}
                };
                for (String[] pair : stockData) {
                    try {
                        String upsertStock = "INSERT INTO hospital_inventory (hospital_id, blood_type, units) " +
                                "VALUES (" + hospId + ", '" + pair[0] + "', " + pair[1] + ") " +
                                "ON DUPLICATE KEY UPDATE units = CASE WHEN units <= 0 THEN " + pair[1] + " ELSE units END";
                        st.executeUpdate(upsertStock);
                    } catch (Exception ex) {
                        log.warn("Notice setting stock for Bhimtal Hospital {}: {}", pair[0], ex.getMessage());
                    }
                }
                log.info("Ensured live stock for Bhimtal Hospital (id: {}) across all 8 blood types.", hospId);
            }
        } catch (Exception e) {
            log.warn("Notice ensuring Bhimtal Hospital in database: {}", e.getMessage());
        }
    }

    private void ensureDatabaseIndexes(Connection conn) {
        log.info("Ensuring high-performance production database indexes (Part 8 Scale & Readiness)...");
        // 1. Donors: location search, blood type, zone, city, created_at
        ensureIndex(conn, "donors", "idx_donors_lat_lng", "latitude, longitude");
        ensureIndex(conn, "donors", "idx_donors_blood_type", "blood_type");
        ensureIndex(conn, "donors", "idx_donors_zone", "zone");
        ensureIndex(conn, "donors", "idx_donors_city", "city");
        ensureIndex(conn, "donors", "idx_donors_created", "created_at");

        // 2. Blood Requests: hospital_id, status, created_at, blood_group
        ensureIndex(conn, "blood_requests", "idx_requests_hosp_status", "hospital_id, status");
        ensureIndex(conn, "blood_requests", "idx_requests_status_created", "status, created_at");
        ensureIndex(conn, "blood_requests", "idx_requests_blood_group", "blood_group");

        // 3. Notifications: donor_id, status, request_id
        ensureIndex(conn, "blood_request_notifications", "idx_brn_donor_status", "donor_id, status");
        ensureIndex(conn, "blood_request_notifications", "idx_brn_request_id", "request_id");
        ensureIndex(conn, "donor_notifications", "idx_dn_donor_created", "donor_id, created_at");

        // 4. Hospitals: verification_status, location, city
        ensureIndex(conn, "hospitals", "idx_hosp_status", "verification_status");
        ensureIndex(conn, "hospitals", "idx_hosp_lat_lng", "latitude, longitude");
        ensureIndex(conn, "hospitals", "idx_hosp_city", "city");

        // 5. Hospital Audit Logs table and index
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS hospital_audit_logs (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "hospital_id INT NOT NULL, " +
                    "admin_user VARCHAR(150) NULL, " +
                    "from_status VARCHAR(50) NULL, " +
                    "to_status VARCHAR(50) NOT NULL, " +
                    "reason TEXT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");
        } catch (Exception ignored) {}
        ensureIndex(conn, "hospital_audit_logs", "idx_hosp_audit_hosp_created", "hospital_id, created_at");

        // 6. Donor Audit Logs table and index (Round 11)
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("CREATE TABLE IF NOT EXISTS donor_audit_logs (" +
                    "id INT AUTO_INCREMENT PRIMARY KEY, " +
                    "donor_id INT NOT NULL, " +
                    "admin_user VARCHAR(150) NULL, " +
                    "action VARCHAR(50) NOT NULL, " +
                    "details TEXT NULL, " +
                    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                    ")");
        } catch (Exception ignored) {}
        ensureIndex(conn, "donor_audit_logs", "idx_donor_audit_donor_created", "donor_id, created_at");
    }

    private void ensureIndex(Connection conn, String tableName, String indexName, String columns) {
        try {
            boolean exists = false;
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getIndexInfo(conn.getCatalog(), null, tableName.toLowerCase(), false, false)) {
                while (rs.next()) {
                    String idx = rs.getString("INDEX_NAME");
                    if (indexName.equalsIgnoreCase(idx)) {
                        exists = true;
                        break;
                    }
                }
            } catch (Exception ignored) {}

            if (!exists) {
                try (ResultSet rs = meta.getIndexInfo(conn.getCatalog(), null, tableName.toUpperCase(), false, false)) {
                    while (rs.next()) {
                        String idx = rs.getString("INDEX_NAME");
                        if (indexName.equalsIgnoreCase(idx)) {
                            exists = true;
                            break;
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (!exists) {
                try (Statement st = conn.createStatement()) {
                    st.executeUpdate("CREATE INDEX " + indexName + " ON " + tableName + " (" + columns + ")");
                    log.info("Created production database index {} on {} ({})", indexName, tableName, columns);
                } catch (Exception ex) {
                    // Ignored if already exists under different dialect or casing
                }
            }
        } catch (Exception ignored) {}
    }
}

