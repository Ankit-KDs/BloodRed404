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
    email: 'ankit@red404.in',
    bloodType: 'A+',
    age: null,
    gender: 'Male',
    phone: null,
    dob: null,
    address: null,
    city: null,
    state: null,
    pincode: null,
    donorType: 'Voluntary Lifesaver',
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
    surgeries: null
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
    initMobileNav();
    initGPSListener();
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
        if (userData.email) currentDonor.email = userData.email;
        currentDonor.bloodType = userData.bloodType || userData.blood_type || currentDonor.bloodType;
        if (userData.phone || userData.mobile) currentDonor.phone = userData.phone || userData.mobile;
        if (userData.gender) currentDonor.gender = userData.gender;
        if (userData.dob || userData.dateOfBirth) {
          currentDonor.dob = userData.dob || userData.dateOfBirth;
          currentDonor.age = calculateAge(currentDonor.dob);
        }
        if (userData.address) currentDonor.address = userData.address;
        if (userData.city) currentDonor.city = userData.city;
        if (userData.state) currentDonor.state = userData.state;
        if (userData.pincode || userData.pinCode) currentDonor.pincode = userData.pincode || userData.pinCode;
        if (userData.createdAt || userData.created_at) currentDonor.createdAt = userData.createdAt || userData.created_at;
        if (userData.conditions) currentDonor.conditions = userData.conditions;
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
          if (matched.bloodType) currentDonor.bloodType = matched.bloodType;
          if (matched.phone) currentDonor.phone = matched.phone;
          if (matched.gender) currentDonor.gender = matched.gender;
          if (matched.dob || matched.dateOfBirth) {
            currentDonor.dob = matched.dob || matched.dateOfBirth;
            currentDonor.age = calculateAge(currentDonor.dob);
          }
          if (matched.address) currentDonor.address = matched.address;
          if (matched.city) currentDonor.city = matched.city;
          if (matched.state) currentDonor.state = matched.state;
          if (matched.pincode || matched.pinCode) currentDonor.pincode = matched.pincode || matched.pinCode;
          if (matched.createdAt || matched.created_at) currentDonor.createdAt = matched.createdAt || matched.created_at;
          if (matched.conditions) currentDonor.conditions = matched.conditions;
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
          if (lv.verifiedFacility) currentDonor.verifiedFacility = lv.verifiedFacility;
          if (lv.verifiedDate) currentDonor.verifiedDate = lv.verifiedDate;
        } catch (_) {}
      }

      // 2. Fetch fresh dynamic profile from API (/api/donor/profile-data or /api/donor/profile)
      let res = await fetch(`/api/donor/profile-data?donorId=${currentDonor.id}`);
      if (!res.ok) {
        res = await fetch(`/api/donor/profile?donorId=${currentDonor.id}`);
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          currentDonor.id = d.id || currentDonor.id;
          currentDonor.name = d.name || d.fullName || currentDonor.name;
          currentDonor.bloodType = d.bloodType || d.blood_type || currentDonor.bloodType;
          if (d.email) currentDonor.email = d.email;
          if (d.phone || d.mobile) currentDonor.phone = d.phone || d.mobile;
          if (d.gender) currentDonor.gender = d.gender;
          if (d.address) currentDonor.address = d.address;
          if (d.city) currentDonor.city = d.city;
          if (d.state) currentDonor.state = d.state;
          if (d.pincode || d.pinCode) currentDonor.pincode = d.pincode || d.pinCode;
          if (d.createdAt || d.created_at) currentDonor.createdAt = d.createdAt || d.created_at;
          if (d.conditions) currentDonor.conditions = d.conditions;
          if (d.weight !== undefined && d.weight !== null) currentDonor.weight = parseFloat(d.weight);
          if (d.pulse !== undefined && d.pulse !== null) currentDonor.pulse = parseInt(d.pulse, 10);
          if (d.hemoglobin !== undefined && d.hemoglobin !== null) currentDonor.hemoglobin = parseFloat(d.hemoglobin);
          if (d.bloodPressure) currentDonor.bloodPressure = d.bloodPressure;
          if (d.bodyTemp !== undefined && d.bodyTemp !== null) currentDonor.bodyTemp = parseFloat(d.bodyTemp);
          if (d.verifiedFacility) currentDonor.verifiedFacility = d.verifiedFacility;
          if (d.verifiedDate) currentDonor.verifiedDate = d.verifiedDate;
          if (d.lastDonationDate || d.lastDonation) {
            currentDonor.lastDonationDate = d.lastDonationDate || d.lastDonation;
          }
          if (d.dateOfBirth || d.dob) {
            currentDonor.dob = d.dateOfBirth || d.dob;
            currentDonor.age = calculateAge(d.dateOfBirth || d.dob);
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
    const idEl = document.getElementById('donor-unique-id');
    const bgEl = document.getElementById('donor-profile-blood-group');
    const initialsEl = document.getElementById('donor-avatar-initials');
    const tokenEl = document.getElementById('donor-qr-token');

    const fullName = currentDonor.name || 'Ankit Kumar';
    if (nameEl) nameEl.textContent = fullName;

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

    // 2. Token Management & QR Render
    const storageKey = 'red404_qr_token_donor_' + (currentDonor.id || '1');
    let secureToken = localStorage.getItem(storageKey);
    if (!secureToken) {
      secureToken = generateSecureToken();
      localStorage.setItem(storageKey, secureToken);
    }
    if (tokenEl) {
      tokenEl.textContent = `TOKEN: ${secureToken}`;
    }

    renderIntakeQRCode(secureToken, uniqueIdStr);

    // 3. Demographics & Identity Telemetry Block
    const ageEl = document.getElementById('donor-age');
    const genderEl = document.getElementById('donor-gender');
    const phoneEl = document.getElementById('donor-phone');
    const emailEl = document.getElementById('donor-email');
    const addressEl = document.getElementById('donor-address');
    const cityEl = document.getElementById('donor-city');
    const stateEl = document.getElementById('donor-state');
    const pincodeEl = document.getElementById('donor-pincode');

    if (ageEl) {
      const calculatedAge = (currentDonor.age !== null && currentDonor.age !== undefined)
        ? currentDonor.age
        : (currentDonor.dob ? calculateAge(currentDonor.dob) : 24);
      ageEl.textContent = `${calculatedAge} Yrs`;
    }
    if (genderEl) genderEl.textContent = capitalize(currentDonor.gender || 'Male');
    if (phoneEl) phoneEl.textContent = formatPhoneNumber(currentDonor.phone || '+91 98765 43210');
    if (emailEl) emailEl.textContent = currentDonor.email || 'donor@red404.in';
    if (addressEl) addressEl.textContent = currentDonor.address || 'Near Subharti, Delhi Road';
    if (cityEl) cityEl.textContent = currentDonor.city || 'Meerut';
    if (stateEl) stateEl.textContent = currentDonor.state || 'Uttar Pradesh';
    if (pincodeEl) pincodeEl.textContent = currentDonor.pincode || '250002';

    // 4. Blood & Verification Info
    const rhEl = document.getElementById('donor-rh-factor');
    const typeEl = document.getElementById('donor-type');
    const verifiedEl = document.getElementById('donor-bg-verified');
    const regDateEl = document.getElementById('donor-reg-date');
    const lastLocEl = document.getElementById('donor-last-location');

    if (rhEl) {
      const isPositive = !bloodType.includes('-');
      rhEl.textContent = isPositive ? 'Rh-D Positive (Rh+)' : 'Rh-D Negative (Rh-)';
    }
    if (typeEl) typeEl.textContent = currentDonor.donorType || 'Voluntary Lifesaver';
    if (verifiedEl) verifiedEl.textContent = currentDonor.verifiedFacility ? 'Lab Verified • Clinical Certified' : 'Verified Lifesaver Node';

    if (regDateEl) {
      const cleanEmail = (currentDonor.email || '').trim().toLowerCase();
      const storedRegDate = (cleanEmail && localStorage.getItem('red404_reg_date_' + cleanEmail)) || currentDonor.createdAt || currentDonor.created_at;
      regDateEl.textContent = formatDate(storedRegDate || '2026-11-09');
    }
    if (lastLocEl) {
      lastLocEl.textContent = currentDonor.verifiedFacility || 'Subharti Hospital & Trauma Centre';
    }

    // 5. Basic Medical Information (Restricted/Secure View)
    const allergiesEl = document.getElementById('donor-allergies');
    const conditionsEl = document.getElementById('donor-conditions');
    const medsEl = document.getElementById('donor-medications');
    const surgeriesEl = document.getElementById('donor-surgeries');
    const hbPayloadEl = document.getElementById('donor-hemoglobin-payload');
    const bpPayloadEl = document.getElementById('donor-bp-payload');
    const eligPayloadEl = document.getElementById('donor-eligibility-status-payload');

    if (allergiesEl) allergiesEl.textContent = currentDonor.allergies || 'No Known Drug Allergies (NKDA)';
    if (conditionsEl) {
      let condStr = 'None Reported • Normal Screening';
      if (Array.isArray(currentDonor.conditions) && currentDonor.conditions.length > 0) {
        condStr = currentDonor.conditions.filter(c => c && c !== 'none').join(', ') || condStr;
      } else if (typeof currentDonor.conditions === 'string' && currentDonor.conditions && currentDonor.conditions !== 'none') {
        condStr = currentDonor.conditions;
      }
      conditionsEl.textContent = condStr;
    }
    if (medsEl) medsEl.textContent = currentDonor.medications || 'None / Unrestricted';
    if (surgeriesEl) surgeriesEl.textContent = currentDonor.surgeries || 'None Reported (< 12 months)';

    const hbVal = (currentDonor.hemoglobin !== null && currentDonor.hemoglobin !== undefined) ? currentDonor.hemoglobin : 14.8;
    if (hbPayloadEl) hbPayloadEl.textContent = `${hbVal} g/dL`;

    const bpVal = currentDonor.bloodPressure || '120/80';
    if (bpPayloadEl) bpPayloadEl.textContent = `${bpVal} mmHg`;

    if (eligPayloadEl) {
      eligPayloadEl.textContent = 'ELIGIBLE TO DONATE';
    }

    // 6. Action Button Bindings
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

  function renderIntakeQRCode(token, uniqueId) {
    const container = document.getElementById('donor-qr-code');
    if (!container) return;
    if (typeof RED404_QR === 'undefined' || typeof RED404_QR.render !== 'function') {
      console.warn('RED404_QR generator not loaded.');
      return;
    }
    const secureIntakeUrl = `https://red404.in/verify?t=${encodeURIComponent(token)}&donor=${encodeURIComponent(uniqueId)}`;
    RED404_QR.render(container, secureIntakeUrl, {
      size: 76,
      color: '#38bdf8',
      glow: true
    });
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
      btnRegen.addEventListener('click', () => {
        const tokenEl = document.getElementById('donor-qr-token');
        const newToken = generateSecureToken();
        localStorage.setItem(storageKey, newToken);
        if (tokenEl) tokenEl.textContent = `TOKEN: ${newToken}`;
        renderIntakeQRCode(newToken, uniqueIdStr);
        showToast('Security Token Revoked & Regenerated. New intake QR is active.', 'success');
      });
    }
  }

  function formatPhoneNumber(phone) {
    if (!phone) return '+91 98765 43210';
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
    if (!dobStr) return 24;
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return 24;
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

