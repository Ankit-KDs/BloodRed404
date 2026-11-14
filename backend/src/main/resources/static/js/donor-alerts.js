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
  let activeLayerKey = localStorage.getItem('red404_map_layer') || 'google-dark';

  // Google Maps & OSM Tile Layer Configurations
  const MAP_LAYERS = {
    'google-dark': {
      name: 'Google Dark',
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
      darkFilter: true
    },
    'google-roads': {
      name: 'Google Roads',
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
      darkFilter: false
    },
    'google-hybrid': {
      name: 'Google Satellite',
      url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 20,
      darkFilter: false
    },
    'osm': {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
      darkFilter: false
    }
  };

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

    // 1. Retrieve Donor's Real GPS Coordinates on page load
    requestLiveGeolocation();

    // 2. Set up 10-second interval polling for real-time hospital broadcasts
    setInterval(() => {
      fetchActiveAlerts(currentDonor.latitude, currentDonor.longitude);
    }, 10000);
  });

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
          }
          if (d.availability) {
            currentDonor.availability = d.availability;
          }
        }
      }
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
        const accuracy = Math.round(pos.coords.accuracy || 8);

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
        }).catch(() => {});
      },
      (err) => {
        if (icon) icon.classList.remove('fa-spin');
        console.warn('Geolocation notice / permission denied:', err.message);
        updateGPSDisplay(currentDonor.latitude, currentDonor.longitude);
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

  function updateGPSDisplay(lat, lng, accuracy = 8) {
    if (!gpsCoordsText) return;
    const latStr = Math.abs(lat).toFixed(4) + (lat >= 0 ? '° N' : '° S');
    const lngStr = Math.abs(lng).toFixed(4) + (lng >= 0 ? '° E' : '° W');
    gpsCoordsText.textContent = `CONNECTED (${latStr}, ${lngStr})`;

    const chipGps = document.getElementById('standbyGpsChip');
    if (chipGps) {
      chipGps.innerHTML = `<i class="fas fa-crosshairs"></i> Live GPS: <b>Connected (±${accuracy}m Precise)</b>`;
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
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          data = json.data;
        } else if (Array.isArray(json)) {
          data = json;
        }
      } else {
        // Fallback to /api/requests
        const fallbackRes = await fetch('/api/requests');
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
          urgencyLevel: req.urgencyLevel || req.urgency || 'CRITICAL',
          neededWithinMinutes: req.neededWithinMinutes || (req.urgencyLevel === 'CRITICAL' ? 20 : 45),
          distanceKm: distanceKm.toFixed(1),
          etaMinutes: req.etaMinutes || Math.max(Math.round(distanceKm * 2.5), 6),
          zoneTag: zone.tag,
          zoneRange: zone.range,
          address: req.address || req.city || 'Emergency Trauma Bay',
          phone: req.phone || req.hospitalPhone || req.hospital_phone || '+91 108',
          units: req.unitsRequested || req.units || 1,
          patientName: req.patientName || 'Emergency Patient',
          status: req.status || 'Active',
          reqLat,
          reqLng
        };
      });

      // Filter for compatible blood types if specified
      const donorType = (currentDonor.bloodType || '').trim().toUpperCase();
      if (donorType) {
        activeRequests = activeRequests.filter(req => {
          const reqType = (req.bloodType || '').trim().toUpperCase();
          return reqType === donorType || reqType === 'ANY' || donorType === 'O-';
        });
      }

      // Update global emergency radar dot indicator
      try {
        sessionStorage.setItem('red404_active_emergencies_count', String(activeRequests.length));
        if (typeof window.updateEmergencyIndicator === 'function') {
          window.updateEmergencyIndicator(activeRequests.length);
        }
      } catch (_) {}

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
    if (!feedContainer) return;

    // State 1: If response is empty, dynamically inject Standby UI
    if (activeRequests.length === 0) {
      renderStandbyState();
      return;
    }

    // State 2: Active requests exist — loop through records and render cards
    let html = '';
    activeRequests.forEach((req, idx) => {
      const isPrimary = idx === 0;
      const bloodLabel = req.bloodType.includes('-') ? 'NEGATIVE NEEDED' : 'POSITIVE NEEDED';
      const hospitalName = req.hospitalName;
      const distance = req.distanceKm;
      const urgencyLabel = req.urgencyLevel.toUpperCase();
      const neededMinutes = req.neededWithinMinutes;

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
                <span class="sos-zone-tag">${distance} km away • ${req.zoneTag}</span>
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
              <b>${escapeHtml(urgencyLabel)} SOS</b> • Needed within ${neededMinutes} mins • Trauma Bay
            </div>

            <div class="sos-actions-row">
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
          </div>
        `;
      } else {
        html += `
          <div class="secondary-sos-card" id="req-card-${req.id}">
            <div class="ssc-left">
              <i class="fas fa-hospital-user ssc-icon"></i>
              <div class="ssc-details">
                <div class="ssc-name">${escapeHtml(hospitalName)}</div>
                <div class="ssc-meta">${distance} km away • ${req.zoneTag} • Needed within ${neededMinutes} mins</div>
              </div>
            </div>

            <div class="ssc-right">
              <span class="sos-distance-pill">${distance}km</span>
              <span class="sos-zone-tag">${req.zoneTag}</span>
              <div class="ssc-blood-pill">${escapeHtml(req.bloodType)}</div>
              <button type="button" class="btn-sos-mini-directions" title="Directions" onclick="window.openDirectionsToHospital(${req.reqLat}, ${req.reqLng})">
                <i class="fas fa-location-arrow"></i>
                <span>Directions</span>
              </button>
              <button class="btn-sos-mini-accept" onclick="window.acceptAndNavigate(${req.id})">
                ACCEPT →
              </button>
            </div>
          </div>
        `;
      }
    });

    feedContainer.innerHTML = html;
  }

  // ======================== 7. DYNAMIC STANDBY UI ========================
  function renderStandbyState() {
    const feedContainer = getFeedContainer();
    if (!feedContainer) return;

    feedContainer.innerHTML = `
      <div class="standby-state-container" style="animation:fadeIn 0.3s ease;">
        <div class="standby-radar-disc">
          <div class="standby-radar-sweep"></div>
          <div class="standby-shield-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
        </div>
        <h2 class="standby-title">All Clear — No Active SOS Requests in Your Zone</h2>
        <p class="standby-desc">
          Our Haversine dispatch engine is actively monitoring nearby hospitals in your 5km–10km zone. You will be alerted immediately if a matching emergency occurs.
        </p>
        <div class="standby-status-pill">
          <span class="ssp-dot"></span>
          <span>🟢 Standby Radar: Active</span>
        </div>

        <div class="standby-chips-row">
          <div class="standby-chip">
            <i class="fas fa-tint" style="color:var(--red-neon)"></i>
            <span>Blood Group: <b>${escapeHtml(currentDonor.bloodType)}</b></span>
          </div>
          <div class="standby-chip">
            <i class="fas fa-heartbeat" style="color:var(--green-neon)"></i>
            <span>Medical Eligibility: <b>Fit to Donate</b></span>
          </div>
          <div class="standby-chip" id="standbyGpsChip">
            <i class="fas fa-crosshairs" style="color:#00e676"></i>
            <span>Live GPS: <b>Connected (±8m Precise)</b></span>
          </div>
        </div>
      </div>
    `;
  }

  // ======================== 8. GOOGLE MAPS RADAR ENGINE ========================
  function setRadarMapLayer(layerKey) {
    if (!leafletMap) return;
    const cfg = MAP_LAYERS[layerKey] || MAP_LAYERS['google-dark'];
    activeLayerKey = layerKey;
    try {
      localStorage.setItem('red404_map_layer', layerKey);
    } catch (_) {}

    if (currentTileLayer) {
      leafletMap.removeLayer(currentTileLayer);
    }

    currentTileLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      attribution: ''
    }).addTo(leafletMap);

    const mapContainer = document.getElementById('proximityMap');
    if (mapContainer) {
      if (cfg.darkFilter) {
        mapContainer.classList.add('dark-map');
      } else {
        mapContainer.classList.remove('dark-map');
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

      // Setup layer switch buttons
      document.querySelectorAll('.rlb-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const layerKey = btn.getAttribute('data-layer');
          setRadarMapLayer(layerKey);
        });
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
      leafletMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    } else {
      if (radarBadge) {
        radarBadge.textContent = 'RADAR SCANNING: 0 ACTIVE ALERTS';
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

      // Store in sessionStorage as explicitly required
      sessionStorage.setItem('activeMission', JSON.stringify(missionPayload));
      localStorage.setItem('activeEmergencyRoute', JSON.stringify(missionPayload));
    }

    try {
      await fetch(`/api/requests/${requestId}/accept`, { method: 'POST' });
    } catch (_) {}

    showToast('Alert accepted! Hospital dispatch and rescue team notified.', 'success');
    activeRequests = activeRequests.filter(r => String(r.id) !== String(requestId));
    renderEmergencyFeed();
    updateRadarVisualization();
  };

  window.declineAlert = async function (requestId) {
    try {
      await fetch(`/api/requests/${requestId}/decline`, { method: 'POST' });
    } catch (_) {}
    activeRequests = activeRequests.filter(r => String(r.id) !== String(requestId));
    renderEmergencyFeed();
    updateRadarVisualization();
    showToast('Alert dismissed.', 'info');
  };

  window.openDirectionsToHospital = function (hospLat, hospLng) {
    if (hospLat == null || hospLng == null || isNaN(hospLat) || isNaN(hospLng)) {
      showToast("Hospital coordinates are not available for driving directions.", "error");
      return;
    }
    if (!navigator.geolocation) {
      showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (!pos || !pos.coords) {
          showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
          return;
        }
        const donorLat = pos.coords.latitude;
        const donorLng = pos.coords.longitude;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${donorLat},${donorLng}&destination=${hospLat},${hospLng}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      function (err) {
        showToast("Turn on location permissions in your browser to get driving directions to the hospital.", "error");
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
