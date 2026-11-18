package com.red404.service;

import java.util.Map;

import com.red404.config.EnvConfig;

public class Part1Verification {

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("RED404 TASK ROUND 9 - PART 1 BACKEND VERIFICATION");
        System.out.println("=================================================");

        // Test 1: Route Keys & Paths
        System.out.println("\n[Test 1] Testing AppUrlService route allowlist...");
        assertEq("/donor-login.html", AppUrlService.getRoutePath("donorLogin"), "donorLogin route");
        assertEq("/hospital-login.html", AppUrlService.getRoutePath("hospitalLogin"), "hospitalLogin route");
        assertEq("/hospital-status.html", AppUrlService.getRoutePath("hospitalStatus"), "hospitalStatus route");
        assertEq("/dashboard.html", AppUrlService.getRoutePath("donorDashboard"), "donorDashboard route");
        assertEq("/hospital-dashboard.html", AppUrlService.getRoutePath("hospitalDashboard"), "hospitalDashboard route");
        assertEq("/about.html#contact", AppUrlService.getRoutePath("support"), "support route");

        // Test 2: Disallowed route key
        System.out.println("\n[Test 2] Testing disallowed route rejection...");
        try {
            AppUrlService.getRoutePath("invalidRoute");
            throw new RuntimeException("Expected IllegalArgumentException for invalid route!");
        } catch (IllegalArgumentException e) {
            System.out.println(" [PASS] Disallowed route threw: " + e.getMessage());
        }

        // Test 3: URL Building with APP_BASE_URL
        System.out.println("\n[Test 3] Testing URL construction with APP_BASE_URL...");
        System.setProperty("APP_BASE_URL", "https://bloodred404-production.up.railway.app");
        String donorUrl = AppUrlService.appUrl("donorLogin");
        assertEq("https://bloodred404-production.up.railway.app/donor-login.html", donorUrl, "donorLogin full URL");

        String statusDeepLink = AppUrlService.appUrl("hospitalLogin", Map.of("next", "hospitalStatus"));
        assertEq("https://bloodred404-production.up.railway.app/hospital-login.html?next=hospitalStatus", statusDeepLink, "Deep link URL");

        // Test 4: Production HTTPS & Private IP / Localhost Rejection
        System.out.println("\n[Test 4] Testing production URL security validations...");
        // Non-HTTPS
        try {
            EnvConfig.validateProductionBaseUrl("http://bloodred404-production.up.railway.app");
            throw new RuntimeException("Expected non-https failure");
        } catch (IllegalStateException e) {
            System.out.println(" [PASS] Non-HTTPS rejected: " + e.getMessage());
        }

        // Localhost in production
        try {
            EnvConfig.validateProductionBaseUrl("https://localhost:8080");
            throw new RuntimeException("Expected localhost failure");
        } catch (IllegalStateException e) {
            System.out.println(" [PASS] Localhost rejected: " + e.getMessage());
        }

        // 127.0.0.1 in production
        try {
            EnvConfig.validateProductionBaseUrl("https://127.0.0.1:8080");
            throw new RuntimeException("Expected 127.0.0.1 failure");
        } catch (IllegalStateException e) {
            System.out.println(" [PASS] 127.0.0.1 rejected: " + e.getMessage());
        }

        // Private IP in production (192.168.1.10)
        try {
            EnvConfig.validateProductionBaseUrl("https://192.168.1.10:8080");
            throw new RuntimeException("Expected private IP failure");
        } catch (IllegalStateException e) {
            System.out.println(" [PASS] Private IP rejected: " + e.getMessage());
        }

        // Valid production URL
        EnvConfig.validateProductionBaseUrl("https://bloodred404-production.up.railway.app");
        System.out.println(" [PASS] Valid production URL accepted");

        // Test 5: Email mode logic
        System.out.println("\n[Test 5] Testing EMAIL_MODE defaults and overrides...");
        System.clearProperty("EMAIL_MODE");
        System.setProperty("NODE_ENV", "development");
        System.setProperty("ENVIRONMENT", "development");
        assertEq("log", EnvConfig.getEmailMode(), "Dev default email mode is log");

        System.setProperty("EMAIL_MODE", "live");
        assertEq("live", EnvConfig.getEmailMode(), "Explicit EMAIL_MODE=live respected");

        System.out.println("\nALL PART 1 BACKEND CHECKS PASSED SUCCESSFULLY!");
    }

    private static void assertEq(String expected, String actual, String testName) {
        if (!expected.equals(actual)) {
            throw new AssertionError(testName + " FAILED: Expected '" + expected + "', got '" + actual + "'");
        }
        System.out.println(" [PASS] " + testName + " => " + actual);
    }
}
