package com.red404.service;

import com.red404.util.DBConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

/**
 * Single source of truth for platform numbers across RED404:
 * - Home page stats & public national blood stock
 * - Donor pages & dashboard metrics
 * - Admin panel health & metrics
 *
 * Enforces:
 * 1. Only Verified hospitals contribute to public stock & partner hospital counts.
 * 2. Privacy gating: Public stock appears ONLY when >= MIN_HOSPITALS_FOR_PUBLIC_STOCK (default 2) verified hospitals exist.
 * 3. Real requests data gating: Avg. response and % success rate appear ONLY when >= MIN_COMPLETED_REQUESTS (default 5).
 * 4. Active donors: Only non-paused active donors.
 * 5. Caching for at most 60 seconds.
 */
public class PlatformMetricsService {

    private static final Logger log = LoggerFactory.getLogger(PlatformMetricsService.class);
    private static final PlatformMetricsService INSTANCE = new PlatformMetricsService();

    public static PlatformMetricsService getInstance() {
        return INSTANCE;
    }

    public static final int DEFAULT_MIN_HOSPITALS_FOR_PUBLIC_STOCK = 2;
    public static final int DEFAULT_MIN_COMPLETED_REQUESTS_FOR_METRICS = 5;
    private static final long CACHE_TTL_MS = 60_000L; // 60s cache

    private final Object lock = new Object();
    private volatile Map<String, Object> cachedStats = null;
    private volatile long statsCachedAt = 0L;

    private volatile Map<String, Object> cachedStock = null;
    private volatile long stockCachedAt = 0L;

    public int getMinHospitalsForPublicStock() {
        String prop = System.getProperty("MIN_HOSPITALS_FOR_PUBLIC_STOCK");
        if (prop == null || prop.isBlank()) prop = System.getenv("MIN_HOSPITALS_FOR_PUBLIC_STOCK");
        if (prop != null && !prop.isBlank()) {
            try { return Integer.parseInt(prop.trim()); } catch (Exception ignored) {}
        }
        return DEFAULT_MIN_HOSPITALS_FOR_PUBLIC_STOCK;
    }

    public int getMinCompletedRequestsForMetrics() {
        String prop = System.getProperty("MIN_COMPLETED_REQUESTS_FOR_METRICS");
        if (prop == null || prop.isBlank()) prop = System.getenv("MIN_COMPLETED_REQUESTS_FOR_METRICS");
        if (prop != null && !prop.isBlank()) {
            try { return Integer.parseInt(prop.trim()); } catch (Exception ignored) {}
        }
        return DEFAULT_MIN_COMPLETED_REQUESTS_FOR_METRICS;
    }

    public void invalidateCache() {
        synchronized (lock) {
            statsCachedAt = 0L;
            stockCachedAt = 0L;
            cachedStats = null;
            cachedStock = null;
        }
    }

    /**
     * Authoritative platform stats (Home, Donor dashboard, Admin Health)
     */
    public Map<String, Object> getPlatformStats() {
        long now = System.currentTimeMillis();
        Map<String, Object> existing = cachedStats;
        if (existing != null && (now - statsCachedAt) < CACHE_TTL_MS) {
            return new LinkedHashMap<>(existing);
        }

        synchronized (lock) {
            now = System.currentTimeMillis();
            if (cachedStats != null && (now - statsCachedAt) < CACHE_TTL_MS) {
                return new LinkedHashMap<>(cachedStats);
            }

            Map<String, Object> stats = computeFreshPlatformStats();
            cachedStats = stats;
            statsCachedAt = now;
            return new LinkedHashMap<>(stats);
        }
    }

    private Map<String, Object> computeFreshPlatformStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        int totalDonors = 0;
        int activeDonors = 0;
        int partnerHospitals = 0;
        int totalHospitals = 0;
        int verifiedDonations = 0;
        int livesSaved = 0;
        int totalRequests = 0;
        int completedRequests = 0;
        Integer avgResponseMin = null;
        Integer successRate = null;
        int activeZones = 0;

        int minHospitalsForStock = getMinHospitalsForPublicStock();
        int minCompletedRequests = getMinCompletedRequestsForMetrics();

        try (Connection conn = DBConnection.getConnection()) {
            // 1. Registered Donors & Active (non-paused) Donors
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT COUNT(*), " +
                         "SUM(CASE WHEN (availability IS NULL OR (LOWER(availability) <> 'unavailable' AND LOWER(availability) <> 'paused')) " +
                         "AND (paused_until IS NULL OR paused_until <= CURRENT_DATE) THEN 1 ELSE 0 END) " +
                         "FROM donors")) {
                if (rs.next()) {
                    totalDonors = rs.getInt(1);
                    activeDonors = rs.getInt(2);
                }
            } catch (Exception e) {
                // Fallback if paused_until column not yet present
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT COUNT(*), " +
                             "SUM(CASE WHEN availability IS NULL OR LOWER(availability) <> 'unavailable' THEN 1 ELSE 0 END) " +
                             "FROM donors")) {
                    if (rs.next()) {
                        totalDonors = rs.getInt(1);
                        activeDonors = rs.getInt(2);
                    }
                } catch (Exception ignored) {}
            }

            // 2. Partner Hospitals (strictly VERIFIED and not soft-deleted)
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT " +
                         "SUM(CASE WHEN LOWER(COALESCE(verification_status, '')) = 'verified' AND deleted_at IS NULL THEN 1 ELSE 0 END), " +
                         "SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) " +
                         "FROM hospitals")) {
                if (rs.next()) {
                    partnerHospitals = rs.getInt(1);
                    totalHospitals = rs.getInt(2);
                }
            } catch (Exception e) {
                // Fallback if deleted_at not yet present
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT " +
                             "SUM(CASE WHEN LOWER(COALESCE(verification_status, '')) = 'verified' THEN 1 ELSE 0 END), " +
                             "COUNT(*) " +
                             "FROM hospitals")) {
                    if (rs.next()) {
                        partnerHospitals = rs.getInt(1);
                        totalHospitals = rs.getInt(2);
                    }
                } catch (Exception ignored) {}
            }

            // 3. Verified Donations & Lives Saved
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT COUNT(*) FROM donations WHERE status IN ('Fulfilled', 'VERIFIED_INTAKE', 'Approved', 'Completed', 'COMPLETED')")) {
                if (rs.next()) {
                    verifiedDonations = rs.getInt(1);
                    livesSaved = verifiedDonations;
                }
            } catch (Exception ignored) {}

            // 4. Blood Requests & Completed Requests
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT COUNT(*), " +
                         "SUM(CASE WHEN status IN ('Fulfilled', 'Completed', 'COMPLETED') THEN 1 ELSE 0 END) " +
                         "FROM blood_requests")) {
                if (rs.next()) {
                    totalRequests = rs.getInt(1);
                    completedRequests = rs.getInt(2);
                }
            } catch (Exception ignored) {}

            // 5. Avg. Response Time (only if >= minCompletedRequests)
            if (completedRequests >= minCompletedRequests) {
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT AVG(response_time) FROM donations WHERE response_time IS NOT NULL AND response_time > 0")) {
                    if (rs.next() && rs.getObject(1) != null) {
                        avgResponseMin = Math.max(1, (int) Math.round(rs.getDouble(1)));
                    }
                } catch (Exception ignored) {}
            }

            // 6. Success Rate (only if >= minCompletedRequests)
            if (totalRequests >= minCompletedRequests && totalRequests > 0) {
                successRate = (int) Math.round(((double) completedRequests / totalRequests) * 100.0);
            }

            // 7. Active Zones (distinct donor zones + verified hospital districts)
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT COUNT(DISTINCT zone) FROM (" +
                         "SELECT zone FROM donors WHERE zone IS NOT NULL AND zone <> '' " +
                         "UNION " +
                         "SELECT district FROM hospitals WHERE LOWER(COALESCE(verification_status, '')) = 'verified' " +
                         "AND district IS NOT NULL AND district <> '') AS t")) {
                if (rs.next()) {
                    activeZones = rs.getInt(1);
                }
            } catch (Exception ignored) {}

            if (activeZones == 0 && (totalDonors > 0 || partnerHospitals > 0)) {
                activeZones = 1;
            }

        } catch (Exception e) {
            log.error("Error computing platform metrics: {}", e.getMessage());
        }

        stats.put("registeredDonors", totalDonors);
        stats.put("activeDonors", activeDonors);
        stats.put("partnerHospitals", partnerHospitals);
        stats.put("hospitals", partnerHospitals);
        stats.put("totalHospitals", totalHospitals);
        stats.put("verifiedDonations", verifiedDonations);
        stats.put("livesSaved", livesSaved);
        stats.put("totalRequests", totalRequests);
        stats.put("completedRequests", completedRequests);
        stats.put("hasRequestMetrics", completedRequests >= minCompletedRequests);
        stats.put("avgResponseMin", avgResponseMin);
        stats.put("successRate", successRate);
        stats.put("activeZones", activeZones);
        stats.put("minHospitalsForPublicStock", minHospitalsForStock);
        stats.put("hasSufficientHospitalsForPublicStock", partnerHospitals >= minHospitalsForStock);
        stats.put("cachedAt", System.currentTimeMillis());

        return stats;
    }

    /**
     * Authoritative Public National Blood Stock.
     * Enforces:
     * - Only VERIFIED hospitals' inventory contributes.
     * - Aggregated totals across hospitals only (never per-hospital).
     * - Gated by MIN_HOSPITALS_FOR_PUBLIC_STOCK (default 2).
     */
    public Map<String, Object> getPublicNationalBloodStock() {
        long now = System.currentTimeMillis();
        Map<String, Object> existing = cachedStock;
        if (existing != null && (now - stockCachedAt) < CACHE_TTL_MS) {
            return new LinkedHashMap<>(existing);
        }

        synchronized (lock) {
            now = System.currentTimeMillis();
            if (cachedStock != null && (now - stockCachedAt) < CACHE_TTL_MS) {
                return new LinkedHashMap<>(cachedStock);
            }

            Map<String, Object> stock = computeFreshNationalBloodStock();
            cachedStock = stock;
            stockCachedAt = now;
            return new LinkedHashMap<>(stock);
        }
    }

    private Map<String, Object> computeFreshNationalBloodStock() {
        String[] standardGroups = {"A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"};
        Map<String, Integer> unitsMap = new LinkedHashMap<>();
        Map<String, Integer> donorsMap = new LinkedHashMap<>();

        for (String g : standardGroups) {
            unitsMap.put(g, 0);
            donorsMap.put(g, 0);
        }

        int verifiedHospitals = 0;
        int minHospitalsForStock = getMinHospitalsForPublicStock();

        try (Connection conn = DBConnection.getConnection()) {
            // Check count of verified partner hospitals
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT COUNT(*) FROM hospitals " +
                         "WHERE LOWER(COALESCE(verification_status, '')) = 'verified' " +
                         "AND (deleted_at IS NULL)")) {
                if (rs.next()) {
                    verifiedHospitals = rs.getInt(1);
                }
            } catch (Exception e) {
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT COUNT(*) FROM hospitals WHERE LOWER(COALESCE(verification_status, '')) = 'verified'")) {
                    if (rs.next()) verifiedHospitals = rs.getInt(1);
                } catch (Exception ignored) {}
            }

            // Gating Rule: Privacy requirement - only show live stock if >= MIN_HOSPITALS_FOR_PUBLIC_STOCK verified hospitals exist
            if (verifiedHospitals < minHospitalsForStock) {
                Map<String, Object> gated = new LinkedHashMap<>();
                gated.put("available", false);
                gated.put("hasSufficientHospitals", false);
                gated.put("message", "Live stock appears here once more hospitals join.");
                gated.put("verifiedHospitals", verifiedHospitals);
                gated.put("minHospitalsRequired", minHospitalsForStock);
                gated.put("totalUnits", 0);
                gated.put("totalActiveDonors", 0);
                gated.put("data", Collections.emptyMap());
                return gated;
            }

            // 1. Aggregated Live Inventory from VERIFIED partner hospitals only
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT hi.blood_type, SUM(hi.units) " +
                         "FROM hospital_inventory hi " +
                         "JOIN hospitals h ON hi.hospital_id = h.id " +
                         "WHERE LOWER(COALESCE(h.verification_status, '')) = 'verified' " +
                         "AND (h.deleted_at IS NULL) " +
                         "GROUP BY hi.blood_type")) {
                while (rs.next()) {
                    String bt = rs.getString(1);
                    int u = rs.getInt(2);
                    if (bt != null) {
                        String clean = bt.trim().toUpperCase();
                        if (unitsMap.containsKey(clean)) {
                            unitsMap.put(clean, Math.max(0, u));
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Notice querying verified hospital inventory: {}", e.getMessage());
            }

            // 2. Real Active (non-paused) Donors by blood group
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery(
                         "SELECT blood_type, COUNT(*) FROM donors " +
                         "WHERE (availability IS NULL OR (LOWER(availability) <> 'unavailable' AND LOWER(availability) <> 'paused')) " +
                         "AND (paused_until IS NULL OR paused_until <= CURRENT_DATE) " +
                         "GROUP BY blood_type")) {
                while (rs.next()) {
                    String bg = rs.getString(1);
                    int cnt = rs.getInt(2);
                    if (bg != null) {
                        String clean = bg.trim().toUpperCase();
                        if (donorsMap.containsKey(clean)) {
                            donorsMap.put(clean, cnt);
                        }
                    }
                }
            } catch (Exception e) {
                // Fallback if paused_until not yet present
                try (Statement st = conn.createStatement();
                     ResultSet rs = st.executeQuery(
                             "SELECT blood_type, COUNT(*) FROM donors " +
                             "WHERE availability IS NULL OR LOWER(availability) <> 'unavailable' " +
                             "GROUP BY blood_type")) {
                    while (rs.next()) {
                        String bg = rs.getString(1);
                        int cnt = rs.getInt(2);
                        if (bg != null) {
                            String clean = bg.trim().toUpperCase();
                            if (donorsMap.containsKey(clean)) {
                                donorsMap.put(clean, cnt);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }

        } catch (Exception e) {
            log.error("Error computing national blood stock: {}", e.getMessage());
        }

        Map<String, Object> response = new LinkedHashMap<>();
        int totalUnits = 0;
        int totalDonors = 0;
        Map<String, Object> dataMap = new LinkedHashMap<>();

        for (String g : standardGroups) {
            int u = unitsMap.get(g);
            int d = donorsMap.get(g);
            totalUnits += u;
            totalDonors += d;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("units", u);
            item.put("totalUnits", u);
            item.put("activeDonors", d);
            item.put("donors", d);
            item.put("hasDonors", d > 0);
            dataMap.put(g, item);
        }

        response.put("available", true);
        response.put("hasSufficientHospitals", true);
        response.put("verifiedHospitals", verifiedHospitals);
        response.put("minHospitalsRequired", minHospitalsForStock);
        response.put("totalUnits", totalUnits);
        response.put("totalDonors", totalDonors);
        response.put("totalActiveDonors", totalDonors);
        response.put("data", dataMap);
        response.put("cachedAt", System.currentTimeMillis());

        return response;
    }
}
