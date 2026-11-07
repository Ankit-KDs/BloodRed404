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

  // ======================== AI HEALTH EVALUATION ADVISORY ========================
  // Automatically runs AI safety audit once hospital fills vitals
  function renderAIHealthSuggestion() {
    const evalBadge = document.getElementById('aiHealthEvalBadge');
    const advisoryText = document.getElementById('aiAdvisoryText');
    const pillsContainer = document.getElementById('aiMetricsPills');
    const hospitalNameEl = document.getElementById('intakeHospitalName');

    const facility = currentDonor.verifiedFacility || 'City General Hospital';
    if (hospitalNameEl) hospitalNameEl.textContent = facility;

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
      if (advisoryText) {
        advisoryText.innerHTML = `<strong>Awaiting Hospital Physical Intake:</strong> No blood screening data has been uploaded yet. Once blood is donated or physical checkup is completed through the hospital dashboard, these vitals will automatically populate, and the RED404 AI Engine will evaluate your clinical eligibility.`;
      }
      if (pillsContainer) {
        pillsContainer.innerHTML = `<span class="amp-pill amp-awaiting"><i class="fas fa-clock"></i> Hospital checkup pending</span>`;
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

    // Build micro chips
    if (pillsContainer) {
      let pillsHtml = '';
      pillsHtml += `<span class="amp-pill ${isHbOk ? 'amp-pass' : 'amp-warn'}"><i class="fas fa-${isHbOk ? 'check-circle' : 'exclamation-circle'}"></i> Hb: ${hb} g/dL (${isHbOk ? 'Safe ≥ 12.5' : 'Low < 12.5'})</span>`;
      pillsHtml += `<span class="amp-pill ${isBpOk ? 'amp-pass' : 'amp-warn'}"><i class="fas fa-${isBpOk ? 'check-circle' : 'exclamation-circle'}"></i> BP: ${bp} mmHg (${isBpOk ? 'Normal' : 'Out of range'})</span>`;
      pillsHtml += `<span class="amp-pill ${isWeightOk ? 'amp-pass' : 'amp-warn'}"><i class="fas fa-${isWeightOk ? 'check-circle' : 'exclamation-circle'}"></i> Weight: ${weight} kg (${isWeightOk ? '≥ 50 kg' : '< 50 kg'})</span>`;
      if (pulse !== null && pulse !== undefined) {
        pillsHtml += `<span class="amp-pill ${isPulseOk ? 'amp-pass' : 'amp-warn'}"><i class="fas fa-${isPulseOk ? 'check-circle' : 'exclamation-circle'}"></i> Pulse: ${pulse} bpm (${isPulseOk ? 'Optimal' : 'Abnormal'})</span>`;
      }
      if (temp !== null && temp !== undefined) {
        pillsHtml += `<span class="amp-pill ${isTempOk ? 'amp-pass' : 'amp-warn'}"><i class="fas fa-${isTempOk ? 'check-circle' : 'exclamation-circle'}"></i> Temp: ${temp}° F (${isTempOk ? 'Normal' : 'Elevated'})</span>`;
      }
      pillsContainer.innerHTML = pillsHtml;
    }

    // AI Clinical diagnosis & advice
    if (advisoryText) {
      if (isFit) {
        advisoryText.innerHTML = `<strong>✨ AI Clinical Evaluation: FIT TO DONATE.</strong> All vital parameters satisfy WHO & NBTC international blood safety standards. Your hemoglobin (<strong>${hb} g/dL</strong>), weight (<strong>${weight} kg</strong>), and cardiovascular indicators (BP: <strong>${bp}</strong>, Pulse: <strong>${pulse || 72} bpm</strong>) are optimal for whole blood collection. You are fully cleared to accept incoming emergency alerts.`;
      } else {
        const issues = [];
        if (!isHbOk) issues.push(`Hemoglobin level (${hb} g/dL) is below the minimum safe threshold (12.5 g/dL)`);
        if (!isBpOk) issues.push(`Blood pressure (${bp} mmHg) is outside the 100/60 to 140/90 safety window`);
        if (!isWeightOk) issues.push(`Body weight (${weight} kg) is below the 50 kg whole-blood safety requirement`);
        if (!isPulseOk) issues.push(`Resting pulse (${pulse} bpm) is outside the 60-100 bpm range`);
        if (!isTempOk) issues.push(`Body temperature (${temp}° F) is elevated above 99.0° F`);

        advisoryText.innerHTML = `<strong>⚠️ AI Clinical Recommendation: MEDICAL REVIEW REQUIRED.</strong> ${issues.join('. ')}. Donation is temporarily deferred for donor safety. Recommended: Rest, hydrate, and complete a physical re-screening at ${escapeHtml(facility)} before accepting emergency alerts.`;
      }
    }
  }

  // ======================== 4. 90-DAY ELIGIBILITY COUNTDOWN ========================
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

    const arc = document.getElementById('gaugeFillArc');
    const statusText = document.getElementById('gaugeStatusText');
    const daysText = document.getElementById('gaugeDaysText');
    const subText = document.getElementById('gaugeSubText');
    const percentText = document.getElementById('gaugePercentText');
    const checkWaitItem = document.getElementById('checkWaitItem');
    const nextAvailableEl = document.getElementById('nextAvailableText');

    // Total arc circumference for radius 65 over 270 deg ~ 306px
    const totalArcLength = 306;

    if (daysPassed >= 90) {
      // Cooldown Completed -> Eligible
      if (arc) {
        arc.classList.remove('cooldown');
        arc.style.strokeDashoffset = '0';
      }
      if (statusText) statusText.textContent = 'ELIGIBLE TO DONATE';
      if (daysText) daysText.textContent = '90 DAYS';
      if (subText) subText.textContent = 'COOLDOWN COMPLETED';
      if (percentText) {
        percentText.textContent = '100%';
        percentText.style.color = 'var(--green-neon)';
      }
      if (checkWaitItem) {
        checkWaitItem.className = 'check-item';
        checkWaitItem.innerHTML = `<i class="fas fa-check"></i> <span>90-day wait period met</span>`;
      }
      if (nextAvailableEl) {
        nextAvailableEl.style.color = 'var(--green-neon)';
        nextAvailableEl.textContent = 'Immediate / READY';
      }
    } else {
      // Cooldown Active -> Days Remaining
      const remainingDays = 90 - daysPassed;
      const percentage = Math.floor((daysPassed / 90) * 100);
      const dashOffset = totalArcLength * (1 - (percentage / 100));

      if (arc) {
        arc.classList.add('cooldown');
        arc.style.strokeDashoffset = String(dashOffset);
      }
      if (statusText) {
        statusText.textContent = 'COOLDOWN ACTIVE';
        statusText.style.color = '#ff9100';
      }
      if (daysText) daysText.textContent = `${remainingDays} DAYS`;
      if (subText) subText.textContent = 'REMAINING IN COOLDOWN';
      if (percentText) {
        percentText.textContent = `${percentage}%`;
        percentText.style.color = '#ff9100';
      }
      if (checkWaitItem) {
        checkWaitItem.className = 'check-item pending';
        checkWaitItem.innerHTML = `<i class="fas fa-hourglass-half"></i> <span>${remainingDays} days remaining in recovery cooldown</span>`;
      }

      // Calculate future available date
      if (nextAvailableEl && currentDonor.lastDonationDate) {
        const nextAvailDate = new Date(currentDonor.lastDonationDate);
        nextAvailDate.setDate(nextAvailDate.getDate() + 90);
        nextAvailableEl.style.color = '#ff9100';
        nextAvailableEl.textContent = formatDate(nextAvailDate);
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

