package com.red404.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * RoleSessionFilter
 *
 * Implements Part 1: Session Isolation.
 * Intercepts every incoming request, determines the role context,
 * and binds an isolated RoleHttpSession backed by that role's dedicated cookie:
 * - DONOR    -> rd_donor
 * - HOSPITAL -> rd_hospital
 * - ADMIN    -> rd_admin
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RoleSessionFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (request instanceof HttpServletRequest httpReq && response instanceof HttpServletResponse httpRes) {
            RoleSessionManager.Role role = RoleSessionManager.resolveRoleForRequest(httpReq);
            RoleSessionRequestWrapper wrappedReq = new RoleSessionRequestWrapper(httpReq, httpRes, role);
            chain.doFilter(wrappedReq, httpRes);
        } else {
            chain.doFilter(request, response);
        }
    }

    public static class RoleSessionRequestWrapper extends HttpServletRequestWrapper {
        private final RoleSessionManager.Role role;
        private final HttpServletResponse response;
        private final ServletContext servletContext;
        private final boolean isSecure;
        private RoleSessionManager.RoleHttpSession currentSession;

        public RoleSessionRequestWrapper(HttpServletRequest request, HttpServletResponse response, RoleSessionManager.Role role) {
            super(request);
            this.response = response;
            this.role = role;
            this.servletContext = request.getServletContext();
            this.isSecure = RoleSessionManager.isConnectionSecure(request);

            String token = RoleSessionManager.getCookieValue(request, role.cookieName);
            if (token != null) {
                this.currentSession = RoleSessionManager.getSession(token);
            }
        }

        public RoleSessionManager.Role getRole() {
            return role;
        }

        @Override
        public HttpSession getSession(boolean create) {
            if (currentSession != null) {
                if (currentSession.isExpired()) {
                    currentSession.invalidate();
                    RoleSessionManager.clearRoleCookie(response, role.cookieName, isSecure);
                    currentSession = null;
                } else {
                    return wrapSession(currentSession);
                }
            }

            if (!create) {
                return null;
            }

            currentSession = RoleSessionManager.createSession(role, servletContext);
            RoleSessionManager.attachRoleCookie(response, role.cookieName, currentSession.getId(), isSecure);
            return wrapSession(currentSession);
        }

        @Override
        public HttpSession getSession() {
            return getSession(true);
        }

        private HttpSession wrapSession(RoleSessionManager.RoleHttpSession session) {
            return new HttpSessionWrapper(session, response, role.cookieName, isSecure, () -> {
                this.currentSession = null;
            });
        }
    }

    /**
     * Delegates to RoleHttpSession, but triggers clearRoleCookie when invalidate() is called.
     */
    private static class HttpSessionWrapper implements HttpSession {
        private final RoleSessionManager.RoleHttpSession delegate;
        private final HttpServletResponse response;
        private final String cookieName;
        private final boolean isSecure;
        private final Runnable onInvalidate;

        public HttpSessionWrapper(RoleSessionManager.RoleHttpSession delegate, HttpServletResponse response,
                                  String cookieName, boolean isSecure, Runnable onInvalidate) {
            this.delegate = delegate;
            this.response = response;
            this.cookieName = cookieName;
            this.isSecure = isSecure;
            this.onInvalidate = onInvalidate;
        }

        @Override
        public long getCreationTime() {
            return delegate.getCreationTime();
        }

        @Override
        public String getId() {
            return delegate.getId();
        }

        @Override
        public long getLastAccessedTime() {
            return delegate.getLastAccessedTime();
        }

        @Override
        public ServletContext getServletContext() {
            return delegate.getServletContext();
        }

        @Override
        public void setMaxInactiveInterval(int interval) {
            delegate.setMaxInactiveInterval(interval);
        }

        @Override
        public int getMaxInactiveInterval() {
            return delegate.getMaxInactiveInterval();
        }

        @Override
        public Object getAttribute(String name) {
            return delegate.getAttribute(name);
        }

        @Override
        public java.util.Enumeration<String> getAttributeNames() {
            return delegate.getAttributeNames();
        }

        @Override
        public void setAttribute(String name, Object value) {
            delegate.setAttribute(name, value);
        }

        @Override
        public void removeAttribute(String name) {
            delegate.removeAttribute(name);
        }

        @Override
        public void invalidate() {
            delegate.invalidate();
            RoleSessionManager.clearRoleCookie(response, cookieName, isSecure);
            if (onInvalidate != null) {
                onInvalidate.run();
            }
        }

        @Override
        public boolean isNew() {
            return delegate.isNew();
        }
    }
}
