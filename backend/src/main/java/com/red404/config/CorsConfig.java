package com.red404.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * CorsConfig
 *
 * Implements Part 9 Item 7:
 * Restricts CORS to own origins (APP_BASE_URL, localhost, and CORS_ALLOWED_ORIGINS)
 * Disallows wildcard '*' with credentials.
 */
@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                List<String> origins = new ArrayList<>();
                String appUrl = EnvConfig.get("APP_BASE_URL");
                if (appUrl != null && !appUrl.isBlank()) {
                    origins.add(appUrl.trim());
                }
                String customOrigins = EnvConfig.get("CORS_ALLOWED_ORIGINS");
                if (customOrigins != null && !customOrigins.isBlank()) {
                    for (String o : customOrigins.split(",")) {
                        if (!o.isBlank()) origins.add(o.trim());
                    }
                }
                if (origins.isEmpty()) {
                    origins.add("http://localhost:8080");
                    origins.add("http://127.0.0.1:8080");
                    origins.add("http://localhost:3000");
                }

                registry.addMapping("/api/**")
                        .allowedOrigins(origins.toArray(new String[0]))
                        .allowedOriginPatterns("http://localhost:*", "http://127.0.0.1:*", "https://*.railway.app")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("Content-Type", "Authorization", "X-Requested-With", "X-Red404-Token", "X-Admin-Clearance")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
