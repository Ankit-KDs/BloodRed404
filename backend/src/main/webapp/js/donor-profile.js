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
    bloodType: 'A+',
    age: null,
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
    availability: 'Available'
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

    // Auto-sync polling every 10s: Automatically catches new vitals recorded by hospital dashboard
    setInterval(async () => {
      await loadDonorProfile();
      await loadDonationHistory();
      evaluateHealthAndEligibility();
    }, 10000);

    // Cross-tab / localStorage event: instantly updates if hospital dashboard saves intake
    window.addEventListener('storage', (e) => {
      if (e.key && (e.key.includes('donor') || e.key.includes('vitals') || e.key.includes('donation'))) {
        loadDonorProfile().then(() => {
          evaluateHealthAndEligibility();
          loadDonationHistory();
        });
      }
    });
  });

  // ======================== 1. LOAD DONOR PROFILE ========================
  async function loadDonorProfile() {
    try {
      // 1. Read existing Auth session if available
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      if (session && session.user) {
        currentDonor.id = session.user.id || currentDonor.id;
        currentDonor.name = session.user.name || session.user.fullName || currentDonor.name;
        currentDonor.bloodType = session.user.bloodType || currentDonor.bloodType;
        if (session.user.latitude && session.user.longitude) {
          currentDonor.latitude = parseFloat(session.user.latitude);
          currentDonor.longitude = parseFloat(session.user.longitude);
        }
      }

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
    updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);
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

    renderDonationHistory();
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
        badge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span id="badgeText">ELIGIBLE TO DONATE • Safe to Proceed</span>`;
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

  function evaluateAndRenderMilestones() {
    const grid = document.getElementById('milestonesGrid');
    const counter = document.getElementById('badgesEarnedCounter');
    if (!grid) return;

    const hist = Array.isArray(donationHistory) ? donationHistory : [];
    const donorBloodType = String(currentDonor.bloodType || '').trim().toUpperCase();

    // Default demo state: 3 Unlocked, 3 Locked (as requested by user)
    // Dynamic logic activates unlocked states if requirements are met
    const isFirstSavior = hist.length >= 1 || true;
    const isGoldenHour = hist.some(d => {
      const respTime = d.responseTime !== undefined && d.responseTime !== null ? Number(d.responseTime) : null;
      if (respTime !== null && respTime <= 45) return true;
      const urg = String(d.urgency || d.priority || d.tag || d.donationType || '').toUpperCase();
      return urg.includes('CRITICAL') || urg.includes('EMERGENCY');
    }) || true;
    const isNightOwl = hist.some(d => {
      const dt = d.donationDate || d.date || d.createdAt;
      if (!dt) return false;
      const parsed = new Date(dt);
      if (isNaN(parsed.getTime())) return false;
      const hour = parsed.getHours();
      return hour >= 22 || hour <= 6;
    }) || true;

    const isRhNegative = ['O-', 'A-', 'B-', 'AB-'].some(t => donorBloodType.includes(t));
    const isRareVanguard = isRhNegative && hist.length >= 1;
    const isLifeGiver5 = hist.length >= 5;
    const isApexGuardian = hist.length >= 10;

    const badges = [
      {
        id: 'first-savior',
        title: 'FIRST SAVIOR',
        unlocked: isFirstSavior,
        cardClass: 'unlocked-emerald',
        lockedText: 'LOCKED',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="fs_glowDrop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#10b981" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="fs_shieldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#cbd5e1"/>
      <stop offset="60%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="fs_shieldField" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="45%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <radialGradient id="fs_emeraldDropGrad" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#a7f3d0"/>
      <stop offset="25%" stop-color="#34d399"/>
      <stop offset="65%" stop-color="#059669"/>
      <stop offset="100%" stop-color="#022c22"/>
    </radialGradient>
    <linearGradient id="fs_dropSpec" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="M40 7 L68 16 C68 46 56 67 40 76 C24 67 12 46 12 16 Z" fill="rgba(0,0,0,0.4)"/>
  <path d="M40 5 L68 14 C68 44 56 65 40 74 C24 65 12 44 12 14 Z" fill="url(#fs_shieldRim)" stroke="#ffffff" stroke-width="0.8"/>
  <path d="M40 9 L64 17 C64 42 53 60 40 68 C27 60 16 42 16 17 Z" fill="#1e293b"/>
  <path d="M40 12 L61 19 C61 40 51 57 40 65 C29 57 19 40 19 19 Z" fill="url(#fs_shieldField)" stroke="#34d399" stroke-width="0.8"/>
  <path d="M40 13 L60 19 C60 32 50 48 40 52 C30 48 20 32 20 19 Z" fill="rgba(255,255,255,0.1)"/>
  <g filter="url(#fs_glowDrop)">
    <path d="M40 24 C40 24 27 41 27 50 C27 58 32.8 63 40 63 C47.2 63 53 58 53 50 C53 41 40 24 40 24 Z" fill="url(#fs_emeraldDropGrad)" stroke="#6ee7b7" stroke-width="0.6"/>
    <path d="M38 29 C38 29 31 42 31 49 C31 52 32 55 34 56 C33 53 33 48 36 43 C38 39 39.5 33 38 29 Z" fill="url(#fs_dropSpec)"/>
    <circle cx="45" cy="53" r="2.2" fill="#a7f3d0" opacity="0.4"/>
    <path d="M34 58 C37 60.5 43 60.5 46 58" stroke="#a7f3d0" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>`
      },
      {
        id: 'golden-hour',
        title: 'GOLDEN HOUR HERO',
        unlocked: isGoldenHour,
        cardClass: 'unlocked-amber',
        lockedText: 'LOCKED',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="gh_goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#f59e0b" flood-opacity="0.45"/>
    </filter>
    <linearGradient id="gh_goldFeatherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="35%" stop-color="#f59e0b"/>
      <stop offset="75%" stop-color="#b45309"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="gh_goldOctRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="25%" stop-color="#fde047"/>
      <stop offset="50%" stop-color="#d97706"/>
      <stop offset="75%" stop-color="#92400e"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
    <radialGradient id="gh_dialGrad" cx="45%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="45%" stop-color="#d97706"/>
      <stop offset="80%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#3b1d06"/>
    </radialGradient>
  </defs>
  <g filter="url(#gh_goldGlow)">
    <!-- Left Wing Feathers -->
    <path d="M26 36 C22 28 14 20 6 18 C12 25 16 33 22 42 Z" fill="url(#gh_goldFeatherGrad)" stroke="#fef08a" stroke-width="0.5"/>
    <path d="M24 43 C19 36 12 30 7 28 C12 34 16 41 21 48 Z" fill="url(#gh_goldFeatherGrad)" stroke="#fde047" stroke-width="0.5"/>
    <path d="M22 50 C17 45 12 40 9 39 C13 44 17 50 20 54 Z" fill="url(#gh_goldFeatherGrad)" stroke="#d97706" stroke-width="0.5"/>
    <!-- Right Wing Feathers -->
    <path d="M54 36 C58 28 66 20 74 18 C68 25 64 33 58 42 Z" fill="url(#gh_goldFeatherGrad)" stroke="#fef08a" stroke-width="0.5"/>
    <path d="M56 43 C61 36 68 30 73 28 C68 34 64 41 59 48 Z" fill="url(#gh_goldFeatherGrad)" stroke="#fde047" stroke-width="0.5"/>
    <path d="M58 50 C63 45 68 40 71 39 C67 44 63 50 60 54 Z" fill="url(#gh_goldFeatherGrad)" stroke="#d97706" stroke-width="0.5"/>

    <!-- Top Winder Ring & Cap -->
    <path d="M40 8 C43.3 8 46 10.7 46 14 C46 17.3 43.3 20 40 20 C36.7 20 34 17.3 34 14 C34 10.7 36.7 8 40 8 Z" stroke="url(#gh_goldOctRim)" stroke-width="2.5" fill="none"/>
    <rect x="37" y="16" width="6" height="5" rx="1.5" fill="url(#gh_goldOctRim)"/>

    <!-- Octagonal Outer Case -->
    <polygon points="28,21 52,21 66,35 66,57 52,71 28,71 14,57 14,35" fill="url(#gh_goldOctRim)" stroke="#fef08a" stroke-width="0.7"/>
    <!-- Octagonal Inner Bevel -->
    <polygon points="29,23 51,23 64,36 64,56 51,69 29,69 16,56 16,36" fill="#451a03"/>
    <!-- Octagonal Dial Plate -->
    <polygon points="30,25 50,25 62,37 62,55 50,67 30,67 18,55 18,37" fill="url(#gh_dialGrad)" stroke="#f59e0b" stroke-width="0.8"/>

    <!-- Dial Marks & Concentric Ring -->
    <circle cx="40" cy="46" r="15" stroke="rgba(254, 240, 138, 0.35)" stroke-width="1" stroke-dasharray="2 3"/>
    <circle cx="40" cy="33" r="1.5" fill="#fef08a"/>
    <circle cx="53" cy="46" r="1.5" fill="#fef08a"/>
    <circle cx="40" cy="59" r="1.5" fill="#fef08a"/>
    <circle cx="27" cy="46" r="1.5" fill="#fef08a"/>

    <!-- Clock Hands (Pointing at ~1:50) -->
    <line x1="40" y1="46" x2="31" y2="39" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    <line x1="40" y1="46" x2="49" y2="36" stroke="#fef08a" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="40" cy="46" r="2.8" fill="#fef08a" stroke="#78350f" stroke-width="0.8"/>
    <circle cx="39.3" cy="45.3" r="0.8" fill="#ffffff"/>
  </g>
</svg>`
      },
      {
        id: 'night-owl',
        title: 'NIGHT OWL',
        unlocked: isNightOwl,
        cardClass: 'unlocked-indigo',
        lockedText: 'LOCKED',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="no_owlNeon" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#8b5cf6" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="no_diamondRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0e7ff"/>
      <stop offset="25%" stop-color="#38bdf8"/>
      <stop offset="60%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="no_owlFeatherPurple" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e9d5ff"/>
      <stop offset="30%" stop-color="#c084fc"/>
      <stop offset="70%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
    <radialGradient id="no_owlEyeCyan" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="35%" stop-color="#38bdf8"/>
      <stop offset="75%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#082f49"/>
    </radialGradient>
  </defs>
  <g filter="url(#no_owlNeon)">
    <!-- Outer Standing Diamond Rim -->
    <polygon points="40,5 73,38 40,71 7,38" fill="url(#no_diamondRim)" stroke="#38bdf8" stroke-width="0.8"/>
    <!-- Inner Dark Diamond Field -->
    <polygon points="40,8 70,38 40,68 10,38" fill="#110926"/>
    <!-- Secondary Inner Rim -->
    <polygon points="40,11 67,38 40,65 13,38" fill="none" stroke="rgba(168, 85, 247, 0.4)" stroke-width="1"/>

    <!-- Owl Cybernetic Ears -->
    <polygon points="26,27 18,14 34,22" fill="url(#no_owlFeatherPurple)" stroke="#38bdf8" stroke-width="0.7"/>
    <polygon points="54,27 62,14 46,22" fill="url(#no_owlFeatherPurple)" stroke="#38bdf8" stroke-width="0.7"/>

    <!-- Glowing Crescent Moon -->
    <path d="M40 14 C42 14 43.5 15.2 43.5 17 C43.5 18.8 42 20 40 20 C38.5 20 39.5 18.6 39.5 17 C39.5 15.4 38.5 14 40 14 Z" fill="#38bdf8" filter="drop-shadow(0 0 3px #38bdf8)"/>

    <!-- Brow Visor -->
    <polygon points="40,29 25,23 30,30 40,34 50,30 55,23" fill="#a855f7" stroke="#e0e7ff" stroke-width="0.6"/>

    <!-- Glowing Cybernetic Eyes -->
    <polygon points="24,30 36,32 34,39 22,37" fill="#0c0720" stroke="#38bdf8" stroke-width="0.8"/>
    <ellipse cx="29" cy="35" rx="4" ry="3" fill="url(#no_owlEyeCyan)"/>
    <circle cx="28" cy="34" r="1.2" fill="#ffffff"/>

    <polygon points="56,30 44,32 46,39 58,37" fill="#0c0720" stroke="#38bdf8" stroke-width="0.8"/>
    <ellipse cx="51" cy="35" rx="4" ry="3" fill="url(#no_owlEyeCyan)"/>
    <circle cx="50" cy="34" r="1.2" fill="#ffffff"/>

    <!-- Sharp Beak -->
    <polygon points="40,32 43,44 40,49 37,44" fill="#38bdf8" stroke="#ffffff" stroke-width="0.6"/>

    <!-- Tiered Face Plumage Plates -->
    <polygon points="26,41 37,44 32,53 23,48" fill="#7c3aed" stroke="#38bdf8" stroke-width="0.5"/>
    <polygon points="54,41 43,44 48,53 57,48" fill="#7c3aed" stroke="#38bdf8" stroke-width="0.5"/>
    <!-- Chin Plate -->
    <polygon points="40,49 46,55 40,64 34,55" fill="url(#no_owlFeatherPurple)" stroke="#38bdf8" stroke-width="0.6"/>
    <line x1="40" y1="49" x2="40" y2="64" stroke="#38bdf8" stroke-width="0.8"/>
  </g>
</svg>`
      },
      {
        id: 'rare-vanguard',
        title: 'RARE VANGUARD',
        unlocked: isRareVanguard,
        cardClass: '',
        lockedText: 'LOCKED',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="rv_shadowPlate" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <linearGradient id="rv_ironBevel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="30%" stop-color="#475569"/>
      <stop offset="70%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="rv_gemFacetTopLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="30%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#450a0a"/>
    </linearGradient>
    <linearGradient id="rv_gemFacetTopRight" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#dc2626"/>
      <stop offset="40%" stop-color="#7f1d1d"/>
      <stop offset="100%" stop-color="#2a0505"/>
    </linearGradient>
    <linearGradient id="rv_gemFacetBottomLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#991b1b"/>
      <stop offset="70%" stop-color="#450a0a"/>
      <stop offset="100%" stop-color="#1c0404"/>
    </linearGradient>
    <linearGradient id="rv_gemFacetBottomRight" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7f1d1d"/>
      <stop offset="60%" stop-color="#300707"/>
      <stop offset="100%" stop-color="#0f0202"/>
    </linearGradient>
  </defs>
  <g filter="url(#rv_shadowPlate)">
    <!-- Hexagonal Iron Base Plate -->
    <polygon points="40,8 67,23 67,55 40,70 13,55 13,23" fill="url(#rv_ironBevel)" stroke="#64748b" stroke-width="0.8"/>
    <!-- Recessed Hexagon Well -->
    <polygon points="40,12 63,25 63,53 40,66 17,53 17,25" fill="#161c24" stroke="#0f172a" stroke-width="1"/>
    <!-- Faceted Crystal Cast Shadow -->
    <polygon points="40,16 52,38 48,64 32,64 28,38" fill="rgba(0,0,0,0.5)"/>

    <!-- Faceted Red Ruby Crystal -->
    <polygon points="40,14 40,42 27,37" fill="url(#rv_gemFacetTopLeft)"/>
    <polygon points="40,14 53,37 40,42" fill="url(#rv_gemFacetTopRight)"/>
    <polygon points="40,42 40,66 27,37" fill="url(#rv_gemFacetBottomLeft)"/>
    <polygon points="40,42 53,37 40,66" fill="url(#rv_gemFacetBottomRight)"/>

    <polygon points="27,37 23,40 33,65 40,66" fill="#450a0a" opacity="0.6"/>
    <polygon points="53,37 57,40 47,65 40,66" fill="#1c0404" opacity="0.8"/>

    <!-- Facet Highlight Seams -->
    <line x1="40" y1="14" x2="40" y2="66" stroke="#fca5a5" stroke-width="0.8" opacity="0.6"/>
    <line x1="27" y1="37" x2="53" y2="37" stroke="#fca5a5" stroke-width="0.5" opacity="0.4"/>
  </g>
</svg>`
      },
      {
        id: 'life-giver-5',
        title: 'LIFE GIVER V',
        unlocked: isLifeGiver5,
        cardClass: '',
        lockedText: 'LOCKED • Req. 5 Donations',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="lg_shadowSteel" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <linearGradient id="lg_steelOuterRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="30%" stop-color="#64748b"/>
      <stop offset="70%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="lg_steelInnerPlate" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="25%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="75%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="lg_rivetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <g filter="url(#lg_shadowSteel)">
    <!-- Outer Steel Shield Silhouette -->
    <path d="M40 7 L68 15 C68 46 56 66 40 74 C24 66 12 46 12 15 Z" fill="url(#lg_steelOuterRim)" stroke="#94a3b8" stroke-width="0.8"/>
    <!-- Recessed Bed -->
    <path d="M40 12 L63 19 C63 43 53 59 40 66 C27 59 17 43 17 19 Z" fill="#1a202c"/>

    <!-- Center Steel Emblem / Inner Beveled Plate -->
    <path d="M40 16 L58 22 C58 41 49 55 40 61 C31 55 22 41 22 22 Z" fill="url(#lg_steelInnerPlate)" stroke="#475569" stroke-width="0.8"/>
    <path d="M40 16 L58 22 C58 41 49 55 40 61 Z" fill="rgba(255,255,255,0.06)"/>
    <line x1="40" y1="16" x2="40" y2="61" stroke="#94a3b8" stroke-width="0.8" opacity="0.6"/>

    <!-- 3 Metallic Studs / Rivets -->
    <circle cx="23" cy="20" r="2.2" fill="url(#lg_rivetGrad)" stroke="#1e293b" stroke-width="0.5"/>
    <circle cx="22.5" cy="19.5" r="0.6" fill="#ffffff" opacity="0.8"/>
    <circle cx="57" cy="20" r="2.2" fill="url(#lg_rivetGrad)" stroke="#1e293b" stroke-width="0.5"/>
    <circle cx="56.5" cy="19.5" r="0.6" fill="#ffffff" opacity="0.8"/>
    <circle cx="40" cy="69" r="2.2" fill="url(#lg_rivetGrad)" stroke="#1e293b" stroke-width="0.5"/>
    <circle cx="39.5" cy="68.5" r="0.6" fill="#ffffff" opacity="0.8"/>
  </g>
</svg>`
      },
      {
        id: 'apex-guardian',
        title: 'APEX GUARDIAN',
        unlocked: isApexGuardian,
        cardClass: '',
        lockedText: 'LOCKED • Req. 10 Donations',
        svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ag_shadowWreath" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
    <linearGradient id="ag_antiqueGoldLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="25%" stop-color="#d4af37"/>
      <stop offset="60%" stop-color="#854d0e"/>
      <stop offset="100%" stop-color="#3b1d06"/>
    </linearGradient>
    <linearGradient id="ag_antiqueShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="40%" stop-color="#a16207"/>
      <stop offset="80%" stop-color="#713f12"/>
      <stop offset="100%" stop-color="#271302"/>
    </linearGradient>
  </defs>
  <g filter="url(#ag_shadowWreath)">
    <!-- Central Antique Gold Shield -->
    <path d="M40 22 L54 28 C54 48 46 60 40 65 C34 60 26 48 26 28 Z" fill="url(#ag_antiqueShieldGrad)" stroke="#ca8a04" stroke-width="0.8"/>
    <path d="M40 22 L54 28 C54 48 46 60 40 65 Z" fill="rgba(0,0,0,0.3)"/>
    <line x1="40" y1="22" x2="40" y2="65" stroke="#fef08a" stroke-width="0.8" opacity="0.6"/>

    <!-- Antique Laurel Wreath -->
    <path d="M37 68 C39 70 41 70 43 68 C45 66 43 64 40 65 C37 64 35 66 37 68 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.5"/>

    <!-- Left Laurel Branch Leaves -->
    <path d="M36 67 C30 66 26 61 28 57 C31 57 34 62 36 67 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M31 61 C24 59 21 54 23 49 C26 50 30 55 31 61 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M26 53 C19 50 17 44 20 40 C23 41 26 47 26 53 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M24 44 C17 39 16 33 20 29 C22 31 24 37 24 44 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M24 34 C19 28 19 22 23 18 C25 21 26 27 24 34 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M27 24 C23 18 25 12 30 9 C31 13 30 19 27 24 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>

    <path d="M33 55 C29 52 28 47 30 44 C33 45 34 50 33 55 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M29 44 C26 39 26 34 29 31 C31 33 31 39 29 44 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M30 33 C28 27 29 22 33 20 C34 23 33 28 30 33 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>

    <!-- Right Laurel Branch Leaves -->
    <path d="M44 67 C50 66 54 61 52 57 C49 57 46 62 44 67 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M49 61 C56 59 59 54 57 49 C54 50 50 55 49 61 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M54 53 C61 50 63 44 60 40 C57 41 54 47 54 53 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M56 44 C63 39 64 33 60 29 C58 31 56 37 56 44 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M56 34 C61 28 61 22 57 18 C55 21 54 27 56 34 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M53 24 C57 18 55 12 50 9 C49 13 50 19 53 24 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>

    <path d="M47 55 C51 52 52 47 50 44 C47 45 46 50 47 55 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M51 44 C54 39 54 34 51 31 C49 33 49 39 51 44 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
    <path d="M50 33 C52 27 51 22 47 20 C46 23 47 28 50 33 Z" fill="url(#ag_antiqueGoldLeaf)" stroke="#713f12" stroke-width="0.4"/>
  </g>
</svg>`
      }
    ];

    const unlockedCount = badges.filter(b => b.unlocked).length;
    if (counter) {
      counter.textContent = `Earned Badges: ${unlockedCount} / 6`;
    }

    grid.innerHTML = badges.map(b => `
      <div class="milestone-badge-tile ${b.unlocked ? `unlocked ${b.cardClass}` : 'locked'}" title="${escapeHtml(b.title)}">
        ${!b.unlocked ? '<i class="fa-solid fa-lock mbt-card-lock"></i>' : ''}
        <div class="badge-svg-wrap">
          ${b.svg}
        </div>
        <div class="badge-title">${escapeHtml(b.title)}</div>
        <div class="badge-status">${b.unlocked ? 'UNLOCKED' : escapeHtml(b.lockedText)}</div>
      </div>
    `).join('');
  }

  // ======================== 5. RENDER DONATION HISTORY ========================
  // Purely dynamic & real-time: Displays records only after a hospital completes and approves donation intake
  function renderDonationHistory() {
    const container = document.getElementById('donationHistoryContainer');
    if (!container) return;

    if (!donationHistory || donationHistory.length === 0) {
      container.innerHTML = `
        <div class="empty-history-state">
          <div class="eh-icon-ring">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <h3 class="eh-title">No Hospital-Approved Donations Yet</h3>
          <p class="eh-desc">
            This is a real-time clinical log. Donation entries appear here only after you complete a physical intake that is directly verified and approved by the receiving hospital.
          </p>
          <div class="eh-sync-badge">
            <span class="eh-sync-dot"></span> Live Hospital Verification Engine Active
          </div>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    donationHistory.forEach(item => {
      const refCode = item.id || `RED-${String(item.donationId || 1001).padStart(5, '0')}`;
      const dateStr = formatDate(item.donationDate || item.date);
      const facility = item.hospitalName || item.hospital || 'District Blood Bank';
      const rawUnits = item.unitsDonated || item.units || 1;
      const unitsLabel = String(rawUnits).toLowerCase().includes('unit') ? rawUnits : `${rawUnits} Unit`;
      const type = item.donationType || item.type || 'Whole Blood';
      const status = item.status || 'COMPLETED';

      rowsHtml += `
        <tr>
          <td>
            <span class="ht-ref">${escapeHtml(refCode)}</span>
            <span class="ht-date">${escapeHtml(dateStr)}</span>
          </td>
          <td><span class="ht-hosp">${escapeHtml(facility)}</span></td>
          <td>${escapeHtml(unitsLabel)}</td>
          <td>${escapeHtml(type)}</td>
          <td><span class="status-pill-completed">${escapeHtml(status)}</span></td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Location Facility</th>
            <th>Amount</th>
            <th>Donation Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
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

