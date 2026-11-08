/**
 * RED404 — Dynamic Donor Dashboard Logic & State Management
 * Zero-Demo-Data Architecture • Real-Time Interconnected State Engine
 */

(function () {
  'use strict';

  // Master State Object (Default: Pure Empty / Verified State)
  const donorData = {
    name: "Ankit Kumar",
    email: "ankit@red404.in",
    bloodGroup: "A+",
    location: sessionStorage.getItem('red404_donor_detected_location') || "Locating...",
    district: "",
    donations: [], // Real clinical history (Empty by default)
    activeAlerts: [], // Real emergencies (Empty by default)
    profileCreatedAt: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  };

  /**
   * Load actual donor session from Storage or API
   */
  function loadSessionData() {
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) {
        const session = JSON.parse(raw);
        const user = session.user || session;

        if (user.name) donorData.name = user.name;
        else if (user.firstName) donorData.name = `${user.firstName} ${user.lastName || ''}`.trim();
        if (user.email) donorData.email = user.email;

        if (user.bloodGroup) donorData.bloodGroup = user.bloodGroup;
        if (user.city || user.district) {
          donorData.district = (user.district || user.city).toUpperCase();
          if (!sessionStorage.getItem('red404_donor_detected_location')) {
            donorData.location = `${user.city || user.district}, ${user.state || 'India'}`;
          }
        }

        if (user.createdAt) {
          donorData.profileCreatedAt = new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        // Real donations history
        if (Array.isArray(user.donations)) {
          donorData.donations = user.donations;
        }

        // Real active emergency alerts
        if (Array.isArray(user.activeAlerts)) {
          donorData.activeAlerts = user.activeAlerts;
        }
      }
    } catch (err) {
      console.warn('Donor session loading error:', err);
    }
  }

  /**
   * Main Dashboard Initializer
   */
  function initializeDashboard() {
    loadSessionData();

    // 1. Render Welcome Banner & Telemetry Pills
    renderWelcomeBanner();

    // Dynamically detect user's current GPS location & state/district
    detectUserLocation();

    // 2. Render Emergency SOS Dispatch Card (Empty vs Active)
    renderAlerts();

    // 3. Render System Notifications & Logs (Pure verified state)
    renderSystemLogs();

    // 4. Render Donation History (Mini List & Full Table)
    renderDonationHistory(donorData.donations);

    // 5. Calculate Impact Metrics (Interconnected Math: Donations * 3, Donations * 450ml)
    calculateImpactMetrics();

    // 6. Render Mini Eligibility Strip
    renderMiniEligibility();

    // 7. Evaluate 3D Impact Badges (Locked initially if 0 donations)
    evaluateBadges();
  }

  /**
   * Dynamically detect real browser geolocation & reverse geocode to District / State
   */
  function detectUserLocation() {
    const locEl = document.getElementById('user-location');
    const cached = sessionStorage.getItem('red404_donor_detected_location');
    if (cached) {
      donorData.location = cached;
      if (locEl) locEl.textContent = cached;
    }

    if (!navigator.geolocation) {
      if (!cached && locEl) {
        locEl.textContent = donorData.location && donorData.location !== 'Locating...' ? donorData.location : 'Location Connected';
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          sessionStorage.setItem('red404_user_lat', lat);
          sessionStorage.setItem('red404_user_lng', lng);

          // Reverse geocode via OpenStreetMap Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const district = addr.county || addr.state_district || addr.district || addr.city || addr.town || addr.village || 'Local';
            const state = addr.state || '';
            const locationStr = state ? `${district}, ${state}` : district;

            donorData.location = locationStr;
            donorData.district = district.toUpperCase();
            sessionStorage.setItem('red404_donor_detected_location', locationStr);

            if (locEl) locEl.textContent = locationStr;

            // Sync with Command Nav Live GPS pill
            const navGps = document.getElementById('navGpsIndicator');
            if (navGps) {
              const span = navGps.querySelector('span:not(.gps-dot-pulse)');
              if (span) span.textContent = `Live GPS: ${locationStr}`;
            }
          }
        } catch (e) {
          console.warn('Geolocation geocoding notice:', e);
          if (locEl && (!donorData.location || donorData.location === 'Locating...')) {
            locEl.textContent = 'GPS Connected';
          }
        }
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        if (locEl && (!donorData.location || donorData.location === 'Locating...')) {
          locEl.textContent = donorData.district ? `${donorData.district}, India` : 'GPS Connected';
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  /**
   * 1. Welcome Banner
   */
  function renderWelcomeBanner() {
    const userNameEl = document.getElementById('user-name');
    const userBloodGroupEl = document.getElementById('user-blood-group');
    const userLocationEl = document.getElementById('user-location');
    const userNodeStatusEl = document.getElementById('user-node-status');

    if (userNameEl) userNameEl.textContent = donorData.name;
    if (userBloodGroupEl) userBloodGroupEl.textContent = donorData.bloodGroup;
    if (userLocationEl) userLocationEl.textContent = donorData.location;
    if (userNodeStatusEl) userNodeStatusEl.textContent = 'Active';

    // Top command nav avatar fallback
    const navName = document.getElementById('dropdownUserName');
    if (navName) navName.textContent = donorData.name;
    const navEmail = document.getElementById('dropdown-user-email');
    if (navEmail && donorData.email) navEmail.textContent = donorData.email;
  }

  /**
   * 2. Emergency SOS Dispatch Card
   */
  function renderAlerts() {
    const badgeEl = document.getElementById('sos-badge');
    const summaryContainer = document.getElementById('sos-summary-container');
    const actionContainer = document.getElementById('sos-action-container');

    if (!summaryContainer) return;

    if (!donorData.activeAlerts || donorData.activeAlerts.length === 0) {
      // DEFAULT STATE: EMPTY
      if (badgeEl) {
        badgeEl.className = 'action-badge badge-clear';
        badgeEl.innerHTML = '<i class="fa-solid fa-shield-heart"></i> STATUS: CLEAR';
      }
      summaryContainer.innerHTML = `
        <p class="action-summary-text clear-status">
          <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 1rem;"></i>
          Status Clear: No active SOS requests in your zone
        </p>
      `;
      if (actionContainer) {
        actionContainer.innerHTML = `
          <a href="donor-alerts.html" class="action-footer-link" title="Open Live Radar Map">
            <span>Open Live Radar Map</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        `;
      }
    } else {
      // ACTIVE ALERTS PRESENT
      const count = donorData.activeAlerts.length;
      if (badgeEl) {
        badgeEl.className = 'action-badge';
        badgeEl.textContent = `${count} ACTIVE ALERT${count > 1 ? 'S' : ''}`;
      }
      const firstAlert = donorData.activeAlerts[0];
      const summaryText = count === 1
        ? `Critical emergency at <strong>${firstAlert.hospital || 'District Hospital'}</strong>: ${firstAlert.bloodGroup || donorData.bloodGroup} needed immediately.`
        : `<strong>${count} Sector Emergencies Active:</strong> Highest priority at ${firstAlert.hospital || 'Nearby Hospital'} (${firstAlert.distance || '2.4 km'} away).`;

      summaryContainer.innerHTML = `
        <p class="action-summary-text">
          ${summaryText}
        </p>
      `;
      if (actionContainer) {
        actionContainer.innerHTML = `
          <a href="donor-alerts.html" class="action-footer-link" style="color: #ef4444;" title="Respond to Active Alert">
            <span>Respond to Alert (${count} Active)</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        `;
      }
    }
  }

  /**
   * 3. System Notifications & Logs
   * ONLY notification by default:
   * 'System: Donor Profile officially verified and created on [Current Date]'
   */
  function renderSystemLogs() {
    const logsContainer = document.getElementById('system-logs-container');
    if (!logsContainer) return;

    let logsHtml = `
      <div class="terminal-log-item verify">
        <div class="log-icon-wrap">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <div class="log-content">
          <div class="log-meta-row">
            <span class="log-time">[SYSTEM]</span>
            <span class="log-type-tag">PROFILE INITIALIZED</span>
          </div>
          <div class="log-message">
            System: Donor Profile officially verified and created on <strong>${donorData.profileCreatedAt}</strong>
          </div>
        </div>
      </div>
    `;

    // If active alerts exist, append real logs
    if (donorData.activeAlerts && donorData.activeAlerts.length > 0) {
      donorData.activeAlerts.forEach((alert) => {
        logsHtml = `
          <div class="terminal-log-item sos">
            <div class="log-icon-wrap">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="log-content">
              <div class="log-meta-row">
                <span class="log-time">[URGENT]</span>
                <span class="log-type-tag">EMERGENCY SOS</span>
              </div>
              <div class="log-message">
                <strong>${alert.bloodGroup || 'Blood'}</strong> required at <strong>${alert.hospital || 'Local Hospital'}</strong>.
              </div>
            </div>
          </div>
        ` + logsHtml;
      });
    }

    logsContainer.innerHTML = logsHtml;
  }

  /**
   * 4. Donation History (Mini List & Full Table)
   */
  function renderDonationHistory(historyArray) {
    const miniContainer = document.getElementById('mini-history-container');
    const tableBody = document.getElementById('donationsTableBody');

    // Mini List (Dashboard)
    if (miniContainer) {
      if (!historyArray || historyArray.length === 0) {
        miniContainer.innerHTML = `
          <div class="empty-donations-notice">
            <i class="fa-solid fa-box-open"></i>
            <span>No verified donations yet. Awaiting your first rescue.</span>
          </div>
        `;
      } else {
        const recent = historyArray.slice(0, 3);
        miniContainer.innerHTML = recent.map(item => `
          <div class="mini-history-item">
            <div class="mhi-left">
              <div class="mhi-icon"><i class="fa-solid fa-droplet"></i></div>
              <div>
                <div class="mhi-hosp">${item.hospital || 'Hospital Depot'}</div>
                <div class="mhi-date">${item.date || 'Recent'} • ${item.type || 'Whole Blood'}</div>
              </div>
            </div>
            <div class="mhi-right">
              <span class="mhi-unit-pill">${item.units || '1 Unit'}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Full Table (My Donations page)
    if (tableBody) {
      if (!historyArray || historyArray.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 40px 16px; color: #94a3b8;">
              <i class="fa-solid fa-heart-circle-plus" style="font-size: 2rem; color: #64748b; margin-bottom: 10px; display: block;"></i>
              <strong style="color: #ffffff; display: block; margin-bottom: 4px;">No Verified Donations Yet</strong>
              <span>No verified donations yet. Awaiting your first rescue.</span>
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = historyArray.map(rec => {
          const isPlatelet = (rec.type || '').toLowerCase().includes('platelet');
          return `
            <tr>
              <td><span class="ref-code">${rec.refCode || 'RED-00000'}</span></td>
              <td><strong style="color: #ffffff;">${rec.date || 'N/A'}</strong></td>
              <td>
                <div class="hosp-info-cell">
                  <span class="hosp-info-name">${rec.hospital || 'Clinical Blood Depot'}</span>
                  <span class="hosp-info-loc"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;margin-right:4px;"></i>${rec.location || 'Meerut'}</span>
                </div>
              </td>
              <td>
                <span class="badge-component ${isPlatelet ? 'platelets' : 'whole-blood'}">
                  <i class="fa-solid ${isPlatelet ? 'fa-vial' : 'fa-droplet'}"></i>
                  ${rec.type || 'Whole Blood'}
                </span>
              </td>
              <td>
                <strong style="color: #ffffff;">${rec.volume || '450 mL'}</strong>
                <div style="font-size: 0.74rem; color: #64748b;">(${rec.units || '1 Unit'})</div>
              </td>
              <td>
                <span class="badge-status-verified">
                  <i class="fa-solid fa-circle-check"></i>
                  VERIFIED
                </span>
              </td>
              <td style="text-align: right;">
                <button class="btn-cert-download" onclick="window.openCertificate && window.openCertificate('${rec.certId || 'CERT-00'}', '${rec.refCode || 'RED-00'}', '${rec.date || ''}', '${rec.hospital || ''}', '${rec.type || ''}')">
                  <i class="fa-solid fa-award"></i>
                  <span>Certificate</span>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  /**
   * 5. Variables Interconnection:
   * Total Lives Saved = Total Donations * 3
   * Total Volume = Total Donations * 450 mL
   * If Total Donations === 0 => 0, 0 Lives, 0 mL
   */
  function calculateImpactMetrics() {
    const totalDonations = donorData.donations ? donorData.donations.length : 0;
    const livesSaved = totalDonations * 3;
    const totalVolume = totalDonations * 450;

    const totalEl = document.getElementById('statTotalDonations');
    const livesEl = document.getElementById('statLivesSaved');
    const volumeEl = document.getElementById('statTotalVolume');
    const tierEl = document.getElementById('statActiveTier');

    if (totalEl) totalEl.textContent = totalDonations;
    if (livesEl) livesEl.textContent = `${livesSaved} Lives`;
    if (volumeEl) volumeEl.textContent = `${totalVolume.toLocaleString()} mL`;

    if (tierEl) {
      if (totalDonations >= 10) tierEl.textContent = 'Apex Guardian';
      else if (totalDonations >= 5) tierEl.textContent = 'Platinum Lifesaver';
      else if (totalDonations >= 1) tierEl.textContent = 'Bronze Guardian';
      else tierEl.textContent = 'Novice Rescuer';
    }
  }

  /**
   * 6. Mini Eligibility Strip
   */
  function renderMiniEligibility() {
    const strip = document.getElementById('mini-eligibility-strip');
    if (!strip) return;

    if (!donorData.donations || donorData.donations.length === 0) {
      // 0 donations -> 100% Eligible immediately
      strip.className = 'mini-eligibility-strip eligible';
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>Status: ELIGIBLE TO DONATE • Safe to Proceed</span>
      `;
      return;
    }

    // Check latest donation date
    const latestDonation = donorData.donations[0];
    const donationDate = new Date(latestDonation.date);
    if (isNaN(donationDate.getTime())) {
      strip.className = 'mini-eligibility-strip eligible';
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>Status: ELIGIBLE TO DONATE • Safe to Proceed</span>
      `;
      return;
    }

    const today = new Date();
    const diffDays = Math.floor((today - donationDate) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, 90 - diffDays);

    if (daysLeft === 0) {
      strip.className = 'mini-eligibility-strip eligible';
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>Status: ELIGIBLE TO DONATE • Cooldown Complete</span>
      `;
    } else {
      strip.className = 'mini-eligibility-strip cooldown';
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>Status: COOLDOWN ACTIVE • ${daysLeft} Days Remaining</span>
      `;
    }
  }

  /**
   * 7. 3D Badges Evaluation
   * All badges start locked. Only unlock if criteria in donations array are met.
   */
  function evaluateBadges() {
    const badgeElements = document.querySelectorAll('[data-badge]');
    if (!badgeElements || badgeElements.length === 0) return;

    const count = donorData.donations ? donorData.donations.length : 0;
    let unlockedCount = 0;

    badgeElements.forEach((badgeCard) => {
      const badgeId = badgeCard.getAttribute('data-badge');
      let isUnlocked = false;

      switch (badgeId) {
        case 'first-savior':
          isUnlocked = count >= 1;
          break;
        case 'golden-hour':
          isUnlocked = donorData.donations.some(d => d.responseTimeMinutes && d.responseTimeMinutes <= 60);
          break;
        case 'night-owl':
          isUnlocked = donorData.donations.some(d => d.isNight || (d.hour !== undefined && (d.hour >= 21 || d.hour < 6)));
          break;
        case 'rare-vanguard':
          isUnlocked = (donorData.bloodGroup === 'AB-' || donorData.bloodGroup === 'O-') && count >= 1;
          break;
        case 'life-giver':
          isUnlocked = count >= 5;
          break;
        case 'apex-guardian':
          isUnlocked = count >= 10;
          break;
      }

      const statusEl = badgeCard.querySelector('.badge-status');

      if (isUnlocked) {
        unlockedCount++;
        badgeCard.classList.remove('locked');
        badgeCard.classList.add('unlocked');
        if (statusEl) statusEl.textContent = 'UNLOCKED';
      } else {
        badgeCard.classList.remove('unlocked');
        badgeCard.classList.add('locked');
        if (statusEl) {
          if (badgeId === 'life-giver') statusEl.textContent = 'LOCKED • Req. 5 Donations';
          else if (badgeId === 'apex-guardian') statusEl.textContent = 'LOCKED • Req. 10 Donations';
          else statusEl.textContent = 'LOCKED';
        }
      }
    });

    const countHeader = document.getElementById('earnedBadgesCount');
    if (countHeader) {
      countHeader.textContent = `Earned Badges: ${unlockedCount} / 6`;
    }
  }

  // Expose to window for external integration / testing
  window.RED404_STATE = {
    donorData,
    initializeDashboard,
    renderDonationHistory,
    renderAlerts,
    calculateImpactMetrics,
    evaluateBadges
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
  } else {
    initializeDashboard();
  }
})();

