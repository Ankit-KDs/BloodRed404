package com.red404.controller;

/*
 * DATA FLOW:
 * Search donors -> results (table + map). Send / Broadcast -> donor receives request with hospital location -> donor taps directions (live GPS -> hospital) -> donor accepts -> hospital sees status Accepted and the phone number. Donation drive -> non-urgent invitation -> donor RSVP -> hospital sees RSVP count. Stock changes only via Inventory.
 */

import com.fasterxml.jackson.databind.JsonNode;
import com.red404.dao.BloodRequestDao;
import com.red404.dao.DonorDao;
import com.red404.dao.HospitalDao;
import com.red404.model.ApiResponse;
import com.red404.service.DonorEligibilityService;
import com.red404.util.DBConnection;
import com.red404.util.DistanceCalculator;
import com.red404.util.JsonUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// Hospital Controller endpoints
@RestController
@RequestMapping({"/api/hospitals", "/api/hospital"})
public class HospitalController {

    private final HospitalDao hospitalDao = new HospitalDao();
    private final DonorDao donorDao = new DonorDao();
    private final BloodRequestDao requestDao = new BloodRequestDao();
    private final com.red404.dao.DonationDriveDao donationDriveDao = new com.red404.dao.DonationDriveDao();
    private final com.red404.dao.BloodRequestNotificationDao notificationDao = new com.red404.dao.BloodRequestNotificationDao();
    private final com.red404.dao.BloodGroupAuditDao bloodGroupAuditDao = new com.red404.dao.BloodGroupAuditDao();

    private static final Map<Integer, List<Long>> LOOKUP_RATE_LIMITS = new java.util.concurrent.ConcurrentHashMap<>();
    private static final int MAX_LOOKUPS_PER_MINUTE = 30;

    private synchronized boolean checkLookupRateLimit(int hospitalId) {
        long now = System.currentTimeMillis();
        List<Long> timestamps = LOOKUP_RATE_LIMITS.computeIfAbsent(hospitalId, k -> new ArrayList<>());
        timestamps.removeIf(t -> (now - t) > 60_000L);
        if (timestamps.size() >= MAX_LOOKUPS_PER_MINUTE) {
            return false;
        }
        timestamps.add(now);
        return true;
    }

    // ======================== GET ========================

    @GetMapping({"/directory", "/public-list", "/search", "/list"})
    public ResponseEntity<ApiResponse> getRegisteredHospitals(
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng) {
        try {
            List<Map<String, Object>> allHospitals = hospitalDao.listAll();
            List<Map<String, Object>> filtered = new ArrayList<>();
            for (Map<String, Object> h : allHospitals) {
                // Only hospitals with verification status = Verified count as partner hospitals and appear in public directory (Part 1 & Part 3)
                String vStatus = (String) h.get("verificationStatus");
                if (vStatus == null) vStatus = (String) h.get("verification_status");
                if (vStatus == null || !"Verified".equalsIgnoreCase(vStatus.trim())) {
                    continue;
                }

                String hState = (String) h.get("state");
                String hCity = (String) h.get("city");
                String hDistrict = (String) h.get("district");
                String hAddress = (String) h.get("address");
                String hName = (String) h.get("name");

                boolean matchesState = (state == null || state.isBlank() || state.equalsIgnoreCase("ALL") || 
                        (hState != null && hState.equalsIgnoreCase(state.trim())));

                String targetDistrict = (district != null && !district.isBlank()) ? district : city;
                boolean matchesDistrict = (targetDistrict == null || targetDistrict.isBlank() || targetDistrict.equalsIgnoreCase("ALL"));
                
                if (!matchesDistrict && targetDistrict != null) {
                    String cleanTarget = targetDistrict.trim().toLowerCase();
                    boolean dMatch = (hDistrict != null && (hDistrict.equalsIgnoreCase(targetDistrict) || hDistrict.toLowerCase().contains(cleanTarget) || cleanTarget.contains(hDistrict.toLowerCase())));
                    boolean cMatch = (hCity != null && (hCity.equalsIgnoreCase(targetDistrict) || hCity.toLowerCase().contains(cleanTarget) || cleanTarget.contains(hCity.toLowerCase())));
                    boolean aMatch = (hAddress != null && hAddress.toLowerCase().contains(cleanTarget));
                    boolean nMatch = (hName != null && hName.toLowerCase().contains(cleanTarget));
                    boolean isNainitalBhimtal = (cleanTarget.contains("nainital") && (
                            (hCity != null && hCity.toLowerCase().contains("bhimtal")) ||
                            (hAddress != null && hAddress.toLowerCase().contains("bhimtal")) ||
                            (hName != null && hName.toLowerCase().contains("bhimtal"))
                    ));
                    matchesDistrict = dMatch || cMatch || aMatch || nMatch || isNainitalBhimtal;
                }

                if (matchesState && matchesDistrict) {
                    try {
                        int hid = ((Number) h.get("id")).intValue();
                        Map<String, Integer> inv = hospitalDao.getHospitalInventory(hid);
                        h.put("inventory", inv);
                        int total = 0;
                        for (int u : inv.values()) total += u;
                        h.put("totalStock", total);
                    } catch (Exception ignored) {}

                    // Compute distance if coordinates provided
                    if (lat != null && lng != null && h.get("latitude") != null && h.get("longitude") != null) {
                        try {
                            double hLat = ((Number) h.get("latitude")).doubleValue();
                            double hLng = ((Number) h.get("longitude")).doubleValue();
                            double d = DistanceCalculator.calculateDistance(lat, lng, hLat, hLng);
                            h.put("distanceKm", Math.round(d * 10.0) / 10.0);
                        } catch (Exception ignored) {}
                    }
                    filtered.add(h);
                }
            }
            return ok("Registered hospitals loaded", filtered);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse> getProfile(HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) {
                Map<String, Object> hospital = requireHospital(request);
                if (hospital != null && hospital.get("id") != null) {
                    hospitalId = ((Number) hospital.get("id")).intValue();
                }
            }
            if (hospitalId == null) {
                List<Map<String, Object>> all = hospitalDao.listAll();
                if (!all.isEmpty()) hospitalId = ((Number) all.get(0).get("id")).intValue();
            }
            if (hospitalId != null) {
                Map<String, Object> profile = hospitalDao.findById(hospitalId);
                if (profile != null) {
                    HttpSession session = request.getSession(false);
                    if (session != null) {
                        session.setAttribute("hospitalUser", profile);
                    }
                    return ok("Profile loaded", profile);
                }
            }
            return unauthorized();
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/donors/search", "/donors/nearby", "/donors"})
    public ResponseEntity<ApiResponse> searchMatchingDonors(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "10") double radius,
            @RequestParam(required = false) String bloodType,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;

            if (lat == null || lng == null) {
                Map<String, Object> hospital = hospitalDao.findById(hospitalId);
                if (hospital != null) {
                    lat = asDouble(hospital.get("latitude"));
                    lng = asDouble(hospital.get("longitude"));
                }
            }

            if (bloodType == null || bloodType.isBlank()) {
                // Before search: return empty structure
                return ok("Select a blood group and search to see matching donors.", Map.of(
                        "donors", Collections.emptyList(),
                        "totalMatches", 0,
                        "unlocatedCount", 0,
                        "availableCount", 0
                ));
            }

            Map<String, Object> result = donorDao.searchMatchingDonorsForHospital(lat, lng, radius, bloodType, hospitalId);
            return ok("Matching donors loaded", result);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/requests/send-single")
    public ResponseEntity<ApiResponse> sendSingleDonorRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            int donorId = JsonUtil.asInt(body, "donorId", 0);
            if (donorId <= 0) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Valid donor ID is required."));
            }

            // Authoritative ONE server function isEligible(donor) (Step 1 requirement 2 & 3)
            Map<String, Object> targetDonor = donorDao.findById(donorId);
            if (targetDonor == null || !DonorEligibilityService.isEligible(targetDonor)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse(false, "Donor is currently not eligible to receive emergency requests (recently donated, paused, deferred or inactive)."));
            }
            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            int units = JsonUtil.asInt(body, "unitsNeeded", 1);
            String patientName = JsonUtil.textOrNull(body, "patientName");
            if (patientName == null || patientName.isBlank()) patientName = "Emergency Patient";
            String notes = JsonUtil.textOrNull(body, "notes");
            Double radVal = JsonUtil.asDouble(body, "radius");
            double radius = radVal != null ? radVal : 10.0;

            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            Double lat = hosp != null ? asDouble(hosp.get("latitude")) : null;
            Double lng = hosp != null ? asDouble(hosp.get("longitude")) : null;

            Map<String, Object> reqPayload = new HashMap<>();
            reqPayload.put("hospitalId", hospitalId);
            reqPayload.put("patientName", patientName);
            reqPayload.put("bloodType", bloodType != null ? bloodType : "O-");
            reqPayload.put("unitsRequested", units);
            reqPayload.put("urgencyLevel", "HIGH");
            reqPayload.put("latitude", lat);
            reqPayload.put("longitude", lng);
            reqPayload.put("notes", notes);
            reqPayload.put("notificationRadius", (int) radius);
            int reqId = requestDao.insert(reqPayload);

            notificationDao.notifyDonor(reqId, donorId, hospitalId, bloodType, units, patientName, notes);

            Map<String, Object> resp = new HashMap<>();
            resp.put("requestId", reqId);
            resp.put("donorId", donorId);
            resp.put("status", "Notified");

            return ok("Request sent to donor successfully", resp);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/requests/broadcast-matching")
    public ResponseEntity<ApiResponse> broadcastMatchingDonors(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            List<Integer> donorIds = new ArrayList<>();
            if (body.has("donorIds") && body.get("donorIds").isArray()) {
                for (JsonNode n : body.get("donorIds")) {
                    donorIds.add(n.asInt());
                }
            }
            if (donorIds.isEmpty()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "No available matching donors to broadcast to."));
            }
            // Authoritative ONE server function isEligible(donor) (Step 1 requirement 2 & 3)
            List<Integer> activeDonorIds = new ArrayList<>();
            for (Integer dId : donorIds) {
                Map<String, Object> d = donorDao.findById(dId);
                if (d != null && DonorEligibilityService.isEligible(d)) {
                    activeDonorIds.add(dId);
                }
            }
            if (activeDonorIds.isEmpty()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "No eligible matching donors to broadcast to (donors may be recently donated, paused, or deferred)."));
            }

            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            int units = JsonUtil.asInt(body, "unitsNeeded", 1);
            String patientName = JsonUtil.textOrNull(body, "patientName");
            if (patientName == null || patientName.isBlank()) patientName = "Emergency Patient";
            String notes = JsonUtil.textOrNull(body, "notes");
            Double radVal = JsonUtil.asDouble(body, "radius");
            double radius = radVal != null ? radVal : 10.0;

            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            Double lat = hosp != null ? asDouble(hosp.get("latitude")) : null;
            Double lng = hosp != null ? asDouble(hosp.get("longitude")) : null;

            Map<String, Object> reqPayload = new HashMap<>();
            reqPayload.put("hospitalId", hospitalId);
            reqPayload.put("patientName", patientName);
            reqPayload.put("bloodType", bloodType != null ? bloodType : "O-");
            reqPayload.put("unitsRequested", units);
            reqPayload.put("urgencyLevel", "HIGH");
            reqPayload.put("latitude", lat);
            reqPayload.put("longitude", lng);
            reqPayload.put("notes", notes);
            reqPayload.put("notificationRadius", (int) radius);
            int reqId = requestDao.insert(reqPayload);

            notificationDao.broadcastToDonors(reqId, activeDonorIds, hospitalId, bloodType, units, patientName, notes);

            Map<String, Object> resp = new HashMap<>();
            resp.put("requestId", reqId);
            resp.put("notifiedCount", activeDonorIds.size());
            resp.put("status", "Notified");

            return ok("Broadcast dispatched to " + activeDonorIds.size() + " matching donors", resp);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping({"/requests/active", "/requests"})
    public ResponseEntity<ApiResponse> getActiveRequests(HttpServletRequest request) {
        try {
            Integer hospId = getHospitalId(request);
            List<Map<String, Object>> list = (hospId != null)
                    ? requestDao.listByHospital(hospId)
                    : requestDao.listActive();
            enrichAndSanitizeRequests(list);
            return ok("Requests loaded", list);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/requests/history")
    public ResponseEntity<ApiResponse> getRequestsHistory(HttpServletRequest request) {
        try {
            Integer hospId = getHospitalId(request);
            List<Map<String, Object>> list = (hospId != null)
                    ? requestDao.listByHospital(hospId)
                    : requestDao.listActive();
            enrichAndSanitizeRequests(list);

            int activeNow = 0;
            int fulfilledThisMonth = 0;
            int cancelledThisMonth = 0;
            double totalFirstRespMins = 0;
            int respCount = 0;

            java.time.LocalDate now = java.time.LocalDate.now();
            int currentYear = now.getYear();
            int currentMonth = now.getMonthValue();

            for (Map<String, Object> reqItem : list) {
                String st = reqItem.get("status") != null ? reqItem.get("status").toString().toLowerCase() : "";
                if (st.equals("active") || st.equals("open") || st.equals("accepted") || st.equals("arrived")) {
                    activeNow++;
                }

                String createdStr = (String) reqItem.get("createdAt");
                if (createdStr == null) createdStr = (String) reqItem.get("time");
                if (createdStr != null && createdStr.length() >= 7) {
                    try {
                        String[] parts = createdStr.substring(0, 10).split("-");
                        int y = Integer.parseInt(parts[0]);
                        int m = Integer.parseInt(parts[1]);
                        if (y == currentYear && m == currentMonth) {
                            if (st.equals("fulfilled")) {
                                fulfilledThisMonth++;
                            } else if (st.equals("cancelled")) {
                                cancelledThisMonth++;
                            }
                        }
                    } catch (Exception ignored) {}
                }

                Object frMin = reqItem.get("firstResponseMin");
                if (frMin instanceof Number) {
                    totalFirstRespMins += ((Number) frMin).doubleValue();
                    respCount++;
                }
            }

            Map<String, Object> summary = new HashMap<>();
            summary.put("activeNow", activeNow);
            summary.put("fulfilledThisMonth", fulfilledThisMonth);
            summary.put("cancelledThisMonth", cancelledThisMonth);
            if (respCount >= 5) {
                long avg = Math.round(totalFirstRespMins / respCount);
                summary.put("avgFirstResponseMin", avg);
                summary.put("avgFirstResponseText", avg + " min");
            } else {
                summary.put("avgFirstResponseMin", null);
                summary.put("avgFirstResponseText", "No data yet");
            }
            summary.put("totalRequests", list.size());

            Map<String, Object> respData = new HashMap<>();
            respData.put("summary", summary);
            respData.put("requests", list);

            return ok("History loaded", respData);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/dispatch-log")
    public ResponseEntity<ApiResponse> getDispatchLog() {
        try {
            List<Map<String, Object>> list = requestDao.listActive();
            enrichAndSanitizeRequests(list);
            return ok("Log loaded", list);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    private void enrichAndSanitizeRequests(List<Map<String, Object>> list) {
        if (list == null) return;
        com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();
        for (Map<String, Object> reqItem : list) {
            int reqId = reqItem.get("id") != null ? ((Number) reqItem.get("id")).intValue() : 0;
            String reqStatus = reqItem.get("status") != null ? reqItem.get("status").toString() : "";
            Map<String, Object> acceptedDonor = (reqId > 0) ? notifDao.getAcceptedDonorForRequest(reqId) : null;
            if (acceptedDonor != null) {
                reqItem.put("donorId", acceptedDonor.get("donorId"));
                reqItem.put("donorName", acceptedDonor.get("donorName"));
                reqItem.put("donorBloodType", acceptedDonor.get("donorBloodType"));
                reqItem.put("donorDistance", acceptedDonor.get("donorDistance"));
                reqItem.put("donorPhone", acceptedDonor.get("donorPhone"));
                reqItem.put("phone", acceptedDonor.get("donorPhone"));
            } else if (!"Accepted".equalsIgnoreCase(reqStatus) && !"On the way".equalsIgnoreCase(reqStatus) && !"Arrived".equalsIgnoreCase(reqStatus)) {
                reqItem.remove("donorPhone");
                reqItem.remove("phone");
                reqItem.remove("contact_number");
                reqItem.remove("contactNumber");
            }
        }
    }

    @PostMapping("/donors/{id}/notify")
    public ResponseEntity<ApiResponse> notifyDonor(@PathVariable int id) {
        return ok("Notification sent to donor #" + id, null);
    }

    @PostMapping("/requests/{id}/cancel")
    public ResponseEntity<ApiResponse> cancelRequest(
            @PathVariable int id,
            @RequestBody(required = false) JsonNode body) {
        try {
            String reason = body != null ? JsonUtil.textOrNull(body, "reason") : null;
            if (reason == null || reason.trim().length() < 3) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Cancellation reason is required (minimum 3 characters)."));
            }
            requestDao.updateStatusWithReason(id, "Cancelled", reason.trim());
            return ok("Request cancelled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/requests/{id}/fulfill")
    public ResponseEntity<ApiResponse> fulfillRequest(
            @PathVariable int id,
            @RequestBody(required = false) JsonNode body) {
        try {
            String note = body != null ? JsonUtil.textOrNull(body, "note") : null;
            if (note == null || note.trim().length() < 3) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Fulfillment note is required when manually marking a request as fulfilled."));
            }
            requestDao.updateStatusWithNote(id, "Fulfilled", note.trim());
            return ok("Request marked as fulfilled", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/requests/{id}/donors")
    public ResponseEntity<ApiResponse> getRequestDonors(@PathVariable int id) {
        try {
            com.red404.dao.BloodRequestNotificationDao notifDao = new com.red404.dao.BloodRequestNotificationDao();
            return ok("Donors loaded", notifDao.getDonorsForRequest(id));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/requests/{id}/extend-radius")
    public ResponseEntity<ApiResponse> extendRadius(
            @PathVariable int id,
            @RequestBody JsonNode body) {
        try {
            double radius = 15.0;
            if (body != null && body.has("radius")) {
                radius = body.get("radius").asDouble();
            } else if (body != null && body.has("radiusKm")) {
                radius = body.get("radiusKm").asDouble();
            }
            if (radius < 1.0 || radius > 100.0) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Radius must be between 1 and 100 km."));
            }
            requestDao.updateRadius(id, radius);
            return ok("Radius extended to " + radius + " km", Map.of("id", id, "radius", radius));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/requests", "/requests/dispatch"})
    public ResponseEntity<ApiResponse> createRequest(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) {
                hospitalId = JsonUtil.asInt(body, "hospitalId", 0);
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("hospitalId", hospitalId != null && hospitalId > 0 ? hospitalId : 1);
            payload.put("patientName", JsonUtil.textOrNull(body, "patientName"));
            payload.put("bloodType", JsonUtil.text(body, "bloodType"));
            payload.put("unitsRequested", JsonUtil.asInt(body, "unitsNeeded", 1));
            payload.put("urgencyLevel", JsonUtil.text(body, "urgencyLevel"));
            payload.put("requiredBefore", JsonUtil.textOrNull(body, "requiredBefore"));
            payload.put("latitude", JsonUtil.asDouble(body, "latitude"));
            payload.put("longitude", JsonUtil.asDouble(body, "longitude"));
            payload.put("notes", JsonUtil.textOrNull(body, "notes"));
            payload.put("notificationRadius", JsonUtil.asInt(body, "notificationRadius", 5));
            int id = requestDao.insert(payload);
            payload.put("id", id);
            payload.put("status", "Pending");
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Emergency blood request dispatched successfully!", payload));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== POST ========================

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            String email = JsonUtil.text(body, "hospitalEmail").trim().toLowerCase();
            String adminEmail = JsonUtil.text(body, "adminEmail").trim().toLowerCase();
            String hospitalPhone = JsonUtil.text(body, "hospitalPhone").trim().replaceAll("\\s+", "");
            String adminPhone = JsonUtil.text(body, "adminPhone").trim().replaceAll("\\s+", "");
            if (hospitalDao.emailExists(email)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new ApiResponse(false, "Hospital email already registered."));
            }
            List<String> services = new ArrayList<>();
            if (body.has("services") && body.get("services").isArray()) {
                for (JsonNode node : body.get("services")) {
                    services.add(node.asText());
                }
            }
            Map<String, Object> hospital = new HashMap<>();
            hospital.put("hospitalName", JsonUtil.text(body, "hospitalName").trim());
            hospital.put("registrationNo", JsonUtil.text(body, "registrationNo").trim());
            hospital.put("hospitalType", JsonUtil.text(body, "hospitalType"));
            hospital.put("beds", JsonUtil.asInt(body, "beds", 0));
            hospital.put("bloodBankLicense", JsonUtil.textOrNull(body, "bloodBankLicense"));
            hospital.put("hospitalEmail", email);
            hospital.put("hospitalPhone", hospitalPhone);
            hospital.put("website", JsonUtil.textOrNull(body, "website"));
            hospital.put("services", String.join(",", services));
            hospital.put("adminName", (JsonUtil.text(body, "adminFirstName") + " " + JsonUtil.text(body, "adminLastName")).trim());
            hospital.put("adminDesignation", JsonUtil.text(body, "adminDesignation"));
            hospital.put("adminPhone", adminPhone);
            hospital.put("adminEmail", adminEmail);
            hospital.put("password", JsonUtil.text(body, "password"));
            hospital.put("emergencyContact", JsonUtil.text(body, "emergencyContact"));
            hospital.put("address", JsonUtil.text(body, "address"));
            hospital.put("landmark", JsonUtil.textOrNull(body, "landmark"));
            hospital.put("city", JsonUtil.text(body, "city"));
            hospital.put("state", JsonUtil.text(body, "state"));
            hospital.put("pincode", JsonUtil.text(body, "pincode"));
            Double latitude = JsonUtil.asDouble(body, "latitude");
            Double longitude = JsonUtil.asDouble(body, "longitude");

            // Strict backend validation: hospital location coordinates are required and must be within valid range
            if (latitude == null || longitude == null || latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Valid latitude (between -90 and 90) and longitude (between -180 and 180) are required for hospital location."));
            }

            hospital.put("latitude", latitude);
            hospital.put("longitude", longitude);
            hospital.put("zone", JsonUtil.textOrNull(body, "zone"));
            hospital.put("operatingHours", JsonUtil.textOrNull(body, "operatingHours") == null ? "24x7" : JsonUtil.text(body, "operatingHours"));
            hospital.put("zoneRadius", JsonUtil.asInt(body, "zoneRadius", 10));
            hospital.put("smsNotif", JsonUtil.asBoolean(body, "smsNotif", true));
            hospital.put("pushNotif", JsonUtil.asBoolean(body, "pushNotif", true));
            hospital.put("emailNotif", JsonUtil.asBoolean(body, "emailNotif", false));

            if (hospitalDao.insert(hospital)) {
                Map<String, Object> registeredHosp = hospitalDao.findByLogin(email, (String) hospital.get("password"));
                if (registeredHosp == null) {
                    registeredHosp = hospital;
                }
                HttpSession session = request.getSession(true);
                session.setAttribute("hospitalUser", registeredHosp);
                session.setAttribute("role", "HOSPITAL");
                Map<String, Object> wrapper = new HashMap<>();
                wrapper.put("hospital", registeredHosp);
                wrapper.put("token", "SESSION-HOSPITAL-" + registeredHosp.get("id"));
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(new ApiResponse(true, "Hospital Registered Successfully!", wrapper));
            } else {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Registration Failed."));
            }
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(@RequestBody JsonNode body, HttpServletRequest request) {
        try {
            Map<String, Object> hospital = hospitalDao.findByLogin(JsonUtil.text(body, "email"), JsonUtil.text(body, "password"));
            if (hospital == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ApiResponse(false, "Invalid credentials for hospital account."));
            }
            HttpSession session = request.getSession(true);
            session.setAttribute("hospitalUser", hospital);
            session.setAttribute("role", "HOSPITAL");
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("hospital", hospital);
            wrapper.put("token", "SESSION-HOSPITAL-" + hospital.get("id"));
            return ok("Login Successful", wrapper);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== INVENTORY & SETTINGS ========================

    @GetMapping("/inventory")
    public ResponseEntity<ApiResponse> getInventory(HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            Map<String, Integer> inv = hospitalDao.getHospitalInventory(hospitalId);
            return ok("Hospital inventory loaded", inv);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @RequestMapping(value = "/inventory", method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ApiResponse> updateInventory(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null && body != null && body.has("hospitalId")) {
                hospitalId = JsonUtil.asInt(body, "hospitalId", 1);
            }
            if (hospitalId == null) hospitalId = 1;

            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            if (bloodType == null || bloodType.isBlank()) bloodType = "A+";
            int change = JsonUtil.asInt(body, "change", 0);
            Integer exactUnits = (body != null && body.has("units")) ? JsonUtil.asInt(body, "units", -1) : null;
            if (exactUnits != null && exactUnits < 0) exactUnits = null;

            hospitalDao.updateHospitalInventory(hospitalId, bloodType, change, exactUnits);

            // Fetch live aggregated stock and broadcast to all connected clients in real time
            Map<String, Object> nationalStock = donorDao.getNationalBloodStock();
            SystemController.broadcastStockUpdate(nationalStock);

            return ok("Inventory updated successfully", nationalStock);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== DONATION DRIVES ========================

    @GetMapping("/drives")
    public ResponseEntity<ApiResponse> getDrives(HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            List<Map<String, Object>> drives = donationDriveDao.listDrivesForHospital(hospitalId);
            return ok("Donation drives loaded", drives);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/drives")
    public ResponseEntity<ApiResponse> createDrive(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null && body != null && body.has("hospitalId")) {
                hospitalId = JsonUtil.asInt(body, "hospitalId", 1);
            }
            if (hospitalId == null) hospitalId = 1;

            String title = JsonUtil.textOrNull(body, "title");
            if (title == null || title.isBlank()) title = "Blood donation drive";

            String bloodGroups = JsonUtil.textOrNull(body, "bloodGroups");
            if (bloodGroups == null || bloodGroups.isBlank()) bloodGroups = "All";

            String driveDate = JsonUtil.textOrNull(body, "driveDate");
            if (driveDate == null || driveDate.isBlank()) {
                driveDate = java.time.LocalDate.now().plusDays(1).toString();
            }

            String startTime = JsonUtil.textOrNull(body, "startTime");
            if (startTime == null || startTime.isBlank()) startTime = "09:00";

            String endTime = JsonUtil.textOrNull(body, "endTime");
            if (endTime == null || endTime.isBlank()) endTime = "17:00";

            String venue = JsonUtil.textOrNull(body, "venue");
            if (venue == null || venue.isBlank()) {
                Map<String, Object> hospProfile = hospitalDao.findById(hospitalId);
                venue = hospProfile != null ? (String) hospProfile.get("address") : "Hospital Blood Bank";
                if (venue == null || venue.isBlank()) venue = "Hospital Blood Bank";
            }

            Integer targetUnits = (body != null && body.has("targetUnits")) ? JsonUtil.asInt(body, "targetUnits", 0) : null;
            if (targetUnits != null && targetUnits <= 0) targetUnits = null;

            int radius = (body != null && body.has("radius")) ? JsonUtil.asInt(body, "radius", 10) : 10;
            String notes = JsonUtil.textOrNull(body, "notes");

            int driveId = donationDriveDao.createDrive(hospitalId, title, bloodGroups, driveDate, startTime, endTime, venue, targetUnits, radius, notes);

            // Send non-urgent invitation notifications to eligible, compatible donors in radius
            try {
                Map<String, Object> hosp = hospitalDao.findById(hospitalId);
                Double hLat = hosp != null ? asDouble(hosp.get("latitude")) : null;
                Double hLng = hosp != null ? asDouble(hosp.get("longitude")) : null;

                List<Map<String, Object>> nearbyDonors = donorDao.findNearby(hLat, hLng, radius, null);
                List<String> invitedDonorIds = new ArrayList<>();
                for (Map<String, Object> donor : nearbyDonors) {
                    String dType = (String) donor.get("bloodType");
                    String dId = String.valueOf(donor.get("id"));

                    boolean comp = false;
                    if (bloodGroups.equalsIgnoreCase("All")) {
                        comp = true;
                    } else {
                        String[] needed = bloodGroups.split("[,;/ ]+");
                        for (String n : needed) {
                            if (!n.isBlank() && com.red404.util.BloodCompatibilityUtil.isCompatible(dType, n.trim())) {
                                comp = true;
                                break;
                            }
                        }
                    }
                    if (comp && DonorEligibilityService.isEligible(donor)) {
                        invitedDonorIds.add(dId);
                    }
                }
                donationDriveDao.recordInvitations(driveId, invitedDonorIds);
            } catch (Exception ignored) {}

            Map<String, Object> resp = new HashMap<>();
            resp.put("driveId", driveId);
            resp.put("title", title);
            resp.put("status", "upcoming");
            return ok("Donation drive scheduled successfully", resp);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/drives/{id}/cancel")
    public ResponseEntity<ApiResponse> cancelDrive(@PathVariable int id, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            boolean success = donationDriveDao.updateStatus(id, hospitalId, "cancelled");
            return ok("Drive cancelled", success);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/drives/{id}/complete")
    public ResponseEntity<ApiResponse> completeDrive(@PathVariable int id, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) hospitalId = 1;
            // Rule 6: When a drive is marked completed, do NOT auto-change stock. Stock changes only through the Inventory page.
            boolean success = donationDriveDao.updateStatus(id, hospitalId, "completed");
            return ok("Drive marked as completed", success);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/location", "/update-location"})
    public ResponseEntity<ApiResponse> updateLocation(@RequestBody(required = false) JsonNode body, HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null && body != null && body.has("hospitalId")) {
                hospitalId = JsonUtil.asInt(body, "hospitalId", 0);
                if (hospitalId == 0) hospitalId = null;
            }
            if (hospitalId == null) {
                List<Map<String, Object>> all = hospitalDao.listAll();
                if (!all.isEmpty()) hospitalId = ((Number) all.get(0).get("id")).intValue();
            }
            if (hospitalId == null) {
                return unauthorized();
            }

            if (body == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Request body is required."));
            }

            Double lat = JsonUtil.asDouble(body, "latitude");
            if (lat == null) lat = JsonUtil.asDouble(body, "lat");
            Double lng = JsonUtil.asDouble(body, "longitude");
            if (lng == null) lng = JsonUtil.asDouble(body, "lng");

            if (lat == null || lng == null) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Latitude and longitude coordinates are required."));
            }

            if (lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) {
                return ResponseEntity.badRequest()
                        .body(new ApiResponse(false, "Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180."));
            }

            String address = JsonUtil.textOrNull(body, "address");
            hospitalDao.updateHospitalLocation(hospitalId, address, lat, lng);

            Map<String, Object> updated = hospitalDao.findById(hospitalId);
            HttpSession session = request.getSession(false);
            if (session != null && updated != null) {
                session.setAttribute("hospitalUser", updated);
            }
            return ok("Hospital location updated successfully", updated);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== DONOR CHECK-IN ========================

    @GetMapping({"/donors/checkin", "/donors/lookup"})
    public ResponseEntity<ApiResponse> lookupDonorForCheckin(
            @RequestParam(required = false) String smartId,
            @RequestParam(required = false) String id,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) {
                return unauthorized();
            }

            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return unauthorized();
            String hospName = (String) hosp.get("hospital_name");
            String vStatus = (String) hosp.get("verificationStatus");
            if (vStatus == null) vStatus = (String) hosp.get("verification_status");

            String queryId = smartId != null ? smartId.trim() : (id != null ? id.trim() : "");
            if (queryId.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Please enter a valid Donor ID or Smart ID."));
            }

            // Gating: Only verified hospitals may look up donor records / scan QR
            if (vStatus == null || !"Verified".equalsIgnoreCase(vStatus.trim())) {
                donorDao.logCheckinScan(hospitalId, hospName, queryId, null, false, "Forbidden: Hospital not verified");
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Access denied: Verified hospital status is required to perform donor check-in lookups."));
            }

            // Rate-limiting: max 30 lookups per minute
            if (!checkLookupRateLimit(hospitalId)) {
                donorDao.logCheckinScan(hospitalId, hospName, queryId, null, false, "Rate limit exceeded");
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(new ApiResponse(false, "Check-in rate limit exceeded (maximum 30 lookups per minute). Please wait a moment."));
            }

            Map<String, Object> donor = donorDao.findByIdOrDonorId(queryId);
            if (donor == null || donor.isEmpty()) {
                donorDao.logCheckinScan(hospitalId, hospName, queryId, null, false, "Donor not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse(false, "Donor not found: No registered donor with ID or QR token " + queryId));
            }

            int donorNumId = donor.get("id") != null ? ((Number) donor.get("id")).intValue() : 0;

            // Log successful scan
            donorDao.logCheckinScan(hospitalId, hospName, queryId, donorNumId, true, "Lookup successful");

            // Dispatch donor check-in notification
            if (donorNumId > 0) {
                donorDao.addDonorNotification(donorNumId, "Checked in at " + hospName,
                        "You have successfully checked in at " + hospName + " for blood donation verification.", "checkin");
            }

            // Real backend data calculation
            Map<String, Object> details = new HashMap<>();
            String matchedDonorId = (String) donor.get("donor_id");
            if (matchedDonorId == null || matchedDonorId.isBlank()) {
                matchedDonorId = String.valueOf(donor.get("id"));
            }
            details.put("id", donor.get("id"));
            details.put("donorId", matchedDonorId);
            details.put("name", donor.get("name"));
            String bg = (String) donor.get("bloodType");
            if (bg == null) bg = (String) donor.get("blood_type");
            if (bg == null) bg = (String) donor.get("bloodGroup");
            details.put("bloodType", bg);
            details.put("blood_type", bg);
            details.put("bloodGroup", bg);
            int totalVerifiedDonations = 0;
            try {
                List<Map<String, Object>> hist = donorDao.donationHistory(matchedDonorId);
                totalVerifiedDonations = hist != null ? hist.size() : 0;
            } catch (Exception ignored) {}
            details.put("totalDonations", totalVerifiedDonations);

            // Calculate age from dob
            Object dobObj = donor.get("dob");
            int age = 0;
            if (dobObj != null) {
                try {
                    java.time.LocalDate dob = java.time.LocalDate.parse(dobObj.toString());
                    age = java.time.Period.between(dob, java.time.LocalDate.now()).getYears();
                } catch (Exception ignored) {}
            }
            details.put("age", age > 0 ? age : 25);
            details.put("gender", donor.get("gender"));

            // Weight & Registration health-form answers (Group B.5)
            Object wtObj = donor.get("weight");
            double weight = wtObj instanceof Number ? ((Number) wtObj).doubleValue() : 60.0;
            details.put("weight", weight);
            details.put("allergies", donor.get("allergies"));
            details.put("conditions", donor.get("conditions"));
            details.put("medications", donor.get("medications"));
            details.put("surgeries", donor.get("surgeries"));
            details.put("donorType", donor.get("donorType") != null ? donor.get("donorType") : donor.get("donor_type"));

            // Authoritative Donor Eligibility Service single source of truth
            Map<String, Object> elig = DonorEligibilityService.computeEligibility(donor);
            details.put("eligibility", elig);
            details.put("isEligible", elig.get("eligible"));
            details.put("eligible", elig.get("eligible"));
            details.put("eligibilityReason", elig.get("reason"));
            details.put("lastDonation", elig.get("last_donation_date") != null ? elig.get("last_donation_date") : "Never");
            details.put("lastDonationDate", elig.get("last_donation_date"));
            details.put("daysUntilEligible", elig.get("days_until_eligible"));
            details.put("days_until_eligible", elig.get("days_until_eligible"));
            details.put("nextEligibleDate", elig.get("next_eligible_date"));
            details.put("next_eligible_date", elig.get("next_eligible_date"));
            details.put("progress_pct", elig.get("progress_pct"));
            details.put("cooldown_days", elig.get("cooldown_days"));

            // Real health verification status (Group B.4)
            Object vDate = donor.get("verifiedDate");
            if (vDate == null) vDate = donor.get("verified_date");
            String vFac = (String) donor.get("verifiedFacility");
            if (vFac == null) vFac = (String) donor.get("verified_facility");

            String healthStatus;
            if (vDate != null && vFac != null && !vFac.isBlank()) {
                healthStatus = "Verified by " + vFac + " on " + vDate.toString();
            } else {
                healthStatus = "Not yet verified by a hospital";
            }
            details.put("healthStatus", healthStatus);
            details.put("verifiedDate", vDate != null ? vDate.toString() : null);
            details.put("verifiedFacility", vFac);

            // Blood group verification status (Group B.3)
            String bgStatus = (String) donor.get("bloodGroupStatus");
            details.put("bloodGroupStatus", bgStatus != null ? bgStatus : "self_declared");
            details.put("blood_group_status", details.get("bloodGroupStatus"));
            details.put("bloodGroupVerifiedByHospitalName", donor.get("bloodGroupVerifiedByHospitalName"));
            details.put("bloodGroupVerifiedAt", donor.get("bloodGroupVerifiedAt"));
            details.put("bloodGroupEditCount", donor.get("bloodGroupEditCount"));
            details.put("bloodGroupAuditTrail", bloodGroupAuditDao.listByDonor(donorNumId));

            return ok("Donor details retrieved", details);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/donors/verify-blood-group", "/donors/update-blood-group"})
    public ResponseEntity<ApiResponse> verifyDonorBloodGroup(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();
            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return unauthorized();
            String vStatus = (String) hosp.get("verificationStatus");
            if (vStatus == null) vStatus = (String) hosp.get("verification_status");
            if (vStatus == null || !"Verified".equalsIgnoreCase(vStatus.trim())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Verified hospital status is required to update blood group."));
            }

            if (body == null) return ResponseEntity.badRequest().body(new ApiResponse(false, "Body is required."));
            String donorIdentifier = JsonUtil.textOrNull(body, "donorId");
            if (donorIdentifier == null) donorIdentifier = JsonUtil.textOrNull(body, "smartId");
            if (donorIdentifier == null) {
                int idNum = JsonUtil.asInt(body, "id", 0);
                if (idNum > 0) donorIdentifier = String.valueOf(idNum);
            }
            if (donorIdentifier == null || donorIdentifier.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Donor ID is required."));
            }

            String newBloodType = JsonUtil.textOrNull(body, "bloodType");
            if (newBloodType == null) newBloodType = JsonUtil.textOrNull(body, "bloodGroup");
            if (newBloodType == null || newBloodType.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "New blood group is required."));
            }
            String normBlood = com.red404.util.BloodCompatibilityUtil.normalizeBloodGroup(newBloodType);
            if (normBlood == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Invalid blood group: " + newBloodType));
            }

            String reason = JsonUtil.textOrNull(body, "reason");
            if (reason == null || reason.trim().isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Clinical reason is required to verify or update blood group."));
            }

            Map<String, Object> donor = donorDao.findByIdOrDonorId(donorIdentifier);
            if (donor == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiResponse(false, "Donor not found: " + donorIdentifier));
            }
            int donorNumId = ((Number) donor.get("id")).intValue();
            String oldBlood = (String) donor.get("bloodType");
            if (oldBlood == null) oldBlood = (String) donor.get("blood_type");
            String hospName = (String) hosp.get("hospital_name");

            donorDao.updateBloodGroupHospitalVerified(donorNumId, normBlood, hospitalId, hospName);
            bloodGroupAuditDao.insertAudit(donorNumId, oldBlood, normBlood, "hospital", hospitalId, reason.trim());

            donorDao.addDonorNotification(donorNumId, "Blood Group Verified: " + normBlood,
                    "Your blood group was updated to " + normBlood + " and verified by " + hospName + ". Reason: " + reason.trim(), "blood_group");

            Map<String, Object> updated = new HashMap<>();
            updated.put("donorId", donorIdentifier);
            updated.put("bloodType", normBlood);
            updated.put("bloodGroupStatus", "hospital_verified");
            updated.put("bloodGroupVerifiedByHospitalName", hospName);
            updated.put("bloodGroupVerifiedAt", new java.sql.Timestamp(System.currentTimeMillis()).toString());
            updated.put("bloodGroupAuditTrail", bloodGroupAuditDao.listByDonor(donorNumId));

            return ok("Blood group updated to " + normBlood + " and hospital-verified successfully.", updated);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @GetMapping("/donation-gaps")
    public ResponseEntity<ApiResponse> getDonationGaps() {
        return ok("Donation gap configuration", DonorEligibilityService.getDonationGapConfig());
    }

    @PostMapping("/donation-gaps")
    public ResponseEntity<ApiResponse> updateDonationGaps(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();
            int male = JsonUtil.asInt(body, "male", DonorEligibilityService.configuredMaleGap);
            int female = JsonUtil.asInt(body, "female", DonorEligibilityService.configuredFemaleGap);
            int unspec = JsonUtil.asInt(body, "unspecified", DonorEligibilityService.configuredUnspecGap);
            DonorEligibilityService.setDonationGapDays(male, female, unspec);
            return ok("Donation gap configuration updated", DonorEligibilityService.getDonationGapConfig());
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/donors/set-gender")
    public ResponseEntity<ApiResponse> setDonorGender(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();
            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return unauthorized();
            String vStatus = (String) hosp.get("verificationStatus");
            if (vStatus == null) vStatus = (String) hosp.get("verification_status");
            if (vStatus == null || !"Verified".equalsIgnoreCase(vStatus.trim())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse(false, "Verified hospital status is required to update donor gender."));
            }

            if (body == null) return ResponseEntity.badRequest().body(new ApiResponse(false, "Body is required."));
            String donorIdentifier = JsonUtil.textOrNull(body, "donorId");
            if (donorIdentifier == null) donorIdentifier = JsonUtil.textOrNull(body, "smartId");
            if (donorIdentifier == null || donorIdentifier.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Donor ID is required."));
            }

            String gender = JsonUtil.textOrNull(body, "gender");
            if (gender == null || gender.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Valid gender is required (Male, Female, or Other)."));
            }
            gender = gender.trim();
            if (!gender.equalsIgnoreCase("Male") && !gender.equalsIgnoreCase("Female") && !gender.equalsIgnoreCase("Other")) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Gender must be Male, Female, or Other."));
            }
            String normGender = Character.toUpperCase(gender.charAt(0)) + gender.substring(1).toLowerCase();

            Map<String, Object> donor = donorDao.findByIdOrDonorId(donorIdentifier);
            if (donor == null || donor.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiResponse(false, "Donor not found."));
            }

            int donorNumId = donor.get("id") != null ? ((Number) donor.get("id")).intValue() : 0;
            try (Connection conn = DBConnection.getConnection();
                 PreparedStatement ps = conn.prepareStatement("UPDATE donors SET gender = ? WHERE id = ?")) {
                ps.setString(1, normGender);
                ps.setInt(2, donorNumId);
                ps.executeUpdate();
            }

            Map<String, Object> updatedDonor = donorDao.findById(donorNumId);
            Map<String, Object> updatedElig = DonorEligibilityService.computeEligibility(updatedDonor);

            Map<String, Object> resp = new HashMap<>();
            resp.put("donorId", donorIdentifier);
            resp.put("gender", normGender);
            resp.put("eligibility", updatedElig);
            resp.put("cooldownDays", updatedElig.get("cooldown_days"));
            resp.put("isEligible", updatedElig.get("eligible"));

            return ok("Gender updated to " + normGender + " and eligibility recomputed successfully.", resp);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping({"/donors/checkin", "/donors/approve-donation"})
    public ResponseEntity<ApiResponse> approveDonationCheckin(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) {
                return unauthorized();
            }

            if (body == null) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Request body is required."));
            }

            String donorId = JsonUtil.textOrNull(body, "donorId");
            if (donorId == null || donorId.isBlank()) {
                donorId = JsonUtil.textOrNull(body, "smartId");
            }
            if (donorId == null || donorId.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Donor ID is required."));
            }

            String bloodType = JsonUtil.textOrNull(body, "bloodType");
            if (bloodType == null || bloodType.isBlank()) {
                Map<String, Object> d = donorDao.findByIdOrDonorId(donorId);
                if (d != null) bloodType = (String) d.get("blood_type");
                if (bloodType == null) bloodType = "O+";
            }
            String normBloodType = com.red404.util.BloodCompatibilityUtil.normalizeBloodGroup(bloodType);
            if (normBloodType != null) {
                bloodType = normBloodType;
            }

            Map<String, Object> existingDonor = donorDao.findByIdOrDonorId(donorId);
            String existingBg = existingDonor != null ? (String) existingDonor.get("blood_type") : null;
            String editReason = JsonUtil.textOrNull(body, "reason");
            if (editReason == null) editReason = JsonUtil.textOrNull(body, "bloodGroupReason");

            // Part 5.2: reason is required for hospital edits if blood group changed
            if (existingBg != null && !existingBg.equalsIgnoreCase(bloodType)) {
                if (editReason == null || editReason.trim().length() < 3) {
                    return ResponseEntity.badRequest().body(new ApiResponse(false, "Reason is required when modifying a donor's blood group during check-in."));
                }
            }

            int volumeMl = JsonUtil.asInt(body, "volumeMl", 450);
            if (volumeMl != 350 && volumeMl != 450) volumeMl = 450;

            String vitalsJson = null;
            if (body.has("vitals")) {
                vitalsJson = body.get("vitals").toString();
            }

            String staffUser = JsonUtil.textOrNull(body, "staffUser");
            if (staffUser == null) staffUser = "Hospital Staff";

            // Resolve linked blood request if this donor accepted or was dispatched for a request
            int donorIntId = (existingDonor != null && existingDonor.get("id") != null) ? ((Number) existingDonor.get("id")).intValue() : 0;
            int reqId = JsonUtil.asInt(body, "requestId", 0);
            if (reqId <= 0 && donorIntId > 0) {
                reqId = notificationDao.getActiveRequestIdForDonorAndHospital(donorIntId, hospitalId);
            }

            boolean recorded = donorDao.recordDonation(donorId, hospitalId, bloodType, 1, volumeMl, vitalsJson, staffUser, "COMPLETED", null, reqId > 0 ? reqId : null);
            if (!recorded) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(new ApiResponse(false, "Failed to record donation in database."));
            }

            // If linked to active blood request, update donor status to DONATED and increment request fulfillment
            if (reqId > 0 && donorIntId > 0) {
                try {
                    notificationDao.markDonorDonated(reqId, donorIntId);
                    requestDao.incrementUnitsFulfilled(reqId);
                } catch (Exception ignored) {}
            }

            // Update donor blood group status to hospital_verified and log audit (Part 5)
            if (existingDonor != null && existingDonor.get("id") != null) {
                Map<String, Object> hosp = hospitalDao.findById(hospitalId);
                String hospName = (hosp != null && hosp.get("hospital_name") != null) ? (String) hosp.get("hospital_name") : "Verified Hospital";
                donorDao.updateBloodGroupHospitalVerified(donorIntId, bloodType, hospitalId, hospName);
                bloodGroupAuditDao.insertAudit(donorIntId, existingBg, bloodType, "hospital", hospitalId,
                        editReason != null ? editReason.trim() : "Hospital check-in donation verification");
                // Invalidate one-time QR token upon approved check-in (Part 6)
                donorDao.invalidateQrToken(donorIntId);
            }

            // Increment inventory (+1 unit)
            hospitalDao.updateHospitalInventory(hospitalId, bloodType, 1, null);

            // Broadcast live stock update
            try {
                SystemController.broadcastStockUpdate(donorDao.getNationalBloodStock());
            } catch (Exception ignored) {}

            // Audit log
            AdminController.addLog("DONATION_APPROVED", "Donation approved at hospital ID " + hospitalId +
                    " for donor " + donorId + " (" + bloodType + ", " + volumeMl + " mL) by " + staffUser + (reqId > 0 ? " [linked request #" + reqId + "]" : ""));

            Map<String, Object> resp = new HashMap<>();
            resp.put("donorId", donorId);
            resp.put("bloodType", bloodType);
            resp.put("volumeMl", volumeMl);
            resp.put("requestId", reqId > 0 ? reqId : null);
            resp.put("newInventory", hospitalDao.getHospitalInventory(hospitalId));

            return ok("Donation verified, recorded, and inventory updated (+1 unit " + bloodType + ").", resp);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/donors/defer")
    public ResponseEntity<ApiResponse> deferDonorCheckin(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();

            String donorId = JsonUtil.textOrNull(body, "donorId");
            String reason = JsonUtil.textOrNull(body, "reason");
            if (donorId == null || donorId.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Donor ID is required."));
            }
            if (reason == null || reason.isBlank()) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Deferral reason is required."));
            }

            String staffUser = JsonUtil.textOrNull(body, "staffUser");
            if (staffUser == null) staffUser = "Hospital Staff";

            donorDao.recordDonation(donorId, hospitalId, null, 0, 0, null, staffUser, "DEFERRED", reason);
            Map<String, Object> defDonor = donorDao.findByIdOrDonorId(donorId);
            if (defDonor != null && defDonor.get("id") != null) {
                int defNumId = ((Number) defDonor.get("id")).intValue();
                donorDao.invalidateQrToken(defNumId);
                Map<String, Object> hosp = getHospitalFromSession(request);
                String hospName = (hosp != null && hosp.get("hospital_name") != null) ? hosp.get("hospital_name").toString() : "Hospital";
                donorDao.addDonorNotification(defNumId, "Donation Deferred",
                        "Your blood donation was deferred by " + hospName + ". Reason: " + reason, "deferral");
            }
            AdminController.addLog("DONATION_DEFERRED", "Donor " + donorId + " deferred at hospital ID " + hospitalId + ": " + reason);

            return ok("Donor has been deferred with documented reason.", Map.of("donorId", donorId, "reason", reason));
        } catch (Exception e) {
            return serverError(e);
        }
    }

    // ======================== PROFILE UPDATE & PASSWORD ========================

    @RequestMapping(value = {"/profile", "/settings"}, method = {RequestMethod.PUT, RequestMethod.POST})
    public ResponseEntity<ApiResponse> updateProfile(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();
            if (body == null) return ResponseEntity.badRequest().body(new ApiResponse(false, "Request body is required."));

            Map<String, Object> current = hospitalDao.findById(hospitalId);
            if (current == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiResponse(false, "Hospital not found."));

            Map<String, Object> updates = new HashMap<>();
            String[] fields = {
                "hospitalName", "hospitalType", "registrationNo", "bloodBankLicense",
                "address", "city", "state", "pincode", "hospitalPhone", "emergencyContact",
                "adminName", "adminDesignation", "operatingHours"
            };
            for (String f : fields) {
                if (body.has(f)) {
                    updates.put(f, JsonUtil.textOrNull(body, f));
                }
            }

            if (body.has("latitude") || body.has("lat")) {
                Double lat = JsonUtil.asDouble(body, "latitude");
                if (lat == null) lat = JsonUtil.asDouble(body, "lat");
                if (lat != null && lat >= -90.0 && lat <= 90.0) {
                    updates.put("latitude", lat);
                }
            }
            if (body.has("longitude") || body.has("lng")) {
                Double lng = JsonUtil.asDouble(body, "longitude");
                if (lng == null) lng = JsonUtil.asDouble(body, "lng");
                if (lng != null && lng >= -180.0 && lng <= 180.0) {
                    updates.put("longitude", lng);
                }
            }

            // Sensitive fields check: name or registration number changed
            String currentStatus = (String) current.get("verificationStatus");
            if (currentStatus == null) currentStatus = (String) current.get("verification_status");
            boolean isVerified = "Verified".equalsIgnoreCase(currentStatus);

            String oldName = (String) current.get("name");
            if (oldName == null) oldName = (String) current.get("hospital_name");
            String newName = (String) updates.get("hospitalName");

            String oldReg = (String) current.get("registrationNo");
            if (oldReg == null) oldReg = (String) current.get("registration_no");
            String newReg = (String) updates.get("registrationNo");

            boolean sensitiveChanged = false;
            if (newName != null && !newName.trim().equalsIgnoreCase(oldName != null ? oldName.trim() : "")) {
                sensitiveChanged = true;
            }
            if (newReg != null && !newReg.trim().equalsIgnoreCase(oldReg != null ? oldReg.trim() : "")) {
                sensitiveChanged = true;
            }

            if (isVerified && sensitiveChanged) {
                updates.put("verification_status", "Needs re-verification");
            }

            boolean ok = hospitalDao.updateHospitalProfile(hospitalId, updates);
            if (!ok && updates.isEmpty()) {
                return ok("No changes to update", current);
            }

            Map<String, Object> updated = hospitalDao.findById(hospitalId);
            HttpSession session = request.getSession(false);
            if (session != null && updated != null) {
                session.setAttribute("hospitalUser", updated);
            }

            // Audit log
            AdminController.addLog("HOSPITAL_PROFILE_UPDATED",
                    "Hospital ID " + hospitalId + " updated profile. Sensitive changed: " + sensitiveChanged +
                    ". New status: " + (updated != null ? updated.get("verificationStatus") : ""));

            return ok("Hospital profile updated successfully.", updated);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @RequestBody JsonNode body,
            HttpServletRequest request) {
        try {
            Integer hospitalId = getHospitalId(request);
            if (hospitalId == null) return unauthorized();
            if (body == null) return ResponseEntity.badRequest().body(new ApiResponse(false, "Request body is required."));

            String currentPassword = JsonUtil.textOrNull(body, "currentPassword");
            String newPassword = JsonUtil.textOrNull(body, "newPassword");
            if (currentPassword == null || newPassword == null || newPassword.length() < 6) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "New password must be at least 6 characters."));
            }

            Map<String, Object> hosp = hospitalDao.findById(hospitalId);
            if (hosp == null) return unauthorized();

            String storedPw = (String) hosp.get("password");
            if (!com.red404.util.PasswordUtil.checkPassword(currentPassword, storedPw)) {
                return ResponseEntity.badRequest().body(new ApiResponse(false, "Current password does not match."));
            }

            String hashed = com.red404.util.PasswordUtil.hashPassword(newPassword);
            try (java.sql.Connection conn = com.red404.util.DBConnection.getConnection();
                 java.sql.PreparedStatement ps = conn.prepareStatement("UPDATE hospitals SET password = ? WHERE id = ?")) {
                ps.setString(1, hashed);
                ps.setInt(2, hospitalId);
                ps.executeUpdate();
            }

            AdminController.addLog("HOSPITAL_PASSWORD_CHANGED", "Hospital ID " + hospitalId + " changed account password.");
            return ok("Password changed successfully.", null);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    @RequestMapping(value = "/logout", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<ApiResponse> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            try {
                Object hosp = session.getAttribute("hospitalUser");
                if (hosp instanceof Map<?, ?> h && h.get("id") != null) {
                    new com.red404.dao.SessionDao().killSession(((Number) h.get("id")).intValue(), "HOSPITAL", session.getId());
                }
            } catch (Exception ignored) {}
            session.invalidate();
        }
        return ok("Logged out successfully", null);
    }

    // ======================== HELPERS ========================

    @SuppressWarnings("unchecked")
    private Map<String, Object> requireHospital(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("hospitalUser") == null) {
            return null;
        }
        return (Map<String, Object>) session.getAttribute("hospitalUser");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getHospitalFromSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session != null ? (Map<String, Object>) session.getAttribute("hospitalUser") : null;
    }

    private Integer getHospitalId(HttpServletRequest request) {
        Map<String, Object> h = getHospitalFromSession(request);
        if (h != null && h.get("id") instanceof Number num) {
            return num.intValue();
        }
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (token.startsWith("SESSION-HOSPITAL-")) {
                try {
                    return Integer.parseInt(token.substring("SESSION-HOSPITAL-".length()));
                } catch (NumberFormatException ignored) {}
            }
        }
        String xHosp = request.getHeader("X-Hospital-Id");
        if (xHosp != null && !xHosp.isBlank()) {
            try {
                return Integer.parseInt(xHosp.trim());
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private static Double asDouble(Object val) {
        return val instanceof Number ? ((Number) val).doubleValue() : null;
    }

    private static ResponseEntity<ApiResponse> ok(String message, Object data) {
        return ResponseEntity.ok(new ApiResponse(true, message, data));
    }

    private static ResponseEntity<ApiResponse> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiResponse(false, "Please login as a hospital first."));
    }

    private static ResponseEntity<ApiResponse> serverError(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiResponse(false, "Server processing error: " + e.getMessage()));
    }
}

