package com.red404.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
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
            migrateDonorsTable(conn);
            migrateHospitalsTable(conn);
            migrateBloodRequestsTable(conn);
            migrateDonationsTable(conn);
            seedOrUpdatePrimaryDonor(conn);
            log.info("RED404 database schema migration check completed successfully.");
        } catch (Exception e) {
            log.warn("Database schema migration notice: {}", e.getMessage());
        }
    }

    private void migrateDonorsTable(Connection conn) {
        Map<String, String> requiredColumns = new LinkedHashMap<>();
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
        requiredColumns.put("pulse", "INT NULL DEFAULT 72");
        requiredColumns.put("hemoglobin", "DOUBLE NULL DEFAULT 14.8");
        requiredColumns.put("blood_pressure", "VARCHAR(30) NULL DEFAULT '120/80'");
        requiredColumns.put("body_temp", "DOUBLE NULL DEFAULT 98.6");
        requiredColumns.put("verified_facility", "VARCHAR(180) NULL DEFAULT 'City General Hospital'");
        requiredColumns.put("verified_date", "DATE NULL");
        requiredColumns.put("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        ensureColumns(conn, "donors", requiredColumns);
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
        Map<String, String> requiredColumns = new LinkedHashMap<>();
        requiredColumns.put("donor_id", "INT NOT NULL DEFAULT 1");
        requiredColumns.put("hospital_id", "INT NULL");
        requiredColumns.put("blood_type", "VARCHAR(5) NULL");
        requiredColumns.put("units", "INT DEFAULT 1");
        requiredColumns.put("donation_date", "DATE NULL");
        requiredColumns.put("status", "VARCHAR(20) DEFAULT 'COMPLETED'");

        ensureColumns(conn, "donations", requiredColumns);
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
            try (ResultSet rs = st.executeQuery("SELECT id FROM donors WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' LIMIT 1")) {
                if (!rs.next()) {
                    String insertSql = "INSERT INTO donors (name, email, phone, dob, gender, password, blood_type, weight, last_donation, availability, address, city, state, pincode, zone, created_at) " +
                            "VALUES ('Ankit Kumar', 'ak30kr02@gmail.com', '9876543210', '1998-05-15', 'Male', '12345678', 'A+', 68.0, '2024-01-10', 'Available', 'Near Subharti, Delhi Road', 'Meerut', 'Uttar Pradesh', '250002', 'North Zone', '2026-11-08 14:00:00')";
                    st.executeUpdate(insertSql);
                    log.info("Primary donor 'ak30kr02@gmail.com' seeded into database.");
                } else {
                    st.executeUpdate("UPDATE donors SET password = '12345678' WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com'");
                    log.info("Primary donor 'ak30kr02@gmail.com' password verified and synchronized.");
                }
            }
        } catch (Exception e) {
            log.warn("Notice ensuring primary donor in database: {}", e.getMessage());
        }
    }
}

