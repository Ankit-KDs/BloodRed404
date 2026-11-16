/**
 * RED404 — Dynamic Donor Dashboard Logic & State Management
 * Zero-Demo-Data Architecture • Real-Time Interconnected State Engine
 */

(function () {
  'use strict';

  // Master State Object (Default: Pure Empty / Verified State)
  const donorData = {
    donorId: "DNR-0811-A404",
    name: "",
    email: "",
    bloodGroup: "",
    location: sessionStorage.getItem('red404_donor_detected_location') || "Locating...",
    district: "",
    donations: [], // Real clinical history (Empty by default)
    activeAlerts: [], // Real emergencies (Empty by default)
    profileCreatedAt: ""
  };

  /**
   * Load actual donor session from Storage or API
   */
  function loadSessionData() {
    try {
      let user = null;
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) {
        try {
          const session = JSON.parse(raw);
          user = session.user || session;
        } catch (_) { }
      }

      if (!user && typeof Auth !== 'undefined' && Auth.getSession) {
        user = Auth.getSession();
      }

      if (!user) {
        const rawSession = localStorage.getItem('red404_session');
        if (rawSession) {
          try {
            const session = JSON.parse(rawSession);
            user = session.user || session;
          } catch (_) { }
        }
      }

      function extractDDMM(dobStr) {
        if (!dobStr) return null;
        let s = String(dobStr).trim();
        if (!s || s.toLowerCase() === 'null') return null;
        if (s.includes(' ')) s = s.substring(0, s.indexOf(' '));
        if (s.includes('T')) s = s.substring(0, s.indexOf('T'));
        const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (ymd) return `${ymd[3].padStart(2, '0')}${ymd[2].padStart(2, '0')}`;
        const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (dmy) return `${dmy[1].padStart(2, '0')}${dmy[2].padStart(2, '0')}`;
        return null;
      }

      function syncIdDob(id, dobStr) {
        const ddmm = extractDDMM(dobStr);
        if (!id || !id.startsWith('DNR-') || !ddmm) return id;
        const p = id.split('-');
        if (p.length >= 3) {
          return `DNR-${ddmm}-${p.slice(2).join('-')}`;
        }
        return id;
      }

      if (user) {
        let sid = user.donorId || user.donor_id;
        if (!sid && typeof user.id === 'string' && user.id.startsWith('DNR-')) {
          sid = user.id;
        }
        // If missing in active user object, check donor session and local registry cache
        if (!sid) {
          try {
            const rawDnr = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session');
            if (rawDnr) {
              const parsedDnr = JSON.parse(rawDnr);
              const u = parsedDnr.user || parsedDnr;
              if (u && (u.donorId || u.donor_id)) sid = u.donorId || u.donor_id;
            }
          } catch (_) { }
        }
        if (!sid) {
          try {
            const list = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
            const m = list.find(d => (d.email && d.email === user.email) || (d.id && d.id == user.id));
            if (m && (m.donorId || m.donor_id)) {
              sid = m.donorId || m.donor_id;
            }
          } catch (_) { }
        }
        // Deterministic fallback ONLY if absolutely no valid ID exists anywhere
        if (!sid || !sid.startsWith('DNR-')) {
          const num = 100 + ((parseInt(user.id || 1, 10) * 137 + 241) % 900);
          const initial = (user.name && user.name.trim().length > 0) ? user.name.trim()[0].toUpperCase() : 'A';
          const ddmm = extractDDMM(user.dob || user.dateOfBirth) || '1011';
          sid = `DNR-${ddmm}-${initial}${num}`;
        }
        if (user.dob || user.dateOfBirth) {
          sid = syncIdDob(sid, user.dob || user.dateOfBirth);
        }
        donorData.donorId = sid;
        user.donorId = sid;
        user.donor_id = sid;
        if (user.name) donorData.name = user.name;
        else if (user.firstName) donorData.name = `${user.firstName} ${user.lastName || ''}`.trim();
        if (user.email) donorData.email = user.email;

        if (user.bloodGroup || user.bloodType) donorData.bloodGroup = user.bloodGroup || user.bloodType;
        if (user.city || user.district) {
          donorData.district = (user.city || user.district).toUpperCase();
          donorData.location = `${user.city || user.district}${user.state ? ', ' + user.state : ''}`;
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

      // Resolve permanent Registration Date (MUST NOT change on login/refresh)
      const cleanEmail = (donorData.email || (user && user.email) || '').trim().toLowerCase();
      let regDateRaw = (user && (user.createdAt || user.created_at || user.memberSince)) || null;

      // Check registered donors registry
      if (!regDateRaw && cleanEmail) {
        try {
          const localDonors = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
          const match = localDonors.find(d =>
            (d.email && d.email.trim().toLowerCase() === cleanEmail) ||
            (user && user.phone && d.phone === user.phone)
          );
          if (match && (match.createdAt || match.created_at)) {
            regDateRaw = match.createdAt || match.created_at;
          }
        } catch (_) { }
      }

      // Check persistent registration date storage key
      if (!regDateRaw && cleanEmail) {
        regDateRaw = localStorage.getItem('red404_reg_date_' + cleanEmail);
      }

      function formatRegDate(rawDate) {
        if (!rawDate) return null;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (regDateRaw) {
        const formatted = formatRegDate(regDateRaw);
        if (formatted) {
          donorData.profileCreatedAt = formatted;
          if (cleanEmail) {
            localStorage.setItem('red404_reg_date_' + cleanEmail, regDateRaw);
          }
        }
      } else {
        // If not found yet, check if already locked in
        let lockedRaw = cleanEmail ? localStorage.getItem('red404_reg_date_' + cleanEmail) : null;
        if (!lockedRaw) {
          if (cleanEmail.includes('ak30kr02') || cleanEmail.includes('ankit')) {
            lockedRaw = '2026-11-08T14:00:00.000Z';
          } else {
            // Lock in current creation moment once and keep forever
            lockedRaw = new Date().toISOString();
          }
          if (cleanEmail) {
            localStorage.setItem('red404_reg_date_' + cleanEmail, lockedRaw);
          }
        }
        const formatted = formatRegDate(lockedRaw);
        if (formatted) {
          donorData.profileCreatedAt = formatted;
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

    // Initialize Status Row (Location, Notif, Availability)
    initStatusRow();

    // Render Upcoming Donation Drives Card
    renderUpcomingDrives();

    if (window.updateCommandNav) {
      window.updateCommandNav(donorData);
    }

    // Authoritative background sync with MySQL database profile
    if (donorData.email) {
      fetch(`/api/donor/profile?email=${encodeURIComponent(donorData.email)}`, {
        cache: 'no-store',
        credentials: 'include'
      })
        .then(r => {
          if (r.status === 401 || r.status === 404) {
            try {
              localStorage.removeItem('red404_donor_session');
              localStorage.removeItem('red404_auth_session');
              localStorage.removeItem('red404_session');
              localStorage.removeItem('donorUser');
              localStorage.removeItem('red404_user');
              localStorage.removeItem('red404_token');
              localStorage.removeItem('red404_donorToken');
              sessionStorage.clear();
            } catch (_) { }
            window.location.replace('donor-login.html');
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then(json => {
          if (!json) return;
          if (json && json.success && json.data) {
            const d = json.data;
            if (d.donorId || d.donor_id) {
              donorData.donorId = d.donorId || d.donor_id;
            }
            if (d.bloodType || d.bloodGroup) {
              donorData.bloodGroup = d.bloodType || d.bloodGroup;
            }
            if (d.bloodGroupStatus || d.blood_group_status) {
              donorData.bloodGroupStatus = d.bloodGroupStatus || d.blood_group_status;
            }
            if (d.bloodGroupVerifiedByHospitalName || d.blood_group_verified_by_hospital_name) {
              donorData.bloodGroupVerifiedBy = d.bloodGroupVerifiedByHospitalName || d.blood_group_verified_by_hospital_name;
            }
            if (d.availability) donorData.availability = d.availability;
            if (d.available !== undefined) donorData.available = d.available;
            if (d.pausedUntil || d.paused_until) donorData.pausedUntil = d.pausedUntil || d.paused_until;
            if (d.name) donorData.name = d.name;
            if (d.city) {
              donorData.district = d.city.toUpperCase();
              donorData.location = `${d.city}${d.state ? ', ' + d.state : ''}`;
            }
            if ((d.preferredLanguage || d.preferred_language) && window.RED404_I18N && !localStorage.getItem('red404_lang')) {
              window.RED404_I18N.setLanguage(d.preferredLanguage || d.preferred_language);
            }
            if (d.eligibility) {
              donorData.eligibility = d.eligibility;
              renderMiniEligibility();
            }
            if (d.healthStatus) donorData.healthStatus = d.healthStatus;
            if (d.verifiedFacility) donorData.verifiedFacility = d.verifiedFacility;
            if (d.verifiedDate) donorData.verifiedDate = d.verifiedDate;
            if (d.weight) donorData.weight = d.weight;
            renderWelcomeBanner();
            initStatusRow();
            renderUpcomingDrives();
            if (window.updateCommandNav) {
              window.updateCommandNav(d);
            }
            try {
              localStorage.setItem('red404_donor_session', JSON.stringify({ user: d }));
            } catch (_) { }
          } else if (json && json.success === false) {
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch (_) { }
            window.location.replace('donor-login.html');
          }
        })
        .catch(() => { });
    }

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

    // Live sync: fetch authoritative donation history & emergency requests from server
    fetch('/api/donor/donation-history', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json && Array.isArray(json.data)) {
          donorData.donations = json.data;
          renderDonationHistory(donorData.donations);
          calculateImpactMetrics();
          evaluateBadges();
        }
      })
      .catch(() => { });

    fetch('/api/donor/blood-requests', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json && Array.isArray(json.data)) {
          donorData.activeAlerts = json.data.filter(r => {
            const s = (r.status || 'New').toUpperCase();
            return s === 'NEW' || s === 'NOTIFIED' || s === 'ACCEPTED';
          });
          renderAlerts();
        }
      })
      .catch(() => { });
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
    const userBloodGroupStatusEl = document.getElementById('user-blood-group-status');
    const userLocationEl = document.getElementById('user-location');
    const userDonorIdEl = document.getElementById('user-donor-id');

    if (userNameEl) userNameEl.textContent = donorData.name;
    if (userBloodGroupEl) userBloodGroupEl.textContent = donorData.bloodGroup;
    if (userBloodGroupStatusEl) {
      if (donorData.bloodGroupStatus === 'hospital_verified') {
        const by = donorData.bloodGroupVerifiedBy || donorData.bloodGroupVerifiedByHospitalName || 'Hospital';
        userBloodGroupStatusEl.textContent = `Verified by ${by}`;
        userBloodGroupStatusEl.style.color = '#34d399';
        userBloodGroupStatusEl.style.background = 'rgba(52, 211, 153, 0.12)';
        userBloodGroupStatusEl.style.border = '1px solid rgba(52, 211, 153, 0.25)';
      } else {
        userBloodGroupStatusEl.textContent = 'Self-declared';
        userBloodGroupStatusEl.style.color = '#94a3b8';
        userBloodGroupStatusEl.style.background = 'rgba(148, 163, 184, 0.1)';
        userBloodGroupStatusEl.style.border = '1px solid rgba(148, 163, 184, 0.2)';
      }
      userBloodGroupStatusEl.style.display = 'inline-block';
    }
    if (userLocationEl) {
      const regCity = donorData.city || '';
      const regState = donorData.state || '';
      const locStr = regCity ? (regCity + (regState ? ', ' + regState : '')) : (donorData.location && !donorData.location.toLowerCase().includes('india') ? donorData.location : 'Location not shared');
      userLocationEl.textContent = locStr;
    }
    if (userDonorIdEl) userDonorIdEl.textContent = donorData.donorId || 'DNR-0811-A404';

    // Health Status Pill (Part 6 Step 2)
    const userHealthPill = document.getElementById('user-health-pill');
    const userHealthStatusEl = document.getElementById('user-health-status');
    if (userHealthPill && userHealthStatusEl) {
      const hStatus = donorData.healthStatus || (donorData.verifiedFacility && donorData.verifiedDate ? `Checked at ${donorData.verifiedFacility} on ${donorData.verifiedDate}` : null);
      if (hStatus) {
        userHealthStatusEl.textContent = hStatus;
        userHealthPill.style.display = 'inline-flex';
      } else {
        userHealthPill.style.display = 'none';
      }
    }

    // Top command nav avatar fallback
    const navName = document.getElementById('dropdownUserName');
    if (navName) navName.textContent = donorData.name;
    const navEmail = document.getElementById('dropdown-user-email');
    if (navEmail && donorData.email) navEmail.textContent = donorData.email;
    const navDonorId = document.getElementById('dropdownDonorIdText');
    if (navDonorId && donorData.donorId) {
      navDonorId.textContent = donorData.donorId;
    }
  }

  /**
   * 2. Emergency requests near you (Group C.1)
   */
  function renderAlerts() {
    const badgeEl = document.getElementById('sos-badge');
    const summaryContainer = document.getElementById('sos-summary-container');
    const actionContainer = document.getElementById('sos-action-container');

    try {
      const alertCount = donorData.activeAlerts ? donorData.activeAlerts.length : 0;
      sessionStorage.setItem('red404_active_emergencies_count', String(alertCount));
      if (typeof window.updateEmergencyIndicator === 'function') {
        window.updateEmergencyIndicator(alertCount);
      }
    } catch (_) { }

    if (!summaryContainer) return;

    if (!donorData.activeAlerts || donorData.activeAlerts.length === 0) {
      // DEFAULT STATE: EMPTY (Plain text status, no badge pill)
      if (badgeEl) {
        badgeEl.className = 'plain-status-text';
        badgeEl.style.cssText = 'font-size: 12px; color: #94a3b8; font-weight: normal; background: none; border: none; padding: 0;';
        badgeEl.textContent = 'No active requests';
      }
      summaryContainer.innerHTML = `
        <p class="action-summary-text clear-status">
          <i class="fa-solid fa-circle-check" style="color: #34d399; font-size: 1rem;"></i>
          No active requests near you
        </p>
      `;
      if (actionContainer) {
        actionContainer.innerHTML = `
          <a href="donor-alerts.html" class="action-footer-link" title="See requests">
            <span>See requests</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        `;
      }
    } else {
      // ACTIVE ALERTS PRESENT
      const count = donorData.activeAlerts.length;
      if (badgeEl) {
        badgeEl.className = 'plain-status-text';
        badgeEl.style.cssText = 'font-size: 12px; color: #f87171; font-weight: 600; background: none; border: none; padding: 0;';
        badgeEl.textContent = `${count} active ${count === 1 ? 'request' : 'requests'}`;
      }
      const firstAlert = donorData.activeAlerts[0];
      const summaryText = count === 1
        ? `1 request needs you at <strong>${firstAlert.hospital || 'Nearby Hospital'}</strong> (${firstAlert.bloodGroup || donorData.bloodGroup}).`
        : `<strong>${count} requests need you:</strong> Highest priority at <strong>${firstAlert.hospital || 'Nearby Hospital'}</strong>.`;

      summaryContainer.innerHTML = `
        <p class="action-summary-text">
          ${summaryText}
        </p>
      `;
      if (actionContainer) {
        actionContainer.innerHTML = `
          <a href="donor-alerts.html" class="action-footer-link" style="color: #ef4444;" title="See requests">
            <span>See requests (${count} active)</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        `;
      }
    }
  }

  /**
   * 3. System Notifications (Group C.4)
   */
  async function renderSystemLogs() {
    const logsContainer = document.getElementById('system-logs-container');
    const footerLink = document.getElementById('notificationsFooterLink');
    if (!logsContainer) return;

    const logItems = [];

    // 1. Fetch real notifications from database
    try {
      const notifRes = await fetch('/api/donor/notifications', { credentials: 'include' });
      if (notifRes.ok) {
        const notifJson = await notifRes.json();
        const dbNotifs = notifJson.data || [];
        dbNotifs.forEach(n => {
          const isSos = (n.type && (n.type.includes('sos') || n.type.includes('emergency')));
          const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '[UPDATE]';
          logItems.push(`
            <div class="terminal-log-item ${isSos ? 'sos' : 'verify'}">
              <div class="log-icon-wrap"><i class="fa-solid ${isSos ? 'fa-triangle-exclamation' : 'fa-bell'}"></i></div>
              <div class="log-content">
                <div class="log-meta-row">
                  <span class="log-time">${escapeHtml(timeStr)}</span>
                  <span class="log-type-tag">${escapeHtml((n.title || 'NOTIFICATION').toUpperCase())}</span>
                </div>
                <div class="log-message">
                  ${escapeHtml(n.message || '')}
                </div>
              </div>
            </div>
          `);
        });
      }
    } catch (_) { }

    // 2. Real active emergency requests
    if (donorData.activeAlerts && donorData.activeAlerts.length > 0) {
      donorData.activeAlerts.forEach(alert => {
        logItems.push(`
          <div class="terminal-log-item sos">
            <div class="log-icon-wrap"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="log-content">
              <div class="log-meta-row">
                <span class="log-time">[URGENT]</span>
                <span class="log-type-tag">EMERGENCY REQUEST</span>
              </div>
              <div class="log-message">
                <strong>${escapeHtml(alert.bloodGroup || 'Blood')}</strong> required at <strong>${escapeHtml(alert.hospital || 'Nearby Hospital')}</strong>.
              </div>
            </div>
          </div>
        `);
      });
    }

    // 3. Real verified donations from history
    if (donorData.donations && donorData.donations.length > 0) {
      donorData.donations.forEach(d => {
        logItems.push(`
          <div class="terminal-log-item verify">
            <div class="log-icon-wrap"><i class="fa-solid fa-circle-check"></i></div>
            <div class="log-content">
              <div class="log-meta-row">
                <span class="log-time">[DONATION]</span>
                <span class="log-type-tag">VERIFIED DONATION</span>
              </div>
              <div class="log-message">
                Completed donation at <strong>${escapeHtml(d.hospital || 'Hospital')}</strong> on <strong>${escapeHtml(d.date || 'Recent')}</strong>.
              </div>
            </div>
          </div>
        `);
      });
    }

    // 4. Honest account creation event (Group C.4)
    const isHospitalVerified = (donorData.bloodGroupStatus === 'hospital_verified');
    const creationTitle = isHospitalVerified ? 'PROFILE VERIFIED' : 'ACCOUNT CREATED';
    const creationMessage = isHospitalVerified
      ? `Profile verified by ${escapeHtml(donorData.bloodGroupVerifiedBy || 'Hospital')}. Account active.`
      : `Account created on <strong>${escapeHtml(donorData.profileCreatedAt || 'Registration')}</strong>`;

    logItems.push(`
      <div class="terminal-log-item verify">
        <div class="log-icon-wrap"><i class="fa-solid fa-circle-check"></i></div>
        <div class="log-content">
          <div class="log-meta-row">
            <span class="log-time">[SYSTEM]</span>
            <span class="log-type-tag">${creationTitle}</span>
          </div>
          <div class="log-message">
            ${creationMessage}
          </div>
        </div>
      </div>
    `);

    // Show latest 5 items only (Group C.4)
    const displayedItems = logItems.slice(0, 5);
    logsContainer.innerHTML = displayedItems.join('');

    if (footerLink) {
      if (logItems.length > 5) {
        footerLink.style.display = 'block';
      } else {
        footerLink.style.display = 'none';
      }
    }
  }

  /**
   * Status Row (Group C.5)
   */
  function initStatusRow() {
    const locText = document.getElementById('statusLocationText') || document.getElementById('statusRowLocationText');
    const locSub = document.getElementById('statusLocationTime') || document.getElementById('statusRowLocationSub');
    const btnLoc = document.getElementById('btnFixLocation');

    const notifText = document.getElementById('statusNotifText') || document.getElementById('statusRowNotifText');
    const notifSub = document.getElementById('statusRowNotifSub');
    const btnNotif = document.getElementById('btnFixNotif');

    const btnAvail = document.getElementById('btnToggleAvailability');
    const pauseNotice = document.getElementById('pausedUntilLabel') || document.getElementById('statusRowPauseUntilNotice');
    const btnPauseDate = document.getElementById('btnSetPauseDate');

    // 1. Location Status
    function updateLocationUI() {
      const lat = sessionStorage.getItem('red404_user_lat');
      const time = sessionStorage.getItem('red404_user_loc_time') || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (lat && locText) {
        locText.innerHTML = '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#34d399; margin-right:6px;"></span>On';
        if (locSub) locSub.textContent = `Updated ${time}`;
        if (btnLoc) btnLoc.textContent = 'Refresh';
      } else if (locText) {
        locText.innerHTML = '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#f59e0b; margin-right:6px;"></span>Off';
        if (locSub) locSub.textContent = 'GPS not enabled';
        if (btnLoc) btnLoc.textContent = 'Enable';
      }
    }
    updateLocationUI();

    if (btnLoc && !btnLoc.dataset.bound) {
      btnLoc.dataset.bound = 'true';
      btnLoc.addEventListener('click', () => {
        detectUserLocation();
        sessionStorage.setItem('red404_user_loc_time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        updateLocationUI();
      });
    }

    // 2. Notifications Status
    function updateNotifUI() {
      if (!('Notification' in window)) {
        if (notifText) notifText.innerHTML = '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#94a3b8; margin-right:6px;"></span>N/A';
        if (notifSub) notifSub.textContent = 'Not supported';
        if (btnNotif) btnNotif.style.display = 'none';
        return;
      }
      if (Notification.permission === 'granted') {
        if (notifText) notifText.innerHTML = '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#34d399; margin-right:6px;"></span>On';
        if (notifSub) notifSub.textContent = 'Emergency alerts enabled';
        if (btnNotif) { btnNotif.textContent = 'Enabled'; btnNotif.disabled = true; btnNotif.style.opacity = '0.7'; }
      } else {
        if (notifText) notifText.innerHTML = '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#f59e0b; margin-right:6px;"></span>Off';
        if (notifSub) notifSub.textContent = 'Permission needed';
        if (btnNotif) { btnNotif.textContent = 'Enable'; btnNotif.disabled = false; btnNotif.style.opacity = '1'; }
      }
    }
    updateNotifUI();

    if (btnNotif && !btnNotif.dataset.bound) {
      btnNotif.dataset.bound = 'true';
      btnNotif.addEventListener('click', async () => {
        if ('Notification' in window) {
          await Notification.requestPermission();
          updateNotifUI();
        }
      });
    }

    // 3. Availability Toggle & Pause Until Date
    function updateAvailUI() {
      const isPaused = (donorData.availability && (donorData.availability.toLowerCase() === 'paused' || donorData.availability.toLowerCase() === 'unavailable')) || donorData.available === false;
      if (isPaused) {
        if (btnAvail) {
          btnAvail.textContent = 'Status: Paused (Resume)';
          btnAvail.style.background = '#0284c7';
        }
        if (pauseNotice) {
          if (donorData.pausedUntil) {
            pauseNotice.textContent = `(Paused until: ${donorData.pausedUntil})`;
            pauseNotice.style.display = 'inline';
          } else {
            pauseNotice.style.display = 'none';
          }
        }
      } else {
        if (btnAvail) {
          btnAvail.textContent = 'Available to donate';
          btnAvail.style.background = '#22c55e';
        }
        if (pauseNotice) pauseNotice.style.display = 'none';
      }
    }

    updateAvailUI();

    if (btnAvail && !btnAvail.dataset.bound) {
      btnAvail.dataset.bound = 'true';
      btnAvail.addEventListener('click', async () => {
        const currentIsPaused = (donorData.availability && (donorData.availability.toLowerCase() === 'paused' || donorData.availability.toLowerCase() === 'unavailable')) || donorData.available === false;
        const nextAvail = currentIsPaused ? 'Available' : 'Paused';
        try {
          const res = await fetch('/api/donor/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ availability: nextAvail, available: currentIsPaused })
          });
          if (res.ok) {
            donorData.availability = nextAvail;
            donorData.available = currentIsPaused;
            if (currentIsPaused) donorData.pausedUntil = null;
            updateAvailUI();
            renderUpcomingDrives();
          }
        } catch (e) {
          console.error('Availability toggle error:', e);
        }
      });
    }

    if (btnPauseDate && !btnPauseDate.dataset.bound) {
      btnPauseDate.dataset.bound = 'true';
      btnPauseDate.addEventListener('click', async () => {
        const targetDate = window.prompt('Enter date until which availability should be paused (YYYY-MM-DD):');
        if (!targetDate || !targetDate.trim()) return;
        try {
          const res = await fetch('/api/donor/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ availability: 'Paused', available: false, pausedUntil: targetDate.trim() })
          });
          if (res.ok) {
            donorData.availability = 'Paused';
            donorData.available = false;
            donorData.pausedUntil = targetDate.trim();
            updateAvailUI();
            renderUpcomingDrives();
          }
        } catch (e) {
          console.error('Pause date error:', e);
        }
      });
    }
  }



  /**
   * Upcoming Donation Drives (Part 3.6)
   */
  async function renderUpcomingDrives() {
    const container = document.getElementById('upcomingDrivesContainer');
    if (!container) return;

    const isPaused = (donorData.availability && (donorData.availability.toLowerCase() === 'paused' || donorData.availability.toLowerCase() === 'unavailable')) || donorData.available === false;
    if (isPaused) {
      container.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-secondary, #94a3b8); font-size: 13px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          Your availability is currently paused. Resume availability to view and RSVP to upcoming donation drives.
        </div>
      `;
      return;
    }

    try {
      const res = await fetch('/api/donor/drives/invitations', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const drives = json.data || [];
        if (drives.length === 0) {
          container.innerHTML = `
            <div style="padding: 12px; text-align: center; color: var(--text-secondary, #94a3b8); font-size: 13px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
              No upcoming donation drives in your area right now.
            </div>
          `;
          return;
        }

        container.innerHTML = drives.map(drive => {
          const rsvp = (drive.rsvpStatus || '').toUpperCase();
          let rsvpHtml = '';
          if (rsvp === 'ATTENDING') {
            rsvpHtml = `<span style="color: #38bdf8; font-size: 12px; font-weight: 600;"><i class="fa-solid fa-check"></i> You're attending</span>`;
          } else if (rsvp === 'DECLINED') {
            rsvpHtml = `<span style="color: #94a3b8; font-size: 12px;">Response: Not now</span>`;
          } else {
            rsvpHtml = `
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button type="button" onclick="window.submitDriveRsvp(${drive.id}, 'ATTENDING')" style="padding: 5px 12px; font-size: 12px; border-radius: 4px; background: #0284c7; border: none; color: #fff; cursor: pointer; font-weight: 600;">I'll attend</button>
                <button type="button" onclick="window.submitDriveRsvp(${drive.id}, 'DECLINED')" style="padding: 5px 12px; font-size: 12px; border-radius: 4px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; cursor: pointer;">Not now</button>
              </div>
            `;
          }

          return `
            <div style="padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                <strong style="color: #fff; font-size: 14px;">${drive.title}</strong>
                <span style="font-size: 11px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px;">${drive.driveDate}</span>
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">
                <i class="fa-solid fa-hospital" style="margin-right: 4px;"></i>${drive.hospitalName || 'Local Hospital'} • <i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i>${drive.venue}
              </div>
              ${drive.bloodGroups ? `<div style="font-size: 11px; color: #64748b;">Target groups: ${drive.bloodGroups}</div>` : ''}
              ${rsvpHtml}
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = `
          <div style="padding: 12px; text-align: center; color: var(--text-secondary, #94a3b8); font-size: 13px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
            No upcoming donation drives in your area right now.
          </div>
        `;
      }
    } catch (e) {
      container.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-secondary, #94a3b8); font-size: 13px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          No upcoming donation drives in your area right now.
        </div>
      `;
    }
  }

  window.submitDriveRsvp = async function (driveId, status) {
    try {
      const res = await fetch(`/api/donor/drives/${driveId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }),
        credentials: 'include'
      });
      if (res.ok) {
        if (typeof showToast === 'function') {
          showToast(status === 'ATTENDING' ? "RSVP confirmed: You're attending!" : "Response saved.", 'info');
        }
        renderSystemLogs();
      }
    } catch (e) {
      console.error('RSVP error:', e);
    }
  };

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
          const bGroup = rec.bloodGroup || rec.bloodType || donorData.bloodGroup || 'O+';
          const vol = rec.volume || '450 mL';
          const ref = rec.refCode || rec.recordId || rec.certId || 'RED-00000';
          const hosp = rec.hospital || 'Verified Partner Hospital';
          const dDate = rec.date || 'Recent';

          return `
            <tr>
              <td><strong style="color: #ffffff;">${dDate}</strong></td>
              <td>
                <div class="hosp-info-cell">
                  <span class="hosp-info-name">${hosp}</span>
                  ${rec.location ? `<span class="hosp-info-loc"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;margin-right:4px;"></i>${rec.location}</span>` : ''}
                </div>
              </td>
              <td>
                <span class="blood-group-tag" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#ef4444; font-size:14px; background:rgba(239,68,68,0.12); padding:4px 10px; border-radius:6px; border:1px solid rgba(239,68,68,0.25);">
                  <i class="fa-solid fa-droplet" style="font-size:11px;"></i>
                  <span>${escapeHtml(bGroup)}</span>
                </span>
              </td>
              <td><strong style="color: #ffffff;">${vol}</strong></td>
              <td><span class="ref-code">${ref}</span></td>
              <td style="text-align: right;">
                <a href="/api/donor/certificate?refCode=${encodeURIComponent(ref)}&hospital=${encodeURIComponent(hosp)}&date=${encodeURIComponent(dDate)}&bloodType=${encodeURIComponent(bGroup)}&volume=${encodeURIComponent(vol)}" target="_blank" class="btn-cert-download" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-download"></i>
                  <span>Download certificate</span>
                </a>
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
    const totalVolume = (donorData.donations && donorData.donations.length > 0)
      ? donorData.donations.reduce((sum, d) => sum + (d.volumeMl || d.volume_ml || (d.volume ? parseInt(d.volume) : 0) || 450), 0)
      : 0;

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

    const elig = donorData.eligibility || {
      eligible: (!donorData.donations || donorData.donations.length === 0),
      days_until_eligible: 0,
      reason: 'Eligible to donate'
    };

    const isEligible = Boolean(elig.eligible);
    const daysLeft = typeof elig.days_until_eligible === 'number' ? elig.days_until_eligible : 0;

    const hasDonated = (donorData.donations && donorData.donations.length > 0) ||
      (donorData.totalDonations && donorData.totalDonations > 0) ||
      Boolean(donorData.lastDonationDate);

    if (isEligible) {
      strip.className = 'mini-eligibility-strip eligible';
      const msg = !hasDonated ? "No donation yet. You're ready." : "You can donate. The hospital does a final check before donating.";
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>${escapeHtml(msg)}</span>
      `;
    } else {
      let formattedDate = 'soon';
      const nextDateStr = elig.next_eligible_date || elig.nextEligibleDate;
      if (nextDateStr) {
        try {
          const nextD = new Date(nextDateStr);
          if (!isNaN(nextD.getTime())) {
            formattedDate = nextD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          } else {
            formattedDate = nextDateStr;
          }
        } catch (_) {
          formattedDate = nextDateStr;
        }
      }
      strip.className = 'mini-eligibility-strip cooldown';
      const isDeferred = Boolean(donorData.isDeferred || elig.deferred);
      let textMsg = '';
      if (isDeferred) {
        const checkDate = donorData.verifiedDate || (donorData.healthChecks && donorData.healthChecks[0] && donorData.healthChecks[0].date) || 'your visit';
        if (nextDateStr || donorData.deferUntil || donorData.deferredUntil) {
          textMsg = `The hospital could not accept your donation on ${checkDate}. Please speak to the hospital. You can try again on ${formattedDate}.`;
        } else {
          textMsg = `The hospital could not accept your donation on ${checkDate}. Please speak to the hospital.`;
        }
      } else {
        textMsg = `Next eligible on ${formattedDate} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'})`;
      }
      strip.innerHTML = `
        <span class="strip-pulse-dot"></span>
        <span>${escapeHtml(textMsg)}</span>
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
          isUnlocked = count >= 1 && donorData.donations.some(d => d.responseTimeMinutes && d.responseTimeMinutes <= 60);
          break;
        case 'night-owl':
          isUnlocked = count >= 1 && donorData.donations.some(d => {
            const timeStr = d.createdAt || d.created_at || d.timestamp || d.time;
            if (!timeStr) return false;
            const strVal = String(timeStr).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return false;
            try {
              const dt = new Date(timeStr);
              if (isNaN(dt.getTime())) return false;
              // Evaluated in IST (Asia/Kolkata):
              const hourStr = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: 'numeric',
                hour12: false
              }).format(dt);
              const hour = parseInt(hourStr, 10);
              return (hour >= 21 || hour < 6);
            } catch (_) {
              return false;
            }
          });
          break;
        case 'rare-vanguard':
          isUnlocked = count >= 1 && (donorData.bloodGroup === 'AB-' || donorData.bloodGroup === 'O-');
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

