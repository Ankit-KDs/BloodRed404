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
import java.sql.Connection;

@Configuration
public class DynamicDataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DynamicDataSourceConfig.class);

    @Value("${spring.datasource.url}")
    private String rawUrl;

    @Value("${spring.datasource.username:root}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Bean
    @Primary
    public DataSource dataSource() {
        String url = rawUrl;
        if (url != null && url.startsWith("mysql://")) {
            url = "jdbc:" + url;
        }

        // 1. Try primary MySQL DataSource
        try {
            log.info("Attempting connection to primary database: {}", url);
            HikariConfig config = new HikariConfig();
            config.setJdbcUrl(url);
            config.setUsername(username);
            config.setPassword(password);
            config.setDriverClassName("com.mysql.cj.jdbc.Driver");
            config.setMaximumPoolSize(10);
            config.setMinimumIdle(2);
            config.setConnectionTimeout(3000);
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
            log.warn("Could not connect to primary database ({}). Activating embedded H2 fallback database...", t.getMessage());
        }

        // 2. Fallback to embedded in-memory H2 database with MySQL compatibility mode
        try {
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
        } catch (Exception e) {
            log.warn("Notice during schema.sql initialization: {}", e.getMessage());
        }
    }
}
