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
import java.net.URI;
import java.sql.Connection;

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
            try {
                log.info("Attempting connection to primary MySQL database: {}", sanitizeUrl(cfg.jdbcUrl));
                HikariConfig config = new HikariConfig();
                config.setJdbcUrl(cfg.jdbcUrl);
                config.setUsername(cfg.username);
                config.setPassword(cfg.password);
                config.setDriverClassName("com.mysql.cj.jdbc.Driver");
                config.setMaximumPoolSize(10);
                config.setMinimumIdle(2);
                config.setConnectionTimeout(4000);
                config.setInitializationFailTimeout(1);

                HikariDataSource ds = new HikariDataSource(config);
                try (Connection conn = ds.getConnection()) {
                    log.info("Successfully connected to MySQL database!");
                    runInitScript(ds);
                    return ds;
                } catch (Exception connEx) {
                    ds.close();
                    throw connEx;
                }
            } catch (Throwable t) {
                log.warn("Could not connect to primary MySQL database: {}. Activating embedded H2 fallback database...", t.getMessage());
            }
        }

        // 2. Fallback to embedded in-memory H2 database with MySQL compatibility mode
        try {
            log.info("Starting embedded H2 database (MySQL compatibility mode)...");
            HikariConfig h2Config = new HikariConfig();
            h2Config.setJdbcUrl("jdbc:h2:mem:red404;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDER=HIGH;DB_CLOSE_DELAY=-1");
            h2Config.setUsername("sa");
            h2Config.setPassword("");
            h2Config.setDriverClassName("org.h2.Driver");

            HikariDataSource h2Ds = new HikariDataSource(h2Config);
            runInitScript(h2Ds);
            log.info("H2 fallback database initialized successfully! Web service is ready.");
            return h2Ds;
        } catch (Exception ex) {
            log.error("Failed to initialize fallback database: {}", ex.getMessage(), ex);
            throw new RuntimeException("Database initialization error", ex);
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

    private ResolvedConfig resolveMySQLConfig() {
        String envUrl = System.getenv("MYSQL_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = System.getenv("MYSQL_PRIVATE_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = System.getenv("DATABASE_URL");
        if (envUrl == null || envUrl.isBlank()) envUrl = rawUrl;

        String host = System.getenv("MYSQLHOST");
        String port = System.getenv("MYSQLPORT");
        String user = System.getenv("MYSQLUSER");
        String pass = System.getenv("MYSQLPASSWORD");
        String db = System.getenv("MYSQLDATABASE");

        if (envUrl != null && !envUrl.isBlank()) {
            if (envUrl.startsWith("mysql://") || envUrl.startsWith("jdbc:mysql://")) {
                try {
                    String clean = envUrl.startsWith("jdbc:") ? envUrl.substring(5) : envUrl;
                    URI uri = new URI(clean);
                    if (uri.getHost() != null && !uri.getHost().isBlank()) {
                        host = uri.getHost();
                    }
                    if (uri.getPort() > 0) {
                        port = String.valueOf(uri.getPort());
                    }
                    if (uri.getUserInfo() != null) {
                        String[] parts = uri.getUserInfo().split(":", 2);
                        if (parts.length > 0 && !parts[0].isEmpty()) user = parts[0];
                        if (parts.length > 1) pass = parts[1];
                    }
                    if (uri.getPath() != null && uri.getPath().length() > 1) {
                        db = uri.getPath().substring(1);
                    }
                } catch (Exception e) {
                    log.debug("Notice parsing env URL: {}", e.getMessage());
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
                "jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&connectTimeout=3000&socketTimeout=3000",
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
