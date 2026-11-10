package com.red404.model;


import java.sql.Date;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Donor {

    // ============================================
    // FIELDS
    // ============================================

    // Basic Info
    private int     id;
    private String  donorId;
    private String  name;
    private String  email;
    private String  phone;
    private String  password;
    private String  gender;
    private int     age;
    private double  weight;

    // Blood Info
    private String  bloodType;
    private Date    lastDonationDate;
    private boolean isAvailable;
    private int     totalDonations;

    // Location Info (Haversine)
    private double  latitude;
    private double  longitude;
    private String  address;
    private String  city;
    private String  state;
    private String  pincode;

    // Zone Info (RED404 Zone System)
    private String  zone;
    private double  distanceFromHospital;

    // Medical Info
    private boolean hasMedicalCondition;
    private String  medicalNotes;

    // Status
    private String  status;          // ACTIVE, INACTIVE, SUSPENDED
    private Date    createdAt;
    private Date    updatedAt;

    // ============================================
    // CONSTANTS
    // ============================================

    public static final String STATUS_ACTIVE    = "ACTIVE";
    public static final String STATUS_INACTIVE  = "INACTIVE";
    public static final String STATUS_SUSPENDED = "SUSPENDED";

    public static final String GENDER_MALE   = "MALE";
    public static final String GENDER_FEMALE = "FEMALE";
    public static final String GENDER_OTHER  = "OTHER";

    public static final double MIN_WEIGHT_KG = 50.0;   // Minimum weight to donate
    public static final int    MIN_AGE       = 18;      // Minimum age to donate
    public static final int    MAX_AGE       = 65;      // Maximum age to donate
    public static final int    MIN_GAP_DAYS  = 90;      // Minimum days between donations

    // Valid blood types
    public static final List<String> VALID_BLOOD_TYPES = Arrays.asList(
        "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"
    );

    // ============================================
    // CONSTRUCTORS
    // ============================================

    // Default constructor
    public Donor() {
        this.isAvailable        = true;
        this.totalDonations     = 0;
        this.hasMedicalCondition = false;
        this.status             = STATUS_ACTIVE;
        this.distanceFromHospital = 0.0;
    }

    // Basic constructor (Registration)
    public Donor(
            String name,
            String email,
            String phone,
            String password,
            String gender,
            int    age,
            double weight,
            String bloodType,
            String address,
            String city,
            String state,
            String pincode,
            double latitude,
            double longitude) {

        this.name      = name;
        this.email     = email;
        this.phone     = phone;
        this.password  = password;
        this.gender    = gender;
        this.age       = age;
        this.weight    = weight;
        this.bloodType = bloodType;
        this.address   = address;
        this.city      = city;
        this.state     = state;
        this.pincode   = pincode;
        this.latitude  = latitude;
        this.longitude = longitude;

        // Defaults
        this.isAvailable         = true;
        this.totalDonations      = 0;
        this.hasMedicalCondition = false;
        this.status              = STATUS_ACTIVE;
        this.distanceFromHospital = 0.0;
    }

    // Full constructor
    public Donor(
            int     id,
            String  name,
            String  email,
            String  phone,
            String  password,
            String  gender,
            int     age,
            double  weight,
            String  bloodType,
            Date    lastDonationDate,
            boolean isAvailable,
            int     totalDonations,
            double  latitude,
            double  longitude,
            String  address,
            String  city,
            String  state,
            String  pincode,
            boolean hasMedicalCondition,
            String  medicalNotes,
            String  status) {

        this.id                  = id;
        this.name                = name;
        this.email               = email;
        this.phone               = phone;
        this.password            = password;
        this.gender              = gender;
        this.age                 = age;
        this.weight              = weight;
        this.bloodType           = bloodType;
        this.lastDonationDate    = lastDonationDate;
        this.isAvailable         = isAvailable;
        this.totalDonations      = totalDonations;
        this.latitude            = latitude;
        this.longitude           = longitude;
        this.address             = address;
        this.city                = city;
        this.state               = state;
        this.pincode             = pincode;
        this.hasMedicalCondition = hasMedicalCondition;
        this.medicalNotes        = medicalNotes;
        this.status              = status;
        this.distanceFromHospital = 0.0;
    }

    // ============================================
    // VALIDATION METHODS
    // ============================================

    /**
     * Validates all donor registration fields.
     * @return Map of field errors (empty if valid)
     */
    public Map<String, String> validate() {

        Map<String, String> errors = new HashMap<>();

        // Name validation
        if (name == null || name.trim().isEmpty()) {
            errors.put("name", "Name is required");
        } else if (name.trim().length() < 2) {
            errors.put("name", "Name must be at least 2 characters");
        } else if (name.trim().length() > 100) {
            errors.put("name", "Name must not exceed 100 characters");
        }

        // Email validation
        if (email == null || email.trim().isEmpty()) {
            errors.put("email", "Email is required");
        } else if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$")) {
            errors.put("email", "Invalid email format");
        }

        // Phone validation
        if (phone == null || phone.trim().isEmpty()) {
            errors.put("phone", "Phone number is required");
        } else if (!phone.matches("^[0-9]{10}$")) {
            errors.put("phone", "Phone must be 10 digits");
        }

        // Password validation
        if (password == null || password.trim().isEmpty()) {
            errors.put("password", "Password is required");
        } else if (password.length() < 6) {
            errors.put("password", "Password must be at least 6 characters");
        }

        // Gender validation
        if (gender == null || gender.trim().isEmpty()) {
            errors.put("gender", "Gender is required");
        } else if (!gender.equalsIgnoreCase(GENDER_MALE)
                && !gender.equalsIgnoreCase(GENDER_FEMALE)
                && !gender.equalsIgnoreCase(GENDER_OTHER)) {
            errors.put("gender", "Gender must be MALE, FEMALE or OTHER");
        }

        // Age validation
        if (age < MIN_AGE) {
            errors.put("age", "Donor must be at least " + MIN_AGE + " years old");
        } else if (age > MAX_AGE) {
            errors.put("age", "Donor must not exceed " + MAX_AGE + " years old");
        }

        // Weight validation
        if (weight < MIN_WEIGHT_KG) {
            errors.put("weight", "Donor must weigh at least " + MIN_WEIGHT_KG + " kg");
        }

        // Blood type validation
        if (bloodType == null || bloodType.trim().isEmpty()) {
            errors.put("bloodType", "Blood type is required");
        } else if (!VALID_BLOOD_TYPES.contains(bloodType.toUpperCase())) {
            errors.put("bloodType", "Invalid blood type. Must be one of: " + VALID_BLOOD_TYPES);
        }

        // Address validation
        if (address == null || address.trim().isEmpty()) {
            errors.put("address", "Address is required");
        }

        // City validation
        if (city == null || city.trim().isEmpty()) {
            errors.put("city", "City is required");
        }

        // Pincode validation
        if (pincode == null || pincode.trim().isEmpty()) {
            errors.put("pincode", "Pincode is required");
        } else if (!pincode.matches("^[0-9]{6}$")) {
            errors.put("pincode", "Pincode must be 6 digits");
        }

        // Coordinates validation
        if (latitude < -90 || latitude > 90) {
            errors.put("latitude", "Invalid latitude value");
        }
        if (longitude < -180 || longitude > 180) {
            errors.put("longitude", "Invalid longitude value");
        }

        return errors;
    }

    /**
     * Checks if donor is eligible to donate blood.
     * Based on age, weight, availability and last donation date.
     * @return true if eligible, false otherwise
     */
    public boolean isEligibleToDonate() {

        // Check availability
        if (!isAvailable) return false;

        // Check status
        if (!status.equals(STATUS_ACTIVE)) return false;

        // Check age
        if (age < MIN_AGE || age > MAX_AGE) return false;

        // Check weight
        if (weight < MIN_WEIGHT_KG) return false;

        // Check medical condition
        if (hasMedicalCondition) return false;

        // Check last donation date gap (90 days minimum)
        if (lastDonationDate != null) {
            long currentTime      = System.currentTimeMillis();
            long lastDonationTime = lastDonationDate.getTime();
            long diffInDays       = (currentTime - lastDonationTime) / (1000 * 60 * 60 * 24);

            if (diffInDays < MIN_GAP_DAYS) return false;
        }

        return true;
    }

    /**
     * Returns days since last donation.
     * @return Days since last donation, -1 if never donated
     */
    public long getDaysSinceLastDonation() {

        if (lastDonationDate == null) return -1;

        long currentTime      = System.currentTimeMillis();
        long lastDonationTime = lastDonationDate.getTime();

        return (currentTime - lastDonationTime) / (1000 * 60 * 60 * 24);
    }

    /**
     * Returns days remaining until eligible to donate again.
     * @return Days remaining, 0 if already eligible
     */
    public long getDaysUntilEligible() {

        long daysSinceLast = getDaysSinceLastDonation();

        if (daysSinceLast == -1) return 0;  // Never donated, eligible now

        long daysRemaining = MIN_GAP_DAYS - daysSinceLast;

        return Math.max(daysRemaining, 0);
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Returns donor summary as Map
     * (Used for API response without sensitive data)
     */
    public Map<String, Object> toPublicMap() {

        Map<String, Object> map = new HashMap<>();

        map.put("id",                   id);
        map.put("name",                 name);
        map.put("bloodType",            bloodType);
        map.put("city",                 city);
        map.put("latitude",             latitude);
        map.put("longitude",            longitude);
        map.put("isAvailable",          isAvailable);
        map.put("zone",                 zone);
        map.put("distanceFromHospital", distanceFromHospital);
        map.put("totalDonations",       totalDonations);
        map.put("isEligibleToDonate",   isEligibleToDonate());
        map.put("daysUntilEligible",    getDaysUntilEligible());

        return map;
    }

    /**
     * Returns full donor info as Map
     * (Used for profile / admin view)
     */
    public Map<String, Object> toFullMap() {

        Map<String, Object> map = new HashMap<>();

        map.put("id",                   id);
        map.put("name",                 name);
        map.put("email",                email);
        map.put("phone",                phone);
        map.put("gender",               gender);
        map.put("age",                  age);
        map.put("weight",               weight);
        map.put("bloodType",            bloodType);
        map.put("lastDonationDate",     lastDonationDate);
        map.put("isAvailable",          isAvailable);
        map.put("totalDonations",       totalDonations);
        map.put("latitude",             latitude);
        map.put("longitude",            longitude);
        map.put("address",              address);
        map.put("city",                 city);
        map.put("state",                state);
        map.put("pincode",              pincode);
        map.put("zone",                 zone);
        map.put("distanceFromHospital", distanceFromHospital);
        map.put("hasMedicalCondition",  hasMedicalCondition);
        map.put("medicalNotes",         medicalNotes);
        map.put("status",               status);
        map.put("isEligibleToDonate",   isEligibleToDonate());
        map.put("daysSinceLastDonation",getDaysSinceLastDonation());
        map.put("daysUntilEligible",    getDaysUntilEligible());
        map.put("createdAt",            createdAt);
        map.put("updatedAt",            updatedAt);

        return map;
    }

    // ============================================
    // GETTERS & SETTERS
    // ============================================

    // --- ID ---
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    // --- DONOR ID (Smart ID: DNR-[DDMM]-[Initial][3 Random Numbers]) ---
    public String getDonorId() { return donorId; }
    public void setDonorId(String donorId) { this.donorId = donorId; }

    // --- NAME ---
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    // --- EMAIL ---
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    // --- PHONE ---
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    // --- PASSWORD ---
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    // --- GENDER ---
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    // --- AGE ---
    public int getAge() { return age; }
    public void setAge(int age) { this.age = age; }

    // --- WEIGHT ---
    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }

    // --- BLOOD TYPE ---
    public String getBloodType() { return bloodType; }
    public void setBloodType(String bloodType) { this.bloodType = bloodType; }

    // --- LAST DONATION DATE ---
    public Date getLastDonationDate() { return lastDonationDate; }
    public void setLastDonationDate(Date lastDonationDate) { this.lastDonationDate = lastDonationDate; }

    // --- IS AVAILABLE ---
    public boolean isAvailable() { return isAvailable; }
    public void setAvailable(boolean available) { isAvailable = available; }

    // --- TOTAL DONATIONS ---
    public int getTotalDonations() { return totalDonations; }
    public void setTotalDonations(int totalDonations) { this.totalDonations = totalDonations; }

    // --- LATITUDE ---
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    // --- LONGITUDE ---
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    // --- ADDRESS ---
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    // --- CITY ---
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    // --- STATE ---
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    // --- PINCODE ---
    public String getPincode() { return pincode; }
    public void setPincode(String pincode) { this.pincode = pincode; }

    // --- ZONE ---
    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }

    // --- DISTANCE FROM HOSPITAL ---
    public double getDistanceFromHospital() { return distanceFromHospital; }
    public void setDistanceFromHospital(double distanceFromHospital) {
        this.distanceFromHospital = distanceFromHospital;
    }

    // --- HAS MEDICAL CONDITION ---
    public boolean isHasMedicalCondition() { return hasMedicalCondition; }
    public void setHasMedicalCondition(boolean hasMedicalCondition) {
        this.hasMedicalCondition = hasMedicalCondition;
    }

    // --- MEDICAL NOTES ---
    public String getMedicalNotes() { return medicalNotes; }
    public void setMedicalNotes(String medicalNotes) { this.medicalNotes = medicalNotes; }

    // --- STATUS ---
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    // --- CREATED AT ---
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    // --- UPDATED AT ---
    public Date getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Date updatedAt) { this.updatedAt = updatedAt; }

    // ============================================
    // TO STRING
    // ============================================

    @Override
    public String toString() {
        return "Donor{" +
                "id="               + id                  +
                ", name='"          + name                 + '\'' +
                ", email='"         + email                + '\'' +
                ", phone='"         + phone                + '\'' +
                ", gender='"        + gender               + '\'' +
                ", age="            + age                  +
                ", weight="         + weight               +
                ", bloodType='"     + bloodType            + '\'' +
                ", isAvailable="    + isAvailable          +
                ", totalDonations=" + totalDonations       +
                ", latitude="       + latitude             +
                ", longitude="      + longitude            +
                ", city='"          + city                 + '\'' +
                ", zone='"          + zone                 + '\'' +
                ", distance="       + distanceFromHospital + " km" +
                ", status='"        + status               + '\'' +
                ", isEligible="     + isEligibleToDonate() +
                '}';
    }
} 
    
