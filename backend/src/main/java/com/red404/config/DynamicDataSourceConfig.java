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
import java.net.URI;
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

        // 1. Try MySQL DataSource first
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
            seedDefaultData(h2Ds);
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
                seedDefaultData(minimalDs);
                log.info("Minimal in-memory H2 database initialized successfully! Web service is ready.");
                return minimalDs;
            } catch (Exception e) {
                log.error("Fatal database initialization error: {}", e.getMessage(), e);
                throw new RuntimeException("Database initialization error", e);
            }
        }
    }

    private DataSource tryConnectMySQL(String jdbcUrl, String username, String password) {
        try {
            log.info("Attempting connection to primary MySQL database: {}", sanitizeUrl(jdbcUrl));
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(jdbcUrl);
            config.setUsername(username);
            config.setPassword(password);
            config.setDriverClassName("com.mysql.cj.jdbc.Driver");
            config.setMaximumPoolSize(10);
            config.setMinimumIdle(2);
            config.setConnectionTimeout(3000);
            config.setInitializationFailTimeout(1);

            HikariDataSource ds = new HikariDataSource(config);
            try (Connection conn = ds.getConnection()) {
                log.info("Successfully connected to MySQL database: {}", sanitizeUrl(jdbcUrl));
                runInitScript(ds);
                seedDefaultData(ds);
                return ds;
            } catch (Exception connEx) {
                ds.close();
                log.warn("MySQL connection check failed on {}: {}", sanitizeUrl(jdbcUrl), connEx.getMessage());
                return null;
            }
        } catch (Throwable t) {
            log.warn("Could not connect to MySQL database ({}).", t.getMessage());
            return null;
        }
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
    }

    private void seedDefaultData(DataSource ds) {
        try (Connection conn = ds.getConnection();
             Statement stmt = conn.createStatement()) {

            // Check if donor 'ak30kr02@gmail.com' exists
            try (ResultSet rs = stmt.executeQuery("SELECT id FROM donors WHERE LOWER(TRIM(email)) = 'ak30kr02@gmail.com' LIMIT 1")) {
                if (!rs.next()) {
                    String seedDonor = "INSERT INTO donors (name, email, phone, dob, gender, password, blood_type, weight, last_donation, availability, address, city, state, pincode, zone, created_at) " +
                            "VALUES ('Ankit Kumar', 'ak30kr02@gmail.com', '9876543210', '1998-05-15', 'Male', '12345678', 'A+', 68.0, '2024-01-10', 'Available', 'Near Subharti, Delhi Road', 'Meerut', 'Uttar Pradesh', '250002', 'North Zone', '2026-11-08 14:00:00')";
                    stmt.executeUpdate(seedDonor);
                    log.info("Seeded primary registered donor account: ak30kr02@gmail.com");
                }
            }
        } catch (Exception e) {
            log.warn("Notice checking/seeding default user: {}", e.getMessage());
        }
    }

    private ResolvedConfig resolveMySQLConfig() {
        String host = System.getenv("MYSQLHOST");
        String port = System.getenv("MYSQLPORT");
        String user = System.getenv("MYSQLUSER");
        String pass = System.getenv("MYSQLPASSWORD");
        String db = System.getenv("MYSQLDATABASE");

        // If explicit Railway / cloud variables are set
        if (host != null && !host.isBlank()) {
            if (port == null || port.isBlank()) port = "3306";
            if (user == null || user.isBlank()) user = (rawUsername != null && !rawUsername.isBlank()) ? rawUsername : "root";
            if (pass == null) pass = rawPassword != null ? rawPassword : "";
            if (db == null || db.isBlank()) db = "railway";

            String jdbcUrl = String.format(
                    "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=5000&socketTimeout=10000",
                    host, port, db
            );
            return new ResolvedConfig(jdbcUrl, user, pass);
        }

        // Check full URLs (MYSQL_URL, MYSQL_PRIVATE_URL, DATABASE_URL)
        String envUrl = System.getenv("MYSQL_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = System.getenv("MYSQL_PRIVATE_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = System.getenv("DATABASE_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = rawUrl;

        if (envUrl != null && !envUrl.isBlank()) {
            if (envUrl.startsWith("mysql://") || envUrl.startsWith("jdbc:mysql://")) {
                try {
                    String clean = envUrl.startsWith("jdbc:") ? envUrl.substring(5) : envUrl;
                    URI uri = new URI(clean);
                    if (uri.getHost() != null && !uri.getHost().isBlank()) host = uri.getHost();
                    if (uri.getPort() > 0) port = String.valueOf(uri.getPort());
                    if (uri.getUserInfo() != null) {
                        String[] parts = uri.getUserInfo().split(":", 2);
                        if (parts.length > 0 && !parts[0].isEmpty()) user = parts[0];
                        if (parts.length > 1) pass = parts[1];
                    }
                    if (uri.getPath() != null && uri.getPath().length() > 1) db = uri.getPath().substring(1);
                } catch (Exception e) {
                    log.debug("Notice parsing URL: {}", e.getMessage());
                }
            } else if (envUrl.startsWith("jdbc:")) {
                return new ResolvedConfig(envUrl,
                        rawUsername != null ? rawUsername : "root",
                        rawPassword != null ? rawPassword : "");
            }
        }

        if (host == null || host.isBlank()) host = "127.0.0.1";
        if (port == null || port.isBlank()) port = "3307";
        if (user == null || user.isBlank()) user = (rawUsername != null && !rawUsername.isBlank()) ? rawUsername : "root";
        if (pass == null) pass = rawPassword != null ? rawPassword : "";
        if (db == null || db.isBlank()) db = "red404";

        String jdbcUrl = String.format(
                "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=3000&socketTimeout=8000",
                host, port, db
        );
        return new ResolvedConfig(jdbcUrl, user, pass);
    }

    private String sanitizeUrl(String url) {
        if (url == null) return "";
        return url.replaceAll("(?i)(password=)[^&;]*", "$1****");
    }

    private static class ResolvedConfig {
        final String jdbcUrl;
        final String username;
        final String password;

        ResolvedConfig(String jdbcUrl, String username, String password) {
            this.jdbcUrl = jdbcUrl;
            this.username = username;
            this.password = password;
        }
    }
}
