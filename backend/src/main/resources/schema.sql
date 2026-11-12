-- RED404 Schema (auto-initialized by Spring Boot)
-- Database is configured in application.properties

CREATE TABLE IF NOT EXISTS donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id VARCHAR(30) NULL DEFAULT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    father_name VARCHAR(150) NULL DEFAULT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    dob DATE NULL DEFAULT NULL,
    gender VARCHAR(20) NULL DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    blood_type VARCHAR(5) NOT NULL,
    weight DOUBLE NULL DEFAULT NULL,
    last_donation DATE NULL DEFAULT NULL,
    availability VARCHAR(40) DEFAULT 'Available',
    address VARCHAR(255) NULL DEFAULT NULL,
    city VARCHAR(80) NULL DEFAULT NULL,
    state VARCHAR(80) NULL DEFAULT NULL,
    pincode VARCHAR(10) NULL DEFAULT NULL,
    latitude DOUBLE NULL DEFAULT NULL,
    longitude DOUBLE NULL DEFAULT NULL,
    zone VARCHAR(80) NULL DEFAULT NULL,
    allergies VARCHAR(255) NULL DEFAULT NULL,
    conditions VARCHAR(255) NULL DEFAULT NULL,
    medications VARCHAR(255) NULL DEFAULT NULL,
    surgeries VARCHAR(255) NULL DEFAULT NULL,
    donor_type VARCHAR(80) NULL DEFAULT NULL,
    pulse INT NULL DEFAULT NULL,
    hemoglobin DOUBLE NULL DEFAULT NULL,
    blood_pressure VARCHAR(30) NULL DEFAULT NULL,
    body_temp DOUBLE NULL DEFAULT NULL,
    verified_facility VARCHAR(180) NULL DEFAULT NULL,
    verified_date DATE NULL DEFAULT NULL,
    qr_token VARCHAR(100) NULL DEFAULT NULL,
    sms_notif BOOLEAN DEFAULT TRUE,
    push_notif BOOLEAN DEFAULT TRUE,
    email_notif BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_name VARCHAR(180) NOT NULL,
    registration_no VARCHAR(80) NOT NULL,
    hospital_type VARCHAR(40),
    beds INT DEFAULT 0,
    blood_bank_license VARCHAR(80),
    hospital_email VARCHAR(150) NOT NULL UNIQUE,
    hospital_phone VARCHAR(20),
    website VARCHAR(150),
    services TEXT,
    admin_name VARCHAR(150),
    admin_designation VARCHAR(80),
    admin_phone VARCHAR(20),
    admin_email VARCHAR(150),
    password VARCHAR(255) NOT NULL,
    emergency_contact VARCHAR(20),
    address VARCHAR(255),
    landmark VARCHAR(150),
    city VARCHAR(80),
    state VARCHAR(80),
    pincode VARCHAR(10),
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    zone VARCHAR(80),
    operating_hours VARCHAR(40) DEFAULT '24x7',
    zone_radius INT DEFAULT 10,
    sms_notif BOOLEAN DEFAULT TRUE,
    push_notif BOOLEAN DEFAULT TRUE,
    email_notif BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blood_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_name VARCHAR(150),
    blood_type VARCHAR(5) NOT NULL,
    units_requested INT DEFAULT 1,
    urgency_level VARCHAR(20) DEFAULT 'HIGH',
    required_before DATE NULL,
    status VARCHAR(20) DEFAULT 'Active',
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_br_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id VARCHAR(30) NOT NULL,
    hospital_id INT NULL,
    blood_type VARCHAR(5),
    units INT DEFAULT 1,
    donation_date DATE,
    status VARCHAR(20) DEFAULT 'COMPLETED'
);

CREATE TABLE IF NOT EXISTS intake_snapshots (
    token VARCHAR(120) PRIMARY KEY,
    donor_id VARCHAR(30) NULL,
    snapshot_json MEDIUMTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_id VARCHAR(120) PRIMARY KEY,
    user_id VARCHAR(30) NOT NULL,
    user_type VARCHAR(20) NOT NULL DEFAULT 'DONOR',
    ip_address VARCHAR(60) NULL,
    user_agent VARCHAR(350) NULL,
    device VARCHAR(100) NULL,
    browser VARCHAR(100) NULL,
    location VARCHAR(150) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS burned_donor_ids (
    donor_id VARCHAR(30) PRIMARY KEY,
    burned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255) DEFAULT 'ACCOUNT_DELETED'
);

CREATE TABLE IF NOT EXISTS hospital_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    blood_type VARCHAR(10) NOT NULL,
    units INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hosp_blood (hospital_id, blood_type)
);
