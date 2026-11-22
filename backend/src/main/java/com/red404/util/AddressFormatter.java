package com.red404.util;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared formatter and parser for structured Indian addresses.
 * Ensures display lines follow the standard order:
 * line1, locality, city, district, state, PIN: <pin>, country
 * and eliminates duplicate or redundant segments.
 */
public class AddressFormatter {

    private static final Set<String> INDIAN_STATES = new HashSet<>(Arrays.asList(
            "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "delhi", "goa",
            "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh",
            "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan",
            "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
            "chandigarh", "puducherry", "ladakh", "jammu and kashmir"
    ));

    private static final Pattern PIN_PATTERN = Pattern.compile("\\b(\\d{6})\\b");

    /**
     * Builds a single clean display line from structured address fields.
     * Order: line1, locality, city, district, state, PIN, country.
     * Removes repeated components case-insensitively.
     */
    public static String formatAddress(String line1, String locality, String city, String district,
                                       String state, String pincode, String country) {
        List<String> rawCandidates = new ArrayList<>();
        if (line1 != null && !line1.isBlank()) rawCandidates.add(line1.trim());
        if (locality != null && !locality.isBlank()) rawCandidates.add(locality.trim());
        if (city != null && !city.isBlank()) rawCandidates.add(city.trim());
        if (district != null && !district.isBlank()) {
            // Skip district if identical to city (e.g. Nainital, Nainital)
            if (city == null || !district.trim().equalsIgnoreCase(city.trim())) {
                rawCandidates.add(district.trim());
            }
        }
        if (state != null && !state.isBlank()) rawCandidates.add(state.trim());
        if (pincode != null && !pincode.isBlank()) {
            String cleanPin = pincode.replaceAll("[^0-9]", "").trim();
            if (!cleanPin.isBlank()) {
                rawCandidates.add("PIN: " + cleanPin);
            }
        }
        rawCandidates.add((country != null && !country.isBlank()) ? country.trim() : "India");

        List<String> finalParts = new ArrayList<>();
        Set<String> seenTokens = new HashSet<>();

        for (String candidate : rawCandidates) {
            if (candidate == null || candidate.isBlank()) continue;

            // If a candidate already has comma-separated subsegments, process each
            String[] segments = candidate.split(",");
            for (String seg : segments) {
                String trimmed = seg.trim();
                if (trimmed.isEmpty()) continue;

                String lower = trimmed.toLowerCase();
                String tokenWithoutPin = lower.replace("pin:", "").replace("pin", "").trim();

                if (seenTokens.contains(lower) || (!tokenWithoutPin.isEmpty() && seenTokens.contains(tokenWithoutPin))) {
                    continue;
                }

                seenTokens.add(lower);
                if (!tokenWithoutPin.isEmpty()) {
                    seenTokens.add(tokenWithoutPin);
                }
                finalParts.add(trimmed);
            }
        }

        return String.join(", ", finalParts);
    }

    /**
     * Parses an old combined address string into structured parts.
     * Where possible, extracts line1, locality, district, city, state, pin, and country.
     * If parsing is ambiguous, preserves the original string in line1 without data loss.
     */
    public static Map<String, String> parseOldAddress(String raw, String cityIn, String stateIn, String pinIn) {
        Map<String, String> result = new LinkedHashMap<>();
        String foundCity = (cityIn != null && !cityIn.isBlank()) ? cityIn.trim() : "";
        String foundState = (stateIn != null && !stateIn.isBlank()) ? stateIn.trim() : "";
        String foundPin = (pinIn != null && !pinIn.isBlank()) ? pinIn.replaceAll("[^0-9]", "").trim() : "";
        String foundCountry = "India";
        String foundDistrict = "";
        String foundLocality = "";
        String foundLine1 = "";

        if (raw == null || raw.isBlank()) {
            result.put("line1", "");
            result.put("locality", "");
            result.put("city", foundCity);
            result.put("district", foundDistrict);
            result.put("state", foundState);
            result.put("pincode", foundPin);
            result.put("country", foundCountry);
            return result;
        }

        String[] parts = raw.split(",");
        List<String> remaining = new ArrayList<>();

        for (String p : parts) {
            String trimmed = p.trim();
            if (trimmed.isEmpty()) continue;
            String lower = trimmed.toLowerCase();

            if ("india".equals(lower)) {
                foundCountry = "India";
                continue;
            }

            Matcher pinM = PIN_PATTERN.matcher(trimmed);
            if (pinM.find()) {
                if (foundPin.isEmpty()) {
                    foundPin = pinM.group(1);
                }
                continue;
            }

            if (INDIAN_STATES.contains(lower)) {
                if (foundState.isEmpty()) {
                    foundState = trimmed;
                }
                continue;
            }

            remaining.add(trimmed);
        }

        // Filter out redundant city if cityIn already matches
        List<String> finalSegs = new ArrayList<>();
        for (String r : remaining) {
            if (!foundCity.isEmpty() && r.equalsIgnoreCase(foundCity)) {
                continue;
            }
            finalSegs.add(r);
        }

        // Check if the last segment looks like a district
        if (finalSegs.size() >= 2) {
            String last = finalSegs.get(finalSegs.size() - 1).toLowerCase();
            if (last.contains("district") || last.equals("nainital") || last.equals("dehradun") || last.equals("haridwar") || last.equals("meerut")) {
                foundDistrict = finalSegs.remove(finalSegs.size() - 1);
            }
        }

        // If city is empty but segments remain, extract city from the last segment
        if (foundCity.isEmpty() && finalSegs.size() >= 2) {
            foundCity = finalSegs.remove(finalSegs.size() - 1);
        }

        if (finalSegs.isEmpty()) {
            foundLine1 = "";
            foundLocality = "";
        } else if (finalSegs.size() == 1) {
            foundLocality = finalSegs.get(0);
            foundLine1 = finalSegs.get(0);
        } else if (finalSegs.size() == 2) {
            foundLine1 = finalSegs.get(0);
            foundLocality = finalSegs.get(1);
        } else {
            foundLocality = finalSegs.remove(finalSegs.size() - 1);
            foundLine1 = String.join(", ", finalSegs);
        }

        result.put("line1", foundLine1);
        result.put("locality", foundLocality);
        result.put("city", foundCity);
        result.put("district", foundDistrict);
        result.put("state", foundState);
        result.put("pincode", foundPin);
        result.put("country", foundCountry);
        return result;
    }
}
