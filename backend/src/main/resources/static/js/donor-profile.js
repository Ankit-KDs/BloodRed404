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

