/* ============================================================
   RED404 — DONOR HEALTH PROFILE & MEDICAL ELIGIBILITY JS
   Purely Dynamic Vitals Parsing, AI Evaluation & 90-Day Tracker
============================================================ */

(function () {
  'use strict';

  // State
  let currentDonor = {
    id: 1,
    name: 'Ankit Kumar',
    bloodType: 'O-',
    age: 24,
    weight: 72,
    pulse: 72,
    hemoglobin: 14.8,
    bloodPressure: '120/80',
    bodyTemp: 98.6,
    verifiedFacility: 'City General Hospital',
    verifiedDate: '2026-08-05',
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

      // 2. Fetch fresh dynamic profile from API
      const res = await fetch(`/api/donor/profile?donorId=${currentDonor.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          currentDonor.id = d.id || currentDonor.id;
          currentDonor.name = d.name || d.fullName || currentDonor.name;
          currentDonor.bloodType = d.bloodType || d.blood_type || currentDonor.bloodType;
          if (d.weight) currentDonor.weight = parseFloat(d.weight);
          if (d.pulse) currentDonor.pulse = parseInt(d.pulse, 10);
          if (d.hemoglobin) currentDonor.hemoglobin = parseFloat(d.hemoglobin);
          if (d.bloodPressure) currentDonor.bloodPressure = d.bloodPressure;
          if (d.bodyTemp) currentDonor.bodyTemp = parseFloat(d.bodyTemp);
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
  async function loadDonationHistory() {
    try {
      const res = await fetch(`/api/donor/donation-history?donorId=${currentDonor.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          donationHistory = json.data;
        } else if (Array.isArray(json)) {
          donationHistory = json;
        }
      }
    } catch (e) {
      console.warn('Donation history fetch notice:', e);
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
    // 1. Blood Emblem
    const beType = document.getElementById('vitalBloodType');
    const beLabel = document.getElementById('vitalBloodLabel');
    if (beType) beType.textContent = currentDonor.bloodType || 'O-';
    if (beLabel) {
      beLabel.textContent = (currentDonor.bloodType || 'O-').includes('-') ? 'NEGATIVE' : 'POSITIVE';
    }

    // 2. Top Meta (Age | Weight | Pulse)
    const ageEl = document.getElementById('vitalAge');
    const weightEl = document.getElementById('vitalWeight');
    const pulseEl = document.getElementById('vitalPulse');
    if (ageEl) ageEl.textContent = currentDonor.age || 24;
    if (weightEl) weightEl.textContent = currentDonor.weight || 72;
    if (pulseEl) pulseEl.textContent = currentDonor.pulse || 72;

    // 3. Verified facility & date
    const verifiedSub = document.getElementById('vitalsVerifiedSub');
    if (verifiedSub) {
      const formattedDate = formatDate(currentDonor.verifiedDate || '2026-08-05');
      const facility = currentDonor.verifiedFacility || 'City General Hospital';
      verifiedSub.innerHTML = `Verified on ${escapeHtml(formattedDate)} • ${escapeHtml(facility)}`;
    }

    // 4. Metrics & Chips
    const hbVal = document.getElementById('vitalHemoglobin');
    const hbPill = document.getElementById('hbPill');
    if (hbVal) hbVal.textContent = currentDonor.hemoglobin || 14.8;
    if (hbPill) {
      const isHbOk = (currentDonor.hemoglobin || 14.8) >= 12.5;
      hbPill.className = `vital-pill ${isHbOk ? 'pill-normal' : 'pill-alert'}`;
      hbPill.textContent = isHbOk ? 'NORMAL' : 'LOW';
    }

    const bpVal = document.getElementById('vitalBP');
    const bpPill = document.getElementById('bpPill');
    if (bpVal) bpVal.textContent = currentDonor.bloodPressure || '120/80';
    if (bpPill) {
      const isBpOk = isBpNormal(currentDonor.bloodPressure || '120/80');
      bpPill.className = `vital-pill ${isBpOk ? 'pill-normal' : 'pill-alert'}`;
      bpPill.textContent = isBpOk ? 'NORMAL' : 'REVIEW';
    }

    const tempVal = document.getElementById('vitalTemp');
    if (tempVal) tempVal.textContent = currentDonor.bodyTemp || 98.6;

    // 5. Automated AI Health Evaluation Check
    // Condition: (Hemoglobin >= 12.5 && Weight >= 50 && BP within 100/60 to 140/90 && Temp <= 99.0)
    const hasVitals = currentDonor.hemoglobin && currentDonor.weight && currentDonor.bloodPressure;
    const isFit = (
      hasVitals &&
      currentDonor.hemoglobin >= 12.5 &&
      currentDonor.weight >= 50 &&
      isBpNormal(currentDonor.bloodPressure) &&
      (currentDonor.bodyTemp || 98.6) <= 99.0
    );

    const evalBadge = document.getElementById('aiHealthEvalBadge');
    if (evalBadge) {
      if (!hasVitals) {
        evalBadge.className = 'health-eval-badge badge-awaiting';
        evalBadge.innerHTML = `<i class="fas fa-clock"></i><span>Awaiting Hospital Health Verification</span>`;
      } else if (isFit) {
        evalBadge.className = 'health-eval-badge badge-fit';
        evalBadge.innerHTML = `<span class="heb-dot"></span><span>HEALTH STATUS: FIT TO DONATE</span>`;
      } else {
        evalBadge.className = 'health-eval-badge badge-unfit';
        evalBadge.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>HEALTH STATUS: MEDICAL REVIEW REQUIRED</span>`;
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
  function renderDonationHistory() {
    const container = document.getElementById('donationHistoryContainer');
    if (!container) return;

    if (!donationHistory || donationHistory.length === 0) {
      container.innerHTML = `
        <div class="empty-history-state">
          <i class="fas fa-folder-open"></i>
          <p>No verified donations found. Once a hospital logs your completed blood donation, the official record will appear here.</p>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    donationHistory.forEach(item => {
      const refCode = item.id || `RED-${String(item.donationId || 1001).padStart(5, '0')}`;
      const dateStr = formatDate(item.donationDate || item.date);
      const facility = item.hospitalName || item.hospital || 'District Blood Bank';
      const units = item.unitsDonated || `${item.units || 1} Unit`;
      const type = item.donationType || 'Whole Blood';
      const status = item.status || 'COMPLETED';

      rowsHtml += `
        <tr>
          <td class="ht-ref">${escapeHtml(refCode)}</td>
          <td>${escapeHtml(dateStr)}</td>
          <td class="ht-hosp">${escapeHtml(facility)}</td>
          <td>${escapeHtml(units)}</td>
          <td>${escapeHtml(type)}</td>
          <td><span class="status-pill-completed">${escapeHtml(status)}</span></td>
        </tr>
      `;
    });

    container.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Donation ID</th>
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
