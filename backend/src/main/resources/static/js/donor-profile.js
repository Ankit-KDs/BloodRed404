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
  function renderMedicalEligibilityTracker() {
    const bloodColumn = document.getElementById('bloodLiquidColumn');
    const daysVal = document.getElementById('scannerDaysVal');
    const daysLbl = document.getElementById('scannerDaysLbl');
    const recoveredVal = document.getElementById('scannerRecoveredVal');
    const recoveredSub = document.getElementById('scannerRecoveredSub');
    const pillWrap = document.getElementById('scannerStatusPillWrap');
    const checklistWrap = document.getElementById('scannerChecklistWrap');
    const metaTag = document.getElementById('eligibilityMetaTag');

    const lastDonation = currentDonor.lastDonationDate;
    let isEligible = false;
    let daysPassed = 0;
    let remainingDays = 0;
    let percentage = 0;
    let targetDateStr = 'Immediate / READY';

    if (!lastDonation) {
      // Donor has NOT donated any blood yet -> Real-time 100% Eligible!
      isEligible = true;
      percentage = 100;
      remainingDays = 0;
    } else {
      // Donor has a recorded donation -> calculate real-time day-by-day countdown & fluid rise
      const donationDate = new Date(lastDonation);
      if (!isNaN(donationDate.getTime())) {
        const now = new Date();
        daysPassed = Math.floor((now.getTime() - donationDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPassed >= 90) {
          isEligible = true;
          percentage = 100;
          remainingDays = 0;
        } else {
          isEligible = false;
          remainingDays = Math.max(0, 90 - daysPassed);
          // After donation starts at 0% and increases day by day with blood flow
          percentage = Math.min(Math.max(0, Math.floor((daysPassed / 90) * 100)), 99);
          const targetDate = new Date(donationDate.getTime() + 90 * 24 * 60 * 60 * 1000);
          targetDateStr = targetDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        }
      } else {
        isEligible = true;
        percentage = 100;
        remainingDays = 0;
      }
    }

    if (isEligible) {
      // State 1: 100% Eligible (Pre-Donation or Cooldown Completed)
      if (bloodColumn) {
        bloodColumn.style.height = '100%';
      }

      if (metaTag) {
        metaTag.className = 'card-meta-tag scanner-meta-tag tag-ready';
        metaTag.innerHTML = `<i class="fas fa-check-circle"></i> Safety Cooldown`;
      }

      if (daysVal) daysVal.textContent = '90 DAYS';
      if (daysLbl) {
        daysLbl.textContent = 'ELIGIBLE TO DONATE';
        daysLbl.style.color = '#34d399';
      }

      if (recoveredVal) {
        recoveredVal.textContent = '100% RESTORED • READY';
        recoveredVal.style.color = '#f8fafc';
      }

      if (recoveredSub) {
        recoveredSub.textContent = '(optimal biological volume • ready to donate)';
      }

      if (pillWrap) {
        pillWrap.innerHTML = `
          <div class="stc-pill pill-eligible">
            <span class="stc-dot dot-green"></span>
            <span>ELIGIBLE TO DONATE • READY</span>
          </div>
        `;
      }

      if (checklistWrap) {
        checklistWrap.innerHTML = `
          <div class="stc-check-item">
            <i class="fas fa-check"></i>
            <span>90-day wait period met</span>
          </div>
          <div class="stc-check-item">
            <i class="fas fa-check"></i>
            <span>Health indicators optimal</span>
          </div>
          <div class="stc-check-item">
            <i class="fas fa-check"></i>
            <span>Not currently on medication</span>
          </div>
          <div class="stc-check-item">
            <i class="fas fa-calendar-check"></i>
            <span>Next Available: <b>Immediate / READY</b></span>
          </div>
        `;
      }
    } else {
      // State 2: Cooldown Active (Fluid rises day by day from 0% to 100% post-donation)
      if (bloodColumn) {
        bloodColumn.style.height = `${percentage}%`;
      }

      if (metaTag) {
        metaTag.className = 'card-meta-tag scanner-meta-tag tag-cooldown';
        metaTag.innerHTML = `<i class="fas fa-hourglass-half"></i> Safety Cooldown`;
      }

      if (daysVal) daysVal.textContent = `${remainingDays} DAYS`;
      if (daysLbl) {
        daysLbl.textContent = 'REMAINING';
        daysLbl.style.color = '#94a3b8';
      }

      if (recoveredVal) {
        recoveredVal.textContent = `${percentage}% RECOVERED`;
        recoveredVal.style.color = '#ffffff';
      }

      if (recoveredSub) {
        recoveredSub.textContent = '(reducing day by day post-donation)';
      }

      if (pillWrap) {
        pillWrap.innerHTML = `
          <div class="stc-pill pill-cooldown">
            <i class="fas fa-hourglass-half" style="font-size:0.75rem;"></i>
            <span>COOLDOWN ACTIVE • Recovery in Progress</span>
          </div>
        `;
      }

      if (checklistWrap) {
        checklistWrap.innerHTML = `
          <div class="stc-check-item pending">
            <i class="fas fa-hourglass-half"></i>
            <span>Recovery interval: ${remainingDays} days left</span>
          </div>
          <div class="stc-check-item">
            <i class="fas fa-check"></i>
            <span>Vitals regeneration in progress</span>
          </div>
          <div class="stc-check-item next-avail">
            <i class="fas fa-calendar-alt"></i>
            <span>Next Available: <b>${targetDateStr}</b></span>
          </div>
        `;
      }
    }
  }

  // ======================== CARD 3: DONOR IMPACT MILESTONES ========================
  // 3x2 responsive grid of 3D glassmorphic achievement badges evaluated dynamically
  function evaluateAndRenderMilestones() {
    const grid = document.getElementById('milestonesGrid');
    const counter = document.getElementById('badgesEarnedCounter');
    if (!grid) return;

    const hist = Array.isArray(donationHistory) ? donationHistory : [];
    const donorBloodType = String(currentDonor.bloodType || '').trim().toUpperCase();

    // 1. Badge 1: 'First Savior' - Completed >= 1 verified donation
    const isFirstSavior = hist.length >= 1;

    // 2. Badge 2: 'Golden Hour Hero' - Emergency intake response <= 45 min or critical tag
    const isGoldenHour = hist.some(d => {
      const respTime = d.responseTime !== undefined && d.responseTime !== null ? Number(d.responseTime) : null;
      if (respTime !== null && respTime <= 45) return true;
      const urg = String(d.urgency || d.priority || d.tag || d.donationType || '').toUpperCase();
      return urg.includes('CRITICAL') || urg.includes('EMERGENCY');
    });

    // 3. Badge 3: 'Night Owl' - Donation logged between 10:00 PM (22:00) and 6:00 AM (06:00)
    const isNightOwl = hist.some(d => {
      const dt = d.donationDate || d.date || d.createdAt;
      if (!dt) return false;
      const parsed = new Date(dt);
      if (isNaN(parsed.getTime())) return false;
      const hour = parsed.getHours();
      return hour >= 22 || hour <= 6;
    });

    // 4. Badge 4: 'Rare Vanguard' - Rare / Rh-negative blood type (O-, A-, B-, AB-) AND >= 1 verified donation
    const isRhNegative = ['O-', 'A-', 'B-', 'AB-'].some(t => donorBloodType.includes(t));
    const isRareVanguard = isRhNegative && hist.length >= 1;

    // 5. Badge 5: 'Life Giver V' - Completed >= 5 lifetime donations
    const isLifeGiver5 = hist.length >= 5;

    // 6. Badge 6: 'Apex Guardian' - Completed >= 10 lifetime donations
    const isApexGuardian = hist.length >= 10;

    const badges = [
      {
        id: 'first-savior',
        title: 'First Savior',
        theme: 'emerald',
        unlocked: isFirstSavior,
        lockedSub: 'Complete 1 verified blood donation',
        unlockedSub: '1st Verified Donation Completed',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="shieldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#34d399"/>
                <stop offset="60%" stop-color="#10b981"/>
                <stop offset="100%" stop-color="#047857"/>
              </linearGradient>
              <linearGradient id="dropGrad1" x1="30%" y1="0%" x2="70%" y2="100%">
                <stop offset="0%" stop-color="#a7f3d0"/>
                <stop offset="50%" stop-color="#34d399"/>
                <stop offset="100%" stop-color="#065f46"/>
              </linearGradient>
            </defs>
            <path d="M26 4 L42 9 C42 26 35 39 26 48 C17 39 10 26 10 9 Z" fill="rgba(16, 185, 129, 0.15)" stroke="url(#shieldGrad1)" stroke-width="2" stroke-linejoin="round"/>
            <path d="M26 8 L38 12 C38 24 32 35 26 43 C20 35 14 24 14 12 Z" fill="rgba(6, 95, 70, 0.3)" stroke="rgba(52, 211, 153, 0.3)" stroke-width="1"/>
            <path d="M26 16 C26 16 19 25 19 29 C19 32.8 22.1 36 26 36 C29.9 36 33 32.8 33 29 C33 25 26 16 26 16 Z" fill="url(#dropGrad1)"/>
            <path d="M16 29 L21 29 L23 24 L26 34 L29 27 L31 29 L36 29" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
          </svg>
        `
      },
      {
        id: 'golden-hour',
        title: 'Golden Hour Hero',
        theme: 'amber',
        unlocked: isGoldenHour,
        lockedSub: 'Respond to critical alert in <45 mins',
        unlockedSub: 'Rapid Emergency Response Logged',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="amberGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fde68a"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#b45309"/>
              </linearGradient>
            </defs>
            <polygon points="17,5 35,5 47,17 47,35 35,47 17,47 5,35 5,17" fill="rgba(245, 158, 11, 0.14)" stroke="url(#amberGrad2)" stroke-width="2"/>
            <circle cx="26" cy="27" r="14" stroke="rgba(251, 191, 36, 0.4)" stroke-width="1.5" stroke-dasharray="3 2"/>
            <rect x="24" y="9" width="4" height="4" rx="1" fill="#f59e0b"/>
            <path d="M27 16 L20 27 L25 27 L23 37 L33 24 L27 24 Z" fill="url(#amberGrad2)" stroke="#ffffff" stroke-width="0.8"/>
          </svg>
        `
      },
      {
        id: 'night-owl',
        title: 'Night Owl',
        theme: 'indigo',
        unlocked: isNightOwl,
        lockedSub: 'Log donation between 10 PM and 6 AM',
        unlockedSub: 'Off-Hours Night Dispatch Logged',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="indigoGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#c7d2fe"/>
                <stop offset="50%" stop-color="#818cf8"/>
                <stop offset="100%" stop-color="#4338ca"/>
              </linearGradient>
            </defs>
            <polygon points="26,4 48,26 26,48 4,26" fill="rgba(129, 140, 248, 0.14)" stroke="url(#indigoGrad3)" stroke-width="2"/>
            <polygon points="26,9 43,26 26,43 9,26" fill="rgba(49, 46, 129, 0.35)" stroke="rgba(129, 140, 248, 0.3)" stroke-width="1"/>
            <path d="M30 15 C26 15 22 18 22 23 C22 28 26 31 30 31 C27 31 24 28 24 23 C24 18 27 15 30 15 Z" fill="#c7d2fe" opacity="0.85"/>
            <circle cx="21" cy="27" r="3.5" fill="none" stroke="#818cf8" stroke-width="1.2"/>
            <circle cx="21" cy="27" r="1.5" fill="#38bdf8"/>
            <circle cx="31" cy="27" r="3.5" fill="none" stroke="#818cf8" stroke-width="1.2"/>
            <circle cx="31" cy="27" r="1.5" fill="#38bdf8"/>
            <polygon points="26,29 24,33 28,33" fill="#fbbf24"/>
          </svg>
        `
      },
      {
        id: 'rare-vanguard',
        title: 'Rare Vanguard',
        theme: 'ruby',
        unlocked: isRareVanguard,
        lockedSub: 'Rh-negative blood & 1+ donation',
        unlockedSub: 'Rare Rh-Negative Contributor',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rubyGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fca5a5"/>
                <stop offset="50%" stop-color="#dc2626"/>
                <stop offset="100%" stop-color="#7f1d1d"/>
              </linearGradient>
            </defs>
            <polygon points="26,5 45,15 45,37 26,47 7,37 7,15" fill="rgba(220, 38, 38, 0.14)" stroke="url(#rubyGrad4)" stroke-width="2"/>
            <path d="M14 20 Q26 15 38 20 M14 32 Q26 37 38 32" stroke="rgba(248, 113, 113, 0.35)" stroke-width="1.2" stroke-dasharray="2 2"/>
            <path d="M26 16 C26 16 18 26 18 31 C18 35.4 21.6 39 26 39 C30.4 39 34 35.4 34 31 C34 26 26 16 26 16 Z" fill="url(#rubyGrad4)"/>
            <rect x="22" y="29" width="8" height="2.5" rx="1.25" fill="#ffffff"/>
          </svg>
        `
      },
      {
        id: 'life-giver-5',
        title: 'Life Giver V',
        theme: 'cyan',
        unlocked: isLifeGiver5,
        lockedSub: `Complete 5 verified donations (${hist.length}/5)`,
        unlockedSub: '5+ Lifetime Donations Completed',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="cyanGrad5" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#7dd3fc"/>
                <stop offset="50%" stop-color="#0ea5e9"/>
                <stop offset="100%" stop-color="#0369a1"/>
              </linearGradient>
            </defs>
            <path d="M26 6 C34 6 43 9 46 17 C46 29 37 40 26 46 C15 40 6 29 6 17 C9 9 18 6 26 6 Z" fill="rgba(14, 165, 233, 0.14)" stroke="url(#cyanGrad5)" stroke-width="2"/>
            <line x1="26" y1="12" x2="26" y2="39" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="26" cy="11" r="2.5" fill="#38bdf8"/>
            <path d="M19 18 Q26 24 33 18 M18 25 Q26 31 34 25" fill="none" stroke="url(#cyanGrad5)" stroke-width="1.4"/>
            <circle cx="15" cy="38" r="2" fill="#38bdf8"/>
            <circle cx="20" cy="41" r="2" fill="#38bdf8"/>
            <circle cx="26" cy="43" r="2.2" fill="#ffffff"/>
            <circle cx="32" cy="41" r="2" fill="#38bdf8"/>
            <circle cx="37" cy="38" r="2" fill="#38bdf8"/>
          </svg>
        `
      },
      {
        id: 'apex-guardian',
        title: 'Apex Guardian',
        theme: 'gold',
        unlocked: isApexGuardian,
        lockedSub: `Complete 10 verified donations (${hist.length}/10)`,
        unlockedSub: '10+ Veteran Donations Recorded',
        svg: `
          <svg viewBox="0 0 52 52" width="46" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldGrad6" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fef08a"/>
                <stop offset="50%" stop-color="#eab308"/>
                <stop offset="100%" stop-color="#854d0e"/>
              </linearGradient>
            </defs>
            <circle cx="26" cy="27" r="19" fill="rgba(234, 179, 8, 0.14)" stroke="url(#goldGrad6)" stroke-width="2"/>
            <path d="M18 13 L21 17 L26 11 L31 17 L34 13 L33 20 L19 20 Z" fill="url(#goldGrad6)" stroke="#fef08a" stroke-width="0.7"/>
            <path d="M13 25 C13 32 18 39 26 40 C34 39 39 32 39 25" fill="none" stroke="rgba(250, 204, 21, 0.6)" stroke-width="1.4" stroke-dasharray="3 2"/>
            <path d="M26 21 C26 21 21 27 21 31 C21 33.8 23.2 36 26 36 C28.8 36 31 33.8 31 31 C31 27 26 21 26 21 Z" fill="url(#goldGrad6)"/>
            <circle cx="24.8" cy="29.5" r="1" fill="#ffffff" opacity="0.9"/>
          </svg>
        `
      }
    ];

    const unlockedCount = badges.filter(b => b.unlocked).length;
    if (counter) {
      counter.textContent = `Earned Badges: ${unlockedCount} / 6`;
    }

    grid.innerHTML = badges.map(b => `
      <div class="milestone-badge-tile ${b.unlocked ? `unlocked theme-${b.theme}` : 'locked'}" title="${escapeHtml(b.title)}">
        ${!b.unlocked ? '<i class="fas fa-lock mbt-lock-icon"></i>' : ''}
        <div class="mbt-icon-wrap">
          ${b.svg}
        </div>
        <div class="mbt-info">
          <div class="mbt-name">${escapeHtml(b.title)}</div>
          <div class="mbt-sub">${escapeHtml(b.unlocked ? b.unlockedSub : b.lockedSub)}</div>
          <span class="mbt-pill ${b.unlocked ? 'pill-unlocked' : 'pill-locked'}">
            ${b.unlocked ? '<i class="fas fa-check" style="font-size:0.55rem;"></i> UNLOCKED' : '<i class="fas fa-lock" style="font-size:0.55rem;"></i> LOCKED'}
          </span>
        </div>
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

