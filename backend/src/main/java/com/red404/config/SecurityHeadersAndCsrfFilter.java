package com.red404.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * SecurityHeadersAndCsrfFilter
 *
 * Implements Part 9 Items 7 & 8:
 * - Content-Security-Policy, X-Content-Type-Options, X-Frame-Options,
 *   Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy,
 *   Cache-Control & no-store for API/authenticated pages.
 * - CSRF verification via Origin/Referer header validation for state-changing HTTP methods.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class SecurityHeadersAndCsrfFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(SecurityHeadersAndCsrfFilter.class);

    private static final String CSP_POLICY =
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com; " +
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://unpkg.com https://*.basemaps.cartocdn.com; " +
            "connect-src 'self' https://api.webpush.com https://nominatim.openstreetmap.org; " +
            "frame-ancestors 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self';";

    private static final Set<String> STATE_CHANGING_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (request instanceof HttpServletRequest httpReq && response instanceof HttpServletResponse httpRes) {
            String uri = httpReq.getRequestURI();
            String method = httpReq.getMethod().toUpperCase();

            // 1. Enforce Comprehensive Security Headers (Part 9 Item 8)
            httpRes.setHeader("Content-Security-Policy", CSP_POLICY);
            httpRes.setHeader("X-Content-Type-Options", "nosniff");
            httpRes.setHeader("X-Frame-Options", "DENY");
            httpRes.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
            httpRes.setHeader("Permissions-Policy", "geolocation=(self)");
            httpRes.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            httpRes.setHeader("X-XSS-Protection", "1; mode=block");

            // HSTS when connection is secure
            if (RoleSessionManager.isConnectionSecure(httpReq)) {
                httpRes.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            }

            // Cache-Control: no-store for API calls and HTML pages
            if (uri != null && (uri.startsWith("/api/") || uri.endsWith(".html") || uri.endsWith("/"))) {
                httpRes.setHeader("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
                httpRes.setHeader("Pragma", "no-cache");
                httpRes.setDateHeader("Expires", 0);
            }

            // 2. CSRF Origin Verification on state-changing requests (Part 9 Item 7)
            if (STATE_CHANGING_METHODS.contains(method) && uri != null && uri.startsWith("/api/")) {
                String origin = httpReq.getHeader("Origin");
                if (origin != null && !origin.isBlank()) {
                    if (!isAllowedOrigin(httpReq, origin.trim())) {
                        log.warn("CSRF blocked request: Origin '{}' not permitted for {} {}", origin, method, uri);
                        httpRes.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        httpRes.setContentType("application/json");
                        httpRes.getWriter().write("{\"success\":false,\"message\":\"CSRF verification failed: origin disallowed.\"}");
                        return;
                    }
                }
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isAllowedOrigin(HttpServletRequest request, String origin) {
        if (origin == null || origin.isBlank()) return true;

        try {
            URI originUri = URI.create(origin);
            String originHost = originUri.getHost();
            if (originHost == null) return false;

            // Allow localhost / loopback
            if (originHost.equalsIgnoreCase("localhost") || originHost.equals("127.0.0.1") || originHost.equals("0.0.0.0")) {
                return true;
            }

            // Allow exact match with server host
            String serverName = request.getServerName();
            if (originHost.equalsIgnoreCase(serverName)) {
                return true;
            }

            // Allow configured APP_BASE_URL
            String appBase = EnvConfig.get("APP_BASE_URL");
            if (appBase != null && !appBase.isBlank()) {
                URI baseUri = URI.create(appBase.trim());
                if (originHost.equalsIgnoreCase(baseUri.getHost())) {
                    return true;
                }
            }

            // Allow custom comma-separated CORS_ALLOWED_ORIGINS
            String custom = EnvConfig.get("CORS_ALLOWED_ORIGINS");
            if (custom != null && !custom.isBlank()) {
                for (String allowed : custom.split(",")) {
                    if (!allowed.isBlank()) {
                        URI allowedUri = URI.create(allowed.trim());
                        if (originHost.equalsIgnoreCase(allowedUri.getHost())) {
                            return true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            return false;
        }

        return false;
    }
}
