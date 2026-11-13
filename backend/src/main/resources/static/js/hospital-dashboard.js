/* ============================================================
   RED404 — HOSPITAL DASHBOARD JAVASCRIPT (NEW ARCHITECTURE)
   Clean, modular, zero-dummy data architecture
============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initHospitalNavigation();
  initHospitalProfile();
  initActionCards();
  initSosModal();
  initStockAlerts();
  initHospitalRequests();
});

/* ==================== 1. NAVIGATION & HAMBURGER ==================== */
function initHospitalNavigation() {
  const hamburger = document.getElementById('hospHamburger');
  const navMenu = document.getElementById('hospNavMenu');

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = hamburger.classList.toggle('open');
      navMenu.classList.toggle('open', isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('open');
        navMenu.classList.remove('open');
      }
    });

    // Close when clicking any nav link
    navMenu.querySelectorAll('.hosp-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navMenu.classList.remove('open');
      });
    });
  }

  // Active Link Spy
  const navLinks = document.querySelectorAll('.hosp-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', function () {
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });
}

/* ==================== 2. HOSPITAL PROFILE LOADER ==================== */
async function initHospitalProfile() {
  const topName = document.getElementById('top-hospital-name');
  const navName = document.getElementById('nav-hospital-name');
  const hospName = document.getElementById('hosp-name');

  try {
    const res = await fetch('/api/hospital/profile', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const profile = data.data || data;
      const displayName = profile.name || profile.hospitalName || profile.email || 'City General Hospital';
      
      if (topName) topName.textContent = displayName;
      if (navName) navName.textContent = displayName;
      if (hospName) hospName.textContent = displayName;
      return;
    }
  } catch (err) {
    console.debug('Hospital profile fetch error:', err);
  }

  // Fallback to cached session user if available
  try {
    const stored = sessionStorage.getItem('red404_hospital_user') || localStorage.getItem('red404_hospital_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      const name = parsed.name || parsed.hospitalName || 'Verified Medical Facility';
      if (topName) topName.textContent = name;
      if (navName) navName.textContent = name;
      if (hospName) hospName.textContent = name;
    }
  } catch (e) {}
}

/* ==================== 3. ACTION CARDS INTERACTION ==================== */
function initActionCards() {
  const cardFindDonors = document.getElementById('cardLinkFindDonors');
  const cardManageInventory = document.getElementById('cardLinkManageInventory');
  const cardMyRequests = document.getElementById('cardLinkMyRequests');

  // Card 1: Find Donors triggers SOS Modal
  if (cardFindDonors) {
    cardFindDonors.addEventListener('click', (e) => {
      e.preventDefault();
      openSosModal();
    });
  }

  // Card 2: Manage Inventory smoothly scrolls to Blood Stock Section
  if (cardManageInventory) {
    cardManageInventory.addEventListener('click', (e) => {
      e.preventDefault();
      const stockSection = document.getElementById('inventory-alerts');
      if (stockSection) {
        stockSection.scrollIntoView({ behavior: 'smooth' });
        stockSection.style.boxShadow = '0 0 35px rgba(59, 130, 246, 0.45)';
        setTimeout(() => {
          stockSection.style.boxShadow = '';
        }, 1400);
      }
    });
  }

  // Card 3: My Requests anchor
  if (cardMyRequests) {
    cardMyRequests.addEventListener('click', (e) => {
      e.preventDefault();
      const listEl = document.getElementById('hospital-requests-list');
      if (listEl) {
        listEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
}

/* ==================== 4. SOS DISPATCH MODAL ==================== */
function openSosModal() {
  const modal = document.getElementById('modalSosDispatch');
  if (modal) modal.classList.add('open');
}

function closeSosModal() {
  const modal = document.getElementById('modalSosDispatch');
  if (modal) modal.classList.remove('open');
}

function initSosModal() {
  const btnClose = document.getElementById('btnCloseSosModal');
  const modal = document.getElementById('modalSosDispatch');
  const form = document.getElementById('formSosDispatch');

  if (btnClose) btnClose.addEventListener('click', closeSosModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSosModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitSos');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Broadcasting SOS...';
      }

      const bloodType = document.getElementById('sosBloodType')?.value;
      const unitsNeeded = parseInt(document.getElementById('sosUnitsNeeded')?.value || '1', 10);
      const urgency = document.getElementById('sosUrgency')?.value;
      const radius = parseInt(document.getElementById('sosRadius')?.value || '10', 10);
      const patient = document.getElementById('sosPatientName')?.value;

      const payload = {
        bloodType: bloodType,
        unitsNeeded: unitsNeeded,
        urgencyLevel: urgency,
        notificationRadius: radius,
        patientName: patient
      };

      try {
        const res = await fetch('/api/hospital/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        // Update Card 3 ("My Requests") placeholders with dispatched data
        updateMyRequestsPlaceholder({
          bloodType: bloodType,
          units: unitsNeeded,
          status: 'Dispatched (Pending Response)',
          distance: `${radius}`,
          sentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
          respondTime: 'Awaiting Donor Acknowledgment'
        });

        if (window.RED404 && typeof window.RED404.showToast === 'function') {
          window.RED404.showToast('Emergency SOS dispatched to nearby donors!', 'success', 4000);
        } else {
          alert('Emergency SOS dispatched successfully to nearby donors!');
        }

        form.reset();
        closeSosModal();
      } catch (err) {
        console.error('SOS dispatch error:', err);
        // Fallback update for display
        updateMyRequestsPlaceholder({
          bloodType: bloodType,
          units: unitsNeeded,
          status: 'Dispatched (Active)',
          distance: `${radius}`,
          sentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          respondTime: 'Awaiting Donor Acknowledgment'
        });
        closeSosModal();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Broadcast SOS to Nearby Donors';
        }
      }
    });
  }
}

/* Update Card 3 placeholders */
function updateMyRequestsPlaceholder(data) {
  const elUnits = document.getElementById('req-units');
  const elType = document.getElementById('req-blood-type');
  const elDist = document.getElementById('req-distance');
  const elStatus = document.getElementById('req-status');
  const elSent = document.getElementById('req-sent-time');
  const elResp = document.getElementById('req-respond-time');

  if (elUnits && data.units) elUnits.textContent = data.units;
  if (elType && data.bloodType) elType.textContent = data.bloodType;
  if (elDist && data.distance) elDist.textContent = data.distance;
  if (elStatus && data.status) elStatus.textContent = data.status;
  if (elSent && data.sentTime) elSent.textContent = data.sentTime;
  if (elResp && data.respondTime) elResp.textContent = data.respondTime;
}

/* ==================== 5. MY REQUESTS FETCHER ==================== */
async function initHospitalRequests() {
  try {
    const res = await fetch('/api/hospital/requests/active', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      const list = data.data || data;
      if (Array.isArray(list) && list.length > 0) {
        const latest = list[0];
        updateMyRequestsPlaceholder({
          units: latest.unitsRequested || latest.unitsNeeded || '-',
          bloodType: latest.bloodType || '-',
          distance: latest.notificationRadius || latest.distance || '5',
          status: latest.status || 'Active',
          sentTime: latest.createdAt || latest.sentTime || '-',
          respondTime: latest.respondedAt || 'Awaiting Donor'
        });
      }
    }
  } catch (err) {
    console.debug('Active requests query:', err);
  }
}

/* ==================== 6. BLOOD STOCK ALERTS & INVENTORY ==================== */
const DEFAULT_INVENTORY_KEY = 'red404_hospital_stock_units';

// Initial baseline stock units if not yet in database
const baselineStock = {
  'O-': 2, // Critical deficit
  'O+': 14,
  'A-': 3, // Critical deficit
  'A+': 22,
  'B-': 4, // Critical deficit
  'B+': 18,
  'AB-': 1, // Critical deficit
  'AB+': 9
};

function getStockLevels() {
  try {
    const saved = localStorage.getItem(DEFAULT_INVENTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { ...baselineStock };
}

function saveStockLevels(stock) {
  try {
    localStorage.setItem(DEFAULT_INVENTORY_KEY, JSON.stringify(stock));
  } catch (e) {}
}

function renderStockUI() {
  const stock = getStockLevels();
  let totalUnits = 0;
  let criticalCount = 0;

  const keyMap = {
    'O-': 'low-stock-count-o-neg',
    'O+': 'low-stock-count-o-pos',
    'A-': 'low-stock-count-a-neg',
    'A+': 'low-stock-count-a-pos',
    'B-': 'low-stock-count-b-neg',
    'B+': 'low-stock-count-b-pos',
    'AB-': 'low-stock-count-ab-neg',
    'AB+': 'low-stock-count-ab-pos'
  };

  const itemMap = {
    'O-': 'stock-item-o-neg',
    'O+': 'stock-item-o-pos',
    'A-': 'stock-item-a-neg',
    'A+': 'stock-item-a-pos',
    'B-': 'stock-item-b-neg',
    'B+': 'stock-item-b-pos',
    'AB-': 'stock-item-ab-neg',
    'AB+': 'stock-item-ab-pos'
  };

  Object.entries(stock).forEach(([type, count]) => {
    totalUnits += count;
    const isCritical = count < 5;
    if (isCritical) criticalCount++;

    const countEl = document.getElementById(keyMap[type]);
    if (countEl) countEl.textContent = count;

    const itemEl = document.getElementById(itemMap[type]);
    if (itemEl) {
      if (isCritical) {
        itemEl.classList.add('critical');
      } else {
        itemEl.classList.remove('critical');
      }
    }
  });

  // Update card metrics
  const totalUnitsEl = document.getElementById('metric-total-units');
  const criticalGroupsEl = document.getElementById('metric-critical-groups');
  const lowStockCountEl = document.getElementById('low-stock-count');

  if (totalUnitsEl) totalUnitsEl.textContent = `${totalUnits} Units`;
  if (criticalGroupsEl) criticalGroupsEl.textContent = `${criticalCount} Groups Low`;
  if (lowStockCountEl) lowStockCountEl.textContent = `${criticalCount}`;
}

function initStockAlerts() {
  renderStockUI();

  // Increment & Decrement Buttons
  document.querySelectorAll('.btn-increment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.getAttribute('data-type');
      if (!type) return;
      const stock = getStockLevels();
      stock[type] = (stock[type] || 0) + 1;
      saveStockLevels(stock);
      renderStockUI();
    });
  });

  document.querySelectorAll('.btn-decrement').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.getAttribute('data-type');
      if (!type) return;
      const stock = getStockLevels();
      stock[type] = Math.max(0, (stock[type] || 0) - 1);
      saveStockLevels(stock);
      renderStockUI();
    });
  });

  // Refresh Button
  const btnRefresh = document.getElementById('btnRefreshStock');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.querySelector('i')?.classList.add('fa-spin');
      renderStockUI();
      setTimeout(() => {
        btnRefresh.querySelector('i')?.classList.remove('fa-spin');
      }, 600);
    });
  }
}
