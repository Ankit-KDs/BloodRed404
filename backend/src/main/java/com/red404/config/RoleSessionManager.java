package com.red404.config;

import jakarta.servlet.ServletContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RoleSessionManager
 *
 * Implements Part 1: Session Isolation for RED404.
 * Manages separate, isolated session tokens and cookies per role:
 * - DONOR: cookie 'rd_donor', storage key 'donor_session'
 * - HOSPITAL: cookie 'rd_hospital', storage key 'hospital_session'
 * - ADMIN: cookie 'rd_admin', storage key 'admin_session'
 */
public class RoleSessionManager {

    public enum Role {
        DONOR("rd_donor", "donor_session"),
        HOSPITAL("rd_hospital", "hospital_session"),
        ADMIN("rd_admin", "admin_session");

        public final String cookieName;
        public final String storageKey;

        Role(String cookieName, String storageKey) {
            this.cookieName = cookieName;
            this.storageKey = storageKey;
        }

        public static Role fromString(String str) {
            if (str == null) return null;
            String trimmed = str.trim().toUpperCase();
            for (Role r : values()) {
                if (r.name().equals(trimmed)) return r;
            }
            return null;
        }
    }

    private static final Map<String, RoleHttpSession> SESSIONS = new ConcurrentHashMap<>();
    private static final int DEFAULT_MAX_INACTIVE_INTERVAL = 30 * 60; // 30 minutes

    public static Role resolveRoleForRequest(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) uri = "";
        String uriLower = uri.toLowerCase();

        // 1. Explicit Header
        String headerRole = request.getHeader("X-Red404-Role");
        Role r = Role.fromString(headerRole);
        if (r != null) return r;

        // 2. Query param or body hint
        String paramRole = request.getParameter("role");
        if (paramRole == null) paramRole = request.getParameter("roleType");
        r = Role.fromString(paramRole);
        if (r != null) return r;

        // 3. URI path matching
        if (uriLower.startsWith("/api/hospital") || uriLower.contains("/hospital-") || uriLower.contains("hospital.html")) {
            return Role.HOSPITAL;
        }
        if (uriLower.startsWith("/api/admin") || uriLower.contains("/admin-") || uriLower.contains("admin.html")) {
            return Role.ADMIN;
        }
        if (uriLower.startsWith("/api/donor/") || uriLower.startsWith("/api/donors/") || uriLower.startsWith("/api/settings/")
                || uriLower.contains("/donor-") || uriLower.contains("/dashboard") || uriLower.contains("/my-donations")) {
            return Role.DONOR;
        }

        if (uriLower.startsWith("/api/blood-requests")) {
            if (getCookieValue(request, Role.HOSPITAL.cookieName) != null) {
                return Role.HOSPITAL;
            }
            return Role.DONOR;
        }

        // 4. Fallback based on present cookies
        if (getCookieValue(request, Role.DONOR.cookieName) != null) {
            return Role.DONOR;
        }
        if (getCookieValue(request, Role.HOSPITAL.cookieName) != null) {
            return Role.HOSPITAL;
        }
        if (getCookieValue(request, Role.ADMIN.cookieName) != null) {
            return Role.ADMIN;
        }

        return Role.DONOR;
    }

    public static String getCookieValue(HttpServletRequest request, String cookieName) {
        if (request == null || cookieName == null) return null;
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (jakarta.servlet.http.Cookie c : cookies) {
            if (cookieName.equalsIgnoreCase(c.getName())) {
                String val = c.getValue();
                if (val != null && !val.isBlank()) {
                    return val.trim();
                }
            }
        }
        return null;
    }

    public static RoleHttpSession getSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) return null;
        RoleHttpSession session = SESSIONS.get(sessionId.trim());
        if (session != null) {
            if (session.isExpired()) {
                session.invalidate();
                return null;
            }
            session.access();
        }
        return session;
    }

    public static RoleHttpSession createSession(Role role, ServletContext servletContext) {
        String id = UUID.randomUUID().toString();
        RoleHttpSession session = new RoleHttpSession(id, role, servletContext);
        SESSIONS.put(id, session);
        return session;
    }

    public static void removeSession(String sessionId) {
        if (sessionId != null) {
            SESSIONS.remove(sessionId.trim());
        }
    }

    public static void attachRoleCookie(HttpServletResponse response, String cookieName, String token, boolean secure) {
        if (response == null || cookieName == null || token == null) return;
        StringBuilder sb = new StringBuilder();
        sb.append(cookieName).append("=").append(token).append("; Path=/; HttpOnly; SameSite=Lax");
        if (secure) {
            sb.append("; Secure");
        }
        response.addHeader("Set-Cookie", sb.toString());
    }

    public static void clearRoleCookie(HttpServletResponse response, String cookieName, boolean secure) {
        if (response == null || cookieName == null) return;
        StringBuilder sb = new StringBuilder();
        sb.append(cookieName).append("=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
        if (secure) {
            sb.append("; Secure");
        }
        response.addHeader("Set-Cookie", sb.toString());
    }

    public static boolean isConnectionSecure(HttpServletRequest request) {
        if (request == null) return false;
        if (request.isSecure()) return true;
        String proto = request.getHeader("X-Forwarded-Proto");
        return proto != null && "https".equalsIgnoreCase(proto.trim());
    }

    /**
     * RoleHttpSession implementation of standard jakarta.servlet.http.HttpSession.
     */
    public static class RoleHttpSession implements HttpSession {
        private final String id;
        private final Role role;
        private final ServletContext servletContext;
        private final long creationTime;
        private volatile long lastAccessedTime;
        private volatile int maxInactiveInterval = DEFAULT_MAX_INACTIVE_INTERVAL;
        private volatile boolean isValid = true;
        private final Map<String, Object> attributes = new ConcurrentHashMap<>();

        public RoleHttpSession(String id, Role role, ServletContext servletContext) {
            this.id = id;
            this.role = role;
            this.servletContext = servletContext;
            this.creationTime = System.currentTimeMillis();
            this.lastAccessedTime = this.creationTime;
        }

        public Role getRole() {
            return role;
        }

        public void access() {
            this.lastAccessedTime = System.currentTimeMillis();
        }

        public boolean isExpired() {
            if (!isValid) return true;
            if (maxInactiveInterval <= 0) return false;
            return (System.currentTimeMillis() - lastAccessedTime) > (maxInactiveInterval * 1000L);
        }

        @Override
        public long getCreationTime() {
            checkValid();
            return creationTime;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public long getLastAccessedTime() {
            checkValid();
            return lastAccessedTime;
        }

        @Override
        public ServletContext getServletContext() {
            return servletContext;
        }

        @Override
        public void setMaxInactiveInterval(int interval) {
            this.maxInactiveInterval = interval;
        }

        @Override
        public int getMaxInactiveInterval() {
            return maxInactiveInterval;
        }

        @Override
        public Object getAttribute(String name) {
            checkValid();
            if (name == null) return null;
            return attributes.get(name);
        }

        @Override
        public Enumeration<String> getAttributeNames() {
            checkValid();
            return Collections.enumeration(attributes.keySet());
        }

        @Override
        public void setAttribute(String name, Object value) {
            checkValid();
            if (name == null) return;
            if (value == null) {
                removeAttribute(name);
            } else {
                attributes.put(name, value);
            }
        }

        @Override
        public void removeAttribute(String name) {
            checkValid();
            if (name != null) {
                attributes.remove(name);
            }
        }

        @Override
        public void invalidate() {
            this.isValid = false;
            this.attributes.clear();
            removeSession(this.id);
        }

        @Override
        public boolean isNew() {
            checkValid();
            return creationTime == lastAccessedTime;
        }

        private void checkValid() {
            if (!isValid) {
                throw new IllegalStateException("Session " + id + " has already been invalidated.");
            }
        }
    }
}
