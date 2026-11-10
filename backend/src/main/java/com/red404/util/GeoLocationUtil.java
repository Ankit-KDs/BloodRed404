package com.red404.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves client IP address and geographic location (City, Country).
 */
public class GeoLocationUtil {

    private static final Map<String, String> GEO_CACHE = new ConcurrentHashMap<>();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static String getClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.split(",")[0].trim();
        }
        ip = request.getHeader("X-Real-IP");
        if (ip != null && !ip.isBlank() && !"unknown".equalsIgnoreCase(ip)) {
            return ip.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }

    public static String resolveLocation(String ip) {
        if (ip == null || ip.isBlank() || isLocalIp(ip)) {
            return "New Delhi, India (Local Node)";
        }

        if (GEO_CACHE.containsKey(ip)) {
            return GEO_CACHE.get(ip);
        }

        String location = "India";
        try {
            URI uri = URI.create("http://ip-api.com/json/" + ip + "?fields=status,city,country");
            URL url = uri.toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(1200);
            conn.setReadTimeout(1200);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "RED404-Network");

            if (conn.getResponseCode() == 200) {
                try (InputStream is = conn.getInputStream()) {
                    JsonNode root = MAPPER.readTree(is);
                    if ("success".equalsIgnoreCase(root.path("status").asText())) {
                        String city = root.path("city").asText("");
                        String country = root.path("country").asText("");
                        if (!city.isBlank() && !country.isBlank()) {
                            location = city + ", " + country;
                        } else if (!country.isBlank()) {
                            location = country;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            location = "India";
        }

        GEO_CACHE.put(ip, location);
        return location;
    }

    private static boolean isLocalIp(String ip) {
        String clean = ip.trim();
        return clean.equals("127.0.0.1") ||
                clean.equals("::1") ||
                clean.equals("0:0:0:0:0:0:0:1") ||
                clean.startsWith("10.") ||
                clean.startsWith("192.168.") ||
                clean.startsWith("172.16.") ||
                clean.startsWith("172.17.") ||
                clean.startsWith("172.18.") ||
                clean.startsWith("172.19.") ||
                clean.startsWith("172.2") ||
                clean.startsWith("172.30.") ||
                clean.startsWith("172.31.");
    }
}
