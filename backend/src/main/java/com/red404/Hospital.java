package com.red404;


import java.sql.Date;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Hospital {

    // ============================================
    // FIELDS
    // ============================================

    // Basic Info
    private int    id;
    private String name;
    private String email;
    private String phone;
    private String password;
    private String registrationNumber;    // Hospital registration number
    private String type;                  // GOVERNMENT, PRIVATE, TRUST

    // Location Info (Haversine)
    private double latitude;
    private double longitude;
    private String address;
    private String city;
    private String state;
    private String pincode;

    // Blood Bank Info
    private boolean hasBloodBank;
    private String  bloodBankLicenseNumber;

    // Blood Inventory (Map of bloodType → units)
    private Map<String, Integer> bloodInventory;

    // Status
    private String status;               // ACTIVE, INACTIVE, SUSPENDED
    private boolean isVerified;          // Admin verified hospital
    private Date   createdAt;
    private Date   updatedAt;

    // Distance Info (set dynamically)
    private double distanceFromDonor;
    private String zone;

    // ============================================
    // CONSTANTS
    // ============================================

    public static final String STATUS_ACTIVE    = "ACTIVE";
    public static final String STATUS_INACTIVE  = "INACTIVE";
    public static final String STATUS_SUSPENDED = "SUSPENDED";

    public static final String TYPE_GOVERNMENT = "GOVERNMENT";
    public static final String TYPE_PRIVATE    = "PRIVATE";
    public static final String TYPE_TRUST      = "TRUST";

    // Valid blood types
    public static final List<String> VALID_BLOOD_TYPES = Arrays.asList(
        "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"
    );

    // ============================================
    // CONSTRUCTORS
    // ============================================

    // Default constructor
    public Hospital() {
        this.hasBloodBank     = false;
        this.isVerified       = false;
        this.status           = STATUS_ACTIVE;
        this.bloodInventory   = new HashMap<>();
        this.distanceFromDonor = 0.0;

        // Initialize blood inventory with 0 units
        for (String bloodType : VALID_BLOOD_TYPES) {
            this.bloodInventory.put(bloodType, 0);
        }
    }

    // Basic constructor (Registration)
    public Hospital(
            String name,
            String email,
            String phone,
            String password,
            String registrationNumber,
            String type,
            String address,
            String city,
            String state,
            String pincode,
            double latitude,
            double longitude,
            boolean hasBloodBank,
            String  bloodBankLicenseNumber) {

        this.name                   = name;
        this.email                  = email;
        this.phone                  = phone;
        this.password               = password;
        this.registrationNumber     = registrationNumber;
        this.type                   = type;
        this.address                = address;
        this.city                   = city;
        this.state                  = state;
        this.pincode                = pincode;
        this.latitude               = latitude;
        this.longitude              = longitude;
        this.hasBloodBank           = hasBloodBank;
        this.bloodBankLicenseNumber = bloodBankLicenseNumber;

        // Defaults
        this.isVerified       = false;
        this.status           = STATUS_ACTIVE;
        this.distanceFromDonor = 0.0;
        this.bloodInventory   = new HashMap<>();

        // Initialize blood inventory with 0 units
        for (String bloodType : VALID_BLOOD_TYPES) {
            this.bloodInventory.put(bloodType, 0);
        }
    }

    // Full constructor
    public Hospital(
            int     id,
            String  name,
            String  email,
            String  phone,
            String  password,
            String  registrationNumber,
            String  type,
            double  latitude,
            double  longitude,
            String  address,
            String  city,
            String  state,
            String  pincode,
            boolean hasBloodBank,
            String  bloodBankLicenseNumber,
            boolean isVerified,
            String  status,
            Date    createdAt,
            Date    updatedAt) {

        this.id                     = id;
        this.name                   = name;
        this.email                  = email;
        this.phone                  = phone;
        this.password               = password;
        this.registrationNumber     = registrationNumber;
        this.type                   = type;
        this.latitude               = latitude;
        this.longitude              = longitude;
        this.address                = address;
        this.city                   = city;
        this.state                  = state;
        this.pincode                = pincode;
        this.hasBloodBank           = hasBloodBank;
        this.bloodBankLicenseNumber = bloodBankLicenseNumber;
        this.isVerified             = isVerified;
        this.status                 = status;
        this.createdAt              = createdAt;
        this.updatedAt              = updatedAt;
        this.distanceFromDonor      = 0.0;
        this.bloodInventory         = new HashMap<>();

        // Initialize blood inventory with 0 units
        for (String bloodType : VALID_BLOOD_TYPES) {
            this.bloodInventory.put(bloodType, 0);
        }
    }

    // ============================================
    // VALIDATION METHODS
    // ============================================

    /**
     * Validates all hospital registration fields.
     * @return Map of field errors (empty if valid)
     */
    public Map<String, String> validate() {

        Map<String, String> errors = new HashMap<>();

        // Name validation
        if (name == null || name.trim().isEmpty()) {
            errors.put("name", "Hospital name is required");
        } else if (name.trim().length() < 3) {
            errors.put("name", "Hospital name must be at least 3 characters");
        } else if (name.trim().length() > 150) {
            errors.put("name", "Hospital name must not exceed 150 characters");
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

        // Registration number validation
        if (registrationNumber == null || registrationNumber.trim().isEmpty()) {
            errors.put("registrationNumber", "Hospital registration number is required");
        }

        // Type validation
        if (type == null || type.trim().isEmpty()) {
            errors.put("type", "Hospital type is required");
        } else if (!type.equalsIgnoreCase(TYPE_GOVERNMENT)
                && !type.equalsIgnoreCase(TYPE_PRIVATE)
                && !type.equalsIgnoreCase(TYPE_TRUST)) {
            errors.put("type", "Type must be GOVERNMENT, PRIVATE or TRUST");
        }

        // Address validation
        if (address == null || address.trim().isEmpty()) {
            errors.put("address", "Address is required");
        }

        // City validation
        if (city == null || city.trim().isEmpty()) {
            errors.put("city", "City is required");
        }

        // State validation
        if (state == null || state.trim().isEmpty()) {
            errors.put("state", "State is required");
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

        // Blood bank license validation
        if (hasBloodBank) {
            if (bloodBankLicenseNumber == null || bloodBankLicenseNumber.trim().isEmpty()) {
                errors.put("bloodBankLicenseNumber", "Blood bank license number is required");
            }
        }

        return errors;
    }

    // ============================================
    // BLOOD INVENTORY METHODS
    // ============================================

    /**
     * Updates blood units for a specific blood type.
     * @param bloodType Blood type to update
     * @param units     Units to set
     */
    public void updateBloodInventory(String bloodType, int units) {

        if (!VALID_BLOOD_TYPES.contains(bloodType)) {
            System.err.println("❌ Invalid blood type: " + bloodType);
            return;
        }

        if (units < 0) {
            System.err.println("❌ Units cannot be negative");
            return;
        }

        bloodInventory.put(bloodType, units);
    }

    /**
     * Gets available units for a specific blood type.
     * @param bloodType Blood type to check
     * @return Units available, 0 if not found
     */
    public int getBloodUnits(String bloodType) {
        return bloodInventory.getOrDefault(bloodType, 0);
    }

    /**
     * Checks if hospital has enough units of a blood type.
     * @param bloodType    Blood type to check
     * @param unitsNeeded  Units required
     * @return true if enough units available
     */
    public boolean hasEnoughBlood(String bloodType, int unitsNeeded) {
        return getBloodUnits(bloodType) >= unitsNeeded;
    }

    /**
     * Reduces blood units after fulfilling a request.
     * @param bloodType   Blood type to reduce
     * @param unitsUsed   Units to reduce
     * @return true if successful, false if not enough units
     */
    public boolean useBloodUnits(String bloodType, int unitsUsed) {

        int currentUnits = getBloodUnits(bloodType);

        if (currentUnits < unitsUsed) {
            System.err.println("❌ Not enough units of " + bloodType);
            return false;
        }

        bloodInventory.put(bloodType, currentUnits - unitsUsed);
        return true;
    }

    /**
     * Adds blood units to inventory (after donation).
     * @param bloodType    Blood type to add
     * @param unitsAdded   Units to add
     */
    public void addBloodUnits(String bloodType, int unitsAdded) {

        if (!VALID_BLOOD_TYPES.contains(bloodType)) {
            System.err.println("❌ Invalid blood type: " + bloodType);
            return;
        }

        int currentUnits = getBloodUnits(bloodType);
        bloodInventory.put(bloodType, currentUnits + unitsAdded);
    }

    /**
     * Returns list of blood types that are critically low.
     * (Less than 5 units)
     * @return Map of critically low blood types and their units
     */
    public Map<String, Integer> getCriticallyLowBloodTypes() {

        Map<String, Integer> criticalTypes = new HashMap<>();

        for (Map.Entry<String, Integer> entry : bloodInventory.entrySet()) {
            if (entry.getValue() < 5) {
                criticalTypes.put(entry.getKey(), entry.getValue());
            }
        }

        return criticalTypes;
    }

    /**
     * Returns total blood units across all types.
     * @return Total units available
     */
    public int getTotalBloodUnits() {

        int total = 0;

        for (int units : bloodInventory.values()) {
            total += units;
        }

        return total;
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Returns hospital summary as Map
     * (Used for API response without sensitive data)
     */
    public Map<String, Object> toPublicMap() {

        Map<String, Object> map = new HashMap<>();

        map.put("id",                 id);
        map.put("name",               name);
        map.put("phone",              phone);
        map.put("type",               type);
        map.put("city",               city);
        map.put("address",            address);
        map.put("latitude",           latitude);
        map.put("longitude",          longitude);
        map.put("hasBloodBank",       hasBloodBank);
        map.put("isVerified",         isVerified);
        map.put("bloodInventory",     bloodInventory);
        map.put("totalBloodUnits",    getTotalBloodUnits());
        map.put("criticallyLow",      getCriticallyLowBloodTypes());
        map.put("distanceFromDonor",  distanceFromDonor);
        map.put("zone",               zone);

        return map;
    }

    /**
     * Returns full hospital info as Map
     * (Used for profile / admin view)
     */
    public Map<String, Object> toFullMap() {

        Map<String, Object> map = new HashMap<>();

        map.put("id",                     id);
        map.put("name",                   name);
        map.put("email",                  email);
        map.put("phone",                  phone);
        map.put("registrationNumber",     registrationNumber);
        map.put("type",                   type);
        map.put("latitude",               latitude);
        map.put("longitude",              longitude);
        map.put("address",                address);
        map.put("city",                   city);
        map.put("state",                  state);
        map.put("pincode",                pincode);
        map.put("hasBloodBank",           hasBloodBank);
        map.put("bloodBankLicenseNumber", bloodBankLicenseNumber);
        map.put("bloodInventory",         bloodInventory);
        map.put("totalBloodUnits",        getTotalBloodUnits());
        map.put("criticallyLow",          getCriticallyLowBloodTypes());
        map.put("isVerified",             isVerified);
        map.put("status",                 status);
        map.put("distanceFromDonor",      distanceFromDonor);
        map.put("zone",                   zone);
        map.put("createdAt",              createdAt);
        map.put("updatedAt",              updatedAt);

        return map;
    }

    // ============================================
    // GETTERS & SETTERS
    // ============================================

    // --- ID ---
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

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

    // --- REGISTRATION NUMBER ---
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = registrationNumber;
    }

    // --- TYPE ---
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

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

    // --- HAS BLOOD BANK ---
    public boolean isHasBloodBank() { return hasBloodBank; }
    public void setHasBloodBank(boolean hasBloodBank) { this.hasBloodBank = hasBloodBank; }

    // --- BLOOD BANK LICENSE ---
    public String getBloodBankLicenseNumber() { return bloodBankLicenseNumber; }
    public void setBloodBankLicenseNumber(String bloodBankLicenseNumber) {
        this.bloodBankLicenseNumber = bloodBankLicenseNumber;
    }

    // --- BLOOD INVENTORY ---
    public Map<String, Integer> getBloodInventory() { return bloodInventory; }
    public void setBloodInventory(Map<String, Integer> bloodInventory) {
        this.bloodInventory = bloodInventory;
    }

    // --- IS VERIFIED ---
    public boolean isVerified() { return isVerified; }
    public void setVerified(boolean verified) { isVerified = verified; }

    // --- STATUS ---
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    // --- DISTANCE FROM DONOR ---
    public double getDistanceFromDonor() { return distanceFromDonor; }
    public void setDistanceFromDonor(double distanceFromDonor) {
        this.distanceFromDonor = distanceFromDonor;
    }

    // --- ZONE ---
    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }

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
        return "Hospital{" +
                "id="                  + id                  +
                ", name='"             + name                 + '\'' +
                ", email='"            + email                + '\'' +
                ", phone='"            + phone                + '\'' +
                ", type='"             + type                 + '\'' +
                ", city='"             + city                 + '\'' +
                ", latitude="          + latitude             +
                ", longitude="         + longitude            +
                ", hasBloodBank="      + hasBloodBank         +
                ", totalBloodUnits="   + getTotalBloodUnits() +
                ", isVerified="        + isVerified           +
                ", status='"           + status               + '\'' +
                ", distanceFromDonor=" + distanceFromDonor    + " km" +
                ", zone='"             + zone                 + '\'' +
                '}';
    }
}