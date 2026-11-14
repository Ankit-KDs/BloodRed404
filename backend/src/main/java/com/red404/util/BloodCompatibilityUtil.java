package com.red404.util;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * RED404 Core Shared Blood Compatibility Engine.
 *
 * Recipient group -> donor groups that can donate to it:
 * O-  : O-
 * O+  : O+, O-
 * A-  : A-, O-
 * A+  : A+, A-, O+, O-
 * B-  : B-, O-
 * B+  : B+, B-, O+, O-
 * AB- : AB-, A-, B-, O-
 * AB+ : AB+, AB-, A+, A-, B+, B-, O+, O-
 */
public final class BloodCompatibilityUtil {

    private static final Map<String, List<String>> COMPATIBILITY_MAP = new HashMap<>();

    static {
        COMPATIBILITY_MAP.put("O-",  List.of("O-"));
        COMPATIBILITY_MAP.put("O+",  List.of("O+", "O-"));
        COMPATIBILITY_MAP.put("A-",  List.of("A-", "O-"));
        COMPATIBILITY_MAP.put("A+",  List.of("A+", "A-", "O+", "O-"));
        COMPATIBILITY_MAP.put("B-",  List.of("B-", "O-"));
        COMPATIBILITY_MAP.put("B+",  List.of("B+", "B-", "O+", "O-"));
        COMPATIBILITY_MAP.put("AB-", List.of("AB-", "A-", "B-", "O-"));
        COMPATIBILITY_MAP.put("AB+", List.of("AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"));
    }

    private BloodCompatibilityUtil() {}

    /**
     * Returns an unmodifiable list of donor blood groups compatible with the recipient.
     * The exact match group is always first.
     */
    public static List<String> getCompatibleDonorGroups(String recipientGroup) {
        if (recipientGroup == null) return Collections.emptyList();
        String key = recipientGroup.trim().toUpperCase();
        return COMPATIBILITY_MAP.getOrDefault(key, Collections.emptyList());
    }

    /**
     * Checks if a donor blood group can donate to a recipient blood group.
     */
    public static boolean isCompatible(String donorGroup, String recipientGroup) {
        if (donorGroup == null || recipientGroup == null) return false;
        List<String> compatible = getCompatibleDonorGroups(recipientGroup);
        return compatible.contains(donorGroup.trim().toUpperCase());
    }

    /**
     * Checks if a donor blood group is compatible with ANY of the required blood groups.
     */
    public static boolean isCompatibleWithAny(String donorGroup, Iterable<String> recipientGroups) {
        if (donorGroup == null || recipientGroups == null) return false;
        for (String rec : recipientGroups) {
            if (isCompatible(donorGroup, rec)) return true;
        }
        return false;
    }
}

