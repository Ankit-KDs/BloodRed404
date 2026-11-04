package com.red404;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

public class BloodRequest {

    // ============================================
    // FIELDS
    // ============================================

    // Basic Info
    private int       id;
    private int       hospitalId;
    private String    hospitalName;
    private String    hospitalPhone;
    private String    hospitalAddress;
    private double    hospitalLatitude;
    private double    hospitalLongitude;

    // Blood Info
    private String    bloodType;
    private int       unitsNeeded;
    private int       unitsFulfilled;

    // Request Info
    private String    urgencyLevel;      // CRITICAL, HIGH, MEDIUM, LOW
    private String    status;            // PENDING, FULFILLED, CANCELLED, EXPIRED
    private String    notes;
    private Timestamp requestDate;
    private Timestamp fulfilledDate;
    private Timestamp expiryDate;

    // Donor Tracking (DSA - List)
    private List<Integer> notifiedDonors = new ArrayList<>();   // Donor IDs notified
    private List<Integer> acceptedDonors = new ArrayList<>();   // Donor IDs accepted
    private List<Integer> declinedDonors = new ArrayList<>();   // Donor IDs declined

    // Zone Info
    private String    currentZone;          // Which zone is being notified now
    private int       notificationRadius;   // in km

    // ============================================
    // CONSTRUCTOR
    // ============================================
    public BloodRequest() {}

    // ============================================
    // LOGIC METHODS
    // ============================================

    // Helper method to calculate remaining units
    public int getUnitsRemaining() {
        return Math.max(0, unitsNeeded - unitsFulfilled);
    }

    // Check if request is expired
    public boolean isExpired() {
        if (expiryDate == null) return false;
        return System.currentTimeMillis() > expiryDate.getTime();
    }

    // Calculate minutes until expiry
    public long getMinutesUntilExpiry() {
        if (expiryDate == null) return 0;
        long diff = expiryDate.getTime() - System.currentTimeMillis();
        return Math.max(0, diff / (1000 * 60));
    }

    // ============================================
    // GETTERS & SETTERS
    // ============================================

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getHospitalId() { return hospitalId; }
    public void setHospitalId(int hospitalId) { this.hospitalId = hospitalId; }

    public String getHospitalName() { return hospitalName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

    public String getHospitalPhone() { return hospitalPhone; }
    public void setHospitalPhone(String hospitalPhone) { this.hospitalPhone = hospitalPhone; }

    public String getHospitalAddress() { return hospitalAddress; }
    public void setHospitalAddress(String hospitalAddress) { this.hospitalAddress = hospitalAddress; }

    public double getHospitalLatitude() { return hospitalLatitude; }
    public void setHospitalLatitude(double hospitalLatitude) { this.hospitalLatitude = hospitalLatitude; }

    public double getHospitalLongitude() { return hospitalLongitude; }
    public void setHospitalLongitude(double hospitalLongitude) { this.hospitalLongitude = hospitalLongitude; }

    public String getBloodType() { return bloodType; }
    public void setBloodType(String bloodType) { this.bloodType = bloodType; }

    public int getUnitsNeeded() { return unitsNeeded; }
    public void setUnitsNeeded(int unitsNeeded) { this.unitsNeeded = unitsNeeded; }

    public int getUnitsFulfilled() { return unitsFulfilled; }
    public void setUnitsFulfilled(int unitsFulfilled) { this.unitsFulfilled = unitsFulfilled; }

    public String getUrgencyLevel() { return urgencyLevel; }
    public void setUrgencyLevel(String urgencyLevel) { this.urgencyLevel = urgencyLevel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Timestamp getRequestDate() { return requestDate; }
    public void setRequestDate(Timestamp requestDate) { this.requestDate = requestDate; }

    public Timestamp getFulfilledDate() { return fulfilledDate; }
    public void setFulfilledDate(Timestamp fulfilledDate) { this.fulfilledDate = fulfilledDate; }

    public Timestamp getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Timestamp expiryDate) { this.expiryDate = expiryDate; }

    public List<Integer> getNotifiedDonors() { return notifiedDonors; }
    public void setNotifiedDonors(List<Integer> notifiedDonors) { this.notifiedDonors = notifiedDonors; }

    public String getCurrentZone() { return currentZone; }
    public void setCurrentZone(String currentZone) { this.currentZone = currentZone; }

    public int getNotificationRadius() { return notificationRadius; }
    public void setNotificationRadius(int notificationRadius) { this.notificationRadius = notificationRadius; }

    // ============================================
    // TO STRING
    // ============================================
    @Override
    public String toString() {
        return "BloodRequest{" +
                "id=" + id +
                ", hospitalName='" + hospitalName + '\'' +
                ", bloodType='" + bloodType + '\'' +
                ", unitsRemaining=" + getUnitsRemaining() +
                ", status='" + status + '\'' +
                ", radius=" + notificationRadius + "km" +
                '}';
    }
}