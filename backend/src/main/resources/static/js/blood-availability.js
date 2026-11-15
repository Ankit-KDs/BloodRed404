/**
 * RED404 — Real-time Hospital Blood Availability & Inventory Search Engine
 * Single Source of Truth • Real Live Inventory • Verified Hospitals Only
 */

(function () {
  'use strict';

  const BLOOD_TYPES_ORDER = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  let hospitalsList = [];

  // DOM Elements
  let stateSelect, districtSelect, bloodTypeSelect, componentSelect, searchBtn, resetBtn;
  let resultsContainer, resultsCountEl, totalUnitsEl, activeFilterTextEl;

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function initAvailabilityPage() {
    stateSelect = document.getElementById('filterState');
    districtSelect = document.getElementById('filterDistrict');
    bloodTypeSelect = document.getElementById('filterBloodType');
    componentSelect = document.getElementById('filterComponent');
    searchBtn = document.getElementById('filterSearchBtn');
    resetBtn = document.getElementById('filterResetBtn');

    resultsContainer = document.getElementById('hospitalResultsGrid');
    resultsCountEl = document.getElementById('resultsCountNumber');
    totalUnitsEl = document.getElementById('totalUnitsCount');
    activeFilterTextEl = document.getElementById('activeFilterSummary');

    // Parse URL params for pre-selected blood type (e.g. ?type=O-)
    const urlParams = new URLSearchParams(window.location.search);
    const prefillType = urlParams.get('type') || urlParams.get('bloodGroup');
    if (prefillType && bloodTypeSelect) {
      const match = Array.from(bloodTypeSelect.options).find(opt => opt.value.toUpperCase() === prefillType.toUpperCase());
      if (match) {
        bloodTypeSelect.value = match.value;
      }
    }

    // Attach listeners
    if (searchBtn) searchBtn.addEventListener('click', applyFilters);
    if (bloodTypeSelect) bloodTypeSelect.addEventListener('change', applyFilters);
    if (componentSelect) componentSelect.addEventListener('change', applyFilters);
    if (districtSelect) districtSelect.addEventListener('change', applyFilters);
    if (stateSelect) stateSelect.addEventListener('change', () => {
      updateDistrictDropdown();
      applyFilters();
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (stateSelect) stateSelect.value = 'ALL';
        if (districtSelect) districtSelect.value = 'ALL';
        if (bloodTypeSelect) bloodTypeSelect.value = 'ALL';
        if (componentSelect) componentSelect.value = 'ALL';
        applyFilters();
      });
    }

    await loadHospitals();
    populateDropdowns();
    applyFilters();
  }

  async function loadHospitals() {
    try {
      const res = await fetch('/api/hospitals/directory', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const raw = json.data || [];
        const userLat = parseFloat(sessionStorage.getItem('red404_user_lat'));
        const userLng = parseFloat(sessionStorage.getItem('red404_user_lng'));

        hospitalsList = raw.map(h => {
          const inv = h.inventory || {};
          const stock = {};
          BLOOD_TYPES_ORDER.forEach(bt => {
            const u = inv[bt] || inv[bt.toUpperCase()] || 0;
            stock[bt] = { units: u, critical: u <= 3 };
          });

          let dist = null;
          if (!isNaN(userLat) && !isNaN(userLng) && h.latitude && h.longitude) {
            dist = calculateDistance(userLat, userLng, h.latitude, h.longitude);
          } else if (h.distanceKm) {
            dist = parseFloat(h.distanceKm);
          }

          return {
            id: h.id,
            name: h.name || h.hospitalName || 'Partner Hospital',
            phone: h.phone || h.hospitalPhone || h.adminPhone || '',
            address: h.address ? `${h.address}, ${h.city || ''}` : (h.city || 'Verified Hospital'),
            state: h.state || '',
            district: h.city || h.district || '',
            verified: true,
            distanceKm: dist != null ? dist.toFixed(1) : null,
            stock: stock
          };
        });

        // Sort by distance if available
        hospitalsList.sort((a, b) => {
          if (a.distanceKm != null && b.distanceKm != null) {
            return parseFloat(a.distanceKm) - parseFloat(b.distanceKm);
          }
          return (a.name || '').localeCompare(b.name || '');
        });
      }
    } catch (e) {
      console.warn('Failed to fetch verified hospitals:', e);
      hospitalsList = [];
    }
  }

  function populateDropdowns() {
    if (!stateSelect || !districtSelect) return;
    const states = new Set();
    const districts = new Set();

    hospitalsList.forEach(h => {
      if (h.state && h.state.trim()) states.add(h.state.trim());
      if (h.district && h.district.trim()) districts.add(h.district.trim());
    });

    stateSelect.innerHTML = '<option value="ALL">All States</option>' +
      Array.from(states).map(s => `<option value="${s}">${s}</option>`).join('');

    districtSelect.innerHTML = '<option value="ALL">All Districts</option>' +
      Array.from(districts).map(d => `<option value="${d}">${d}</option>`).join('');
  }

  function updateDistrictDropdown() {
    if (!stateSelect || !districtSelect) return;
    const selectedState = stateSelect.value;
    const districts = new Set();

    hospitalsList.forEach(h => {
      if (selectedState === 'ALL' || (h.state && h.state.toLowerCase() === selectedState.toLowerCase())) {
        if (h.district && h.district.trim()) districts.add(h.district.trim());
      }
    });

    districtSelect.innerHTML = '<option value="ALL">All Districts</option>' +
      Array.from(districts).map(d => `<option value="${d}">${d}</option>`).join('');
  }

  function applyFilters() {
    const selectedState = stateSelect ? stateSelect.value : 'ALL';
    const selectedDistrict = districtSelect ? districtSelect.value : 'ALL';
    const selectedBloodType = bloodTypeSelect ? bloodTypeSelect.value : 'ALL';

    const matched = hospitalsList.filter(h => {
      const stateMatch = selectedState === 'ALL' || (h.state && h.state.toLowerCase() === selectedState.toLowerCase());
      let distMatch = selectedDistrict === 'ALL';
      if (!distMatch && selectedDistrict) {
        const cleanSel = selectedDistrict.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanDist = (h.district || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanCity = (h.city || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanAddr = (h.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanName = (h.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        distMatch = cleanDist.includes(cleanSel) || cleanSel.includes(cleanDist) ||
                    cleanCity.includes(cleanSel) || cleanSel.includes(cleanCity) ||
                    cleanAddr.includes(cleanSel) || cleanName.includes(cleanSel);
        if (!distMatch && cleanSel.includes('nainital')) {
          if (cleanDist.includes('bhimtal') || cleanCity.includes('bhimtal') || cleanAddr.includes('bhimtal') || cleanName.includes('bhimtal')) {
            distMatch = true;
          }
        }
      }
      let typeMatch = true;
      if (selectedBloodType !== 'ALL' && selectedBloodType) {
        const units = (h.stock && h.stock[selectedBloodType]) ? (h.stock[selectedBloodType].units || 0) : 0;
        typeMatch = units > 0;
      }
      return stateMatch && distMatch && typeMatch;
    });

    if (activeFilterTextEl) {
      let filterDesc = selectedDistrict !== 'ALL' || selectedState !== 'ALL'
        ? `Showing verified hospitals in <strong>${selectedDistrict !== 'ALL' ? selectedDistrict : 'All Districts'}${selectedState !== 'ALL' ? ', ' + selectedState : ''}</strong>`
        : `Showing all <strong>verified partner hospitals</strong>`;
      if (selectedBloodType !== 'ALL') {
        filterDesc += ` • Highlighting <strong>${selectedBloodType}</strong>`;
      }
      activeFilterTextEl.innerHTML = filterDesc;
    }

    renderHospitalCards(matched, selectedBloodType);
  }

  function renderHospitalCards(hospitals, selectedBloodType) {
    if (!resultsContainer) return;

    if (hospitals.length === 0) {
      resultsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #0f131c; border-radius: 18px; border: 1px dashed rgba(255,255,255,0.15);">
          <i class="fa-solid fa-hospital-slash" style="font-size: 2.2rem; color: #64748b; margin-bottom: 12px; display: block;"></i>
          <h3 style="color:#fff; margin-bottom: 6px;">No Verified Blood Banks Found</h3>
          <p style="color:#94a3b8; font-size: 0.88rem;">No verified partner hospitals matched your criteria. Only hospitals verified by our team appear here.</p>
        </div>
      `;
      if (resultsCountEl) resultsCountEl.textContent = '0 Hospitals';
      if (totalUnitsEl) totalUnitsEl.textContent = '0 Units';
      return;
    }

    if (resultsCountEl) resultsCountEl.textContent = `${hospitals.length} Verified Hospital${hospitals.length > 1 ? 's' : ''}`;

    let totalStock = 0;
    hospitals.forEach(h => {
      Object.values(h.stock).forEach(s => { totalStock += (s.units || 0); });
    });
    if (totalUnitsEl) totalUnitsEl.textContent = `${totalStock} Units`;

    const hasFilter = selectedBloodType && selectedBloodType !== 'ALL';

    resultsContainer.innerHTML = hospitals.map(h => {
      const tilesHtml = BLOOD_TYPES_ORDER.map(bt => {
        const item = h.stock[bt] || { units: 0, critical: false };
        const isHighlighted = hasFilter && bt.toUpperCase() === selectedBloodType.toUpperCase();
        let tileClasses = ['stock-tile'];
        if (isHighlighted) tileClasses.push('highlighted-type');
        if (item.units <= 3) tileClasses.push('critical');
        else if (item.units >= 20) tileClasses.push('plentiful');

        return `
          <div class="${tileClasses.join(' ')}" title="${bt}: ${item.units} Units available">
            <span class="stock-tile-type">${bt}</span>
            <span class="stock-tile-units">${item.units} <small style="font-size:0.65rem; opacity:0.8;">units</small></span>
          </div>
        `;
      }).join('');

      return `
        <div class="hospital-card" data-hospital-id="${h.id}">
          <div class="hosp-header">
            <div class="hosp-title-group">
              <div class="hosp-name-row">
                <h3 class="hosp-name">${h.name}</h3>
                <span class="hosp-verified-badge"><i class="fa-solid fa-circle-check"></i> VERIFIED</span>
              </div>
            </div>
            ${h.distanceKm != null ? `<span class="hosp-distance-pill"><i class="fa-solid fa-location-arrow"></i> ${h.distanceKm} km away</span>` : ''}
          </div>

          <div class="hosp-meta-row">
            <div class="hosp-meta-item">
              <i class="fa-solid fa-map-pin"></i>
              <span>${h.address}</span>
            </div>
            ${h.phone ? `
            <div class="hosp-meta-item">
              <i class="fa-solid fa-phone"></i>
              <a href="tel:${h.phone.replace(/\\s+/g, '')}">${h.phone}</a>
            </div>` : ''}
          </div>

          <div class="stock-dashboard-wrap">
            <div class="stock-dashboard-header">
              <span>Blood Units Available</span>
            </div>
            <div class="stock-tiles-grid ${hasFilter ? 'has-filter' : ''}">
              ${tilesHtml}
            </div>
          </div>

          <div class="hosp-footer-actions">
            ${h.phone ? `
            <a href="tel:${h.phone.replace(/\s+/g, '')}" class="btn-hosp-call">
              <i class="fa-solid fa-phone"></i>
              <span>Call Hospital</span>
            </a>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((h.latitude && h.longitude) ? `${h.latitude},${h.longitude}` : h.name + ', ' + h.address)}" target="_blank" rel="noopener noreferrer" class="btn-hosp-directions" title="Get directions on Google Maps">
              <i class="fa-solid fa-diamond-turn-right"></i>
              <span>Directions</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAvailabilityPage);
  } else {
    initAvailabilityPage();
  }
})();
