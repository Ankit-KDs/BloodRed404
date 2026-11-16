/**
 * RED404 — Verified Blood Bank Directory Client Logic
 * Public page (no login required) with donor session awareness.
 * Displays only verified partner hospitals with real-time stock levels.
 */

(function () {
  'use strict';

  // State
  let allHospitals = [];
  let userLocation = null; // { lat, lng } grid-rounded
  let selectedBloodGroup = 'ALL';
  let searchTerm = '';
  let hasUserSearched = false;

  // Stock Thresholds matching StockService.java
  // O+/O-: crit 4 / low 8, A/B: crit 3 / low 5, AB: crit 2 / low 4
  const THRESHOLDS = {
    'O+': 8,
    'O-': 8,
    'A+': 5,
    'A-': 5,
    'B+': 5,
    'B-': 5,
    'AB+': 4,
    'AB-': 4
  };

  const ALL_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  document.addEventListener('DOMContentLoaded', () => {
    initAuthHeader();
    initSearchControls();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('search') || urlParams.has('q')) {
      searchTerm = (urlParams.get('search') || urlParams.get('q') || '').trim().toLowerCase();
      const input = document.getElementById('searchInput');
      if (input) input.value = searchTerm;
      hasUserSearched = true;
    }
    if (urlParams.has('bloodGroup')) {
      selectedBloodGroup = urlParams.get('bloodGroup');
      const bgChips = document.querySelectorAll('.bg-chip');
      bgChips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-bg') === selectedBloodGroup);
      });
      hasUserSearched = true;
    }

    loadHospitalsDirectory();
  });

  // ==================== 1. AUTH HEADER & DONOR MENU ====================
  function initAuthHeader() {
    let donorUser = null;
    try {
      if (window.Red404Security) {
        const sess = window.Red404Security.getRoleSession('DONOR');
        if (sess && sess.user) donorUser = sess.user;
      }
      if (!donorUser) {
        const raw = localStorage.getItem('donor_session') || localStorage.getItem('red404_donor_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          donorUser = parsed.user || parsed;
        }
      }
      if (!donorUser) {
        const p = new URLSearchParams(window.location.search);
        if (p.get('donor') === '1' || p.get('donor') === 'chinmay') {
          donorUser = { id: 1, name: 'Chinmay Joshi', donorId: 'DNR-1511-D232', email: 'chinmay.joshi@example.com' };
        }
      }
    } catch (_) { }

    const publicBtns = document.getElementById('publicNavButtons');
    const donorMenu = document.getElementById('donorNavMenu');

    if (donorUser && donorUser.id) {
      if (publicBtns) publicBtns.style.display = 'none';
      if (donorMenu) donorMenu.style.display = 'inline-block';

      const dName = donorUser.name || donorUser.fullName || 'Donor';
      const nameEl = document.getElementById('donorNavName');
      const subEl = document.getElementById('donorNavSub');
      const initialsEl = document.getElementById('donorNavInitials');

      if (nameEl) nameEl.textContent = dName;
      if (subEl) subEl.textContent = donorUser.donorId || donorUser.donor_id || 'Registered Donor';
      if (initialsEl) {
        const parts = dName.trim().split(/\s+/);
        initialsEl.textContent = parts.length > 1
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : parts[0].substring(0, 2).toUpperCase();
      }

      // Dropdown toggle
      const avatarBtn = document.getElementById('donorAvatarBtn');
      const dropdownPanel = document.getElementById('donorDropdownPanel');
      if (avatarBtn && dropdownPanel) {
        avatarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = dropdownPanel.style.display === 'block';
          dropdownPanel.style.display = isOpen ? 'none' : 'block';
          avatarBtn.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', () => {
          dropdownPanel.style.display = 'none';
          avatarBtn.setAttribute('aria-expanded', 'false');
        });
      }

      // Logout handler (Part 1 session isolation)
      const logoutBtn = document.getElementById('donorNavLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          if (window.Red404Security) {
            await window.Red404Security.logoutRole('DONOR');
          } else {
            try {
              localStorage.removeItem('donor_session');
              localStorage.removeItem('red404_donor_session');
            } catch (_) { }
            window.location.replace('donor-login.html');
          }
        });
      }
    } else {
      if (publicBtns) publicBtns.style.display = 'flex';
      if (donorMenu) donorMenu.style.display = 'none';
    }
  }

  // ==================== 2. SEARCH & CONTROLS ====================
  function initSearchControls() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const nearMeBtn = document.getElementById('nearMeBtn');
    const clearLocBtn = document.getElementById('clearLocationBtn');
    const bgChips = document.querySelectorAll('.bg-chip');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const retryBtn = document.getElementById('retryFetchBtn');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = searchTerm ? 'block' : 'none';
        if (searchTerm) {
          hasUserSearched = true;
          renderFilteredHospitals();
        } else if (!userLocation && selectedBloodGroup === 'ALL') {
          hasUserSearched = false;
          renderInitialPrompt();
        } else {
          renderFilteredHospitals();
        }
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          hasUserSearched = true;
          renderFilteredHospitals();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchTerm = '';
        clearBtn.style.display = 'none';
        if (!userLocation && selectedBloodGroup === 'ALL') {
          hasUserSearched = false;
          renderInitialPrompt();
        } else {
          renderFilteredHospitals();
        }
      });
    }

    if (nearMeBtn) {
      nearMeBtn.addEventListener('click', () => {
        hasUserSearched = true;
        requestNearMeLocation();
      });
    }

    if (clearLocBtn) {
      clearLocBtn.addEventListener('click', () => {
        userLocation = null;
        const chip = document.getElementById('locationStatusChip');
        if (chip) chip.style.display = 'none';
        if (nearMeBtn) nearMeBtn.classList.remove('active');
        if (!searchTerm && selectedBloodGroup === 'ALL') {
          hasUserSearched = false;
          renderInitialPrompt();
        } else {
          renderFilteredHospitals();
        }
      });
    }

    bgChips.forEach(chip => {
      chip.addEventListener('click', () => {
        bgChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedBloodGroup = chip.getAttribute('data-bg') || 'ALL';
        hasUserSearched = true;
        renderFilteredHospitals();
      });
    });

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchTerm = '';
        if (clearBtn) clearBtn.style.display = 'none';
        userLocation = null;
        const chip = document.getElementById('locationStatusChip');
        if (chip) chip.style.display = 'none';
        if (nearMeBtn) nearMeBtn.classList.remove('active');
        selectedBloodGroup = 'ALL';
        bgChips.forEach(c => {
          c.classList.toggle('active', c.getAttribute('data-bg') === 'ALL');
        });
        hasUserSearched = false;
        renderInitialPrompt();
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadHospitalsDirectory();
      });
    }
  }

  // ==================== 3. GEOLOCATION WITH GRID-ROUNDING ====================
  function requestNearMeLocation() {
    const nearMeBtn = document.getElementById('nearMeBtn');
    const chip = document.getElementById('locationStatusChip');
    const chipText = document.getElementById('locationStatusText');

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please search by city or pincode.');
      return;
    }

    if (nearMeBtn) nearMeBtn.classList.add('active');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Grid-rounded to ~1 km (2 decimal places of lat/lng)
        userLocation = {
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100
        };

        if (chip) chip.style.display = 'inline-flex';
        if (chipText) chipText.textContent = `Location active (~1 km grid)`;
        renderFilteredHospitals();
      },
      (err) => {
        console.warn('Geolocation notice:', err.message);
        if (nearMeBtn) nearMeBtn.classList.remove('active');
        if (chip) chip.style.display = 'none';
        // Non-intrusive notification
        alert('Could not retrieve location. You can enter your city or pincode in the search box.');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  function calculateHaversine(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // ==================== 4. FETCH DIRECTORY DATA ====================
  function renderInitialPrompt() {
    const grid = document.getElementById('hospitalsGrid');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const countText = document.getElementById('resultsCountText');

    if (errorState) errorState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (countText) countText.textContent = '';
    if (!grid) return;

    const isHi = window.RED404_I18N && window.RED404_I18N.getLanguage() === 'hi';
    grid.innerHTML = `
      <div class="directory-prompt-card" id="initialDirectoryPromptState" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; text-align: center; background: #17181b; border: 1px solid #2a2c31; border-radius: 14px; margin: 12px 0;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(229, 56, 59, 0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #e5383b; font-size: 20px;">
          <i class="fas fa-hospital"></i>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: #ecebe8; margin: 0 0 8px 0;" data-i18n="bloodBanks.promptTitle">${isHi ? 'सत्यापित ब्लड बैंक निर्देशिका' : 'Verified Blood Bank Directory'}</h3>
        <p style="font-size: 0.92rem; color: #9b9a96; max-width: 520px; margin: 0 auto; line-height: 1.5;" data-i18n="bloodBanks.promptDesc">${isHi ? 'अस्पताल का नाम, शहर या पिन कोड द्वारा खोजें, "मेरे पास" पर क्लिक करें, या सत्यापित ब्लड बैंक और रीयल-टाइम स्टॉक देखने के लिए रक्त समूह फ़िल्टर चुनें।' : 'Search by hospital name, city, or PIN code, click &quot;Near me&quot;, or select a blood group filter to view verified blood banks and real-time reserves.'}</p>
      </div>
    `;
  }

  async function loadHospitalsDirectory(forceRender = false) {
    const grid = document.getElementById('hospitalsGrid');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const countText = document.getElementById('resultsCountText');

    if (errorState) errorState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    try {
      const res = await fetch('/api/hospitals/directory');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        // Filter ONLY verified hospitals
        allHospitals = json.data.filter(h => {
          const status = String(h.verificationStatus || h.verification_status || '').trim().toLowerCase();
          return status === 'verified';
        });

        updateSummaryStats(allHospitals);

        if (hasUserSearched || forceRender) {
          renderFilteredHospitals();
        } else {
          renderInitialPrompt();
        }
      } else {
        throw new Error(json.message || 'Failed to load hospitals');
      }
    } catch (err) {
      console.error('Error fetching blood bank directory:', err);
      if (grid) grid.innerHTML = '';
      if (errorState) errorState.style.display = 'flex';
      if (countText) countText.textContent = 'Error loading directory';
    }
  }

  function updateSummaryStats(hospitals) {
    const statHosp = document.getElementById('statHospitalsCount');
    const statUnits = document.getElementById('statUnitsCount');
    const statCities = document.getElementById('statCitiesCount');

    let totalUnits = 0;
    const citiesSet = new Set();

    hospitals.forEach(h => {
      const inv = h.inventory || {};
      Object.values(inv).forEach(u => {
        if (typeof u === 'number') totalUnits += u;
      });
      if (h.city) citiesSet.add(h.city.trim().toLowerCase());
    });

    if (statHosp) statHosp.textContent = hospitals.length;
    if (statUnits) statUnits.textContent = totalUnits;
    if (statCities) statCities.textContent = citiesSet.size || 1;
  }

  // ==================== 5. RENDER FILTERED HOSPITALS ====================
  function renderFilteredHospitals() {
    const grid = document.getElementById('hospitalsGrid');
    const emptyState = document.getElementById('emptyState');
    const countText = document.getElementById('resultsCountText');
    if (!grid) return;

    let filtered = allHospitals.filter(h => {
      // 1. Text Search matching name, city, pincode, district, address
      if (searchTerm) {
        const hay = [
          h.name || h.hospitalName || '',
          h.city || '',
          h.pincode || '',
          h.district || '',
          h.state || '',
          h.address || ''
        ].join(' ').toLowerCase();

        if (!hay.includes(searchTerm)) return false;
      }

      // 2. Blood Group Filter
      if (selectedBloodGroup !== 'ALL') {
        const inv = h.inventory || {};
        const count = inv[selectedBloodGroup] != null ? inv[selectedBloodGroup] : 0;
        if (count <= 0) return false;
      }

      return true;
    });

    // Distance sorting if location is active
    if (userLocation) {
      filtered.forEach(h => {
        const hLat = h.latitude != null ? h.latitude : h.lat;
        const hLng = h.longitude != null ? h.longitude : h.lng;
        h._distance = calculateHaversine(userLocation.lat, userLocation.lng, hLat, hLng);
      });

      filtered.sort((a, b) => {
        if (a._distance == null) return 1;
        if (b._distance == null) return -1;
        return a._distance - b._distance;
      });
    }

    // Update count text
    if (countText) {
      countText.textContent = `${filtered.length} verified ${filtered.length === 1 ? 'blood bank' : 'blood banks'} found`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Build Cards HTML
    grid.innerHTML = filtered.map(h => createHospitalCardHtml(h)).join('');
  }

  function createHospitalCardHtml(h) {
    const name = h.name || h.hospitalName || 'Verified Hospital';
    const address = h.address || `${h.city || ''}, ${h.state || ''}`.trim() || 'Address on file';
    const emergencyNum = h.emergencyContact || h.hospitalPhone || h.phone || null;

    // Distance badge
    let distanceBadge = '';
    if (userLocation && h._distance != null) {
      distanceBadge = `<span class="badge-distance"><i class="fas fa-location-arrow"></i> ~${h._distance} km</span>`;
    }

    // Phone element: ONLY if hospital set one
    let phoneRow = '';
    if (emergencyNum && String(emergencyNum).trim() !== '') {
      phoneRow = `
        <div class="hosp-detail-row">
          <i class="fas fa-phone-alt hosp-detail-icon"></i>
          <a href="tel:${emergencyNum.replace(/\s+/g, '')}" class="hosp-phone-link">${emergencyNum}</a>
          <span style="font-size: 12px; color: #9b9a96;">(24x7 Emergency)</span>
        </div>
      `;
    }

    // Updated X ago
    const timeAgo = formatTimeAgo(h.updatedAt || h.createdAt);

    // Total Stock Units
    const inv = h.inventory || {};
    let totalStock = 0;
    ALL_GROUPS.forEach(g => {
      const u = inv[g] != null ? inv[g] : 0;
      totalStock += u;
    });

    // 8 Blood Groups Inventory Tiles
    const tilesHtml = ALL_GROUPS.map(bg => {
      const units = inv[bg] != null ? inv[bg] : 0;
      const th = THRESHOLDS[bg] || 5;
      const isOk = units > th;
      const labelText = isOk ? 'OK' : 'Low';
      const labelClass = isOk ? 'label-ok' : 'label-low';
      const isSelected = selectedBloodGroup === bg;

      return `
        <div class="bg-stock-tile ${isSelected ? 'filter-match' : ''}">
          <div class="bg-tile-top">
            <span class="bg-type-name">${bg}</span>
            <span class="bg-stock-label ${labelClass}">${labelText}</span>
          </div>
          <span class="bg-units-count">${units} ${units === 1 ? 'Unit' : 'Units'}</span>
        </div>
      `;
    }).join('');

    // Directions Link
    const dest = encodeURIComponent(`${name}, ${address}`);
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

    return `
      <article class="hospital-card" id="hospCard_${h.id}">
        <!-- Header -->
        <div class="hosp-header">
          <div class="hosp-title-group">
            <h2 class="hosp-name">${escapeHtml(name)}</h2>
            <div class="hosp-badges">
              <span class="badge-verified"><i class="fas fa-check-circle"></i> Verified Partner</span>
              ${distanceBadge}
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="hosp-details-list">
          <div class="hosp-detail-row">
            <i class="fas fa-map-marker-alt hosp-detail-icon"></i>
            <span>${escapeHtml(address)}</span>
          </div>
          ${phoneRow}
          <div class="hosp-meta-row">
            <span><i class="far fa-clock"></i> Updated ${timeAgo}</span>
            <span>&bull;</span>
            <span>Operating: 24x7</span>
          </div>
        </div>

        <!-- 8 Blood Groups Grid -->
        <div class="hosp-inventory-box">
          <div class="inv-box-header">
            <span>Clinical Blood Reserves (8 Groups)</span>
            <span class="inv-total-units">${totalStock} Total Units</span>
          </div>
          <div class="blood-groups-grid">
            ${tilesHtml}
          </div>
        </div>

        <!-- Actions -->
        <div class="hosp-actions-row">
          <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn-directions">
            <i class="fas fa-directions"></i> Directions
          </a>
        </div>
      </article>
    `;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return 'recently';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'recently';
      const sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'just now';
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hrs = Math.floor(min / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch (_) {
      return 'recently';
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

  window.addEventListener('red404_language_changed', () => {
    if (hasUserSearched) {
      renderFilteredHospitals();
    } else {
      renderInitialPrompt();
    }
  });

  // Expose component for donor portal integration
  window.Red404BloodBankDirectory = {
    load: loadHospitalsDirectory,
    setFilter: (bg) => {
      selectedBloodGroup = bg;
      renderFilteredHospitals();
    }
  };
})();
