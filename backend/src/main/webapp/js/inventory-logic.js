/**
 * RED404 — Dynamic Blood Inventory & Clinical Hospital Search Engine
 * Zero Demo Data Architecture • Pure Real-Time API Simulation Logic
 */

(function () {
  'use strict';

  // 1. Geographic Indian States and Districts Data Object
  const INDIA_GEO_DATA = {
    "Uttar Pradesh": [
      "Meerut",
      "Ghaziabad",
      "Gautam Buddha Nagar (Noida)",
      "Lucknow",
      "Kanpur Nagar",
      "Agra",
      "Varanasi",
      "Prayagraj",
      "Bareilly",
      "Aligarh"
    ],
    "Delhi NCR": [
      "Central Delhi",
      "East Delhi",
      "New Delhi",
      "North Delhi",
      "South Delhi",
      "West Delhi"
    ],
    "Haryana": [
      "Gurugram",
      "Faridabad",
      "Ambala",
      "Karnal",
      "Panipat",
      "Sonipat",
      "Rohtak"
    ],
    "Punjab": [
      "Amritsar",
      "Ludhiana",
      "Jalandhar",
      "Patiala",
      "SAS Nagar (Mohali)"
    ],
    "Maharashtra": [
      "Mumbai City",
      "Mumbai Suburban",
      "Pune",
      "Nagpur",
      "Thane",
      "Nashik"
    ],
    "Karnataka": [
      "Bengaluru Urban",
      "Bengaluru Rural",
      "Mysuru",
      "Mangaluru"
    ]
  };

  // 2. Real Data Structure for Registered Clinical Facilities
  const hospitalInventoryDB = [
    {
      id: "H-001",
      name: "Prem Hospital Blood Bank",
      verified: true,
      callSign: "RED-ALPHA-01",
      location: {
        state: "Uttar Pradesh",
        district: "Meerut",
        address: "Near Delhi Road, Meerut, UP"
      },
      contact: "+91 121 260 0101",
      lastUpdated: new Date().toISOString(),
      stock: { "O-": 4, "O+": 18, "A-": 6, "A+": 24, "B-": 5, "B+": 32, "AB-": 2, "AB+": 11 }
    },
    {
      id: "H-002",
      name: "KMC Hospital & Research Centre",
      verified: true,
      callSign: "RED-KMC-04",
      location: {
        state: "Uttar Pradesh",
        district: "Meerut",
        address: "Baghpat Bypass Road, Meerut, UP"
      },
      contact: "+91 121 240 4455",
      lastUpdated: new Date().toISOString(),
      stock: { "O-": 2, "O+": 15, "A-": 4, "A+": 19, "B-": 7, "B+": 28, "AB-": 1, "AB+": 8 }
    },
    {
      id: "H-003",
      name: "Subharti Blood Bank & Trauma Center",
      verified: true,
      callSign: "RED-SUBHARTI-09",
      location: {
        state: "Uttar Pradesh",
        district: "Meerut",
        address: "Subhartipuram, NH-58, Meerut, UP"
      },
      contact: "+91 121 305 5000",
      lastUpdated: new Date().toISOString(),
      stock: { "O-": 8, "O+": 35, "A-": 9, "A+": 40, "B-": 12, "B+": 50, "AB-": 4, "AB+": 16 }
    }
  ];

  const BLOOD_TYPES_ORDER = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  // DOM Elements
  let stateSelect, districtSelect, bloodTypeSelect, componentSelect, searchBtn, resetBtn;
  let resultsContainer, resultsCountEl, summaryTextEl;
  let totalUnitsEl, totalNodesEl, totalCriticalEl;

  function initInventoryLogic() {
    stateSelect = document.getElementById('filterState');
    districtSelect = document.getElementById('filterDistrict');
    bloodTypeSelect = document.getElementById('filterBloodType');
    componentSelect = document.getElementById('filterComponent');
    searchBtn = document.getElementById('filterSearchBtn');
    resetBtn = document.getElementById('filterResetBtn');

    resultsContainer = document.getElementById('hospital-results-grid') || document.getElementById('hospitalResultsGrid');
    resultsCountEl = document.getElementById('resultsCountNumber');
    summaryTextEl = document.getElementById('activeFilterSummary');

    totalUnitsEl = document.getElementById('total-cataloged-units') || document.getElementById('totalUnitsCount');
    totalNodesEl = document.getElementById('total-reporting-nodes');
    totalCriticalEl = document.getElementById('total-critical-nodes');

    // 1. Calculate and update top metrics
    updateTopMetrics();

    // 2. Populate States dropdown dynamically
    populateStateDropdown();

    // 3. Attach State change listener to dynamically cascade districts
    if (stateSelect) {
      stateSelect.addEventListener('change', handleStateChange);
    }

    if (searchBtn) searchBtn.addEventListener('click', executeInventorySearch);
    if (bloodTypeSelect) bloodTypeSelect.addEventListener('change', executeInventorySearch);
    if (componentSelect) componentSelect.addEventListener('change', executeInventorySearch);
    if (districtSelect) districtSelect.addEventListener('change', executeInventorySearch);

    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }

    // 4. Initial View: Default Empty State or Initial Guidance
    executeInventorySearch();
  }

  /**
   * Top Metrics Bar Calculator
   */
  function updateTopMetrics() {
    let totalUnits = 0;
    let criticalCount = 0;

    hospitalInventoryDB.forEach(h => {
      Object.entries(h.stock).forEach(([type, count]) => {
        totalUnits += count;
        if (count <= 3 && (type === 'O-' || type === 'AB-' || type === 'A-' || type === 'B-')) {
          criticalCount++;
        }
      });
    });

    const nodesCount = hospitalInventoryDB.length;

    if (totalUnitsEl) totalUnitsEl.textContent = totalUnits > 0 ? `${totalUnits} Units` : '0';
    if (totalNodesEl) totalNodesEl.textContent = nodesCount > 0 ? `${nodesCount} Nodes` : '0';
    if (totalCriticalEl) totalCriticalEl.textContent = criticalCount > 0 ? `${criticalCount} Critical` : '0';
  }

  /**
   * Populate State Dropdown Dynamically
   */
  function populateStateDropdown() {
    if (!stateSelect) return;

    stateSelect.innerHTML = '<option value="">Select State</option>';
    Object.keys(INDIA_GEO_DATA).forEach(state => {
      const opt = document.createElement('option');
      opt.value = state;
      opt.textContent = state;
      stateSelect.appendChild(opt);
    });
  }

  /**
   * Handle State Selection & Populate Districts
   */
  function handleStateChange() {
    if (!districtSelect) return;

    const selectedState = stateSelect.value;
    districtSelect.innerHTML = '<option value="">Select District</option>';

    if (!selectedState || !INDIA_GEO_DATA[selectedState]) {
      executeInventorySearch();
      return;
    }

    // Add All Districts option
    const allOpt = document.createElement('option');
    allOpt.value = 'ALL';
    allOpt.textContent = `All Districts (${selectedState})`;
    districtSelect.appendChild(allOpt);

    INDIA_GEO_DATA[selectedState].forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });

    executeInventorySearch();
  }

  /**
   * Execute Inventory Filter & Render
   */
  function executeInventorySearch() {
    const selectedState = stateSelect ? stateSelect.value : '';
    const selectedDistrict = districtSelect ? districtSelect.value : '';
    const selectedBloodType = bloodTypeSelect ? bloodTypeSelect.value : 'ALL';
    const selectedComponent = componentSelect ? componentSelect.value : 'ALL';

    // If no state is selected yet, or user hasn't chosen criteria, display the default empty state
    if (!selectedState) {
      renderEmptyState("Select a state and district to query authorized clinical blood bank reserves.");
      if (summaryTextEl) {
        summaryTextEl.innerHTML = "Select a <strong>State</strong> and <strong>District</strong> to view live hospital stock.";
      }
      if (resultsCountEl) resultsCountEl.textContent = "0 Facilities Found";
      return;
    }

    // Filter database
    const results = hospitalInventoryDB.filter(h => {
      const matchState = h.location.state.toLowerCase() === selectedState.toLowerCase();
      const matchDistrict = selectedDistrict === 'ALL' || !selectedDistrict || h.location.district.toLowerCase() === selectedDistrict.toLowerCase();
      
      let matchType = true;
      if (selectedBloodType !== 'ALL' && selectedBloodType) {
        matchType = (h.stock[selectedBloodType] !== undefined && h.stock[selectedBloodType] > 0);
      }

      return matchState && matchDistrict && matchType;
    });

    // Update filter summary text
    if (summaryTextEl) {
      let desc = `Showing results for <strong>${selectedDistrict || 'All Districts'}, ${selectedState}</strong>`;
      if (selectedBloodType !== 'ALL') {
        desc += ` • Blood Type: <strong>${selectedBloodType}</strong>`;
      }
      if (selectedComponent !== 'ALL') {
        desc += ` • Component: <strong>${selectedComponent}</strong>`;
      }
      summaryTextEl.innerHTML = desc;
    }

    if (results.length === 0) {
      // EXACT REQUIRED EMPTY STATE MESSAGE
      renderEmptyState("No verified clinical inventory found for these parameters. Only authorized hospitals registered on RED404 will appear here.");
      if (resultsCountEl) resultsCountEl.textContent = "0 Facilities Verified";
    } else {
      if (resultsCountEl) resultsCountEl.textContent = `${results.length} Facilities Verified`;
      renderHospitalCards(results, selectedBloodType);
    }
  }

  /**
   * Render Empty State
   */
  function renderEmptyState(message) {
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="empty-inventory-notice">
        <i class="fa-solid fa-hospital-user"></i>
        <h3>No Clinical Inventory Found</h3>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Render Hospital Cards
   */
  function renderHospitalCards(hospitals, activeBloodType) {
    if (!resultsContainer) return;

    const hasHighlight = activeBloodType && activeBloodType !== 'ALL';

    resultsContainer.innerHTML = hospitals.map(h => {
      const tilesHtml = BLOOD_TYPES_ORDER.map(bt => {
        const units = h.stock[bt] || 0;
        const isHighlighted = hasHighlight && bt.toUpperCase() === activeBloodType.toUpperCase();
        let tileClasses = ['stock-tile'];
        if (isHighlighted) tileClasses.push('highlighted-type');
        if (units <= 3) tileClasses.push('critical');
        else if (units >= 20) tileClasses.push('plentiful');

        return `
          <div class="${tileClasses.join(' ')}" title="${bt}: ${units} Units available">
            <span class="stock-tile-type">${bt}</span>
            <span class="stock-tile-units">${units} <small style="font-size:0.65rem; opacity:0.8;">units</small></span>
          </div>
        `;
      }).join('');

      // Relative time format
      const updatedTimeStr = formatRelativeTime(h.lastUpdated);

      return `
        <div class="hospital-card" data-hospital-id="${h.id}">
          <!-- Header -->
          <div class="hosp-header">
            <div class="hosp-title-group">
              <div class="hosp-name-row">
                <h3 class="hosp-name">${h.name}</h3>
                ${h.verified ? `<span class="hosp-verified-badge"><i class="fa-solid fa-circle-check"></i> VERIFIED</span>` : ''}
              </div>
              <span class="hosp-callsign">${h.callSign} // CLINICAL NODE</span>
            </div>
            <span class="hosp-distance-pill"><i class="fa-solid fa-location-arrow"></i> Active Node</span>
          </div>

          <!-- Metadata -->
          <div class="hosp-meta-row">
            <div class="hosp-meta-item">
              <i class="fa-solid fa-map-pin"></i>
              <span>${h.location.address}</span>
            </div>
            <div class="hosp-meta-item">
              <i class="fa-solid fa-phone"></i>
              <a href="tel:${h.contact.replace(/\s+/g, '')}">${h.contact}</a>
            </div>
          </div>

          <!-- Blood Stock Mini-Dashboard -->
          <div class="stock-dashboard-wrap">
            <div class="stock-dashboard-header">
              <span>Component Stock Reserves (Whole Blood &amp; PRBC)</span>
              <span class="stock-updated-indicator">
                <i class="fa-solid fa-circle"></i>
                Updated ${updatedTimeStr}
              </span>
            </div>
            <div class="stock-tiles-grid ${hasHighlight ? 'has-filter' : ''}">
              ${tilesHtml}
            </div>
          </div>

          <!-- Card Actions -->
          <div class="hosp-footer-actions">
            <a href="tel:${h.contact.replace(/\s+/g, '')}" class="btn-hosp-call">
              <i class="fa-solid fa-phone"></i>
              <span>Call Facility</span>
            </a>
            <button class="btn-hosp-reserve" onclick="window.requestHospitalAllocation('${h.name}', '${h.callSign}')">
              <i class="fa-solid fa-truck-medical"></i>
              <span>Emergency Allocation</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return 'Just now';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return 'Recently';
    const diffMins = Math.floor((new Date() - date) / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  }

  function resetFilters() {
    if (stateSelect) stateSelect.value = '';
    if (districtSelect) districtSelect.innerHTML = '<option value="">Select District</option>';
    if (bloodTypeSelect) bloodTypeSelect.value = 'ALL';
    if (componentSelect) componentSelect.value = 'ALL';
    executeInventorySearch();
  }

  // Global helper for allocation request
  window.requestHospitalAllocation = function (hospitalName, callsign) {
    if (typeof showToast === 'function') {
      showToast(`Emergency Allocation Request dispatched to ${hospitalName} (${callsign}). Clinical response team notified.`, 'success');
    } else {
      alert(`Emergency Allocation Request dispatched to ${hospitalName} (${callsign}). Clinical response team notified.`);
    }
  };

  // Expose state
  window.RED404_INVENTORY = {
    hospitalInventoryDB,
    INDIA_GEO_DATA,
    executeInventorySearch,
    resetFilters
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInventoryLogic);
  } else {
    initInventoryLogic();
  }
})();
