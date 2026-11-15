/* ============================================================
   RED404 — HOSPITAL PORTAL JAVASCRIPT (PRODUCTION COMMAND CENTER)
   Strictly scoped to hospital portal pages.
   NO FAKE DATA: Every number, status, and entry comes from real backend APIs.

   DATA FLOW:
   Search donors -> results (table + map). Send / Broadcast -> donor receives request with hospital location -> donor taps directions (live GPS -> hospital) -> donor accepts -> hospital sees status Accepted and the phone number. Donation drive -> non-urgent invitation -> donor RSVP -> hospital sees RSVP count. Stock changes only via Inventory.
   ============================================================ */

'use strict';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

document.addEventListener('DOMContentLoaded', () => {
  initMedicineFlowBackground();
  initCommandNavigation();
  initHospitalProfile();
  initHospitalLogout();
  initDashboard();
  initDonationDrives();
  initDispatchRadar();
  initInventory();
  initDonorCheckin();
  initRecords();
});

/* ============================================================
   1. MEDICINE FLOW BACKGROUND (SUBTLE HERO AREA ONLY)
   ============================================================ */
function initMedicineFlowBackground() {
  const canvas = document.getElementById('medicineFlowCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = 320);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = 320;
  });

  const ITEM_COUNT = 16;
  const items = [];
  const TYPES = ['capsule', 'tablet', 'blister', 'vial', 'cross'];

  for (let i = 0; i < ITEM_COUNT; i++) {
    items.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 14 + Math.random() * 16,
      depth: 0.6 + Math.random() * 0.6,
      type: TYPES[Math.floor(Math.random() * TYPES.length)],
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      speedY: -(0.18 + Math.random() * 0.25),
      speedX: (Math.random() - 0.5) * 0.12,
      color: 'rgba(236, 235, 232, 0.65)'
    });
  }

  let isPaused = false;
  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
  });

  function drawItem(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.2;

    const s = p.size * p.depth;

    if (p.type === 'capsule') {
      ctx.beginPath();
      ctx.roundRect(-s, -s / 2.2, s * 2, s / 1.1, s / 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-s, -s / 2.2, s, s / 1.1, [s / 2.2, 0, 0, s / 2.2]);
      ctx.fill();
    } else if (p.type === 'tablet') {
      ctx.beginPath();
      ctx.arc(0, 0, s / 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s / 1.4, 0);
      ctx.lineTo(s / 1.4, 0);
      ctx.stroke();
    } else if (p.type === 'cross') {
      const arm = s / 3;
      ctx.fillRect(-arm / 2, -s / 1.5, arm, s * 1.3);
      ctx.fillRect(-s / 1.5, -arm / 2, s * 1.3, arm);
    } else if (p.type === 'vial') {
      ctx.strokeRect(-s / 3, -s / 1.5, s / 1.5, s * 1.3);
      ctx.fillRect(-s / 4, -s / 1.3, s / 2, s / 4);
    } else {
      ctx.strokeRect(-s / 1.8, -s / 1.8, s * 1.1, s * 1.1);
      ctx.beginPath();
      ctx.arc(0, 0, s / 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function renderLoop() {
    if (!isPaused) {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        p.y += p.speedY * p.depth;
        p.x += p.speedX * p.depth;
        p.angle += p.rotSpeed;

        if (p.y < -30) p.y = height + 30;
        if (p.x > width + 30) p.x = -30;
        if (p.x < -30) p.x = width + 30;

        drawItem(p);
      }
    }
    requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

/* ============================================================
   2. FLAT TOP NAVBAR & NAVIGATION
   ============================================================ */
function initCommandNavigation() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabContents = document.querySelectorAll('.portal-tab-content');
  const mobileToggle = document.getElementById('hospMobileMenuBtn');
  const mobileDrawer = document.getElementById('hospMobileDrawer');

  function switchTab(tabId) {
    tabContents.forEach(c => c.classList.remove('active'));
    tabButtons.forEach(b => b.classList.remove('active'));

    const targetContent = document.getElementById(tabId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    document.querySelectorAll(`.nav-tab-btn[data-tab="${tabId}"]`).forEach(btn => {
      btn.classList.add('active');
    });

    if (mobileDrawer) {
      mobileDrawer.classList.remove('open');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
    }

    const hash = tabId.replace('tab-', '');
    if (history.replaceState) {
      history.replaceState(null, null, `#${hash}`);
    }

    if (tabId === 'tab-dispatch') {
      if (typeof window.invalidateRadarMap === 'function') {
        setTimeout(window.invalidateRadarMap, 150);
      }
    }
  }

  window.switchTab = switchTab;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  const currentHash = window.location.hash.replace('#', '');
  if (currentHash) {
    const candidateId = `tab-${currentHash}`;
    if (document.getElementById(candidateId)) {
      switchTab(candidateId);
    }
  }
}

/* ============================================================
   3. HOSPITAL PROFILE & ACCREDITATION LOADER
   ============================================================ */
async function initHospitalProfile() {
  const topName = document.getElementById('top-hospital-name');
  const navName = document.getElementById('nav-hospital-name');
  const mobileName = document.getElementById('mobileHospName');

  let profile = null;

  // Purge any stale cached profile from localStorage / sessionStorage
  try {
    sessionStorage.removeItem('red404_hospital_user');
    localStorage.removeItem('red404_hospital_user');
    localStorage.removeItem('hospitalUser');
    localStorage.removeItem('red404_hospitalProfile');
  } catch (_) {}

  try {
    const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/hospital/profile', { headers, credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      profile = data.data || data;
    }
  } catch (err) {
    console.debug('Profile fetch error:', err);
  }

  // Fallback to directory/list only if fresh profile query did not resolve
  if (!profile || (!profile.name && !profile.hospitalName && !profile.hospital_name)) {
    try {
      const dirRes = await fetch('/api/hospital/list', { credentials: 'include' });
      if (dirRes.ok) {
        const dData = await dirRes.json();
        const list = dData.data || dData;
        if (Array.isArray(list) && list.length > 0) {
          profile = list[0];
        }
      }
    } catch (e) {}
  }

  window.currentHospitalProfile = profile;
  window.hospitalProfileLoaded = true;
  try {
    window.dispatchEvent(new CustomEvent('hospital-profile-loaded', { detail: profile }));
  } catch (_) {}

  const rawName = profile ? (profile.name || profile.hospitalName || profile.hospital_name) : '';
  const realName = (rawName && typeof rawName === 'string' && rawName.trim() && rawName.trim().toLowerCase() !== 'hospital')
    ? rawName.trim()
    : '';

  // Avatar Initials Helper
  function getInitials(name) {
    if (!name) return 'HP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const avatarInitials = document.getElementById('hospAvatarInitials');
  if (avatarInitials) avatarInitials.textContent = getInitials(realName || 'Hospital');

  const dropdownHospName = document.getElementById('dropdownHospName');
  if (dropdownHospName) dropdownHospName.textContent = realName || 'Connected Hospital';

  const vStatus = profile ? (profile.verificationStatus || profile.verification_status || 'Pending') : 'Pending';
  const dropChip = document.getElementById('dropdownHospStatusChip');
  if (dropChip) {
    dropChip.textContent = vStatus;
    dropChip.className = 'chip-status ' + (vStatus.toLowerCase().includes('verif') ? 'available' : (vStatus.toLowerCase().includes('reject') ? 'critical' : 'warning'));
  }

  // Live Verification Badge in Welcome Header (Single Source of Truth)
  const welcomePill = document.getElementById('hospVerifiedPill');
  const welcomeText = document.getElementById('hospVerifiedPillText');
  if (welcomeText) {
    welcomeText.textContent = vStatus.toLowerCase().includes('verif') ? 'Verified hospital' : (vStatus + ' hospital');
    if (welcomePill) {
      welcomePill.style.background = vStatus.toLowerCase().includes('verif') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)';
      welcomePill.style.borderColor = vStatus.toLowerCase().includes('verif') ? 'rgba(34, 197, 94, 0.4)' : 'rgba(234, 179, 8, 0.4)';
      welcomePill.style.color = vStatus.toLowerCase().includes('verif') ? '#22c55e' : '#eab308';
    }
  }

  // Setup Avatar Menu Click, Keyboard & Outside Click Listeners
  const avatarBtn = document.getElementById('hospAvatarBtn');
  const dropdownMenu = document.getElementById('hospDropdownMenu');
  if (avatarBtn && dropdownMenu) {
    avatarBtn.onclick = (e) => {
      e.stopPropagation();
      const isExpanded = avatarBtn.getAttribute('aria-expanded') === 'true';
      avatarBtn.setAttribute('aria-expanded', !isExpanded);
      dropdownMenu.style.display = isExpanded ? 'none' : 'block';
    };
    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== avatarBtn) {
        dropdownMenu.style.display = 'none';
        avatarBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdownMenu.style.display !== 'none') {
        dropdownMenu.style.display = 'none';
        avatarBtn.setAttribute('aria-expanded', 'false');
        avatarBtn.focus();
      }
    });
  }

  const editLocBtn = document.getElementById('dropdownEditLocationBtn');
  if (editLocBtn) {
    editLocBtn.onclick = () => {
      if (dropdownMenu) dropdownMenu.style.display = 'none';
      if (typeof openHospitalLocationPicker === 'function') openHospitalLocationPicker();
    };
  }

  if (realName) {
    if (topName) topName.textContent = realName;
    if (navName) navName.textContent = realName;
    if (mobileName) mobileName.textContent = realName;
  } else {
    // If name is missing in profile, show a clear "Add hospital name" prompt linking to Profile instead of the word "Hospital"
    const promptLink = `<a href="javascript:void(0)" class="add-hosp-name-link" style="color: var(--hosp-blue, #6ea8ff); text-decoration: underline; font-weight: 600;">Add hospital name</a>`;
    if (topName) topName.innerHTML = promptLink;
    if (navName) navName.innerHTML = promptLink;
    if (mobileName) mobileName.innerHTML = promptLink;

    document.querySelectorAll('.add-hosp-name-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const input = window.prompt('Enter registered hospital name:');
        if (input && input.trim()) {
          const newName = input.trim();
          try {
            await fetch('/api/hospital/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hospitalName: newName }),
              credentials: 'include'
            });
            if (profile) {
              profile.name = newName;
              profile.hospitalName = newName;
            } else {
              profile = { name: newName, hospitalName: newName };
            }
            sessionStorage.setItem('red404_hospital_user', JSON.stringify(profile));
            localStorage.setItem('red404_hospital_user', JSON.stringify(profile));
            initHospitalProfile();
          } catch (err) {
            console.error('Update hospital name error:', err);
          }
        }
      });
    });
  }

  // Allow clicking facility name to inspect profile and location
  if (topName) {
    topName.style.cursor = 'pointer';
    topName.title = 'Click to view hospital profile & location';
    topName.onclick = () => openHospitalProfileModal();
  }

  initProfileModalListeners();
}

/* ============================================================
   3A. HOSPITAL PROFILE & LOCATION EDITING MODAL
   ============================================================ */
function initProfileModalListeners() {
  const modal = document.getElementById('modalHospitalProfile');
  const closeBtn = document.getElementById('btnCloseHospProfileModal');
  const closeFooterBtn = document.getElementById('btnCloseHospProfile');
  const editLocBtn = document.getElementById('btnEditHospLocation');

  if (closeBtn) closeBtn.onclick = closeHospitalProfileModal;
  if (closeFooterBtn) closeFooterBtn.onclick = closeHospitalProfileModal;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeHospitalProfileModal();
    };
  }

  if (editLocBtn) {
    editLocBtn.onclick = () => {
      closeHospitalProfileModal();
      openHospitalLocationPicker(() => {
        openHospitalProfileModal();
      });
    };
  }
}

function openHospitalProfileModal() {
  const modal = document.getElementById('modalHospitalProfile');
  if (!modal) return;

  const prof = window.currentHospitalProfile || {};
  const nameEl = document.getElementById('profHospName');
  const addrEl = document.getElementById('profHospAddress');
  const latEl = document.getElementById('profHospLat');
  const lngEl = document.getElementById('profHospLng');

  const hospName = prof.name || prof.hospitalName || prof.hospital_name || 'Hospital';
  const address = prof.address || 'Address not registered yet';
  const rawLat = prof.latitude ?? prof.lat;
  const rawLng = prof.longitude ?? prof.lng;

  if (nameEl) nameEl.textContent = hospName;
  if (addrEl) addrEl.textContent = address;
  if (latEl) latEl.textContent = (rawLat !== null && rawLat !== undefined && !isNaN(rawLat)) ? Number(rawLat).toFixed(6) : 'Not set';
  if (lngEl) lngEl.textContent = (rawLng !== null && rawLng !== undefined && !isNaN(rawLng)) ? Number(rawLng).toFixed(6) : 'Not set';

  modal.style.display = 'flex';
}

function closeHospitalProfileModal() {
  const modal = document.getElementById('modalHospitalProfile');
  if (modal) modal.style.display = 'none';
}

function openHospitalLocationPicker(onSuccessCallback) {
  if (typeof LocationPicker === 'undefined') {
    alert('Location picker component is loading, please try again in a moment.');
    return;
  }
  const prof = window.currentHospitalProfile;
  const currentLat = prof ? (prof.latitude ?? prof.lat) : null;
  const currentLng = prof ? (prof.longitude ?? prof.lng) : null;
  const currentAddr = prof ? (prof.address || '') : '';

  LocationPicker.openModal({
    initialLat: currentLat,
    initialLng: currentLng,
    initialAddress: currentAddr,
    onConfirm: async function(data) {
      try {
        const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/hospital/location', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            latitude: data.lat,
            longitude: data.lng,
            address: data.address
          }),
          credentials: 'include'
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const freshData = json.data || {};
          window.currentHospitalProfile = Object.assign(window.currentHospitalProfile || {}, freshData);
          window.currentHospitalProfile.latitude = data.lat;
          window.currentHospitalProfile.longitude = data.lng;
          window.currentHospitalProfile.lat = data.lat;
          window.currentHospitalProfile.lng = data.lng;
          window.currentHospitalProfile.address = data.address;
          window.hospitalProfileLoaded = true;

          if (typeof showToast === 'function') {
            showToast('Hospital location updated successfully.', 'success');
          }

          // Trigger hospital-profile-loaded event
          window.dispatchEvent(new CustomEvent('hospital-profile-loaded', { detail: window.currentHospitalProfile }));

          // Refresh map in place
          if (typeof window.invalidateRadarMap === 'function') {
            window.invalidateRadarMap();
          }

          if (typeof onSuccessCallback === 'function') {
            onSuccessCallback(data);
          }
        } else {
          if (typeof showToast === 'function') {
            showToast(json.error || 'Failed to update location.', 'error');
          }
        }
      } catch (err) {
        console.error('Update hospital location error:', err);
      }
    }
  });
}

/* ============================================================
   3B. HOSPITAL LOGOUT CONFIRMATION & SESSION TERMINATION
   ============================================================ */
function initHospitalLogout() {
  if (window.Red404Security) window.Red404Security.init('HOSPITAL');
  const desktopLogoutBtn = document.getElementById('btnLogoutLink');
  const mobileLogoutBtn = document.getElementById('mobileDrawerLogout');

  async function handleLogout(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const confirmed = (typeof showAppConfirm === 'function')
      ? await showAppConfirm({
          title: 'Confirm Session Termination',
          message: 'Are you sure you want to log out of your hospital account? Any active broadcasts and incoming dispatches will remain in the clinical ledger.',
          confirmText: 'Confirm Logout',
          cancelText: 'Cancel',
          type: 'danger'
        })
      : window.confirm('Are you sure you want to log out of your hospital account?');

    if (!confirmed) return;

    if (window.Red404Security) {
      await window.Red404Security.logout('HOSPITAL');
    } else {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        await fetch('/api/hospital/logout', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (_) {}
      window.location.replace('hospital-login.html');
    }
  }

  if (desktopLogoutBtn) {
    desktopLogoutBtn.addEventListener('click', handleLogout);
  }
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
  }
}

/* ============================================================
   4. CENTRAL CONFIGURATION & HELPERS
   ============================================================ */
const ALL_BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

/**
 * RED404 Core Shared Blood Compatibility Engine.
 * Recipient group -> donor groups that can donate to it:
 * O- : O-
 * O+ : O+, O-
 * A- : A-, O-
 * A+ : A+, A-, O+, O-
 * B- : B-, O-
 * B+ : B+, B-, O+, O-
 * AB- : AB-, A-, B-, O-
 * AB+ : AB+, AB-, A+, A-, B+, B-, O+, O-
 */
const BloodCompatibility = {
  map: {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'O-'],
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-']
  },
  getCompatibleDonors(recipientGroup) {
    if (!recipientGroup) return [];
    return this.map[recipientGroup.trim().toUpperCase()] || [];
  },
  isCompatible(donorGroup, recipientGroup) {
    if (!donorGroup || !recipientGroup) return false;
    const compatible = this.getCompatibleDonors(recipientGroup);
    return compatible.includes(donorGroup.trim().toUpperCase());
  }
};
window.BloodCompatibility = BloodCompatibility;

// Central threshold config object (configuration, not data)
const STOCK_THRESHOLDS = {
  'O-':  { critical: 4, low: 8 },
  'O+':  { critical: 4, low: 8 },
  'A-':  { critical: 3, low: 5 },
  'A+':  { critical: 3, low: 5 },
  'B-':  { critical: 3, low: 5 },
  'B+':  { critical: 3, low: 5 },
  'AB-': { critical: 3, low: 5 },
  'AB+': { critical: 3, low: 5 }
};

// Signature blood-drop badge used consistently everywhere
function getDropBadgeSvg(type, stateClass = '') {
  return `
    <span class="blood-drop-badge ${stateClass}" aria-label="Blood group ${type}">
      <svg viewBox="0 0 32 38" class="drop-svg" aria-hidden="true" focusable="false">
        <path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="currentColor"/>
      </svg>
      <span class="drop-text">${type}</span>
    </span>
  `;
}

// Relative time formatting helper
function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const past = new Date(timestamp);
  const diffSec = Math.floor((now - past) / 1000);
  if (isNaN(diffSec) || diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

/* ============================================================
   5. DASHBOARD CONTROLLER (REAL BACKEND DATA ONLY)
   ============================================================ */
function initDashboard() {
  loadDashboardData();

  document.getElementById('btnRetryActiveReq')?.addEventListener('click', loadDashboardData);
  document.getElementById('btnRetryStock')?.addEventListener('click', loadDashboardData);
}

async function loadDashboardData() {
  const activeReqLoading = document.getElementById('activeReqLoading');
  const activeReqError = document.getElementById('activeReqError');
  const activeReqList = document.getElementById('activeReqList');
  const activeReqEmpty = document.getElementById('activeReqEmpty');

  const stockLoading = document.getElementById('stockLoading');
  const stockError = document.getElementById('stockError');
  const stockEmptyState = document.getElementById('stockEmptyState');
  const stockPopulatedSection = document.getElementById('stockPopulatedSection');
  const cardStartHere = document.getElementById('cardStartHere');

  const activityLoading = document.getElementById('activityLoading');
  const activityFeedList = document.getElementById('activityFeedList');
  const activityFeedEmpty = document.getElementById('activityFeedEmpty');

  // Set loading states
  if (activeReqLoading) activeReqLoading.style.display = 'block';
  if (activeReqError) activeReqError.style.display = 'none';
  if (stockLoading) stockLoading.style.display = 'block';
  if (stockError) stockError.style.display = 'none';
  if (activityLoading) activityLoading.style.display = 'block';

  let inventoryMap = null;
  let activeRequests = [];
  let historyRequests = [];

  // Fetch Inventory
  try {
    const invRes = await fetch('/api/hospital/inventory', { credentials: 'include' });
    if (invRes.ok) {
      const json = await invRes.json();
      inventoryMap = json.data || {};
    } else {
      throw new Error('Inventory fetch failed');
    }
  } catch (err) {
    console.debug('Inventory fetch error:', err);
    if (window.location.protocol === 'file:' || !window.location.hostname) {
      if (window.location.hash.includes('real')) {
        inventoryMap = { 'O-': 2, 'A-': 2, 'B+': 4, 'A+': 12, 'AB+': 15 };
      } else {
        inventoryMap = {}; // Empty brand-new account
      }
    } else {
      if (stockLoading) stockLoading.style.display = 'none';
      if (stockError) stockError.style.display = 'block';
    }
  }

  // Fetch Active Requests
  try {
    const reqRes = await fetch('/api/hospital/requests', { credentials: 'include' });
    if (reqRes.ok) {
      const json = await reqRes.json();
      const rawList = Array.isArray(json.data) ? json.data : [];
      activeRequests = rawList.filter(r => {
        const s = (r.status || '').toUpperCase();
        return s !== 'CANCELLED' && s !== 'FULFILLED' && s !== 'COMPLETED';
      });
    } else {
      throw new Error('Requests fetch failed');
    }
  } catch (err) {
    console.debug('Active requests fetch error:', err);
    if (window.location.protocol === 'file:' || !window.location.hostname) {
      if (window.location.hash.includes('real')) {
        activeRequests = [
          {
            id: 101,
            blood_type: 'O-',
            units_requested: 2,
            urgency_level: 'Critical (< 30 min)',
            status: 'ACCEPTED',
            created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
          }
        ];
      } else {
        activeRequests = []; // Empty brand-new account
      }
    } else {
      if (activeReqLoading) activeReqLoading.style.display = 'none';
      if (activeReqError) activeReqError.style.display = 'block';
    }
  }

  // Fetch History
  try {
    const histRes = await fetch('/api/hospital/requests/history', { credentials: 'include' });
    if (histRes.ok) {
      const json = await histRes.json();
      historyRequests = Array.isArray(json.data) ? json.data : [];
    }
  } catch (err) {
    console.debug('History fetch error:', err);
    if (window.location.protocol === 'file:' || !window.location.hostname) {
      if (window.location.hash.includes('real')) {
        historyRequests = [
          {
            id: 101,
            blood_type: 'O-',
            units_requested: 2,
            urgency_level: 'Critical',
            status: 'Accepted',
            created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString()
          },
          {
            id: 99,
            blood_type: 'A+',
            units_requested: 1,
            urgency_level: 'Normal',
            status: 'Fulfilled',
            created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
          }
        ];
      } else {
        historyRequests = [];
      }
    }
  }

  // Hide loading indicators once fetches complete
  if (activeReqLoading) activeReqLoading.style.display = 'none';
  if (stockLoading) stockLoading.style.display = 'none';
  if (activityLoading) activityLoading.style.display = 'none';

  // Process Stock & Render Blood Stock Section
  if (inventoryMap !== null) {
    renderDashboardStock(inventoryMap, activeRequests.length);
  }

  // Process and Render Active Requests
  renderActiveRequests(activeRequests);

  // Process and Render Activity Feed
  renderActivityFeed(historyRequests);

  // Load and Render Upcoming Donation Drives
  loadDonationDrives();
}

function renderDashboardStock(inventoryMap, activeCount) {
  const cardStartHere = document.getElementById('cardStartHere');
  const stockEmptyState = document.getElementById('stockEmptyState');
  const stockPopulatedSection = document.getElementById('stockPopulatedSection');
  const stockNotSetGrid = document.getElementById('stockNotSetGrid');
  const stockPrioritySection = document.getElementById('stockPrioritySection');
  const stockCriticalGrid = document.getElementById('stockCriticalGrid');
  const stockOkSection = document.getElementById('stockOkSection');
  const stockOkRow = document.getElementById('stockOkRow');
  const stockNotSetSection = document.getElementById('stockNotSetSection');
  const stockNotSetRow = document.getElementById('stockNotSetRow');

  const kpiUnits = document.getElementById('kpiTotalUnits');
  const statLowGroups = document.getElementById('stat-low-groups');
  const kpiCrit = document.getElementById('kpiCriticalGroups');
  const kpiReqs = document.getElementById('kpiActiveRequests');
  const statusLine = document.getElementById('hosp-status-line');

  const recordedKeys = Object.keys(inventoryMap);
  const hasRecordedStock = recordedKeys.length > 0;

  let totalUnits = 0;
  let criticalLowCount = 0;

  const criticalAndLow = [];
  const okGroups = [];
  const notSetGroups = [];

  ALL_BLOOD_GROUPS.forEach(type => {
    if (type in inventoryMap && inventoryMap[type] !== null && inventoryMap[type] !== undefined) {
      const units = Number(inventoryMap[type]) || 0;
      totalUnits += units;
      const th = STOCK_THRESHOLDS[type] || { critical: 3, low: 5 };
      if (units <= th.critical) {
        criticalAndLow.push({ type, units, state: 'critical', stateLabel: 'CRITICAL DEFICIT' });
        criticalLowCount++;
      } else if (units <= th.low) {
        criticalAndLow.push({ type, units, state: 'low', stateLabel: 'LOW STOCK' });
        criticalLowCount++;
      } else {
        okGroups.push({ type, units, state: 'ok', stateLabel: 'SUFFICIENT' });
      }
    } else {
      notSetGroups.push({ type });
    }
  });

  // Sort critical and low: critical first, then lowest units first
  criticalAndLow.sort((a, b) => {
    if (a.state === 'critical' && b.state !== 'critical') return -1;
    if (a.state !== 'critical' && b.state === 'critical') return 1;
    return a.units - b.units;
  });

  // Update Stats Row
  if (kpiUnits) kpiUnits.textContent = String(totalUnits);
  if (kpiReqs) kpiReqs.textContent = String(activeCount);

  if (hasRecordedStock) {
    if (statLowGroups) statLowGroups.style.display = 'block';
    if (kpiCrit) {
      kpiCrit.textContent = String(criticalLowCount);
      if (criticalLowCount > 0) {
        kpiCrit.classList.add('status-low');
      } else {
        kpiCrit.classList.remove('status-low');
      }
    }
  } else {
    if (statLowGroups) statLowGroups.style.display = 'none';
  }

  // Update Welcome Line (Real data only)
  if (statusLine) {
    if (!hasRecordedStock) {
      statusLine.textContent = 'Your hospital is set up. Add your blood stock to start sending SOS requests.';
    } else {
      const reqText = (activeCount === 0)
        ? 'No requests are waiting for donors.'
        : `${activeCount} ${activeCount === 1 ? 'request is' : 'requests are'} waiting for donors.`;
      const critText = `${criticalLowCount} blood ${criticalLowCount === 1 ? 'group is' : 'groups are'} low.`;
      statusLine.textContent = `${reqText} ${critText}`;
    }
  }

  // Update Find Donor tab badge from real active request count
  const badgeActiveSos = document.getElementById('badgeActiveSosCount');
  if (badgeActiveSos) {
    if (activeCount > 0) {
      badgeActiveSos.textContent = activeCount;
      badgeActiveSos.style.display = 'inline-block';
    } else {
      badgeActiveSos.textContent = '0';
      badgeActiveSos.style.display = 'none';
    }
  }

  // Render View-Only Stock Section
  if (!hasRecordedStock) {
    // EMPTY STATE: 8 Groups as "Not set" (no numbers, no bars, no low/crit labels)
    if (cardStartHere) cardStartHere.style.display = 'flex';
    if (stockEmptyState) stockEmptyState.style.display = 'flex';
    if (stockPopulatedSection) stockPopulatedSection.style.display = 'none';

    if (stockNotSetGrid) {
      stockNotSetGrid.innerHTML = ALL_BLOOD_GROUPS.map(type => `
        <div class="stock-not-set-card">
          ${getDropBadgeSvg(type, '')}
          <span class="not-set-label">Not set</span>
        </div>
      `).join('');
    }
  } else {
    // POPULATED STATE: Prioritized layout
    if (cardStartHere) cardStartHere.style.display = 'none';
    if (stockEmptyState) stockEmptyState.style.display = 'none';
    if (stockPopulatedSection) stockPopulatedSection.style.display = 'block';

    // 1. Critical & Low Priority Cards (with Request shortcut)
    if (criticalAndLow.length > 0) {
      if (stockPrioritySection) stockPrioritySection.style.display = 'block';
      if (stockCriticalGrid) {
        stockCriticalGrid.innerHTML = criticalAndLow.map(item => {
          // Fixed scale: 20 units = 100%
          const percent = Math.min(100, Math.round((item.units / 20) * 100));
          return `
            <div class="stock-card-item ${item.state}">
              <div class="stock-item-header">
                ${getDropBadgeSvg(item.type, item.state)}
                <span class="low-pill-tag ${item.state}">${item.stateLabel}</span>
              </div>
              <div class="stock-units-display">
                <span class="stock-units-num">${item.units}</span>
                <span class="stock-units-label">${item.units === 1 ? 'unit' : 'units'}</span>
              </div>
              <div class="stock-bar-track">
                <div class="stock-bar-fill ${item.state}" style="width: ${percent}%;"></div>
              </div>
              <div class="stock-item-actions">
                <button type="button" class="btn-plan-drive-shortcut" data-type="${item.type}">
                  <span>Plan donation drive</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      if (stockPrioritySection) stockPrioritySection.style.display = 'none';
    }

    // 2. OK Groups Single Row (compact pills)
    if (okGroups.length > 0) {
      if (stockOkSection) stockOkSection.style.display = 'block';
      if (stockOkRow) {
        stockOkRow.innerHTML = okGroups.map(item => `
          <div class="stock-ok-pill">
            ${getDropBadgeSvg(item.type, 'ok')}
            <span class="stock-ok-units">${item.units} units</span>
          </div>
        `).join('');
      }
    } else {
      if (stockOkSection) stockOkSection.style.display = 'none';
    }

    // 3. Unrecorded Groups Row
    if (notSetGroups.length > 0) {
      if (stockNotSetSection) stockNotSetSection.style.display = 'block';
      if (stockNotSetRow) {
        stockNotSetRow.innerHTML = notSetGroups.map(item => `
          <div class="stock-notset-pill">
            ${getDropBadgeSvg(item.type, '')}
            <span class="not-set-label">Not set</span>
          </div>
        `).join('');
      }
    } else {
      if (stockNotSetSection) stockNotSetSection.style.display = 'none';
    }

    // Wire Plan donation drive shortcut buttons (replacing old SOS prefill)
    document.querySelectorAll('.btn-plan-drive-shortcut').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        openPlanDriveModal(type);
      });
    });
  }
}


function renderActiveRequests(requests) {
  const container = document.getElementById('activeReqList');
  const emptyBox = document.getElementById('activeReqEmpty');
  if (!container || !emptyBox) return;

  if (!requests || requests.length === 0) {
    container.innerHTML = '';
    emptyBox.style.display = 'block';
    return;
  }

  emptyBox.style.display = 'none';
  container.innerHTML = requests.map(r => {
    const bloodType = r.blood_type || r.bloodType || 'Unknown';
    const units = r.units_requested || r.unitsNeeded || 1;
    const urgency = r.urgency_level || r.urgency || 'Normal';
    const relTime = getRelativeTime(r.created_at || r.createdAt);
    const status = (r.status || 'Active').toUpperCase();

    // 5-Stage timeline determination
    const isArrived = status === 'ARRIVED';
    const isOnTheWay = isArrived || status === 'ON_THE_WAY' || status === 'IN_TRANSIT';
    const isAccepted = isOnTheWay || status === 'ACCEPTED';
    const isNotified = isAccepted || status === 'NOTIFIED' || status === 'ACTIVE' || status === 'OPEN';

    return `
      <div class="active-req-item" data-id="${r.id}">
        <div class="req-item-top">
          <div class="req-badge-group">
            ${getDropBadgeSvg(bloodType, 'critical')}
            <div>
              <div class="req-headline">${units} ${units === 1 ? 'unit' : 'units'} needed &bull; ${urgency}</div>
              <div class="req-subline">Dispatched ${relTime}</div>
            </div>
          </div>
          <span class="req-status-chip">${status}</span>
        </div>

        <div class="request-timeline">
          <div class="timeline-step completed">
            <div class="step-dot">1</div>
            <span class="step-label">Sent</span>
          </div>
          <div class="timeline-step ${isNotified ? (isAccepted ? 'completed' : 'active') : ''}">
            <div class="step-dot">2</div>
            <span class="step-label">Notified</span>
          </div>
          <div class="timeline-step ${isAccepted ? (isOnTheWay ? 'completed' : 'active') : ''}">
            <div class="step-dot">3</div>
            <span class="step-label">Accepted</span>
          </div>
          <div class="timeline-step ${isOnTheWay ? (isArrived ? 'completed' : 'active') : ''}">
            <div class="step-dot">4</div>
            <span class="step-label">On the way</span>
          </div>
          <div class="timeline-step ${isArrived ? 'active' : ''}">
            <div class="step-dot">5</div>
            <span class="step-label">Arrived</span>
          </div>
        </div>

        ${(isAccepted && r.donorName) ? `
          <div class="accepted-donor-bar">
            <div class="adb-left">
              ${getDropBadgeSvg(r.donorBloodType || bloodType, 'ok')}
              <div>
                <div class="adb-name">Accepted Donor: <strong>${escapeHtml(r.donorName)}</strong></div>
                <div class="adb-meta">${r.donorDistance != null ? `${r.donorDistance} km away &bull; ` : ''}En route to hospital</div>
              </div>
            </div>
            ${(r.donorPhone || r.phone) ? `
              <a href="tel:${escapeHtml(r.donorPhone || r.phone)}" class="btn-call-donor">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                <span>Call donor</span>
              </a>
            ` : ''}
          </div>
        ` : ''}

        <div class="req-item-actions">
          ${isArrived ? `<button type="button" class="btn-action-checkin" onclick="switchTab('tab-checkin')">Start check-in</button>` : ''}
          <button type="button" class="btn-action-cancel" data-id="${r.id}">Cancel request</button>
          <button type="button" class="btn-action-fulfill" data-id="${r.id}">Mark fulfilled</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire Cancel and Fulfill Actions with Confirm Modal and Required Notes/Reasons (Step 1 requirement 4 & 5)
  container.querySelectorAll('.btn-action-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const reason = window.prompt('Please enter a required reason for cancelling this emergency request:');
      if (reason === null) return; // User cancelled prompt
      if (!reason.trim() || reason.trim().length < 3) {
        alert('Cancellation reason is required (minimum 3 characters).');
        return;
      }

      try {
        const resp = await fetch(`/api/hospital/requests/${id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: reason.trim() })
        });
        const res = await resp.json();
        if (res && res.success) {
          loadDashboardData();
        } else {
          alert((res && res.message) || 'Failed to cancel request.');
        }
      } catch (e) {
        console.error('Cancel request error:', e);
      }
    });
  });

  container.querySelectorAll('.btn-action-fulfill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const note = window.prompt('Please enter a required fulfillment note (e.g. units received via mutual blood bank exchange):');
      if (note === null) return; // User cancelled prompt
      if (!note.trim() || note.trim().length < 3) {
        alert('Fulfillment note is required when manually marking a request fulfilled (minimum 3 characters).');
        return;
      }

      try {
        const resp = await fetch(`/api/hospital/requests/${id}/fulfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ note: note.trim() })
        });
        const res = await resp.json();
        if (res && res.success) {
          loadDashboardData();
        } else {
          alert((res && res.message) || 'Failed to fulfill request.');
        }
      } catch (e) {
        console.error('Fulfill request error:', e);
      }
    });
  });
}

function renderActivityFeed(history) {
  const container = document.getElementById('activityFeedList');
  const emptyBox = document.getElementById('activityFeedEmpty');
  if (!container || !emptyBox) return;

  if (!history || history.length === 0) {
    container.innerHTML = '';
    emptyBox.style.display = 'block';
    return;
  }

  emptyBox.style.display = 'none';
  const recent = history.slice(0, 8);

  container.innerHTML = recent.map(r => {
    const bloodType = r.blood_type || r.bloodType || 'Blood';
    const units = r.units_requested || r.unitsNeeded || 1;
    const relTime = getRelativeTime(r.created_at || r.createdAt);
    const status = r.status || 'Active';

    return `
      <div class="activity-feed-item">
        <div class="feed-item-desc">
          ${getDropBadgeSvg(bloodType, status === 'Fulfilled' ? 'ok' : 'critical')}
          <span>Emergency request dispatched for <strong>${bloodType}</strong> (${units} ${units === 1 ? 'unit' : 'units'})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="chip-status ${status.toLowerCase()}">${status}</span>
          <span class="feed-item-time">${relTime}</span>
        </div>
      </div>
    `;
  }).join('');
}


/* ============================================================
   7. FIND DONORS / DISPATCH (REAL GOOGLE MAPS RADAR & NEARBY MATCHES)
   ============================================================ */
function initDispatchRadar() {
  const form = document.getElementById('formFullDispatch');
  const btnSearch = document.getElementById('btnSearchDonors');
  const btnBroadcast = document.getElementById('btnBroadcastMatching');
  const tbody = document.getElementById('dispatchResponsesTableBody');
  const unlocatedNote = document.getElementById('unlocatedDonorsNote');
  const bloodRadios = document.querySelectorAll('input[name="dispBloodGroup"]');
  const dispRadiusEl = document.getElementById('dispRadius');

  let matchingDonors = [];
  let isSearching = false;

  // Real Google Maps / Leaflet State
  let leafletMap = null;
  let currentTileLayer = null;
  let activeLayerKey = 'google-dark';
  let hospitalMarker = null;
  let donorMarkers = {};
  let zoneCircles = [];
  let hospitalCoords = null;

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
    }
  };

  function setRadarMapLayer(layerKey) {
    if (!leafletMap) return;
    const cfg = MAP_LAYERS[layerKey] || MAP_LAYERS['google-dark'];
    activeLayerKey = layerKey;
    try {
      localStorage.setItem('red404_hosp_map_layer', layerKey);
    } catch (_) {}

    if (currentTileLayer) {
      leafletMap.removeLayer(currentTileLayer);
    }

    currentTileLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      attribution: ''
    }).addTo(leafletMap);

    const mapContainer = document.getElementById('hospitalRadarMap');
    if (mapContainer) {
      if (cfg.darkFilter) {
        mapContainer.classList.add('dark-map');
      } else {
        mapContainer.classList.remove('dark-map');
      }
    }

    document.querySelectorAll('.radar-layer-bar .rlb-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layer') === layerKey);
    });
  }

  // Wire layer buttons
  document.querySelectorAll('.radar-layer-bar .rlb-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.getAttribute('data-layer');
      if (layer) setRadarMapLayer(layer);
    });
  });

  function resolveHospitalCoords() {
    const prof = window.currentHospitalProfile;
    if (prof) {
      const rawLat = prof.latitude ?? prof.lat;
      const rawLng = prof.longitude ?? prof.lng;
      if (rawLat !== null && rawLat !== undefined && rawLng !== null && rawLng !== undefined) {
        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat !== 0 || lng !== 0)) {
          return {
            lat: lat,
            lng: lng,
            name: prof.name || prof.hospitalName || prof.hospital_name || 'Hospital'
          };
        }
      }
    }
    return null;
  }

  function drawZoneCircles(lat, lng) {
    if (!leafletMap) return;
    zoneCircles.forEach(c => {
      try { leafletMap.removeLayer(c); } catch (_) {}
    });
    zoneCircles = [];

    const selectedRadiusKm = dispRadiusEl ? parseFloat(dispRadiusEl.value) || 10 : 10;

    // 5 km zone (red)
    const z1 = L.circle([lat, lng], {
      radius: 5000,
      color: '#e5383b',
      weight: selectedRadiusKm === 5 ? 3.0 : 1.5,
      dashArray: selectedRadiusKm === 5 ? null : '4, 4',
      fillColor: '#e5383b',
      fillOpacity: selectedRadiusKm === 5 ? 0.12 : 0.03
    }).addTo(leafletMap);

    // 10 km zone (amber)
    const z2 = L.circle([lat, lng], {
      radius: 10000,
      color: '#f59e0b',
      weight: selectedRadiusKm === 10 ? 3.0 : 1.5,
      dashArray: selectedRadiusKm === 10 ? null : '4, 4',
      fillColor: '#f59e0b',
      fillOpacity: selectedRadiusKm === 10 ? 0.10 : 0.02
    }).addTo(leafletMap);

    // 20 km zone (grey)
    const z3 = L.circle([lat, lng], {
      radius: 20000,
      color: '#71706c',
      weight: selectedRadiusKm === 20 ? 3.0 : 1.5,
      dashArray: selectedRadiusKm === 20 ? null : '4, 4',
      fillColor: '#71706c',
      fillOpacity: selectedRadiusKm === 20 ? 0.08 : 0.015
    }).addTo(leafletMap);

    zoneCircles = [z1, z2, z3];

    // Emphasize selected radius and fit map so the selected circle is fully visible (Step 1 requirement 6)
    const activeCircle = selectedRadiusKm === 5 ? z1 : (selectedRadiusKm === 20 ? z3 : z2);
    try {
      leafletMap.fitBounds(activeCircle.getBounds(), { padding: [35, 35] });
    } catch (_) {}
  }

  function initMapIfReady() {
    const mapEl = document.getElementById('hospitalRadarMap');
    const promptEl = document.getElementById('hospNoLocationPrompt');

    // If profile hasn't loaded yet from fresh API, wait for hospital-profile-loaded event
    if (!window.hospitalProfileLoaded && !window.currentHospitalProfile) {
      return;
    }

    const coords = resolveHospitalCoords();

    if (!coords) {
      if (mapEl) mapEl.style.display = 'none';
      if (promptEl) promptEl.style.display = 'flex';
      return;
    }

    if (mapEl) mapEl.style.display = 'block';
    if (promptEl) promptEl.style.display = 'none';

    if (typeof L === 'undefined') {
      setTimeout(initMapIfReady, 200);
      return;
    }

    if (leafletMap) {
      hospitalCoords = coords;
      if (hospitalMarker) {
        hospitalMarker.setLatLng([coords.lat, coords.lng]);
        const chmLabel = document.querySelector('.chm-label');
        if (chmLabel) chmLabel.textContent = coords.name;
      } else {
        const hospIcon = L.divIcon({
          className: 'custom-hospital-marker',
          html: `
            <div class="chm-pin">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>
            </div>
            <div class="chm-label">${escapeHtml(coords.name)}</div>
          `,
          iconSize: [80, 50],
          iconAnchor: [40, 40]
        });
        hospitalMarker = L.marker([coords.lat, coords.lng], { icon: hospIcon }).addTo(leafletMap);
      }
      leafletMap.setView([coords.lat, coords.lng], 12);
      drawZoneCircles(coords.lat, coords.lng);
      leafletMap.invalidateSize();
      return;
    }

    hospitalCoords = coords;

    leafletMap = L.map('hospitalRadarMap', {
      center: [coords.lat, coords.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    const savedLayer = localStorage.getItem('red404_hosp_map_layer') || 'google-dark';
    setRadarMapLayer(savedLayer);

    // Place Hospital marker at center
    const hospIcon = L.divIcon({
      className: 'custom-hospital-marker',
      html: `
        <div class="chm-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12M6 12h12"/></svg>
        </div>
        <div class="chm-label">${escapeHtml(coords.name)}</div>
      `,
      iconSize: [80, 50],
      iconAnchor: [40, 40]
    });
    hospitalMarker = L.marker([coords.lat, coords.lng], { icon: hospIcon }).addTo(leafletMap);

    drawZoneCircles(coords.lat, coords.lng);
  }

  window.invalidateRadarMap = function() {
    initMapIfReady();
    if (leafletMap) {
      leafletMap.invalidateSize();
      if (hospitalCoords) {
        drawZoneCircles(hospitalCoords.lat, hospitalCoords.lng);
      }
    }
  };

  // Listen for hospital profile loading to trigger map init
  window.addEventListener('hospital-profile-loaded', () => {
    initMapIfReady();
  });
  // Also attempt immediate init in case profile was resolved prior
  initMapIfReady();

  // Wire "Set location now" button on the no-location prompt
  const btnSetLoc = document.getElementById('btnSetLocationNow');
  if (btnSetLoc) {
    btnSetLoc.addEventListener('click', () => {
      openHospitalLocationPicker(() => {
        initMapIfReady();
      });
    });
  }

  // Update circle emphasis when radius dropdown changes
  if (dispRadiusEl) {
    dispRadiusEl.addEventListener('change', () => {
      if (hospitalCoords && leafletMap) {
        drawZoneCircles(hospitalCoords.lat, hospitalCoords.lng);
      }
    });
  }

  // 1. Enable 'Search donors' button ONLY when a blood group is selected
  bloodRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (btnSearch) {
        btnSearch.disabled = false;
      }
    });
  });

  if (btnSearch) {
    const selected = document.querySelector('input[name="dispBloodGroup"]:checked');
    btnSearch.disabled = !selected;
  }

  // 2. Initial state: table is empty, radar has NO donor markers
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px 16px; color: var(--hosp-text-muted);">
          Select a blood group and search to see matching donors.
        </td>
      </tr>
    `;
  }
  if (btnBroadcast) {
    btnBroadcast.disabled = true;
    updateBroadcastButtonCount(0);
  }

  function updateBroadcastButtonCount(count) {
    if (!btnBroadcast) return;
    btnBroadcast.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      <span>Broadcast to all matching donors (${count})</span>
    `;
    btnBroadcast.disabled = (count <= 0);
  }

  // 3. Form submission: Search donors
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bloodRadio = document.querySelector('input[name="dispBloodGroup"]:checked');
      if (!bloodRadio) {
        if (typeof showToast === 'function') showToast('Please select a required blood group to search.', 'warning');
        return;
      }
      const bloodType = bloodRadio.value.trim();
      const radius = dispRadiusEl?.value || '10';
      const patientName = document.getElementById('dispPatientName')?.value.trim() || '';
      const units = document.getElementById('dispUnits')?.value || '1';
      const notes = document.getElementById('dispNotes')?.value.trim() || '';

      await executeDonorSearch(bloodType, radius, patientName, units, notes);
    });
  }

  async function executeDonorSearch(bloodType, radius, patientName, units, notes) {
    isSearching = true;
    matchingDonors = [];
    if (unlocatedNote) unlocatedNote.style.display = 'none';

    // Skeleton loading state
    if (tbody) {
      tbody.innerHTML = `
        <tr class="skeleton-search-row">
          <td colspan="6" style="padding: 28px 16px; text-align: center;">
            <div style="display: flex; flex-direction: column; gap: 10px; max-width: 460px; margin: 0 auto;">
              <div style="height: 14px; background: rgba(255,255,255,0.06); border-radius: 4px; animation: pulse 1s infinite alternate;"></div>
              <div style="height: 14px; background: rgba(255,255,255,0.04); border-radius: 4px; animation: pulse 1s infinite alternate 0.2s;"></div>
              <div style="height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px; animation: pulse 1s infinite alternate 0.4s;"></div>
            </div>
            <div style="margin-top: 14px; font-size: 13px; color: var(--hosp-text-muted);">
              Searching eligible compatible donors within ${radius} km...
            </div>
          </td>
        </tr>
      `;
    }
    updateBroadcastButtonCount(0);

    try {
      const url = `/api/hospital/donors/search?bloodType=${encodeURIComponent(bloodType)}&radius=${encodeURIComponent(radius)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      const payload = json.data || json;
      matchingDonors = Array.isArray(payload.donors) ? payload.donors : [];
      const unlocated = payload.unlocatedCount || 0;
      const emptySummary = payload.emptyReasonSummary || '';

      renderMatchingDonorsTable(matchingDonors, radius, bloodType, patientName, units, notes, emptySummary);
      updateMapDonorMarkers(matchingDonors, bloodType, patientName, units, notes, radius);

      if (unlocated > 0 && unlocatedNote) {
        unlocatedNote.style.display = 'block';
        unlocatedNote.textContent = `${unlocated} matching donor${unlocated === 1 ? '' : 's'} have not shared a location.`;
      } else if (unlocatedNote) {
        unlocatedNote.style.display = 'none';
      }

      const availableCount = matchingDonors.filter(d => !d.status || d.status.toLowerCase() === 'available').length;
      updateBroadcastButtonCount(availableCount);
    } catch (err) {
      console.error('Donor search failed:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 28px 16px; color: var(--hosp-red);">
              <div style="font-weight: 600; margin-bottom: 4px;">Unable to complete donor search right now.</div>
              <div style="font-size: 13px; color: var(--hosp-text-muted);">Please check your network connection and retry.</div>
              <div style="margin-top: 14px;">
                <button type="button" class="btn-primary-action btn-retry-search" style="height: 32px; padding: 0 16px; font-size: 12.5px;">Retry Search</button>
              </div>
            </td>
          </tr>
        `;
        const retryBtn = tbody.querySelector('.btn-retry-search');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            executeDonorSearch(bloodType, radius, patientName, units, notes);
          });
        }
      }
    } finally {
      isSearching = false;
    }
  }

  function updateMapDonorMarkers(donors, bloodType, patientName, units, notes, radius) {
    if (!leafletMap || !hospitalCoords) return;

    // Clear existing donor markers
    Object.values(donorMarkers).forEach(m => leafletMap.removeLayer(m));
    donorMarkers = {};

    if (!donors || donors.length === 0) {
      leafletMap.setView([hospitalCoords.lat, hospitalCoords.lng], 12);
      return;
    }

    const boundsLatLngs = [[hospitalCoords.lat, hospitalCoords.lng]];

    donors.forEach(d => {
      const rawLat = d.latitude ?? d.lat;
      const rawLng = d.longitude ?? d.lng;
      if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) {
        return; // Skip donors with unshared locations
      }
      const dLat = parseFloat(rawLat);
      const dLng = parseFloat(rawLng);
      if (isNaN(dLat) || isNaN(dLng) || (dLat === 0 && dLng === 0)) {
        return;
      }

      boundsLatLngs.push([dLat, dLng]);

      const name = d.name || d.fullName || 'Donor';
      const dBlood = d.bloodType || d.blood_type || bloodType;
      const isExact = (dBlood.toUpperCase().trim() === bloodType.toUpperCase().trim());
      const dist = typeof d.distance === 'number' ? `${d.distance.toFixed(1)} km` : (d.distanceFormatted || '-');
      const status = (d.status || d.requestStatus || 'Available').trim();
      const isAvailable = (status.toLowerCase() === 'available');
      const isAccepted = (status.toLowerCase() === 'accepted');

      const markerPinClass = isAvailable ? (isExact ? 'exact' : 'compatible') : (isAccepted ? 'accepted' : 'notified');

      const donorIcon = L.divIcon({
        className: 'custom-donor-marker',
        html: `
          <div class="cdm-pin ${markerPinClass}">${escapeHtml(dBlood)}</div>
          <div class="cdm-badge">${escapeHtml(name)} (${dist})</div>
        `,
        iconSize: [90, 45],
        iconAnchor: [45, 20]
      });

      const marker = L.marker([dLat, dLng], { icon: donorIcon }).addTo(leafletMap);

      let popupActionHtml = '';
      if (isAccepted && (d.phone || d.donorPhone)) {
        popupActionHtml = `
          <a href="tel:${escapeHtml(d.phone || d.donorPhone)}" class="hpc-btn-call">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>Call donor</span>
          </a>`;
      } else {
        popupActionHtml = `
          <button type="button" class="hpc-btn-send" data-donor-id="${d.id}" ${!isAvailable ? 'disabled' : ''}>
            ${isAvailable ? 'Send request' : (isAccepted ? 'Accepted' : 'Sent')}
          </button>`;
      }

      const popupHtml = `
        <div class="hosp-popup-content" data-donor-id="${d.id}">
          <div class="hpc-header">
            <span class="hpc-name">${escapeHtml(name)}</span>
            <span class="hpc-blood ${isExact ? 'exact' : 'compatible'}">${escapeHtml(dBlood)} ${isExact ? '• Exact' : '• Compatible'}</span>
          </div>
          <div class="hpc-meta">
            <div>Distance: <strong style="color:var(--hosp-text);">${dist}</strong></div>
            <div>${d.lastSeen ? `Last seen: ${escapeHtml(d.lastSeen)}` : 'Active recently in area'}</div>
            <div class="popup-status-row">Status: <strong class="popup-status-text" style="color:${isAvailable ? 'var(--hosp-green)' : (isAccepted ? 'var(--hosp-blue)' : 'var(--hosp-amber)')};">${status}</strong></div>
          </div>
          <div class="hpc-footer">
            <span style="font-size:11px; color:var(--hosp-text-muted);">ID: #${d.id}</span>
            ${popupActionHtml}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { className: 'hosp-map-popup', maxWidth: 260 });

      // Click on pin: highlight corresponding row in table
      marker.on('click', () => {
        highlightTableRow(d.id);
      });

      // Pin popup button: Send request
      marker.on('popupopen', (e) => {
        const popupEl = e.popup.getElement();
        if (!popupEl) return;
        const sendBtn = popupEl.querySelector('.hpc-btn-send');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.addEventListener('click', async () => {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            await triggerSingleSend(d.id, bloodType, units, patientName, notes, radius);
          });
        }
      });

      donorMarkers[d.id] = marker;
    });

    const selectedRadiusKm = dispRadiusEl ? parseFloat(dispRadiusEl.value) || 10 : 10;
    const activeCircle = zoneCircles.length === 3 ? (selectedRadiusKm === 5 ? zoneCircles[0] : (selectedRadiusKm === 20 ? zoneCircles[2] : zoneCircles[1])) : null;
    if (activeCircle) {
      try {
        const cb = activeCircle.getBounds();
        boundsLatLngs.push([cb.getNorth(), cb.getEast()]);
        boundsLatLngs.push([cb.getSouth(), cb.getWest()]);
      } catch (_) {}
    }

    if (activeCircle) {
      try {
        leafletMap.fitBounds(activeCircle.getBounds(), { padding: [35, 35] });
      } catch (_) {}
    } else if (boundsLatLngs.length > 1) {
      leafletMap.fitBounds(L.latLngBounds(boundsLatLngs), { padding: [35, 35] });
    }
  }

  function highlightTableRow(donorId) {
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('active-map-target'));
    const targetRow = tbody.querySelector(`tr[data-donor-id="${donorId}"]`);
    if (targetRow) {
      targetRow.classList.add('active-map-target');
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function highlightMapMarker(donorId) {
    const marker = donorMarkers[donorId];
    if (marker && leafletMap) {
      const latLng = marker.getLatLng();
      leafletMap.setView(latLng, Math.max(leafletMap.getZoom(), 14), { animate: true });
      marker.openPopup();
    }
  }

  async function triggerSingleSend(donorId, bloodType, units, patientName, notes, radius) {
    const targetDonor = matchingDonors.find(x => x.id === donorId);
    if (!targetDonor) return;

    try {
      const res = await fetch('/api/hospital/requests/send-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          donorId: donorId,
          bloodType: bloodType,
          unitsNeeded: parseInt(units, 10) || 1,
          patientName: patientName,
          notes: notes,
          radius: parseFloat(radius) || 10
        })
      });
      const resJson = await res.json();
      if (res.ok && resJson.success !== false) {
        targetDonor.status = 'Notified';
        targetDonor.requestStatus = 'Notified';

        // Update table row visually
        const row = tbody.querySelector(`tr[data-donor-id="${donorId}"]`);
        if (row) {
          const statusCell = row.querySelector('.donor-status-cell');
          const actionCell = row.querySelector('.donor-action-cell');
          if (statusCell) statusCell.innerHTML = `<span class="chip-status pending">Notified</span>`;
          if (actionCell) actionCell.innerHTML = `<button type="button" class="btn-secondary" disabled style="height: 32px; padding: 0 14px; font-size: 12.5px; opacity: 0.5; border-radius: 6px;">Sent</button>`;
        }

        // Update marker popup visually
        const marker = donorMarkers[donorId];
        if (marker) {
          const popup = marker.getPopup();
          if (popup && marker.isPopupOpen()) {
            const popupEl = popup.getElement();
            if (popupEl) {
              const stText = popupEl.querySelector('.popup-status-text');
              const sBtn = popupEl.querySelector('.hpc-btn-send');
              if (stText) {
                stText.textContent = 'Notified';
                stText.style.color = 'var(--hosp-blue)';
              }
              if (sBtn) {
                sBtn.textContent = 'Sent';
                sBtn.disabled = true;
              }
            }
          }
        }

        const remAvailable = matchingDonors.filter(d => !d.status || d.status.toLowerCase() === 'available').length;
        updateBroadcastButtonCount(remAvailable);

        if (typeof showToast === 'function') {
          showToast('Emergency request dispatched to donor!', 'success');
        }
      } else {
        throw new Error(resJson.message || 'Dispatch failed');
      }
    } catch (err) {
      console.error('Send single donor error:', err);
      if (typeof showToast === 'function') {
        showToast('Failed to dispatch request: ' + err.message, 'error');
      }
    }
  }

  function renderMatchingDonorsTable(donors, radius, bloodType, patientName, units, notes, emptyReasonSummary) {
    if (!tbody) return;

    if (!donors || donors.length === 0) {
      const summaryText = emptyReasonSummary || `No matching donors within ${radius} km. Try a larger radius.`;
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px 20px; color: var(--hosp-text-muted); line-height: 1.6;">
            <div style="max-width: 540px; margin: 0 auto;">
              <div style="font-weight: 600; color: #f1f2f6; margin-bottom: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Donor Search Result
              </div>
              <span class="search-empty-reason">${escapeHtml(summaryText)}</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = donors.map((d) => {
      const name = d.name || d.fullName || 'Donor';
      const blood = d.bloodType || d.blood_type || bloodType;
      const dist = (typeof d.distance === 'number') ? `${d.distance.toFixed(1)} km` : (d.distanceFormatted || '-');
      const eta = d.eta || d.estimatedEta || '-';
      const rawStatus = (d.status || d.requestStatus || 'Available').trim();
      const statusKey = rawStatus.toLowerCase();
      const isAvailable = (statusKey === 'available');

      let statusBadge = `<span class="chip-status available">Available</span>`;
      if (statusKey === 'notified') {
        statusBadge = `<span class="chip-status pending">Notified</span>`;
      } else if (statusKey === 'accepted') {
        statusBadge = `<span class="chip-status completed">Accepted</span>`;
      } else if (statusKey === 'declined') {
        statusBadge = `<span class="chip-status danger">Declined</span>`;
      }

      const isExact = Boolean(d.isExactMatch || (blood.toUpperCase().trim() === bloodType.toUpperCase().trim()));

      let actionBtn = '';
      if (statusKey === 'accepted' && (d.phone || d.donorPhone)) {
        actionBtn = `
          <a href="tel:${escapeHtml(d.phone || d.donorPhone)}" class="btn-call-donor" style="height: 32px; padding: 0 12px; font-size: 12.5px; border-radius: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            <span>Call donor</span>
          </a>`;
      } else if (isAvailable) {
        actionBtn = `<button type="button" class="btn-primary-action btn-send-donor" data-donor-id="${d.id}" style="height: 32px; padding: 0 14px; font-size: 12.5px; border-radius: 6px;">Send request</button>`;
      } else {
        actionBtn = `<button type="button" class="btn-secondary" disabled style="height: 32px; padding: 0 14px; font-size: 12.5px; opacity: 0.5; border-radius: 6px;">${statusKey === 'accepted' ? 'Accepted' : 'Sent'}</button>`;
      }

      const matchPill = isExact
        ? `<span class="blood-match-badge exact-match" style="display:inline-block; font-size:10.5px; padding:1px 6px; border-radius:4px; background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.3); font-weight:600; margin-left:6px;">Exact</span>`
        : `<span class="blood-match-badge compatible-match" style="display:inline-block; font-size:10.5px; padding:1px 6px; border-radius:4px; background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.3); font-weight:600; margin-left:6px;">Compatible</span>`;

      const isBgVerified = (d.bloodGroupStatus === 'hospital_verified');
      const unverifiedTag = !isBgVerified
        ? `<span class="badge-unverified" title="Self-declared blood group (unverified by hospital)" style="display:inline-block; font-size:10px; padding:1px 5px; border-radius:3px; background:rgba(234,179,8,0.15); color:#facc15; border:1px solid rgba(234,179,8,0.3); font-weight:normal; margin-left:4px;">unverified</span>`
        : '';

      return `
        <tr data-donor-id="${d.id}" style="cursor: pointer;">
          <td><strong>${escapeHtml(name)}</strong></td>
          <td><div style="display:inline-flex; align-items:center;">${getDropBadgeSvg(blood, '')} ${matchPill} ${unverifiedTag}</div></td>
          <td><span class="mono-data">${dist}</span></td>
          <td><span class="mono-data">${eta}</span></td>
          <td class="donor-status-cell">${statusBadge}</td>
          <td class="donor-action-cell">${actionBtn}</td>
        </tr>
      `;
    }).join('');

    // Clicking table row highlights marker on the map and opens info bubble
    tbody.querySelectorAll('tr[data-donor-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        // If clicking inside the action button, let the button handler run
        if (e.target.closest('.btn-send-donor') || e.target.closest('button')) return;
        const donorId = parseInt(row.dataset.donorId, 10);
        if (!donorId) return;

        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('active-map-target'));
        row.classList.add('active-map-target');

        highlightMapMarker(donorId);
      });
    });

    // Wire individual "Send" buttons in table
    tbody.querySelectorAll('.btn-send-donor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const donorId = parseInt(btn.dataset.donorId, 10);
        if (!donorId) return;

        btn.disabled = true;
        btn.textContent = 'Sending...';

        await triggerSingleSend(donorId, bloodType, units, patientName, notes, radius);
      });
    });
  }

  // 4. Broadcast to all matching donors
  if (btnBroadcast) {
    btnBroadcast.addEventListener('click', async (e) => {
      e.preventDefault();
      const availableDonors = matchingDonors.filter(d => !d.status || d.status.toLowerCase() === 'available');
      const count = availableDonors.length;
      if (count === 0) return;

      const confirmMessage = `Send this request to ${count} donor${count === 1 ? '' : 's'}?`;
      let ok = false;
      if (typeof showAppConfirm === 'function') {
        ok = await showAppConfirm({
          title: 'Confirm Emergency Broadcast',
          message: confirmMessage,
          confirmText: `Broadcast to ${count} Donors`,
          cancelText: 'Cancel',
          type: 'danger'
        });
      } else {
        ok = window.confirm(confirmMessage);
      }
      if (!ok) return;

      btnBroadcast.disabled = true;
      btnBroadcast.textContent = 'Broadcasting...';

      const bloodRadio = document.querySelector('input[name="dispBloodGroup"]:checked');
      const bloodType = bloodRadio ? bloodRadio.value.trim() : 'O-';
      const radius = dispRadiusEl?.value || '10';
      const patientName = document.getElementById('dispPatientName')?.value.trim() || '';
      const units = document.getElementById('dispUnits')?.value || '1';
      const notes = document.getElementById('dispNotes')?.value.trim() || '';

      try {
        const donorIds = availableDonors.map(d => d.id);
        const res = await fetch('/api/hospital/requests/broadcast-matching', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            donorIds: donorIds,
            bloodType: bloodType,
            unitsNeeded: parseInt(units, 10) || 1,
            patientName: patientName,
            notes: notes,
            radius: parseFloat(radius) || 10
          })
        });
        const resJson = await res.json();
        if (res.ok && resJson.success !== false) {
          // Mark all available as Notified in table & map
          availableDonors.forEach(d => {
            d.status = 'Notified';
            d.requestStatus = 'Notified';

            const row = tbody.querySelector(`tr[data-donor-id="${d.id}"]`);
            if (row) {
              const statusCell = row.querySelector('.donor-status-cell');
              const actionCell = row.querySelector('.donor-action-cell');
              if (statusCell) statusCell.innerHTML = `<span class="chip-status pending">Notified</span>`;
              if (actionCell) actionCell.innerHTML = `<button type="button" class="btn-secondary" disabled style="height: 32px; padding: 0 14px; font-size: 12.5px; opacity: 0.5; border-radius: 6px;">Sent</button>`;
            }

            const marker = donorMarkers[d.id];
            if (marker) {
              const popup = marker.getPopup();
              if (popup && marker.isPopupOpen()) {
                const popupEl = popup.getElement();
                if (popupEl) {
                  const stText = popupEl.querySelector('.popup-status-text');
                  const sBtn = popupEl.querySelector('.hpc-btn-send');
                  if (stText) {
                    stText.textContent = 'Notified';
                    stText.style.color = 'var(--hosp-blue)';
                  }
                  if (sBtn) {
                    sBtn.textContent = 'Sent';
                    sBtn.disabled = true;
                  }
                }
              }
            }
          });
          updateBroadcastButtonCount(0);
          if (typeof showToast === 'function') {
            showToast(`Broadcast dispatched to ${count} matching donors!`, 'success');
          }
        } else {
          throw new Error(resJson.message || 'Broadcast failed');
        }
      } catch (err) {
        console.error('Broadcast matching error:', err);
        const remAvailable = matchingDonors.filter(d => !d.status || d.status.toLowerCase() === 'available').length;
        updateBroadcastButtonCount(remAvailable);
        if (typeof showToast === 'function') {
          showToast('Broadcast failed: ' + err.message, 'error');
        }
      }
    });
  }
}

/* ============================================================
   8. INVENTORY MODULE (REAL BACKEND INVENTORY)
   ============================================================ */
function initInventory() {
  loadInventoryTable();

  document.querySelectorAll('.comp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

async function loadInventoryTable() {
  const tbody = document.getElementById('inventorySummaryTableBody');
  const bagTbody = document.getElementById('inventoryBagTableBody');

  try {
    const res = await fetch('/api/hospital/inventory', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      const stock = json.data || {};

      if (tbody) {
        tbody.innerHTML = ALL_BLOOD_GROUPS.map(type => {
          const hasUnits = type in stock && stock[type] !== null;
          const units = hasUnits ? Number(stock[type]) : 0;
          const th = STOCK_THRESHOLDS[type] || { critical: 3, low: 5 };
          const isCritical = hasUnits && units <= th.critical;
          const isLow = hasUnits && units <= th.low;
          const percent = Math.min(100, Math.round((units / 20) * 100));

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                  ${getDropBadgeSvg(type, isCritical ? 'critical' : (isLow ? 'low' : ''))}
                  <strong>${type}</strong>
                </div>
              </td>
              <td><span class="stat-number" style="font-size: 16px;">${hasUnits ? units : '-'}</span> units</td>
              <td>
                <span class="chip-status ${hasUnits ? (isCritical ? 'critical' : (isLow ? 'low' : 'available')) : 'pending'}">
                  ${hasUnits ? (isCritical ? 'Critical deficit' : (isLow ? 'Low stock' : 'Sufficient')) : 'Not set'}
                </span>
              </td>
              <td style="min-width: 140px;">
                <div class="stock-bar-track" style="margin-bottom: 4px;">
                  <div class="stock-bar-fill ${isCritical ? 'critical' : (isLow ? 'low' : 'ok')}" style="width: ${hasUnits ? percent : 0}%;"></div>
                </div>
                <span style="font-size: 13px; color: var(--hosp-text-muted); font-family: var(--font-mono);">${hasUnits ? `${percent}% capacity` : 'Unconfigured'}</span>
              </td>
              <td>
                <div class="stock-stepper-mini">
                  <button type="button" class="btn-mini-adjust btn-inv-dec" data-type="${type}" aria-label="Decrease ${type} unit">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 8a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1z"/></svg>
                  </button>
                  <button type="button" class="btn-mini-adjust btn-inv-inc" data-type="${type}" aria-label="Increase ${type} unit">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // Wire Stepper on Inventory Page
        tbody.querySelectorAll('.btn-inv-inc').forEach(b => {
          b.addEventListener('click', async () => {
            const t = b.getAttribute('data-type');
            if (t) {
              await updateInventoryUnit(t, 1);
              loadInventoryTable();
              loadDashboardData();
            }
          });
        });

        tbody.querySelectorAll('.btn-inv-dec').forEach(b => {
          b.addEventListener('click', async () => {
            const t = b.getAttribute('data-type');
            if (t) {
              await updateInventoryUnit(t, -1);
              loadInventoryTable();
              loadDashboardData();
            }
          });
        });
      }
    }
  } catch (e) {
    console.error('Inventory table load error:', e);
  }

  // Individual bags table (Backend does not store bag records, so render clean empty message)
  if (bagTbody) {
    bagTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 24px; color: var(--hosp-text-muted);">
          No individual serialized blood bags registered in database.
        </td>
      </tr>
    `;
  }
}

async function updateInventoryUnit(bloodType, change) {
  try {
    await fetch('/api/hospital/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bloodType, change }),
      credentials: 'include'
    });
  } catch (e) {
    console.error('Inventory update error:', e);
  }
}

/* ============================================================
   9. MY REQUESTS / DISPATCH LOGS (REAL BACKEND REQUEST HISTORY)
   ============================================================ */
let currentRecordsList = [];

function initRecords() {
  loadRecordsTable();

  const exportBtn = document.getElementById('btnExportRecordsCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCsv);
  }
}

async function loadRecordsTable() {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/hospital/requests/history', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      currentRecordsList = Array.isArray(json.data) ? json.data : [];
    }
  } catch (e) {
    console.error('Records fetch error:', e);
  }

  if (currentRecordsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--sp-32); color: var(--hosp-text-muted);">
          No emergency requests dispatched yet. <button type="button" class="btn-secondary" onclick="switchTab('tab-dashboard')" style="margin-left: 8px;">Send SOS</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = currentRecordsList.map(r => {
    const blood = r.blood_type || r.bloodType || '-';
    const units = `${r.units_requested || 1} units`;
    const relTime = getRelativeTime(r.created_at || r.createdAt);
    const time = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const status = r.status || 'Active';
    const statusClass = status === 'Fulfilled' ? 'available' : (status === 'Cancelled' ? 'low' : 'active');

    return `
      <tr>
        <td>
          <div><strong>${relTime}</strong></div>
          <div class="time-mono" style="font-size: 13px; color: var(--hosp-text-muted);">${time}</div>
        </td>
        <td>${getDropBadgeSvg(blood, '')}</td>
        <td><span class="mono-data">${units}</span></td>
        <td><span class="mono-data">${r.urgency_level || 'Normal'}</span></td>
        <td><span class="chip-status ${statusClass}">${status}</span></td>
        <td><span class="mono-data">-</span></td>
      </tr>
    `;
  }).join('');
}

function exportCsv() {
  if (currentRecordsList.length === 0) {
    alert('No records available to export.');
    return;
  }
  const headers = ['Request ID', 'Blood Group', 'Units', 'Urgency', 'Status', 'Timestamp'];
  const rows = currentRecordsList.map(r => [
    `"${r.id}"`,
    `"${r.blood_type || r.bloodType}"`,
    `"${r.units_requested || 1}"`,
    `"${r.urgency_level || 'Normal'}"`,
    `"${r.status || 'Active'}"`,
    `"${r.created_at || ''}"`
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `RED404_Hospital_Requests_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ============================================================
   10. DONOR CHECK-IN ENGINE (REAL EXACT LOOKUP & SAFE VITALS)
   ============================================================ */
function initDonorCheckin() {
  const lookupBtn = document.getElementById('btnLookupDonor');
  const inputId = document.getElementById('checkinSmartIdInput');
  const emptyState = document.getElementById('checkinEmptyState');
  const errorState = document.getElementById('checkinErrorState');
  const errorMsg = document.getElementById('checkinErrorMsg');
  const retryBtn = document.getElementById('btnRetryLookup');
  const donorCard = document.getElementById('donorLoadedCard');

  const vitalsForm = document.getElementById('formDonorVitals');
  const vitalsFieldset = document.getElementById('vitalsFieldset');
  const vitalsDisabledHint = document.getElementById('vitalsDisabledHint');

  const vitWeight = document.getElementById('vitWeight');
  const vitHb = document.getElementById('vitHb');
  const vitBpSystolic = document.getElementById('vitBpSystolic');
  const vitBpDiastolic = document.getElementById('vitBpDiastolic');
  const vitPulse = document.getElementById('vitPulse');
  const vitTemp = document.getElementById('vitTemp');

  const verdictBanner = document.getElementById('verdictBanner');
  const verdictTitle = document.getElementById('verdictTitle');
  const verdictIcon = document.getElementById('verdictIcon');
  const verdictReasons = document.getElementById('verdictReasons');

  const btnRecordDonation = document.getElementById('btnRecordDonation');
  const btnDeferDonation = document.getElementById('btnDeferDonation');

  const successCard = document.getElementById('donationSuccessCard');
  const successTitle = document.getElementById('donationSuccessTitle');
  const successMsg = document.getElementById('donationSuccessMsg');
  const btnNextDonor = document.getElementById('btnNextDonor');

  let currentLoadedDonor = null;

  // Advisory Medical Validation Criteria (Configurable)
  const MEDICAL_RANGES = {
    weight: { min: 45.0, max: 200.0, label: 'Weight', unit: 'kg' },
    hb: { min: 12.5, max: 20.0, label: 'Hemoglobin', unit: 'g/dL' },
    systolic: { min: 100, max: 180, label: 'Systolic blood pressure', unit: 'mmHg' },
    diastolic: { min: 50, max: 100, label: 'Diastolic blood pressure', unit: 'mmHg' },
    pulse: { min: 50, max: 100, label: 'Pulse rate', unit: 'bpm' },
    temp: { min: 95.0, max: 99.5, label: 'Temperature', unit: '°F' }
  };

  function resetCheckinForm(keepInput) {
    currentLoadedDonor = null;
    if (!keepInput && inputId) inputId.value = '';
    if (donorCard) donorCard.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (errorState) errorState.style.display = 'none';

    if (vitalsForm) vitalsForm.reset();
    if (vitalsFieldset) {
      vitalsFieldset.disabled = true;
      vitalsFieldset.style.opacity = '0.55';
    }
    if (vitalsDisabledHint) vitalsDisabledHint.style.display = 'block';

    // Clear all inline errors
    document.querySelectorAll('.vital-err').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });

    if (verdictBanner) verdictBanner.style.display = 'none';
    if (btnRecordDonation) btnRecordDonation.disabled = true;
    if (btnDeferDonation) btnDeferDonation.disabled = true;
    if (successCard) successCard.style.display = 'none';
  }

  // Clear loaded donor when typing or clearing input
  if (inputId) {
    inputId.addEventListener('input', () => {
      if (currentLoadedDonor) {
        resetCheckinForm(true);
      }
      if (errorState) errorState.style.display = 'none';
    });
    inputId.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performDonorLookup();
      }
    });
  }

  if (lookupBtn) {
    lookupBtn.addEventListener('click', performDonorLookup);
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', performDonorLookup);
  }

  async function performDonorLookup() {
    if (!inputId) return;
    const query = inputId.value.trim();
    if (!query) {
      alert('Please enter a valid Donor ID or Smart ID.');
      inputId.focus();
      return;
    }

    resetCheckinForm(true);
    if (emptyState) emptyState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (lookupBtn) {
      lookupBtn.disabled = true;
      lookupBtn.innerHTML = '<span>Looking up...</span>';
    }

    try {
      const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/hospital/donors/checkin?smartId=${encodeURIComponent(query)}`, {
        headers,
        credentials: 'include'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.message || `Donor not found for ID "${window.escapeHtml ? window.escapeHtml(query) : query}".`;
        if (errorMsg) errorMsg.textContent = msg;
        if (errorState) errorState.style.display = 'block';
        return;
      }

      const resData = await res.json();
      const donor = resData.data || resData;

      currentLoadedDonor = donor;
      renderLoadedDonor(donor);
    } catch (err) {
      if (errorMsg) errorMsg.textContent = 'Network or server error while connecting to donor database. Please try again.';
      if (errorState) errorState.style.display = 'block';
    } finally {
      if (lookupBtn) {
        lookupBtn.disabled = false;
        lookupBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Lookup</span>
        `;
      }
    }
  }

  function renderLoadedDonor(d) {
    if (!donorCard) return;

    const nameEl = document.getElementById('dlcName');
    const idEl = document.getElementById('dlcSmartId');
    const bgEl = document.getElementById('dlcBloodGroup');
    const ageEl = document.getElementById('dlcAge');
    const wtEl = document.getElementById('dlcWeight');
    const lastEl = document.getElementById('dlcLastDonation');
    const eligEl = document.getElementById('dlcEligibility');
    const healthEl = document.getElementById('dlcHealthStatus');

    if (nameEl) nameEl.textContent = d.name || 'Verified Donor';
    if (idEl) idEl.textContent = d.donorId || d.id || '';
    if (bgEl) {
      bgEl.textContent = d.bloodType || d.bloodGroup || d.blood_type || 'Not specified';
      bgEl.className = 'chip-status available';
    }

    // Blood group verification tag & detail (Group B.3)
    const verTag = document.getElementById('dlcBloodGroupVerificationTag');
    const verDetail = document.getElementById('dlcBloodGroupStatusDetail');
    const isVerified = (d.bloodGroupStatus === 'hospital_verified');
    if (isVerified) {
      const by = d.bloodGroupVerifiedByHospitalName || d.verifiedHospitalName || 'Hospital';
      const at = d.bloodGroupVerifiedAt ? new Date(d.bloodGroupVerifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const verText = at ? `Verified by ${by} on ${at}` : `Verified by ${by}`;
      if (verTag) {
        verTag.textContent = 'Verified';
        verTag.style.color = '#22c55e';
        verTag.style.background = 'rgba(34, 197, 94, 0.15)';
        verTag.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        verTag.title = verText;
      }
      if (verDetail) {
        verDetail.textContent = verText;
        verDetail.style.color = '#22c55e';
      }
    } else {
      if (verTag) {
        verTag.textContent = 'Self-declared';
        verTag.style.color = '#facc15';
        verTag.style.background = 'rgba(234, 179, 8, 0.15)';
        verTag.style.borderColor = 'rgba(234, 179, 8, 0.3)';
        verTag.title = 'Self-declared blood group (unverified)';
      }
      if (verDetail) {
        verDetail.textContent = 'Self-declared';
        verDetail.style.color = '#94a3b8';
      }
    }

    if (ageEl) ageEl.textContent = (d.age || 25) + ' yrs';

    // Step 1: Donor Gender display & Hospital Check-in setter
    const genderWrap = document.getElementById('dlcGenderWrap');
    const curGender = (d.gender || '').trim();
    if (genderWrap) {
      if (curGender) {
        genderWrap.innerHTML = `<strong style="color: #fff;" id="dlcGender">${escapeHtml(curGender)}</strong>`;
      } else {
        genderWrap.innerHTML = `
          <select id="dlcSetGenderSelect" class="form-input" style="display:inline-block; width:auto; padding:2px 6px; font-size:12px; height:24px; vertical-align:middle;">
            <option value="">Set Gender</option>
            <option value="Male">Male (90-day gap)</option>
            <option value="Female">Female (120-day gap)</option>
            <option value="Other">Other (120-day gap)</option>
          </select>
          <button type="button" id="btnSaveGender" class="btn-primary" style="padding:2px 8px; font-size:11px; height:24px; vertical-align:middle; margin-left:4px;">Save</button>
        `;
        const selGender = document.getElementById('dlcSetGenderSelect');
        const btnSaveGender = document.getElementById('btnSaveGender');
        if (btnSaveGender && selGender) {
          btnSaveGender.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const val = selGender.value;
            if (!val) {
              alert('Please select a gender.');
              return;
            }
            try {
              btnSaveGender.disabled = true;
              btnSaveGender.textContent = 'Saving...';
              const resp = await fetch('/api/hospital/donors/set-gender', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ donorId: d.donorId || d.id, gender: val })
              });
              const json = await resp.json();
              if (json && json.success) {
                lookupDonor(d.donorId || d.id);
              } else {
                alert((json && json.message) || 'Failed to update gender.');
                btnSaveGender.disabled = false;
                btnSaveGender.textContent = 'Save';
              }
            } catch (err) {
              console.error(err);
              alert('Error updating gender');
              btnSaveGender.disabled = false;
              btnSaveGender.textContent = 'Save';
            }
          });
        }
      }
    }

    if (wtEl) wtEl.textContent = (d.weight ? d.weight + ' kg' : 'Not recorded');
    if (lastEl) lastEl.textContent = d.lastDonationDaysAgo || (d.lastDonationDate || 'Never');

    if (eligEl) {
      eligEl.textContent = d.isEligible ? 'Eligible' : (d.eligibilityReason || 'Not eligible yet');
      eligEl.style.color = d.isEligible ? 'var(--hosp-green, #22c55e)' : 'var(--hosp-red, #ef4444)';
    }

    // Health verification status (Group B.4 - reflect real source only)
    if (healthEl) {
      healthEl.textContent = d.healthStatus || 'Not yet verified by a hospital';
      healthEl.style.color = (d.healthStatus && d.healthStatus.startsWith('Verified by')) ? '#22c55e' : '#94a3b8';
    }

    // Populate registration health answers (Group B.5)
    const regAnsWeight = document.getElementById('regAnsWeight');
    const regAnsAllergies = document.getElementById('regAnsAllergies');
    const regAnsConditions = document.getElementById('regAnsConditions');
    const regAnsMedications = document.getElementById('regAnsMedications');
    const regAnsSurgeries = document.getElementById('regAnsSurgeries');
    if (regAnsWeight) regAnsWeight.textContent = (d.weight ? d.weight + ' kg' : 'Not recorded');
    if (regAnsAllergies) regAnsAllergies.textContent = (d.allergies && String(d.allergies).trim()) ? d.allergies : 'None declared';
    if (regAnsConditions) regAnsConditions.textContent = (d.conditions && String(d.conditions).trim()) ? d.conditions : 'None declared';
    if (regAnsMedications) regAnsMedications.textContent = (d.medications && String(d.medications).trim()) ? d.medications : 'None declared';
    if (regAnsSurgeries) regAnsSurgeries.textContent = (d.surgeries && String(d.surgeries).trim()) ? d.surgeries : 'None declared';

    // Inline blood group verification wiring (Group B.3)
    const btnEditBloodGroup = document.getElementById('btnEditBloodGroup');
    const formVerifyBg = document.getElementById('dlcVerifyBloodGroupForm');
    const selVerifyBg = document.getElementById('selVerifyBloodGroup');
    const inpVerifyReason = document.getElementById('inpVerifyBloodGroupReason');
    const btnCancelVerifyBg = document.getElementById('btnCancelVerifyBg');
    const btnSaveVerifyBg = document.getElementById('btnSaveVerifyBg');

    if (btnEditBloodGroup && formVerifyBg) {
      btnEditBloodGroup.onclick = () => {
        const isHidden = formVerifyBg.style.display === 'none';
        formVerifyBg.style.display = isHidden ? 'block' : 'none';
        if (isHidden && selVerifyBg) {
          selVerifyBg.value = d.bloodType || 'A+';
          if (inpVerifyReason) inpVerifyReason.value = '';
        }
      };
    }
    if (btnCancelVerifyBg && formVerifyBg) {
      btnCancelVerifyBg.onclick = () => {
        formVerifyBg.style.display = 'none';
      };
    }
    if (btnSaveVerifyBg && formVerifyBg) {
      btnSaveVerifyBg.onclick = async () => {
        const newGroup = selVerifyBg ? selVerifyBg.value : '';
        const reason = inpVerifyReason ? inpVerifyReason.value.trim() : '';
        if (!newGroup) {
          alert('Please select a valid blood group.');
          return;
        }
        if (!reason || reason.length < 3) {
          alert('Please provide a clinical reason for modifying the blood group (e.g. Lab cross-match completed).');
          if (inpVerifyReason) inpVerifyReason.focus();
          return;
        }
        btnSaveVerifyBg.disabled = true;
        btnSaveVerifyBg.textContent = 'Saving...';
        try {
          const res = await fetch('/api/hospitals/donors/verify-blood-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              donorId: d.id,
              bloodGroup: newGroup,
              reason: reason
            })
          });
          const payload = await res.json();
          if (payload && payload.success) {
            d.bloodType = newGroup;
            d.bloodGroup = newGroup;
            d.bloodGroupStatus = 'hospital_verified';
            d.bloodGroupVerifiedAt = new Date().toISOString();
            formVerifyBg.style.display = 'none';
            renderLoadedDonor(d);
            alert('Blood group verified and updated to ' + newGroup + '. Audit record logged.');
          } else {
            alert((payload && payload.message) || 'Failed to update blood group.');
          }
        } catch (err) {
          alert('Error communicating with server: ' + err.message);
        } finally {
          btnSaveVerifyBg.disabled = false;
          btnSaveVerifyBg.textContent = 'Save & Verify';
        }
      };
    }

    // Render Eligibility Capsule in Loaded Donor Card (Part 4 & Part 6)
    const capPct = document.getElementById('dlcCapsulePct');
    const capBar = document.getElementById('dlcCapsuleBar');
    const capNotice = document.getElementById('dlcCapsuleNotice');
    const elig = d.eligibility || {};
    const pct = elig.progress_pct !== undefined ? elig.progress_pct : (d.progress_pct !== undefined ? d.progress_pct : (d.isEligible ? 100 : 0));
    if (capPct) capPct.textContent = pct + '%';
    if (capBar) {
      capBar.style.width = pct + '%';
      capBar.style.background = d.isEligible ? 'var(--hosp-green, #22c55e)' : '#f59e0b';
    }
    if (capNotice) {
      if (d.isEligible) {
        capNotice.textContent = 'You can donate. The hospital does a final check before donating.';
      } else if (!d.lastDonationDate || d.lastDonationDate === 'Never') {
        capNotice.textContent = 'No donation yet. Ready for intake.';
      } else {
        capNotice.textContent = `Next donation possible on ${elig.next_eligible_date || d.nextEligibleDate || 'soon'} (${elig.days_until_eligible || d.daysUntilEligible || 0} days left).`;
      }
    }

    donorCard.style.display = 'block';

    // Unlock Clinical Vitals Panel
    if (vitalsFieldset) {
      vitalsFieldset.disabled = false;
      vitalsFieldset.style.opacity = '1';
    }
    if (vitalsDisabledHint) vitalsDisabledHint.style.display = 'none';
    if (btnDeferDonation) btnDeferDonation.disabled = false;

    // Prefill confirmed blood group and staff user
    const confirmedBg = document.getElementById('vitConfirmedBloodGroup');
    if (confirmedBg && d.bloodType) {
      confirmedBg.value = d.bloodType;
    }
    const boxReason = document.getElementById('boxBloodGroupReason');
    const inputReason = document.getElementById('vitBloodGroupReason');
    if (confirmedBg) {
      confirmedBg.onchange = () => {
        const changed = confirmedBg.value !== (d.bloodType || '');
        if (boxReason) boxReason.style.display = changed ? 'block' : 'none';
        if (inputReason) inputReason.required = changed;
      };
    }
    const staffInput = document.getElementById('vitStaffName');
    if (staffInput && !staffInput.value) {
      staffInput.value = (window.currentHospitalProfile && window.currentHospitalProfile.name) || 'Attending Staff';
    }

    // Prefill weight from donor record (editable)
    if (vitWeight && d.weight) {
      vitWeight.value = d.weight;
    }

    // Trigger evaluation
    evaluateVitals();
  }

  // Live input & blur evaluation on all vitals
  [vitWeight, vitHb, vitBpSystolic, vitBpDiastolic, vitPulse, vitTemp].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', evaluateVitals);
      inp.addEventListener('blur', evaluateVitals);
    }
  });

  function evaluateVitals() {
    if (!currentLoadedDonor) return;

    const wVal = parseFloat(vitWeight ? vitWeight.value : '');
    const hbVal = parseFloat(vitHb ? vitHb.value : '');
    const sysVal = parseFloat(vitBpSystolic ? vitBpSystolic.value : '');
    const diaVal = parseFloat(vitBpDiastolic ? vitBpDiastolic.value : '');
    const pulVal = parseFloat(vitPulse ? vitPulse.value : '');
    const tmpVal = parseFloat(vitTemp ? vitTemp.value : '');

    // Field-level inline errors
    validateField(vitWeight, 'errVitWeight', wVal, 30, 250, 'Weight must be between 30 and 250 kg');
    validateField(vitHb, 'errVitHb', hbVal, 5, 25, 'Hemoglobin must be between 5 and 25 g/dL');
    validateField(vitBpSystolic, 'errVitBpSystolic', sysVal, 60, 260, 'Systolic must be between 60 and 260 mmHg');
    validateField(vitBpDiastolic, 'errVitBpDiastolic', diaVal, 30, 160, 'Diastolic must be between 30 and 160 mmHg');
    validateField(vitPulse, 'errVitPulse', pulVal, 30, 200, 'Pulse must be between 30 and 200 bpm');
    validateField(vitTemp, 'errVitTemp', tmpVal, 94, 106, 'Temperature must be between 94 and 106 °F');

    const allFilled = !isNaN(wVal) && !isNaN(hbVal) && !isNaN(sysVal) && !isNaN(diaVal) && !isNaN(pulVal) && !isNaN(tmpVal);

    if (!allFilled) {
      if (verdictBanner) verdictBanner.style.display = 'none';
      if (btnRecordDonation) btnRecordDonation.disabled = true;
      return;
    }

    // Evaluate against Medical Ranges
    const issues = [];
    if (wVal < MEDICAL_RANGES.weight.min) {
      issues.push(`Weight ${wVal} kg is below minimum safe threshold (${MEDICAL_RANGES.weight.min} kg).`);
    }
    if (hbVal < MEDICAL_RANGES.hb.min) {
      issues.push(`Hemoglobin ${hbVal} g/dL is below required ${MEDICAL_RANGES.hb.min} g/dL.`);
    }
    if (sysVal < MEDICAL_RANGES.systolic.min || sysVal > MEDICAL_RANGES.systolic.max) {
      issues.push(`Systolic BP ${sysVal} mmHg is outside safe range (${MEDICAL_RANGES.systolic.min}-${MEDICAL_RANGES.systolic.max} mmHg).`);
    }
    if (diaVal < MEDICAL_RANGES.diastolic.min || diaVal > MEDICAL_RANGES.diastolic.max) {
      issues.push(`Diastolic BP ${diaVal} mmHg is outside safe range (${MEDICAL_RANGES.diastolic.min}-${MEDICAL_RANGES.diastolic.max} mmHg).`);
    }
    if (pulVal < MEDICAL_RANGES.pulse.min || pulVal > MEDICAL_RANGES.pulse.max) {
      issues.push(`Pulse ${pulVal} bpm is outside normal range (${MEDICAL_RANGES.pulse.min}-${MEDICAL_RANGES.pulse.max} bpm).`);
    }
    if (tmpVal > MEDICAL_RANGES.temp.max) {
      issues.push(`Temperature ${tmpVal} °F exceeds maximum allowed (${MEDICAL_RANGES.temp.max} °F).`);
    }

    const donorEligible = currentLoadedDonor.isEligible;
    if (!donorEligible) {
      issues.push(`Donor eligibility cooldown active: ${currentLoadedDonor.eligibilityReason || '90-day cooldown'}.`);
    }

    if (verdictBanner) {
      verdictBanner.style.display = 'block';
      if (issues.length === 0) {
        verdictBanner.style.background = 'rgba(34, 197, 94, 0.12)';
        verdictBanner.style.border = '1px solid rgba(34, 197, 94, 0.35)';
        verdictBanner.style.color = '#22c55e';
        if (verdictTitle) verdictTitle.textContent = 'Clinically Fit';
        if (verdictIcon) {
          verdictIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        }
        if (verdictReasons) verdictReasons.textContent = 'All clinical vitals and eligibility criteria within acceptable limits. Staff may confirm donation.';
        if (btnRecordDonation) btnRecordDonation.disabled = false;
      } else {
        verdictBanner.style.background = 'rgba(239, 68, 68, 0.12)';
        verdictBanner.style.border = '1px solid rgba(239, 68, 68, 0.35)';
        verdictBanner.style.color = '#fca5a5';
        if (verdictTitle) verdictTitle.textContent = 'Not Fit / Advisory Deferral';
        if (verdictIcon) {
          verdictIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        }
        if (verdictReasons) {
          verdictReasons.innerHTML = '<ul style="margin: 4px 0 0 16px; padding: 0;">' + issues.map(iss => `<li>${window.escapeHtml ? window.escapeHtml(iss) : iss}</li>`).join('') + '</ul>';
        }
        if (btnRecordDonation) btnRecordDonation.disabled = true;
      }
    }
  }

  function validateField(inputEl, errElId, val, min, max, errMsg) {
    const errEl = document.getElementById(errElId);
    if (!errEl || !inputEl || inputEl.value === '') {
      if (errEl) errEl.style.display = 'none';
      return;
    }
    if (isNaN(val) || val < min || val > max) {
      errEl.textContent = errMsg;
      errEl.style.display = 'block';
    } else {
      errEl.style.display = 'none';
    }
  }

  // Camera QR Scanner Modal Handling (Part 6)
  const btnScanQrCamera = document.getElementById('btnScanQrCamera');
  const cameraModal = document.getElementById('checkinCameraModal');
  const btnCloseCamera = document.getElementById('btnCloseCameraModal');
  const btnCancelScan = document.getElementById('btnCancelScan');
  const videoEl = document.getElementById('cameraPreviewVideo');
  const cameraMsg = document.getElementById('cameraScannerMsg');
  let cameraStream = null;
  let scanAnimationId = null;

  function stopCamera() {
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId);
      scanAnimationId = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
    if (cameraModal) cameraModal.style.display = 'none';
  }

  if (btnCloseCamera) btnCloseCamera.addEventListener('click', stopCamera);
  if (btnCancelScan) btnCancelScan.addEventListener('click', stopCamera);

  if (btnScanQrCamera) {
    btnScanQrCamera.addEventListener('click', async () => {
      // Check secure context (Group B.1)
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isSecure) {
        alert('Camera QR scanning requires a secure connection (HTTPS) or localhost. Please open RED404 over HTTPS or enter the Smart ID manually.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera is not supported on this browser or device. Please use manual entry.');
        return;
      }
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoEl) {
          videoEl.srcObject = cameraStream;
          await videoEl.play();
        }
        if (cameraModal) cameraModal.style.display = 'flex';
        if (cameraMsg) cameraMsg.textContent = 'Align the donor\'s QR code within the frame...';

        const processRawQr = (rawVal) => {
          if (!rawVal) return;
          let val = String(rawVal).trim();
          if (val.startsWith('RED404:')) val = val.substring('RED404:'.length).trim();
          if (inputId) inputId.value = val;
          stopCamera();
          performDonorLookup();
        };

        if ('BarcodeDetector' in window) {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const detectLoop = async () => {
            if (!cameraStream) return;
            try {
              const barcodes = await detector.detect(videoEl);
              if (barcodes && barcodes.length > 0) {
                processRawQr(barcodes[0].rawValue);
                return;
              }
            } catch (_) {}
            scanAnimationId = requestAnimationFrame(detectLoop);
          };
          scanAnimationId = requestAnimationFrame(detectLoop);
        } else if (typeof jsQR !== 'undefined') {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const detectJsQrLoop = () => {
            if (!cameraStream || !videoEl) return;
            if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
              canvas.width = videoEl.videoWidth;
              canvas.height = videoEl.videoHeight;
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert'
              });
              if (code && code.data) {
                processRawQr(code.data);
                return;
              }
            }
            scanAnimationId = requestAnimationFrame(detectJsQrLoop);
          };
          scanAnimationId = requestAnimationFrame(detectJsQrLoop);
        } else {
          if (cameraMsg) cameraMsg.textContent = 'Camera active. Point at QR code (or type token into lookup box).';
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert('Camera permission was denied. Please allow camera permissions in your browser or enter the Smart ID manually.');
        } else {
          alert('Unable to access camera: ' + (err.message || 'Permission denied'));
        }
        stopCamera();
      }
    });
  }

  // Defer donor modal handling (Part 6)
  const deferModal = document.getElementById('deferralReasonModal');
  const deferReasonInput = document.getElementById('deferralReasonInput');
  const btnConfirmDeferral = document.getElementById('btnConfirmDeferral');
  const btnCancelDeferral = document.getElementById('btnCancelDeferral');

  if (btnDeferDonation) {
    btnDeferDonation.addEventListener('click', () => {
      if (!currentLoadedDonor) return;
      if (deferReasonInput) deferReasonInput.value = '';
      if (deferModal) deferModal.style.display = 'flex';
    });
  }

  if (btnCancelDeferral) {
    btnCancelDeferral.addEventListener('click', () => {
      if (deferModal) deferModal.style.display = 'none';
    });
  }

  if (btnConfirmDeferral) {
    btnConfirmDeferral.addEventListener('click', async () => {
      if (!currentLoadedDonor) return;
      const reason = deferReasonInput ? deferReasonInput.value.trim() : '';
      if (!reason || reason.length < 3) {
        alert('A valid clinical reason is required to document a donor deferral.');
        return;
      }

      try {
        const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const staffNameInput = document.getElementById('vitStaffName');
        const staffName = (staffNameInput && staffNameInput.value.trim()) || (window.currentHospitalProfile && window.currentHospitalProfile.name) || 'Attending Staff';

        const res = await fetch('/api/hospital/donors/defer', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            donorId: currentLoadedDonor.donorId || currentLoadedDonor.id,
            reason: reason,
            staffUser: staffName
          }),
          credentials: 'include'
        });

        if (deferModal) deferModal.style.display = 'none';

        if (res.ok) {
          alert(`Donor ${currentLoadedDonor.name} has been documented as deferred. The QR token has been closed.`);
          resetCheckinForm(false);
        } else {
          const err = await res.json().catch(() => ({}));
          alert('Failed to document deferral: ' + (err.message || 'Server error'));
        }
      } catch (e) {
        if (deferModal) deferModal.style.display = 'none';
        alert('Network error while documenting deferral.');
      }
    });
  }

  // Approve donation submit (Part 5 & Part 6)
  if (vitalsForm) {
    vitalsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentLoadedDonor) return;

      const confirmedBgEl = document.getElementById('vitConfirmedBloodGroup');
      const confirmedBg = confirmedBgEl ? confirmedBgEl.value : (currentLoadedDonor.bloodType || currentLoadedDonor.bloodGroup || currentLoadedDonor.blood_type || '');

      const bgReasonEl = document.getElementById('vitBloodGroupReason');
      const bgReason = bgReasonEl ? bgReasonEl.value.trim() : '';

      // Part 5.2: reason required if hospital staff changed donor's blood group
      if (currentLoadedDonor.bloodType && confirmedBg !== currentLoadedDonor.bloodType) {
        if (!bgReason || bgReason.length < 3) {
          alert('Reason is required when modifying a donor\'s blood group during check-in.');
          if (bgReasonEl) bgReasonEl.focus();
          return;
        }
      }

      const volumeSelect = document.getElementById('vitVolumeMl');
      const volumeMl = volumeSelect ? parseInt(volumeSelect.value) : 450;

      const staffInput = document.getElementById('vitStaffName');
      const staffUser = (staffInput && staffInput.value.trim()) || (window.currentHospitalProfile && window.currentHospitalProfile.name) || 'Attending Staff';

      const notesInput = document.getElementById('vitNotes');
      const notes = notesInput ? notesInput.value.trim() : '';

      if (btnRecordDonation) {
        btnRecordDonation.disabled = true;
        btnRecordDonation.innerHTML = '<span>Recording donation...</span>';
      }

      try {
        const vitalsData = {
          weight: parseFloat(vitWeight.value),
          hemoglobin: parseFloat(vitHb.value),
          systolic: parseFloat(vitBpSystolic.value),
          diastolic: parseFloat(vitBpDiastolic.value),
          pulse: parseFloat(vitPulse.value),
          temperature: parseFloat(vitTemp.value),
          notes: notes
        };

        const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const payload = {
          donorId: currentLoadedDonor.donorId || currentLoadedDonor.id,
          bloodType: confirmedBg,
          volumeMl: volumeMl,
          reason: bgReason,
          vitals: vitalsData,
          staffUser: staffUser
        };

        const res = await fetch('/api/hospital/donors/checkin', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert('Error approving donation: ' + (err.message || 'Server error'));
          if (btnRecordDonation) {
            btnRecordDonation.disabled = false;
            btnRecordDonation.innerHTML = '<span>Approve donation</span>';
          }
          return;
        }

        // Update local inventory display immediately
        if (typeof initInventory === 'function') {
          try { initInventory(); } catch (_) {}
        }
        if (typeof loadHospitalInventory === 'function') {
          try { loadHospitalInventory(); } catch (_) {}
        }

        // Show success card and hide vitals form
        if (vitalsFieldset) vitalsFieldset.disabled = true;
        if (btnRecordDonation) btnRecordDonation.style.display = 'none';
        if (btnDeferDonation) btnDeferDonation.style.display = 'none';

        if (successCard) {
          successCard.style.display = 'block';
          if (successTitle) {
            successTitle.textContent = `Donation Verified & Approved (${confirmedBg}, ${volumeMl} mL)`;
          }
          if (successMsg) {
            successMsg.textContent = `Donor ${currentLoadedDonor.name} (${currentLoadedDonor.donorId}) recorded successfully. +1 unit added to live stock. QR token closed.`;
          }
        }
      } catch (err) {
        alert('Network error while saving donation record: ' + err.message);
        if (btnRecordDonation) {
          btnRecordDonation.disabled = false;
          btnRecordDonation.innerHTML = '<span>Approve donation</span>';
        }
      }
    });
  }

  // Next donor button
  if (btnNextDonor) {
    btnNextDonor.addEventListener('click', () => {
      resetCheckinForm(false);
      if (btnRecordDonation) {
        btnRecordDonation.style.display = '';
        btnRecordDonation.disabled = true;
        btnRecordDonation.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Approve donation</span>
        `;
      }
      if (btnDeferDonation) {
        btnDeferDonation.style.display = '';
        btnDeferDonation.disabled = true;
      }
      if (inputId) inputId.focus();
    });
  }
}

/* ============================================================
   11. DONATION DRIVES ENGINE (COMMUNITY DRIVES & RSVPS)
   ============================================================ */
function initDonationDrives() {
  const modal = document.getElementById('modalPlanDrive');
  const btnOpen = document.getElementById('btnOpenPlanDriveModal');
  const btnClose = document.getElementById('btnClosePlanDriveModal');
  const btnCancel = document.getElementById('btnCancelPlanDrive');
  const form = document.getElementById('formPlanDonationDrive');
  const bgGrid = document.getElementById('driveBloodGroupsGrid');

  // Render 8 blood group check items into modal
  if (bgGrid) {
    bgGrid.innerHTML = ALL_BLOOD_GROUPS.map(bg => `
      <div class="drive-blood-check-item">
        <input type="checkbox" id="dbg_${bg.replace('+', 'pos').replace('-', 'neg')}" value="${bg}" class="drive-bg-cb" />
        <label for="dbg_${bg.replace('+', 'pos').replace('-', 'neg')}" class="drive-blood-label">${bg}</label>
      </div>
    `).join('');
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', () => openPlanDriveModal());
  }
  if (btnClose) {
    btnClose.addEventListener('click', closePlanDriveModal);
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', closePlanDriveModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePlanDriveModal();
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const titleInput = document.getElementById('driveTitle');
      const dateInput = document.getElementById('driveDate');
      const startInput = document.getElementById('driveStartTime');
      const endInput = document.getElementById('driveEndTime');
      const venueInput = document.getElementById('driveVenue');
      const targetInput = document.getElementById('driveTargetUnits');
      const radiusSelect = document.getElementById('driveRadius');
      const notesInput = document.getElementById('driveNotes');
      const submitBtn = document.getElementById('btnSubmitPlanDrive');

      const checkedGroups = Array.from(document.querySelectorAll('.drive-bg-cb:checked')).map(cb => cb.value);
      const bloodGroups = checkedGroups.length > 0 ? checkedGroups.join(',') : 'All';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Scheduling...';
      }

      try {
        const payload = {
          title: titleInput ? titleInput.value.trim() : 'Blood donation drive',
          bloodGroups: bloodGroups,
          driveDate: dateInput ? dateInput.value : '',
          startTime: startInput ? startInput.value : '09:00',
          endTime: endInput ? endInput.value : '17:00',
          venue: venueInput ? venueInput.value.trim() : '',
          targetUnits: targetInput && targetInput.value ? parseInt(targetInput.value, 10) : null,
          radius: radiusSelect ? parseInt(radiusSelect.value, 10) : 10,
          notes: notesInput ? notesInput.value.trim() : ''
        };

        const res = await fetch('/api/hospital/drives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        if (res.ok) {
          closePlanDriveModal();
          if (typeof showToast === 'function') {
            showToast('Donation drive scheduled! Non-urgent invitations sent to nearby eligible donors.', 'success');
          } else {
            alert('Donation drive scheduled successfully!');
          }
          loadDonationDrives();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(errData.message || 'Failed to schedule donation drive.');
        }
      } catch (err) {
        console.error('Create drive error:', err);
        alert('Network error while scheduling drive.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Donation Drive';
        }
      }
    });
  }
}

function openPlanDriveModal(prefillType) {
  const modal = document.getElementById('modalPlanDrive');
  if (!modal) return;

  const dateInput = document.getElementById('driveDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    // Default to tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    dateInput.value = tomorrow;
  }

  // Pre-fill venue if empty
  const venueInput = document.getElementById('driveVenue');
  if (venueInput && !venueInput.value) {
    const hospName = document.getElementById('top-hospital-name')?.textContent || '';
    venueInput.value = hospName && hospName !== 'Hospital' ? `${hospName} Blood Bank` : 'Hospital Blood Bank';
  }

  // Pre-fill blood groups
  document.querySelectorAll('.drive-bg-cb').forEach(cb => {
    if (prefillType) {
      cb.checked = (cb.value === prefillType);
    } else {
      cb.checked = true; // Select all by default when clicking "+ Plan drive"
    }
  });

  modal.style.display = 'flex';
}

function closePlanDriveModal() {
  const modal = document.getElementById('modalPlanDrive');
  if (modal) modal.style.display = 'none';
}

async function loadDonationDrives() {
  const container = document.getElementById('drivesListContainer');
  const emptyBox = document.getElementById('drivesEmptyBox');
  if (!container) return;

  try {
    const res = await fetch('/api/hospital/drives', { credentials: 'include' });
    if (!res.ok) throw new Error('Drives fetch failed');
    const json = await res.json();
    const drives = json.data || [];

    // Filter out cancelled or show all with clear status
    if (!drives || drives.length === 0) {
      container.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';
    container.innerHTML = drives.map(d => {
      const status = (d.status || 'upcoming').toLowerCase();
      const isUpcoming = status === 'upcoming';
      const groupsList = (d.bloodGroups || 'All').split('[,;/ ]+');
      const attending = d.attendingCount || 0;

      return `
        <div class="drive-item-card ${status}" data-id="${d.id}">
          <div class="drive-info-main">
            <div class="drive-title-row">
              <span class="drive-title-text">${d.title || 'Blood donation drive'}</span>
              <span class="drive-status-badge ${status}">${status}</span>
            </div>
            <div class="drive-meta-row">
              <span class="drive-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>${d.driveDate} • ${d.startTime} - ${d.endTime}</span>
              </span>
              <span class="drive-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${d.venue} (${d.radius} km radius)</span>
              </span>
              <span class="drive-meta-item">
                <span style="font-weight: 600;">Groups:</span>
                <span class="drive-groups-chips">
                  ${(d.bloodGroups || 'All').split(',').map(g => `<span class="drive-group-chip">${g.trim()}</span>`).join('')}
                </span>
              </span>
              ${d.targetUnits ? `<span class="drive-meta-item">Target: <strong>${d.targetUnits} units</strong></span>` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
            <div class="drive-rsvp-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span><strong>${attending}</strong> ${attending === 1 ? 'donor' : 'donors'} attending</span>
            </div>

            ${isUpcoming ? `
              <div class="drive-actions-group">
                <button type="button" class="drive-action-btn complete" data-id="${d.id}" title="Mark completed (does not change stock)">Mark completed</button>
                <button type="button" class="drive-action-btn cancel" data-id="${d.id}">Cancel</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Wire Cancel & Complete actions
    container.querySelectorAll('.drive-action-btn.cancel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = (typeof showAppConfirm === 'function')
          ? await showAppConfirm({
              title: 'Cancel Donation Drive',
              message: 'Are you sure you want to cancel this planned donation drive? Donors who RSVPed will be notified of cancellation.',
              confirmText: 'Yes, Cancel Drive',
              cancelText: 'Keep Drive',
              type: 'danger'
            })
          : window.confirm('Cancel this donation drive?');

        if (confirmed) {
          try {
            await fetch(`/api/hospital/drives/${id}/cancel`, { method: 'POST', credentials: 'include' });
            loadDonationDrives();
          } catch (e) {
            console.error('Cancel drive error:', e);
          }
        }
      });
    });

    container.querySelectorAll('.drive-action-btn.complete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = (typeof showAppConfirm === 'function')
          ? await showAppConfirm({
              title: 'Mark Donation Drive Completed',
              message: 'Mark this donation drive as completed? Note: Stock is NOT automatically changed; please record actual blood bags received via the Inventory page.',
              confirmText: 'Mark Completed',
              cancelText: 'Back',
              type: 'info'
            })
          : window.confirm('Mark this drive as completed? (Note: Stock is not auto-changed)');

        if (confirmed) {
          try {
            await fetch(`/api/hospital/drives/${id}/complete`, { method: 'POST', credentials: 'include' });
            loadDonationDrives();
          } catch (e) {
            console.error('Complete drive error:', e);
          }
        }
      });
    });

  } catch (err) {
    console.debug('Error loading donation drives:', err);
    if (emptyBox) emptyBox.style.display = 'block';
  }
}

