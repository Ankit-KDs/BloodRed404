/**
 * RED404 Unified Location Picker Component (Part 2)
 *
 * Requirements:
 * 1. Centered dialog, max-width 720px, full-screen sheet on phones, dimmed backdrop, z-index 100050.
 * 2. Body scroll locked, focus trapped, Esc & close button work, returns focus to opener.
 * 3. Title by role:
 *    - Donors: "Set your location" ("We use this to find requests near you. Hospitals never see your exact location.")
 *    - Hospitals: "Set hospital location" ("Donors see this location in directions")
 * 4. Layout: Search + "Use my current location" on one row, map below (360px desktop, 50% screen on phones),
 *    chosen address shown as text (never raw lat/long), footer Cancel and "Save location" (disabled until pin exists).
 * 5. Robust map rendering: map.invalidateSize() on open and resize.
 * 6. Clean Geolocation error handling: clear messages for denied/unavailable, never fake defaults.
 * 7. Supports modal dialog (openModal) and inline mounting (mountInline).
 */
(function (window) {
  'use strict';

  let activeModalOverlay = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  window.escapeHtml = escapeHtml;

  function createPickerDOM(isModal, options) {
    options = options || {};
    const role = (options.role || 'hospital').toLowerCase();
    const isDonor = role === 'donor';

    const titleText = isDonor ? 'Set your location' : 'Set hospital location';
    const helperText = isDonor
      ? 'We use this to find requests near you. Hospitals never see your exact location.'
      : 'Donors see this location in directions';

    const initialAddress = options.initialAddress || '';

    const wrapper = document.createElement('div');
    if (isModal) {
      wrapper.className = 'loc-picker-overlay';
      wrapper.id = 'locationPickerModal';
      wrapper.setAttribute('role', 'dialog');
      wrapper.setAttribute('aria-modal', 'true');
      wrapper.setAttribute('aria-labelledby', 'locPickerTitle');
    }

    const card = document.createElement('div');
    card.className = isModal ? 'loc-picker-dialog' : 'loc-picker-inline';

    card.innerHTML = `
      ${isModal ? `
        <div class="loc-picker-header">
          <div class="loc-picker-title-group">
            <h3 class="loc-picker-title" id="locPickerTitle">
              <i class="fas fa-location-dot" style="color: ${isDonor ? '#ef4444' : '#38bdf8'}; font-size: 1.1rem;"></i>
              <span>${escapeHtml(titleText)}</span>
            </h3>
            <p class="loc-picker-subtitle">${escapeHtml(helperText)}</p>
          </div>
          <button type="button" class="loc-picker-close-btn" id="locPickerCloseBtn" aria-label="Close dialog">&times;</button>
        </div>
      ` : ''}

      <div class="loc-picker-body">
        <div class="loc-picker-controls-row">
          <div class="loc-picker-search-wrap">
            <i class="fas fa-search loc-picker-search-icon"></i>
            <input type="text" class="loc-picker-search-input" id="locSearchInput"
              placeholder="Search address, landmark or area..."
              value="${escapeHtml(initialAddress)}" autocomplete="off" />
          </div>
          <button type="button" class="loc-btn-gps" id="locBtnGps" title="Acquire coordinates from browser GPS">
            <i class="fas fa-crosshairs"></i>
            <span>Use my current location</span>
          </button>
        </div>

        <div class="loc-map-frame">
          <div class="loc-map-hint">
            <i class="fas fa-hand-pointer"></i>
            <span>Click map or drag pin to position location</span>
          </div>
          <div class="loc-map-container" id="locPickerMap"></div>
        </div>

        <div class="loc-chosen-address-box">
          <i class="fas fa-map-pin"></i>
          <div class="loc-address-content">
            <div class="loc-address-label">Selected Area</div>
            <div class="loc-address-text" id="locDisplayAddress">${initialAddress ? escapeHtml(initialAddress) : 'Click the map or use search to set a location'}</div>
            <div class="loc-status-feedback" id="locStatusFeedback"></div>
          </div>
        </div>
      </div>

      <div class="loc-picker-footer">
        ${isModal ? `<button type="button" class="loc-btn-cancel" id="locBtnCancel">Cancel</button>` : ''}
        <button type="button" class="loc-btn-save" id="locBtnConfirm" disabled>
          <i class="fas fa-check"></i>
          <span>Save location</span>
        </button>
      </div>
    `;

    if (isModal) {
      wrapper.appendChild(card);
      return { container: wrapper, card: card };
    }
    return { container: card, card: card };
  }

  function initPickerLogic(rootEl, options) {
    let map = null;
    let pinMarker = null;
    let currentLat = options.initialLat ? parseFloat(options.initialLat) : null;
    let currentLng = options.initialLng ? parseFloat(options.initialLng) : null;
    let currentAddress = options.initialAddress || '';
    let currentAreaName = '';
    let currentCity = '';
    let currentState = '';
    let currentPincode = '';

    const mapEl = rootEl.querySelector('#locPickerMap');
    const searchInput = rootEl.querySelector('#locSearchInput');
    const gpsBtn = rootEl.querySelector('#locBtnGps');
    const addrDisplay = rootEl.querySelector('#locDisplayAddress');
    const statusFeedback = rootEl.querySelector('#locStatusFeedback');
    const confirmBtn = rootEl.querySelector('#locBtnConfirm');
    const cancelBtn = rootEl.querySelector('#locBtnCancel');
    const closeBtn = rootEl.querySelector('#locPickerCloseBtn');

    function showStatus(message, isError) {
      if (!statusFeedback) return;
      statusFeedback.textContent = message;
      statusFeedback.style.display = 'block';
      statusFeedback.style.color = isError ? '#f87171' : '#38bdf8';
    }

    function clearStatus() {
      if (!statusFeedback) return;
      statusFeedback.textContent = '';
      statusFeedback.style.display = 'none';
    }

    function updateState(lat, lng, addressText, skipGeocode) {
      if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
        currentLat = parseFloat(lat);
        currentLng = parseFloat(lng);
        confirmBtn.disabled = false;

        if (addressText) {
          currentAddress = addressText;
          addrDisplay.textContent = addressText;
          clearStatus();
        } else if (!skipGeocode) {
          addrDisplay.textContent = 'Resolving area name...';
          reverseGeocode(currentLat, currentLng, (resolvedData) => {
            currentAddress = resolvedData.fullAddress || resolvedData.areaName;
            currentAreaName = resolvedData.areaName;
            currentCity = resolvedData.city;
            currentState = resolvedData.state;
            currentPincode = resolvedData.pincode;
            addrDisplay.textContent = currentAddress || 'Selected Location';
            clearStatus();
          });
        }
      } else {
        currentLat = null;
        currentLng = null;
        addrDisplay.textContent = 'Click the map or use search to set a location';
        confirmBtn.disabled = true;
      }
    }

    function placePin(lat, lng, panTo) {
      if (typeof L === 'undefined') return;

      const pinIcon = L.divIcon({
        className: 'loc-custom-pin',
        html: `
          <svg viewBox="0 0 32 38" width="30" height="36" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
            <path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="#ef4444" stroke="#ffffff" stroke-width="1.8"/>
            <circle cx="16" cy="24" r="4.5" fill="#ffffff" />
          </svg>
        `,
        iconSize: [30, 36],
        iconAnchor: [15, 36]
      });

      if (!pinMarker) {
        pinMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);

        pinMarker.on('dragend', function () {
          const pos = pinMarker.getLatLng();
          updateState(pos.lat, pos.lng, null, false);
        });
      } else {
        pinMarker.setLatLng([lat, lng]);
      }

      if (panTo && map) {
        map.setView([lat, lng], Math.max(map.getZoom() || 13, 14), { animate: true });
      }
    }

    function parseNominatimAddress(data) {
      const a = (data && data.address) || {};
      const suburb = a.suburb || a.neighbourhood || a.subdistrict || a.quarter || '';
      const city = a.city || a.town || a.village || a.municipality || a.county || '';
      const state = a.state || '';
      const pincode = a.postcode || '';

      const houseNo = a.house_number || '';
      const road = a.road || a.street || '';
      const line1 = [houseNo, road].filter(Boolean).join(', ');
      const district = a.county || a.state_district || a.district || '';

      const parts = [];
      if (line1) parts.push(line1);
      if (suburb && !parts.includes(suburb)) parts.push(suburb);
      if (city && !parts.includes(city)) parts.push(city);
      if (district && district !== city && !parts.includes(district)) parts.push(district);
      if (state && !parts.includes(state)) parts.push(state);

      const areaName = parts.length > 0 ? parts.join(', ') : (data.display_name || 'Selected Location');
      return {
        areaName: areaName,
        fullAddress: data.display_name || areaName,
        line1: line1,
        locality: suburb,
        district: district,
        city: city,
        state: state,
        pincode: pincode,
        components: a
      };
    }

    function reverseGeocode(lat, lng, callback) {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      fetch(url)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            callback(parseNominatimAddress(data));
          } else {
            callback({
              areaName: 'Selected Location',
              fullAddress: 'Selected Location',
              city: '',
              state: '',
              pincode: ''
            });
          }
        })
        .catch(() => {
          callback({
            areaName: 'Selected Location',
            fullAddress: 'Selected Location',
            city: '',
            state: '',
            pincode: ''
          });
        });
    }

    function searchAddress(query) {
      if (!query || !query.trim()) return;
      searchInput.disabled = true;
      showStatus('Searching location...', false);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
      fetch(url)
        .then(res => res.ok ? res.json() : null)
        .then(results => {
          searchInput.disabled = false;
          if (results && results.length > 0) {
            const first = results[0];
            const lat = parseFloat(first.lat);
            const lng = parseFloat(first.lon);
            placePin(lat, lng, true);
            const parsed = parseNominatimAddress(first);
            currentAreaName = parsed.areaName;
            currentCity = parsed.city;
            currentState = parsed.state;
            currentPincode = parsed.pincode;
            updateState(lat, lng, first.display_name, true);
            clearStatus();
          } else {
            showStatus('No matching address found. Please try dragging the pin directly on the map.', true);
          }
        })
        .catch(err => {
          searchInput.disabled = false;
          console.error('Geocoding search failed:', err);
          showStatus('Could not search address at this time. Please click directly on the map.', true);
        });
    }

    function initMap() {
      if (typeof L === 'undefined') {
        setTimeout(initMap, 100);
        return;
      }

      const startLat = (currentLat && !isNaN(currentLat)) ? currentLat : 19.076090;
      const startLng = (currentLng && !isNaN(currentLng)) ? currentLng : 72.877426;

      map = L.map(mapEl, {
        center: [startLat, startLng],
        zoom: currentLat ? 15 : 12,
        zoomControl: true,
        attributionControl: false
      });

      // Unified base layer from Red404Map
      if (window.Red404Map) {
        const res = window.Red404Map.createTileLayer('dark', null, mapEl);
        if (res && res.layer) res.layer.addTo(map);
        if (res && res.isDark) mapEl.classList.add('dark-map');
      } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
      }

      // Map click places or moves the pin
      map.on('click', function (e) {
        placePin(e.latlng.lat, e.latlng.lng, false);
        updateState(e.latlng.lat, e.latlng.lng, null, false);
      });

      if (currentLat && currentLng) {
        placePin(currentLat, currentLng, false);
        updateState(currentLat, currentLng, currentAddress, !currentAddress);
      }

      // Auto-invalidate size as soon as rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 120);
      });

      window.addEventListener('resize', () => {
        if (map) map.invalidateSize();
      });
    }

    // Search events
    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchAddress(this.value);
        }
      });
    }

    // Geolocation handling (Requirement 5: Clear messages for denied/unavailable, never fake defaults)
    if (gpsBtn) {
      gpsBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          showStatus('Geolocation is not supported by your browser. Please search or click the map.', true);
          return;
        }

        gpsBtn.disabled = true;
        const origText = gpsBtn.querySelector('span').textContent;
        gpsBtn.querySelector('span').textContent = 'Acquiring location...';
        showStatus('Acquiring live location from device GPS...', false);

        navigator.geolocation.getCurrentPosition(
          function (pos) {
            gpsBtn.disabled = false;
            gpsBtn.querySelector('span').textContent = origText;
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            placePin(lat, lng, true);
            updateState(lat, lng, null, false);
            clearStatus();
          },
          function (err) {
            gpsBtn.disabled = false;
            gpsBtn.querySelector('span').textContent = origText;
            let msg = 'Could not acquire your current location. Please search address or click the map.';
            if (err) {
              if (err.code === 1) { // PERMISSION_DENIED
                msg = 'Location permission was denied. Please search your address or click directly on the map.';
              } else if (err.code === 2) { // POSITION_UNAVAILABLE
                msg = 'Location is currently unavailable on this device. Please search your address or click the map.';
              } else if (err.code === 3) { // TIMEOUT
                msg = 'Location request timed out. Please try again or search your address.';
              }
            }
            showStatus(msg, true);
            if (typeof showToast === 'function') {
              showToast(msg, 'warning', 4000);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // Confirm button
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (currentLat === null || currentLng === null) return;
        const result = {
          lat: parseFloat(currentLat.toFixed(6)),
          lng: parseFloat(currentLng.toFixed(6)),
          address: currentAddress || addrDisplay.textContent,
          areaName: currentAreaName || currentAddress || addrDisplay.textContent,
          city: currentCity,
          state: currentState,
          pincode: currentPincode
        };

        if (typeof options.onConfirm === 'function') {
          options.onConfirm(result);
        }
        if (options.closeOnConfirm && typeof options.close === 'function') {
          options.close();
        }
      });
    }

    // Cancel and Close buttons
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (typeof options.close === 'function') options.close();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (typeof options.close === 'function') options.close();
      });
    }

    initMap();

    return {
      getCoordinates: () => ({ lat: currentLat, lng: currentLng, address: currentAddress }),
      setCoordinates: (lat, lng, address) => {
        placePin(lat, lng, true);
        updateState(lat, lng, address, true);
      },
      invalidateSize: () => {
        if (map) map.invalidateSize();
      },
      destroy: () => {
        if (map) {
          map.remove();
          map = null;
        }
      }
    };
  }

  const LocationPicker = {
    /**
     * Opens Location Picker in a centered modal dialog (Part 2)
     */
    openModal: function (options) {
      options = options || {};

      // Close any active location picker dialog
      if (activeModalOverlay) {
        try { activeModalOverlay.remove(); } catch (_) { }
        activeModalOverlay = null;
      }

      // Remember opener for focus return
      const openerEl = options.opener || document.activeElement;

      // Lock body scroll
      const prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const { container, card } = createPickerDOM(true, options);
      document.body.appendChild(container);
      activeModalOverlay = container;

      function closeModal() {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = prevBodyOverflow || '';

        if (activeModalOverlay) {
          try { activeModalOverlay.remove(); } catch (_) { }
          activeModalOverlay = null;
        }
        if (pickerInstance) {
          pickerInstance.destroy();
        }
        if (openerEl && typeof openerEl.focus === 'function') {
          try { openerEl.focus(); } catch (_) { }
        }
        if (typeof options.onClose === 'function') {
          options.onClose();
        }
      }

      // Backdrop click closes dialog
      container.addEventListener('click', function (e) {
        if (e.target === container) {
          closeModal();
        }
      });

      // Focus trap & Escape key handler
      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeModal();
          return;
        }

        if (e.key === 'Tab') {
          const focusables = card.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }

      document.addEventListener('keydown', handleKeyDown);

      const pickerInstance = initPickerLogic(card, {
        initialLat: options.initialLat,
        initialLng: options.initialLng,
        initialAddress: options.initialAddress,
        role: options.role,
        closeOnConfirm: true,
        close: closeModal,
        onConfirm: function (data) {
          if (typeof options.onConfirm === 'function') {
            options.onConfirm(data);
          }
        }
      });

      // Initial focus on search input
      const searchInp = card.querySelector('#locSearchInput');
      if (searchInp) {
        setTimeout(() => { searchInp.focus(); }, 150);
      }

      return {
        close: closeModal,
        getInstance: () => pickerInstance
      };
    },

    /**
     * Mounts Location Picker inline inside an existing DOM container
     */
    mountInline: function (containerIdOrEl, options) {
      options = options || {};
      const target = typeof containerIdOrEl === 'string'
        ? document.getElementById(containerIdOrEl)
        : containerIdOrEl;

      if (!target) {
        console.error('LocationPicker: target container not found:', containerIdOrEl);
        return null;
      }

      target.innerHTML = '';
      const { container, card } = createPickerDOM(false, options);
      target.appendChild(container);

      const pickerInstance = initPickerLogic(card, {
        initialLat: options.initialLat,
        initialLng: options.initialLng,
        initialAddress: options.initialAddress,
        role: options.role,
        closeOnConfirm: false,
        onConfirm: function (data) {
          if (typeof options.onConfirm === 'function') {
            options.onConfirm(data);
          }
        }
      });

      return pickerInstance;
    }
  };

  window.LocationPicker = LocationPicker;

})(window);
