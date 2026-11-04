package com.red404;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class DistanceCalculator {

    // ============================================
    // CONSTANTS (Wahi purane values)
    // ============================================
    private static final double EARTH_RADIUS_KM = 6371.0;

    // RED404 Zone System Constants - LOGIC UNCHANGED
    public static final double ZONE_CRITICAL  =  5.0;   // 0 - 5 km
    public static final double ZONE_HIGH      = 10.0;   // 5 - 10 km
    public static final double ZONE_MEDIUM    = 20.0;   // 10 - 20 km
    public static final double ZONE_LOW       = 50.0;   // 20 - 50 km

    // ============================================
    // HAVERSINE FORMULA (Core Logic)
    // ============================================
    public static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round((EARTH_RADIUS_KM * c) * 100.0) / 100.0; // Round to 2 decimals
    }

    // ============================================
    // ZONE IDENTIFIER (DSA Support)
    // ============================================
    public static String getZone(double lat1, double lon1, double lat2, double lon2) {
        double distance = calculateDistance(lat1, lon1, lat2, lon2);

        if (distance <= ZONE_CRITICAL) return "CRITICAL";
        if (distance <= ZONE_HIGH)     return "HIGH";
        if (distance <= ZONE_MEDIUM)   return "MEDIUM";
        if (distance <= ZONE_LOW)      return "LOW";
        return "OUT_OF_RANGE";
    }

    // ============================================
    // TRAVEL TIME ESTIMATION (Unchanged Logic)
    // ============================================
    public static int getEstimatedTravelTime(double distance, String mode) {
        double speedKmH;
        switch (mode.toUpperCase()) {
            case "WALKING": speedKmH = 5.0;  break;
            case "CYCLING": speedKmH = 15.0; break;
            case "DRIVING": speedKmH = 40.0; break;
            default:        speedKmH = 30.0; break;
        }
        return (int) ((distance / speedKmH) * 60);
    }

    // ============================================
    // BLOOD COMPATIBILITY LOGIC (RED404 Core)
    // ============================================
    public static boolean isCompatibleBloodType(String donorType, String recipientType) {
        if (donorType == null || recipientType == null) return false;
        
        // Universal Donor Logic
        if (donorType.equals("O-")) return true;
        // Universal Recipient Logic
        if (recipientType.equals("AB+")) return true;
        // Identical Match
        if (donorType.equals(recipientType)) return true;

        // Specific Compatibility Map
        Map<String, List<String>> compatibility = new HashMap<>();
        compatibility.put("O+",  Arrays.asList("O+", "A+", "B+", "AB+"));
        compatibility.put("A+",  Arrays.asList("A+", "AB+"));
        compatibility.put("A-",  Arrays.asList("A+", "A-", "AB+", "AB-"));
        compatibility.put("B+",  Arrays.asList("B+", "AB+"));
        compatibility.put("B-",  Arrays.asList("B+", "B-", "AB+", "AB-"));
        compatibility.put("AB-", Arrays.asList("AB+", "AB-"));

        return compatibility.containsKey(donorType) && compatibility.get(donorType).contains(recipientType);
    }
}