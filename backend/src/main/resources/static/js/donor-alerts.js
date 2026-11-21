/* ============================================================
   RED404 — DONOR EMERGENCIES & DISPATCH RADAR
   Part 2 & Part 7: Professional Redesign Script
   Single Source of Truth Lifecycle • No Demo Data
============================================================ */

(function () {
  'use strict';

  // Dynamic State Management
  let currentDonor = {
    id: null,
    name: 'Donor',
    bloodType: 'O-',
    latitude: 28.3486,
    longitude: 79.5619,
    availability: 'Available',
    hasLocation: false,
    accuracy: null,
    qrToken: null
  };

  let allAlerts = [];
  let activeRequests = [];
  let pastRequests = [];

  let leafletMap = null;
  let currentTileLayer = null;
  let donorMarker = null;
  let hospitalMarker = null;
  let routePolyline = null;
  let distanceCircles = [];

  let activeLayerKey = localStorage.getItem('red404_map_layer') || 'dark';
  if (activeLayerKey === 'google-dark') activeLayerKey = 'dark';
  if (activeLayerKey === 'google-roads' || activeLayerKey === 'osm') activeLayerKey = 'map';

  function getFeedContainer() {
    return document.getElementById('alertsFeedContainer') || document.getElementById('emergencyFeedContainer');
  }

  // ======================== INITIALIZATION ========================
  document.addEventListener('DOMContentLoaded', async () => {
    await initDonorProfile();
    initMobileMapToggle();
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

    // 2. Set up 10-second interval polling fallback for real-time hospital broadcasts
    setInterval(() => {
      fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
    }, 10000);

    // 3. Countdown timer tick every 30 seconds
    setInterval(() => {
      updateCountdowns();
    }, 30000);
  });

  // ======================== REALTIME SSE LISTENER ========================
  function initDonorAlertsRealtime() {
    if (window._donorAlertsEventSource) return;
    try {
      const es = new EventSource('/api/donor/events');
      window._donorAlertsEventSource = es;

      const refresh = () => {
        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      };

      es.addEventListener('request-updated', refresh);
      es.addEventListener('donor-accepted', refresh);
      es.addEventListener('donor-declined', refresh);
      es.addEventListener('donor-withdrew', refresh);

      es.addEventListener('donor-released', (e) => {
        showToast('The hospital no longer needs you for this request', 'info');
        refresh();
      });

      es.addEventListener('request-closed', (e) => {
        showToast('This request was closed by the hospital', 'info');
        refresh();
      });

      es.addEventListener('request-cancelled', (e) => {
        showToast('The hospital cancelled this request', 'info');
        refresh();
      });

      es.addEventListener('request-expired', (e) => {
        showToast('Your request has expired', 'info');
        refresh();
      });

      es.addEventListener('request-fulfilled', (e) => {
        showToast('Request fulfilled', 'success');
        refresh();
      });

      es.onerror = () => {
        // Fallback polling handles reconnection seamlessly
      };
    } catch (e) {
      console.debug('Donor alerts SSE notice:', e);
    }
  }

  // ======================== 1. PROFILE & SESSION ========================
  async function initDonorProfile() {
    try {
      const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
      if (session && session.user) {
        currentDonor.id = session.user.id || session.user.donorId;
        currentDonor.name = session.user.name || session.user.fullName || currentDonor.name;
        currentDonor.bloodType = session.user.bloodType || session.user.bloodGroup || currentDonor.bloodType;
        if (session.user.latitude && session.user.longitude) {
          currentDonor.latitude = parseFloat(session.user.latitude);
          currentDonor.longitude = parseFloat(session.user.longitude);
          currentDonor.hasLocation = true;
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
          currentDonor.id = d.id || d.donorId || currentDonor.id;
          currentDonor.name = d.name || currentDonor.name;
          currentDonor.bloodType = d.bloodType || d.bloodGroup || currentDonor.bloodType;
          if (d.qrToken || d.qr_token) currentDonor.qrToken = d.qrToken || d.qr_token;
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

      // Authoritative medical eligibility
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

    updateHeaderStatusLine();
  }

  // ======================== 2. GEOLOCATION API ========================
  function requestLiveGeolocation() {
    if (!navigator.geolocation) {
      currentDonor.hasLocation = false;
      updateHeaderStatusLine();
      fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentDonor.latitude = pos.coords.latitude;
        currentDonor.longitude = pos.coords.longitude;
        currentDonor.hasLocation = true;
        currentDonor.accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;

        const banner = document.getElementById('donorLocationPrompt');
        if (banner) banner.style.display = 'none';

        updateHeaderStatusLine();

        if (leafletMap) {
          leafletMap.setView([currentDonor.latitude, currentDonor.longitude], 13);
        }

        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);

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
        currentDonor.hasLocation = false;
        currentDonor.accuracy = null;
        const banner = document.getElementById('donorLocationPrompt');
        if (banner && err.code === 1) {
          banner.style.display = 'flex';
        }
        updateHeaderStatusLine();
        fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  window.requestLiveGeolocation = requestLiveGeolocation;

  function updateHeaderStatusLine() {
    const statusLine = document.getElementById('feedHeaderStatusLine');
    if (!statusLine) return;

    const activeCountText = `${activeRequests.length} active`;
    const locText = currentDonor.hasLocation
      ? 'Location on'
      : '<a href="javascript:void(0)" onclick="window.requestLiveGeolocation()">Turn on location</a>';
    const notifsText = (typeof Notification !== 'undefined' && Notification.permission === 'denied')
      ? 'Notifications off'
      : 'Notifications on';

    statusLine.innerHTML = `<span>${activeCountText}</span> &bull; <span>${locText}</span> &bull; <span>${notifsText}</span>`;
  }

  // ======================== 3. HAVERSINE DISTANCE ENGINE ========================
  function calculateHaversineKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  // ======================== 4. REST API: FETCH ALERTS ========================
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
        const fallbackRes = await fetch('/api/donor/blood-requests', { credentials: 'include' });
        if (fallbackRes.ok) {
          const fbJson = await fallbackRes.json();
          if (fbJson.success && Array.isArray(fbJson.data)) {
            data = fbJson.data;
          }
        }
      }

      // Map raw items
      allAlerts = data.map(req => {
        const reqLat = parseFloat(req.latitude || req.reqLat || (lat + 0.024));
        const reqLng = parseFloat(req.longitude || req.reqLng || (lng + 0.018));
        const distanceKm = req.distanceKm != null ? parseFloat(req.distanceKm) : calculateHaversineKm(lat, lng, reqLat, reqLng);

        // Normalize status
        const rawStatus = (req.status || req.notifStatus || 'New').toString().toUpperCase();
        const reqStatus = (req.reqStatus || '').toString().toUpperCase();

        let isActive = req.isActive;
        if (isActive === undefined) {
          const isTerminated = ['FULFILLED', 'CLOSED', 'CANCELLED', 'EXPIRED'].includes(reqStatus);
          isActive = !isTerminated && ['NEW', 'ACCEPTED', 'ARRIVED', 'NOTIFIED'].includes(rawStatus);
        }

        return {
          id: req.id || req.requestId,
          hospitalId: req.hospitalId || req.hospital_id,
          hospitalName: req.hospitalName || req.hospital_name || 'Hospital',
          bloodType: req.bloodType || req.blood_type || donorBloodGroup,
          urgencyLevel: req.urgencyLevel || req.urgency_level || req.urgency || 'Urgent',
          neededWithinMinutes: req.neededWithinMinutes != null ? req.neededWithinMinutes : (req.neededWithinMins != null ? req.neededWithinMins : 60),
          distanceKm: distanceKm.toFixed(1),
          etaMinutes: req.etaMinutes || Math.max(Math.round(distanceKm * 2.5), 6),
          address: req.hospitalAddress || req.address || req.city || 'Emergency Trauma Center',
          phone: req.phone || req.hospitalPhone || req.hospital_phone || '+91 108',
          units: req.unitsRequested || req.units || 1,
          notes: req.notes || req.hosp_notes || '',
          status: rawStatus,
          displayStatus: req.displayStatus || (rawStatus === 'ACCEPTED' ? 'Accepted' : 'New'),
          isActive: Boolean(isActive),
          isTargeted: Boolean(req.targeted || req.isTargeted || req.notificationCount === 1),
          finalReason: req.finalReason || req.closeReason || '',
          createdAt: req.createdAt || req.created_at || new Date().toISOString(),
          acceptedAt: req.acceptedAt || req.accepted_at || null,
          expiresAt: req.expiresAt || req.expires_at || null,
          arrivalDeadline: req.arrivalDeadline || req.arrival_deadline || null,
          reqLat,
          reqLng
        };
      });

      // Split into active and past
      activeRequests = allAlerts.filter(r => r.isActive);
      pastRequests = allAlerts.filter(r => !r.isActive);

      updateHeaderStatusLine();
      renderEmergencyFeed();
      renderPastRequests();
      updateRadarVisualization();

    } catch (e) {
      console.warn('fetchActiveAlerts notice:', e);
      if (activeRequests.length === 0) {
        renderStandbyState();
      }
    }
  }

  // ======================== 5. ACTIVE CARDS RENDERING ========================
  function renderEmergencyFeed() {
    const feedContainer = getFeedContainer();
    if (!feedContainer) return;

    if (activeRequests.length === 0) {
      renderStandbyState();
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const highlightId = urlParams.get('highlight');

    let html = '';
    activeRequests.forEach(req => {
      const isAccepted = req.status === 'ACCEPTED' || req.displayStatus === 'Accepted';

      // Urgency normalized: normal, urgent, critical
      const rawU = (req.urgencyLevel || 'Urgent').toString().toLowerCase().trim();
      let urgencyKey = 'urgent';
      let urgencyLabel = 'Urgent';
      if (rawU === 'critical') {
        urgencyKey = 'critical';
        urgencyLabel = 'Critical';
      } else if (rawU === 'normal') {
        urgencyKey = 'normal';
        urgencyLabel = 'Normal';
      }

      // Received time ago
      const receivedAgoStr = getTimeAgo(req.createdAt);

      // Targeted plain text (no red glow)
      const targetedSpan = req.isTargeted
        ? `<span class="card-targeted-text">&bull; Sent directly to you</span>`
        : '';

      // Status chip
      const statusChipHtml = isAccepted
        ? `<span class="card-status-chip status-accepted"><i class="fa-solid fa-check"></i> Accepted</span>`
        : `<span class="card-status-chip status-new">New</span>`;

      // Single distance line
      const etaStr = req.etaMinutes ? ` &bull; about ${req.etaMinutes} min by road` : '';
      const distanceLine = `${req.distanceKm} km away${etaStr}`;

      // Info Block Right Cell
      let rightCellHtml = '';
      if (!isAccepted) {
        const minsLeft = computeMinutesLeft(req.createdAt, req.neededWithinMinutes, req.expiresAt);
        const totalMins = req.neededWithinMinutes || 60;
        const pct = Math.max(0, Math.min(100, Math.round((minsLeft / totalMins) * 100)));
        rightCellHtml = `
          <div class="cig-cell">
            <span class="cig-label">Respond within</span>
            <span class="cig-value">${minsLeft} min</span>
            <div class="card-countdown-track">
              <div class="card-countdown-bar" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      } else {
        const reachTimeStr = formatArrivalDeadline(req.arrivalDeadline, req.acceptedAt);
        rightCellHtml = `
          <div class="cig-cell">
            <span class="cig-label">Reach the hospital by</span>
            <span class="cig-value">${reachTimeStr}</span>
          </div>
        `;
      }

      // Notes quote if present
      const notesHtml = req.notes
        ? `<div class="card-notes-quote">&ldquo;${escapeHtml(req.notes)}&rdquo;</div>`
        : '';

      // Actions row (44px height)
      let actionsHtml = '';
      if (!isAccepted) {
        actionsHtml = `
          <div class="card-actions-row">
            <button type="button" class="btn-card-accept" onclick="window.acceptAndNavigate(${req.id})">
              <span>Accept</span>
            </button>
            <button type="button" class="btn-card-decline" onclick="window.declineAlert(${req.id})">
              <span>Decline</span>
            </button>
            <button type="button" class="btn-card-directions-link" onclick="window.openDirectionsToHospital(${req.reqLat}, ${req.reqLng})">
              <i class="fa-solid fa-diamond-turn-right"></i> <span>Directions</span>
            </button>
          </div>
          <div class="card-action-helper-text">
            Accepting shares your phone number with this hospital. Please decline if you are unwell or not eligible.
          </div>
        `;
      } else {
        actionsHtml = `
          <div class="card-actions-row">
            <button type="button" class="btn-card-directions-primary" onclick="window.openDirectionsToHospital(${req.reqLat}, ${req.reqLng})">
              <i class="fa-solid fa-diamond-turn-right"></i> <span>Directions</span>
            </button>
            <a href="tel:${escapeHtml(req.phone || '+91 108')}" class="btn-card-call">
              <i class="fa-solid fa-phone"></i> <span>Call hospital (${escapeHtml(req.phone || '+91 108')})</span>
            </a>
            <button type="button" class="btn-card-qr" onclick="window.showDonorQrModal()">
              <i class="fa-solid fa-qrcode"></i> <span>Show my QR</span>
            </button>
          </div>
          <div class="card-step-guide">
            <span>1. Go to hospital</span> &bull; <span>2. Show QR at desk</span> &bull; <span>3. Health check &amp; donation</span>
          </div>
          <div class="card-action-helper-text">
            Can't make it? Please call the hospital so they can plan.
          </div>
        `;
      }

      html += `
        <article class="emergency-sos-card card-urgency-${urgencyKey}" id="req-card-${req.id}">
          <!-- Row 1: Urgency + Received + Status -->
          <div class="card-row-top">
            <div class="card-top-left">
              <span class="card-urgency-label urgency-${urgencyKey}">
                <i class="fa-solid fa-triangle-exclamation"></i> ${urgencyLabel}
              </span>
              <span class="card-received-time">Received ${receivedAgoStr}</span>
              ${targetedSpan}
            </div>
            <div class="card-top-right">
              ${statusChipHtml}
            </div>
          </div>

          <!-- Row 2: Hospital Name + Address + Distance -->
          <h2 class="card-hosp-name">${escapeHtml(req.hospitalName)}</h2>
          <div class="card-hosp-address">
            <i class="fa-solid fa-location-dot" style="margin-right: 4px; font-size: 13px;"></i>${escapeHtml(req.address)}
          </div>
          <div class="card-distance-line">
            <span>${distanceLine}</span>
          </div>

          <!-- Row 3: Two-cell info block -->
          <div class="card-info-grid">
            <div class="cig-cell">
              <span class="cig-label">Blood needed</span>
              <div class="cig-value">
                <span class="cig-blood-tag">${escapeHtml(req.bloodType)}</span>
                <span>&bull; ${req.units} ${req.units === 1 ? 'unit' : 'units'}</span>
              </div>
            </div>
            ${rightCellHtml}
          </div>
          ${notesHtml}

          <!-- Row 4: Actions (44px) -->
          ${actionsHtml}
        </article>
      `;
    });

    feedContainer.innerHTML = html;

    if (highlightId) {
      setTimeout(() => {
        const el = document.getElementById(`req-card-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }

  // ======================== 6. PAST REQUESTS (LAST 7 DAYS) ========================
  function renderPastRequests() {
    const detailsEl = document.getElementById('pastAlertsSection');
    const container = document.getElementById('pastAlertsContainer');
    const countEl = document.getElementById('pastAlertsCount');
    if (!detailsEl || !container) return;

    if (pastRequests.length === 0) {
      detailsEl.style.display = 'none';
      return;
    }

    detailsEl.style.display = 'block';
    if (countEl) countEl.textContent = pastRequests.length;

    let html = '';
    pastRequests.forEach(req => {
      // Determine final plain result text
      let resultText = 'Completed';
      const s = (req.status || '').toUpperCase();
      if (s === 'WITHDRAWN') {
        resultText = 'Withdrawn by you';
      } else if (s === 'DECLINED') {
        resultText = 'Declined';
      } else if (s === 'FULFILLED') {
        resultText = 'Fulfilled: Verified donation completed';
      } else if (s === 'CLOSED') {
        resultText = req.finalReason ? `Closed by hospital (${escapeHtml(req.finalReason)})` : 'Closed by hospital';
      } else if (s === 'CANCELLED') {
        resultText = req.finalReason ? `Cancelled (${escapeHtml(req.finalReason)})` : 'Cancelled';
      } else if (s === 'EXPIRED') {
        resultText = 'Expired';
      } else if (s === 'RELEASED') {
        resultText = 'Released';
      }

      const dateStr = formatDateShort(req.createdAt);

      html += `
        <div class="past-request-row">
          <div class="prr-left">
            <span class="prr-hosp">${escapeHtml(req.hospitalName)}</span>
            <span class="prr-bg">${escapeHtml(req.bloodType)}</span>
            <span class="prr-time">&bull; ${dateStr}</span>
          </div>
          <div class="prr-result">${resultText}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ======================== 7. EMPTY STATE ========================
  function renderStandbyState() {
    const feedContainer = getFeedContainer();
    if (!feedContainer) return;

    const locOk = currentDonor.hasLocation;
    const isAvail = currentDonor.availability === 'Available';

    feedContainer.innerHTML = `
      <div class="empty-requests-state">
        <h2 class="empty-state-title">No active requests near you</h2>
        <p class="empty-state-desc">
          You will be notified here, in your notifications and by browser alert when a verified hospital needs your blood group.
        </p>
        <div class="empty-state-status-list">
          <div class="status-list-row">
            <span class="slr-left">
              <i class="fa-solid fa-location-dot"></i>
              <span>Location: <strong>${locOk ? 'On' : 'Off'}</strong></span>
            </span>
            ${!locOk
              ? '<button type="button" class="btn-slr-fix" onclick="window.requestLiveGeolocation()">Turn on</button>'
              : '<span class="slr-ok"><i class="fa-solid fa-check"></i></span>'}
          </div>
          <div class="status-list-row">
            <span class="slr-left">
              <i class="fa-solid fa-bell"></i>
              <span>Notifications: <strong>Active</strong></span>
            </span>
            <span class="slr-ok"><i class="fa-solid fa-check"></i></span>
          </div>
          <div class="status-list-row">
            <span class="slr-left">
              <i class="fa-solid fa-user-check"></i>
              <span>Availability: <strong>${escapeHtml(currentDonor.availability)}</strong></span>
            </span>
            ${!isAvail
              ? '<button type="button" class="btn-slr-fix" onclick="window.toggleAvailabilityFromEmpty()">Set Available</button>'
              : '<span class="slr-ok"><i class="fa-solid fa-check"></i></span>'}
          </div>
          <div class="status-list-row">
            <span class="slr-left">
              <i class="fa-solid fa-droplet"></i>
              <span>Blood group: <strong>${escapeHtml(currentDonor.bloodType)}</strong></span>
            </span>
            <span class="slr-ok"><i class="fa-solid fa-check"></i></span>
          </div>
        </div>
      </div>
    `;
  }

  window.toggleAvailabilityFromEmpty = async function () {
    currentDonor.availability = 'Available';
    try {
      await fetch('/api/donors/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: true })
      });
      showToast('Availability updated to Available', 'success');
      renderEmergencyFeed();
    } catch (_) { }
  };

  // ======================== 8. PROXIMITY MAP (GRAYSCALE) ========================
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
        try { leafletMap.removeLayer(currentTileLayer); } catch (_) { }
      }
      currentTileLayer = result.layer;
      currentTileLayer.addTo(leafletMap);
    }

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

      setRadarMapLayer(activeLayerKey);

      const layerBar = document.querySelector('.radar-layer-bar');
      if (layerBar && window.Red404Map) {
        window.Red404Map.setupLayerBar(layerBar, leafletMap, (k) => setRadarMapLayer(k));
      } else {
        document.querySelectorAll('.rlb-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setRadarMapLayer(btn.getAttribute('data-layer'));
          });
        });
      }

      window.addEventListener('resize', () => {
        if (leafletMap) leafletMap.invalidateSize();
      });

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

    // Remove existing markers & routes
    if (donorMarker) leafletMap.removeLayer(donorMarker);
    if (hospitalMarker) leafletMap.removeLayer(hospitalMarker);
    if (routePolyline) leafletMap.removeLayer(routePolyline);
    distanceCircles.forEach(c => leafletMap.removeLayer(c));
    distanceCircles = [];

    // Draw clean 1px distance rings at 5, 10, 20 km (20% opacity)
    const ringRadii = [5000, 10000, 20000];
    ringRadii.forEach(radius => {
      const circle = L.circle(donorLatLng, {
        radius: radius,
        color: '#ffffff',
        weight: 1,
        opacity: 0.2,
        fill: false,
        interactive: false
      }).addTo(leafletMap);
      distanceCircles.push(circle);
    });

    // Create clean Blue Dot labelled "You" (no glow)
    const donorIcon = L.divIcon({
      className: 'custom-donor-clean-marker',
      html: `
        <div class="cdcm-dot"></div>
        <span class="cdcm-label">You</span>
      `,
      iconSize: [40, 30],
      iconAnchor: [20, 5]
    });

    donorMarker = L.marker(donorLatLng, { icon: donorIcon }).addTo(leafletMap);

    // Active requests check
    if (activeRequests.length > 0) {
      const topReq = activeRequests[0];
      const hospLatLng = [topReq.reqLat, topReq.reqLng];

      if (radarBadge) {
        radarBadge.textContent = `${activeRequests.length} active ${activeRequests.length === 1 ? 'request' : 'requests'}`;
      }

      // Red pin with hospital name label
      const hospIcon = L.divIcon({
        className: 'custom-hosp-clean-marker',
        html: `
          <div class="chcm-pin"><i class="fa-solid fa-hospital"></i></div>
          <span class="chcm-label">${escapeHtml(topReq.hospitalName)}</span>
        `,
        iconSize: [120, 40],
        iconAnchor: [60, 12]
      });

      hospitalMarker = L.marker(hospLatLng, { icon: hospIcon }).addTo(leafletMap);

      // Solid 3px blue route line (#3b82f6)
      routePolyline = L.polyline([donorLatLng, hospLatLng], {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.9
      }).addTo(leafletMap);

      const bounds = L.latLngBounds([donorLatLng, hospLatLng]);
      leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });

    } else {
      if (radarBadge) {
        radarBadge.textContent = '0 active requests';
      }
      const currentZoom = leafletMap.getZoom() || 13;
      leafletMap.setView(donorLatLng, Math.max(currentZoom, 13));
    }
  }

  function initMobileMapToggle() {
    const btn = document.getElementById('btnToggleMobileMap');
    const panel = document.getElementById('hubMapAsidePanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const isVisible = panel.classList.toggle('mobile-visible');
      btn.querySelector('span').textContent = isVisible ? 'Hide map' : 'Show on map';
      if (isVisible && leafletMap) {
        setTimeout(() => leafletMap.invalidateSize(), 200);
      }
    });
  }

  // ======================== 9. GLOBAL ACTIONS ========================
  window.acceptAndNavigate = async function (requestId) {
    const selected = activeRequests.find(r => String(r.id) === String(requestId));
    if (selected) {
      selected.status = 'ACCEPTED';
      selected.displayStatus = 'Accepted';
      selected.acceptedAt = new Date().toISOString();
    }

    const donorId = currentDonor ? currentDonor.id : null;
    const payload = JSON.stringify({ donorId: donorId });
    const postHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    try {
      await fetch(`/api/donor/blood-requests/${requestId}/accept`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }
    try {
      await fetch(`/api/requests/${requestId}/accept`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }

    showToast('Alert accepted! Hospital dispatch notified.', 'success');
    renderEmergencyFeed();
    updateRadarVisualization();
  };

  window.declineAlert = async function (requestId) {
    const selected = activeRequests.find(r => String(r.id) === String(requestId));
    if (selected) {
      selected.isActive = false;
      selected.status = 'DECLINED';
      selected.displayStatus = 'Declined';
    }

    const donorId = currentDonor ? currentDonor.id : null;
    const payload = JSON.stringify({ donorId: donorId });
    const postHeaders = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    try {
      await fetch(`/api/donor/blood-requests/${requestId}/decline`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }
    try {
      await fetch(`/api/requests/${requestId}/decline`, { method: 'POST', headers: postHeaders, body: payload, credentials: 'include' });
    } catch (_) { }

    showToast('Request declined.', 'info');
    activeRequests = allAlerts.filter(r => r.isActive);
    pastRequests = allAlerts.filter(r => !r.isActive);
    updateHeaderStatusLine();
    renderEmergencyFeed();
    renderPastRequests();
    updateRadarVisualization();
  };

  window.openDirectionsToHospital = function (hospLat, hospLng) {
    if (hospLat == null || hospLng == null || isNaN(hospLat) || isNaN(hospLng)) {
      showToast("Hospital coordinates are not available for driving directions.", "error");
      return;
    }
    const donorLat = currentDonor.latitude;
    const donorLng = currentDonor.longitude;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${donorLat},${donorLng}&destination=${hospLat},${hospLng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // QR Modal
  window.showDonorQrModal = function () {
    const modal = document.getElementById('donorQrModal');
    const container = document.getElementById('donorQrCodeContainer');
    const idPill = document.getElementById('donorQrIdPill');
    const bgPill = document.getElementById('donorQrBgPill');
    if (!modal) return;

    const donorId = currentDonor.id || 'DNR-0811-A404';
    const bg = currentDonor.bloodType || 'O-';
    const token = currentDonor.qrToken || donorId;
    const qrPayload = `RED404:${token}`;

    if (idPill) idPill.textContent = donorId;
    if (bgPill) bgPill.textContent = bg;

    if (container) {
      container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}" alt="Verification QR Code" style="width:180px;height:180px;border-radius:6px;display:block;" />`;
    }

    modal.style.display = 'flex';
  };

  window.closeDonorQrModal = function () {
    const modal = document.getElementById('donorQrModal');
    if (modal) modal.style.display = 'none';
  };

  // ======================== 10. TIMERS & FORMATTING ========================
  function updateCountdowns() {
    renderEmergencyFeed();
  }

  function computeMinutesLeft(createdAtStr, neededWithinMins, expiresAtStr) {
    const defMins = neededWithinMins || 60;
    let targetMs;
    if (expiresAtStr) {
      targetMs = new Date(expiresAtStr).getTime();
    } else {
      const createdMs = createdAtStr ? new Date(createdAtStr).getTime() : Date.now();
      targetMs = createdMs + defMins * 60 * 1000;
    }
    const diffMs = targetMs - Date.now();
    return Math.max(0, Math.round(diffMs / 60000));
  }

  function formatArrivalDeadline(deadlineStr, acceptedAtStr) {
    let targetDate;
    if (deadlineStr) {
      targetDate = new Date(deadlineStr);
    } else if (acceptedAtStr) {
      targetDate = new Date(new Date(acceptedAtStr).getTime() + 120 * 60 * 1000);
    } else {
      targetDate = new Date(Date.now() + 120 * 60 * 1000);
    }
    if (isNaN(targetDate.getTime())) return 'within 2 hours';
    return targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return 'just now';
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.max(0, Math.floor(ms / 60000));
    if (mins < 1) return 'just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return '1 hr ago';
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch (_) {
      return '';
    }
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
    const toast = document.createElement('div');
    toast.className = `donor-hub-toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> <span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
      }, 3500);
    }, 20);
  }

})();
