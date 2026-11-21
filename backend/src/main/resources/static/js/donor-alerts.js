/* ============================================================
   RED404 — DONOR ALERTS & RADAR SCRIPT
   Purely Dynamic Emergency Matching & Haversine Dispatch Engine
============================================================ */

(function () {
  'use strict';

  // Dynamic State Management (Zero hardcoded records)
  let currentDonor = {
    name: 'Donor',
    bloodType: 'O-',
    latitude: 28.3486,
    longitude: 79.5619,
    availability: 'Available',
    medicalStatus: 'Fit to Donate'
  };

  let activeRequests = [];
  let leafletMap = null;
  let currentTileLayer = null;
  let donorMarker = null;
  let hospitalMarker = null;
  let routePolyline = null;
  let activeLayerKey = localStorage.getItem('red404_map_layer') || 'dark';
  if (activeLayerKey === 'google-dark') activeLayerKey = 'dark';
  if (activeLayerKey === 'google-roads' || activeLayerKey === 'osm') activeLayerKey = 'map';

  // DOM Elements
  const donorGreetingName = document.getElementById('donorGreetingName');
  const gpsCoordsText = document.getElementById('gpsCoordsText');
  const gpsSyncBtn = document.getElementById('gpsSyncBtn');
  const donorStatusToggle = document.getElementById('donorStatusToggle');
  const donorStatusText = document.getElementById('donorStatusText');
  const sidebarDonorStatus = document.getElementById('sidebarDonorStatus');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const hubSidebar = document.getElementById('hubSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function getFeedContainer() {
    return document.getElementById('alertsFeedContainer') || document.getElementById('emergencyFeedContainer');
  }

  // ======================== INITIALIZATION ========================
  document.addEventListener('DOMContentLoaded', async () => {
    await initDonorProfile();
    initMobileNav();
    initStatusToggle();
    initGPSListener();
    initRadarMap();

    const btnEnableLoc = document.getElementById('btnEnableDonorLocation');
    if (btnEnableLoc) {
      btnEnableLoc.addEventListener('click', () => {
        requestLiveGeolocation();
      });
    }

    // 1. Retrieve Donor's Real GPS Coordinates on page load
    requestLiveGeolocation();
    initDonorAlertsRealtime();

    // 2. Set up 10-second interval polling for real-time hospital broadcasts
    setInterval(() => {
      fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
    }, 10000);
  });

  function initDonorAlertsRealtime() {
    if (window._donorAlertsEventSource) return;
    try {
      const es = new EventSource('/api/donor/events');
      window._donorAlertsEventSource = es;
      const handleEvt = () => {
        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      };
      es.addEventListener('request-updated', handleEvt);
      es.addEventListener('donor-accepted', handleEvt);
      es.addEventListener('donor-declined', handleEvt);
      es.addEventListener('donor-withdrew', handleEvt);
      es.addEventListener('donor-released', handleEvt);
      es.addEventListener('request-closed', handleEvt);
      es.addEventListener('request-cancelled', handleEvt);
      es.addEventListener('request-expired', handleEvt);
      es.addEventListener('request-fulfilled', handleEvt);
    } catch (e) {
      console.debug('Donor alerts SSE notice:', e);
    }
  }

  // ======================== 1. PROFILE & SESSION ========================
  async function initDonorProfile() {
    try {
      // Try reading authenticated session
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      if (session && session.user) {
        currentDonor.name = session.user.name || session.user.fullName || currentDonor.name;
        currentDonor.bloodType = session.user.bloodType || currentDonor.bloodType;
        if (session.user.latitude && session.user.longitude) {
          currentDonor.latitude = parseFloat(session.user.latitude);
          currentDonor.longitude = parseFloat(session.user.longitude);
        }
        if (session.user.availability) {
          currentDonor.availability = session.user.availability;
        }
      }

      // Fetch fresh profile from API
      const res = await fetch('/api/donors/profile');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          currentDonor.name = d.name || currentDonor.name;
          currentDonor.bloodType = d.bloodType || currentDonor.bloodType;
          if (d.latitude && d.longitude) {
            currentDonor.latitude = parseFloat(d.latitude);
            currentDonor.longitude = parseFloat(d.longitude);
            currentDonor.hasLocation = true;
          }
          if (d.availability) {
            currentDonor.availability = d.availability;
          }
        }
      }

      // Fetch authoritative medical eligibility
      try {
        const elRes = await fetch('/api/donor/eligibility');
        if (elRes.ok) {
          const elJson = await elRes.json();
          if (elJson.success && elJson.data) {
            currentDonor.eligibility = elJson.data;
          }
        }
      } catch (_) { }
    } catch (err) {
      console.warn('Profile sync notice:', err);
    }

    if (donorGreetingName) donorGreetingName.textContent = currentDonor.name;
    updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);
    renderDonorStatus();
  }

  // ======================== 2. REAL GEOLOCATION API ========================
  function requestLiveGeolocation() {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      return;
    }

    const icon = gpsSyncBtn ? gpsSyncBtn.querySelector('.gps-icon-spin') : null;
    if (icon) icon.classList.add('fa-spin');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (icon) icon.classList.remove('fa-spin');
        currentDonor.latitude = pos.coords.latitude;
        currentDonor.longitude = pos.coords.longitude;
        currentDonor.hasLocation = true;
        currentDonor.accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        const accuracy = currentDonor.accuracy || 8;

        const banner = document.getElementById('donorLocationPrompt');
        if (banner) banner.style.display = 'none';

        updateGPSDisplay(currentDonor.latitude, currentDonor.longitude, accuracy);

        // Pan map to real position
        if (leafletMap) {
          leafletMap.setView([currentDonor.latitude, currentDonor.longitude], 13);
        }

        // Fetch alerts for real location
        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);

        // Update backend donor location
        fetch('/api/donors/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: currentDonor.latitude,
            longitude: currentDonor.longitude
          })
        }).catch(() => { });
      },
      (err) => {
        if (icon) icon.classList.remove('fa-spin');
        console.warn('Geolocation notice / permission denied:', err.message);
        currentDonor.hasLocation = false;
        currentDonor.accuracy = null;
        if (err.code === 1) {
          const banner = document.getElementById('donorLocationPrompt');
          if (banner) banner.style.display = 'flex';
        }
        updateGPSDisplay(currentDonor.latitude, currentDonor.longitude, null);
        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function initGPSListener() {
    if (!gpsSyncBtn) return;
    gpsSyncBtn.addEventListener('click', () => {
      showToast('Refreshing live GPS coordinates via Geolocation API...', 'info');
      requestLiveGeolocation();
    });
  }

  function updateGPSDisplay(lat, lng, accuracy) {
    if (gpsCoordsText) {
      if (accuracy) {
        const latStr = Math.abs(lat).toFixed(4) + (lat >= 0 ? '° N' : '° S');
        const lngStr = Math.abs(lng).toFixed(4) + (lng >= 0 ? '° E' : '° W');
        gpsCoordsText.textContent = `CONNECTED (${latStr}, ${lngStr} ±${accuracy}m)`;
      } else {
        gpsCoordsText.textContent = `LOCATION OFF`;
      }
    }

    const navGps = document.getElementById('navGpsIndicator');
    if (navGps) {
      if (accuracy) {
        navGps.innerHTML = `<span class="gps-dot-pulse"></span><span>Live GPS: Connected (±${accuracy}m)</span>`;
      } else {
        navGps.innerHTML = `<span class="gps-dot-pulse" style="background:#f59e0b;"></span><span>Live GPS: Location off</span> <button type="button" onclick="window.requestLiveGeolocation && window.requestLiveGeolocation()" style="margin-left:4px;padding:1px 6px;font-size:10px;background:#ef4444;color:#fff;border:none;border-radius:3px;cursor:pointer;">Enable</button>`;
      }
    }

    const chipGps = document.getElementById('standbyGpsChip');
    if (chipGps) {
      if (accuracy) {
        chipGps.innerHTML = `<i class="fas fa-crosshairs" style="color:#00e676"></i> <span>Live GPS: <b>Connected (±${accuracy}m)</b></span>`;
      } else {
        chipGps.innerHTML = `<i class="fas fa-crosshairs" style="color:#f59e0b"></i> <span>Live GPS: <b>Location off</b> <button type="button" onclick="window.requestLiveGeolocation && window.requestLiveGeolocation()" style="margin-left:6px;padding:2px 8px;font-size:11px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Enable</button></span>`;
      }
    }
  }

  window.requestLiveGeolocation = requestLiveGeolocation;

  // ======================== 3. STATUS TOGGLE ========================
  function initStatusToggle() {
    if (!donorStatusToggle) return;
    donorStatusToggle.addEventListener('click', async () => {
      const isCurrentlyAvailable = currentDonor.availability === 'Available';
      const newStatus = isCurrentlyAvailable ? 'Busy' : 'Available';
      currentDonor.availability = newStatus;
      renderDonorStatus();

      try {
        await fetch('/api/donors/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ available: newStatus === 'Available' })
        });
        showToast(`Donor status updated to: ${newStatus}`, 'success');
      } catch (e) {
        console.warn('Status sync notice:', e);
      }
    });
  }

  function renderDonorStatus() {
    const isAvail = currentDonor.availability === 'Available';
    if (donorStatusToggle) {
      donorStatusToggle.className = `hub-status-toggle ${isAvail ? '' : 'busy'}`;
      if (donorStatusText) {
        donorStatusText.textContent = isAvail ? 'Available to Donate' : 'Busy';
      }
    }
    if (sidebarDonorStatus) {
      sidebarDonorStatus.innerHTML = `
        <span class="hes-dot" style="background:${isAvail ? 'var(--green-neon)' : 'var(--yellow-neon)'}; box-shadow:0 0 10px ${isAvail ? 'var(--green-neon)' : 'var(--yellow-neon)'}"></span>
        <span>Donor Status: <b>${isAvail ? 'ACTIVE' : 'BUSY'}</b></span>
      `;
    }
  }

  // ======================== 4. HAVERSINE DISTANCE ENGINE ========================
  function calculateHaversineKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  function getZone(distanceKm) {
    if (distanceKm <= 5.0) {
      return { tag: 'Zone 1', range: '0–5km', label: 'Within Immediate Coverage' };
    } else if (distanceKm <= 10.0) {
      return { tag: 'Zone 2', range: '5–10km', label: 'Extended Rapid Response' };
    } else {
      return { tag: 'Zone 3', range: '10–20km', label: 'Regional Trauma Backup' };
    }
  }

  // ======================== 5. REST API: GET ACTIVE ALERTS ========================
  async function fetchActiveAlerts(lat, lng) {
    try {
      const donorBloodGroup = currentDonor.bloodType || 'O-';
      const endpoint = `/api/donor/alerts?lat=${lat}&lng=${lng}&bloodGroup=${encodeURIComponent(donorBloodGroup)}`;

      let data = [];
      const res = await fetch(endpoint, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          data = json.data;
        } else if (Array.isArray(json)) {
          data = json;
        }
      } else {
        // Fallback to /api/requests
        const fallbackRes = await fetch('/api/requests', { credentials: 'include' });
        if (fallbackRes.ok) {
          const fbJson = await fallbackRes.json();
          if (fbJson.success && Array.isArray(fbJson.data)) {
            data = fbJson.data;
          }
        }
      }

      // Map and calculate real database fields
      activeRequests = data.map(req => {
        const reqLat = parseFloat(req.latitude || req.reqLat || (lat + 0.024));
        const reqLng = parseFloat(req.longitude || req.reqLng || (lng + 0.018));
        const distanceKm = req.distanceKm != null ? parseFloat(req.distanceKm) : calculateHaversineKm(lat, lng, reqLat, reqLng);
        const zone = getZone(distanceKm);

        return {
          id: req.id || req.requestId,
          hospitalId: req.hospitalId || req.hospital_id,
          hospitalName: req.hospitalName || req.hospital_name || 'Emergency Medical Center',
          bloodType: req.bloodType || req.blood_type || donorBloodGroup,
          urgencyLevel: req.urgencyLevel || req.urgency_level || req.urgency || null,
          neededWithinMinutes: req.neededWithinMinutes != null ? req.neededWithinMinutes : (req.neededWithinMins != null ? req.neededWithinMins : null),
          distanceKm: distanceKm.toFixed(1),
          etaMinutes: req.etaMinutes || Math.max(Math.round(distanceKm * 2.5), 6),
          zoneTag: zone.tag,
          zoneRange: zone.range,
          address: req.hospitalAddress || req.address || req.city || 'Emergency Trauma Bay',
          phone: req.phone || req.hospitalPhone || req.hospital_phone || '+91 108',
          units: req.unitsRequested || req.units || 1,
          patientName: req.patientName || 'Emergency Patient',
          notes: req.notes || req.hosp_notes || '',
          status: req.status || 'New',
          reqLat,
          reqLng
        };
      });

      // All requests returned by /api/donor/alerts are already validated and filtered for this donor by the backend

      // Update global emergency radar dot indicator
      try {
        sessionStorage.setItem('red404_active_emergencies_count', String(activeRequests.length));
        if (typeof window.updateEmergencyIndicator === 'function') {
          window.updateEmergencyIndicator(activeRequests.length);
        }
      } catch (_) { }

      // Render dynamically into feed container and update map
      renderEmergencyFeed();
      updateRadarVisualization();

    } catch (e) {
      console.warn('fetchActiveAlerts notice:', e);
      if (activeRequests.length === 0) {
        renderStandbyState();
      }
    }
  }

  // ======================== 6. DYNAMIC UI RENDERING ========================
  function renderEmergencyFeed() {
    const feedContainer = getFeedContainer();
    const liveBadge = document.getElementById('feedLiveSosBadge');
    if (!feedContainer) return;

    // State 1: If response is empty, dynamically inject Standby UI
    if (activeRequests.length === 0) {
      if (liveBadge) liveBadge.style.display = 'none';
      renderStandbyState();
      return;
    }

    // Only show LIVE SOS BROADCAST badge if there is at least one active (New or Accepted) request
    const hasLiveSos = activeRequests.some(r => {
      const s = (r.status || 'New').toUpperCase();
      return s === 'NEW' || s === 'ACCEPTED' || s === 'NOTIFIED';
    });
    if (liveBadge) {
      liveBadge.style.display = hasLiveSos ? 'inline-flex' : 'none';
    }

    // State 2: Requests exist — loop through records and render cards
    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');

    let html = '';
    activeRequests.forEach((req, idx) => {
      const hospitalName = req.hospitalName || 'Hospital';
      const distance = req.distanceKm != null ? req.distanceKm : '0';
      const rawStatus = (req.status || 'New').toUpperCase();

      const isHighlighted = Boolean(highlightId && (String(req.id) === String(highlightId) || String(req.requestId) === String(highlightId)));
      const highlightStyles = isHighlighted
        ? 'border: 2px solid #ef4444 !important; box-shadow: 0 0 25px rgba(239, 68, 68, 0.65) !important; background: linear-gradient(135deg, rgba(35, 12, 18, 0.95) 0%, rgba(20, 10, 15, 0.98) 100%) !important;'
        : '';
      const targetedBadge = isHighlighted
        ? '<span class="target-highlight-tag" style="background:#dc2626; color:#ffffff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:5px; box-shadow:0 0 10px rgba(220,38,38,0.5);"><i class="fa-solid fa-bullseye"></i> TARGETED FOR YOU</span>'
        : '';

      // Normalize status to one of: New, Accepted, Declined, Withdrawn, Expired, Fulfilled
      let displayStatus = 'New';
      let statusBadgeStyle = 'background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);';

      if (rawStatus === 'ACCEPTED') {
        displayStatus = 'Accepted';
        statusBadgeStyle = 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);';
      } else if (rawStatus === 'DECLINED') {
        displayStatus = 'Declined';
        statusBadgeStyle = 'background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3);';
      } else if (rawStatus === 'WITHDRAWN') {
        displayStatus = 'Withdrawn';
        statusBadgeStyle = 'background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3);';
      } else if (rawStatus === 'EXPIRED') {
        displayStatus = 'Expired';
        statusBadgeStyle = 'background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);';
      } else if (rawStatus === 'FULFILLED') {
        displayStatus = 'Fulfilled';
        statusBadgeStyle = 'background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3);';
      }

      let actionsHtml = '';
      if (displayStatus === 'Accepted') {
        actionsHtml = `
          <div class="sos-actions-row" style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button type="button" class="btn-sos-directions" onclick="window.openDirectionsToHospital(${req.reqLat}, ${req.reqLng})" style="display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">
              <i class="fas fa-location-arrow"></i>
              <span>Directions</span>
            </button>
            <a href="tel:${escapeHtml(req.phone || '+91 108')}" class="btn-sos-call" style="background:#059669; color:#fff; text-decoration:none; padding:9px 18px; border-radius:8px; display:inline-flex; align-items:center; gap:8px; font-weight:600; font-size:13px;">
              <i class="fas fa-phone"></i>
              <span>Call hospital (${escapeHtml(req.phone || '+91 108')})</span>
            </a>
          </div>
        `;
      } else if (displayStatus === 'Declined') {
        actionsHtml = `<div style="font-size:13px; color:#94a3b8; padding:10px; background:rgba(255,255,255,0.04); border-radius:8px; margin-top:12px;"><i class="fas fa-times-circle" style="margin-right:6px;"></i> You declined this request.</div>`;
      } else if (displayStatus === 'Withdrawn') {
        actionsHtml = `<div style="font-size:13px; color:#94a3b8; padding:10px; background:rgba(255,255,255,0.04); border-radius:8px; margin-top:12px;"><i class="fas fa-undo" style="margin-right:6px;"></i> You withdrew from this request. The hospital has been notified.</div>`;
      } else if (displayStatus === 'Expired') {
        actionsHtml = `<div style="font-size:13px; color:#f59e0b; padding:10px; background:rgba(245,158,11,0.08); border-radius:8px; margin-top:12px;"><i class="fas fa-clock" style="margin-right:6px;"></i> This emergency request has expired.</div>`;
      } else if (displayStatus === 'Fulfilled') {
        actionsHtml = `<div style="font-size:13px; color:#3b82f6; padding:10px; background:rgba(59,130,246,0.08); border-radius:8px; margin-top:12px;"><i class="fas fa-check-circle" style="margin-right:6px;"></i> This request has been fulfilled. Thank you!</div>`;
      } else {
        // New
        actionsHtml = `
          <div class="sos-actions-row" style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button class="btn-sos-accept" onclick="window.acceptAndNavigate(${req.id})">
              <span>Accept Alert & Navigate</span>
              <i class="fas fa-arrow-right"></i>
            </button>
            <button type="button" class="btn-sos-directions" onclick="window.openDirectionsToHospital(${req.reqLat}, ${req.reqLng})">
              <i class="fas fa-location-arrow"></i>
              <span>Directions</span>
            </button>
            <button class="btn-sos-decline" onclick="window.declineAlert(${req.id})">
              Decline
            </button>
          </div>
        `;
      }

      const bloodLabel = (req.bloodType || '').includes('-') ? 'NEGATIVE NEEDED' : 'POSITIVE NEEDED';

      const metaParts = [];
      if (req.urgencyLevel) {
        const rawU = (req.urgencyLevel || '').toString().toLowerCase().trim();
        const formattedU = rawU === 'critical' ? 'Critical' : (rawU === 'urgent' ? 'Urgent' : 'Normal');
        metaParts.push(`<b>Urgency: ${formattedU}</b>`);
      }
      metaParts.push(`Units: ${req.units || 1}`);
      if (req.neededWithinMinutes) {
        metaParts.push(`Needed within ${req.neededWithinMinutes} mins`);
      }
      metaParts.push(`Status: <span style="font-weight:700; color:#fff;">${displayStatus}</span>`);

      html += `
        <div class="emergency-sos-card" id="req-card-${req.id}" style="margin-bottom:16px; ${highlightStyles}">
          <div class="sos-card-top">
            <div class="sos-hosp-info">
              <div class="sos-hosp-title-row" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <i class="fas fa-hospital-alt sos-hosp-icon"></i>
                <h3 class="sos-hosp-name" style="margin:0;">${escapeHtml(hospitalName.toUpperCase())}</h3>
                ${targetedBadge}
                <span class="sos-distance-pill">${distance}km</span>
                <span style="${statusBadgeStyle} padding:2px 10px; border-radius:6px; font-size:12px; font-weight:700;">${displayStatus}</span>
              </div>
              <div class="sos-hosp-address" style="font-size:0.82rem; color:#cbd5e1; margin:6px 0 3px 0;">
                <i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:4px;"></i> ${escapeHtml(req.address || 'Hospital Location')}
              </div>
              <span class="sos-zone-tag">${distance} km away • ${req.zoneTag || 'Zone 1'}</span>
            </div>
            <div class="sos-blood-badge">
              <div class="sbb-type">${escapeHtml(req.bloodType)}</div>
              <div class="sbb-label">${bloodLabel}</div>
            </div>
          </div>

          <!-- Mini route map preview -->
          <div class="sos-route-preview">
            <div class="srp-track">
              <div class="srp-node-donor" title="Your GPS Location"></div>
              <div class="srp-dashed-line"></div>
              <div class="srp-node-hosp" title="Hospital Location">
                <i class="fas fa-hospital"></i>
              </div>
            </div>
          </div>

          <div class="sos-urgency-meta" style="margin-top:10px; font-size:0.84rem; color:#94a3b8;">
            ${metaParts.join(' • ')}
            ${req.notes ? `<div style="font-size:0.78rem; color:#cbd5e1; margin-top:4px;">Note: ${escapeHtml(req.notes)}</div>` : ''}
          </div>

          ${actionsHtml}
        </div>
      `;
    });

    feedContainer.innerHTML = html;

    // Scroll to and highlight card if specified in query string
    try {
      if (highlightId) {
        setTimeout(() => {
          const targetCard = document.getElementById(`req-card-${highlightId}`);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    } catch (_) { }
  }

  // ======================== 7. DYNAMIC STANDBY UI ========================
  function renderStandbyState() {
    const feedContainer = getFeedContainer();
    const liveBadge = document.getElementById('feedLiveSosBadge');
    if (liveBadge) liveBadge.style.display = 'none';
    if (!feedContainer) return;

    let gpsHtml = `Live GPS: <b>Location off</b> <button type="button" onclick="window.requestLiveGeolocation && window.requestLiveGeolocation()" style="margin-left:6px;padding:2px 8px;font-size:11px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Enable</button>`;
    if (currentDonor.hasLocation && currentDonor.accuracy) {
      gpsHtml = `Live GPS: <b>Connected (±${currentDonor.accuracy}m)</b>`;
    } else if (currentDonor.hasLocation) {
      gpsHtml = `Live GPS: <b>Connected</b>`;
    }

    let eligText = 'Waiting for hospital check';
    if (currentDonor.eligibility) {
      const e = currentDonor.eligibility;
      if (e.has_donated === false || e.total_donations === 0 || e.totalDonations === 0) {
        eligText = "No donation yet. You're ready.";
      } else if (e.eligible) {
        eligText = "You can donate. The hospital does a final check before donating.";
      } else {
        const nextDate = e.next_eligible_date || e.nextEligibleDate || '';
        const daysLeft = e.days_until_eligible || e.daysUntilEligible || 0;
        let formattedNext = nextDate;
        try {
          const nd = new Date(nextDate);
          if (!isNaN(nd.getTime())) {
            formattedNext = nd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        } catch (_) {}
        eligText = `Next eligible on ${formattedNext} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'})`;
      }
    }

    feedContainer.innerHTML = `
      <div class="standby-state-container" style="animation:fadeIn 0.3s ease;">
        <div class="standby-radar-disc">
          <div class="standby-shield-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
        </div>
        <h2 class="standby-title">No active requests</h2>
        <p class="standby-desc">
          You'll be notified here when a hospital near you needs your blood group.
        </p>
        <div class="standby-status-pill">
          <span class="ssp-dot"></span>
          <span>🟢 Standby: Monitoring</span>
        </div>

        <div class="standby-chips-row">
          <div class="standby-chip">
            <i class="fas fa-tint" style="color:var(--red-neon)"></i>
            <span>Blood Group: <b>${escapeHtml(currentDonor.bloodType)}</b></span>
          </div>
          <div class="standby-chip">
            <i class="fas fa-heartbeat" style="color:var(--green-neon)"></i>
            <span>Medical Eligibility: <b>${escapeHtml(eligText)}</b></span>
          </div>
          <div class="standby-chip" id="standbyGpsChip">
            <i class="fas fa-crosshairs" style="color:#00e676"></i>
            <span>${gpsHtml}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ======================== 8. UNIFIED MAP ENGINE ========================
  function setRadarMapLayer(layerKey) {
    if (!leafletMap) return;
    if (layerKey === 'google-dark') layerKey = 'dark';
    if (layerKey === 'google-roads' || layerKey === 'osm') layerKey = 'map';

    activeLayerKey = layerKey;
    try {
      localStorage.setItem('red404_map_layer', layerKey);
    } catch (_) { }

    const mapContainer = document.getElementById('proximityMap');
    const result = window.Red404Map
      ? window.Red404Map.createTileLayer(layerKey, null, mapContainer)
      : null;

    if (result && result.layer) {
      if (currentTileLayer) {
        try { leafletMap.removeLayer(currentTileLayer); } catch (_) {}
      }
      currentTileLayer = result.layer;
      currentTileLayer.addTo(leafletMap);
      if (mapContainer) {
        if (result.isDark) {
          mapContainer.classList.add('dark-map');
        } else {
          mapContainer.classList.remove('dark-map');
        }
      }
    }

    // Update layer button active state
    document.querySelectorAll('.rlb-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
    });
  }

  function initRadarMap() {
    const mapContainer = document.getElementById('proximityMap');
    if (!mapContainer || typeof L === 'undefined') return;

    try {
      leafletMap = L.map('proximityMap', {
        center: [currentDonor.latitude, currentDonor.longitude],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      // Apply initial layer
      setRadarMapLayer(activeLayerKey);

      // Setup layer switch buttons with Red404Map
      const layerBar = document.querySelector('.radar-layer-bar');
      if (layerBar && window.Red404Map) {
        window.Red404Map.setupLayerBar(layerBar, leafletMap, (k) => setRadarMapLayer(k));
      } else {
        document.querySelectorAll('.rlb-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const layerKey = btn.getAttribute('data-layer');
            setRadarMapLayer(layerKey);
          });
        });
      }

      window.addEventListener('resize', () => {
        if (leafletMap) leafletMap.invalidateSize();
      });

      // Setup zoom & recenter controls
      const zoomInBtn = document.getElementById('radarZoomInBtn');
      if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          leafletMap.zoomIn();
        });
      }

      const zoomOutBtn = document.getElementById('radarZoomOutBtn');
      if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          leafletMap.zoomOut();
        });
      }

      const centerBtn = document.getElementById('radarCenterBtn');
      if (centerBtn) {
        centerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          leafletMap.setView([currentDonor.latitude, currentDonor.longitude], 13);
        });
      }

      updateRadarVisualization();
    } catch (e) {
      console.warn('Map initialization notice:', e);
    }
  }

  function updateRadarVisualization() {
    if (!leafletMap || typeof L === 'undefined') return;

    const donorLatLng = [currentDonor.latitude, currentDonor.longitude];
    const radarBadge = document.getElementById('radarActiveBadge');
    const scanner = document.getElementById('radarScannerSweep');

    // Only active (New or Accepted) requests should activate the scanner and show on map
    const activeAlerts = activeRequests.filter(r => {
      const s = (r.status || 'New').toUpperCase();
      return s === 'NEW' || s === 'ACCEPTED' || s === 'NOTIFIED';
    });

    if (scanner) {
      scanner.style.display = activeAlerts.length > 0 ? 'block' : 'none';
    }

    // Remove existing markers if any
    if (donorMarker) leafletMap.removeLayer(donorMarker);
    if (hospitalMarker) leafletMap.removeLayer(hospitalMarker);
    if (routePolyline) leafletMap.removeLayer(routePolyline);

    // Create glowing Donor Node marker
    const donorIcon = L.divIcon({
      className: 'custom-donor-icon',
      html: `
        <div class="radar-center-donor">
          <div class="rcd-dot"></div>
          <div class="rcd-label">DONOR NODE</div>
        </div>
      `,
      iconSize: [80, 40],
      iconAnchor: [40, 10]
    });

    donorMarker = L.marker(donorLatLng, { icon: donorIcon }).addTo(leafletMap);

    // Check if there is an active matching request
    if (activeAlerts.length > 0) {
      const topReq = activeAlerts[0];
      const hospLatLng = [topReq.reqLat, topReq.reqLng];

      if (radarBadge) {
        radarBadge.textContent = `${activeAlerts.length} active ${activeAlerts.length === 1 ? 'request' : 'requests'}`;
        radarBadge.style.color = 'var(--red-neon)';
        radarBadge.style.borderColor = 'var(--red-border)';
        radarBadge.style.background = 'var(--red-glow-soft)';
      }

      // Create glowing Hospital Marker
      const hospIcon = L.divIcon({
        className: 'custom-hosp-icon',
        html: `
          <div class="radar-hosp-node">
            <div class="rhn-icon-box"><i class="fas fa-hospital"></i></div>
            <div class="rhn-label">${escapeHtml(topReq.hospitalName || 'Hospital')} (${topReq.distanceKm}km)</div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 20]
      });

      hospitalMarker = L.marker(hospLatLng, { icon: hospIcon }).addTo(leafletMap);

      // Connecting straight-line polyline
      routePolyline = L.polyline([donorLatLng, hospLatLng], {
        color: '#ff2a44',
        weight: 3,
        opacity: 0.85,
        dashArray: '6, 8'
      }).addTo(leafletMap);

      // Fit bounds to show both donor and hospital
      const bounds = L.latLngBounds([donorLatLng, hospLatLng]);
      leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    } else {
      if (radarBadge) {
        radarBadge.textContent = 'No active requests';
        radarBadge.style.color = 'var(--green-neon)';
        radarBadge.style.borderColor = 'var(--green-border)';
        radarBadge.style.background = 'var(--green-soft)';
      }

      const currentZoom = leafletMap.getZoom() || 13;
      leafletMap.setView(donorLatLng, Math.max(currentZoom, 13));
    }
  }

  // ======================== 9. GLOBAL ACTIONS ========================
  window.acceptAndNavigate = async function (requestId) {
    const selected = activeRequests.find(r => String(r.id) === String(requestId));
    if (selected) {
      const missionPayload = {
        hospitalId: selected.hospitalId || selected.id,
        hospitalName: selected.hospitalName || 'Emergency Medical Center',
        hospitalLat: selected.reqLat,
        hospitalLng: selected.reqLng,
        donorLat: currentDonor.latitude,
        donorLng: currentDonor.longitude,
        bloodGroup: selected.bloodType || currentDonor.bloodType,
        distanceKm: selected.distanceKm,
        etaMinutes: selected.etaMinutes || 12,
        urgencyLevel: selected.urgencyLevel || 'CRITICAL',
        neededWithinMinutes: selected.neededWithinMinutes || 20,
        address: selected.address || 'Emergency Trauma Center',
        phone: selected.phone || '+91 108',
        units: selected.units || 1,
        patientName: selected.patientName || 'Emergency Patient',
        requestId: selected.id,
        acceptedAt: new Date().toISOString()
      };

      // Store in sessionStorage and localStorage as explicitly required
      sessionStorage.setItem('activeMission', JSON.stringify(missionPayload));
      localStorage.setItem('activeEmergencyRoute', JSON.stringify(missionPayload));
      selected.status = 'Accepted';
    }

    const donorId = currentDonor ? (currentDonor.id || currentDonor.donorId) : null;
    const payload = JSON.stringify({ donorId: donorId });
    const postHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    try {
      await fetch(`/api/donor/blood-requests/${requestId}/accept`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }
    try {
      await fetch(`/api/requests/${requestId}/accept`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }

    showToast('Alert accepted! Hospital dispatch and rescue team notified.', 'success');
    renderEmergencyFeed();
    updateRadarVisualization();
  };

  window.withdrawAlert = async function (requestId) {
    const selected = activeRequests.find(r => String(r.id) === String(requestId) || String(r.requestId) === String(requestId));
    if (selected && String(selected.status).toUpperCase() === 'ACCEPTED') {
      alert('Withdraw is not permitted after accepting. Please call the hospital directly if you cannot arrive.');
      return;
    }
    if (selected) {
      selected.status = 'Withdrawn';
    }
    const donorId = currentDonor ? (currentDonor.id || currentDonor.donorId) : null;
    const payload = JSON.stringify({ donorId: donorId });
    const postHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    try {
      await fetch(`/api/donor/blood-requests/${requestId}/withdraw`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }
    try {
      await fetch(`/api/requests/${requestId}/withdraw`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }

    showToast('You withdrew from this request. The hospital has been notified.', 'info');
    renderEmergencyFeed();
    updateRadarVisualization();
  };

  window.declineAlert = async function (requestId) {
    const selected = activeRequests.find(r => String(r.id) === String(requestId));
    if (selected) {
      selected.status = 'Declined';
    }
    const donorId = currentDonor ? (currentDonor.id || currentDonor.donorId) : null;
    const payload = JSON.stringify({ donorId: donorId });
    const postHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    try {
      await fetch(`/api/donor/blood-requests/${requestId}/decline`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }
    try {
      await fetch(`/api/requests/${requestId}/decline`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }

    showToast('Alert dismissed.', 'info');
    renderEmergencyFeed();
    updateRadarVisualization();
  };

  window.openDirectionsToHospital = function (hospLat, hospLng) {
    if (hospLat == null || hospLng == null || isNaN(hospLat) || isNaN(hospLng)) {
      showToast("Hospital coordinates are not available for driving directions.", "error");
      return;
    }
    if (!navigator.geolocation) {
      if (currentDonor.latitude && currentDonor.longitude) {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${currentDonor.latitude},${currentDonor.longitude}&destination=${hospLat},${hospLng}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
      }
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (!pos || !pos.coords) {
          if (currentDonor.latitude && currentDonor.longitude) {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${currentDonor.latitude},${currentDonor.longitude}&destination=${hospLat},${hospLng}&travelmode=driving`;
            window.open(url, '_blank', 'noopener,noreferrer');
          } else {
            showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
          }
          return;
        }
        const donorLat = pos.coords.latitude;
        const donorLng = pos.coords.longitude;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${donorLat},${donorLng}&destination=${hospLat},${hospLng}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      function (err) {
        if (currentDonor.latitude && currentDonor.longitude) {
          const url = `https://www.google.com/maps/dir/?api=1&origin=${currentDonor.latitude},${currentDonor.longitude}&destination=${hospLat},${hospLng}&travelmode=driving`;
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ======================== 10. UTILS & HELPERS ========================
  function initMobileNav() {
    if (!mobileMenuBtn || !hubSidebar || !sidebarOverlay) return;

    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = hubSidebar.classList.contains('mobile-open');
      if (isOpen) {
        hubSidebar.classList.remove('mobile-open');
        sidebarOverlay.style.display = 'none';
      } else {
        hubSidebar.classList.add('mobile-open');
        sidebarOverlay.style.display = 'block';
      }
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
        title: type === 'success' ? 'Radar Update' : 'Notice',
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
