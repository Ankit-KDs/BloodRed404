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

    public static boolean isProduction() {
        String env = get("ENVIRONMENT", "");
        String profile = get("SPRING_PROFILES_ACTIVE", "");
        return "production".equalsIgnoreCase(env) || "prod".equalsIgnoreCase(env) || profile.toLowerCase().contains("prod");
    }

    public static boolean isStrictEnv() {
        return "true".equalsIgnoreCase(get("RED404_STRICT_ENV", "false"));
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
        }
    }
}
