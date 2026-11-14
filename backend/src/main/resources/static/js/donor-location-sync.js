/**
 * RED404 - Donor Real-Time Location Synchronization Engine
 * 
 * Rules strictly enforced:
 * 1. When a logged-in donor has granted location permission, saves current lat, lng & timestamp
 *    to backend: on app open, at most once per minute while page is visible, and only if moved >100m
 *    or 5 minutes have elapsed.
 * 2. Stops tracking when the tab is hidden (visibilitychange). Zero background tracking.
 * 3. Shows a non-blocking prompt banner on donor Dashboard and Emergencies page if permission
 *    is not granted: "Turn on location to receive nearby requests" with an enable button.
 * 4. Never invents fake coordinates.
 * 5. Strict privacy: exact coordinates are never logged.
 */

(function (window, document) {
  'use strict';

  var SYNC_ENDPOINT = '/api/donors/location';
  var MIN_INTERVAL_MS = 60 * 1000;          // At most once per minute
  var MAX_IDLE_SYNC_MS = 5 * 60 * 1000;     // Force sync after 5 minutes
  var MOVE_THRESHOLD_METERS = 100;          // Moved more than 100 meters
  var STORAGE_KEY = 'red404_donor_loc_state';

  var pollTimer = null;
  var isSyncing = false;
  var permissionStatusObj = null;

  // Retrieve stored state or initialize
  var state = {
    lastLat: null,
    lastLng: null,
    lastSyncTime: 0,
    permission: 'unknown'
  };

  try {
    var saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (typeof parsed.lastLat === 'number') state.lastLat = parsed.lastLat;
      if (typeof parsed.lastLng === 'number') state.lastLng = parsed.lastLng;
      if (typeof parsed.lastSyncTime === 'number') state.lastSyncTime = parsed.lastSyncTime;
    }
  } catch (e) {
    // Ignore storage parse issues
  }

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastLat: state.lastLat,
        lastLng: state.lastLng,
        lastSyncTime: state.lastSyncTime
      }));
    } catch (e) {}
  }

  /**
   * Calculates Haversine distance between two coordinates in meters.
   */
  function haversineMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radius of Earth in meters
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * UI banner management for location permission.
   */
  function updateBannerVisibility(granted) {
    var banner = document.getElementById('donorLocationPrompt');
    if (!banner) return;

    if (granted) {
      banner.style.display = 'none';
      banner.setAttribute('aria-hidden', 'true');
    } else {
      banner.style.display = 'flex';
      banner.removeAttribute('aria-hidden');
    }
  }

  function updateGpsUI(accuracy) {
    var pill = document.getElementById('navGpsIndicator');
    if (pill) {
      pill.classList.add('active');
      pill.setAttribute('title', 'Live GPS Active' + (accuracy ? ' (Accuracy: ' + Math.round(accuracy) + 'm)' : ''));
    }
    var locPill = document.getElementById('user-location');
    if (locPill && !locPill.textContent) {
      locPill.textContent = 'GPS Synchronized';
    }
  }

  /**
   * Posts verified coordinates to the backend endpoint.
   */
  function sendLocationToBackend(lat, lng, callback) {
    if (isSyncing) return;
    isSyncing = true;

    fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng
      })
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      isSyncing = false;
      if (data && data.success) {
        state.lastLat = lat;
        state.lastLng = lng;
        state.lastSyncTime = Date.now();
        saveState();
        if (typeof callback === 'function') callback(null, data);
      } else {
        if (typeof callback === 'function') callback(new Error(data ? data.message : 'Sync failed'));
      }
    })
    .catch(function (err) {
      isSyncing = false;
      if (typeof callback === 'function') callback(err);
    });
  }

  /**
   * Evaluates if coordinates qualify for backend sync per Part 3 rules:
   * - App open / first sync: always sync
   * - Then at most once per minute
   * - And ONLY if user moved > 100m OR 5 minutes have elapsed
   */
  function processLocationReading(lat, lng, accuracy) {
    var now = Date.now();
    updateGpsUI(accuracy);

    // Initial sync
    if (state.lastLat === null || state.lastLng === null || state.lastSyncTime === 0) {
      sendLocationToBackend(lat, lng);
      return;
    }

    var elapsedMs = now - state.lastSyncTime;

    // Rate-limit check: at most once per minute
    if (elapsedMs < MIN_INTERVAL_MS) {
      return;
    }

    // Distance check
    var distMeters = haversineMeters(state.lastLat, state.lastLng, lat, lng);

    if (distMeters > MOVE_THRESHOLD_METERS || elapsedMs >= MAX_IDLE_SYNC_MS) {
      sendLocationToBackend(lat, lng);
    }
  }

  /**
   * Requests single GPS fix while page is visible.
   */
  function queryCurrentPosition() {
    if (document.hidden) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        updateBannerVisibility(true);
        processLocationReading(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      function (err) {
        if (err.code === 1) { // PERMISSION_DENIED
          updateBannerVisibility(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }

  /**
   * Starts periodic polling while tab is active and visible.
   */
  function startVisibilityTracking() {
    stopVisibilityTracking();
    if (document.hidden) return;

    // Trigger immediate reading
    queryCurrentPosition();

    // Poll every 60s while visible to check movement/time threshold
    pollTimer = setInterval(function () {
      if (!document.hidden) {
        queryCurrentPosition();
      }
    }, MIN_INTERVAL_MS);
  }

  /**
   * Stops tracking completely (e.g. when tab is hidden).
   */
  function stopVisibilityTracking() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * User interaction handler for the enable button on the non-blocking prompt.
   */
  function handleEnableClick() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    var btn = document.getElementById('btnEnableDonorLocation');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Detecting...';
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Turn on location';
        }
        updateBannerVisibility(true);
        processLocationReading(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        startVisibilityTracking();
      },
      function (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Turn on location';
        }
        updateBannerVisibility(false);
        var sub = document.querySelector('#donorLocationPrompt .dlp-sub');
        if (sub && err.code === 1) {
          sub.textContent = 'Location was blocked. Please allow location permissions in your browser address bar.';
          sub.style.color = '#ff6b6b';
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000
      }
    );
  }

  /**
   * Initializes permission check and listeners.
   */
  function init() {
    // Bind button click
    var btn = document.getElementById('btnEnableDonorLocation');
    if (btn) {
      btn.addEventListener('click', handleEnableClick);
    }

    // Visibility change listener: Stop when hidden, resume when visible
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopVisibilityTracking();
      } else {
        startVisibilityTracking();
      }
    });

    // Check permission state via Permissions API if available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(function (status) {
          permissionStatusObj = status;
          if (status.state === 'granted') {
            updateBannerVisibility(true);
            startVisibilityTracking();
          } else if (status.state === 'prompt') {
            updateBannerVisibility(false);
          } else if (status.state === 'denied') {
            updateBannerVisibility(false);
          }

          status.onchange = function () {
            if (this.state === 'granted') {
              updateBannerVisibility(true);
              startVisibilityTracking();
            } else {
              updateBannerVisibility(false);
              stopVisibilityTracking();
            }
          };
        })
        .catch(function () {
          // Fallback to direct check
          queryCurrentPosition();
        });
    } else {
      // Permissions API not supported - direct query
      queryCurrentPosition();
    }
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.DonorLocationSync = {
    init: init,
    syncNow: queryCurrentPosition,
    getLastCoords: function () {
      return state.lastLat !== null && state.lastLng !== null
        ? { latitude: state.lastLat, longitude: state.lastLng, timestamp: state.lastSyncTime }
        : null;
    }
  };

})(window, document);

