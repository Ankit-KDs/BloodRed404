package com.red404.util;

/**
 * Parses user-agent header to extract user-friendly device and browser descriptions.
 */
public class UserAgentUtil {

    public static String parseDevice(String ua) {
        if (ua == null || ua.isBlank()) {
            return "Desktop Device";
        }
        String lower = ua.toLowerCase();

        if (lower.contains("iphone")) {
            return "Apple iPhone";
        }
        if (lower.contains("ipad")) {
            return "Apple iPad";
        }
        if (lower.contains("android")) {
            return lower.contains("mobile") ? "Android Phone" : "Android Tablet";
        }
        if (lower.contains("windows nt 10.0")) {
            return "Windows 11 / 10 PC";
        }
        if (lower.contains("windows nt")) {
            return "Windows PC";
        }
        if (lower.contains("macintosh") || lower.contains("mac os x")) {
            return "Apple Mac";
        }
        if (lower.contains("linux")) {
            return "Linux Workstation";
        }
        return "Unknown Device";
    }

    public static String parseBrowser(String ua) {
        if (ua == null || ua.isBlank()) {
            return "Web Browser";
        }
        if (ua.contains("Edg/")) {
            return "Microsoft Edge";
        }
        if (ua.contains("OPR/") || ua.contains("Opera")) {
            return "Opera";
        }
        if (ua.contains("Chrome/")) {
            return "Google Chrome";
        }
        if (ua.contains("Firefox/")) {
            return "Mozilla Firefox";
        }
        if (ua.contains("Safari/") && !ua.contains("Chrome")) {
            return "Apple Safari";
        }
        return "Web Browser";
    }
}

