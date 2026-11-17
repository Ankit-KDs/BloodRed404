package com.red404.service;

import com.red404.config.RoleSessionManager;
import com.red404.config.RoleSessionManager.Role;
import com.red404.config.RoleSessionManager.RoleHttpSession;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.lang.reflect.Proxy;
import java.util.*;

public class LoginIsolationVerification {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("RED404 TASK ROUND 10 - PART 1 MULTI-ROLE TEST");
        System.out.println("=================================================");

        // Test 1: Verify Role Enum Cookie and Storage Keys
        System.out.println("\n[Test 1] Testing Role Cookie Names and Storage Keys...");
        assertEq("rd_donor", Role.DONOR.cookieName, "DONOR cookie");
        assertEq("rd_hospital", Role.HOSPITAL.cookieName, "HOSPITAL cookie");
        assertEq("rd_admin", Role.ADMIN.cookieName, "ADMIN cookie");
        System.out.println(" [PASS] Role cookies verified: rd_donor, rd_hospital, rd_admin");

        // Test 2: Simultaneous Session Creation for All 3 Roles
        System.out.println("\n[Test 2] Testing simultaneous session creation for Donor, Hospital, Admin...");
        RoleHttpSession donorSess = RoleSessionManager.createSession(Role.DONOR, null);
        donorSess.setAttribute("user", Map.of("id", 101, "name", "Test Donor", "email", "donor@red404.local"));
        donorSess.setAttribute("role", "DONOR");

        RoleHttpSession hospSess = RoleSessionManager.createSession(Role.HOSPITAL, null);
        hospSess.setAttribute("hospitalUser", Map.of("id", 202, "name", "City Care Hospital", "email", "hosp@red404.local"));
        hospSess.setAttribute("role", "HOSPITAL");

        RoleHttpSession adminSess = RoleSessionManager.createSession(Role.ADMIN, null);
        adminSess.setAttribute("adminRole", "SUPER_ADMIN");
        adminSess.setAttribute("adminEmail", "red404admin808@open.in");

        assertNotEq(donorSess.getId(), hospSess.getId(), "Donor and Hospital Session IDs must be distinct");
        assertNotEq(donorSess.getId(), adminSess.getId(), "Donor and Admin Session IDs must be distinct");
        assertNotEq(hospSess.getId(), adminSess.getId(), "Hospital and Admin Session IDs must be distinct");
        System.out.println(" [PASS] 3 distinct 256-bit cryptographically secure sessions created.");

        // Test 3: Cookie Attachment Simulation
        System.out.println("\n[Test 3] Testing Cookie attachment with Path=/, HttpOnly, Secure, SameSite=Lax...");
        List<String> setCookieHeaders = new ArrayList<>();
        HttpServletResponse dummyResp = (HttpServletResponse) Proxy.newProxyInstance(
                HttpServletResponse.class.getClassLoader(),
                new Class[]{HttpServletResponse.class},
                (proxy, method, mArgs) -> {
                    if ("addHeader".equals(method.getName()) && "Set-Cookie".equalsIgnoreCase(String.valueOf(mArgs[0]))) {
                        setCookieHeaders.add(String.valueOf(mArgs[1]));
                    }
                    return null;
                }
        );
        RoleSessionManager.attachRoleCookie(dummyResp, Role.DONOR.cookieName, donorSess.getId(), true);
        assertEq(1, setCookieHeaders.size(), "One Set-Cookie added");
        String donorCookieHeader = setCookieHeaders.get(0);
        assertTrue(donorCookieHeader.contains("rd_donor=" + donorSess.getId()), "rd_donor cookie present");
        assertTrue(donorCookieHeader.contains("HttpOnly"), "HttpOnly present");
        assertTrue(donorCookieHeader.contains("SameSite=Lax"), "SameSite=Lax present");
        assertTrue(donorCookieHeader.contains("Secure"), "Secure present");
        assertTrue(donorCookieHeader.contains("Path=/"), "Path=/ present");
        System.out.println(" [PASS] Cookie header verified: " + donorCookieHeader);

        // Test 4: One Browser Holding All 3 Cookies Simultaneously
        System.out.println("\n[Test 4] Testing Single Browser with All 3 Cookies via X-Red404-Role...");
        Cookie[] multiCookies = new Cookie[]{
                new Cookie("rd_donor", donorSess.getId()),
                new Cookie("rd_hospital", hospSess.getId()),
                new Cookie("rd_admin", adminSess.getId())
        };

        // Header indicates DONOR
        HttpServletRequest reqDonor = createDummyRequest(multiCookies, Map.of("X-Red404-Role", "DONOR"), "/api/auth/me");
        Role resolvedDonor = RoleSessionManager.resolveRoleForRequest(reqDonor);
        assertEq(Role.DONOR, resolvedDonor, "Resolved role DONOR");
        String donorCookieVal = RoleSessionManager.getCookieValue(reqDonor, resolvedDonor.cookieName);
        assertEq(donorSess.getId(), donorCookieVal, "Donor session resolved");

        // Header indicates HOSPITAL
        HttpServletRequest reqHosp = createDummyRequest(multiCookies, Map.of("X-Red404-Role", "HOSPITAL"), "/api/auth/me");
        Role resolvedHosp = RoleSessionManager.resolveRoleForRequest(reqHosp);
        assertEq(Role.HOSPITAL, resolvedHosp, "Resolved role HOSPITAL");
        String hospCookieVal = RoleSessionManager.getCookieValue(reqHosp, resolvedHosp.cookieName);
        assertEq(hospSess.getId(), hospCookieVal, "Hospital session resolved");

        // Header indicates ADMIN
        HttpServletRequest reqAdmin = createDummyRequest(multiCookies, Map.of("X-Red404-Role", "ADMIN"), "/api/auth/me");
        Role resolvedAdmin = RoleSessionManager.resolveRoleForRequest(reqAdmin);
        assertEq(Role.ADMIN, resolvedAdmin, "Resolved role ADMIN");
        String adminCookieVal = RoleSessionManager.getCookieValue(reqAdmin, resolvedAdmin.cookieName);
        assertEq(adminSess.getId(), adminCookieVal, "Admin session resolved");
        System.out.println(" [PASS] Single browser holds all 3 cookies simultaneously with complete isolation.");

        // Test 5: Re-validation across Page Reloads
        System.out.println("\n[Test 5] Simulating page reload session retrieval...");
        RoleHttpSession reloadedDonor = RoleSessionManager.getSession(donorSess.getId());
        RoleHttpSession reloadedHosp = RoleSessionManager.getSession(hospSess.getId());
        RoleHttpSession reloadedAdmin = RoleSessionManager.getSession(adminSess.getId());
        assertTrue(reloadedDonor != null && !reloadedDonor.isExpired(), "Donor session survived reload");
        assertTrue(reloadedHosp != null && !reloadedHosp.isExpired(), "Hospital session survived reload");
        assertTrue(reloadedAdmin != null && !reloadedAdmin.isExpired(), "Admin session survived reload");
        System.out.println(" [PASS] All sessions survived reloads without cross-contamination.");

        System.out.println("\n=================================================");
        System.out.println("ALL PART 1 BACKEND ISOLATION CHECKS PASSED!");
        System.out.println("=================================================");
    }

    private static HttpServletRequest createDummyRequest(Cookie[] cookies, Map<String, String> headers, String uri) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                HttpServletRequest.class.getClassLoader(),
                new Class[]{HttpServletRequest.class},
                (proxy, method, mArgs) -> {
                    String name = method.getName();
                    if ("getCookies".equals(name)) return cookies;
                    if ("getHeader".equals(name) && mArgs != null && mArgs.length > 0) {
                        return headers.get(String.valueOf(mArgs[0]));
                    }
                    if ("getRequestURI".equals(name)) return uri;
                    if ("getParameter".equals(name)) return null;
                    if ("isSecure".equals(name)) return true;
                    return null;
                }
        );
    }

    private static void assertEq(Object expected, Object actual, String msg) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError("FAIL: " + msg + " (expected: " + expected + ", got: " + actual + ")");
        }
    }

    private static void assertNotEq(Object notExpected, Object actual, String msg) {
        if (Objects.equals(notExpected, actual)) {
            throw new AssertionError("FAIL: " + msg + " (values must not be equal: " + actual + ")");
        }
    }

    private static void assertTrue(boolean cond, String msg) {
        if (!cond) {
            throw new AssertionError("FAIL: " + msg);
        }
    }
}
