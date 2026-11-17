package com.red404.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * EnvConfig
 *
 * Part 8: Secrets, Cost Control and Scale.
 * Enforces zero hardcoded secrets in codebase.
 * Loads variables from System environment, JVM properties, or local .env file.
 * Validates required secrets on application startup.
 */
public class EnvConfig {

    private static final Logger log = LoggerFactory.getLogger(EnvConfig.class);
    private static final Map<String, String> DOTENV_MAP = new ConcurrentHashMap<>();
    private static volatile boolean initialized = false;
    private static String ephemeralAdminSecret = null;

    static {
        loadDotEnv();
    }

    public static synchronized void loadDotEnv() {
        if (initialized) return;
        initialized = true;

        List<File> candidates = Arrays.asList(
                new File(".env"),
                new File("../.env"),
                new File("backend/.env")
        );

        for (File candidate : candidates) {
            if (candidate.exists() && candidate.isFile() && candidate.canRead()) {
                log.info("Loading environment variables from: {}", candidate.getAbsolutePath());
                try (BufferedReader reader = new BufferedReader(new FileReader(candidate, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int eq = line.indexOf('=');
                        if (eq > 0) {
                            String k = line.substring(0, eq).trim();
                            String v = line.substring(eq + 1).trim();
                            // strip matching surrounding quotes if present
                            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                                if (v.length() >= 2) {
                                    v = v.substring(1, v.length() - 1);
                                }
                            }
                            if (!k.isEmpty()) {
                                DOTENV_MAP.put(k, v);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.warn("Notice reading .env file: {}", e.getMessage());
                }
                break;
            }
        }
    }

    public static String get(String key) {
        return get(key, null);
    }

    public static String get(String key, String defaultValue) {
        if (key == null) return defaultValue;
        String val = System.getenv(key);
        if (val != null && !val.isBlank()) return val.trim();

        val = System.getProperty(key);
        if (val != null && !val.isBlank()) return val.trim();

        val = DOTENV_MAP.get(key);
        if (val != null && !val.isBlank()) return val.trim();

        return defaultValue;
    }

    public static int getAsInt(String key, int defaultValue) {
        String val = get(key);
        if (val == null || val.isBlank()) return defaultValue;
        try {
            return Integer.parseInt(val.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public static boolean getAsBoolean(String key, boolean defaultValue) {
        String val = get(key);
        if (val == null || val.isBlank()) return defaultValue;
        return Boolean.parseBoolean(val.trim());
    }

    public static boolean isProduction() {
        String env = get("ENVIRONMENT", "");
        String profile = get("SPRING_PROFILES_ACTIVE", "");
        String nodeEnv = get("NODE_ENV", "");
        return "production".equalsIgnoreCase(env) || "prod".equalsIgnoreCase(env)
                || "production".equalsIgnoreCase(nodeEnv) || "prod".equalsIgnoreCase(nodeEnv)
                || profile.toLowerCase().contains("prod");
    }

    public static boolean isStrictEnv() {
        return "true".equalsIgnoreCase(get("RED404_STRICT_ENV", "false"));
    }

    public static String getAppBaseUrl() {
        String url = get("APP_BASE_URL");
        if (url == null || url.isBlank()) {
            if (isProduction() || isStrictEnv()) {
                throw new IllegalStateException("FATAL CONFIGURATION ERROR: APP_BASE_URL environment variable is missing in production mode. Set APP_BASE_URL=https://your-domain.com");
            }
            throw new IllegalStateException("APP_BASE_URL environment variable is not configured. Please set APP_BASE_URL in your environment or .env file (e.g. APP_BASE_URL=https://bloodred404-production.up.railway.app).");
        }
        url = url.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        if (isProduction()) {
            validateProductionBaseUrl(url);
        }
        return url;
    }

    public static void validateProductionBaseUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalStateException("FATAL CONFIGURATION ERROR: APP_BASE_URL cannot be empty in production.");
        }
        String lower = url.toLowerCase().trim();
        if (!lower.startsWith("https://")) {
            throw new IllegalStateException("FATAL CONFIGURATION ERROR: APP_BASE_URL in production must use HTTPS. Provided: " + url);
        }
        try {
            java.net.URI uri = java.net.URI.create(lower);
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                throw new IllegalStateException("FATAL CONFIGURATION ERROR: Invalid host in APP_BASE_URL: " + url);
            }
            if (host.equals("localhost") || host.endsWith(".localhost") || host.equals("127.0.0.1") || host.equals("0.0.0.0")) {
                throw new IllegalStateException("FATAL CONFIGURATION ERROR: APP_BASE_URL in production cannot reference localhost or loopback address: " + url);
            }
            if (isPrivateIp(host)) {
                throw new IllegalStateException("FATAL CONFIGURATION ERROR: APP_BASE_URL in production cannot reference a private IP address: " + url);
            }
        } catch (Exception e) {
            if (e instanceof IllegalStateException) throw (IllegalStateException) e;
            throw new IllegalStateException("FATAL CONFIGURATION ERROR: Malformed APP_BASE_URL: " + url + " (" + e.getMessage() + ")");
        }
    }

    private static boolean isPrivateIp(String host) {
        if (host.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$")) {
            String[] parts = host.split("\\.");
            try {
                int p0 = Integer.parseInt(parts[0]);
                int p1 = Integer.parseInt(parts[1]);
                if (p0 == 10) return true; // 10.0.0.0/8
                if (p0 == 127) return true; // loopback
                if (p0 == 172 && p1 >= 16 && p1 <= 31) return true; // 172.16.0.0/12
                if (p0 == 192 && p1 == 168) return true; // 192.168.0.0/16
                if (p0 == 169 && p1 == 254) return true; // 169.254.0.0/16
            } catch (Exception ignored) {}
        }
        return false;
    }

    public static String getEmailMode() {
        String mode = get("EMAIL_MODE");
        if (mode != null && !mode.isBlank()) {
            return mode.trim().toLowerCase();
        }
        return isProduction() ? "live" : "log";
    }

    public static boolean isEmailLiveMode() {
        return "live".equalsIgnoreCase(getEmailMode());
    }

    public static String getEmailRedirectTo() {
        String redirect = get("EMAIL_REDIRECT_TO");
        if (redirect != null && !redirect.isBlank()) {
            return redirect.trim();
        }
        return null;
    }

    public static String getEmailFromAddress() {
        return get("EMAIL_FROM_ADDRESS", "no-reply@red404.org");
    }

    public static String getSupportEmail() {
        return get("SUPPORT_EMAIL", get("EMAIL_SUPPORT_ADDRESS", "support@red404.org"));
    }

    public static String getHospitalReviewSlaText() {
        String sla = get("HOSPITAL_REVIEW_SLA_TEXT");
        if (sla != null && !sla.isBlank()) {
            return sla.trim();
        }
        return null;
    }

    public static String getAdminSecret() {
        String secret = get("RED404_ADMIN_SECRET");
        if (secret != null && !secret.isBlank()) {
            return secret.trim();
        }

        if (isProduction() || isStrictEnv()) {
            throw new IllegalStateException("FATAL: RED404_ADMIN_SECRET environment variable is missing in production mode.");
        }

        // Ephemeral in dev/test so no static hardcoded credential exists in repository
        synchronized (EnvConfig.class) {
            if (ephemeralAdminSecret == null) {
                ephemeralAdminSecret = "DEV-" + UUID.randomUUID().toString();
                log.warn("================================================================================");
                log.warn("[SECURITY NOTICE] RED404_ADMIN_SECRET not set in environment or .env file.");
                log.warn("[DEV MODE ONLY] Generated ephemeral session admin secret: {}", ephemeralAdminSecret);
                log.warn("To set a permanent secret, configure RED404_ADMIN_SECRET in your .env or environment.");
                log.warn("================================================================================");
            }
            return ephemeralAdminSecret;
        }
    }

    public static String getAdminEmail() {
        return get("RED404_ADMIN_EMAIL", "admin@red404.org");
    }

    public static void validateOnStartup() {
        loadDotEnv();
        log.info("Executing Part 8 Environment & Secret Configuration check (Environment: {})...",
                isProduction() ? "PRODUCTION" : "DEVELOPMENT");

        if (isProduction() || isStrictEnv()) {
            List<String> missing = new ArrayList<>();
            if (get("RED404_ADMIN_SECRET") == null || get("RED404_ADMIN_SECRET").isBlank()) {
                missing.add("RED404_ADMIN_SECRET");
            }
            String appBase = get("APP_BASE_URL");
            if (appBase == null || appBase.isBlank()) {
                missing.add("APP_BASE_URL");
            }

            if (!missing.isEmpty()) {
                String errorMsg = "\n" +
                        "################################################################################\n" +
                        "FATAL CONFIGURATION ERROR: APPLICATION STARTUP HALTED\n" +
                        "The following required production environment variables are missing:\n" +
                        "  " + String.join(", ", missing) + "\n" +
                        "Please supply them in the environment or .env file before launching RED404.\n" +
                        "################################################################################";
                log.error(errorMsg);
                throw new IllegalStateException(errorMsg);
            }

            // In production, APP_BASE_URL must be HTTPS and not localhost or private IP
            validateProductionBaseUrl(appBase);
        }
    }
}
