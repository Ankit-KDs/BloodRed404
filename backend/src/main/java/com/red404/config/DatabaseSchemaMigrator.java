package com.red404.config;

import java.sql.Connection;
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
            log.info("Running RED404 database schema migration check...");
            migrateBurnedDonorIdsTable(conn);
            migrateDonorsTable(conn);
            migrateHospitalsTable(conn);
            migrateBloodRequestsTable(conn);
            migrateDonationsTable(conn);
            migrateHospitalInventoryTable(conn);
            migrateIntakeSnapshotsTable(conn);
            migrateUserSessionsTable(conn);
            seedOrUpdatePrimaryDonor(conn);
            log.info("RED404 database schema migration check completed successfully.");
        } catch (Exception e) {
            log.warn("Database schema migration notice: {}", e.getMessage());
        }
    }

    private void migrateDonorsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("donor_id", "VARCHAR(30) NULL");
        requiredColumns.put("father_name", "VARCHAR(150) NULL");
        requiredColumns.put("dob", "DATE NULL");
        requiredColumns.put("gender", "VARCHAR(20) NULL");
        requiredColumns.put("weight", "DOUBLE NULL");
        requiredColumns.put("last_donation", "DATE NULL");
        requiredColumns.put("availability", "VARCHAR(40) DEFAULT 'Available'");
        requiredColumns.put("address", "VARCHAR(255) NULL");
        requiredColumns.put("city", "VARCHAR(80) NULL");
        requiredColumns.put("state", "VARCHAR(80) NULL");
        requiredColumns.put("pincode", "VARCHAR(10) NULL");
        requiredColumns.put("latitude", "DOUBLE NULL");
        requiredColumns.put("longitude", "DOUBLE NULL");
        requiredColumns.put("zone", "VARCHAR(80) NULL");
        requiredColumns.put("sms_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("push_notif", "BOOLEAN DEFAULT TRUE");
        requiredColumns.put("email_notif", "BOOLEAN DEFAULT FALSE");
        requiredColumns.put("pulse", "INT NULL");
        requiredColumns.put("hemoglobin", "DOUBLE NULL");
        requiredColumns.put("blood_pressure", "VARCHAR(30) NULL");
        requiredColumns.put("body_temp", "DOUBLE NULL");
        requiredColumns.put("verified_facility", "VARCHAR(180) NULL");
        requiredColumns.put("verified_date", "DATE NULL");
        requiredColumns.put("allergies", "VARCHAR(255) NULL");
        requiredColumns.put("conditions", "VARCHAR(255) NULL");
        requiredColumns.put("medications", "VARCHAR(255) NULL");
        requiredColumns.put("surgeries", "VARCHAR(255) NULL");
        requiredColumns.put("donor_type", "VARCHAR(80) NULL");
        requiredColumns.put("qr_token", "VARCHAR(100) NULL");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        ensureColumns(conn, "donors", requiredColumns);

        // Drop any legacy demo column defaults that were added previously
        String[] colsToDropDefault = {
            "father_name", "pulse", "hemoglobin", "blood_pressure", "body_temp",
            "verified_facility", "allergies", "conditions", "medications", "surgeries", "donor_type"
        };
        for (String col : colsToDropDefault) {
            try (Statement st = conn.createStatement()) {
                st.executeUpdate("ALTER TABLE donors ALTER COLUMN " + col + " DROP DEFAULT");
            } catch (Exception ignored) {}
        }

        // Clean out any legacy demo strings so database reflects only real user inputs
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("UPDATE donors SET father_name = NULL WHERE father_name = 'Rajesh Kumar' OR father_name LIKE '%Rajesh%'");
            st.executeUpdate("UPDATE donors SET address = NULL WHERE address LIKE '%Near Subharti%' OR address LIKE '%Delhi Road%'");
            st.executeUpdate("UPDATE donors SET last_donation = NULL WHERE last_donation = '2024-01-10'");
            st.executeUpdate("UPDATE donors SET pulse = NULL WHERE pulse = 72");
            st.executeUpdate("UPDATE donors SET hemoglobin = NULL WHERE hemoglobin = 14.8");
            st.executeUpdate("UPDATE donors SET blood_pressure = NULL WHERE blood_pressure = '120/80'");
            st.executeUpdate("UPDATE donors SET body_temp = NULL WHERE body_temp = 98.6");
            st.executeUpdate("UPDATE donors SET verified_facility = NULL WHERE verified_facility LIKE '%City General%'");
            st.executeUpdate("UPDATE donors SET allergies = NULL WHERE allergies LIKE '%No Known Drug%' OR allergies LIKE '%NKDA%'");
            st.executeUpdate("UPDATE donors SET conditions = NULL WHERE conditions LIKE '%Normal Screening%' OR conditions LIKE '%None Reported%'");
            st.executeUpdate("UPDATE donors SET medications = NULL WHERE medications LIKE '%Unrestricted%' OR medications LIKE 'None%'");
            st.executeUpdate("UPDATE donors SET surgeries = NULL WHERE surgeries LIKE '%None Reported%' OR surgeries LIKE '%< 12%'");
            st.executeUpdate("UPDATE donors SET donor_type = NULL WHERE donor_type LIKE '%Voluntary%'");
            st.executeUpdate("UPDATE donors SET weight = NULL WHERE weight = 68.0");
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
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        ensureColumns(conn, "hospitals", requiredColumns);
    }

    private void migrateBloodRequestsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("hospital_id", "INT NOT NULL DEFAULT 1");
        requiredColumns.put("patient_name", "VARCHAR(150) NULL");
        requiredColumns.put("blood_type", "VARCHAR(5) NOT NULL DEFAULT 'O+'");
        requiredColumns.put("units_requested", "INT DEFAULT 1");
        requiredColumns.put("urgency_level", "VARCHAR(20) DEFAULT 'HIGH'");
        requiredColumns.put("required_before", "DATE NULL");
        requiredColumns.put("status", "VARCHAR(20) DEFAULT 'Active'");
        requiredColumns.put("latitude", "DOUBLE NULL");
        requiredColumns.put("longitude", "DOUBLE NULL");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        ensureColumns(conn, "blood_requests", requiredColumns);
    }

    private void migrateDonationsTable(Connection conn) {
        try (Statement st = conn.createStatement()) {
            try { st.executeUpdate("ALTER TABLE donations DROP FOREIGN KEY fk_don_donor"); } catch (Exception ignored) {}
            try { st.executeUpdate("ALTER TABLE donations MODIFY COLUMN donor_id VARCHAR(30) NOT NULL"); } catch (Exception ignored) {}
        } catch (Exception ignored) {}

        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("donor_id", "VARCHAR(30) NOT NULL DEFAULT 'DNR-0101-D1'");
        requiredColumns.put("hospital_id", "INT NULL");
        requiredColumns.put("blood_type", "VARCHAR(5) NULL");
        requiredColumns.put("units", "INT DEFAULT 1");
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
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error checking table '{}': {}", tableName, e.getMessage());
        }
    }

    private void seedOrUpdatePrimaryDonor(Connection conn) {
        try (Statement st = conn.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT id, donor_id FROM donors WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' LIMIT 1")) {
                if (!rs.next()) {
                    String insertSql = "INSERT INTO donors (donor_id, name, email, phone, password, blood_type, availability, city, state, pincode, zone, created_at) " +
                            "VALUES ('DNR-0811-A404', 'Ankit Kumar', 'ak30kr02@gmail.com', '9876543210', '12345678', 'A+', 'Available', 'Meerut', 'Uttar Pradesh', '250002', 'North Zone', '2026-11-08 14:00:00')";
                    st.executeUpdate(insertSql);
                    log.info("Primary donor 'ak30kr02@gmail.com' verified in database with Smart Donor ID DNR-0811-A404.");
                } else {
                    st.executeUpdate("UPDATE donors SET password = '12345678' WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com'");
                    st.executeUpdate("UPDATE donors SET donor_id = 'DNR-0811-A404' WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' AND (donor_id IS NULL OR donor_id = '')");
                    log.info("Primary donor 'ak30kr02@gmail.com' synchronized.");
                }
            }
        } catch (Exception e) {
            log.warn("Notice ensuring primary donor in database: {}", e.getMessage());
        }
    }
}

