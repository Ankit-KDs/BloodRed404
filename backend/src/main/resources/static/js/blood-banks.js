/**
 * RED404 — Verified Blood Bank Directory Client Logic (Round 8, Part 3)
 * Search-first directory:
 * 1. Opens with ONLY the search form and short hint ("Choose a state or use Near me, then press Search").
 * 2. Cascading State (all 36 States/UTs) -> City (verified hospitals only; empty shows "No verified hospitals in this state yet").
 * 3. Results appear ONLY after Search or Near me is pressed.
 * 4. Blood group filtering partitions stock > 0 first, 0 units marked "None" and listed after.
 * 5. 10 per page pagination.
 * 6. "Near me" asks location only on click; uses donor saved location when logged in with switch button; manual PIN fallback.
 * 7. Privacy: ~1 km grid rounding, no donor data, emergency contact shown only if allowed.
 */

(function () {
  'use strict';

  // 36 Indian States and Union Territories
  const INDIAN_STATES_AND_UTS = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal"
  ];

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
  const PAGE_SIZE = 10;

  // Component State
  let allHospitals = [];
  let currentFilteredList = [];
  let userLocation = null; // { lat, lng, source: 'gps' | 'saved' | 'pincode', label?: string }
  let donorUser = null;
  let hasUserSearched = false;
  let currentPage = 1;

  document.addEventListener('DOMContentLoaded', () => {
    initAuthHeader();
    initStateDropdown();
    initSearchControls();
    loadHospitalsDirectory();
  });

  // ==================== 1. DONOR SESSION FOR NEAR-ME ====================
  function initAuthHeader() {
    try {
      const raw = localStorage.getItem('donor_session') || localStorage.getItem('red404_donor_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        donorUser = parsed.user || parsed;
      }
    } catch (_) { }
  }

  // ==================== 2. STATE & CITY DROPDOWNS ====================
  function initStateDropdown() {
    const stateSelect = document.getElementById('stateSelect');
    const citySelect = document.getElementById('citySelect');
    if (!stateSelect) return;

    stateSelect.innerHTML = '<option value="">Select State or UT...</option>' +
      INDIAN_STATES_AND_UTS.map(st => `<option value="${escapeHtml(st)}">${escapeHtml(st)}</option>`).join('');

    stateSelect.addEventListener('change', () => {
      const selectedState = stateSelect.value.trim();
      updateCityDropdown(selectedState);
    });
  }

  function updateCityDropdown(selectedState) {
    const citySelect = document.getElementById('citySelect');
    if (!citySelect) return;

    if (!selectedState) {
      citySelect.innerHTML = '<option value="">Choose a state first</option>';
      citySelect.disabled = true;
      return;
    }

    // Filter verified hospitals in this state
    const stateHospitals = allHospitals.filter(h => {
      const hState = String(h.state || '').trim().toLowerCase();
      return hState === selectedState.toLowerCase();
    });

    if (stateHospitals.length === 0) {
      citySelect.innerHTML = '<option value="" disabled selected>No verified hospitals in this state yet</option>';
      citySelect.disabled = true;
    } else {
      const citiesSet = new Set();
      stateHospitals.forEach(h => {
        if (h.city && h.city.trim()) citiesSet.add(h.city.trim());
        if (h.district && h.district.trim()) citiesSet.add(h.district.trim());
      });
      const cities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));

      citySelect.disabled = false;
      citySelect.innerHTML = `<option value="">All cities in ${escapeHtml(selectedState)}</option>` +
        cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
  }

  // ==================== 3. SEARCH & CONTROLS ====================
  function initSearchControls() {
    const searchForm = document.getElementById('directorySearchForm');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const nearMeBtn = document.getElementById('nearMeBtn');
    const clearLocBtn = document.getElementById('clearLocationBtn');
    const switchLocBtn = document.getElementById('switchLocationBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const emptyResetBtn = document.getElementById('emptyResetBtn');
    const retryBtn = document.getElementById('retryFetchBtn');

    // Manual PIN code fallback elements
    const manualPinBox = document.getElementById('manualPinBox');
    const manualPinInput = document.getElementById('manualPinInput');
    const manualPinSubmitBtn = document.getElementById('manualPinSubmitBtn');
    const manualPinCancelBtn = document.getElementById('manualPinCancelBtn');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        executeSearch();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        clearBtn.style.display = 'none';
      });
    }

    if (nearMeBtn) {
      nearMeBtn.addEventListener('click', () => {
        handleNearMeClick();
      });
    }

    if (clearLocBtn) {
      clearLocBtn.addEventListener('click', () => {
        userLocation = null;
        const chip = document.getElementById('locationStatusChip');
        if (chip) chip.style.display = 'none';
        if (nearMeBtn) nearMeBtn.classList.remove('active');
        if (hasUserSearched) {
          executeSearch();
        }
      });
    }

    if (switchLocBtn) {
      switchLocBtn.addEventListener('click', () => {
        // Toggle from saved location to browser GPS or PIN code fallback
        requestBrowserGps(true);
      });
    }

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
    if (emptyResetBtn) {
      emptyResetBtn.addEventListener('click', resetAllFilters);
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadHospitalsDirectory(true);
      });
    }

    // Manual PIN fallback
    if (manualPinSubmitBtn && manualPinInput) {
      manualPinSubmitBtn.addEventListener('click', () => {
        const pin = manualPinInput.value.trim();
        if (!pin || pin.length < 3) {
          alert('Please enter a valid PIN code or city name.');
          return;
        }
        userLocation = { source: 'pincode', pincode: pin, label: `PIN ${pin}` };
        if (manualPinBox) manualPinBox.style.display = 'none';
        showLocationChip(`Using PIN ${pin}`);
        executeSearch();
      });
    }

    if (manualPinCancelBtn && manualPinBox) {
      manualPinCancelBtn.addEventListener('click', () => {
        manualPinBox.style.display = 'none';
      });
    }
  }

  function resetAllFilters() {
    const stateSelect = document.getElementById('stateSelect');
    const citySelect = document.getElementById('citySelect');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const bloodGroupSelect = document.getElementById('bloodGroupSelect');
    const locationChip = document.getElementById('locationStatusChip');
    const nearMeBtn = document.getElementById('nearMeBtn');
    const manualPinBox = document.getElementById('manualPinBox');

    if (stateSelect) stateSelect.value = '';
    if (citySelect) {
      citySelect.innerHTML = '<option value="">Choose a state first</option>';
      citySelect.disabled = true;
    }
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (bloodGroupSelect) bloodGroupSelect.value = 'ALL';
    if (locationChip) locationChip.style.display = 'none';
    if (nearMeBtn) nearMeBtn.classList.remove('active');
    if (manualPinBox) manualPinBox.style.display = 'none';

    userLocation = null;
    hasUserSearched = false;
    currentPage = 1;
    currentFilteredList = [];

    renderInitialHintState();
  }

  // ==================== 4. NEAR ME & GEOLOCATION (GRID-ROUNDED) ====================
  function handleNearMeClick() {
    const nearMeBtn = document.getElementById('nearMeBtn');
    if (nearMeBtn) nearMeBtn.classList.add('active');

    // Check if authenticated donor has saved coordinates in profile
    const savedLat = donorUser ? (donorUser.latitude || donorUser.lat) : null;
    const savedLng = donorUser ? (donorUser.longitude || donorUser.lng) : null;

    if (savedLat && savedLng && !isNaN(savedLat) && !isNaN(savedLng)) {
      // Use donor's saved location with option to switch
      userLocation = {
        lat: Math.round(Number(savedLat) * 100) / 100,
        lng: Math.round(Number(savedLng) * 100) / 100,
        source: 'saved',
        label: donorUser.city || 'Saved Location'
      };

      showLocationChip(`Using your saved location (${userLocation.label})`, true);
      executeSearch();
      return;
    }

    // Otherwise, request browser GPS
    requestBrowserGps(false);
  }

  function requestBrowserGps(isSwitch) {
    const nearMeBtn = document.getElementById('nearMeBtn');
    const manualPinBox = document.getElementById('manualPinBox');

    if (!navigator.geolocation) {
      if (manualPinBox) manualPinBox.style.display = 'block';
      if (nearMeBtn) nearMeBtn.classList.remove('active');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Grid-rounded to ~1 km (2 decimal places) - never store or log raw coordinates
        userLocation = {
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100,
          source: 'gps',
          label: 'Approximate GPS (~1 km grid)'
        };

        if (manualPinBox) manualPinBox.style.display = 'none';
        showLocationChip('Using your approximate location (~1 km grid)', false);
        executeSearch();
      },
      (err) => {
        console.warn('Geolocation unavailable:', err.message);
        if (nearMeBtn && !userLocation) nearMeBtn.classList.remove('active');
        // Show manual PIN code fallback
        if (manualPinBox) {
          manualPinBox.style.display = 'block';
          const pinInput = document.getElementById('manualPinInput');
          if (pinInput) pinInput.focus();
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }

  function showLocationChip(text, showSwitchBtn) {
    const chip = document.getElementById('locationStatusChip');
    const chipText = document.getElementById('locationStatusText');
    const switchBtn = document.getElementById('switchLocationBtn');

    if (chip) chip.style.display = 'inline-flex';
    if (chipText) chipText.textContent = text;
    if (switchBtn) switchBtn.style.display = showSwitchBtn ? 'inline-block' : 'none';
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

  // ==================== 5. FETCH DIRECTORY DATA ====================
  async function loadHospitalsDirectory(forceSearchIfPending = false) {
    const errorState = document.getElementById('errorState');
    if (errorState) errorState.style.display = 'none';

    try {
      const res = await fetch('/api/hospitals/directory');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        // Filter ONLY verified partner hospitals
        allHospitals = json.data.filter(h => {
          const status = String(h.verificationStatus || h.verification_status || '').trim().toLowerCase();
          return status === 'verified';
        });

        // Initialize state dropdown if not yet populated
        initStateDropdown();

        // Check if query params specify search or state
        const urlParams = new URLSearchParams(window.location.search);
        let hasParamSearch = false;

        if (urlParams.has('state')) {
          const st = urlParams.get('state');
          const stateSelect = document.getElementById('stateSelect');
          if (stateSelect) {
            stateSelect.value = st;
            updateCityDropdown(st);
            hasParamSearch = true;
          }
        }
        if (urlParams.has('city')) {
          const ct = urlParams.get('city');
          const citySelect = document.getElementById('citySelect');
          if (citySelect) {
            citySelect.value = ct;
            hasParamSearch = true;
          }
        }
        if (urlParams.has('search') || urlParams.has('q')) {
          const q = urlParams.get('search') || urlParams.get('q');
          const searchInput = document.getElementById('searchInput');
          if (searchInput) searchInput.value = q;
          hasParamSearch = true;
        }
        if (urlParams.has('bloodGroup')) {
          const bg = urlParams.get('bloodGroup');
          const bgSelect = document.getElementById('bloodGroupSelect');
          if (bgSelect) bgSelect.value = bg;
          hasParamSearch = true;
        }

        if (hasParamSearch || forceSearchIfPending) {
          executeSearch();
        } else {
          renderInitialHintState();
        }
      } else {
        throw new Error(json.message || 'Failed to load verified hospitals');
      }
    } catch (err) {
      console.error('Error fetching blood bank directory:', err);
      const grid = document.getElementById('hospitalsGrid');
      const hint = document.getElementById('initialHintState');
      const errorState = document.getElementById('errorState');
      const metaBar = document.getElementById('resultsMetaBar');
      const statsStrip = document.getElementById('headerStatsStrip');

      if (grid) grid.style.display = 'none';
      if (hint) hint.style.display = 'none';
      if (metaBar) metaBar.style.display = 'none';
      if (statsStrip) statsStrip.style.display = 'none';
      if (errorState) errorState.style.display = 'flex';
    }
  }

  function renderInitialHintState() {
    const hint = document.getElementById('initialHintState');
    const grid = document.getElementById('hospitalsGrid');
    const metaBar = document.getElementById('resultsMetaBar');
    const statsStrip = document.getElementById('headerStatsStrip');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const paginationControls = document.getElementById('paginationControls');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    if (hint) hint.style.display = 'flex';
    if (grid) grid.style.display = 'none';
    if (metaBar) metaBar.style.display = 'none';
    if (statsStrip) statsStrip.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (paginationControls) paginationControls.style.display = 'none';
    if (resetFiltersBtn) resetFiltersBtn.style.display = 'none';
  }

  // ==================== 6. EXECUTE SEARCH & PARTITIONING ====================
  function executeSearch() {
    hasUserSearched = true;
    currentPage = 1;

    const stateSelect = document.getElementById('stateSelect');
    const citySelect = document.getElementById('citySelect');
    const searchInput = document.getElementById('searchInput');
    const bloodGroupSelect = document.getElementById('bloodGroupSelect');

    const selectedState = stateSelect ? stateSelect.value.trim() : '';
    const selectedCity = citySelect ? citySelect.value.trim() : '';
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const selectedBloodGroup = bloodGroupSelect ? bloodGroupSelect.value.trim() : 'ALL';

    // 1. Filter hospitals
    let filtered = allHospitals.filter(h => {
      // State match
      if (selectedState) {
        const hState = String(h.state || '').trim().toLowerCase();
        if (hState !== selectedState.toLowerCase()) return false;
      }

      // City match
      if (selectedCity) {
        const hCity = String(h.city || '').trim().toLowerCase();
        const hDistrict = String(h.district || '').trim().toLowerCase();
        const selCityLower = selectedCity.toLowerCase();
        if (hCity !== selCityLower && hDistrict !== selCityLower) return false;
      }

      // Text search match (name, city, pincode, district, address)
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

      // Manual PIN fallback match
      if (userLocation && userLocation.source === 'pincode' && userLocation.pincode) {
        const pinTerm = userLocation.pincode.toLowerCase();
        const hPin = String(h.pincode || '').toLowerCase();
        const hCity = String(h.city || '').toLowerCase();
        if (!hPin.includes(pinTerm) && !hCity.includes(pinTerm)) {
          // If searching by PIN, filter to matching PIN or city
          return false;
        }
      }

      return true;
    });

    // 2. Compute distance if user coordinates available
    if (userLocation && userLocation.lat != null && userLocation.lng != null) {
      filtered.forEach(h => {
        const hLat = h.latitude != null ? h.latitude : h.lat;
        const hLng = h.longitude != null ? h.longitude : h.lng;
        h._distance = calculateHaversine(userLocation.lat, userLocation.lng, hLat, hLng);
      });
    } else {
      filtered.forEach(h => {
        h._distance = null;
      });
    }

    // 3. Sorting & Blood Group Partitioning
    // Requirement 3: "If a blood group is chosen, hospitals with 0 units of it are marked "None" and listed after those that have stock."
    if (selectedBloodGroup !== 'ALL') {
      const inStock = [];
      const zeroStock = [];

      filtered.forEach(h => {
        const inv = h.inventory || {};
        const count = inv[selectedBloodGroup] != null ? Number(inv[selectedBloodGroup]) : 0;
        if (count > 0) {
          inStock.push(h);
        } else {
          zeroStock.push(h);
        }
      });

      // Sort in-stock by distance (if available), then by units descending
      inStock.sort((a, b) => {
        if (a._distance != null && b._distance != null) return a._distance - b._distance;
        if (a._distance != null) return -1;
        if (b._distance != null) return 1;
        const uA = (a.inventory && a.inventory[selectedBloodGroup]) || 0;
        const uB = (b.inventory && b.inventory[selectedBloodGroup]) || 0;
        return uB - uA;
      });

      // Sort zero-stock by distance (if available)
      zeroStock.sort((a, b) => {
        if (a._distance != null && b._distance != null) return a._distance - b._distance;
        if (a._distance != null) return -1;
        if (b._distance != null) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      filtered = [...inStock, ...zeroStock];
    } else {
      // When ALL groups: sort by distance if available, otherwise by name
      if (userLocation && userLocation.lat != null) {
        filtered.sort((a, b) => {
          if (a._distance == null) return 1;
          if (b._distance == null) return -1;
          return a._distance - b._distance;
        });
      }
    }

    currentFilteredList = filtered;
    renderResultsPage(selectedState, selectedCity, searchTerm, selectedBloodGroup);
  }

  // ==================== 7. RENDER RESULTS & PAGINATION ====================
  function renderResultsPage(selectedState, selectedCity, searchTerm, selectedBloodGroup) {
    const hint = document.getElementById('initialHintState');
    const grid = document.getElementById('hospitalsGrid');
    const metaBar = document.getElementById('resultsMetaBar');
    const statsStrip = document.getElementById('headerStatsStrip');
    const countText = document.getElementById('resultsCountText');
    const emptyState = document.getElementById('emptyState');
    const errorState = document.getElementById('errorState');
    const paginationControls = document.getElementById('paginationControls');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');

    if (hint) hint.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (resetFiltersBtn) resetFiltersBtn.style.display = 'inline-flex';

    const totalCount = currentFilteredList.length;

    if (totalCount === 0) {
      if (grid) grid.style.display = 'none';
      if (metaBar) metaBar.style.display = 'none';
      if (statsStrip) statsStrip.style.display = 'none';
      if (paginationControls) paginationControls.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Show stats strip & meta bar
    if (statsStrip) {
      statsStrip.style.display = 'flex';
      updateSummaryStats(currentFilteredList);
    }

    if (metaBar) {
      metaBar.style.display = 'flex';
      if (countText) {
        countText.textContent = formatCountHeader(totalCount, selectedState, selectedCity, searchTerm);
      }
    }

    // Pagination slice (10 per page)
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = currentFilteredList.slice(startIndex, startIndex + PAGE_SIZE);

    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = pageItems.map(h => createHospitalCardHtml(h, selectedBloodGroup)).join('');
    }

    // Render pagination controls
    if (paginationControls) {
      if (totalPages > 1) {
        paginationControls.style.display = 'flex';
        renderPaginationBar(paginationControls, totalPages, totalCount);
      } else {
        paginationControls.style.display = 'none';
      }
    }
  }

  function formatCountHeader(total, selectedState, selectedCity, searchTerm) {
    const hospLabel = total === 1 ? 'verified hospital' : 'verified hospitals';
    if (selectedCity && selectedState) {
      return `${total} ${hospLabel} in ${selectedCity}, ${selectedState}`;
    }
    if (selectedState) {
      return `${total} ${hospLabel} in ${selectedState}`;
    }
    if (userLocation && userLocation.lat != null) {
      return `${total} ${hospLabel} near you (sorted by distance)`;
    }
    if (userLocation && userLocation.pincode) {
      return `${total} ${hospLabel} matching PIN ${userLocation.pincode}`;
    }
    if (searchTerm) {
      return `${total} ${hospLabel} matching "${searchTerm}"`;
    }
    return `${total} ${hospLabel} found`;
  }

  function renderPaginationBar(container, totalPages, totalCount) {
    let html = '';

    // Prev Button
    html += `
      <button type="button" class="pagination-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i> Previous
      </button>
    `;

    // Page Numbers
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
        html += `
          <button type="button" class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">
            ${p}
          </button>
        `;
      } else if (p === currentPage - 3 || p === currentPage + 3) {
        html += `<span class="pagination-ellipsis">&hellip;</span>`;
      }
    }

    // Next Button
    html += `
      <button type="button" class="pagination-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>
        Next <i class="fas fa-chevron-right"></i>
      </button>
    `;

    // Page count label
    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalCount);
    html += `
      <span class="pagination-info">Showing ${startItem}–${endItem} of ${totalCount}</span>
    `;

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.getAttribute('data-page'), 10);
        const stateSelect = document.getElementById('stateSelect');
        const citySelect = document.getElementById('citySelect');
        const searchInput = document.getElementById('searchInput');
        const bloodGroupSelect = document.getElementById('bloodGroupSelect');
        renderResultsPage(
          stateSelect ? stateSelect.value.trim() : '',
          citySelect ? citySelect.value.trim() : '',
          searchInput ? searchInput.value.trim() : '',
          bloodGroupSelect ? bloodGroupSelect.value.trim() : 'ALL'
        );
        const grid = document.getElementById('hospitalsGrid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          executeCurrentPageRender();
        }
      });
    }

    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          executeCurrentPageRender();
        }
      });
    }
  }

  function executeCurrentPageRender() {
    const stateSelect = document.getElementById('stateSelect');
    const citySelect = document.getElementById('citySelect');
    const searchInput = document.getElementById('searchInput');
    const bloodGroupSelect = document.getElementById('bloodGroupSelect');
    renderResultsPage(
      stateSelect ? stateSelect.value.trim() : '',
      citySelect ? citySelect.value.trim() : '',
      searchInput ? searchInput.value.trim() : '',
      bloodGroupSelect ? bloodGroupSelect.value.trim() : 'ALL'
    );
    const grid = document.getElementById('hospitalsGrid');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // ==================== 8. HOSPITAL CARD HTML ====================
  function createHospitalCardHtml(h, selectedBloodGroup) {
    const name = h.name || h.hospitalName || 'Verified Hospital';
    const address = h.address || `${h.city || ''}, ${h.state || ''}`.trim() || 'Address on file';
    const emergencyNum = (h.emergencyPublic !== false) ? (h.emergencyContact || h.hospitalPhone || h.phone || null) : null;

    // Distance badge
    let distanceBadge = '';
    if (h._distance != null) {
      distanceBadge = `<span class="badge-distance"><i class="fas fa-location-arrow"></i> ~${h._distance} km</span>`;
    }

    // Phone element: ONLY if hospital allowed it
    let phoneRow = '';
    if (emergencyNum && String(emergencyNum).trim() !== '') {
      phoneRow = `
        <div class="hosp-detail-row">
          <i class="fas fa-phone-alt hosp-detail-icon"></i>
          <a href="tel:${emergencyNum.replace(/\s+/g, '')}" class="hosp-phone-link">${escapeHtml(emergencyNum)}</a>
          <span class="phone-label-desc">(24x7 Emergency)</span>
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
      const isSelected = selectedBloodGroup === bg;

      let labelText = 'OK';
      let labelClass = 'label-ok';

      if (units === 0) {
        labelText = 'None';
        labelClass = 'label-none';
      } else if (units <= th) {
        labelText = 'Low';
        labelClass = 'label-low';
      }

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

  // Expose component for donor portal integration and testing
  window.Red404BloodBankDirectory = {
    load: loadHospitalsDirectory,
    search: executeSearch,
    reset: resetAllFilters,
    setHospitals: (list) => { allHospitals = list; }
  };
})();
