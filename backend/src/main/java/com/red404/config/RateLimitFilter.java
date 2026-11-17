package com.red404.config;

import com.red404.service.RateLimitService;
import com.red404.util.GeoLocationUtil;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * RateLimitFilter
 *
 * Part 8: Scale & Abuse Prevention.
 * Enforces rate limits across sensitive endpoints:
 * - Auth & Login: 20 requests/min per IP
 * - Registration: 10 requests/hour per IP
 * - Dispatch & Mutations: 30 requests/10-min per IP
 * - Public Searches: 120 requests/min per IP
 */
@Component
@Order(2)
public class RateLimitFilter implements Filter {

    @Autowired
    private RateLimitService rateLimitService;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (request instanceof HttpServletRequest httpReq && response instanceof HttpServletResponse httpRes) {
            String path = httpReq.getRequestURI();
            String method = httpReq.getMethod();
            String clientIp = GeoLocationUtil.getClientIp(httpReq);

            RateLimitService.RateLimitResult check = null;

            if (path.contains("/login") || path.contains("/stealth-auth") || path.contains("/auth")) {
                check = rateLimitService.checkLimit("auth:" + clientIp, 20, 60);
            } else if (path.contains("/register") && "POST".equalsIgnoreCase(method)) {
                check = rateLimitService.checkLimit("register:" + clientIp, 10, 3600);
            } else if ((path.contains("/requests/dispatch") || path.contains("/blood-requests")) && "POST".equalsIgnoreCase(method)) {
                check = rateLimitService.checkLimit("dispatch:" + clientIp, 30, 600);
            } else if (path.startsWith("/api/public") || path.contains("/search")) {
                check = rateLimitService.checkLimit("public_search:" + clientIp, 120, 60);
            }

            if (check != null) {
                httpRes.setHeader("X-RateLimit-Limit", String.valueOf(check.limit));
                httpRes.setHeader("X-RateLimit-Remaining", String.valueOf(check.remaining));

                if (!check.allowed) {
                    httpRes.setStatus(429); // Too Many Requests
                    httpRes.setHeader("Retry-After", String.valueOf(check.retryAfterSeconds));
                    httpRes.setContentType("application/json;charset=UTF-8");
                    httpRes.getWriter().write(String.format(
                            "{\"success\":false,\"code\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please try again in %d seconds.\",\"retryAfter\":%d}",
                            check.retryAfterSeconds, check.retryAfterSeconds
                    ));
                    return;
                }
            }
        }

        chain.doFilter(request, response);
    }
}
