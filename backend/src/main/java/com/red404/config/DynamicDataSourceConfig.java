package com.red404.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import javax.sql.DataSource;
import java.io.File;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

@Configuration
public class DynamicDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DynamicDataSourceConfig.class);

    @Value("${spring.datasource.url:}")
    private String rawUrl;

    @Value("${spring.datasource.username:root}")
    private String rawUsername;

    @Value("${spring.datasource.password:}")
    private String rawPassword;

    @Bean
    @Primary
    public DataSource dataSource() {
        ResolvedConfig cfg = resolveMySQLConfig();

        // 1. Try Primary / Railway / Cloud MySQL DataSource first
        if (cfg != null && cfg.jdbcUrl != null && !cfg.jdbcUrl.isBlank()) {
            DataSource ds = tryConnectMySQL(cfg.jdbcUrl, cfg.username, cfg.password);
            if (ds != null) {
                return ds;
            }

            // If port 3307 was attempted on localhost, also attempt standard port 3306
            if (cfg.jdbcUrl.contains("127.0.0.1:3307") || cfg.jdbcUrl.contains("localhost:3307")) {
                String altUrl = cfg.jdbcUrl.replace(":3307", ":3306");
                DataSource altDs = tryConnectMySQL(altUrl, cfg.username, cfg.password);
                if (altDs != null) {
                    return altDs;
                }
            } else if (cfg.jdbcUrl.contains("127.0.0.1:3306") || cfg.jdbcUrl.contains("localhost:3306")) {
                String altUrl = cfg.jdbcUrl.replace(":3306", ":3307");
                DataSource altDs = tryConnectMySQL(altUrl, cfg.username, cfg.password);
                if (altDs != null) {
                    return altDs;
                }
            }
        }

        // 2. Fallback to embedded persistent file-based H2 database (MySQL compatibility mode)
        try {
            File dataDir = new File("data");
            if (!dataDir.exists() && new File("backend/data").exists()) {
                dataDir = new File("backend/data");
            }
            if (!dataDir.exists()) {
                dataDir.mkdirs();
            }
            String dbPath = new File(dataDir, "red404").getAbsolutePath().replace('\\', '/');
            String persistentH2Url = "jdbc:h2:file:" + dbPath + ";MODE=MySQL;DATABASE_TO_UPPER=FALSE;AUTO_SERVER=TRUE;DB_CLOSE_DELAY=-1";
            log.info("Starting embedded persistent file database (H2 MySQL-mode) at: {}", persistentH2Url);

            HikariConfig h2Config = new HikariConfig();
            h2Config.setJdbcUrl(persistentH2Url);
            h2Config.setUsername("sa");
            h2Config.setPassword("");
            h2Config.setDriverClassName("org.h2.Driver");
            h2Config.setMaximumPoolSize(10);
            h2Config.setMinimumIdle(2);

            HikariDataSource h2Ds = new HikariDataSource(h2Config);
            runInitScript(h2Ds);
            log.info("Persistent H2 database initialized successfully! Data will persist across restarts.");
            return h2Ds;
        } catch (Throwable ex) {
            log.error("Failed to initialize persistent H2: {}. Trying in-memory H2 fallback...", ex.getMessage());
            try {
                HikariConfig minimalConfig = new HikariConfig();
                minimalConfig.setJdbcUrl("jdbc:h2:mem:red404;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=FALSE");
                minimalConfig.setUsername("sa");
                minimalConfig.setPassword("");
                minimalConfig.setDriverClassName("org.h2.Driver");
                HikariDataSource minimalDs = new HikariDataSource(minimalConfig);
                runInitScript(minimalDs);
                log.info("Minimal in-memory H2 database initialized successfully! Web service is ready.");
                return minimalDs;
            } catch (Exception e) {
                log.error("Fatal database initialization error: {}", e.getMessage(), e);
                throw new RuntimeException("Database initialization error", e);
            }
        }
    }

    private DataSource tryConnectMySQL(String jdbcUrl, String username, String password) {
        int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.info("Attempting connection to primary MySQL database (attempt {}/{}): {}", 
                         attempt, maxAttempts, sanitizeUrl(jdbcUrl));
                HikariConfig config = new HikariConfig();
                config.setJdbcUrl(jdbcUrl);
                config.setUsername(username);
                config.setPassword(password);
                config.setDriverClassName("com.mysql.cj.jdbc.Driver");
                config.setMaximumPoolSize(10);
                config.setMinimumIdle(2);
                config.setConnectionTimeout(15000);
                config.setInitializationFailTimeout(1);

                HikariDataSource ds = new HikariDataSource(config);
                try (Connection conn = ds.getConnection()) {
                    log.info("Successfully connected to MySQL database: {}", sanitizeUrl(jdbcUrl));
                    runInitScript(ds);
                    return ds;
                } catch (Exception connEx) {
                    ds.close();
                    log.warn("MySQL connection check failed on attempt {}/{}: {}", attempt, maxAttempts, connEx.getMessage());
                    if (attempt < maxAttempts) {
                        try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                    }
                }
            } catch (Throwable t) {
                log.warn("Could not create MySQL connection pool on attempt {}/{}: {}", attempt, maxAttempts, t.getMessage());
                if (attempt < maxAttempts) {
                    try { Thread.sleep(2000); } catch (InterruptedException ignored) {}
                }
            }
        }
        return null;
    }

    private void runInitScript(DataSource ds) {
        try {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
            populator.addScript(new ClassPathResource("schema.sql"));
            populator.setContinueOnError(true);
            populator.execute(ds);
            log.info("Schema initialization script executed successfully.");
        } catch (Exception e) {
            log.warn("Notice during schema.sql initialization: {}", e.getMessage());
        }
        ensureDonorColumns(ds);
    }

    private void ensureDonorColumns(DataSource ds) {
        try (Connection conn = ds.getConnection()) {
            ensureColumn(conn, "donors", "father_name", "VARCHAR(150) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "pulse", "INT NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "hemoglobin", "DOUBLE NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "blood_pressure", "VARCHAR(30) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "body_temp", "DOUBLE NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "verified_facility", "VARCHAR(150) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "verified_date", "DATE NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "allergies", "VARCHAR(255) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "conditions", "VARCHAR(255) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "medications", "VARCHAR(255) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "surgeries", "VARCHAR(255) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "donor_type", "VARCHAR(80) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "qr_token", "VARCHAR(100) NULL DEFAULT NULL");
            ensureColumn(conn, "donors", "last_donation", "DATE NULL DEFAULT NULL");
        } catch (Exception e) {
            log.warn("Notice during ensureDonorColumns: {}", e.getMessage());
        }
    }

    private void ensureColumn(Connection conn, String tableName, String colName, String colDef) {
        try {
            boolean exists = false;
            try (ResultSet rs = conn.getMetaData().getColumns(null, null, tableName, colName)) {
                if (rs.next()) exists = true;
            }
            if (!exists) {
                try (ResultSet rs = conn.getMetaData().getColumns(null, null, tableName.toUpperCase(), colName.toUpperCase())) {
                    if (rs.next()) exists = true;
                }
            }
            try (Statement st = conn.createStatement()) {
                if (!exists) {
                    st.executeUpdate("ALTER TABLE " + tableName + " ADD COLUMN " + colName + " " + colDef);
                    log.info("Added missing column {} to table {}", colName, tableName);
                } else {
                    try {
                        st.executeUpdate("ALTER TABLE " + tableName + " MODIFY COLUMN " + colName + " " + colDef);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}
    }

    private ResolvedConfig resolveMySQLConfig() {
        // 1. Check explicit cloud environment variables (Railway, Render, etc.)
        String host = getEnv("MYSQLHOST", "MYSQL_HOST");
        String port = getEnv("MYSQLPORT", "MYSQL_PORT");
        String user = getEnv("MYSQLUSER", "MYSQL_USER");
        String pass = getEnv("MYSQLPASSWORD", "MYSQL_PASSWORD");
        String db = getEnv("MYSQLDATABASE", "MYSQL_DATABASE");

        if (host != null && !host.isBlank()) {
            if (port == null || port.isBlank()) port = "3306";
            if (user == null || user.isBlank()) user = (rawUsername != null && !rawUsername.isBlank()) ? rawUsername : "root";
            if (pass == null) pass = rawPassword != null ? rawPassword : "";
            if (db == null || db.isBlank()) db = "railway";

            String jdbcUrl = String.format(
                    "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=15000&socketTimeout=30000",
                    host, port, db
            );
            return new ResolvedConfig(jdbcUrl, user, pass);
        }

        // 2. Check full URLs (MYSQL_URL, MYSQL_PRIVATE_URL, DATABASE_URL, DATABASE_PUBLIC_URL)
        String envUrl = getEnv("MYSQL_URL", "MYSQL_PRIVATE_URL", "DATABASE_URL", "DATABASE_PUBLIC_URL", "SPRING_DATASOURCE_URL");
        if (envUrl == null || envUrl.isBlank()) {
            envUrl = rawUrl;
        }

        if (envUrl != null && !envUrl.isBlank()) {
            ResolvedConfig parsed = parseMySQLUrl(envUrl, rawUsername != null ? rawUsername : "root", rawPassword != null ? rawPassword : "");
            if (parsed != null) {
                return parsed;
            }
        }

        // 3. Fallback to local default XAMPP / development port
        host = "127.0.0.1";
        port = "3307";
        user = (rawUsername != null && !rawUsername.isBlank()) ? rawUsername : "root";
        pass = rawPassword != null ? rawPassword : "";
        db = "red404";

        String jdbcUrl = String.format(
                "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=5000&socketTimeout=10000",
                host, port, db
        );
        return new ResolvedConfig(jdbcUrl, user, pass);
    }

    public static ResolvedConfig parseMySQLUrl(String rawUrl, String fallbackUser, String fallbackPass) {
        if (rawUrl == null || rawUrl.isBlank()) return null;
        String url = rawUrl.trim();

        // Handle standard jdbc: urls directly
        if (url.startsWith("jdbc:mysql://")) {
            return new ResolvedConfig(url, fallbackUser, fallbackPass);
        }

        // Strip jdbc: prefix if present (e.g. jdbc:mysql://...)
        boolean isJdbc = url.startsWith("jdbc:");
        String clean = isJdbc ? url.substring(5) : url;

        if (!clean.startsWith("mysql://")) {
            if (isJdbc) {
                return new ResolvedConfig(url, fallbackUser, fallbackPass);
            }
            return null;
        }

        // Format: mysql://[user[:password]@]host[:port][/database][?params]
        String withoutScheme = clean.substring("mysql://".length());

        int questionIdx = withoutScheme.indexOf('?');
        if (questionIdx != -1) {
            withoutScheme = withoutScheme.substring(0, questionIdx);
        }

        String user = fallbackUser;
        String pass = fallbackPass;
        String host = "127.0.0.1";
        String port = "3306";
        String db = "railway";

        int slashIdx = withoutScheme.indexOf('/');
        String authority = slashIdx != -1 ? withoutScheme.substring(0, slashIdx) : withoutScheme;
        if (slashIdx != -1 && slashIdx < withoutScheme.length() - 1) {
            db = withoutScheme.substring(slashIdx + 1);
        }

        int atIdx = authority.lastIndexOf('@');
        String hostPortPart = authority;
        if (atIdx != -1) {
            String userPassPart = authority.substring(0, atIdx);
            hostPortPart = authority.substring(atIdx + 1);

            int colonIdx = userPassPart.indexOf(':');
            if (colonIdx != -1) {
                user = userPassPart.substring(0, colonIdx);
                pass = userPassPart.substring(colonIdx + 1);
            } else {
                user = userPassPart;
            }
        }

        int colonHostIdx = hostPortPart.lastIndexOf(':');
        if (colonHostIdx != -1) {
            host = hostPortPart.substring(0, colonHostIdx);
            port = hostPortPart.substring(colonHostIdx + 1);
        } else if (!hostPortPart.isBlank()) {
            host = hostPortPart;
        }

        String jdbcUrl = String.format(
                "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=15000&socketTimeout=30000",
                host, port, db
        );

        return new ResolvedConfig(jdbcUrl, user, pass);
    }

    private static String getEnv(String... names) {
        for (String name : names) {
            String val = System.getenv(name);
            if (val != null && !val.isBlank()) return val.trim();
        }
        return null;
    }

    private String sanitizeUrl(String url) {
        if (url == null) return "";
        return url.replaceAll("(?i)(password=)[^&;]*", "$1****");
    }

    public static class ResolvedConfig {
        public final String jdbcUrl;
        public final String username;
        public final String password;

        public ResolvedConfig(String jdbcUrl, String username, String password) {
            this.jdbcUrl = jdbcUrl;
            this.username = username;
            this.password = password;
        }
    }
}
