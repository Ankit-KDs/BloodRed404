package com.red404.service;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Authoritative Single Source of Truth for Donor Eligibility.
 * Implements ONE server function isEligible(donor) called by:
 * - Capsule, Donor Profile & Dashboard
 * - Emergencies page
 * - Hospital donor search
 * - Send single request & Broadcast
 * - Donation-drive invitations
 * - Check-in intake verdict
 * - Public counts & PlatformMetricsService
 */
public class DonorEligibilityService {

    public static final int DONATION_GAP_DAYS_MALE = 90;
    public static final int DONATION_GAP_DAYS_FEMALE = 120;
    public static final int DONATION_GAP_DAYS_UNSPECIFIED = 120;

    public static volatile int configuredMaleGap = DONATION_GAP_DAYS_MALE;
    public static volatile int configuredFemaleGap = DONATION_GAP_DAYS_FEMALE;
    public static volatile int configuredUnspecGap = DONATION_GAP_DAYS_UNSPECIFIED;

    public static synchronized void setDonationGapDays(int male, int female, int unspec) {
        if (male > 0) configuredMaleGap = male;
        if (female > 0) configuredFemaleGap = female;
        if (unspec > 0) configuredUnspecGap = unspec;
    }

    public static synchronized Map<String, Object> getDonationGapConfig() {
        Map<String, Object> cfg = new HashMap<>();
        cfg.put("maleGapDays", getCooldownDays("Male"));
        cfg.put("femaleGapDays", getCooldownDays("Female"));
        cfg.put("unspecifiedGapDays", getCooldownDays(null));
        return cfg;
    }

    public static int getCooldownDays() {
        return getCooldownDays(null);
    }

    public static int getCooldownDays(String gender) {
        int maleGap = getIntConfig("DONATION_GAP_DAYS_MALE", configuredMaleGap);
        int femaleGap = getIntConfig("DONATION_GAP_DAYS_FEMALE", configuredFemaleGap);
        int unspecGap = getIntConfig("DONATION_GAP_DAYS_UNSPECIFIED", configuredUnspecGap);

        if (gender == null || gender.isBlank()) {
            return unspecGap;
        }
        String g = gender.trim().toLowerCase();
        if (g.startsWith("f") || g.equals("female") || g.equals("woman")) {
            return femaleGap;
        }
        if (g.startsWith("m") || g.equals("male") || g.equals("man")) {
            return maleGap;
        }
        return unspecGap;
    }

    private static int getIntConfig(String key, int defaultVal) {
        try {
            String prop = System.getProperty(key);
            if (prop != null && !prop.isBlank()) return Integer.parseInt(prop.trim());
            String env = System.getenv(key);
            if (env != null && !env.isBlank()) return Integer.parseInt(env.trim());
        } catch (Exception ignored) {}
        return defaultVal;
    }

    /**
     * ONE server function isEligible(donor):
     * active account AND not paused AND (last_donation_date is null OR today >= last_donation_date + gap for the donor's gender)
     * AND no temporary deferral in force AND health status not rejected.
     */
    public static boolean isEligible(Map<String, Object> donor) {
        if (donor == null) return false;
        Map<String, Object> comp = computeEligibility(donor);
        return Boolean.TRUE.equals(comp.get("eligible"));
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
     *   - cooldown_days: integer (90 for male, 120 for female / unspecified)
     *   - reason: short plain-English explanation
     */
    public static Map<String, Object> computeEligibility(Map<String, Object> donor) {
        Map<String, Object> res = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();

        if (donor == null) {
            int cd = getCooldownDays(null);
            res.put("eligible", false);
            res.put("days_until_eligible", cd);
            res.put("last_donation_date", null);
            res.put("next_eligible_date", today.plusDays(cd).toString());
            res.put("progress_pct", 0);
            res.put("cooldown_days", cd);
            res.put("reason", "Donor not found");
            addAliases(res);
            return res;
        }

        String gender = str(donor.get("gender"));
        int cooldown = getCooldownDays(gender);

        // 1. Check active account (status != INACTIVE, BANNED, SUSPENDED, DELETED, deleted_at is null)
        String status = str(donor.get("status"));
        Object deletedAt = donor.get("deleted_at");
        Object isActiveObj = donor.get("is_active");
        boolean isActiveFalse = (isActiveObj instanceof Boolean b && !b);

        if (deletedAt != null || isActiveFalse || (status != null && (
                status.equalsIgnoreCase("INACTIVE") ||
                status.equalsIgnoreCase("BANNED") ||
                status.equalsIgnoreCase("SUSPENDED") ||
                status.equalsIgnoreCase("DELETED") ||
                status.equalsIgnoreCase("REJECTED")))) {
            res.put("eligible", false);
            res.put("days_until_eligible", cooldown);
            res.put("last_donation_date", null);
            res.put("next_eligible_date", today.plusDays(cooldown).toString());
            res.put("progress_pct", 0);
            res.put("cooldown_days", cooldown);
            res.put("reason", "Account is inactive or suspended");
            addAliases(res);
            return res;
        }

        // 2. Health status not rejected
        String healthStatus = str(donor.get("health_status"));
        if (healthStatus == null) healthStatus = str(donor.get("healthStatus"));
        if (healthStatus != null) {
            String hsLower = healthStatus.toLowerCase();
            if (hsLower.contains("rejected") || hsLower.contains("permanently") || hsLower.contains("unfit") || hsLower.contains("disqualified")) {
                res.put("eligible", false);
                res.put("days_until_eligible", cooldown);
                res.put("last_donation_date", null);
                res.put("next_eligible_date", today.plusDays(cooldown).toString());
                res.put("progress_pct", 0);
                res.put("cooldown_days", cooldown);
                res.put("reason", "Medical health status is rejected");
                addAliases(res);
                return res;
            }
        }

        // 3. No temporary deferral in force (deferred_until, deferral_until, deferredUntil)
        LocalDate deferralUntil = parseDate(donor.get("deferred_until"));
        if (deferralUntil == null) deferralUntil = parseDate(donor.get("deferral_until"));
        if (deferralUntil == null) deferralUntil = parseDate(donor.get("deferredUntil"));
        if (deferralUntil != null && deferralUntil.isAfter(today)) {
            int daysUntil = (int) ChronoUnit.DAYS.between(today, deferralUntil);
            res.put("eligible", false);
            res.put("days_until_eligible", Math.max(0, daysUntil));
            res.put("last_donation_date", null);
            res.put("next_eligible_date", deferralUntil.toString());
            res.put("progress_pct", 0);
            res.put("cooldown_days", cooldown);
            res.put("reason", "Temporary medical deferral until " + deferralUntil);
            addAliases(res);
            return res;
        }

        // 4. Check if donor is paused (availability != Paused/Unavailable/Busy/Off, paused_until > today)
        String avail = str(donor.get("availability"));
        Object isAvailObj = donor.get("available");
        boolean isAvailFalse = (isAvailObj instanceof Boolean b && !b);
        boolean isAvailPaused = (avail != null && (avail.equalsIgnoreCase("Paused")
                || avail.equalsIgnoreCase("Unavailable") || avail.equalsIgnoreCase("Busy") || avail.equalsIgnoreCase("Off")));

        LocalDate pauseUntil = parseDate(donor.get("paused_until"));
        if (pauseUntil == null) pauseUntil = parseDate(donor.get("pausedUntil"));
        boolean isPausedDate = (pauseUntil != null && pauseUntil.isAfter(today));

        boolean isPaused = isAvailFalse || isAvailPaused || isPausedDate;

        // 5. Parse last donation date
        LocalDate lastDonation = parseDate(donor.get("last_donation"));
        if (lastDonation == null) lastDonation = parseDate(donor.get("lastDonation"));
        if (lastDonation == null) lastDonation = parseDate(donor.get("lastDonationDate"));

        // Ignore legacy hardcoded placeholder dates
        if (lastDonation != null && "2024-01-10".equals(lastDonation.toString())) {
            lastDonation = null;
        }

        if (lastDonation == null) {
            // Never donated yet
            if (isPaused) {
                int daysUntil = pauseUntil != null ? (int) ChronoUnit.DAYS.between(today, pauseUntil) : cooldown;
                res.put("eligible", false);
                res.put("days_until_eligible", Math.max(0, daysUntil));
                res.put("last_donation_date", null);
                res.put("next_eligible_date", pauseUntil != null ? pauseUntil.toString() : today.plusDays(daysUntil).toString());
                res.put("progress_pct", 0);
                res.put("cooldown_days", cooldown);
                res.put("reason", pauseUntil != null ? "Temporarily paused until " + pauseUntil : "Donations currently paused");
            } else {
                res.put("eligible", true);
                res.put("days_until_eligible", 0);
                res.put("last_donation_date", null);
                res.put("next_eligible_date", today.toString());
                res.put("progress_pct", 100);
                res.put("cooldown_days", cooldown);
                res.put("reason", "No donation yet. You're ready.");
            }
            addAliases(res);
            return res;
        }

        // Donor has a recorded past donation
        long daysSince = ChronoUnit.DAYS.between(lastDonation, today);
        if (daysSince < 0) {
            daysSince = 0; // Guard against future clocks
        }
        LocalDate nextEligible = lastDonation.plusDays(cooldown);

        if (isPaused && pauseUntil != null && pauseUntil.isAfter(nextEligible)) {
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
                int daysUntil = pauseUntil != null ? (int) ChronoUnit.DAYS.between(today, pauseUntil) : 1;
                res.put("eligible", false);
                res.put("days_until_eligible", Math.max(0, daysUntil));
                res.put("last_donation_date", lastDonation.toString());
                res.put("next_eligible_date", pauseUntil != null ? pauseUntil.toString() : today.plusDays(daysUntil).toString());
                res.put("progress_pct", 100);
                res.put("cooldown_days", cooldown);
                res.put("reason", pauseUntil != null ? "Temporarily paused until " + pauseUntil : "Donations currently paused");
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
            String nextDateFormatted = nextEligible.format(java.time.format.DateTimeFormatter.ofPattern("d MMM uuuu", java.util.Locale.ENGLISH));
            res.put("reason", "Next eligible on " + nextDateFormatted + " (" + daysLeft + (daysLeft == 1 ? " day" : " days") + ")");
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
        if (s.length() >= 10) {
            String ymd = s.substring(0, 10);
            try {
                return LocalDate.parse(ymd, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ignored) {}
        }
        return null;
    }

    private static String str(Object val) {
        return val != null ? String.valueOf(val).trim() : null;
    }
}
