package com.red404.controller;

import com.red404.dao.DonorDao;
import com.red404.model.ApiResponse;
import com.red404.service.DonorEligibilityService;
import com.red404.service.PlatformMetricsService;
import com.red404.util.DBConnection;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping({"/api/system", "/api/stats"})
public class SystemController {

    private final DonorDao donorDao = new DonorDao();
    private static final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    @GetMapping({"", "/", "/stats", "/platform-stats"})
    public ResponseEntity<ApiResponse> getStats() {
        try {
            Map<String, Object> stats = PlatformMetricsService.getInstance().getPlatformStats();
            return ResponseEntity.ok(new ApiResponse(true, "Platform stats loaded", stats));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping({"/health", "/ping"})
    public ResponseEntity<ApiResponse> getHealth() {
        Map<String, Object> h = new LinkedHashMap<>();
        h.put("status", "UP");
        h.put("service", "RED404");
        h.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(new ApiResponse(true, "RED404 System Health: UP", h));
    }

    @GetMapping({"/donation-gaps", "/config/donation-gaps"})
    public ResponseEntity<ApiResponse> getDonationGaps() {
        try {
            return ResponseEntity.ok(new ApiResponse(true, "Donation gap configuration loaded", DonorEligibilityService.getDonationGapConfig()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping({"/national-blood-stock", "/blood-stock", "/inventory-overview"})
    public ResponseEntity<ApiResponse> getNationalBloodStock() {
        try {
            Map<String, Object> stock = PlatformMetricsService.getInstance().getPublicNationalBloodStock();
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "public, max-age=10")
                    .body(new ApiResponse(true, "National blood stock loaded", stock));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(new ApiResponse(false, e.getMessage()));
        }
    }

    @GetMapping({"/db-info", "/db-health", "/database"})
    public ResponseEntity<ApiResponse> getDatabaseInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        try (Connection conn = DBConnection.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            String prodName = meta.getDatabaseProductName();
            String prodVersion = meta.getDatabaseProductVersion();
            String rawJdbcUrl = meta.getURL();
            String sanitizedUrl = rawJdbcUrl != null ? rawJdbcUrl.replaceAll("(?i)(password=)[^&;]*", "$1****") : "";

            info.put("status", "CONNECTED");
            info.put("databaseProduct", prodName);
            info.put("databaseVersion", prodVersion);
            info.put("isMySQL", prodName != null && prodName.toLowerCase().contains("mysql"));
            info.put("jdbcUrl", sanitizedUrl);

            Map<String, Object> tableCounts = new LinkedHashMap<>();
            String[] coreTables = {
                "donors", "hospitals", "blood_requests", "donations",
                "intake_snapshots", "user_sessions", "burned_donor_ids",
                "hospital_inventory", "system_meta"
            };

            try (Statement stmt = conn.createStatement()) {
                for (String tbl : coreTables) {
                    try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + tbl)) {
                        if (rs.next()) {
                            tableCounts.put(tbl, rs.getInt(1));
                        }
                    } catch (Exception ex) {
                        tableCounts.put(tbl, "MISSING_OR_UNAVAILABLE: " + ex.getMessage());
                    }
                }
            }
            info.put("tables", tableCounts);
            return ResponseEntity.ok(new ApiResponse(true, "Database diagnostics", info));
        } catch (Exception e) {
            info.put("status", "ERROR");
            info.put("error", e.getMessage());
            return ResponseEntity.internalServerError().body(new ApiResponse(false, "Database connection error: " + e.getMessage(), info));
        }
    }

    @GetMapping(value = {"/national-blood-stock/stream", "/blood-stock/stream"}, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamBloodStock() {
        SseEmitter emitter = new SseEmitter(180_000L); // 3 minutes timeout
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        // Immediately send initial state
        try {
            Map<String, Object> initial = PlatformMetricsService.getInstance().getPublicNationalBloodStock();
            emitter.send(SseEmitter.event().name("stock-update").data(initial));
        } catch (Exception ignored) {}

        return emitter;
    }

    @GetMapping({"/map-config", "/config/map"})
    public ResponseEntity<ApiResponse> getMapConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("tileUrl", com.red404.config.EnvConfig.get("MAP_TILE_URL", "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"));
        cfg.put("attribution", com.red404.config.EnvConfig.get("MAP_TILE_ATTRIBUTION", "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"));
        cfg.put("maxZoom", com.red404.config.EnvConfig.getAsInt("MAP_TILE_MAXZOOM", 19));
        cfg.put("subdomains", com.red404.config.EnvConfig.get("MAP_TILE_SUBDOMAINS", "abc"));
        String satUrl = com.red404.config.EnvConfig.get("MAP_SATELLITE_URL");
        cfg.put("satelliteUrl", (satUrl != null && !satUrl.isBlank()) ? satUrl.trim() : null);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "public, max-age=60")
                .body(new ApiResponse(true, "Map configuration loaded", cfg));
    }

    public static void broadcastStockUpdate(Map<String, Object> stockData) {
        PlatformMetricsService.getInstance().invalidateCache();
        Map<String, Object> payload = stockData != null ? stockData : PlatformMetricsService.getInstance().getPublicNationalBloodStock();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("stock-update").data(payload));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }
}

