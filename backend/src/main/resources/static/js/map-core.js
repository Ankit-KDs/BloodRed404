/**
 * RED404 Unified Map Component (MapCore)
 * Single source of truth for Leaflet map creation, tile layers, and distance rings across RED404.
 *
 * Rules:
 * - Tile URLs loaded from environment/API (/api/system/map-config), fallback to OpenStreetMap.
 * - Standard ("Map"), "Dark" (CSS filter), and optional "Satellite" if MAP_SATELLITE_URL is set.
 * - No key-less or unofficial Google tile scraping.
 * - Robustness: invalidateSize on tab/modal/resize, min-height enforcement, 3-tile error fallback banner.
 * - Circles: 5/10/20 km with selected radius emphasis & perimeter labels.
 */
(function(window) {
  'use strict';

  // Default OSM Configuration conforming to OpenStreetMap Tile Usage Policy
  const DEFAULT_MAP_CONFIG = {
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: 'abc',
    satelliteUrl: null
  };

  let cachedConfig = null;
  let configPromise = null;

  async function fetchConfig() {
    if (cachedConfig) return cachedConfig;
    if (configPromise) return configPromise;

    configPromise = fetch('/api/system/map-config')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json && json.success && json.data) {
          cachedConfig = Object.assign({}, DEFAULT_MAP_CONFIG, json.data);
        } else {
          cachedConfig = Object.assign({}, DEFAULT_MAP_CONFIG);
        }
        return cachedConfig;
      })
      .catch(() => {
        cachedConfig = Object.assign({}, DEFAULT_MAP_CONFIG);
        return cachedConfig;
      });

    return configPromise;
  }

  const Red404Map = {
    getConfig: function() {
      return cachedConfig || DEFAULT_MAP_CONFIG;
    },

    loadConfig: fetchConfig,

    /**
     * Creates a tile layer with consecutive failure monitoring.
     * If 3 consecutive tile errors occur, an inline fallback message is displayed.
     */
    createTileLayer: function(layerKey, customConfig, containerEl) {
      if (typeof L === 'undefined') {
        console.warn('[MapCore] Leaflet library (L) is not loaded.');
        return null;
      }

      const cfg = Object.assign({}, Red404Map.getConfig(), customConfig || {});
      layerKey = (layerKey || 'dark').toLowerCase();

      let url = cfg.tileUrl;
      let maxZoom = cfg.maxZoom || 19;
      let subdomains = cfg.subdomains || 'abc';
      let isDark = (layerKey === 'dark');

      if (layerKey === 'satellite' && cfg.satelliteUrl) {
        url = cfg.satelliteUrl;
        isDark = false;
      }

      const layer = L.tileLayer(url, {
        maxZoom: maxZoom,
        subdomains: subdomains,
        attribution: cfg.attribution || DEFAULT_MAP_CONFIG.attribution,
        crossOrigin: true
      });

      // Consecutive failure detector
      let consecutiveErrors = 0;
      layer.on('tileerror', function() {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          Red404Map.showTileErrorBanner(containerEl);
        }
      });

      layer.on('tileload', function() {
        // Reset on successful tile
        consecutiveErrors = 0;
      });

      return {
        layer: layer,
        isDark: isDark
      };
    },

    /**
     * Displays an inline message when map tiles fail to load without breaking circles/markers.
     */
    showTileErrorBanner: function(containerEl) {
      if (!containerEl) return;
      let banner = containerEl.querySelector('.map-tile-fallback-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'map-tile-fallback-banner';
        banner.innerHTML = `
          <div style="background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(239, 68, 68, 0.4); color: #f8fafc; padding: 8px 14px; border-radius: 6px; font-size: 12px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto;">
            <i class="fas fa-info-circle" style="color: #f59e0b;"></i>
            <span>The map could not load. The list below is still accurate.</span>
          </div>
        `;
        banner.style.position = 'absolute';
        banner.style.top = '12px';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.zIndex = '1000';
        banner.style.pointerEvents = 'none';
        containerEl.style.position = 'relative';
        containerEl.appendChild(banner);
        console.warn('[MapCore] Base map tiles failed to load. Displaying fallback notice.');
      }
    },

    /**
     * Initializes a map inside container with automatic resize tracking and min-height enforcement.
     */
    initMap: function(containerIdOrEl, options) {
      if (typeof L === 'undefined') return null;

      const container = typeof containerIdOrEl === 'string'
        ? document.getElementById(containerIdOrEl)
        : containerIdOrEl;

      if (!container) return null;

      // Apply explicit min-height (320px desktop, 260px mobile)
      const isMobile = window.innerWidth <= 480;
      const minH = isMobile ? '260px' : '320px';
      if (!container.style.minHeight) {
        container.style.minHeight = minH;
      }

      options = Object.assign({
        zoomControl: true,
        attributionControl: true
      }, options || {});

      const map = L.map(container, options);

      // Layer state
      let currentTileLayer = null;
      let activeLayerKey = options.initialLayer || 'dark';

      function applyLayer(key) {
        const result = Red404Map.createTileLayer(key, options.tileConfig, container);
        if (!result) return;

        if (currentTileLayer) {
          try { map.removeLayer(currentTileLayer); } catch (_) {}
        }

        currentTileLayer = result.layer;
        currentTileLayer.addTo(map);

        if (result.isDark) {
          container.classList.add('dark-map');
        } else {
          container.classList.remove('dark-map');
        }
        activeLayerKey = key;
      }

      applyLayer(activeLayerKey);

      // Wire automatic resize & visibility observer
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          if (container.offsetWidth > 0 && container.offsetHeight > 0) {
            map.invalidateSize();
          }
        });
        ro.observe(container);
      }

      window.addEventListener('resize', () => {
        map.invalidateSize();
      });

      // Expose helper on map instance
      map.setMapLayer = applyLayer;
      map.getActiveLayerKey = () => activeLayerKey;

      return map;
    },

    /**
     * Sets up layer switcher UI buttons (Map / Dark / Satellite).
     * Hides Satellite if no satelliteUrl is configured.
     */
    setupLayerBar: function(barContainer, mapInstance, onLayerChange) {
      if (!barContainer || !mapInstance) return;

      const cfg = Red404Map.getConfig();
      const satBtn = barContainer.querySelector('[data-layer="satellite"], [data-layer="google-hybrid"]');
      if (satBtn) {
        if (!cfg.satelliteUrl) {
          satBtn.style.display = 'none';
        } else {
          satBtn.style.display = '';
          satBtn.setAttribute('data-layer', 'satellite');
          satBtn.textContent = 'Satellite';
        }
      }

      const mapBtns = barContainer.querySelectorAll('.rlb-btn');
      mapBtns.forEach(btn => {
        let l = btn.getAttribute('data-layer');
        if (l === 'google-dark') {
          l = 'dark';
          btn.setAttribute('data-layer', 'dark');
          btn.innerHTML = '<i class="fas fa-moon"></i> Dark';
        } else if (l === 'google-roads' || l === 'osm') {
          l = 'map';
          btn.setAttribute('data-layer', 'map');
          btn.innerHTML = '<i class="fas fa-map"></i> Map';
        }

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetLayer = btn.getAttribute('data-layer');
          if (typeof mapInstance.setMapLayer === 'function') {
            mapInstance.setMapLayer(targetLayer);
          }
          mapBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (typeof onLayerChange === 'function') {
            onLayerChange(targetLayer);
          }
        });
      });
    },

    /**
     * Draws 5/10/20 km distance rings around a center coordinate.
     * Selected radius is emphasized with higher opacity and thickness.
     * Labels are positioned cleanly on perimeter edges without overlapping center.
     */
    drawDistanceRings: function(mapInstance, centerLatLng, selectedRadiusKm) {
      if (!mapInstance || !centerLatLng || typeof L === 'undefined') return [];

      selectedRadiusKm = selectedRadiusKm ? parseInt(selectedRadiusKm, 10) : 5;

      const radii = [
        { km: 5, label: '5 km' },
        { km: 10, label: '10 km' },
        { km: 20, label: '20 km' }
      ];

      const elements = [];

      radii.forEach(r => {
        const isSelected = (r.km === selectedRadiusKm);
        const circle = L.circle(centerLatLng, {
          radius: r.km * 1000,
          color: isSelected ? '#3b82f6' : 'rgba(148, 163, 184, 0.45)',
          weight: isSelected ? 2.5 : 1.2,
          dashArray: isSelected ? null : '4, 6',
          fillColor: isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.05)',
          fillOpacity: isSelected ? 0.09 : 0.02,
          interactive: false
        }).addTo(mapInstance);

        elements.push(circle);

        // Calculate perimeter edge label point (North offset: ~1 degree latitude is 111 km)
        const latOffset = (r.km / 111.0);
        const labelLatLng = [centerLatLng[0] + latOffset, centerLatLng[1]];

        const labelMarker = L.marker(labelLatLng, {
          icon: L.divIcon({
            className: 'distance-ring-label',
            html: `<span style="font-size: 10px; font-weight: 700; color: ${isSelected ? '#60a5fa' : '#94a3b8'}; background: rgba(15, 23, 42, 0.85); padding: 2px 6px; border-radius: 4px; border: 1px solid ${isSelected ? '#3b82f6' : 'rgba(148, 163, 184, 0.3)'}; white-space: nowrap;">${r.label}</span>`,
            iconSize: [40, 16],
            iconAnchor: [20, 8]
          }),
          interactive: false
        }).addTo(mapInstance);

        elements.push(labelMarker);
      });

      return elements;
    },

    /**
     * Hospital Pin Marker (Red Cross / Facility Icon)
     */
    createHospitalMarker: function(latLng, title) {
      if (typeof L === 'undefined') return null;
      const icon = L.divIcon({
        className: 'red404-hospital-pin',
        html: `
          <div style="width: 34px; height: 34px; border-radius: 50%; background: #ef4444; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.5); color: #fff;">
            <i class="fas fa-hospital" style="font-size: 15px;"></i>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      return L.marker(latLng, { icon: icon, title: title || 'Hospital' });
    },

    /**
     * Donor Pin Marker (Blood Drop Icon)
     */
    createDonorMarker: function(latLng, bloodGroup) {
      if (typeof L === 'undefined') return null;
      const bg = bloodGroup || 'Donor';
      const icon = L.divIcon({
        className: 'red404-donor-pin',
        html: `
          <div style="padding: 4px 8px; border-radius: 14px; background: #0f172a; border: 1.8px solid #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
            <i class="fas fa-tint" style="color: #ef4444; font-size: 10px;"></i>
            <span>${escapeHtml(bg)}</span>
          </div>
        `,
        iconSize: [50, 24],
        iconAnchor: [25, 12]
      });
      return L.marker(latLng, { icon: icon });
    }
  };

  // Preload configuration on script load
  Red404Map.loadConfig();

  window.Red404Map = Red404Map;
})(window);
