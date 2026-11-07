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

      // 2. Fetch fresh dynamic profile from API
      const res = await fetch(`/api/donor/profile?donorId=${currentDonor.id}`);
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
  }

  // ======================== 3. AI HEALTH EVALUATION & VITALS ========================
  function evaluateHealthAndEligibility() {
    renderVitalsCard();
    renderAIHealthSuggestion();
    renderMedicalEligibilityTracker();
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

  // ======================== 4. 3-STAGE CLINICAL RECOVERY TRACKER ========================
  function renderMedicalEligibilityTracker() {
    const currentDate = new Date();
    let daysPassed = 90; // Default to eligible if never donated

    if (currentDonor.lastDonationDate) {
      const lastDate = new Date(currentDonor.lastDonationDate);
      if (!isNaN(lastDate.getTime())) {
        const diffMs = currentDate.getTime() - lastDate.getTime();
        daysPassed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    // Top HUD Telemetry Elements
    const hudStageText = document.getElementById('hudStageText');
    const stageBeaconDot = document.getElementById('stageBeaconDot');
    const hudDaysCount = document.getElementById('hudDaysCount');
    const hudDaysPercent = document.getElementById('hudDaysPercent');

    // 3 Stage Phase Elements
    const stageCard1 = document.getElementById('stageCard1');
    const stageIcon1 = document.getElementById('stageIcon1');
    const stageFill1 = document.getElementById('stageFill1');
    const beacon1 = document.getElementById('beacon1');

    const stageCard2 = document.getElementById('stageCard2');
    const stageIcon2 = document.getElementById('stageIcon2');
    const stageFill2 = document.getElementById('stageFill2');
    const beacon2 = document.getElementById('beacon2');

    const stageCard3 = document.getElementById('stageCard3');
    const stageIcon3 = document.getElementById('stageIcon3');
    const stageFill3 = document.getElementById('stageFill3');
    const beacon3 = document.getElementById('beacon3');

    // Status Banner & Bottom Telemetry
    const statusBanner = document.getElementById('recoveryStatusBanner');
    const statusIcon = document.getElementById('recoveryStatusIcon');
    const statusText = document.getElementById('recoveryStatusText');
    const nextAvailableEl = document.getElementById('nextAvailableText');
    const checkWaitItem = document.getElementById('checkWaitItem');

    if (daysPassed >= 90) {
      // Cooldown Completed -> Eligible
      if (hudStageText) hudStageText.textContent = 'Phase 3 - Final Clearance';
      if (stageBeaconDot) stageBeaconDot.className = 'stage-beacon-dot';
      if (hudDaysCount) hudDaysCount.textContent = '90 / 90 DAYS';
      if (hudDaysPercent) {
        hudDaysPercent.textContent = '100%';
        hudDaysPercent.className = 'metric-percent';
      }

      // Phase 1 (100%)
      if (stageFill1) {
        stageFill1.style.width = '100%';
        stageFill1.className = 'stage-fill-bar';
      }
      if (stageIcon1) {
        stageIcon1.className = 'stage-status-icon completed';
        stageIcon1.innerHTML = '<i class="fas fa-check"></i>';
      }
      if (stageCard1) stageCard1.className = 'recovery-stage-card';
      if (beacon1) beacon1.style.display = 'none';

      // Phase 2 (100%)
      if (stageFill2) {
        stageFill2.style.width = '100%';
        stageFill2.className = 'stage-fill-bar';
      }
      if (stageIcon2) {
        stageIcon2.className = 'stage-status-icon completed';
        stageIcon2.innerHTML = '<i class="fas fa-check"></i>';
      }
      if (stageCard2) stageCard2.className = 'recovery-stage-card';
      if (beacon2) beacon2.style.display = 'none';

      // Phase 3 (100%)
      if (stageFill3) {
        stageFill3.style.width = '100%';
        stageFill3.className = 'stage-fill-bar';
      }
      if (stageIcon3) {
        stageIcon3.className = 'stage-status-icon completed';
        stageIcon3.innerHTML = '<i class="fas fa-check"></i>';
      }
      if (stageCard3) stageCard3.className = 'recovery-stage-card stage-active';
      if (beacon3) beacon3.style.display = 'none';

      // Status Banner
      if (statusBanner) statusBanner.className = 'recovery-status-banner banner-eligible';
      if (statusIcon) statusIcon.className = 'fas fa-shield-alt';
      if (statusText) statusText.textContent = 'ELIGIBLE TO DONATE • READY';

      // Next Available & Checklist
      if (nextAvailableEl) {
        nextAvailableEl.className = 'rnb-val';
        nextAvailableEl.textContent = 'Immediate / READY';
      }
      if (checkWaitItem) {
        checkWaitItem.className = 'check-item';
        checkWaitItem.innerHTML = `<i class="fas fa-check-circle"></i> <span>90-day wait period met</span>`;
      }
    } else {
      // Cooldown Active -> Days Remaining & Multi-Stage Fill
      const remainingDays = 90 - daysPassed;
      const percentage = Math.max(1, Math.floor((daysPassed / 90) * 100));

      if (stageBeaconDot) stageBeaconDot.className = 'stage-beacon-dot cooldown';
      if (hudDaysCount) hudDaysCount.textContent = `${daysPassed} / 90 DAYS`;
      if (hudDaysPercent) {
        hudDaysPercent.textContent = `${percentage}%`;
        hudDaysPercent.className = 'metric-percent cooldown';
      }

      let activeStageName = 'Phase 1 - Plasma & Cellular Restore';

      // Calculate Phase 1 (Days 1–30)
      if (daysPassed >= 30) {
        if (stageFill1) {
          stageFill1.style.width = '100%';
          stageFill1.className = 'stage-fill-bar';
        }
        if (stageIcon1) {
          stageIcon1.className = 'stage-status-icon completed';
          stageIcon1.innerHTML = '<i class="fas fa-check"></i>';
        }
        if (stageCard1) stageCard1.className = 'recovery-stage-card';
        if (beacon1) beacon1.style.display = 'none';
      } else {
        const p1 = Math.max(5, Math.floor((daysPassed / 30) * 100));
        activeStageName = 'Phase 1 - Plasma & Cellular Restore';
        if (stageFill1) {
          stageFill1.style.width = `${p1}%`;
          stageFill1.className = 'stage-fill-bar cooldown';
        }
        if (stageIcon1) {
          stageIcon1.className = 'stage-status-icon active-cooldown';
          stageIcon1.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        }
        if (stageCard1) stageCard1.className = 'recovery-stage-card stage-active-cooldown';
        if (beacon1) beacon1.style.display = 'block';
      }

      // Calculate Phase 2 (Days 31–60)
      if (daysPassed >= 60) {
        if (stageFill2) {
          stageFill2.style.width = '100%';
          stageFill2.className = 'stage-fill-bar';
        }
        if (stageIcon2) {
          stageIcon2.className = 'stage-status-icon completed';
          stageIcon2.innerHTML = '<i class="fas fa-check"></i>';
        }
        if (stageCard2) stageCard2.className = 'recovery-stage-card';
        if (beacon2) beacon2.style.display = 'none';
      } else if (daysPassed > 30) {
        const p2 = Math.max(5, Math.floor(((daysPassed - 30) / 30) * 100));
        activeStageName = 'Phase 2 - Iron & Ferritin Replenishment';
        if (stageFill2) {
          stageFill2.style.width = `${p2}%`;
          stageFill2.className = 'stage-fill-bar cooldown';
        }
        if (stageIcon2) {
          stageIcon2.className = 'stage-status-icon active-cooldown';
          stageIcon2.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        }
        if (stageCard2) stageCard2.className = 'recovery-stage-card stage-active-cooldown';
        if (beacon2) beacon2.style.display = 'block';
      } else {
        if (stageFill2) {
          stageFill2.style.width = '0%';
          stageFill2.className = 'stage-fill-bar';
        }
        if (stageIcon2) {
          stageIcon2.className = 'stage-status-icon pending';
          stageIcon2.innerHTML = '<i class="far fa-circle"></i>';
        }
        if (stageCard2) stageCard2.className = 'recovery-stage-card';
        if (beacon2) beacon2.style.display = 'none';
      }

      // Calculate Phase 3 (Days 61–90)
      if (daysPassed > 60) {
        const p3 = Math.max(5, Math.floor(((daysPassed - 60) / 30) * 100));
        activeStageName = 'Phase 3 - Universal Donor Clearance';
        if (stageFill3) {
          stageFill3.style.width = `${p3}%`;
          stageFill3.className = 'stage-fill-bar cooldown';
        }
        if (stageIcon3) {
          stageIcon3.className = 'stage-status-icon active-cooldown';
          stageIcon3.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        }
        if (stageCard3) stageCard3.className = 'recovery-stage-card stage-active-cooldown';
        if (beacon3) beacon3.style.display = 'block';
      } else {
        if (stageFill3) {
          stageFill3.style.width = '0%';
          stageFill3.className = 'stage-fill-bar';
        }
        if (stageIcon3) {
          stageIcon3.className = 'stage-status-icon pending';
          stageIcon3.innerHTML = '<i class="far fa-circle"></i>';
        }
        if (stageCard3) stageCard3.className = 'recovery-stage-card';
        if (beacon3) beacon3.style.display = 'none';
      }

      if (hudStageText) hudStageText.textContent = activeStageName;

      // Status Banner
      if (statusBanner) statusBanner.className = 'recovery-status-banner banner-cooldown';
      if (statusIcon) statusIcon.className = 'fas fa-hourglass-half';
      if (statusText) statusText.textContent = `${remainingDays} DAYS REMAINING • Cooldown in Progress`;

      // Next Available & Checklist
      if (nextAvailableEl && currentDonor.lastDonationDate) {
        const nextAvailDate = new Date(currentDonor.lastDonationDate);
        nextAvailDate.setDate(nextAvailDate.getDate() + 90);
        nextAvailableEl.className = 'rnb-val cooldown';
        nextAvailableEl.textContent = formatDate(nextAvailDate);
      }
      if (checkWaitItem) {
        checkWaitItem.className = 'check-item pending';
        checkWaitItem.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>${remainingDays} days remaining in recovery cooldown</span>`;
      }
    }
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

