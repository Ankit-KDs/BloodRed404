package com.red404.dao;

import com.red404.util.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class BloodGroupAuditDao {

    public boolean insertAudit(int donorId, String oldGroup, String newGroup, String changedByRole, Integer changedById, String reason) {
        String sql = "INSERT INTO donor_blood_group_audits (donor_id, old_group, new_group, changed_by_role, changed_by_id, reason) " +
                     "VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            ps.setString(2, oldGroup);
            ps.setString(3, newGroup);
            ps.setString(4, changedByRole);
            if (changedById != null && changedById > 0) {
                ps.setInt(5, changedById);
            } else {
                ps.setNull(5, java.sql.Types.INTEGER);
            }
            ps.setString(6, reason);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Failed to insert blood group audit: " + e.getMessage());
            return false;
        }
    }

    public List<Map<String, Object>> listByDonor(int donorId) {
        String sql = "SELECT * FROM donor_blood_group_audits WHERE donor_id = ? ORDER BY created_at DESC";
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, donorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getInt("id"));
                    map.put("donorId", rs.getInt("donor_id"));
                    map.put("oldGroup", rs.getString("old_group"));
                    map.put("newGroup", rs.getString("new_group"));
                    map.put("changedByRole", rs.getString("changed_by_role"));
                    map.put("changedById", rs.getObject("changed_by_id"));
                    map.put("reason", rs.getString("reason"));
                    map.put("createdAt", rs.getTimestamp("created_at"));
                    list.add(map);
                }
            }
        } catch (SQLException e) {
            System.err.println("Failed to fetch blood group audits: " + e.getMessage());
        }
        return list;
    }
}
