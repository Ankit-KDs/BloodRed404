package com.red404.service;

import com.red404.controller.SystemController;
import com.red404.util.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class StockService {

    public static final String[] ALL_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"};

    // Shared threshold configuration (O+/O-: crit 4 / low 8, A/B: crit 3 / low 5, AB: crit 2 / low 4)
    public static final Map<String, int[]> THRESHOLDS;
    static {
        Map<String, int[]> map = new LinkedHashMap<>();
        map.put("O-",  new int[]{4, 8});
        map.put("O+",  new int[]{4, 8});
        map.put("A-",  new int[]{3, 5});
        map.put("A+",  new int[]{3, 5});
        map.put("B-",  new int[]{3, 5});
        map.put("B+",  new int[]{3, 5});
        map.put("AB-", new int[]{2, 4});
        map.put("AB+", new int[]{2, 4});
        THRESHOLDS = Collections.unmodifiableMap(map);
    }

    private static volatile boolean tablesEnsured = false;

    public static void ensureLedgerTable() {
        if (tablesEnsured) return;
        synchronized (StockService.class) {
            if (tablesEnsured) return;
            try (Connection conn = DBConnection.getConnection();
                 Statement st = conn.createStatement()) {
                String sql = "CREATE TABLE IF NOT EXISTS inventory_ledger (" +
                        "id INT AUTO_INCREMENT PRIMARY KEY, " +
                        "hospital_id INT NOT NULL, " +
                        "blood_type VARCHAR(10) NOT NULL, " +
                        "delta INT NOT NULL, " +
                        "units_after INT NOT NULL, " +
                        "reason VARCHAR(255) NULL, " +
                        "staff_id VARCHAR(100) NULL, " +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                        ")";
                st.executeUpdate(sql);
                tablesEnsured = true;
            } catch (Exception ignored) {}
        }
    }

    public static String normalizeGroup(String raw) {
        if (raw == null) return "A+";
        String s = raw.trim().toUpperCase().replace(" ", "");
        s = s.replace("POSITIVE", "+").replace("NEGATIVE", "-")
             .replace("POS", "+").replace("NEG", "-");
        for (String bg : ALL_BLOOD_GROUPS) {
            if (bg.equalsIgnoreCase(s)) return bg;
        }
        return s;
    }

    public static Map<String, String> getStockStatus(String bloodType, int units) {
        String clean = normalizeGroup(bloodType);
        int[] th = THRESHOLDS.getOrDefault(clean, new int[]{3, 5});
        Map<String, String> res = new LinkedHashMap<>();
        if (units <= th[0]) {
            res.put("state", "critical");
            res.put("label", "Critical");
        } else if (units <= th[1]) {
            res.put("state", "low");
            res.put("label", "Low");
        } else {
            res.put("state", "ok");
            res.put("label", "OK");
        }
        return res;
    }

    public static Map<String, Object> getHospitalStock(int hospitalId) throws SQLException {
        ensureLedgerTable();
        Map<String, Integer> inventory = new LinkedHashMap<>();
        for (String g : ALL_BLOOD_GROUPS) {
            inventory.put(g, 0);
        }

        long latestUpdated = 0L;
        String sql = "SELECT blood_type, units, updated_at FROM hospital_inventory WHERE hospital_id = ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String bt = rs.getString("blood_type");
                    int u = rs.getInt("units");
                    Timestamp ts = rs.getTimestamp("updated_at");
                    if (ts != null && ts.getTime() > latestUpdated) {
                        latestUpdated = ts.getTime();
                    }
                    if (bt != null) {
                        String clean = normalizeGroup(bt);
                        inventory.put(clean, Math.max(0, u));
                    }
                }
            }
        }

        if (latestUpdated == 0L) {
            // Check hospital updated_at or created_at
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement("SELECT updated_at, created_at FROM hospitals WHERE id = ?")) {
                ps.setInt(1, hospitalId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        Timestamp u = rs.getTimestamp("updated_at");
                        Timestamp c = rs.getTimestamp("created_at");
                        if (u != null) latestUpdated = u.getTime();
                        else if (c != null) latestUpdated = c.getTime();
                    }
                }
            } catch (Exception ignored) {}
        }
        if (latestUpdated == 0L) latestUpdated = System.currentTimeMillis();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hospitalId", hospitalId);
        result.put("inventory", inventory);
        // Also place all 8 groups directly at top-level for seamless backward-compatibility
        for (Map.Entry<String, Integer> e : inventory.entrySet()) {
            result.put(e.getKey(), e.getValue());
        }
        result.put("updatedAt", latestUpdated);
        result.put("updatedAgo", formatRelativeTime(latestUpdated));
        return result;
    }

    public static synchronized Map<String, Object> setExactStock(
            int hospitalId,
            String group,
            int exactUnits,
            String reason,
            String staffId) throws SQLException {
        if (exactUnits < 0) {
            throw new IllegalArgumentException("Cannot set inventory below zero (requested: " + exactUnits + " units)");
        }
        String cleanGroup = normalizeGroup(group);
        Map<String, Object> currentStock = getHospitalStock(hospitalId);
        @SuppressWarnings("unchecked")
        Map<String, Integer> inv = (Map<String, Integer>) currentStock.get("inventory");
        int currentUnits = inv != null ? inv.getOrDefault(cleanGroup, 0) : 0;
        int delta = exactUnits - currentUnits;
        String finalReason = (reason != null && !reason.isBlank()) ? reason : ("Set exact inventory to " + exactUnits);
        return adjustStock(hospitalId, cleanGroup, delta, finalReason, staffId);
    }

    public static synchronized Map<String, Object> adjustStock(
            int hospitalId,
            String group,
            int delta,
            String reason,
            String staffId) throws SQLException {

        ensureLedgerTable();
        String cleanGroup = normalizeGroup(group);

        try (Connection conn = DBConnection.getConnection()) {
            boolean origAuto = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                int currentUnits = 0;
                boolean exists = false;
                String selectSql = "SELECT units FROM hospital_inventory WHERE hospital_id = ? AND blood_type = ? FOR UPDATE";
                try (PreparedStatement ps = conn.prepareStatement(selectSql)) {
                    ps.setInt(1, hospitalId);
                    ps.setString(2, cleanGroup);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            exists = true;
                            currentUnits = Math.max(0, rs.getInt("units"));
                        }
                    }
                }

                int newUnits = currentUnits + delta;
                if (newUnits < 0) {
                    conn.rollback();
                    throw new IllegalArgumentException("Cannot reduce stock below zero (current: " + currentUnits + " units, change: " + delta + ")");
                }

                if (exists) {
                    String updateSql = "UPDATE hospital_inventory SET units = ?, updated_at = CURRENT_TIMESTAMP WHERE hospital_id = ? AND blood_type = ?";
                    try (PreparedStatement ps = conn.prepareStatement(updateSql)) {
                        ps.setInt(1, newUnits);
                        ps.setInt(2, hospitalId);
                        ps.setString(3, cleanGroup);
                        ps.executeUpdate();
                    }
                } else {
                    String insertSql = "INSERT INTO hospital_inventory (hospital_id, blood_type, units, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)";
                    try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                        ps.setInt(1, hospitalId);
                        ps.setString(2, cleanGroup);
                        ps.setInt(3, newUnits);
                        ps.executeUpdate();
                    }
                }

                // Insert ledger record
                String ledgerSql = "INSERT INTO inventory_ledger (hospital_id, blood_type, delta, units_after, reason, staff_id, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
                try (PreparedStatement ps = conn.prepareStatement(ledgerSql)) {
                    ps.setInt(1, hospitalId);
                    ps.setString(2, cleanGroup);
                    ps.setInt(3, delta);
                    ps.setInt(4, newUnits);
                    ps.setString(5, reason != null && !reason.isBlank() ? reason : "Manual inventory adjustment");
                    ps.setString(6, staffId != null && !staffId.isBlank() ? staffId : "Hospital Staff");
                    ps.executeUpdate();
                }

                conn.commit();
                conn.setAutoCommit(origAuto);
            } catch (Exception ex) {
                try { conn.rollback(); } catch (Exception ignored) {}
                try { conn.setAutoCommit(origAuto); } catch (Exception ignored) {}
                if (ex instanceof IllegalArgumentException iae) {
                    throw iae;
                }
                if (ex instanceof SQLException se) {
                    throw se;
                }
                throw new SQLException("Failed to adjust stock: " + ex.getMessage(), ex);
            }
        }

        // Fire cache invalidation & realtime push
        PlatformMetricsService.getInstance().invalidateCache();
        PublicSearchService.clearCache();
        SystemController.broadcastStockUpdate(null);

        Map<String, Object> fresh = getHospitalStock(hospitalId);
        fresh.put("adjustedGroup", cleanGroup);
        fresh.put("delta", delta);
        fresh.put("units", ((Map<?, ?>) fresh.get("inventory")).get(cleanGroup));
        fresh.put("event", "stock.updated");
        return fresh;
    }

    public static List<Map<String, Object>> getRecentLedger(int hospitalId, int limit) {
        ensureLedgerTable();
        List<Map<String, Object>> list = new ArrayList<>();
        String sql = "SELECT id, blood_type, delta, units_after, reason, staff_id, created_at " +
                     "FROM inventory_ledger WHERE hospital_id = ? ORDER BY id DESC LIMIT ?";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, hospitalId);
            ps.setInt(2, Math.max(1, limit));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getInt("id"));
                    row.put("bloodType", rs.getString("blood_type"));
                    row.put("delta", rs.getInt("delta"));
                    row.put("unitsAfter", rs.getInt("units_after"));
                    row.put("reason", rs.getString("reason"));
                    row.put("staffId", rs.getString("staff_id"));
                    Timestamp ts = rs.getTimestamp("created_at");
                    row.put("createdAt", ts != null ? ts.toString() : null);
                    row.put("createdAgo", ts != null ? formatRelativeTime(ts.getTime()) : "Just now");
                    list.add(row);
                }
            }
        } catch (Exception ignored) {}
        return list;
    }

    public static String formatRelativeTime(long timestamp) {
        if (timestamp <= 0) return "Just now";
        long diff = System.currentTimeMillis() - timestamp;
        if (diff < 5000L) return "Just now";
        long sec = diff / 1000L;
        if (sec < 60L) return sec + "s ago";
        long min = sec / 60L;
        if (min < 60L) return min + "m ago";
        long hours = min / 60L;
        if (hours < 24L) return hours + "h ago";
        long days = hours / 24L;
        return days + "d ago";
    }
}
