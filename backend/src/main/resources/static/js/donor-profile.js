/* ============================================================
   RED404 — DONOR HEALTH PROFILE & MEDICAL ELIGIBILITY JS
   Purely Dynamic Vitals Parsing, AI Evaluation & 90-Day Tracker
============================================================ */

(function () {
  'use strict';

  // State: Initialized with null vitals (empty placeholders until hospital logs checkup)
  let currentDonor = {
    id: null,
    name: null,
    fatherName: null,
    email: null,
    bloodType: null,
    age: null,
    gender: null,
    phone: null,
    dob: null,
    address: null,
    city: null,
    state: null,
    pincode: null,
    donorType: null,
    weight: null,
    pulse: null,
    hemoglobin: null,
    bloodPressure: null,
    bodyTemp: null,
    verifiedFacility: null,
    verifiedDate: null,
    lastDonationDate: null,
    latitude: 28.3486,
    longitude: 79.5619,
    availability: 'Available',
    allergies: null,
    conditions: null,
    medications: null,
    surgeries: null,
    qrToken: null,
    healthChecks: [],
    healthStatus: null
  };

  let donationHistory = [];

  // DOM Elements
  const donorGreetingName = document.getElementById('donorGreetingName');
  const gpsCoordsText = document.getElementById('gpsCoordsText');
  const gpsSyncBtn = document.getElementById('gpsSyncBtn');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const hubSidebar = document.getElementById('hubSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // ======================== INITIALIZATION ========================
  document.addEventListener('DOMContentLoaded', async () => {
    // Proactive cleanup of any legacy demo defaults stored in client localStorage
    try {
      const purgeLegacyDemo = (obj) => {
        if (!obj) return;
        if (obj.fatherName && obj.fatherName.toLowerCase().includes('rajesh')) obj.fatherName = null;
        if (obj.father_name && obj.father_name.toLowerCase().includes('rajesh')) obj.father_name = null;
        if (obj.address && (obj.address.toLowerCase().includes('subharti') || obj.address.toLowerCase().includes('delhi road'))) obj.address = null;
        if (obj.dob === '1998-05-15') { obj.dob = null; obj.age = null; }
        if (obj.dateOfBirth === '1998-05-15') { obj.dateOfBirth = null; obj.age = null; }
        if (obj.lastDonationDate === '2024-01-10' || obj.lastDonation === '2024-01-10' || obj.last_donation === '2024-01-10') {
          obj.lastDonationDate = null;
          obj.lastDonation = null;
          obj.last_donation = null;
        }
        if (obj.allergies && (obj.allergies.toLowerCase().includes('no known drug') || obj.allergies.toLowerCase().includes('nkda'))) obj.allergies = null;
        if (obj.conditions && (obj.conditions.toLowerCase().includes('normal screening') || obj.conditions.toLowerCase().includes('none reported'))) obj.conditions = null;
        if (obj.medications && (obj.medications.toLowerCase().includes('unrestricted') || obj.medications.toLowerCase().includes('none /'))) obj.medications = null;
        if (obj.surgeries && (obj.surgeries.toLowerCase().includes('none reported') || obj.surgeries.toLowerCase().includes('< 12'))) obj.surgeries = null;
        if (obj.verifiedFacility && obj.verifiedFacility.toLowerCase().includes('city general')) obj.verifiedFacility = null;
        if (obj.verified_facility && obj.verified_facility.toLowerCase().includes('city general')) obj.verified_facility = null;
      };

      const rawSess = localStorage.getItem('red404_donor_session');
      if (rawSess) {
        const sObj = JSON.parse(rawSess);
        if (sObj && sObj.user) {
          purgeLegacyDemo(sObj.user);
          localStorage.setItem('red404_donor_session', JSON.stringify(sObj));
        }
      }
      const rawAuth = localStorage.getItem('red404_auth_session');
      if (rawAuth) {
        const aObj = JSON.parse(rawAuth);
        if (aObj && aObj.user) {
          purgeLegacyDemo(aObj.user);
          localStorage.setItem('red404_auth_session', JSON.stringify(aObj));
        }
      }
      const regDonors = localStorage.getItem('red404_registered_donors');
      if (regDonors) {
        const dList = JSON.parse(regDonors);
        if (Array.isArray(dList)) {
          dList.forEach(purgeLegacyDemo);
          localStorage.setItem('red404_registered_donors', JSON.stringify(dList));
        }
      }
    } catch (_) { }

    initMobileNav();
    initGPSListener();
    initEditModal();
    await loadDonorProfile();
    await loadDonationHistory();
    evaluateHealthAndEligibility();
    renderDigitalIdAndIntakePayload();

    // Auto-sync polling every 10s: Automatically catches new vitals recorded by hospital dashboard
    setInterval(async () => {
      await loadDonorProfile();
      await loadDonationHistory();
      evaluateHealthAndEligibility();
      renderDigitalIdAndIntakePayload();
    }, 10000);

    // Cross-tab / localStorage event: instantly updates if hospital dashboard saves intake
    window.addEventListener('storage', (e) => {
      if (e.key && (e.key.includes('donor') || e.key.includes('vitals') || e.key.includes('donation') || e.key.includes('qr'))) {
        loadDonorProfile().then(() => {
          evaluateHealthAndEligibility();
          loadDonationHistory();
          renderDigitalIdAndIntakePayload();
        });
      }
    });

    window.addEventListener('red404_language_changed', () => {
      evaluateHealthAndEligibility();
      renderDigitalIdAndIntakePayload();
    });
  });

  function cleanLiveVal(val, demoPatterns = []) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'none' || str === '') return null;
    for (const pat of demoPatterns) {
      if (str.toLowerCase().includes(pat.toLowerCase())) return null;
    }
    return str;
  }

  // ======================== 1. LOAD DONOR PROFILE ========================
  async function loadDonorProfile() {
    try {
      // 1. Read existing Auth session if available
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      let userData = session ? (session.user || session) : null;
      if (!userData) {
        try {
          const s = sessionStorage.getItem('donor_session') || sessionStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_auth_session') || sessionStorage.getItem('donorUser') || localStorage.getItem('donor_session') || localStorage.getItem('red404_donor_session') || localStorage.getItem('red404_auth_session');
          if (s) {
            const parsed = JSON.parse(s);
            userData = parsed.user || parsed;
          }
        } catch (_) { }
      }

      if (userData) {
        currentDonor.id = userData.id || currentDonor.id;
        currentDonor.name = userData.name || userData.fullName || ((userData.firstName ? userData.firstName + ' ' + (userData.lastName || '') : '') || currentDonor.name).trim();
        currentDonor.fatherName = cleanLiveVal(userData.fatherName || userData.father_name, ['rajesh']);
        if (userData.email) currentDonor.email = userData.email;
        currentDonor.bloodType = userData.bloodType || userData.blood_type || currentDonor.bloodType;
        if (userData.phone || userData.mobile) {
          const ph = String(userData.phone || userData.mobile).trim();
          if (ph !== '9876543210') currentDonor.phone = ph;
        }
        if (userData.gender) currentDonor.gender = userData.gender;
        if (userData.dob || userData.dateOfBirth) {
          const rawDob = userData.dob || userData.dateOfBirth;
          if (rawDob !== '1998-05-15') {
            currentDonor.dob = rawDob;
            currentDonor.age = calculateAge(currentDonor.dob);
          } else {
            currentDonor.dob = null;
            currentDonor.age = null;
          }
        }
        currentDonor.address = cleanLiveVal(userData.address, ['subharti', 'delhi road']);
        if (userData.city && userData.city !== 'Meerut') currentDonor.city = userData.city;
        if (userData.state && (userData.state !== 'Uttar Pradesh' || userData.city !== 'Meerut')) currentDonor.state = userData.state;
        if (userData.pincode && userData.pincode !== '250002') currentDonor.pincode = userData.pincode;
        if (userData.donorId || userData.donor_id) {
          currentDonor.donorId = userData.donorId || userData.donor_id;
          currentDonor.donor_id = currentDonor.donorId;
        }
        if (userData.createdAt || userData.created_at) currentDonor.createdAt = userData.createdAt || userData.created_at;
        currentDonor.allergies = cleanLiveVal(userData.allergies, ['no known drug', 'nkda']);
        currentDonor.conditions = cleanLiveVal(userData.conditions, ['normal screening', 'none reported']);
        currentDonor.medications = cleanLiveVal(userData.medications, ['unrestricted', 'none /']);
        currentDonor.surgeries = cleanLiveVal(userData.surgeries, ['none reported', '< 12']);
        currentDonor.donorType = cleanLiveVal(userData.donorType || userData.donor_type, ['voluntary lifesaver']);
        if (userData.qrToken || userData.qr_token) currentDonor.qrToken = userData.qrToken || userData.qr_token;
        if (userData.latitude && userData.longitude) {
          currentDonor.latitude = parseFloat(userData.latitude);
          currentDonor.longitude = parseFloat(userData.longitude);
        }
      }

      // Check registered donors cache in localStorage
      try {
        const cleanEmail = (currentDonor.email || '').trim().toLowerCase();
        const donorsList = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
        const matched = donorsList.find(d => (d.email && d.email.trim().toLowerCase() === cleanEmail) || (currentDonor.phone && d.phone && d.phone.trim() === currentDonor.phone.trim()));
        if (matched) {
          if (matched.name || matched.fullName) currentDonor.name = matched.name || matched.fullName;
          const matchFName = cleanLiveVal(matched.fatherName || matched.father_name, ['rajesh']);
          if (matchFName) currentDonor.fatherName = matchFName;
          if (matched.bloodType) currentDonor.bloodType = matched.bloodType;
          if (matched.phone) currentDonor.phone = matched.phone;
          if (matched.gender) currentDonor.gender = matched.gender;
          if (matched.dob || matched.dateOfBirth) {
            const mDob = matched.dob || matched.dateOfBirth;
            if (mDob !== '1998-05-15') {
              currentDonor.dob = mDob;
              currentDonor.age = calculateAge(currentDonor.dob);
            } else {
              currentDonor.dob = null;
              currentDonor.age = null;
            }
          }
          const matchAddr = cleanLiveVal(matched.address, ['subharti', 'delhi road']);
          if (matchAddr) currentDonor.address = matchAddr;
          if (matched.city) currentDonor.city = matched.city;
          if (matched.state) currentDonor.state = matched.state;
          if (matched.pincode || matched.pinCode) currentDonor.pincode = matched.pincode || matched.pinCode;
          if (matched.createdAt || matched.created_at) currentDonor.createdAt = matched.createdAt || matched.created_at;
          const matchAllg = cleanLiveVal(matched.allergies, ['no known drug', 'nkda']);
          if (matchAllg) currentDonor.allergies = matchAllg;
          const matchCond = cleanLiveVal(matched.conditions, ['normal screening', 'none reported']);
          if (matchCond) currentDonor.conditions = matchCond;
          const matchMeds = cleanLiveVal(matched.medications, ['unrestricted', 'none /']);
          if (matchMeds) currentDonor.medications = matchMeds;
          const matchSurg = cleanLiveVal(matched.surgeries, ['none reported', '< 12']);
          if (matchSurg) currentDonor.surgeries = matchSurg;
          const matchDType = cleanLiveVal(matched.donorType || matched.donor_type, ['voluntary lifesaver']);
          if (matchDType) currentDonor.donorType = matchDType;
          if (matched.qrToken || matched.qr_token) currentDonor.qrToken = matched.qrToken || matched.qr_token;
          if (matched.weight) currentDonor.weight = parseFloat(matched.weight);
        }
      } catch (_) { }

      // Check if hospital dashboard logged vitals locally in storage
      const localVitalsRaw = localStorage.getItem('hospitalDonorVitals_' + currentDonor.id) || sessionStorage.getItem('donorVitals');
      if (localVitalsRaw) {
        try {
          const lv = JSON.parse(localVitalsRaw);
          if (lv.weight !== undefined && lv.weight !== null) currentDonor.weight = parseFloat(lv.weight);
          if (lv.pulse !== undefined && lv.pulse !== null) currentDonor.pulse = parseInt(lv.pulse, 10);
          if (lv.hemoglobin !== undefined && lv.hemoglobin !== null) currentDonor.hemoglobin = parseFloat(lv.hemoglobin);
          if (lv.bloodPressure) currentDonor.bloodPressure = lv.bloodPressure;
          if (lv.bodyTemp !== undefined && lv.bodyTemp !== null) currentDonor.bodyTemp = parseFloat(lv.bodyTemp);
          const facClean = cleanLiveVal(lv.verifiedFacility, ['city general hospital']);
          if (facClean) currentDonor.verifiedFacility = facClean;
          if (lv.verifiedDate) currentDonor.verifiedDate = lv.verifiedDate;
        } catch (_) { }
      }

      // 2. Fetch fresh dynamic profile from API (/api/donor/profile-data or /api/donor/profile)
      const qParams = new URLSearchParams();
      if (currentDonor.email) qParams.set('email', currentDonor.email);
      if (currentDonor.id) qParams.set('donorId', currentDonor.id);
      const qStr = qParams.toString() ? '?' + qParams.toString() : '';
      const reqHeaders = {};
      const tok = sessionStorage.getItem('red404_token') || localStorage.getItem('red404_token') || (session ? session.token : null) || (currentDonor.id ? 'SESSION-DONOR-' + currentDonor.id : null);
      if (tok) {
        reqHeaders['Authorization'] = 'Bearer ' + tok;
        reqHeaders['X-Red404-Token'] = tok;
      }
      if (currentDonor.id) reqHeaders['X-Donor-Id'] = String(currentDonor.id);
      let res = await fetch(`/api/donor/profile-data${qStr}`, { headers: reqHeaders, cache: 'no-store', credentials: 'include' });
      if (!res.ok && res.status !== 404 && res.status !== 401) {
        res = await fetch(`/api/donor/profile${qStr}`, { headers: reqHeaders, cache: 'no-store', credentials: 'include' });
      }
      if (res.status === 401 || res.status === 404) {
        try {
          if (window.Red404Security) window.Red404Security.clearRoleStorage('DONOR');
          else {
            localStorage.removeItem('donor_session');
            localStorage.removeItem('red404_donor_session');
            localStorage.removeItem('red404_auth_session');
            localStorage.removeItem('donorUser');
          }
        } catch (_) { }
        window.location.replace('donor-login.html');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          currentDonor.id = d.id || currentDonor.id;
          currentDonor.name = d.name || d.fullName || currentDonor.name;
          currentDonor.fatherName = cleanLiveVal(d.fatherName || d.father_name, ['rajesh']);
          currentDonor.bloodType = d.bloodType || d.blood_type || currentDonor.bloodType;
          if (d.email) currentDonor.email = d.email;
          if (d.phone || d.mobile) {
            const ph = String(d.phone || d.mobile).trim();
            if (ph !== '9876543210') currentDonor.phone = ph;
          }
          if (d.gender) currentDonor.gender = d.gender;
          currentDonor.address = cleanLiveVal(d.address, ['subharti', 'delhi road']);
          if (d.city && d.city !== 'Meerut') currentDonor.city = d.city;
          if (d.state && (d.state !== 'Uttar Pradesh' || d.city !== 'Meerut')) currentDonor.state = d.state;
          if ((d.pincode || d.pinCode) && (d.pincode !== '250002' && d.pinCode !== '250002')) currentDonor.pincode = d.pincode || d.pinCode;
          if (d.donorId || d.donor_id) {
            currentDonor.donorId = d.donorId || d.donor_id;
            currentDonor.donor_id = currentDonor.donorId;
          }
          if (d.createdAt || d.created_at) currentDonor.createdAt = d.createdAt || d.created_at;
          currentDonor.allergies = cleanLiveVal(d.allergies, ['no known drug', 'nkda']);
          currentDonor.conditions = cleanLiveVal(d.conditions, ['normal screening', 'none reported']);
          currentDonor.medications = cleanLiveVal(d.medications, ['unrestricted', 'none /']);
          currentDonor.surgeries = cleanLiveVal(d.surgeries, ['none reported', '< 12']);
          currentDonor.donorType = cleanLiveVal(d.donorType || d.donor_type, ['voluntary lifesaver']);
          if (d.qrToken || d.qr_token) currentDonor.qrToken = d.qrToken || d.qr_token;
          if (d.weight !== undefined && d.weight !== null && String(d.weight).trim() !== '') currentDonor.weight = parseFloat(d.weight);
          else currentDonor.weight = null;
          if (d.pulse !== undefined && d.pulse !== null && String(d.pulse).trim() !== '') currentDonor.pulse = parseInt(d.pulse, 10);
          else currentDonor.pulse = null;
          if (d.hemoglobin !== undefined && d.hemoglobin !== null && String(d.hemoglobin).trim() !== '') currentDonor.hemoglobin = parseFloat(d.hemoglobin);
          else currentDonor.hemoglobin = null;
          if (d.bloodPressure) currentDonor.bloodPressure = d.bloodPressure;
          else currentDonor.bloodPressure = null;
          if (d.bodyTemp !== undefined && d.bodyTemp !== null && String(d.bodyTemp).trim() !== '') currentDonor.bodyTemp = parseFloat(d.bodyTemp);
          else currentDonor.bodyTemp = null;
          currentDonor.verifiedFacility = cleanLiveVal(d.verifiedFacility, ['city general hospital']);
          currentDonor.verifiedDate = d.verifiedDate || null;
          const ldVal = d.lastDonationDate || d.lastDonation;
          if (ldVal && ldVal !== '2024-01-10') {
            currentDonor.lastDonationDate = ldVal;
          } else {
            currentDonor.lastDonationDate = null;
          }
          const dobVal = d.dateOfBirth || d.dob;
          if (dobVal && dobVal !== '1998-05-15') {
            currentDonor.dob = dobVal;
            currentDonor.age = calculateAge(dobVal);
          } else {
            currentDonor.dob = null;
            currentDonor.age = null;
          }
          if (d.eligibility) {
            currentDonor.eligibility = d.eligibility;
          }
          if (d.nextEligibleDate || d.next_eligible_date) currentDonor.nextEligibleDate = d.nextEligibleDate || d.next_eligible_date;
          if (d.daysToNextEligible !== undefined || d.days_until_eligible !== undefined || d.daysRemaining !== undefined) {
            currentDonor.daysToNextEligible = d.daysToNextEligible !== undefined ? d.daysToNextEligible : (d.days_until_eligible !== undefined ? d.days_until_eligible : d.daysRemaining);
          }
          if (d.cooldown_days !== undefined || d.donationGapDays !== undefined) currentDonor.donationGapDays = d.cooldown_days || d.donationGapDays;
          if (d.totalDonations !== undefined) currentDonor.totalDonations = d.totalDonations;
          if (d.isEligible !== undefined || d.eligible !== undefined) currentDonor.isEligible = d.isEligible !== undefined ? d.isEligible : d.eligible;
          if (d.latitude && d.longitude) {
            currentDonor.latitude = parseFloat(d.latitude);
            currentDonor.longitude = parseFloat(d.longitude);
          }
          if (d.preferredLanguage || d.preferred_language) {
            currentDonor.preferredLanguage = d.preferredLanguage || d.preferred_language;
            if (window.RED404_I18N && !localStorage.getItem('red404_lang')) {
              window.RED404_I18N.setLanguage(currentDonor.preferredLanguage);
            }
          }
          if (d.smsNotif !== undefined) currentDonor.smsNotif = d.smsNotif;
          if (d.emailNotif !== undefined) currentDonor.emailNotif = d.emailNotif;
          if (d.pushNotif !== undefined) currentDonor.pushNotif = d.pushNotif;
          // Step 2: healthChecks history (only returned when authenticated as self)
          if (Array.isArray(d.healthChecks)) currentDonor.healthChecks = d.healthChecks;
          if (d.latestHealthCheck) {
            currentDonor.latestHealthCheck = d.latestHealthCheck;
            if (currentDonor.pulse == null && d.latestHealthCheck.pulse != null) currentDonor.pulse = d.latestHealthCheck.pulse;
            if (currentDonor.hemoglobin == null && d.latestHealthCheck.hemoglobin != null) currentDonor.hemoglobin = d.latestHealthCheck.hemoglobin;
            if (!currentDonor.bloodPressure && d.latestHealthCheck.bloodPressure) currentDonor.bloodPressure = d.latestHealthCheck.bloodPressure;
            if (currentDonor.bodyTemp == null && d.latestHealthCheck.temperature != null) currentDonor.bodyTemp = d.latestHealthCheck.temperature;
            if (currentDonor.weight == null && d.latestHealthCheck.weight != null) currentDonor.weight = d.latestHealthCheck.weight;
          }
          if (d.healthStatus) currentDonor.healthStatus = d.healthStatus;
          if (d.availability) currentDonor.availability = d.availability;
          if (d.pausedUntil || d.paused_until) currentDonor.pausedUntil = d.pausedUntil || d.paused_until;
          if (d.bloodGroupStatus || d.blood_group_status) currentDonor.bloodGroupStatus = d.bloodGroupStatus || d.blood_group_status;
          if (d.bloodGroupVerifiedByHospitalName) currentDonor.bloodGroupVerifiedByHospitalName = d.bloodGroupVerifiedByHospitalName;
          if (d.publicSearchOptIn !== undefined || d.public_search_opt_in !== undefined) currentDonor.publicSearchOptIn = d.publicSearchOptIn !== undefined ? d.publicSearchOptIn : d.public_search_opt_in;
          if (d.publicConsentAt || d.public_consent_at) currentDonor.publicConsentAt = d.publicConsentAt || d.public_consent_at;
        }
      }
    } catch (e) {
      console.warn('Profile fetch notice:', e);
    }

    // Render top header info
    if (donorGreetingName) donorGreetingName.textContent = currentDonor.name;
    const dropdownUserEmailSpan = document.getElementById('dropdown-user-email');
    if (dropdownUserEmailSpan && currentDonor.email) {
      dropdownUserEmailSpan.textContent = currentDonor.email;
    }
    if (window.updateCommandNav) {
      window.updateCommandNav(currentDonor);
    }
    updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);
    renderDigitalIdAndIntakePayload();
  }

  // ======================== 2. LOAD DONATION HISTORY ========================
  // Purely Real-Time DB Feed: ZERO mock records. Populates only when hospital directly approves.
  async function loadDonationHistory() {
    try {
      let res = await fetch(`/api/donor/history?donorId=${currentDonor.id}`);
      if (!res.ok) {
        res = await fetch(`/api/donor/donation-history?donorId=${currentDonor.id}`);
      }

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          donationHistory = json.data;
        } else if (Array.isArray(json)) {
          donationHistory = json;
        } else {
          donationHistory = [];
        }
      } else {
        donationHistory = [];
      }
    } catch (e) {
      console.warn('Real-time donation history notice:', e);
      donationHistory = [];
    }

    // If profile had no lastDonationDate, check newest donation history record
    if (!currentDonor.lastDonationDate && donationHistory.length > 0) {
      currentDonor.lastDonationDate = donationHistory[0].donationDate || donationHistory[0].date;
    }

    renderDigitalIdAndIntakePayload();
    evaluateAndRenderMilestones();
  }

  // ======================== 3. AI HEALTH EVALUATION & VITALS ========================
  function evaluateHealthAndEligibility() {
    renderVitalsCard();
    renderMedicalEligibilityTracker();
    evaluateAndRenderMilestones();
    renderHealthCheckHistory();
  }

  function isBpNormal(bpStr) {
    if (!bpStr || typeof bpStr !== 'string') return false;
    const parts = bpStr.split('/');
    if (parts.length !== 2) return false;
    const systolic = parseInt(parts[0].trim(), 10);
    const diastolic = parseInt(parts[1].trim(), 10);
    return systolic >= 100 && systolic <= 140 && diastolic >= 60 && diastolic <= 90;
  }

  function renderVitalsCard() {
    // 1. Blood Emblem Box
    const beType = document.getElementById('vitalBloodType');
    const beLabel = document.getElementById('vitalBloodLabel');
    const bloodGroup = currentDonor.bloodType || 'A+';
    if (beType) beType.textContent = bloodGroup;
    if (beLabel) {
      beLabel.textContent = bloodGroup.includes('-') ? 'NEGATIVE' : 'POSITIVE';
    }

    // Latest health check or profile vitals
    const latestCheck = currentDonor.latestHealthCheck ||
      ((Array.isArray(currentDonor.healthChecks) && currentDonor.healthChecks.length > 0) ? currentDonor.healthChecks[0] : null);

    const weightVal = latestCheck && latestCheck.weight != null ? latestCheck.weight : currentDonor.weight;
    const pulseVal = latestCheck && latestCheck.pulse != null ? latestCheck.pulse : currentDonor.pulse;
    const hbVal = latestCheck && latestCheck.hemoglobin != null ? latestCheck.hemoglobin : currentDonor.hemoglobin;
    const bpVal = latestCheck && latestCheck.bloodPressure ? latestCheck.bloodPressure : currentDonor.bloodPressure;
    const tempVal = latestCheck && latestCheck.temperature != null ? latestCheck.temperature : (currentDonor.bodyTemp != null ? currentDonor.bodyTemp : currentDonor.temperature);
    const checkDate = (latestCheck && (latestCheck.date || latestCheck.checkedAt)) ? (latestCheck.date || latestCheck.checkedAt.substring(0, 10)) : currentDonor.verifiedDate;
    const hospName = (latestCheck && latestCheck.hospitalName) ? latestCheck.hospitalName : currentDonor.verifiedFacility;

    const hasRealVitals = Boolean(
      (latestCheck && (latestCheck.hospitalName || latestCheck.date || latestCheck.checkedAt || latestCheck.pulse || latestCheck.hemoglobin)) ||
      (currentDonor.verifiedFacility && currentDonor.verifiedDate) ||
      (checkDate && hospName)
    );

    const vitalsDetailsBox = document.querySelector('.vitals-details-box');
    const topMeta = document.getElementById('vitalsTopMeta') || document.querySelector('.vitals-top-meta');
    const verifiedSub = document.getElementById('vitalsVerifiedSub');
    const vitalRows = document.querySelectorAll('.vitals-details-box .vital-row');
    const statusLineEl = document.getElementById('vitalsHealthStatusLine');

    let waitingEl = document.getElementById('vitalsWaitingNotice');
    if (!waitingEl && vitalsDetailsBox) {
      waitingEl = document.createElement('div');
      waitingEl.id = 'vitalsWaitingNotice';
      waitingEl.style.cssText = 'padding: 16px 0; font-size: 14px; color: #9b9a96; font-style: normal;';
      vitalsDetailsBox.appendChild(waitingEl);
    }

    if (!hasRealVitals) {
      if (waitingEl) {
        waitingEl.innerHTML = `
          <div class="vitals-empty-state-card" style="display: flex; flex-direction: column; justify-content: center; min-height: 150px; padding: 6px 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="fa-solid fa-notes-medical" style="color: #38bdf8; font-size: 16px;"></i>
              <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #ecebe8;">No health check yet</h3>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #9b9a96; line-height: 1.45;">
              Your hospital check will appear here after your first visit. Bring your RED404 ID.
            </p>
            <div>
              <a href="blood-banks.html" class="vitals-empty-link" style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #38bdf8; text-decoration: underline; cursor: pointer;">
                <i class="fa-solid fa-hospital"></i>
                <span>Find nearby blood banks</span>
              </a>
            </div>
          </div>
        `;
        waitingEl.style.display = 'block';
      }
      if (topMeta) topMeta.style.display = 'none';
      if (verifiedSub) verifiedSub.style.display = 'none';
      vitalRows.forEach(r => r.style.display = 'none');
      if (statusLineEl) statusLineEl.style.display = 'none';
    } else {
      if (waitingEl) waitingEl.style.display = 'none';
      if (topMeta) {
        topMeta.style.display = (currentDonor.age !== null && currentDonor.age !== undefined) ? 'block' : 'none';
        const ageEl = document.getElementById('vitalAge');
        if (ageEl) ageEl.textContent = (currentDonor.age !== null && currentDonor.age !== undefined) ? currentDonor.age : '--';
      }
      if (verifiedSub) {
        if (checkDate) {
          const atHosp = hospName ? ` at ${hospName}` : '';
          verifiedSub.textContent = `Checked on ${formatDate(checkDate)}${atHosp}`;
          verifiedSub.style.display = 'block';
        } else {
          verifiedSub.style.display = 'none';
        }
      }
      vitalRows.forEach(r => r.style.display = 'flex');

      // Evaluations using SAME clinical ranges config as Check-in (HealthCheckDao)
      const evals = latestCheck ? (latestCheck.evaluations || {}) : {};

      const evalWeight = evals.weight || (weightVal != null
        ? (weightVal >= 45.0 && weightVal <= 200.0 ? 'Within usual range' : 'Outside usual range. Please speak to the hospital doctor')
        : null);
      const evalPulse = evals.pulse || (pulseVal != null
        ? (pulseVal >= 50 && pulseVal <= 100 ? 'Within usual range' : 'Outside usual range. Please speak to the hospital doctor')
        : null);
      const evalHb = evals.hemoglobin || (hbVal != null
        ? (hbVal >= 12.5 && hbVal <= 20.0 ? 'Within usual range' : 'Outside usual range. Please speak to the hospital doctor')
        : null);
      let evalBp = evals.bloodPressure;
      if (!evalBp && bpVal) {
        const parts = bpVal.split('/');
        if (parts.length === 2) {
          const sys = parseInt(parts[0].trim(), 10);
          const dia = parseInt(parts[1].trim(), 10);
          evalBp = (sys >= 100 && sys <= 180 && dia >= 50 && dia <= 100)
            ? 'Within usual range'
            : 'Outside usual range. Please speak to the hospital doctor';
        }
      }
      const evalTemp = evals.temperature || (tempVal != null
        ? (tempVal >= 95.0 && tempVal <= 99.5 ? 'Within usual range' : 'Outside usual range. Please speak to the hospital doctor')
        : null);

      function setVitalPill(pillId, text) {
        const pill = document.getElementById(pillId);
        if (!pill) return;
        if (!text) {
          pill.style.display = 'none';
          return;
        }
        const isOk = text.includes('Within');
        pill.className = `vital-pill ${isOk ? 'pill-normal' : 'pill-alert'}`;
        pill.textContent = text;
        pill.style.display = 'inline-block';
      }

      // 1. Weight
      const weightEl = document.getElementById('vitalWeight');
      if (weightEl) weightEl.textContent = (weightVal != null) ? weightVal : '--';
      setVitalPill('weightPill', evalWeight);

      // 2. Pulse
      const pulseEl = document.getElementById('vitalPulse');
      if (pulseEl) pulseEl.textContent = (pulseVal != null) ? pulseVal : '--';
      setVitalPill('pulsePill', evalPulse);

      // 3. Hemoglobin
      const hbEl = document.getElementById('vitalHemoglobin');
      if (hbEl) hbEl.textContent = (hbVal != null) ? hbVal : '--';
      setVitalPill('hbPill', evalHb);

      // 4. Blood Pressure
      const bpEl = document.getElementById('vitalBP');
      if (bpEl) bpEl.textContent = bpVal || '--/--';
      setVitalPill('bpPill', evalBp);

      // 5. Body Temperature
      const tempEl = document.getElementById('vitalTemp');
      if (tempEl) tempEl.textContent = (tempVal != null) ? tempVal : '--';
      setVitalPill('tempPill', evalTemp);

      // Health status line
      if (statusLineEl) {
        statusLineEl.textContent = currentDonor.healthStatus ||
          (hospName && checkDate ? `Checked at ${hospName} on ${formatDate(checkDate)}` : '');
        statusLineEl.style.display = statusLineEl.textContent ? 'block' : 'none';
      }
    }
  }

  // ======================== NEW ELIGIBILITY TRACKER (PART 2) ========================
  function renderTelemetryData() {
    const metaTag = document.getElementById('eligibilityMetaTag');
    const genderGap = (currentDonor.gender && currentDonor.gender.toLowerCase() === 'female') ? 120 : 90;

    // Single source of truth from Server computeEligibility
    const elig = currentDonor.eligibility || {
      eligible: currentDonor.isEligible !== false,
      days_until_eligible: currentDonor.daysToNextEligible || currentDonor.daysUntilEligible || 0,
      last_donation_date: currentDonor.lastDonationDate || currentDonor.lastDonation || null,
      next_eligible_date: currentDonor.nextEligibleDate || null,
      progress_pct: (currentDonor.daysToNextEligible ? Math.max(0, Math.min(100, Math.round(((genderGap - currentDonor.daysToNextEligible) / genderGap) * 100))) : 100),
      cooldown_days: genderGap,
      reason: currentDonor.eligibilityReason || 'Eligible to donate'
    };

    const isEligible = Boolean(elig.eligible);
    const daysUntil = typeof elig.days_until_eligible === 'number' ? elig.days_until_eligible : 0;
    const cooldownDays = elig.cooldown_days || genderGap;
    const progressPct = typeof elig.progress_pct === 'number' ? Math.max(0, Math.min(100, elig.progress_pct)) : (isEligible ? 100 : 0);
    const lastDateStr = elig.last_donation_date || currentDonor.lastDonationDate || currentDonor.lastDonation || null;
    const nextDateStr = elig.next_eligible_date || currentDonor.nextEligibleDate || null;
    const hospName = currentDonor.verifiedFacility || 'Verified Hospital';

    const hasDonated = (currentDonor.totalDonations != null && currentDonor.totalDonations > 0) ||
      (Array.isArray(currentDonor.donations) && currentDonor.donations.length > 0) ||
      Boolean(lastDateStr);

    let formattedNextDate = 'soon';
    if (nextDateStr) {
      try {
        const nextD = new Date(nextDateStr);
        formattedNextDate = !isNaN(nextD.getTime())
          ? nextD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : nextDateStr;
      } catch (_) {
        formattedNextDate = nextDateStr;
      }
    }

    let formattedLastDate = 'No donation yet';
    if (lastDateStr) {
      try {
        const lastD = new Date(lastDateStr);
        formattedLastDate = !isNaN(lastD.getTime())
          ? lastD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : lastDateStr;
      } catch (_) {
        formattedLastDate = lastDateStr;
      }
    }

    // Part 2 Item 3 texts:
    // - never donated: "No donation yet. You're ready."
    // - ready: "You can donate. The hospital does a final check before donating."
    // - filling: "Next donation possible on <date> (N days left)"
    let statusWording = '';
    if (isEligible) {
      if (!hasDonated) {
        statusWording = "No donation yet. You're ready.";
      } else {
        statusWording = "You can donate. The hospital does a final check before donating.";
      }
    } else {
      statusWording = `Next donation possible on ${formattedNextDate} (${daysUntil} ${daysUntil === 1 ? 'day' : 'days'} left)`;
    }

    // 1. SVG Progress Ring (~160 px, 10 px stroke, track #2a2c31)
    const ringCircle = document.getElementById('eligibilityRingCircle');
    const ringVal = document.getElementById('eligibilityRingValue');
    const ringSub = document.getElementById('eligibilityRingSubtitle');

    const radius = 70;
    const circumference = 2 * Math.PI * radius; // ~439.82

    if (ringCircle) {
      ringCircle.style.strokeDasharray = `${circumference}`;
      const offset = isEligible ? 0 : circumference * (1 - (progressPct / 100));
      ringCircle.style.strokeDashoffset = `${offset}`;
      ringCircle.style.stroke = isEligible ? '#3ecf8e' : '#ecebe8';
    }

    if (ringVal) {
      if (isEligible) {
        ringVal.textContent = 'Ready';
        ringVal.setAttribute('fill', '#3ecf8e');
        ringVal.style.fontSize = '28px';
        ringVal.setAttribute('y', '80');
        if (ringSub) ringSub.style.display = 'none';
      } else {
        ringVal.textContent = String(daysUntil);
        ringVal.setAttribute('fill', '#ecebe8');
        ringVal.style.fontSize = '34px';
        ringVal.setAttribute('y', '74');
        if (ringSub) {
          ringSub.style.display = 'block';
          ringSub.textContent = 'days left';
        }
      }
    }

    // 2. Beside it details
    const eligLastEl = document.getElementById('eligLastDonation');
    if (eligLastEl) {
      eligLastEl.textContent = hasDonated ? `${formattedLastDate}${hospName ? ' (' + hospName + ')' : ''}` : 'No donation yet';
    }

    const eligNextEl = document.getElementById('eligNextDate');
    if (eligNextEl) {
      eligNextEl.textContent = isEligible ? 'Ready to donate' : formattedNextDate;
    }

    const eligGapEl = document.getElementById('eligGapLength');
    if (eligGapEl) {
      eligGapEl.textContent = `${cooldownDays} days`;
    }

    // 3. Status wording
    const statusMsgEl = document.getElementById('eligibilityStatusMsg');
    if (statusMsgEl) {
      statusMsgEl.textContent = statusWording;
    }

    // 4. Accessible region
    const trackerRegion = document.getElementById('eligibilityTrackerBody');
    if (trackerRegion) {
      trackerRegion.setAttribute('aria-label', `Medical eligibility tracker: ${statusWording}`);
    }

    // 5. Horizontal timeline bar under it with marker for today
    const fillBar = document.getElementById('timelineFillBar');
    const todayMarker = document.getElementById('timelineTodayMarker');
    const startLabel = document.getElementById('timelineStartLabel');
    const endLabel = document.getElementById('timelineEndLabel');

    const pct = isEligible ? 100 : progressPct;
    if (fillBar) {
      fillBar.style.width = `${pct}%`;
      fillBar.style.backgroundColor = isEligible ? '#3ecf8e' : '#ecebe8';
    }
    if (todayMarker) {
      todayMarker.style.left = `${pct}%`;
    }
    if (startLabel) {
      startLabel.textContent = hasDonated ? formattedLastDate : 'Start';
    }
    if (endLabel) {
      endLabel.textContent = isEligible ? 'Ready' : formattedNextDate;
    }
  }

  function renderMedicalEligibilityTracker() {
    renderTelemetryData();
  }

  function renderHealthCheckHistory() {
    // Health Check History card removed from donor profile in Part 2
  }

  // ======================== 4. DYNAMIC DONOR BADGES EVALUATION ========================
  /**
   * Modular function to evaluate and dynamically unlock donor milestone achievement badges
   * @param {Object} donorProfile - The donor profile object (must contain bloodGroup or bloodType)
   * @param {Array} donationHistory - The donor's verified donation history list
   */
  function evaluateDonorBadges(donorProfile, donationHistory) {
    const counter = document.getElementById('badgesEarnedCounter');
    const profile = donorProfile || currentDonor || {};
    const hist = Array.isArray(donationHistory) ? donationHistory : [];

    // Blood group parsing (support bloodGroup or bloodType)
    const bloodGroup = String(profile.bloodGroup || profile.bloodType || '').trim().toUpperCase();
    const isRareRh = bloodGroup.includes('-');

    // Exact Gamification Rules:
    // 1. FIRST SAVIOR (first-savior): Unlocks if donationHistory.length >= 1
    const isFirstSavior = hist.length >= 1;

    // 2. GOLDEN HOUR HERO (golden-hour): Unlocks if any donation has responseTime <= 45 (minutes)
    const isGoldenHour = hist.some(d => {
      const respTime = (d.responseTime !== undefined && d.responseTime !== null) ? Number(d.responseTime) : null;
      if (respTime !== null && !isNaN(respTime) && respTime <= 45) return true;
      const urg = String(d.urgency || d.priority || d.tag || d.donationType || '').toUpperCase();
      return urg.includes('CRITICAL') || urg.includes('EMERGENCY');
    });

    // 3. NIGHT OWL (night-owl): Unlocks only if verified donation was between 9 PM (21:00) and 6 AM (06:00) IST (Asia/Kolkata)
    const isNightOwl = hist.some(d => {
      const dt = d.createdAt || d.timestamp || d.donationDate || d.date;
      if (!dt) return false;
      const strVal = String(dt).trim();
      // Date-only string (e.g. 2026-11-15) represents standard daytime check-in operating hours, NOT Night Owl
      if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return false;
      try {
        const parsed = new Date(dt);
        if (isNaN(parsed.getTime())) return false;
        const istHourStr = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hour12: false
        }).format(parsed);
        const hour = parseInt(istHourStr, 10);
        return hour >= 21 || hour < 6;
      } catch (_) {
        return false;
      }
    });

    // 4. RARE VANGUARD (rare-vanguard): Unlocks if bloodGroup contains '-' AND donationHistory.length >= 1
    const isRareVanguard = isRareRh && hist.length >= 1;

    // 5. LIFE GIVER V (life-giver): Unlocks if donationHistory.length >= 5
    const isLifeGiver = hist.length >= 5;

    // 6. APEX GUARDIAN (apex-guardian): Unlocks if donationHistory.length >= 10
    const isApexGuardian = hist.length >= 10;

    const rules = [
      { id: 'first-savior', unlocked: isFirstSavior, themeClass: 'unlocked-emerald', lockedText: 'LOCKED' },
      { id: 'golden-hour', unlocked: isGoldenHour, themeClass: 'unlocked-amber', lockedText: 'LOCKED' },
      { id: 'night-owl', unlocked: isNightOwl, themeClass: 'unlocked-indigo', lockedText: 'LOCKED' },
      { id: 'rare-vanguard', unlocked: isRareVanguard, themeClass: 'unlocked-ruby', lockedText: 'LOCKED' },
      { id: 'life-giver', unlocked: isLifeGiver, themeClass: 'unlocked-cyan', lockedText: 'LOCKED • Req. 5 Donations' },
      { id: 'apex-guardian', unlocked: isApexGuardian, themeClass: 'unlocked-gold', lockedText: 'LOCKED • Req. 10 Donations' }
    ];

    let unlockedCount = 0;

    // Iterate over the gamification rules and perform dynamic DOM unlock/lock updates
    rules.forEach(rule => {
      const card = document.querySelector(`.milestone-badge-tile[data-badge="${rule.id}"]`);
      if (!card) return;

      const statusEl = card.querySelector('.badge-status');
      const lockIcon = card.querySelector('.mbt-card-lock, .fa-lock');

      if (rule.unlocked) {
        unlockedCount++;

        // Remove locked class and add unlocked class + color theme
        card.classList.remove('locked');
        card.classList.add('unlocked', rule.themeClass);

        // Remove the padlock icon
        if (lockIcon) {
          lockIcon.remove();
        }

        // Change status text inside the badge to 'UNLOCKED' and apply vibrant emerald green
        if (statusEl) {
          statusEl.textContent = 'UNLOCKED';
          statusEl.style.color = '#2ea071';
        }
      } else {
        // Ensure locked state
        card.classList.remove('unlocked', 'unlocked-emerald', 'unlocked-amber', 'unlocked-indigo', 'unlocked-ruby', 'unlocked-cyan', 'unlocked-gold');
        card.classList.add('locked');

        // Restore padlock icon if removed
        if (!lockIcon) {
          const newLock = document.createElement('i');
          newLock.className = 'fa-solid fa-lock mbt-card-lock';
          card.prepend(newLock);
        }

        // Restore locked status text
        if (statusEl) {
          statusEl.textContent = rule.lockedText;
          statusEl.style.color = '#6b7280';
        }
      }
    });

    // Update running counter in the header
    if (counter) {
      counter.textContent = `Earned Badges: ${unlockedCount} / 6`;
    }

    return { unlockedCount, totalBadges: 6 };
  }

  // Alias for backward compatibility
  function evaluateAndRenderMilestones() {
    return evaluateDonorBadges(currentDonor, donationHistory);
  }

  // Expose modular function globally
  window.evaluateDonorBadges = evaluateDonorBadges;

  function extractDDMMFromDob(dobStr) {
    if (!dobStr) return null;
    let str = String(dobStr).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return null;
    if (str.includes(' ')) str = str.substring(0, str.indexOf(' '));
    if (str.includes('T')) str = str.substring(0, str.indexOf('T'));

    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
      const mm = ymdMatch[2].padStart(2, '0');
      const dd = ymdMatch[3].padStart(2, '0');
      return `${dd}${mm}`;
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      const dd = dmyMatch[1].padStart(2, '0');
      const mm = dmyMatch[2].padStart(2, '0');
      return `${dd}${mm}`;
    }
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}${mm}`;
      }
    } catch (_) { }
    return null;
  }

  function syncSmartDonorIdWithDob(existingId, dobStr, fullName, fallbackId) {
    const newDdmm = extractDDMMFromDob(dobStr);
    const cleanId = (existingId || '').trim();
    if (cleanId.startsWith('DNR-')) {
      const parts = cleanId.split('-');
      if (parts.length >= 3) {
        const suffix = parts.slice(2).join('-'); // e.g. "A719" (preserves Initial and 3 random numbers)
        if (newDdmm) {
          return `DNR-${newDdmm}-${suffix}`;
        }
        return cleanId;
      }
    }
    // If no existing valid DNR- ID, generate deterministic fallback
    const ddmm = newDdmm || '1011';
    let initial = 'A';
    if (fullName && fullName.trim().length > 0) {
      const letter = fullName.trim().match(/[A-Za-z]/);
      if (letter) initial = letter[0].toUpperCase();
    }
    const num = 100 + ((parseInt(fallbackId || 1, 10) * 137 + 241) % 900);
    return `DNR-${ddmm}-${initial}${num}`;
  }

  // ======================== 5. DIGITAL BLOOD DONOR IDENTITY CARD & QR INTAKE ========================
  function renderDigitalIdAndIntakePayload() {
    // 1. Basic Identity
    const nameEl = document.getElementById('donor-profile-name');
    const fatherEl = document.getElementById('donor-father-name');
    const idEl = document.getElementById('donor-unique-id');
    const bgEl = document.getElementById('donor-profile-blood-group');
    const initialsEl = document.getElementById('donor-avatar-initials');
    const tokenEl = document.getElementById('donor-qr-token');

    const fullName = currentDonor.name || 'N/A';
    if (nameEl) nameEl.textContent = fullName;

    const fatherName = currentDonor.fatherName || currentDonor.father_name || 'N/A';
    if (fatherEl) fatherEl.textContent = fatherName;

    // Initials
    if (initialsEl) {
      const parts = fullName.trim().split(/\s+/);
      const inits = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]) : (fullName.substring(0, 2));
      initialsEl.textContent = inits.toUpperCase();
    }

    // Blood Group
    const bloodType = currentDonor.bloodType || 'A+';
    if (bgEl) bgEl.textContent = bloodType;

    // Smart Donor ID (DNR-[DDMM]-[Initial][3 Random Numbers])
    // Strictly syncs DDMM with actual Date of Birth, while preserving Initial and Random Numbers suffix intact
    let smartDonorId = currentDonor.donorId || currentDonor.donor_id;
    smartDonorId = syncSmartDonorIdWithDob(smartDonorId, currentDonor.dob || currentDonor.dateOfBirth, fullName, currentDonor.id);
    currentDonor.donorId = smartDonorId;
    currentDonor.donor_id = smartDonorId;
    const uniqueIdStr = smartDonorId;
    if (idEl) idEl.textContent = uniqueIdStr;
    const idUnderQr = document.getElementById('donorSmartIdUnderQr');
    if (idUnderQr) idUnderQr.textContent = uniqueIdStr;

    // 2. Token Management & QR Render (Part 6: Opaque token with zero PII)
    const storageKey = 'red404_qr_token_donor_' + (currentDonor.id || '1');
    let secureToken = currentDonor.qrToken || localStorage.getItem(storageKey);
    if (!secureToken) {
      secureToken = generateSecureToken();
      localStorage.setItem(storageKey, secureToken);
    }
    currentDonor.qrToken = secureToken;
    if (tokenEl) {
      tokenEl.textContent = `TOKEN: ${secureToken}`;
    }

    // Part 6.1: QR contains ONLY the opaque signed token, NO personal info (name, phone, blood group, DOB)
    const qrPayload = `RED404:${secureToken}`;
    renderIntakeQRCode(qrPayload);

    // Add "Medically verified" line to QR card if hospital data exists
    let qrVerifiedEl = document.getElementById('qrCardVerifiedLine');
    if (!qrVerifiedEl) {
      const qrCardFooter = document.querySelector('.qr-card-footer') ||
        document.querySelector('.donor-id-card-bottom') ||
        document.getElementById('donor-qr-token')?.parentElement;
      if (qrCardFooter) {
        qrVerifiedEl = document.createElement('p');
        qrVerifiedEl.id = 'qrCardVerifiedLine';
        qrVerifiedEl.style.cssText = 'font-size:11px;color:#9b9a96;margin:4px 0 0 0;';
        qrCardFooter.appendChild(qrVerifiedEl);
      }
    }
    if (qrVerifiedEl) {
      if (currentDonor.verifiedFacility && currentDonor.verifiedDate) {
        qrVerifiedEl.textContent = `Medically verified at ${currentDonor.verifiedFacility} on ${formatDate(currentDonor.verifiedDate)}`;
        qrVerifiedEl.style.display = 'block';
      } else {
        qrVerifiedEl.style.display = 'none';
      }
    }

    // Also bind quick inspection links in the UI
    const viewScanFormLink = document.getElementById('viewScanFormLink');
    if (viewScanFormLink) viewScanFormLink.href = `/user-detail-form.html?token=${encodeURIComponent(secureToken)}`;
    const btnOpenScanPage = document.getElementById('btnOpenScanPage');
    if (btnOpenScanPage) btnOpenScanPage.href = `/user-detail-form.html?token=${encodeURIComponent(secureToken)}`;

    // 3. Action Button Bindings
    setupDigitalIdActions(storageKey, uniqueIdStr);
  }

  function generateSecureToken() {
    const chars = '0123456789ABCDEF';
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    return `RED404-SEC-${rand}`;
  }

  let activeIntakeScanUrl = '';

  function renderSingleQR(container, scanUrl, size = 180) {
    if (!container) return;
    container.innerHTML = '';

    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(container, {
          text: scanUrl,
          width: size,
          height: size,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });

        // Anti-Double QR Fix with rock-solid Mobile & Zoom Support:
        // Physically remove the non-active element from the DOM so two elements can NEVER sit side-by-side!
        let attempts = 0;
        const ensureSingleDisplay = () => {
          const canvases = container.querySelectorAll('canvas');
          const imgs = container.querySelectorAll('img');

          if (imgs.length > 0 && imgs[0].src && imgs[0].src.length > 50 && imgs[0].naturalWidth !== 0) {
            // High-res Image is ready: physically remove canvases
            canvases.forEach(c => c.remove());
            imgs[0].style.display = 'block';
            imgs[0].style.visibility = 'visible';
            imgs[0].style.width = '100%';
            imgs[0].style.height = '100%';
            imgs[0].style.maxWidth = size + 'px';
            imgs[0].style.maxHeight = size + 'px';
            imgs[0].style.margin = '0 auto';
            imgs[0].style.borderRadius = '8px';
            for (let i = 1; i < imgs.length; i++) imgs[i].remove();
          } else if (canvases.length > 0) {
            // Keep first canvas visible; remove empty/unpopulated images
            canvases[0].style.display = 'block';
            canvases[0].style.visibility = 'visible';
            canvases[0].style.width = '100%';
            canvases[0].style.height = '100%';
            canvases[0].style.maxWidth = size + 'px';
            canvases[0].style.maxHeight = size + 'px';
            canvases[0].style.margin = '0 auto';
            canvases[0].style.borderRadius = '8px';
            for (let i = 1; i < canvases.length; i++) canvases[i].remove();

            if (imgs.length > 0 && (!imgs[0].src || imgs[0].src.length <= 50)) {
              imgs[0].remove();
            }

            if (attempts++ < 15) {
              setTimeout(ensureSingleDisplay, 40);
            }
          }
        };
        setTimeout(ensureSingleDisplay, 20);
      } else {
        renderQrFallback(container, scanUrl, size);
      }
    } catch (e) {
      console.warn('QR Code generation notice:', e);
      renderQrFallback(container, scanUrl, size);
    }
  }

  function renderQrFallback(container, scanUrl, size) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:${size}px;width:${size}px;max-width:100%;box-sizing:border-box;padding:12px;text-align:center;background:#ffffff;border-radius:8px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:22px;color:#e5383b;margin-bottom:6px;"></i>
        <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px;">QR unavailable. Try again</div>
        <button type="button" class="btn-retry-qr" onclick="renderIntakeQRCode('${scanUrl}')" style="padding:4px 14px;font-size:12px;font-weight:600;background:#e5383b;color:#ffffff;border:none;border-radius:4px;cursor:pointer;">Retry</button>
      </div>
    `;
  }

  function renderIntakeQRCode(scanUrl) {
    activeIntakeScanUrl = scanUrl;
    const container = document.getElementById('donorRealQrCode') || document.getElementById('donor-qr-code');
    if (container) {
      renderSingleQR(container, scanUrl, 180);
    }
    setupQrZoomModal();
  }

  function setupQrZoomModal() {
    const zoomModal = document.getElementById('qrZoomModal');
    const btnZoomQr = document.getElementById('btnZoomQr');
    const zoomContainer = document.getElementById('zoomQrCodeContainer');
    const btnCloseZoom = document.getElementById('btnCloseQrZoom');
    if (!zoomModal) return;

    function openZoomModal() {
      if (zoomContainer && activeIntakeScanUrl) {
        renderSingleQR(zoomContainer, activeIntakeScanUrl, 250);
      }
      zoomModal.style.display = 'flex';
      zoomModal.classList.add('active');
      zoomModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeZoomModal() {
      zoomModal.style.display = 'none';
      zoomModal.classList.remove('active');
      zoomModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (btnZoomQr && !btnZoomQr.dataset.bound) {
      btnZoomQr.dataset.bound = 'true';
      btnZoomQr.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openZoomModal();
      });
      btnZoomQr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openZoomModal();
        }
      });
    }

    const qrInnerContainer = document.getElementById('donorRealQrCode');
    if (qrInnerContainer && !qrInnerContainer.dataset.bound) {
      qrInnerContainer.dataset.bound = 'true';
      qrInnerContainer.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openZoomModal();
      });
    }

    if (btnCloseZoom && !btnCloseZoom.dataset.bound) {
      btnCloseZoom.dataset.bound = 'true';
      btnCloseZoom.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeZoomModal();
      });
    }

    if (!zoomModal.dataset.bound) {
      zoomModal.dataset.bound = 'true';
      zoomModal.addEventListener('click', (e) => {
        // Close if click is on the backdrop itself (not inside the card)
        if (e.target === zoomModal) {
          closeZoomModal();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && zoomModal.classList.contains('active')) {
          closeZoomModal();
        }
      });
    }
  }

  function setupDigitalIdActions(storageKey, uniqueIdStr) {
    const btnPrint = document.getElementById('btnPrintDonorCard');
    const btnPdf = document.getElementById('btnDownloadQrPdf');
    const btnRegen = document.getElementById('btnRegenerateQr');

    if (btnPrint && !btnPrint.dataset.bound) {
      btnPrint.dataset.bound = 'true';
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }

    if (btnPdf && !btnPdf.dataset.bound) {
      btnPdf.dataset.bound = 'true';
      btnPdf.addEventListener('click', () => {
        showToast('Opening print dialog to save Digital ID Card as PDF...', 'info');
        setTimeout(() => {
          window.print();
        }, 300);
      });
    }

    if (btnRegen && !btnRegen.dataset.bound) {
      btnRegen.dataset.bound = 'true';
      btnRegen.addEventListener('click', async () => {
        const tokenEl = document.getElementById('donor-qr-token');
        btnRegen.disabled = true;
        btnRegen.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Regenerating...';

        try {
          const res = await fetch('/api/donor/qr-token/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ donorId: currentDonor.id })
          });
          const payload = await res.json();
          if (payload && payload.success && payload.data && payload.data.qrToken) {
            const newToken = payload.data.qrToken;
            localStorage.setItem(storageKey, newToken);
            currentDonor.qrToken = newToken;
            if (tokenEl) tokenEl.textContent = `TOKEN: ${newToken}`;
            const qrPayload = `RED404:${newToken}`;
            renderIntakeQRCode(qrPayload);

            const viewScanFormLink = document.getElementById('viewScanFormLink');
            if (viewScanFormLink) viewScanFormLink.href = `/user-detail-form.html?token=${encodeURIComponent(newToken)}`;
            const btnOpenScanPage = document.getElementById('btnOpenScanPage');
            if (btnOpenScanPage) btnOpenScanPage.href = `/user-detail-form.html?token=${encodeURIComponent(newToken)}`;

            showToast('Security Token Revoked & Regenerated. Old QR stops working immediately.', 'success');
          } else {
            // Fallback
            const newToken = generateSecureToken();
            localStorage.setItem(storageKey, newToken);
            currentDonor.qrToken = newToken;
            if (tokenEl) tokenEl.textContent = `TOKEN: ${newToken}`;
            renderIntakeQRCode(`RED404:${newToken}`);
            showToast('Security Token Revoked & Regenerated.', 'success');
          }
        } catch (err) {
          showToast('Failed to regenerate QR token: ' + err.message, 'error');
        } finally {
          btnRegen.disabled = false;
          btnRegen.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Regenerate QR';
        }
      });
    }
  }

  // ======================== EDIT DONOR PROFILE MODAL LOGIC ========================
  function initEditModal() {
    const editModal = document.getElementById('editDonorModal');
    if (!editModal) return;

    const btnEditDetail = document.getElementById('btnEditDetail');
    const btnEditCard = document.getElementById('btnEditDonorCard');
    const btnOpenModal = document.getElementById('btnOpenEditModal');
    const btnCloseModal = document.getElementById('btnCloseEditModal');
    const btnCancelModal = document.getElementById('btnCancelEditModal');
    const form = document.getElementById('editDonorProfileForm');

    window.openDonorEditModal = openModal;
    window.openEditModalFor = function (fieldId) {
      openModal();
      if (fieldId) {
        setTimeout(() => {
          const el = document.getElementById(fieldId);
          if (el) {
            el.focus();
            if (typeof el.select === 'function') el.select();
          }
        }, 150);
      }
    };

    function openModal() {
      // Pre-fill form fields from currentDonor state
      const nameInput = document.getElementById('editDonorFullName');
      const fatherInput = document.getElementById('editDonorFatherName');
      const bgInput = document.getElementById('editDonorBloodType');
      const genderInput = document.getElementById('editDonorGender');
      const dobInput = document.getElementById('editDonorDob');
      const weightInput = document.getElementById('editDonorWeight');
      const phoneInput = document.getElementById('editDonorPhone');
      const emailInput = document.getElementById('editDonorEmail');
      const addrInput = document.getElementById('editDonorAddress');
      const cityInput = document.getElementById('editDonorCity');
      const stateInput = document.getElementById('editDonorState');
      const pincodeInput = document.getElementById('editDonorPincode');
      const allergiesInput = document.getElementById('editDonorAllergies');
      const condInput = document.getElementById('editDonorConditions');
      const medsInput = document.getElementById('editDonorMedications');
      const surgInput = document.getElementById('editDonorSurgeries');
      const pulseInput = document.getElementById('editDonorPulse');
      const hbInput = document.getElementById('editDonorHb');
      const bpInput = document.getElementById('editDonorBp');
      const tempInput = document.getElementById('editDonorTemp');
      const lastDonInput = document.getElementById('editDonorLastDonation');
      const facilityInput = document.getElementById('editDonorFacility');

      if (nameInput) nameInput.value = currentDonor.name || '';
      if (fatherInput) {
        const fn = currentDonor.fatherName || '';
        fatherInput.value = fn.toLowerCase().includes('rajesh') ? '' : fn;
      }
      if (bgInput) {
        bgInput.value = currentDonor.bloodType || 'A+';
        const isVerified = (currentDonor.bloodGroupStatus === 'hospital_verified');
        bgInput.disabled = isVerified;
        let hintEl = document.getElementById('editDonorBgStatusHint');
        if (!hintEl) {
          hintEl = document.createElement('div');
          hintEl.id = 'editDonorBgStatusHint';
          hintEl.style.cssText = 'font-size: 11.5px; margin-top: 4px;';
          bgInput.parentNode.appendChild(hintEl);
        }
        if (isVerified) {
          const by = currentDonor.bloodGroupVerifiedByHospitalName || 'Hospital';
          hintEl.innerHTML = `
            <span style="color: #22c55e; font-weight: 500;"><i class="fa-solid fa-circle-check"></i> Verified by ${by}</span>
            <a href="javascript:void(0)" id="btnOpenBgCorrectionPrompt" style="color: #38bdf8; margin-left: 8px; text-decoration: underline;">Request correction</a>
          `;
          const reqBtn = document.getElementById('btnOpenBgCorrectionPrompt');
          if (reqBtn) {
            reqBtn.onclick = async () => {
              const reqBg = prompt('Enter your requested blood group (e.g. A+, B+, O+, AB-):', currentDonor.bloodType || 'A+');
              if (!reqBg) return;
              const reason = prompt('Please provide the clinical reason / lab cross-match details:', 'Laboratory blood cross-match confirmation');
              if (!reason) return;
              try {
                const res = await fetch('/api/donor/request-blood-group-correction', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestedGroup: reqBg.trim(), reason: reason.trim() })
                });
                const payload = await res.json();
                if (payload && payload.success) {
                  alert(payload.message || 'Correction request logged successfully. Hospital staff will review and update at your next check-in.');
                } else {
                  alert((payload && payload.message) || 'Failed to submit correction request.');
                }
              } catch (e) {
                alert('Network error while submitting correction request: ' + e.message);
              }
            };
          }
        } else {
          hintEl.innerHTML = '<span style="color: #94a3b8;"><i class="fa-solid fa-circle-info"></i> Self-declared blood group (can be edited)</span>';
        }
      }
      if (genderInput) {
        const g = (currentDonor.gender || '').trim().toLowerCase();
        if (g.startsWith('m')) genderInput.value = 'Male';
        else if (g.startsWith('f')) genderInput.value = 'Female';
        else if (g.startsWith('o')) genderInput.value = 'Other';
        else genderInput.value = currentDonor.gender || '';
      }
      if (dobInput) {
        const dob = currentDonor.dob || '';
        dobInput.value = dob === '1998-05-15' ? '' : dob;
      }
      if (weightInput) {
        const wt = currentDonor.weight;
        const hasWt = wt !== null && wt !== undefined && String(wt).trim() !== '';
        weightInput.value = hasWt ? `${wt} kg` : 'Waiting for hospital check';
        // Hint below weight
        let wtHint = document.getElementById('editWeightCheckedHint');
        if (!wtHint) {
          wtHint = document.createElement('small');
          wtHint.id = 'editWeightCheckedHint';
          wtHint.style.cssText = 'display:block;font-size:11px;color:#9b9a96;margin-top:3px;';
          weightInput.parentNode && weightInput.parentNode.appendChild(wtHint);
        }
        if (hasWt && currentDonor.verifiedFacility && currentDonor.verifiedDate) {
          wtHint.textContent = `Last checked at ${currentDonor.verifiedFacility} on ${formatDate(currentDonor.verifiedDate)}`;
          wtHint.style.display = 'block';
        } else {
          wtHint.style.display = 'none';
        }
      }
      if (phoneInput) {
        phoneInput.value = (currentDonor.phone && currentDonor.phone !== '9876543210') ? currentDonor.phone : '';
      }
      if (emailInput) emailInput.value = currentDonor.email || '';
      const line1Input = document.getElementById('editDonorLine1');
      const localityInput = document.getElementById('editDonorLocality');
      const districtInput = document.getElementById('editDonorDistrict');
      const countryInput = document.getElementById('editDonorCountry');

      if (line1Input) line1Input.value = currentDonor.line1 || currentDonor.address || '';
      if (localityInput) localityInput.value = currentDonor.locality || '';
      if (districtInput) districtInput.value = currentDonor.district || '';
      if (cityInput) {
        cityInput.value = (currentDonor.city && currentDonor.city !== 'Meerut') ? currentDonor.city : '';
      }
      if (stateInput) {
        const stVal = (currentDonor.state && (currentDonor.state !== 'Uttar Pradesh' || currentDonor.city !== 'Meerut')) ? currentDonor.state : '';
        stateInput.value = stVal;
        if (!stateInput.value && stVal) {
          const opt = Array.from(stateInput.options).find(o => o.value.toLowerCase() === stVal.toLowerCase());
          if (opt) opt.selected = true;
        }
      }
      if (pincodeInput) {
        pincodeInput.value = (currentDonor.pincode && currentDonor.pincode !== '250002') ? currentDonor.pincode : '';
      }
      if (countryInput) countryInput.value = currentDonor.country || 'India';
      if (addrInput) addrInput.value = currentDonor.line1 || currentDonor.address || '';
      if (allergiesInput) allergiesInput.value = currentDonor.allergies || '';

      let condVal = currentDonor.conditions;
      if (Array.isArray(condVal)) condVal = condVal.join(', ');
      if (condVal === 'none' || condVal === 'null') condVal = '';
      if (condInput) condInput.value = condVal || '';

      if (medsInput) medsInput.value = currentDonor.medications || '';
      if (surgInput) surgInput.value = currentDonor.surgeries || '';
      const checkedAtHint = (currentDonor.verifiedFacility && currentDonor.verifiedDate)
        ? `Checked at ${currentDonor.verifiedFacility}, ${formatDate(currentDonor.verifiedDate)}`
        : null;

      const checkedAtSuffix = checkedAtHint ? ` (${checkedAtHint})` : '';

      if (pulseInput) pulseInput.value = (currentDonor.pulse !== null && currentDonor.pulse !== undefined && String(currentDonor.pulse).trim() !== '') ? `${currentDonor.pulse} bpm${checkedAtSuffix}` : 'Waiting for hospital check';
      if (hbInput) hbInput.value = (currentDonor.hemoglobin !== null && currentDonor.hemoglobin !== undefined && String(currentDonor.hemoglobin).trim() !== '') ? `${currentDonor.hemoglobin} g/dL${checkedAtSuffix}` : 'Waiting for hospital check';
      if (bpInput) bpInput.value = (currentDonor.bloodPressure && currentDonor.bloodPressure !== '--/--') ? `${currentDonor.bloodPressure} mmHg${checkedAtSuffix}` : 'Waiting for hospital check';
      if (tempInput) tempInput.value = (currentDonor.bodyTemp !== null && currentDonor.bodyTemp !== undefined && String(currentDonor.bodyTemp).trim() !== '') ? `${currentDonor.bodyTemp} °F${checkedAtSuffix}` : 'Waiting for hospital check';

      // Attach "Checked at" placeholder/hint to all read-only vital inputs
      [pulseInput, hbInput, bpInput, tempInput].forEach(inp => {
        if (!inp) return;
        let hint = inp.parentNode && inp.parentNode.querySelector('.modal-vital-hint');
        if (!hint && inp.parentNode) {
          hint = document.createElement('small');
          hint.className = 'modal-vital-hint';
          hint.style.cssText = 'display:block;font-size:11px;color:#9b9a96;margin-top:2px;';
          inp.parentNode.appendChild(hint);
        }
        if (hint) {
          hint.textContent = checkedAtHint || '';
          hint.style.display = checkedAtHint ? 'block' : 'none';
        }
      });
      if (lastDonInput) {
        const ld = currentDonor.lastDonationDate || currentDonor.lastDonation || '';
        lastDonInput.value = (ld && ld !== '2024-01-10') ? ld : 'None recorded';
      }
      if (facilityInput) {
        facilityInput.value = currentDonor.verifiedFacility || 'None recorded';
      }

      const langInput = document.getElementById('editDonorPreferredLanguage');
      const notifSmsInput = document.getElementById('editDonorSmsNotif');
      const notifEmailInput = document.getElementById('editDonorEmailNotif');
      const notifPushInput = document.getElementById('editDonorPushNotif');
      if (langInput) langInput.value = currentDonor.preferredLanguage || currentDonor.preferred_language || 'en';
      if (notifSmsInput) notifSmsInput.checked = currentDonor.smsNotif !== false;
      if (notifEmailInput) notifEmailInput.checked = currentDonor.emailNotif !== false;
      if (notifPushInput) notifPushInput.checked = currentDonor.pushNotif !== false;

      editModal.style.display = 'flex';
      editModal.classList.add('active');
      editModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      editModal.style.display = 'none';
      editModal.classList.remove('active');
      editModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (btnEditDetail && !btnEditDetail.dataset.bound) {
      btnEditDetail.dataset.bound = 'true';
      btnEditDetail.addEventListener('click', openModal);
    }
    if (btnEditCard && !btnEditCard.dataset.bound) {
      btnEditCard.dataset.bound = 'true';
      btnEditCard.addEventListener('click', openModal);
    }
    if (btnOpenModal && !btnOpenModal.dataset.bound) {
      btnOpenModal.dataset.bound = 'true';
      btnOpenModal.addEventListener('click', openModal);
    }
    if (btnCloseModal && !btnCloseModal.dataset.bound) {
      btnCloseModal.dataset.bound = 'true';
      btnCloseModal.addEventListener('click', closeModal);
    }
    if (btnCancelModal && !btnCancelModal.dataset.bound) {
      btnCancelModal.dataset.bound = 'true';
      btnCancelModal.addEventListener('click', closeModal);
    }

    const btnSyncGps = document.getElementById('btnSyncGpsInEditForm');
    const noticeEl = document.getElementById('editLocationCoordsNotice');
    if (btnSyncGps && !btnSyncGps.dataset.bound) {
      btnSyncGps.dataset.bound = 'true';
      btnSyncGps.addEventListener('click', () => {
        if (typeof LocationPicker !== 'undefined') {
          const currentAddr = document.getElementById('editDonorAddress')?.value || currentDonor.address || '';
          LocationPicker.openModal({
            role: 'donor',
            opener: btnSyncGps,
            initialLat: currentDonor.latitude || 28.3486,
            initialLng: currentDonor.longitude || 79.5619,
            initialAddress: currentAddr,
            onConfirm: async function (data) {
              if (data.lat && data.lng) {
                currentDonor.latitude = data.lat;
                currentDonor.longitude = data.lng;
              }
              const displayArea = data.areaName || data.address || [data.city, data.state].filter(Boolean).join(', ') || 'Location saved';
              if (noticeEl) {
                noticeEl.textContent = displayArea;
                noticeEl.style.color = '#38bdf8';
              }
              const addrObj = data.components || data.addressDetails || {};
              const houseNo = addrObj.house_number || '';
              const road = addrObj.road || addrObj.street || '';
              const line1Val = [houseNo, road].filter(Boolean).join(', ') || (data.line1 || '');
              const suburb = addrObj.suburb || addrObj.neighbourhood || addrObj.subdivision || addrObj.locality || (data.locality || '');
              const districtVal = addrObj.county || addrObj.state_district || addrObj.district || (data.district || '');

              const line1Input = document.getElementById('editDonorLine1');
              const localityInput = document.getElementById('editDonorLocality');
              const districtInput = document.getElementById('editDonorDistrict');
              const cityInput = document.getElementById('editDonorCity');
              const stateInput = document.getElementById('editDonorState');
              const pinInput = document.getElementById('editDonorPincode');
              const addrInput = document.getElementById('editDonorAddress');

              if (line1Val && line1Input) line1Input.value = line1Val;
              if (suburb && localityInput) localityInput.value = suburb;
              if (districtVal && districtInput) districtInput.value = districtVal;
              if (data.city && cityInput) cityInput.value = data.city;
              if (data.state && stateInput) {
                stateInput.value = data.state;
                if (!stateInput.value) {
                  const opt = Array.from(stateInput.options).find(o => o.value.toLowerCase() === data.state.toLowerCase());
                  if (opt) opt.selected = true;
                }
              }
              if (data.pincode && pinInput) pinInput.value = data.pincode.replace(/\D/g, '').substring(0, 6);
              if (addrInput) addrInput.value = line1Val || suburb || data.address || '';

              // Update profile immediately via API
              try {
                const hdrs = (typeof getSettingsHeaders === 'function') ? getSettingsHeaders() : { 'Content-Type': 'application/json' };
                await fetch('/api/donors/location', {
                  method: 'POST',
                  headers: hdrs,
                  credentials: 'include',
                  body: JSON.stringify({
                    latitude: data.lat,
                    longitude: data.lng,
                    address: data.address || '',
                    city: data.city || '',
                    state: data.state || '',
                    pincode: data.pincode || ''
                  })
                });
              } catch (_) { }

              // Update session storage
              try {
                const raw = sessionStorage.getItem('red404_donor_session') || sessionStorage.getItem('donor_session');
                if (raw) {
                  const s = JSON.parse(raw);
                  const u = s.user || s.donor || s;
                  u.latitude = data.lat;
                  u.longitude = data.lng;
                  if (data.address) u.address = data.address;
                  if (data.city) u.city = data.city;
                  if (data.state) u.state = data.state;
                  if (data.pincode) u.pincode = data.pincode;
                  sessionStorage.setItem('red404_donor_session', JSON.stringify(s));
                  sessionStorage.setItem('donor_session', JSON.stringify(s));
                }
              } catch (_) { }

              if (typeof showToast === 'function') {
                showToast('Location saved', 'success', 2500);
              }
            }
          });
          return;
        }

        if (!navigator.geolocation) {
          if (noticeEl) noticeEl.textContent = 'Geolocation is not supported by your browser.';
          return;
        }
        btnSyncGps.disabled = true;
        btnSyncGps.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            btnSyncGps.disabled = false;
            btnSyncGps.innerHTML = '<i class="fa-solid fa-check"></i> Location Detected';
            currentDonor.latitude = pos.coords.latitude;
            currentDonor.longitude = pos.coords.longitude;
            if (noticeEl) {
              noticeEl.textContent = `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (±${Math.round(pos.coords.accuracy)}m)`;
            }
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
              if (res.ok) {
                const geo = await res.json();
                const addr = geo.address || {};
                const line1Input = document.getElementById('editDonorLine1');
                const localityInput = document.getElementById('editDonorLocality');
                const districtInput = document.getElementById('editDonorDistrict');
                const cityInput = document.getElementById('editDonorCity');
                const stateInput = document.getElementById('editDonorState');
                const pinInput = document.getElementById('editDonorPincode');
                const addrInput = document.getElementById('editDonorAddress');
                const houseNo = addr.house_number || '';
                const road = addr.road || addr.street || '';
                const line1Val = [houseNo, road].filter(Boolean).join(', ');
                const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.subdivision || addr.locality || '';
                const cityVal = addr.city || addr.town || addr.village || addr.municipality || '';
                const districtVal = addr.county || addr.state_district || addr.district || '';
                const stateVal = addr.state || '';
                const postVal = (addr.postcode || '').replace(/\D/g, '').substring(0, 6);

                if (line1Val && line1Input && !line1Input.value) line1Input.value = line1Val;
                if (area && localityInput && !localityInput.value) localityInput.value = area;
                if (cityVal && cityInput && !cityInput.value) cityInput.value = cityVal;
                if (districtVal && districtInput && !districtInput.value) districtInput.value = districtVal;
                if (postVal && pinInput && !pinInput.value) pinInput.value = postVal;
                if (stateVal && stateInput && !stateInput.value) {
                  const opt = Array.from(stateInput.options).find(o => o.value.toLowerCase() === stateVal.toLowerCase());
                  if (opt) opt.selected = true;
                }
                if (addrInput) addrInput.value = line1Val || area || '';
              }
            } catch (_) { }
          },
          (err) => {
            btnSyncGps.disabled = false;
            btnSyncGps.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Change on Map';
            if (noticeEl) noticeEl.textContent = 'Permission denied or location unavailable.';
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }

    // Form submit handler
    if (form && !form.dataset.bound) {
      form.dataset.bound = 'true';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btnSaveDonorProfile');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving changes...</span>';
        }

        try {
          // Generate a NEW secure QR token upon every profile edit save.
          // This ensures that the newly displayed QR code points to this fresh state,
          // while any previously opened scan tabs remain frozen to their scan-time snapshot.
          const newToken = generateSecureToken();
          currentDonor.qrToken = newToken;
          localStorage.setItem('red404_qr_token_donor_' + (currentDonor.id || 1), newToken);

          const genderChosen = (document.getElementById('editDonorGender')?.value || '').trim();
          if (!genderChosen) {
            alert('Please select your gender (Male, Female, or Other).');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>Save changes</span>'; }
            return;
          }

          const line1Chosen = (document.getElementById('editDonorLine1')?.value || '').trim();
          const localityChosen = (document.getElementById('editDonorLocality')?.value || '').trim();
          const districtChosen = (document.getElementById('editDonorDistrict')?.value || '').trim();
          const cityChosen = (document.getElementById('editDonorCity')?.value || '').trim();
          const stateChosen = (document.getElementById('editDonorState')?.value || '').trim();
          const pinChosen = (document.getElementById('editDonorPincode')?.value || '').trim().replace(/\D/g, '');

          if (!cityChosen) {
            alert('City is required.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>Save changes</span>'; }
            return;
          }
          if (!stateChosen) {
            alert('Please select your State.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>Save changes</span>'; }
            return;
          }
          if (!pinChosen || pinChosen.length !== 6) {
            alert('Please enter a valid 6-digit PIN code.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>Save changes</span>'; }
            return;
          }

          // Clinical vitals, verified facility and last donation are read-only and omitted from user profile updates (Part 1, Requirement 1 & 5)
          const payload = {
            id: currentDonor.id || 1,
            donorId: currentDonor.id || 1,
            name: (document.getElementById('editDonorFullName')?.value || '').trim() || currentDonor.name,
            fatherName: (document.getElementById('editDonorFatherName')?.value || '').trim(),
            bloodType: (document.getElementById('editDonorBloodType')?.value || '').trim() || currentDonor.bloodType,
            gender: genderChosen,
            dob: (document.getElementById('editDonorDob')?.value || '').trim(),
            phone: (document.getElementById('editDonorPhone')?.value || '').trim(),
            email: (document.getElementById('editDonorEmail')?.value || '').trim() || currentDonor.email,
            line1: line1Chosen || null,
            locality: localityChosen || null,
            district: districtChosen || null,
            city: cityChosen,
            state: stateChosen,
            pincode: pinChosen,
            country: 'India',
            address: line1Chosen || localityChosen || null,
            allergies: (document.getElementById('editDonorAllergies')?.value || '').trim(),
            conditions: (document.getElementById('editDonorConditions')?.value || '').trim(),
            medications: (document.getElementById('editDonorMedications')?.value || '').trim(),
            surgeries: (document.getElementById('editDonorSurgeries')?.value || '').trim(),
            preferredLanguage: document.getElementById('editDonorPreferredLanguage')?.value || 'en',
            smsNotif: document.getElementById('editDonorSmsNotif')?.checked ?? true,
            emailNotif: document.getElementById('editDonorEmailNotif')?.checked ?? true,
            pushNotif: document.getElementById('editDonorPushNotif')?.checked ?? true,
            publicSearchOptIn: currentDonor.publicSearchOptIn ?? currentDonor.public_search_opt_in ?? true,
            publicDisplayName: currentDonor.publicDisplayName || currentDonor.public_display_name || null,
            latitude: currentDonor.latitude,
            longitude: currentDonor.longitude,
            qrToken: newToken
          };

          // 1. Call Backend API
          let res = await fetch('/api/donors/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            res = await fetch('/api/donor/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });
          }

          // 2. Update local state
          if (res.ok) {
            try {
              const resJson = await res.json();
              if (resJson && resJson.data) {
                Object.assign(currentDonor, resJson.data);
                if (resJson.data.donorId || resJson.data.donor_id) {
                  currentDonor.donorId = resJson.data.donorId || resJson.data.donor_id;
                  currentDonor.donor_id = currentDonor.donorId;
                }
              } else {
                Object.assign(currentDonor, payload);
              }
            } catch (_) {
              Object.assign(currentDonor, payload);
            }
          } else {
            Object.assign(currentDonor, payload);
          }

          if (currentDonor.dob) {
            currentDonor.age = calculateAge(currentDonor.dob);
          } else {
            currentDonor.age = null;
          }

          // Keep the donor ID exactly as returned by backend — do NOT re-compute it locally.
          // Backend already handles donor_id sync when DOB changes (DonorDao.updateProfile).
          // Local re-computation was causing the ID to change on every save.
          if (!currentDonor.donorId || !String(currentDonor.donorId).startsWith('DNR-')) {
            // Only fall back to local generation if backend returned no valid DNR- ID
            currentDonor.donorId = syncSmartDonorIdWithDob(currentDonor.donorId, currentDonor.dob, currentDonor.name, currentDonor.id);
          }
          currentDonor.donor_id = currentDonor.donorId;

          // 3. Update localStorage session & cache
          try {
            const sessObj = { user: { ...currentDonor } };
            localStorage.setItem('red404_donor_session', JSON.stringify(sessObj));
            localStorage.setItem('red404_auth_session', JSON.stringify(sessObj));
            if (typeof Auth !== 'undefined' && Auth.saveSession) {
              Auth.saveSession(currentDonor);
            }
            if (payload.preferredLanguage && window.RED404_I18N) {
              window.RED404_I18N.setLanguage(payload.preferredLanguage);
            }
          } catch (_) { }

          // 4. Update registered donors cache if present
          try {
            const cleanEmail = (currentDonor.email || '').trim().toLowerCase();
            const donorsList = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
            const idx = donorsList.findIndex(d => (d.email && d.email.trim().toLowerCase() === cleanEmail) || (currentDonor.phone && d.phone && d.phone.trim() === currentDonor.phone.trim()));
            if (idx >= 0) {
              Object.assign(donorsList[idx], currentDonor);
              localStorage.setItem('red404_registered_donors', JSON.stringify(donorsList));
            }
          } catch (_) { }

          // 5. Close modal & safely re-render profile card, QR and vitals
          try {
            closeModal();
          } catch (_) { }

          try {
            evaluateHealthAndEligibility();
          } catch (evalErr) {
            console.warn('Health evaluation error ignored:', evalErr);
          }

          try {
            renderDigitalIdAndIntakePayload();
          } catch (renderErr) {
            console.warn('Digital ID render error ignored:', renderErr);
          }

          try {
            if (donorGreetingName) donorGreetingName.textContent = currentDonor.name;
            const dropdownUserEmailSpan = document.getElementById('dropdown-user-email');
            if (dropdownUserEmailSpan && currentDonor.email) {
              dropdownUserEmailSpan.textContent = currentDonor.email;
            }
            if (window.updateCommandNav) {
              window.updateCommandNav(currentDonor);
            }
          } catch (_) { }

          showToast('Profile updated successfully!', 'success');
        } catch (err) {
          console.error('Save error:', err);
          showToast('Failed to save donor profile. Please try again.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save changes</span>';
          }
        }
      });
    }
  }

  function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';
    let clean = String(phone).replace(/[^0-9+]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.length === 10) clean = '+91 ' + clean.substring(0, 5) + ' ' + clean.substring(5);
      else clean = '+91 ' + clean;
    }
    return clean;
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Alias for backward compatibility if any legacy caller references renderDonationHistory
  function renderDonationHistory() {
    renderDigitalIdAndIntakePayload();
  }

  // ======================== 6. GPS LOCATION API ========================
  function initGPSListener() {
    if (!gpsSyncBtn) return;
    gpsSyncBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.', 'info');
        return;
      }
      showToast('Refreshing live GPS coordinates...', 'info');
      const icon = gpsSyncBtn.querySelector('.gps-icon-spin');
      if (icon) icon.classList.add('fa-spin');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (icon) icon.classList.remove('fa-spin');
          currentDonor.latitude = pos.coords.latitude;
          currentDonor.longitude = pos.coords.longitude;
          updateGPSDisplay(currentDonor.latitude, currentDonor.longitude, Math.round(pos.coords.accuracy || 8));
          showToast('Live GPS coordinates updated successfully.', 'success');
        },
        (err) => {
          if (icon) icon.classList.remove('fa-spin');
          console.warn('Geolocation notice:', err.message);
          showToast('GPS access denied or unavailable.', 'info');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  function updateGPSDisplay(lat, lng, accuracy = 8) {
    if (!gpsCoordsText) return;
    const latStr = Math.abs(lat).toFixed(4) + (lat >= 0 ? '° N' : '° S');
    const lngStr = Math.abs(lng).toFixed(4) + (lng >= 0 ? '° E' : '° W');
    gpsCoordsText.textContent = `CONNECTED (${latStr}, ${lngStr})`;
  }

  // ======================== 7. UTILS ========================
  function calculateAge(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  function formatDate(dateInput) {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  function initMobileNav() {
    if (!mobileMenuBtn || !hubSidebar || !sidebarOverlay) return;

    mobileMenuBtn.addEventListener('click', () => {
      hubSidebar.classList.toggle('mobile-open');
      sidebarOverlay.style.display = hubSidebar.classList.contains('mobile-open') ? 'block' : 'none';
    });

    sidebarOverlay.addEventListener('click', () => {
      hubSidebar.classList.remove('mobile-open');
      sidebarOverlay.style.display = 'none';
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg, type = 'info') {
    if (typeof showAppAlert === 'function') {
      showAppAlert({
        title: type === 'success' ? 'Health Sync' : 'Notice',
        message: msg,
        type: type
      });
      return;
    }
    const toast = document.createElement('div');
    toast.className = `donor-hub-toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> <span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }, 50);
  }

})();



// Global logout modal is handled centrally by command-nav.js
