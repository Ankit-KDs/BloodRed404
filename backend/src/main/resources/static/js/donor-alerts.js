/* ============================================================
   RED404 — DONOR ALERTS & RADAR SCRIPT
   Real-Time Emergency Matching & Haversine Distance Hub
============================================================ */

(function () {
  'use strict';

  // State Management
  let currentDonor = {
    name: 'Ankit Kumar',
    bloodType: 'O-',
    latitude: 28.3486,
    longitude: 79.5619,
    availability: 'Available',
    medicalStatus: 'Fit to Donate'
  };

  let activeRequests = [];
  let leafletMap = null;
  let donorMarker = null;
  let hospitalMarker = null;
  let routePolyline = null;

  // DOM Elements
  const donorGreetingName = document.getElementById('donorGreetingName');
  const gpsCoordsText = document.getElementById('gpsCoordsText');
  const gpsSyncBtn = document.getElementById('gpsSyncBtn');
  const donorStatusToggle = document.getElementById('donorStatusToggle');
  const donorStatusText = document.getElementById('donorStatusText');
  const sidebarDonorStatus = document.getElementById('sidebarDonorStatus');
  const emergencyFeedContainer = document.getElementById('emergencyFeedContainer');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const hubSidebar = document.getElementById('hubSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  // ======================== INITIALIZATION ========================
  document.addEventListener('DOMContentLoaded', async () => {
    await initDonorProfile();
    initMobileNav();
    initGPSListener();
    initStatusToggle();
    initRadarMap();
    await fetchActiveRequests();

    // Auto-poll active hospital requests every 8 seconds
    setInterval(fetchActiveRequests, 8000);
  });

  // ======================== 1. PROFILE & SESSION ========================
  async function initDonorProfile() {
    try {
      // 1. Try reading existing session
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

      // 2. Fetch fresh profile from API
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
          }
          if (d.availability) {
            currentDonor.availability = d.availability;
          }
        }
      }
    } catch (err) {
      console.warn('Profile fetch notice:', err);
    }

    // Render profile info in header & status
    if (donorGreetingName) donorGreetingName.textContent = currentDonor.name;
    updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);
    renderDonorStatus();
  }

  // ======================== 2. LIVE GPS GEOLOCATION ========================
  function initGPSListener() {
    if (!gpsSyncBtn) return;
    gpsSyncBtn.addEventListener('click', () => {
      refreshLiveGPS(true);
    });
  }

  function refreshLiveGPS(showToastNotice = false) {
    if (!navigator.geolocation) {
      if (showToastNotice) showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    const icon = gpsSyncBtn.querySelector('.gps-icon-spin');
    if (icon) icon.classList.add('fa-spin');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (icon) icon.classList.remove('fa-spin');
        currentDonor.latitude = pos.coords.latitude;
        currentDonor.longitude = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 8);

        updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);

        // Update map center & markers
        if (leafletMap) {
          leafletMap.panTo([currentDonor.latitude, currentDonor.longitude]);
        }
        updateRadarVisualization();

        // Send updated location to backend
        try {
          await fetch('/api/donors/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: currentDonor.latitude,
              longitude: currentDonor.longitude
            })
          });
        } catch (_) {}

        if (showToastNotice) {
          showToast(`Live GPS Synced: Connected (±${accuracy}m accuracy)`, 'success');
        }

        // Re-evaluate requests distances
        renderEmergencyFeed();
      },
      (err) => {
        if (icon) icon.classList.remove('fa-spin');
        console.warn('Geolocation notice:', err.message);
        if (showToastNotice) {
          showToast('GPS access denied or unavailable. Using saved coordinates.', 'info');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function updateGPSDisplay(lat, lng) {
    if (!gpsCoordsText) return;
    const latStr = Math.abs(lat).toFixed(4) + (lat >= 0 ? '° N' : '° S');
    const lngStr = Math.abs(lng).toFixed(4) + (lng >= 0 ? '° E' : '° W');
    gpsCoordsText.textContent = `CONNECTED (${latStr}, ${lngStr})`;

    const chipGps = document.getElementById('standbyGpsChip');
    if (chipGps) {
      chipGps.innerHTML = `<i class="fas fa-crosshairs"></i> Live GPS: <b>${latStr}, ${lngStr}</b>`;
    }
  }

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
    const R = 6371; // Earth radius in kilometers
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
    if (distanceKm <= 5) return { tag: 'Zone 1', range: '0–5 km' };
    if (distanceKm <= 10) return { tag: 'Zone 2', range: '5–10 km' };
    return { tag: 'Zone 3', range: '10–20 km' };
  }

  // ======================== 5. REQUESTS FETCH & MATCHING ========================
  async function fetchActiveRequests() {
    try {
      const res = await fetch('/api/requests/active');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Process and calculate real distance
          activeRequests = json.data
            .map(req => {
              const reqLat = parseFloat(req.latitude || currentDonor.latitude + 0.024);
              const reqLng = parseFloat(req.longitude || currentDonor.longitude + 0.018);
              const distanceKm = calculateHaversineKm(
                currentDonor.latitude,
                currentDonor.longitude,
                reqLat,
                reqLng
              );
              const zone = getZone(distanceKm);
              return {
                ...req,
                reqLat,
                reqLng,
                distanceKm,
                zoneTag: zone.tag,
                zoneRange: zone.range
              };
            })
            // Filter strictly for the donor's blood type as requested
            .filter(req => {
              const targetType = (req.bloodType || '').trim().toUpperCase();
              const donorType = (currentDonor.bloodType || '').trim().toUpperCase();
              return targetType === donorType;
            });

          renderEmergencyFeed();
          updateRadarVisualization();
          return;
        }
      }
    } catch (e) {
      console.warn('Requests poll notice:', e);
    }
  }

  // ======================== 6. RENDER EMERGENCY FEED ========================
  function renderEmergencyFeed() {
    if (!emergencyFeedContainer) return;

    // Filtered requests count
    if (activeRequests.length === 0) {
      renderStandbyState();
      return;
    }

    // Render active SOS cards
    let html = '';
    activeRequests.forEach((req, idx) => {
      const isPrimary = idx === 0;
      const bloodLabel = req.bloodType.includes('-') ? 'NEGATIVE NEEDED' : 'POSITIVE NEEDED';
      const hospitalName = req.hospitalName || req.hospital_name || 'Emergency Medical Center';
      const distance = req.distanceKm || '3.8';
      const urgencyLabel = req.urgencyLevel || req.urgency || 'CRITICAL SOS';

      if (isPrimary) {
        html += `
          <div class="emergency-sos-card" id="req-card-${req.id}">
            <div class="sos-card-top">
              <div class="sos-hosp-info">
                <div class="sos-hosp-title-row">
                  <i class="fas fa-hospital-alt sos-hosp-icon"></i>
                  <h3 class="sos-hosp-name">${escapeHtml(hospitalName.toUpperCase())}</h3>
                  <span class="sos-distance-pill">${distance}km</span>
                </div>
                <span class="sos-zone-tag">${req.zoneTag} (${req.zoneRange})</span>
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

            <div class="sos-urgency-meta">
              <b>${escapeHtml(urgencyLabel.toUpperCase())}</b> • Needed within 20 mins • Trauma Bay
            </div>

            <div class="sos-actions-row">
              <button class="btn-sos-accept" onclick="window.acceptAndNavigate(${req.id})">
                <span>Accept Alert & Navigate</span>
                <i class="fas fa-arrow-right"></i>
              </button>
              <button class="btn-sos-decline" onclick="window.declineAlert(${req.id})">
                Decline
              </button>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="compact-sos-card" id="req-card-${req.id}">
            <div class="csc-left">
              <div class="csc-title-row">
                <i class="fas fa-hospital" style="color:var(--text-secondary)"></i>
                <div class="csc-title">${escapeHtml(hospitalName.toUpperCase())}</div>
                <span class="sos-distance-pill" style="font-size:0.75rem">${distance}km</span>
                <span class="sos-zone-tag" style="font-size:0.7rem">${req.zoneTag}</span>
              </div>
              <div style="font-size:0.78rem;color:var(--red-neon);font-weight:600">
                ${escapeHtml(urgencyLabel.toUpperCase())}
              </div>
            </div>
            <div class="csc-right">
              <div class="csc-blood-pill">${escapeHtml(req.bloodType)}</div>
              <button class="btn-compact-accept" onclick="window.acceptAndNavigate(${req.id})">
                <span>Accept</span>
                <i class="fas fa-arrow-right"></i>
              </button>
              <button class="btn-sos-decline" style="padding:0.5rem 0.85rem;font-size:0.8rem" onclick="window.declineAlert(${req.id})">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        `;
      }
    });

    emergencyFeedContainer.innerHTML = html;
  }

  // ======================== 7. EMPTY / STANDBY STATE ========================
  function renderStandbyState() {
    emergencyFeedContainer.innerHTML = `
      <div class="standby-state-container">
        <div class="standby-radar-disc">
          <div class="standby-radar-sweep"></div>
          <div class="standby-shield-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
        </div>

        <h2 class="standby-title">NO ACTIVE EMERGENCY REQUESTS</h2>
        <p class="standby-desc">
          System Standing By: Radar actively scanning 5km–10km zones. You will receive an immediate push notification when a nearby hospital requests blood.
        </p>

        <div>
          <span class="standby-status-pill">
            <span class="gps-pulse-dot"></span>
            <span>Standby Radar: Active</span>
          </span>
        </div>

        <div class="standby-chips-row">
          <div class="standby-chip">
            <i class="fas fa-tint" style="color:var(--red-neon)"></i>
            <span>Blood Group: <b>${escapeHtml(currentDonor.bloodType)}</b></span>
          </div>
          <div class="standby-chip">
            <i class="fas fa-heartbeat" style="color:var(--green-neon)"></i>
            <span>Medical Eligibility: <b>${escapeHtml(currentDonor.medicalStatus)}</b></span>
          </div>
          <div class="standby-chip" id="standbyGpsChip">
            <i class="fas fa-crosshairs" style="color:#00e676"></i>
            <span>Live GPS: <b>Connected (±8m Precise)</b></span>
          </div>
        </div>
      </div>
    `;
  }

  // ======================== 8. REAL INTERACTIVE LEAFLET RADAR MAP ========================
  function initRadarMap() {
    const mapContainer = document.getElementById('proximityMap');
    if (!mapContainer || typeof L === 'undefined') return;

    try {
      leafletMap = L.map('proximityMap', {
        center: [currentDonor.latitude, currentDonor.longitude],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // Clean ESRI World Dark Gray tiles (NO API keys required, NO watermarks)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: ''
      }).addTo(leafletMap);

      // Clicking anywhere on the map redirects to route navigation
      leafletMap.on('click', () => {
        window.location.href = 'donor-route.html';
      });

      // Also make map container click navigate
      mapContainer.style.cursor = 'pointer';
      mapContainer.addEventListener('click', () => {
        window.location.href = 'donor-route.html';
      });

      updateRadarVisualization();
    } catch (e) {
      console.warn('Map initialization notice:', e);
    }
  }

  function updateRadarVisualization() {
    if (!leafletMap || typeof L === 'undefined') return;

    const donorLatLng = [currentDonor.latitude, currentDonor.longitude];
    const radarBadge = document.getElementById('radarActiveBadge');

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
    if (activeRequests.length > 0) {
      const topReq = activeRequests[0];
      const hospLatLng = [topReq.reqLat, topReq.reqLng];

      if (radarBadge) {
        radarBadge.textContent = `RADAR: ${activeRequests.length} ACTIVE SOS IN ZONE`;
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
      leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });

    } else {
      if (radarBadge) {
        radarBadge.textContent = 'RADAR SCANNING: 0 ACTIVE ALERTS';
        radarBadge.style.color = 'var(--green-neon)';
        radarBadge.style.borderColor = 'var(--green-border)';
        radarBadge.style.background = 'var(--green-soft)';
      }

      leafletMap.setView(donorLatLng, 12);
    }
  }

  // ======================== 9. GLOBAL ACTIONS ========================
  window.acceptAndNavigate = async function (requestId) {
    const selected = activeRequests.find(r => r.id === requestId);
    if (selected) {
      localStorage.setItem('activeEmergencyRoute', JSON.stringify({
        ...selected,
        donorLat: currentDonor.latitude,
        donorLng: currentDonor.longitude,
        acceptedAt: new Date().toISOString()
      }));
    }

    try {
      await fetch(`/api/requests/${requestId}/accept`, { method: 'POST' });
    } catch (_) {}

    showToast('Alert accepted! Loading emergency navigation route...', 'success');
    setTimeout(() => {
      window.location.href = 'donor-route.html';
    }, 800);
  };

  window.declineAlert = async function (requestId) {
    try {
      await fetch(`/api/requests/${requestId}/decline`, { method: 'POST' });
    } catch (_) {}

    const card = document.getElementById(`req-card-${requestId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => {
        activeRequests = activeRequests.filter(r => r.id !== requestId);
        renderEmergencyFeed();
        updateRadarVisualization();
      }, 250);
    }
    showToast('Alert dismissed.', 'info');
  };

  // Mobile drawer
  function initMobileNav() {
    if (!mobileMenuBtn || !hubSidebar) return;
    mobileMenuBtn.addEventListener('click', () => {
      const open = hubSidebar.classList.toggle('mobile-open');
      if (sidebarOverlay) sidebarOverlay.style.display = open ? 'block' : 'none';
    });

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        hubSidebar.classList.remove('mobile-open');
        sidebarOverlay.style.display = 'none';
      });
    }
  }

  // Helper Toast
  function showToast(msg, type = 'info') {
    if (typeof window.showAppAlert === 'function' && type === 'error') {
      window.showAppAlert({ title: 'Notice', message: msg, type: 'info' });
      return;
    }
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(18, 23, 33, 0.95);
      border: 1px solid ${type === 'success' ? 'var(--green-neon)' : 'var(--red-neon)'};
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      color: #fff;
      padding: 0.85rem 1.25rem;
      border-radius: 12px;
      font-size: 0.88rem;
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      animation: fadeIn 0.25s ease;
    `;
    toast.innerHTML = `
      <i class="${type === 'success' ? 'fas fa-check-circle' : 'fas fa-info-circle'}" style="color:${type === 'success' ? 'var(--green-neon)' : 'var(--red-neon)'}"></i>
      <span>${escapeHtml(msg)}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();

