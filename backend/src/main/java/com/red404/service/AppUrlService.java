package com.red404.service;

import com.red404.config.EnvConfig;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * AppUrlService
 *
 * Task Round 9 - Part 1:
 * Enforces that ALL email links are constructed strictly through this helper using the
 * configured APP_BASE_URL.
 *
 * - Never uses the request Host/Origin header.
 * - Never uses hard-coded or default localhost values.
 * - Route key allowlist: donorLogin, hospitalLogin, hospitalStatus, donorDashboard, hospitalDashboard, support.
 */
public class AppUrlService {

    private static final Map<String, String> ROUTE_MAP;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("donorLogin", "/donor-login.html");
        m.put("hospitalLogin", "/hospital-login.html");
        m.put("hospitalStatus", "/hospital-status.html");
        m.put("donorDashboard", "/dashboard.html");
        m.put("hospitalDashboard", "/hospital-dashboard.html");
        m.put("support", "/about.html#contact");
        ROUTE_MAP = Collections.unmodifiableMap(m);
    }

    public static Set<String> getAllowedRouteKeys() {
        return ROUTE_MAP.keySet();
    }

    public static boolean isAllowedRoute(String routeKey) {
        return routeKey != null && ROUTE_MAP.containsKey(routeKey);
    }

    public static String getRoutePath(String routeKey) {
        if (routeKey == null || !ROUTE_MAP.containsKey(routeKey)) {
            throw new IllegalArgumentException(
                    "Invalid route key: '" + routeKey + "'. Allowed route keys are: " + ROUTE_MAP.keySet()
            );
        }
        return ROUTE_MAP.get(routeKey);
    }

    public static String appUrl(String routeKey) {
        return appUrl(routeKey, (Map<String, String>) null);
    }

    public static String appUrl(String routeKey, String queryString) {
        String path = getRoutePath(routeKey);
        String baseUrl = EnvConfig.getAppBaseUrl();
        if (queryString == null || queryString.isBlank()) {
            return baseUrl + path;
        }
        String cleanQuery = queryString.trim();
        if (cleanQuery.startsWith("?")) {
            cleanQuery = cleanQuery.substring(1);
        }
        if (cleanQuery.startsWith("#")) {
            return baseUrl + path + cleanQuery;
        }
        String sep = path.contains("?") ? "&" : "?";
        return baseUrl + path + sep + cleanQuery;
    }

    public static String appUrl(String routeKey, Map<String, String> query) {
        String path = getRoutePath(routeKey);
        String baseUrl = EnvConfig.getAppBaseUrl();
        if (query == null || query.isEmpty()) {
            return baseUrl + path;
        }

        StringBuilder sb = new StringBuilder();
        boolean first = !path.contains("?");
        for (Map.Entry<String, String> entry : query.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) continue;
            if (first) {
                sb.append("?");
                first = false;
            } else {
                sb.append("&");
            }
            sb.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
            sb.append("=");
            sb.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return baseUrl + path + sb.toString();
    }
}
