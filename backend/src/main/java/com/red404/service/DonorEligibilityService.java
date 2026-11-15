package com.red404.service;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Authoritative Single Source of Truth for Donor Eligibility.
 * Computes cooldowns, recovery progress, and next eligible donation dates.
 */
public class DonorEligibilityService {

    public static final int DEFAULT_COOLDOWN_DAYS = 90;

    public static int getCooldownDays() {
        return getCooldownDays(null);
    }

    public static int getCooldownDays(String gender) {
        try {
            if (gender != null && !gender.isBlank()) {
                String g = gender.trim().toLowerCase();
                if (g.startsWith("f") || g.equals("female") || g.equals("woman")) {
                    String fProp = System.getProperty("ELIGIBILITY_GAP_DAYS_FEMALE");
                    if (fProp != null && !fProp.isBlank()) return Integer.parseInt(fProp.trim());
                    String fEnv = System.getenv("ELIGIBILITY_GAP_DAYS_FEMALE");
                    if (fEnv != null && !fEnv.isBlank()) return Integer.parseInt(fEnv.trim());
                }
            }
            String prop = System.getProperty("ELIGIBILITY_GAP_DAYS");
            if (prop == null || prop.isBlank()) prop = System.getProperty("DONOR_COOLDOWN_DAYS");
            if (prop != null && !prop.isBlank()) {
                return Integer.parseInt(prop.trim());
            }
            String env = System.getenv("ELIGIBILITY_GAP_DAYS");
            if (env == null || env.isBlank()) env = System.getenv("DONOR_COOLDOWN_DAYS");
            if (env != null && !env.isBlank()) {
                return Integer.parseInt(env.trim());
            }
        } catch (Exception ignored) {}
        return DEFAULT_COOLDOWN_DAYS;
    }

    /**
     * Authoritative single source of truth computation.
     *
     * @param donor Map of donor attributes (from database or DAO)
     * @return Map containing:
     *   - eligible: boolean
     *   - days_until_eligible: integer (0 if eligible)
     *   - last_donation_date: ISO date (YYYY-MM-DD) or null
     *   - next_eligible_date: ISO date (YYYY-MM-DD)
     *   - progress_pct: 0 to 100 integer (0 on day of donation, 100 on cooldown day)
     *   - cooldown_days: integer (default 90)
     *   - reason: short plain-English explanation
     */
    public static Map<String, Object> computeEligibility(Map<String, Object> donor) {
        Map<String, Object> res = new LinkedHashMap<>();
        String gender = donor != null && donor.get("gender") != null ? String.valueOf(donor.get("gender")) : null;
        int cooldown = getCooldownDays(gender);
        LocalDate today = LocalDate.now();

        if (donor == null) {
            res.put("eligible", false);
            res.put("days_until_eligible", cooldown);
            res.put("last_donation_date", null);
            res.put("next_eligible_date", today.plusDays(cooldown).toString());
            res.put("progress_pct", 0);
            res.put("cooldown_days", cooldown);
            res.put("reason", "Donor not found");
            addAliases(res);
            return res;
        }

        // 1. Check if donor is paused (via paused_until)
        LocalDate pauseUntil = parseDate(donor.get("paused_until"));
        if (pauseUntil == null) pauseUntil = parseDate(donor.get("pausedUntil"));
        boolean isPaused = pauseUntil != null && pauseUntil.isAfter(today);

        // 2. Parse last donation date
        LocalDate lastDonation = parseDate(donor.get("last_donation"));
        if (lastDonation == null) lastDonation = parseDate(donor.get("lastDonation"));
        if (lastDonation == null) lastDonation = parseDate(donor.get("lastDonationDate"));

        // Ignore known legacy placeholder dates
        if (lastDonation != null && "2024-01-10".equals(lastDonation.toString())) {
            lastDonation = null;
        }

        if (lastDonation == null) {
            // First-time donor (or never donated)
            if (isPaused) {
                int daysUntil = (int) ChronoUnit.DAYS.between(today, pauseUntil);
                res.put("eligible", false);
                res.put("days_until_eligible", Math.max(0, daysUntil));
                res.put("last_donation_date", null);
                res.put("next_eligible_date", pauseUntil.toString());
                res.put("progress_pct", 0);
                res.put("cooldown_days", cooldown);
                res.put("reason", "Temporarily paused until " + pauseUntil);
            } else {
                res.put("eligible", true);
                res.put("days_until_eligible", 0);
                res.put("last_donation_date", null);
                res.put("next_eligible_date", today.toString());
                res.put("progress_pct", 100);
                res.put("cooldown_days", cooldown);
                res.put("reason", "First-time donor - eligible today");
            }
            addAliases(res);
            return res;
        }

        // 3. Donor has donated before
        long daysSince = ChronoUnit.DAYS.between(lastDonation, today);
        if (daysSince < 0) {
            daysSince = 0; // Guard against future system clocks
        }
        LocalDate nextEligible = lastDonation.plusDays(cooldown);

        if (isPaused && pauseUntil.isAfter(nextEligible)) {
            // Paused beyond normal cooldown
            int daysUntil = (int) ChronoUnit.DAYS.between(today, pauseUntil);
            res.put("eligible", false);
            res.put("days_until_eligible", Math.max(0, daysUntil));
            res.put("last_donation_date", lastDonation.toString());
            res.put("next_eligible_date", pauseUntil.toString());
            int pct = (int) Math.min(100, Math.max(0, Math.round((daysSince * 100.0) / cooldown)));
            res.put("progress_pct", pct);
            res.put("cooldown_days", cooldown);
            res.put("reason", "Temporarily paused until " + pauseUntil);
            addAliases(res);
            return res;
        }

        if (daysSince >= cooldown) {
            if (isPaused) {
                int daysUntil = (int) ChronoUnit.DAYS.between(today, pauseUntil);
                res.put("eligible", false);
                res.put("days_until_eligible", Math.max(0, daysUntil));
                res.put("last_donation_date", lastDonation.toString());
                res.put("next_eligible_date", pauseUntil.toString());
                res.put("progress_pct", 100);
                res.put("cooldown_days", cooldown);
                res.put("reason", "Temporarily paused until " + pauseUntil);
            } else {
                res.put("eligible", true);
                res.put("days_until_eligible", 0);
                res.put("last_donation_date", lastDonation.toString());
                res.put("next_eligible_date", nextEligible.toString());
                res.put("progress_pct", 100);
                res.put("cooldown_days", cooldown);
                res.put("reason", "Eligible to donate");
            }
        } else {
            int daysLeft = (int) (cooldown - daysSince);
            int pct = (int) Math.min(100, Math.max(0, Math.round((daysSince * 100.0) / cooldown)));
            res.put("eligible", false);
            res.put("days_until_eligible", daysLeft);
            res.put("last_donation_date", lastDonation.toString());
            res.put("next_eligible_date", nextEligible.toString());
            res.put("progress_pct", pct);
            res.put("cooldown_days", cooldown);
            res.put("reason", "Eligible in " + daysLeft + (daysLeft == 1 ? " day" : " days"));
        }

        addAliases(res);
        return res;
    }

    /**
     * Attaches eligibility fields and an 'eligibility' sub-map directly to the donor map.
     */
    public static Map<String, Object> attachEligibility(Map<String, Object> donor) {
        if (donor == null) return null;
        Map<String, Object> elig = computeEligibility(donor);
        donor.put("eligibility", elig);
        donor.put("eligible", elig.get("eligible"));
        donor.put("isEligible", elig.get("eligible"));
        donor.put("days_until_eligible", elig.get("days_until_eligible"));
        donor.put("daysUntilEligible", elig.get("days_until_eligible"));
        donor.put("daysToNextEligible", elig.get("days_until_eligible"));
        donor.put("last_donation_date", elig.get("last_donation_date"));
        donor.put("lastDonationDate", elig.get("last_donation_date"));
        donor.put("next_eligible_date", elig.get("next_eligible_date"));
        donor.put("nextEligibleDate", elig.get("next_eligible_date"));
        donor.put("progress_pct", elig.get("progress_pct"));
        donor.put("progressPct", elig.get("progress_pct"));
        donor.put("cooldown_days", elig.get("cooldown_days"));
        donor.put("eligibilityReason", elig.get("reason"));
        return donor;
    }

    private static void addAliases(Map<String, Object> res) {
        // CamelCase aliases for backwards compatibility with any client scripts
        res.put("isEligible", res.get("eligible"));
        res.put("daysUntilEligible", res.get("days_until_eligible"));
        res.put("daysToNextEligible", res.get("days_until_eligible"));
        res.put("lastDonationDate", res.get("last_donation_date"));
        res.put("nextEligibleDate", res.get("next_eligible_date"));
        res.put("progressPct", res.get("progress_pct"));
        res.put("cooldownDays", res.get("cooldown_days"));
        res.put("eligibilityReason", res.get("reason"));
    }

    private static LocalDate parseDate(Object val) {
        if (val == null) return null;
        if (val instanceof LocalDate ld) return ld;
        if (val instanceof Date d) return d.toLocalDate();
        if (val instanceof java.util.Date ud) return new Date(ud.getTime()).toLocalDate();
        String s = String.valueOf(val).trim();
        if (s.isEmpty() || "null".equalsIgnoreCase(s) || "undefined".equalsIgnoreCase(s)) return null;
        // Strip time if present e.g. "2026-11-14 00:00:00" or ISO "2026-11-14T..."
        if (s.length() >= 10) {
            String ymd = s.substring(0, 10);
            try {
                return LocalDate.parse(ymd, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignored) {}
        }
        return null;
    }
}
