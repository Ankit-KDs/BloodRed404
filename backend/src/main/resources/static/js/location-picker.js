/**
 * RED404 Reusable Location Picker Component
 * Supports both modal and inline mounting.
 * Provides Places/geocoding search, GPS detection, draggable pin with 6-decimal precision,
 * read-only coordinate verification fields, and disabled-until-pinned confirm button.
 */
(function(window) {
  'use strict';

  let activeModalOverlay = null;

  function createPickerDOM(isModal, initialAddress) {
    const wrapper = document.createElement('div');
    if (isModal) {
      wrapper.className = 'hosp-modal-overlay';
      wrapper.id = 'locationPickerModal';
      wrapper.style.display = 'flex';
      wrapper.style.zIndex = '10000';
    }

    const card = document.createElement('div');
    card.className = isModal ? 'hosp-modal-box' : 'loc-picker-inline';
    if (isModal) {
      card.style.maxWidth = '680px';
      card.style.padding = '24px';
    }

    card.innerHTML = `
      ${isModal ? `
        <div class="hosp-modal-header" style="margin-bottom: 16px;">
          <h3 class="hosp-modal-title" style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>Set Exact Hospital Location</span>
          </h3>
          <button type="button" class="hosp-modal-close" id="locPickerCloseBtn" aria-label="Close dialog">&times;</button>
        </div>
      ` : ''}

      <div class="loc-picker-body" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="loc-picker-controls" style="display: flex; gap: 10px; flex-wrap: wrap;">
          <div class="loc-picker-search-wrap" style="flex: 1; min-width: 200px; position: relative; display: flex; align-items: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; color: #9ca3af; pointer-events: none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" class="loc-picker-search-input" id="locSearchInput" placeholder="Search address, landmark or area..." value="${initialAddress ? escapeHtml(initialAddress) : ''}" autocomplete="off" />
          </div>
          <button type="button" class="loc-btn-gps" id="locBtnGps" title="Acquire coordinates from browser GPS">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
            <span>Use my current location</span>
          </button>
        </div>

        <div class="loc-map-frame" style="position: relative; width: 100%; height: 280px; border-radius: 8px; overflow: hidden; border: 1px solid var(--hosp-border, rgba(255,255,255,0.1)); background: #111215;">
          <div class="loc-map-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>Click map or drag pin to position exact hospital entrance</span>
          </div>
          <div class="loc-map-container" id="locPickerMap" style="width: 100%; height: 100%;"></div>
        </div>

        <div class="loc-coords-preview">
          <div class="loc-coord-field">
            <span class="loc-coord-label">Latitude (6 decimals)</span>
            <span class="loc-coord-val" id="locDisplayLat">--</span>
          </div>
          <div class="loc-coord-field">
            <span class="loc-coord-label">Longitude (6 decimals)</span>
            <span class="loc-coord-val" id="locDisplayLng">--</span>
          </div>
          <div class="loc-address-field">
            <span class="loc-coord-label">Resolved Address</span>
            <span class="loc-address-val" id="locDisplayAddress">No location confirmed yet</span>
          </div>
        </div>
      </div>

      <div class="hosp-modal-actions" style="margin-top: 18px; display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
        ${isModal ? `<button type="button" class="btn-secondary" id="locBtnCancel">Cancel</button>` : ''}
        <button type="button" class="btn-primary-action" id="locBtnConfirm" disabled>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Confirm location</span>
        </button>
      </div>
    `;

    if (isModal) {
      wrapper.appendChild(card);
      return { container: wrapper, card: card };
    }
    return { container: card, card: card };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initPickerLogic(rootEl, options) {
    let map = null;
    let pinMarker = null;
    let currentLat = options.initialLat ? parseFloat(options.initialLat) : null;
    let currentLng = options.initialLng ? parseFloat(options.initialLng) : null;
    let currentAddress = options.initialAddress || '';

    const mapEl = rootEl.querySelector('#locPickerMap');
    const searchInput = rootEl.querySelector('#locSearchInput');
    const gpsBtn = rootEl.querySelector('#locBtnGps');
    const latDisplay = rootEl.querySelector('#locDisplayLat');
    const lngDisplay = rootEl.querySelector('#locDisplayLng');
    const addrDisplay = rootEl.querySelector('#locDisplayAddress');
    const confirmBtn = rootEl.querySelector('#locBtnConfirm');
    const cancelBtn = rootEl.querySelector('#locBtnCancel');
    const closeBtn = rootEl.querySelector('#locPickerCloseBtn');

    function updateState(lat, lng, addressText, skipGeocode) {
      if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
        currentLat = parseFloat(lat);
        currentLng = parseFloat(lng);
        latDisplay.textContent = currentLat.toFixed(6);
        lngDisplay.textContent = currentLng.toFixed(6);
        confirmBtn.disabled = false;

        if (addressText) {
          currentAddress = addressText;
          addrDisplay.textContent = addressText;
        } else if (!skipGeocode) {
          addrDisplay.textContent = 'Resolving address...';
          reverseGeocode(currentLat, currentLng, (resolved) => {
            currentAddress = resolved;
            addrDisplay.textContent = resolved;
          });
        }
      } else {
        currentLat = null;
        currentLng = null;
        latDisplay.textContent = '--';
        lngDisplay.textContent = '--';
        addrDisplay.textContent = 'No location confirmed yet';
        confirmBtn.disabled = true;
      }
    }

    function placePin(lat, lng, panTo) {
      if (typeof L === 'undefined') return;

      const pinIcon = L.divIcon({
        className: 'loc-custom-pin',
        html: `
          <svg viewBox="0 0 32 38" width="30" height="36" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
            <path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="#3b82f6" stroke="#ffffff" stroke-width="1.8"/>
            <circle cx="16" cy="24" r="4.5" fill="#ffffff" />
          </svg>
        `,
        iconSize: [30, 36],
        iconAnchor: [15, 36]
      });

      if (!pinMarker) {
        pinMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);

        pinMarker.on('dragend', function() {
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

    function reverseGeocode(lat, lng, callback) {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
            callback(data.display_name);
          } else {
            callback(`Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
        })
        .catch(() => {
          callback(`Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        });
    }

    function searchAddress(query) {
      if (!query || !query.trim()) return;
      searchInput.disabled = true;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
      fetch(url)
        .then(res => res.json())
        .then(results => {
          searchInput.disabled = false;
          if (results && results.length > 0) {
            const first = results[0];
            const lat = parseFloat(first.lat);
            const lng = parseFloat(first.lon);
            placePin(lat, lng, true);
            updateState(lat, lng, first.display_name, true);
          } else {
            if (typeof showToast === 'function') {
              showToast('No matching address found. Try dragging the pin on the map.', 'warning');
            } else {
              alert('No matching address found. Please try dragging the pin directly on the map.');
            }
          }
        })
        .catch(err => {
          searchInput.disabled = false;
          console.error('Geocoding search failed:', err);
        });
    }

    function initMap() {
      if (typeof L === 'undefined') {
        setTimeout(initMap, 150);
        return;
      }

      // Default center: initial coords or central India / user locale
      const startLat = (currentLat && !isNaN(currentLat)) ? currentLat : 19.076090;
      const startLng = (currentLng && !isNaN(currentLng)) ? currentLng : 72.877426;

      map = L.map(mapEl, {
        center: [startLat, startLng],
        zoom: currentLat ? 15 : 12,
        zoomControl: true,
        attributionControl: false
      });

      // Google Maps Tile Layer
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: 20
      }).addTo(map);

      // Map click places / moves the pin
      map.on('click', function(e) {
        placePin(e.latlng.lat, e.latlng.lng, false);
        updateState(e.latlng.lat, e.latlng.lng, null, false);
      });

      if (currentLat && currentLng) {
        placePin(currentLat, currentLng, false);
        updateState(currentLat, currentLng, currentAddress, !currentAddress);
      }

      // Invalidate size once visible
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 200);
    }

    // Search events
    searchInput?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchAddress(this.value);
      }
    });

    // Browser GPS
    gpsBtn?.addEventListener('click', function() {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }
      gpsBtn.classList.add('loc-gps-active');
      gpsBtn.querySelector('span').textContent = 'Acquiring GPS...';

      navigator.geolocation.getCurrentPosition(
        function(pos) {
          gpsBtn.classList.remove('loc-gps-active');
          gpsBtn.querySelector('span').textContent = 'Use my current location';
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          placePin(lat, lng, true);
          updateState(lat, lng, null, false);
        },
        function(err) {
          gpsBtn.classList.remove('loc-gps-active');
          gpsBtn.querySelector('span').textContent = 'Use my current location';
          console.warn('Geolocation error:', err);
          alert('Could not acquire your current location. Please search address or click map.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

    // Confirm action
    confirmBtn?.addEventListener('click', function() {
      if (currentLat === null || currentLng === null) return;
      const result = {
        lat: parseFloat(currentLat.toFixed(6)),
        lng: parseFloat(currentLng.toFixed(6)),
        address: currentAddress || addrDisplay.textContent
      };

      if (typeof options.onConfirm === 'function') {
        options.onConfirm(result);
      }
      if (options.closeOnConfirm && typeof options.close === 'function') {
        options.close();
      }
    });

    // Close actions
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
     * Opens Location Picker in a modal dialog
     */
    openModal: function(options) {
      options = options || {};
      if (activeModalOverlay) {
        activeModalOverlay.remove();
        activeModalOverlay = null;
      }

      const { container, card } = createPickerDOM(true, options.initialAddress);
      document.body.appendChild(container);
      activeModalOverlay = container;

      // Close on backdrop click
      container.addEventListener('click', function(e) {
        if (e.target === container) {
          closeModal();
        }
      });

      function closeModal() {
        if (activeModalOverlay) {
          activeModalOverlay.remove();
          activeModalOverlay = null;
        }
        if (pickerInstance) {
          pickerInstance.destroy();
        }
      }

      const pickerInstance = initPickerLogic(card, {
        initialLat: options.initialLat,
        initialLng: options.initialLng,
        initialAddress: options.initialAddress,
        closeOnConfirm: true,
        close: closeModal,
        onConfirm: function(data) {
          if (typeof options.onConfirm === 'function') {
            options.onConfirm(data);
          }
        }
      });

      return {
        close: closeModal,
        getInstance: () => pickerInstance
      };
    },

    /**
     * Mounts Location Picker inline inside an existing DOM container
     */
    mountInline: function(containerIdOrEl, options) {
      options = options || {};
      const target = typeof containerIdOrEl === 'string'
        ? document.getElementById(containerIdOrEl)
        : containerIdOrEl;

      if (!target) {
        console.error('LocationPicker: target container not found:', containerIdOrEl);
        return null;
      }

      target.innerHTML = '';
      const { container, card } = createPickerDOM(false, options.initialAddress);
      target.appendChild(container);

      const pickerInstance = initPickerLogic(card, {
        initialLat: options.initialLat,
        initialLng: options.initialLng,
        initialAddress: options.initialAddress,
        closeOnConfirm: false,
        onConfirm: function(data) {
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
