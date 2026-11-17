package com.red404.controller;

import com.red404.config.EnvConfig;
import com.red404.model.ApiResponse;
import com.red404.util.DBConnection;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HealthController
 *
 * Part 8: Production readiness health-check endpoint.
 * Monitored by container health-checks, load balancers, and external status uptime monitors.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private static final long START_TIME = System.currentTimeMillis();

    @Autowired(required = false)
    private DataSource dataSource;

    @GetMapping
    public ResponseEntity<ApiResponse> getHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("uptimeSeconds", (System.currentTimeMillis() - START_TIME) / 1000);
        health.put("jvmUptimeMs", ManagementFactory.getRuntimeMXBean().getUptime());
        health.put("environment", EnvConfig.isProduction() ? "production" : "development");

        // Database Connectivity & Pool Check
        Map<String, Object> dbHealth = new LinkedHashMap<>();
        boolean dbOk = false;
        try (Connection conn = DBConnection.getConnection();
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery("SELECT 1")) {
            if (rs.next()) {
                dbOk = true;
                dbHealth.put("connected", true);
                dbHealth.put("databaseProduct", conn.getMetaData().getDatabaseProductName());
                dbHealth.put("databaseVersion", conn.getMetaData().getDatabaseProductVersion());
            }
        } catch (Exception e) {
            dbHealth.put("connected", false);
            dbHealth.put("error", e.getMessage());
        }

        if (dataSource instanceof HikariDataSource hikari) {
            Map<String, Object> pool = new LinkedHashMap<>();
            pool.put("activeConnections", hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getActiveConnections() : 0);
            pool.put("idleConnections", hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getIdleConnections() : 0);
            pool.put("totalConnections", hikari.getHikariPoolMXBean() != null ? hikari.getHikariPoolMXBean().getTotalConnections() : 0);
            pool.put("maxPoolSize", hikari.getMaximumPoolSize());
            dbHealth.put("connectionPool", pool);
        }
        health.put("database", dbHealth);

        // Memory Metrics
        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long maxMemory = runtime.maxMemory();
        long usedMemory = totalMemory - freeMemory;

        Map<String, Object> mem = new LinkedHashMap<>();
        mem.put("usedMB", usedMemory / (1024 * 1024));
        mem.put("freeMB", freeMemory / (1024 * 1024));
        mem.put("totalMB", totalMemory / (1024 * 1024));
        mem.put("maxMB", maxMemory / (1024 * 1024));
        health.put("memory", mem);

        // Rate Limiter / Cache Backend Mode
        String redisHost = EnvConfig.get("REDIS_HOST");
        String redisUrl = EnvConfig.get("REDIS_URL");
        boolean hasRedis = (redisHost != null && !redisHost.isBlank()) || (redisUrl != null && !redisUrl.isBlank());
        health.put("rateLimiterBackend", hasRedis ? "Redis (Distributed)" : "ConcurrentHashMap (In-Memory Sliding Window)");

        if (!dbOk) {
            health.put("status", "DEGRADED");
            return ResponseEntity.status(503).body(new ApiResponse(false, "Service degraded: Database connectivity check failed", health));
        }

        return ResponseEntity.ok(new ApiResponse(true, "RED404 Service Healthy", health));
    }
}
