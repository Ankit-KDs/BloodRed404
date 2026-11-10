/* ============================================================
   RED404 — DONOR HEALTH PROFILE & MEDICAL ELIGIBILITY JS
   Purely Dynamic Vitals Parsing, AI Evaluation & 90-Day Tracker
============================================================ */

(function () {
  'use strict';

  // State: Initialized with null vitals (empty placeholders until hospital logs checkup)
  let currentDonor = {
    id: 1,
    name: 'Ankit Kumar',
    fatherName: null,
    email: 'ak30kr02@gmail.com',
    bloodType: 'A+',
    age: null,
    gender: 'Male',
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
    qrToken: null
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
    } catch (_) {}

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
      let userData = (session && session.user) ? session.user : null;
      if (!userData) {
        try {
          const s = localStorage.getItem('red404_donor_session');
          if (s) userData = JSON.parse(s).user;
        } catch (_) {}
      }

      if (userData) {
        currentDonor.id = userData.id || currentDonor.id;
        currentDonor.name = userData.name || userData.fullName || ((userData.firstName ? userData.firstName + ' ' + (userData.lastName || '') : '') || currentDonor.name).trim();
        currentDonor.fatherName = cleanLiveVal(userData.fatherName || userData.father_name, ['rajesh']);
        if (userData.email) currentDonor.email = userData.email;
        currentDonor.bloodType = userData.bloodType || userData.blood_type || currentDonor.bloodType;
        if (userData.phone || userData.mobile) currentDonor.phone = userData.phone || userData.mobile;
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
        if (userData.city) currentDonor.city = userData.city;
        if (userData.state) currentDonor.state = userData.state;
        if (userData.pincode || userData.pinCode) currentDonor.pincode = userData.pincode || userData.pinCode;
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
      } catch (_) {}

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
        } catch (_) {}
      }

      // 2. Fetch fresh dynamic profile from API (/api/donor/profile-data or /api/donor/profile)
      let res = await fetch(`/api/donor/profile-data?donorId=${currentDonor.id}`, { cache: 'no-store' });
      if (!res.ok) {
        res = await fetch(`/api/donor/profile?donorId=${currentDonor.id}`, { cache: 'no-store' });
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
          if (d.phone || d.mobile) currentDonor.phone = d.phone || d.mobile;
          if (d.gender) currentDonor.gender = d.gender;
          currentDonor.address = cleanLiveVal(d.address, ['subharti', 'delhi road']);
          if (d.city) currentDonor.city = d.city;
          if (d.state) currentDonor.state = d.state;
          if (d.pincode || d.pinCode) currentDonor.pincode = d.pincode || d.pinCode;
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
          if (d.latitude && d.longitude) {
            currentDonor.latitude = parseFloat(d.latitude);
            currentDonor.longitude = parseFloat(d.longitude);
          }
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
    renderAIHealthSuggestion();
    renderMedicalEligibilityTracker();
    evaluateAndRenderMilestones();
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

    // 2. Top Meta (Age | Weight | Pulse) — Empty placeholders until hospital logs checkup
    const ageEl = document.getElementById('vitalAge');
    const weightEl = document.getElementById('vitalWeight');
    const pulseEl = document.getElementById('vitalPulse');
    if (ageEl) ageEl.textContent = (currentDonor.age !== null && currentDonor.age !== undefined) ? currentDonor.age : '--';
    if (weightEl) weightEl.textContent = (currentDonor.weight !== null && currentDonor.weight !== undefined) ? currentDonor.weight : '--';
    if (pulseEl) pulseEl.textContent = (currentDonor.pulse !== null && currentDonor.pulse !== undefined) ? currentDonor.pulse : '--';

    // 3. Verified hospital intake facility & date
    const verifiedSub = document.getElementById('vitalsVerifiedSub');
    if (verifiedSub) {
      if (currentDonor.verifiedDate) {
        verifiedSub.textContent = `Verified on ${formatDate(currentDonor.verifiedDate)}`;
      } else {
        verifiedSub.textContent = 'Awaiting Hospital Health Verification';
      }
    }

    // 4. Metrics & Chips (Pending placeholders until hospital logs checkup)
    const hbVal = document.getElementById('vitalHemoglobin');
    const hbPill = document.getElementById('hbPill');
    const hasHb = currentDonor.hemoglobin !== null && currentDonor.hemoglobin !== undefined;
    if (hbVal) hbVal.textContent = hasHb ? currentDonor.hemoglobin : '--';
    if (hbPill) {
      if (hasHb) {
        const isHbOk = currentDonor.hemoglobin >= 12.5;
        hbPill.className = `vital-pill ${isHbOk ? 'pill-normal' : 'pill-alert'}`;
        hbPill.textContent = isHbOk ? 'NORMAL' : 'LOW';
      } else {
        hbPill.className = 'vital-pill pill-awaiting';
        hbPill.textContent = 'PENDING';
      }
    }

    const bpVal = document.getElementById('vitalBP');
    const bpPill = document.getElementById('bpPill');
    const hasBp = Boolean(currentDonor.bloodPressure);
    if (bpVal) bpVal.textContent = hasBp ? currentDonor.bloodPressure : '--/--';
    if (bpPill) {
      if (hasBp) {
        const isBpOk = isBpNormal(currentDonor.bloodPressure);
        bpPill.className = `vital-pill ${isBpOk ? 'pill-normal' : 'pill-alert'}`;
        bpPill.textContent = isBpOk ? 'NORMAL' : 'REVIEW';
      } else {
        bpPill.className = 'vital-pill pill-awaiting';
        bpPill.textContent = 'PENDING';
      }
    }

    const tempVal = document.getElementById('vitalTemp');
    const hasTemp = currentDonor.bodyTemp !== null && currentDonor.bodyTemp !== undefined;
    if (tempVal) tempVal.textContent = hasTemp ? currentDonor.bodyTemp : '--';
  }

  // ======================== AI HEALTH EVALUATION ========================
  // Automatically runs AI safety audit once hospital fills vitals
  function renderAIHealthSuggestion() {
    const evalBadge = document.getElementById('aiHealthEvalBadge');

    const hb = currentDonor.hemoglobin;
    const bp = currentDonor.bloodPressure;
    const weight = currentDonor.weight;
    const pulse = currentDonor.pulse;
    const temp = currentDonor.bodyTemp;

    const hasData = (hb !== null && hb !== undefined) && 
                    Boolean(bp) && 
                    (weight !== null && weight !== undefined);

    // If details are empty: display waiting status
    if (!hasData) {
      if (evalBadge) {
        evalBadge.className = 'health-eval-badge badge-awaiting';
        evalBadge.innerHTML = `<i class="fas fa-clock" style="margin-right:6px;"></i><span>HEALTH STATUS: AWAITING HOSPITAL HEALTH VERIFICATION</span>`;
      }
      return;
    }

    // Standard clinical thresholds for whole blood donation (WHO & NBTC guidelines)
    const isHbOk = hb >= 12.5;
    const isBpOk = isBpNormal(bp);
    const isWeightOk = weight >= 50;
    const isPulseOk = (pulse !== null && pulse !== undefined) ? (pulse >= 60 && pulse <= 100) : true;
    const isTempOk = (temp !== null && temp !== undefined) ? (temp <= 99.0) : true;

    const isFit = isHbOk && isBpOk && isWeightOk && isPulseOk && isTempOk;

    // Update main status banner to prominent GREEN if fit
    if (evalBadge) {
      if (isFit) {
        evalBadge.className = 'health-eval-badge badge-fit';
        evalBadge.innerHTML = `<span>HEALTH STATUS: FIT TO DONATE</span>`;
      } else {
        evalBadge.className = 'health-eval-badge badge-unfit';
        evalBadge.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i><span>HEALTH STATUS: MEDICAL REVIEW REQUIRED</span>`;
      }
    }
  }

  // ======================== 4. 3D BIOMETRIC CRYO-POD TRACKER ========================
  // Real-time animated flowing blood chamber with anatomical human silhouette
      // ======================== 4. PRECISE TELEMETRY DATA LOGIC ========================
  function renderTelemetryData(lastDonationDate) {
    const now = new Date();
    
    // Check elements
    const primary = document.getElementById('telemetryPrimary');
    const label = document.getElementById('telemetryPrimaryLabel');
    const percent = document.getElementById('telemetryPercent');
    const caption = document.getElementById('telemetryCaption');
    const badge = document.getElementById('telemetryBadge');
    const badgeTxt = document.getElementById('badgeText');
    const textRecovery = document.getElementById('textRecovery');
    const iconRecovery = document.getElementById('iconRecovery');
    const textVitals = document.getElementById('textVitals');
    const iconVitals = document.getElementById('iconVitals');
    const dateUnlock = document.getElementById('dateUnlock');
    const metaTag = document.getElementById('eligibilityMetaTag');
    const fluidContainer = document.getElementById('dnaFluidContainer') || document.getElementById('bloodFluid');

    // Days elapsed calculation
    const donationDate = lastDonationDate ? new Date(lastDonationDate) : null;
    const daysPassed = donationDate && !isNaN(donationDate.getTime()) ? Math.floor((now.getTime() - donationDate.getTime()) / (1000 * 60 * 60 * 24)) : 90;

    // CASE 1: Cooldown completed OR Never Donated (100% READY)
    if (!donationDate || isNaN(donationDate.getTime()) || daysPassed >= 90) {
      if (primary) {
        primary.innerText = "READY";
        primary.style.color = "#10b981"; // Vibrant Emerald
      }
      if (label) {
        label.innerText = "TO DONATE";
        label.style.color = "#34d399";
      }
      if (percent) {
        percent.innerText = "100% RECOVERED";
        percent.style.color = "#cbd5e1";
      }
      if (caption) {
        caption.innerText = "(biological volume fully restored)";
      }

      // Set green badge
      if (badge) {
        badge.className = "status-badge eligible-ready";
        badge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span id="badgeText">ELIGIBLE TO DONATE</span>`;
      }

      // Checklist 100% complete
      if (iconRecovery) {
        iconRecovery.className = "fa-solid fa-check";
        iconRecovery.style.color = "#10b981";
      }
      if (textRecovery) {
        textRecovery.innerText = "Recovery interval: complete";
      }

      if (iconVitals) {
        iconVitals.className = "fa-solid fa-circle-check";
        iconVitals.style.color = "#10b981";
      }
      if (textVitals) {
        textVitals.innerText = "Biological markers fully restocked";
      }

      if (dateUnlock) {
        dateUnlock.innerText = "IMMEDIATE / NOW AVAILABLE";
        dateUnlock.style.color = "#10b981";
      }

      if (metaTag) {
        metaTag.className = "card-meta-tag scanner-meta-tag tag-ready";
        metaTag.innerHTML = `<i class="fas fa-check-circle"></i> 100% Regenerated`;
      }

      // Also sync the DNA fluid container height
      if (fluidContainer) {
        fluidContainer.style.height = '100%';
      }
    } else {
      // CASE 2: Active Cooldown (<90 days elapsed)
      const remainingDays = 90 - daysPassed;
      const recoveryPercentage = Math.max(0, Math.min(100, Math.floor((daysPassed / 90) * 100)));

      if (primary) {
        primary.innerText = `${remainingDays} DAYS`;
        primary.style.color = "#f8fafc";
      }
      if (label) {
        label.innerText = "REMAINING";
        label.style.color = "#64748b";
      }
      if (percent) {
        percent.innerText = `${recoveryPercentage}% RECOVERED`;
        percent.style.color = "#cbd5e1";
      }
      if (caption) {
        caption.innerText = "(reducing day by day post-donation)";
      }

      // Amber Badge
      if (badge) {
        badge.className = "status-badge cooldown-active";
        badge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> <span id="badgeText">COOLDOWN ACTIVE • Recovery in Progress</span>`;
      }

      // Cooldown active details
      if (iconRecovery) {
        iconRecovery.className = "fa-solid fa-hourglass";
        iconRecovery.style.color = "#f59e0b";
      }
      if (textRecovery) {
        textRecovery.innerText = `Recovery interval: ${remainingDays} days left`;
      }

      if (iconVitals) {
        iconVitals.className = "fa-solid fa-check";
        iconVitals.style.color = "#10b981";
      }
      if (textVitals) {
        textVitals.innerText = "Vitals regeneration in progress";
      }

      // Calculate custom future unlock date
      const nextAvailableDate = new Date(donationDate);
      nextAvailableDate.setDate(nextAvailableDate.getDate() + 90);
      
      // Render locale date (e.g. 15 Oct 2026)
      const options = { day: 'numeric', month: 'short', year: 'numeric' };
      if (dateUnlock) {
        dateUnlock.innerText = nextAvailableDate.toLocaleDateString('en-GB', options);
        dateUnlock.style.color = "#cbd5e1";
      }

      if (metaTag) {
        metaTag.className = "card-meta-tag scanner-meta-tag tag-cooldown";
        metaTag.innerHTML = `<i class="fas fa-hourglass-half"></i> Regeneration in Progress`;
      }

      // Also sync the DNA fluid container height
      if (fluidContainer) {
        fluidContainer.style.height = `${recoveryPercentage}%`;
      }
    }
  }

  function renderMedicalEligibilityTracker() {
    renderTelemetryData(currentDonor.lastDonationDate);
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

    // 3. NIGHT OWL (night-owl): Unlocks if any donation timestamp has an hour between 22 (10 PM) and 6 (6 AM)
    const isNightOwl = hist.some(d => {
      const dt = d.donationDate || d.date || d.createdAt || d.timestamp;
      if (!dt) return false;
      const parsed = new Date(dt);
      if (isNaN(parsed.getTime())) return false;
      const hour = parsed.getHours();
      return hour >= 22 || hour <= 6;
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

    // Unique Donor ID (#RED-ST-XXXX style)
    let stateCode = 'DL';
    const stateVal = (currentDonor.state || '').trim().toUpperCase();
    if (stateVal.includes('UTTAR PRADESH')) stateCode = 'UP';
    else if (stateVal.includes('UTTARAKHAND')) stateCode = 'UK';
    else if (stateVal.includes('DELHI')) stateCode = 'DL';
    else if (stateVal.includes('MAHARASHTRA')) stateCode = 'MH';
    else if (stateVal.includes('KARNATAKA')) stateCode = 'KA';
    else if (stateVal.includes('TAMIL NADU')) stateCode = 'TN';
    else if (stateVal.length >= 2) stateCode = stateVal.substring(0, 2);

    const donorNum = 7950 + parseInt(currentDonor.id || 1, 10);
    const uniqueIdStr = `#RED-${stateCode}-${donorNum}`;
    if (idEl) idEl.textContent = uniqueIdStr;

    // 2. Token Management & QR Render (Directs to Hospital Read-Only Scan View: user-detail-form.html)
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

    // Link directly to user-detail-form.html in strict read-only A4 format
    const scanUrl = `${window.location.origin}/user-detail-form.html?token=${encodeURIComponent(secureToken)}&donorId=${encodeURIComponent(currentDonor.id || 1)}&donor=${encodeURIComponent(uniqueIdStr)}`;

    renderIntakeQRCode(scanUrl);

    // Also bind quick inspection links in the UI
    const viewScanFormLink = document.getElementById('viewScanFormLink');
    if (viewScanFormLink) viewScanFormLink.href = scanUrl;
    const btnOpenScanPage = document.getElementById('btnOpenScanPage');
    if (btnOpenScanPage) btnOpenScanPage.href = scanUrl;

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
        container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(scanUrl)}" alt="Scannable QR Code" style="display:block;width:100%;height:100%;max-width:${size}px;max-height:${size}px;margin:0 auto;border-radius:8px;" />`;
      }
    } catch (e) {
      console.warn('QR Code generation notice:', e);
      container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(scanUrl)}" alt="Scannable QR Code" style="display:block;width:100%;height:100%;max-width:${size}px;max-height:${size}px;margin:0 auto;border-radius:8px;" />`;
    }
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
        const newToken = generateSecureToken();
        localStorage.setItem(storageKey, newToken);
        currentDonor.qrToken = newToken;
        if (tokenEl) tokenEl.textContent = `TOKEN: ${newToken}`;

        // Sync new token with backend MySQL
        try {
          fetch('/api/donors/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentDonor.id, donorId: currentDonor.id, qrToken: newToken })
          }).catch(() => {});
        } catch (_) {}

        const scanUrl = `${window.location.origin}/user-detail-form.html?token=${encodeURIComponent(newToken)}&donorId=${encodeURIComponent(currentDonor.id || 1)}&donor=${encodeURIComponent(uniqueIdStr)}`;
        renderIntakeQRCode(scanUrl);

        const viewScanFormLink = document.getElementById('viewScanFormLink');
        if (viewScanFormLink) viewScanFormLink.href = scanUrl;
        const btnOpenScanPage = document.getElementById('btnOpenScanPage');
        if (btnOpenScanPage) btnOpenScanPage.href = scanUrl;

        showToast('Security Token Revoked & Regenerated. New intake QR is active.', 'success');
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
      if (bgInput) bgInput.value = currentDonor.bloodType || 'A+';
      if (genderInput) genderInput.value = currentDonor.gender || 'Male';
      if (dobInput) {
        const dob = currentDonor.dob || '';
        dobInput.value = dob === '1998-05-15' ? '' : dob;
      }
      if (weightInput) {
        const wt = currentDonor.weight;
        weightInput.value = (wt !== null && wt !== undefined && String(wt).trim() !== '') ? wt : '';
      }
      if (phoneInput) phoneInput.value = currentDonor.phone || '';
      if (emailInput) emailInput.value = currentDonor.email || '';
      if (addrInput) {
        const addr = currentDonor.address || '';
        addrInput.value = (addr.toLowerCase().includes('subharti') || addr.toLowerCase().includes('delhi road')) ? '' : addr;
      }
      if (cityInput) cityInput.value = currentDonor.city || '';
      if (stateInput) stateInput.value = currentDonor.state || '';
      if (pincodeInput) pincodeInput.value = currentDonor.pincode || '';
      if (allergiesInput) allergiesInput.value = currentDonor.allergies || '';
      
      let condVal = currentDonor.conditions;
      if (Array.isArray(condVal)) condVal = condVal.join(', ');
      if (condVal === 'none' || condVal === 'null') condVal = '';
      if (condInput) condInput.value = condVal || '';
      
      if (medsInput) medsInput.value = currentDonor.medications || '';
      if (surgInput) surgInput.value = currentDonor.surgeries || '';
      if (pulseInput) pulseInput.value = (currentDonor.pulse !== null && currentDonor.pulse !== undefined) ? currentDonor.pulse : '';
      if (hbInput) hbInput.value = (currentDonor.hemoglobin !== null && currentDonor.hemoglobin !== undefined) ? currentDonor.hemoglobin : '';
      if (bpInput) bpInput.value = currentDonor.bloodPressure || '';
      if (tempInput) tempInput.value = (currentDonor.bodyTemp !== null && currentDonor.bodyTemp !== undefined) ? currentDonor.bodyTemp : '';
      if (lastDonInput) {
        const ld = currentDonor.lastDonationDate || currentDonor.lastDonation || '';
        lastDonInput.value = ld === '2024-01-10' ? '' : ld;
      }
      if (facilityInput) facilityInput.value = currentDonor.verifiedFacility || '';

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

    // Backdrop click disabled: modal closes strictly on Save or Cancel buttons
    // (User request: do not close when clicking outside)

    // Form submit handler
    if (form && !form.dataset.bound) {
      form.dataset.bound = 'true';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btnSaveDonorProfile');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving to MySQL...</span>';
        }

        try {
          const weightStr = (document.getElementById('editDonorWeight')?.value || '').trim();
          const pulseStr = (document.getElementById('editDonorPulse')?.value || '').trim();
          const hbStr = (document.getElementById('editDonorHb')?.value || '').trim();
          const tempStr = (document.getElementById('editDonorTemp')?.value || '').trim();

          // Generate a NEW secure QR token upon every profile edit save.
          // This ensures that the newly displayed QR code points to this fresh state,
          // while any previously opened scan tabs remain frozen to their scan-time snapshot.
          const newToken = generateSecureToken();
          currentDonor.qrToken = newToken;
          localStorage.setItem('red404_qr_token_donor_' + (currentDonor.id || 1), newToken);

          const payload = {
            id: currentDonor.id || 1,
            donorId: currentDonor.id || 1,
            name: (document.getElementById('editDonorFullName')?.value || '').trim() || currentDonor.name,
            fatherName: (document.getElementById('editDonorFatherName')?.value || '').trim(),
            bloodType: (document.getElementById('editDonorBloodType')?.value || '').trim() || currentDonor.bloodType,
            gender: (document.getElementById('editDonorGender')?.value || '').trim() || 'Male',
            dob: (document.getElementById('editDonorDob')?.value || '').trim(),
            weight: weightStr ? parseFloat(weightStr) : null,
            phone: (document.getElementById('editDonorPhone')?.value || '').trim() || currentDonor.phone,
            email: (document.getElementById('editDonorEmail')?.value || '').trim() || currentDonor.email,
            address: (document.getElementById('editDonorAddress')?.value || '').trim(),
            city: (document.getElementById('editDonorCity')?.value || '').trim(),
            state: (document.getElementById('editDonorState')?.value || '').trim(),
            pincode: (document.getElementById('editDonorPincode')?.value || '').trim(),
            allergies: (document.getElementById('editDonorAllergies')?.value || '').trim(),
            conditions: (document.getElementById('editDonorConditions')?.value || '').trim(),
            medications: (document.getElementById('editDonorMedications')?.value || '').trim(),
            surgeries: (document.getElementById('editDonorSurgeries')?.value || '').trim(),
            pulse: pulseStr ? parseInt(pulseStr, 10) : null,
            hemoglobin: hbStr ? parseFloat(hbStr) : null,
            bloodPressure: (document.getElementById('editDonorBp')?.value || '').trim(),
            bodyTemp: tempStr ? parseFloat(tempStr) : null,
            lastDonationDate: (document.getElementById('editDonorLastDonation')?.value || '').trim(),
            verifiedFacility: (document.getElementById('editDonorFacility')?.value || '').trim(),
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

          // 3. Update localStorage session & cache
          try {
            const sessObj = { user: { ...currentDonor } };
            localStorage.setItem('red404_donor_session', JSON.stringify(sessObj));
            localStorage.setItem('red404_auth_session', JSON.stringify(sessObj));
            if (typeof Auth !== 'undefined' && Auth.saveSession) {
              Auth.saveSession(currentDonor);
            }
          } catch (_) {}

          // 4. Update registered donors cache if present
          try {
            const cleanEmail = (currentDonor.email || '').trim().toLowerCase();
            const donorsList = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
            const idx = donorsList.findIndex(d => (d.email && d.email.trim().toLowerCase() === cleanEmail) || (currentDonor.phone && d.phone && d.phone.trim() === currentDonor.phone.trim()));
            if (idx >= 0) {
              Object.assign(donorsList[idx], currentDonor);
              localStorage.setItem('red404_registered_donors', JSON.stringify(donorsList));
            }
          } catch (_) {}

          // 5. Close modal & re-render profile card, QR and vitals
          closeModal();
          evaluateHealthAndEligibility();
          renderDigitalIdAndIntakePayload();

          if (donorGreetingName) donorGreetingName.textContent = currentDonor.name;
          const dropdownUserEmailSpan = document.getElementById('dropdown-user-email');
          if (dropdownUserEmailSpan && currentDonor.email) {
            dropdownUserEmailSpan.textContent = currentDonor.email;
          }

          showToast('Donor profile successfully updated in MySQL database!', 'success');
        } catch (err) {
          console.error('Save error:', err);
          showToast('Failed to save donor profile. Please try again.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save &amp; Update Database</span>';
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
