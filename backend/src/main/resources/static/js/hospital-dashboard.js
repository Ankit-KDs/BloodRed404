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
    const headers = { 'Accept': 'application/json', 'X-Red404-Role': 'HOSPITAL' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/hospital/profile', { headers, credentials: 'include' });
    if (res.status === 401) {
      window.location.replace('hospital-login.html');
      return;
    }
    if (res.status === 403) {
      const errJson = await res.json().catch(() => ({}));
      if (errJson.code === 'hospital_not_verified' || (errJson.data && errJson.data.code === 'hospital_not_verified')) {
        window.location.replace('hospital-status.html');
        return;
      }
    }
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

  if (profile) {
    const rawV = (profile.verificationStatus || profile.verification_status || '').toLowerCase();
    if (rawV && rawV !== 'verified' && rawV !== 'approved') {
      window.location.replace('hospital-status.html');
      return;
    }
  }

  window.currentHospitalProfile = profile;
  window.hospitalProfileLoaded = true;
  try {
    initFirstLoginChecklist(profile);
  } catch (_) {}
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
    role: 'hospital',
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
        await fetch('/api/hospital/logout', { method: 'POST', credentials: 'include', headers: { 'X-Red404-Role': 'HOSPITAL' } });
      } catch (_) {}
      try {
        localStorage.removeItem('hospital_session');
        localStorage.removeItem('red404_hospital_session');
        localStorage.removeItem('red404_hospitalToken');
        sessionStorage.removeItem('hospital_session');
        sessionStorage.removeItem('red404_hospital_session');
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
const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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
  'AB-': { critical: 2, low: 4 },
  'AB+': { critical: 2, low: 4 }
};

// ============================================================
// SHARED HOSPITAL STOCK STORE (Part 1 - Single Source of Truth)
// ============================================================
window.HospitalStockStore = {
  data: null, // { inventory: {...}, updatedAt, updatedAgo }
  isFetching: false,
  listeners: new Set(),
  pollTimer: null,
  eventSource: null,

  subscribe(fn) {
    this.listeners.add(fn);
    if (this.data) {
      try { fn(this.data); } catch (e) { console.warn('Stock listener err:', e); }
    }
    return () => this.listeners.delete(fn);
  },

  notify() {
    if (!this.data) return;
    for (const fn of this.listeners) {
      try { fn(this.data); } catch (e) { console.warn('Stock notify err:', e); }
    }
  },

  updateTimestamps() {
    if (!this.data) return;
    const txt = `Updated ${this.data.updatedAgo || 'just now'}`;
    const dashEl = document.getElementById('dashStockUpdatedAgo');
    if (dashEl) dashEl.textContent = txt;
    const invEl = document.getElementById('invStockUpdatedAgo');
    if (invEl) invEl.textContent = txt;
  },

  async fetch(force = false) {
    if (this.isFetching && !force) return this.data;
    this.isFetching = true;
    try {
      const res = await fetch('/api/hospital/inventory', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || {};
        const inv = payload.inventory || payload;
        this.data = {
          inventory: inv,
          updatedAt: payload.updatedAt || Date.now(),
          updatedAgo: payload.updatedAgo || 'Just now',
          raw: payload
        };
        this.updateTimestamps();
        this.notify();
      }
    } catch (e) {
      console.warn('StockStore fetch error:', e);
    } finally {
      this.isFetching = false;
    }
    return this.data;
  },

  async adjust(bloodType, delta, reason) {
    try {
      const res = await fetch('/api/hospital/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store' },
        body: JSON.stringify({
          bloodType,
          delta,
          change: delta,
          reason: reason || `Manual adjustment (${delta >= 0 ? '+' + delta : delta})`
        }),
        credentials: 'include'
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        const errMessage = json.message || 'Failed to update stock';
        showToast(errMessage, 'error', 4000);
        // Roll back to true server state
        await this.fetch(true);
        return false;
      }
      const payload = json.data || {};
      const inv = payload.inventory || payload;
      this.data = {
        inventory: inv,
        updatedAt: payload.updatedAt || Date.now(),
        updatedAgo: payload.updatedAgo || 'Just now',
        raw: payload
      };
      this.updateTimestamps();
      this.notify();
      const sign = delta > 0 ? `+${delta}` : `${delta}`;
      showToast(`${bloodType} inventory updated (${sign} unit).`, 'success', 2500);
      return true;
    } catch (err) {
      showToast('Network error updating inventory. Rolled back.', 'error', 4000);
      await this.fetch(true);
      return false;
    }
  },

  init() {
    this.fetch();

    // 1. Refetch on view activation (hash change)
    window.addEventListener('hashchange', () => this.fetch(true));

    // 2. Refetch on tab focus
    window.addEventListener('focus', () => this.fetch(true));

    // 3. Realtime SSE push
    try {
      if (window.EventSource && !this.eventSource) {
        this.eventSource = new EventSource('/api/system/national-blood-stock/stream');
        this.eventSource.addEventListener('stock-update', () => this.fetch(true));
      }
    } catch (e) {
      console.debug('SSE stock stream notice:', e);
    }

    // 4. Fallback polling every 15 s while dashboard or inventory is active
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        if (!document.hidden) {
          this.fetch();
        }
      }, 15000);
    }
  }
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

  document.getElementById('btnRetryActiveReq')?.addEventListener('click', () => loadDashboardData());
  document.getElementById('btnRetryStock')?.addEventListener('click', () => loadDashboardData());

  // Part 1: Real-time short-polling refresh every 3-5 s for #dashboard and #records / My Requests view
  if (!window.activeRequestSyncTimer) {
    window.activeRequestSyncTimer = setInterval(() => {
      if (!document.hidden) {
        const activeTab = document.querySelector('.portal-tab-content.active');
        const activeTabId = activeTab ? activeTab.id : 'tab-dashboard';
        if (activeTabId === 'tab-dashboard') {
          loadDashboardData(true);
        } else if (activeTabId === 'tab-records') {
          loadRecordsTable(true);
        }

        const drawer = document.getElementById('requestDetailDrawer');
        if (drawer && drawer.classList.contains('open') && window.selectedRequest) {
          loadRequestDonorsList(window.selectedRequest.id);
        }
      }
    }, 3500);
  }
}

async function loadDashboardData(isSilent = false) {
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

  // Set loading states ONLY if not silent short-polling
  if (!isSilent) {
    if (activeReqLoading) activeReqLoading.style.display = 'block';
    if (activeReqError) activeReqError.style.display = 'none';
    if (stockLoading) stockLoading.style.display = 'block';
    if (stockError) stockError.style.display = 'none';
    if (activityLoading) activityLoading.style.display = 'block';
  }

  let inventoryMap = null;
  let activeRequests = [];
  let historyRequests = [];

  // Fetch Inventory from Shared HospitalStockStore (Part 1 - Single Store)
  try {
    const stockObj = await window.HospitalStockStore.fetch();
    inventoryMap = (stockObj && stockObj.inventory) || {};
  } catch (err) {
    console.debug('Inventory fetch error:', err);
    if (stockLoading) stockLoading.style.display = 'none';
    if (stockError) stockError.style.display = 'block';
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
  window.latestActiveRequestsCount = activeRequests.length;
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

  // Find Donor tab badge removed as per Round 4 specification

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
            <span class="stock-status-pill status-ok" style="font-size:11px;font-weight:600;color:#34d399;margin-left:4px;">OK</span>
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

    const notified = r.notifiedCount ?? r.donorsNotified ?? 0;
    const accepted = r.acceptedCount ?? r.donorsAccepted ?? 0;
    const declined = r.declinedCount ?? r.donorsDeclined ?? 0;

    // 5-Stage timeline determination
    const isArrived = status === 'ARRIVED';
    const isOnTheWay = isArrived || status === 'ON_THE_WAY' || status === 'IN_TRANSIT';
    const isAccepted = isOnTheWay || status === 'ACCEPTED';
    const isNotified = isAccepted || status === 'NOTIFIED' || status === 'ACTIVE' || status === 'OPEN';

    // Extract responding/targeted donors for this request
    const reqDonors = (Array.isArray(r.respondingDonors) && r.respondingDonors.length > 0)
      ? r.respondingDonors
      : ((Array.isArray(r.donors) && r.donors.length > 0) ? r.donors : []);

    const donorsToRender = reqDonors.length > 0
      ? reqDonors
      : (r.donorName || r.donorId ? [{
          donorId: r.donorId || 'DNR-001',
          donorName: r.donorName || 'Targeted Donor',
          bloodType: r.donorBloodType || bloodType,
          status: r.status || (accepted > 0 ? 'ACCEPTED' : (declined > 0 ? 'DECLINED' : 'NOTIFIED')),
          distanceKm: r.donorDistance,
          phone: r.donorPhone || r.phone,
          email: r.donorEmail || r.email
        }] : []);

    let donorDetailsHtml = '';
    if (donorsToRender.length > 0) {
      donorDetailsHtml = `
        <div class="active-req-donors-box" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; margin: 10px 0 12px 0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-users-viewfinder" style="color: #38bdf8; margin-right: 5px;"></i> Responding Donors</span>
            <span style="font-size: 11px; color: #38bdf8; font-family: monospace;">${donorsToRender.length} ${donorsToRender.length === 1 ? 'Donor' : 'Donors'}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${donorsToRender.map(d => {
              const dStatus = (d.status || 'PENDING').toUpperCase();
              let badgeBg = 'rgba(56,189,248,0.15)';
              let badgeColor = '#38bdf8';
              let badgeBorder = 'rgba(56,189,248,0.3)';
              let statusLabel = 'Pending';

              if (dStatus === 'ACCEPTED' || dStatus === 'DONATED') {
                badgeBg = 'rgba(34,197,94,0.15)';
                badgeColor = '#22c55e';
                badgeBorder = 'rgba(34,197,94,0.3)';
                statusLabel = 'Accepted';
              } else if (dStatus === 'DECLINED') {
                badgeBg = 'rgba(239,68,68,0.15)';
                badgeColor = '#f87171';
                badgeBorder = 'rgba(239,68,68,0.3)';
                statusLabel = 'Declined';
              } else if (dStatus === 'ARRIVED') {
                badgeBg = 'rgba(168,85,247,0.15)';
                badgeColor = '#c084fc';
                badgeBorder = 'rgba(168,85,247,0.3)';
                statusLabel = 'Arrived';
              } else if (dStatus === 'NOTIFIED') {
                statusLabel = 'Notified';
              }

              const distInfo = (d.distanceKm != null && d.distanceKm !== '') ? `${d.distanceKm} km away` : '';
              const etaInfo = d.etaMinutes ? ` (${d.etaMinutes} min)` : '';
              const distanceDisplay = distInfo ? `<span style="color: #94a3b8; font-size: 11px; margin-left: 6px;">&bull; ${distInfo}${etaInfo}</span>` : '';

              const isAcceptedDonor = dStatus === 'ACCEPTED' || dStatus === 'ARRIVED' || dStatus === 'DONATED';
              let contactSection = '';
              if (isAcceptedDonor && (d.phone || d.email)) {
                contactSection = `
                  <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap;">
                    ${d.phone ? `
                      <a href="tel:${escapeHtml(d.phone)}" class="btn-call-donor" style="background: #059669; color: #fff; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-phone"></i>
                        <span>Call ${escapeHtml(d.phone)}</span>
                      </a>
                    ` : ''}
                    ${d.email ? `
                      <a href="mailto:${escapeHtml(d.email)}" style="background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-envelope"></i>
                        <span>${escapeHtml(d.email)}</span>
                      </a>
                    ` : ''}
                  </div>
                `;
              } else if (dStatus === 'DECLINED') {
                contactSection = `
                  <div style="font-size: 11px; color: #f87171; margin-top: 4px;">
                    <i class="fa-solid fa-circle-xmark" style="margin-right: 4px;"></i> Donor declined this request.
                  </div>
                `;
              } else {
                contactSection = `
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                    <i class="fa-solid fa-shield-halved" style="margin-right: 4px;"></i> Contact details masked until donor accepts.
                  </div>
                `;
              }

              return `
                <div class="responding-donor-item" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); padding: 1px 6px; border-radius: 4px;">
                        ${escapeHtml(d.donorId || 'DNR')}
                      </span>
                      <strong style="color: #fff; font-size: 12.5px;">${escapeHtml(d.donorName || 'Donor')}</strong>
                      <span style="background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">
                        ${escapeHtml(d.bloodType || bloodType)}
                      </span>
                      ${distanceDisplay}
                    </div>
                    <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">
                      ${statusLabel}
                    </span>
                  </div>
                  ${contactSection}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

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

        <div class="active-req-metrics-bar" style="display: flex; gap: 8px; margin: 8px 0 12px 0; font-size: 12px; flex-wrap: wrap;">
          <span style="color: #38bdf8; background: rgba(56,189,248,0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.2);">
            📢 <strong>${notified}</strong> Active Notified
          </span>
          ${accepted > 0 ? `
            <span style="color: #22c55e; background: rgba(34,197,94,0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(34,197,94,0.2);">
              ✅ <strong>${accepted}</strong> Accepted
            </span>
          ` : ''}
          ${declined > 0 ? `
            <span style="color: #f87171; background: rgba(248,113,113,0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(248,113,113,0.2);">
              ❌ <strong>${declined}</strong> Declined
            </span>
          ` : ''}
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

        ${donorDetailsHtml}

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

  // Unified Map / Leaflet State
  let leafletMap = null;
  let currentTileLayer = null;
  let activeLayerKey = localStorage.getItem('red404_hosp_map_layer') || 'dark';
  if (activeLayerKey === 'google-dark') activeLayerKey = 'dark';
  if (activeLayerKey === 'google-roads') activeLayerKey = 'map';
  let hospitalMarker = null;
  let donorMarkers = {};
  let zoneCircles = [];
  let hospitalCoords = null;

  function setRadarMapLayer(layerKey) {
    if (!leafletMap) return;
    if (layerKey === 'google-dark') layerKey = 'dark';
    if (layerKey === 'google-roads') layerKey = 'map';
    activeLayerKey = layerKey;
    try {
      localStorage.setItem('red404_hosp_map_layer', layerKey);
    } catch (_) {}

    const mapContainer = document.getElementById('hospitalRadarMap');
    const result = window.Red404Map
      ? window.Red404Map.createTileLayer(layerKey, null, mapContainer)
      : null;

    if (result && result.layer) {
      if (currentTileLayer) {
        try { leafletMap.removeLayer(currentTileLayer); } catch (_) {}
      }
      currentTileLayer = result.layer;
      currentTileLayer.addTo(leafletMap);
      if (mapContainer) {
        if (result.isDark) {
          mapContainer.classList.add('dark-map');
        } else {
          mapContainer.classList.remove('dark-map');
        }
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

    if (window.Red404Map && typeof window.Red404Map.drawDistanceRings === 'function') {
      zoneCircles = window.Red404Map.drawDistanceRings(leafletMap, [lat, lng], selectedRadiusKm);
    } else {
      // 5 km zone (blue)
      const z1 = L.circle([lat, lng], {
        radius: 5000,
        color: '#3b82f6',
        weight: selectedRadiusKm === 5 ? 2.5 : 1.2,
        dashArray: selectedRadiusKm === 5 ? null : '4, 6',
        fillColor: '#3b82f6',
        fillOpacity: selectedRadiusKm === 5 ? 0.09 : 0.02
      }).addTo(leafletMap);

      // 10 km zone
      const z2 = L.circle([lat, lng], {
        radius: 10000,
        color: '#3b82f6',
        weight: selectedRadiusKm === 10 ? 2.5 : 1.2,
        dashArray: selectedRadiusKm === 10 ? null : '4, 6',
        fillColor: '#3b82f6',
        fillOpacity: selectedRadiusKm === 10 ? 0.09 : 0.02
      }).addTo(leafletMap);

      // 20 km zone
      const z3 = L.circle([lat, lng], {
        radius: 20000,
        color: '#3b82f6',
        weight: selectedRadiusKm === 20 ? 2.5 : 1.2,
        dashArray: selectedRadiusKm === 20 ? null : '4, 6',
        fillColor: '#3b82f6',
        fillOpacity: selectedRadiusKm === 20 ? 0.09 : 0.02
      }).addTo(leafletMap);

      zoneCircles = [z1, z2, z3];
    }

    // Emphasize selected radius and fit map so the selected circle is fully visible
    const circleToFit = zoneCircles.find(c => c.getRadius && Math.round(c.getRadius()) === Math.round(selectedRadiusKm * 1000));
    if (circleToFit) {
      try {
        leafletMap.fitBounds(circleToFit.getBounds(), { padding: [35, 35] });
      } catch (_) {}
    }
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

    const savedLayer = localStorage.getItem('red404_hosp_map_layer') || 'dark';
    setRadarMapLayer(savedLayer);

    const layerBar = document.getElementById('radarLayerBar');
    if (layerBar && window.Red404Map) {
      window.Red404Map.setupLayerBar(layerBar, leafletMap, (k) => setRadarMapLayer(k));
    }

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
          <div class="hpc-footer" style="display:flex; justify-content:flex-end;">
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

    const urgency = document.getElementById('dispUrgency')?.value || 'Urgent';
    const neededWithinVal = document.getElementById('dispNeededWithin')?.value;
    const neededWithinMins = neededWithinVal ? parseInt(neededWithinVal, 10) : null;

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
          radius: parseFloat(radius) || 10,
          urgencyLevel: urgency,
          urgency: urgency,
          neededWithinMins: neededWithinMins,
          neededWithinMinutes: neededWithinMins
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
      const urgency = document.getElementById('dispUrgency')?.value || 'Urgent';
      const neededWithinVal = document.getElementById('dispNeededWithin')?.value;
      const neededWithinMins = neededWithinVal ? parseInt(neededWithinVal, 10) : null;

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
            radius: parseFloat(radius) || 10,
            urgencyLevel: urgency,
            urgency: urgency,
            neededWithinMins: neededWithinMins,
            neededWithinMinutes: neededWithinMins
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
  window.HospitalStockStore.init();
  window.HospitalStockStore.subscribe((stockData) => {
    if (stockData && stockData.inventory) {
      const activeCount = typeof window.latestActiveRequestsCount === 'number' ? window.latestActiveRequestsCount : 0;
      renderDashboardStock(stockData.inventory, activeCount);
      loadInventoryTable();
    }
  });

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
    const stockObj = window.HospitalStockStore.data || await window.HospitalStockStore.fetch();
    const stock = (stockObj && stockObj.inventory) || {};

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

      // Wire Stepper on Inventory Page via shared HospitalStockStore
      tbody.querySelectorAll('.btn-inv-inc').forEach(b => {
        b.addEventListener('click', async () => {
          const t = b.getAttribute('data-type');
          if (t) {
            b.disabled = true;
            await window.HospitalStockStore.adjust(t, 1);
            b.disabled = false;
          }
        });
      });

      tbody.querySelectorAll('.btn-inv-dec').forEach(b => {
        b.addEventListener('click', async () => {
          const t = b.getAttribute('data-type');
          if (t) {
            b.disabled = true;
            await window.HospitalStockStore.adjust(t, -1);
            b.disabled = false;
          }
        });
      });
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
  return window.HospitalStockStore.adjust(bloodType, change);
}

/* ============================================================
   9. MY REQUESTS / DISPATCH LOGS (REAL BACKEND REQUEST HISTORY)
   ============================================================ */
let recordsAll = [];
let recordsFiltered = [];
let recordsSummary = {};
let currentRecordsPage = 1;
const recordsPageSize = 10;
let selectedRequest = null;

function initRecords() {
  // Search & Filter listeners
  const searchInput = document.getElementById('reqSearchInput');
  const filterStatus = document.getElementById('reqFilterStatus');
  const filterBlood = document.getElementById('reqFilterBloodGroup');
  const filterUrgency = document.getElementById('reqFilterUrgency');
  const filterDate = document.getElementById('reqFilterDate');
  const btnReset = document.getElementById('btnResetReqFilters');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentRecordsPage = 1;
      applyRecordsFilter();
    });
  }
  if (filterStatus) filterStatus.addEventListener('change', () => { currentRecordsPage = 1; applyRecordsFilter(); });
  if (filterBlood) filterBlood.addEventListener('change', () => { currentRecordsPage = 1; applyRecordsFilter(); });
  if (filterUrgency) filterUrgency.addEventListener('change', () => { currentRecordsPage = 1; applyRecordsFilter(); });
  if (filterDate) filterDate.addEventListener('change', () => { currentRecordsPage = 1; applyRecordsFilter(); });
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (filterStatus) filterStatus.value = 'ALL';
      if (filterBlood) filterBlood.value = 'ALL';
      if (filterUrgency) filterUrgency.value = 'ALL';
      if (filterDate) filterDate.value = 'ALL';
      currentRecordsPage = 1;
      applyRecordsFilter();
    });
  }

  // Pagination buttons
  const btnPrev = document.getElementById('btnReqPrevPage');
  const btnNext = document.getElementById('btnReqNextPage');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentRecordsPage > 1) {
        currentRecordsPage--;
        renderRecordsPage();
      }
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const maxPage = Math.max(1, Math.ceil(recordsFiltered.length / recordsPageSize));
      if (currentRecordsPage < maxPage) {
        currentRecordsPage++;
        renderRecordsPage();
      }
    });
  }

  // Export CSV
  const exportBtn = document.getElementById('btnExportRecordsCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCsv);
  }

  // Drawer Close
  const closeDrawerBtn = document.getElementById('btnCloseReqDrawer');
  const drawerBackdrop = document.getElementById('reqDrawerBackdrop');
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeRequestDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeRequestDrawer);

  // Drawer Action Buttons & Modals
  setupDrawerActions();

  // Load initial data
  loadRecordsTable();
}

async function loadRecordsTable(isSilent = false) {
  const tbody = document.getElementById('recordsTableBody');
  const emptyBox = document.getElementById('recordsEmptyState');
  const errorBox = document.getElementById('recordsErrorState');
  if (!tbody) return;

  if (errorBox && !isSilent) errorBox.style.display = 'none';

  try {
    const res = await fetch('/api/hospital/requests/history', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        if (Array.isArray(json.data)) {
          recordsAll = json.data;
          recordsSummary = {};
        } else if (json.data.requests) {
          recordsAll = Array.isArray(json.data.requests) ? json.data.requests : [];
          recordsSummary = json.data.summary || {};
        }
      } else {
        recordsAll = [];
      }
    } else {
      if (errorBox && !isSilent) errorBox.style.display = 'block';
      return;
    }
  } catch (e) {
    console.error('Records fetch error:', e);
    if (errorBox && !isSilent) errorBox.style.display = 'block';
    return;
  }

  // Render Summary Cards (Group 4.1)
  renderRecordsSummaryCards();

  // Apply filters and render page
  applyRecordsFilter();
}

function renderRecordsSummaryCards() {
  const elActive = document.getElementById('summaryActiveNow');
  const elFulfilled = document.getElementById('summaryFulfilledThisMonth');
  const elCancelled = document.getElementById('summaryCancelledThisMonth');
  const elAvgResp = document.getElementById('summaryAvgResponseTime');

  let activeCount = recordsSummary.activeNow;
  let fulfilledCount = recordsSummary.fulfilledThisMonth;
  let cancelledCount = recordsSummary.cancelledThisMonth;
  let avgText = recordsSummary.avgFirstResponseText;

  // Fallback calculation if backend didn't supply summary object
  if (activeCount === undefined) {
    activeCount = recordsAll.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'active' || s === 'open' || s === 'accepted' || s === 'arrived';
    }).length;
  }
  if (fulfilledCount === undefined) {
    fulfilledCount = recordsAll.filter(r => (r.status || '').toLowerCase() === 'fulfilled').length;
  }
  if (cancelledCount === undefined) {
    cancelledCount = recordsAll.filter(r => (r.status || '').toLowerCase() === 'cancelled').length;
  }
  if (!avgText) {
    avgText = 'No data yet';
  }

  if (elActive) elActive.textContent = activeCount;
  if (elFulfilled) elFulfilled.textContent = fulfilledCount;
  if (elCancelled) elCancelled.textContent = cancelledCount;
  if (elAvgResp) elAvgResp.textContent = avgText;
}

function applyRecordsFilter() {
  const searchInput = document.getElementById('reqSearchInput');
  const filterStatus = document.getElementById('reqFilterStatus');
  const filterBlood = document.getElementById('reqFilterBloodGroup');
  const filterUrgency = document.getElementById('reqFilterUrgency');
  const filterDate = document.getElementById('reqFilterDate');

  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const st = filterStatus ? filterStatus.value : 'ALL';
  const bg = filterBlood ? filterBlood.value : 'ALL';
  const urg = filterUrgency ? filterUrgency.value : 'ALL';
  const dFilter = filterDate ? filterDate.value : 'ALL';

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  recordsFiltered = recordsAll.filter(r => {
    // 1. Status Filter
    const rStatus = (r.status || 'Active').toUpperCase();
    if (st === 'ACTIVE') {
      if (!['ACTIVE', 'OPEN', 'ACCEPTED', 'ARRIVED'].includes(rStatus)) return false;
    } else if (st !== 'ALL') {
      if (rStatus !== st) return false;
    }

    // 2. Blood Group Filter
    const rBlood = (r.blood_type || r.bloodType || '').toUpperCase();
    if (bg !== 'ALL' && rBlood !== bg.toUpperCase()) return false;

    // 3. Urgency Filter
    const rUrg = (r.urgency_level || r.urgency || 'Normal').toUpperCase();
    if (urg !== 'ALL' && rUrg !== urg.toUpperCase()) return false;

    // 4. Date Filter
    if (dFilter !== 'ALL' && (r.created_at || r.createdAt)) {
      const rawDateStr = r.created_at || r.createdAt;
      const rDate = new Date(rawDateStr);
      if (!isNaN(rDate.getTime())) {
        if (dFilter === 'TODAY') {
          const isSameDay = rDate.getFullYear() === now.getFullYear() &&
                            rDate.getMonth() === now.getMonth() &&
                            rDate.getDate() === now.getDate();
          if (!isSameDay) return false;
        } else if (dFilter === 'WEEK') {
          if (rDate < weekAgo) return false;
        } else if (dFilter === 'MONTH') {
          if (rDate.getMonth() !== currentMonth || rDate.getFullYear() !== currentYear) return false;
        }
      }
    }

    // 5. Search Text Query (ID, Patient, Ward, Notes)
    if (q) {
      const reqIdStr = `#REQ-${String(r.id || '').padStart(3, '0')}`.toLowerCase();
      const rawId = String(r.id || '').toLowerCase();
      const pName = String(r.patient_name || r.patientName || '').toLowerCase();
      const wInfo = String(r.wardInfo || r.ward_info || '').toLowerCase();
      const notes = String(r.fulfillment_note || r.notes || '').toLowerCase();
      if (!reqIdStr.includes(q) && !rawId.includes(q) && !pName.includes(q) && !wInfo.includes(q) && !notes.includes(q)) {
        return false;
      }
    }

    return true;
  });

  renderRecordsPage();
}

function renderRecordsPage() {
  const tbody = document.getElementById('recordsTableBody');
  const emptyBox = document.getElementById('recordsEmptyState');
  const paginationInfo = document.getElementById('reqPaginationInfo');
  const pageNumSpan = document.getElementById('reqPageNum');
  const btnPrev = document.getElementById('btnReqPrevPage');
  const btnNext = document.getElementById('btnReqNextPage');
  if (!tbody) return;

  const total = recordsFiltered.length;
  const maxPage = Math.max(1, Math.ceil(total / recordsPageSize));
  if (currentRecordsPage > maxPage) currentRecordsPage = maxPage;

  if (total === 0) {
    tbody.innerHTML = '';
    if (emptyBox) emptyBox.style.display = 'block';
    if (paginationInfo) paginationInfo.textContent = 'Showing 0 of 0 requests';
    if (pageNumSpan) pageNumSpan.textContent = 'Page 1 of 1';
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';

  const startIdx = (currentRecordsPage - 1) * recordsPageSize;
  const endIdx = Math.min(startIdx + recordsPageSize, total);
  const pageItems = recordsFiltered.slice(startIdx, endIdx);

  tbody.innerHTML = pageItems.map(r => {
    const idFormatted = `#REQ-${String(r.id).padStart(3, '0')}`;
    const blood = r.blood_type || r.bloodType || '-';
    const units = `${r.units_requested || 1} ${r.units_requested === 1 ? 'unit' : 'units'}`;
    const relTime = getRelativeTime(r.created_at || r.createdAt);
    const dateObj = r.created_at ? new Date(r.created_at) : null;
    const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    const dateStr = dateObj ? dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    
    // Urgency
    const urgRaw = (r.urgency_level || r.urgency || 'Normal').toUpperCase();
    let urgClass = 'normal';
    let urgLabel = 'Normal';
    if (urgRaw.includes('CRIT')) { urgClass = 'critical'; urgLabel = 'Critical'; }
    else if (urgRaw.includes('URG')) { urgClass = 'urgent'; urgLabel = 'Urgent'; }

    // Status
    const status = r.status || 'Active';
    let statusClass = 'active';
    if (status === 'Fulfilled') statusClass = 'available';
    else if (status === 'Cancelled') statusClass = 'low';
    else if (status === 'Expired') statusClass = 'expired';
    else if (status === 'Accepted' || status === 'Arrived') statusClass = 'accepted';

    // Radius (Group 4.3: Real radius, NOT "Normal")
    const radiusVal = (r.radiusKm !== null && r.radiusKm !== undefined) ? r.radiusKm : 10;
    const radiusStr = `${radiusVal} km`;

    // Counts
    const notified = r.donorsNotified ?? r.notifiedCount ?? 0;
    const accepted = r.donorsAccepted ?? r.acceptedCount ?? 0;
    const arrived = r.donorsArrived ?? r.arrivedCount ?? 0;
    const declined = r.donorsDeclined ?? r.declinedCount ?? 0;

    // First response time
    const respTimeStr = r.firstResponseTime || ((status === 'Open' || status === 'Active') ? '<span style="color:#f59e0b;">Pending</span>' : '-');

    // Patient & Ward
    const pName = escapeHtml(r.patient_name || r.patientName || 'Emergency Patient');
    const wInfo = r.wardInfo ? `<div style="font-size:11px; color:#94a3b8;">${escapeHtml(r.wardInfo)}</div>` : '';

    // Staff
    const staffName = escapeHtml(r.staffUser || 'Hospital Staff');

    return `
      <tr class="req-row-clickable" onclick="handleRequestRowClick(${r.id})" style="cursor: pointer;" title="Click to view request timeline and donors">
        <td><strong style="color: #38bdf8; font-family: 'JetBrains Mono', monospace;">${idFormatted}</strong></td>
        <td>
          <div style="font-weight: 600; color: #fff;">${relTime}</div>
          <div style="font-size: 11.5px; color: var(--hosp-text-muted);">${dateStr} ${timeStr}</div>
        </td>
        <td>
          <div style="font-weight: 500; color: #fff;">${pName}</div>
          ${wInfo}
        </td>
        <td>${getDropBadgeSvg(blood, '')}</td>
        <td><span class="mono-data">${units}</span></td>
        <td><span class="chip-status ${urgClass}">${urgLabel}</span></td>
        <td><span class="chip-status ${statusClass}">${status}</span></td>
        <td>
          <strong style="color: ${accepted > 0 ? '#22c55e' : '#cbd5e1'}; font-family: 'JetBrains Mono', monospace;">${accepted}</strong>
          <span style="color: var(--hosp-text-muted);">/</span>
          <span class="mono-data">${notified}</span>
          ${declined > 0 ? `<div style="font-size: 11px; color: #f87171;">(${declined} declined)</div>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  if (paginationInfo) paginationInfo.textContent = `Showing ${startIdx + 1}–${endIdx} of ${total} requests`;
  if (pageNumSpan) pageNumSpan.textContent = `Page ${currentRecordsPage} of ${maxPage}`;
  if (btnPrev) btnPrev.disabled = currentRecordsPage <= 1;
  if (btnNext) btnNext.disabled = currentRecordsPage >= maxPage;
}

window.handleRequestRowClick = function(reqId) {
  const req = recordsAll.find(r => r.id === reqId);
  if (req) {
    openRequestDrawer(req);
  }
};

/* ============================================================
   DETAIL DRAWER ENGINE (Group 4.4 & 4.5)
   ============================================================ */
async function openRequestDrawer(r) {
  selectedRequest = r;
  const drawer = document.getElementById('reqDetailDrawer');
  const backdrop = document.getElementById('reqDrawerBackdrop');
  if (!drawer || !backdrop) return;

  const idFormatted = `#REQ-${String(r.id).padStart(3, '0')}`;
  document.getElementById('drawerReqId').textContent = idFormatted;

  const blood = r.blood_type || r.bloodType || '-';
  const bloodBadge = document.getElementById('drawerBloodBadge');
  if (bloodBadge) bloodBadge.innerHTML = getDropBadgeSvg(blood, '');

  const statusBadge = document.getElementById('drawerStatusBadge');
  const status = r.status || 'Active';
  let statusClass = 'active';
  if (status === 'Fulfilled') statusClass = 'available';
  else if (status === 'Cancelled') statusClass = 'low';
  else if (status === 'Expired') statusClass = 'expired';
  else if (status === 'Accepted' || status === 'Arrived') statusClass = 'accepted';
  if (statusBadge) {
    statusBadge.className = `chip-status ${statusClass}`;
    statusBadge.textContent = status;
  }

  // Populate Meta details
  const pName = escapeHtml(r.patient_name || r.patientName || 'Emergency Patient');
  const wInfo = r.wardInfo ? ` (${escapeHtml(r.wardInfo)})` : '';
  document.getElementById('drawerPatient').innerHTML = `${pName}${wInfo}`;
  document.getElementById('drawerUnits').textContent = `${r.units_requested || 1} units`;
  document.getElementById('drawerUrgency').textContent = r.urgency_level || r.urgency || 'Normal';
  document.getElementById('drawerRadius').textContent = `${(r.radiusKm !== null && r.radiusKm !== undefined) ? r.radiusKm : 10} km`;
  const drawerFirstResp = document.getElementById('drawerFirstResponse');
  if (drawerFirstResp) drawerFirstResp.innerHTML = r.firstResponseTime || ((status === 'Open' || status === 'Active') ? '<span style="color:#f59e0b;">Pending</span>' : '-');
  const drawerArr = document.getElementById('drawerArrived');
  if (drawerArr) drawerArr.textContent = String(r.donorsArrived ?? 0);
  document.getElementById('drawerStaff').textContent = r.staffUser || 'Hospital Staff';

  const dateObj = r.created_at ? new Date(r.created_at) : null;
  const timeFormatted = dateObj ? `${dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '-';
  document.getElementById('drawerSentTime').textContent = timeFormatted;

  const noteText = r.fulfillment_note || r.notes || '';
  const noteSpan = document.getElementById('drawerNoteText');
  if (noteSpan) noteSpan.textContent = noteText || 'None recorded';

  // Cancelled reason box
  const cancelBox = document.getElementById('drawerCancelReasonBox');
  const cancelSpan = document.getElementById('drawerCancelReasonText');
  if (r.cancelled_reason && status === 'Cancelled') {
    cancelSpan.textContent = r.cancelled_reason;
    cancelBox.style.display = 'block';
  } else {
    cancelBox.style.display = 'none';
  }

  // Linked donations box
  const donBox = document.getElementById('drawerLinkedDonationsBox');
  const donSpan = document.getElementById('drawerLinkedDonationText');
  if (r.donationRef || (r.linkedDonations && r.linkedDonations.length > 0)) {
    const ref = r.donationRef || r.linkedDonations[0].refCode || `RED-${String(r.linkedDonations[0].donationId).padStart(5, '0')}`;
    donSpan.textContent = `${ref} (Verified intake donation recorded)`;
    donBox.style.display = 'block';
  } else {
    donBox.style.display = 'none';
  }

  // Actions visibility based on lifecycle state (Group 4.5)
  const isClosed = status === 'Fulfilled' || status === 'Cancelled' || status === 'Expired';
  const btnCancel = document.getElementById('btnDrawerCancel');
  const btnExtend = document.getElementById('btnDrawerExtend');
  const btnFulfill = document.getElementById('btnDrawerFulfill');
  const btnDuplicate = document.getElementById('btnDrawerDuplicate');

  if (btnCancel) btnCancel.style.display = !isClosed ? 'inline-block' : 'none';
  if (btnExtend) btnExtend.style.display = !isClosed ? 'inline-block' : 'none';
  if (btnFulfill) btnFulfill.style.display = !isClosed ? 'inline-block' : 'none';
  if (btnDuplicate) btnDuplicate.style.display = 'inline-block';

  // Render Status Timeline (Group 4.4)
  renderRequestTimeline(r);

  // Load Contacted Donors List
  loadRequestDonorsList(r.id);

  // Show drawer
  drawer.style.display = 'block';
  backdrop.style.display = 'block';
}

function closeRequestDrawer() {
  const drawer = document.getElementById('reqDetailDrawer');
  const backdrop = document.getElementById('reqDrawerBackdrop');
  if (drawer) drawer.style.display = 'none';
  if (backdrop) backdrop.style.display = 'none';
  selectedRequest = null;
  window.selectedRequest = null;
}

function renderRequestTimeline(r) {
  const timelineEl = document.getElementById('drawerTimeline');
  if (!timelineEl) return;

  const status = (r.status || 'Active').toLowerCase();
  const isFulfilled = status === 'fulfilled';
  const isCancelled = status === 'cancelled';
  const isExpired = status === 'expired';
  const isAccepted = status === 'accepted' || isFulfilled || status === 'arrived';
  const isArrived = status === 'arrived' || isFulfilled;

  const dateStr = r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const notified = r.donorsNotified ?? r.notifiedCount ?? 0;
  const accepted = r.donorsAccepted ?? r.acceptedCount ?? 0;
  const declined = r.donorsDeclined ?? r.declinedCount ?? 0;

  const steps = [
    { title: 'Sent & Dispatched', time: dateStr, done: true, color: '#38bdf8' },
    { title: `Notified (${notified} active)`, time: `${declined > 0 ? `${declined} declined &bull; ` : ''}${(r.radiusKm || 10)} km radius`, done: (notified > 0 || accepted > 0), color: '#38bdf8' },
    { title: `Accepted (${accepted} confirmed)`, time: r.firstResponseTime ? `First response: ${r.firstResponseTime}` : (isAccepted ? 'Confirmed' : 'Awaiting response'), done: isAccepted, color: '#22c55e' },
    { title: 'Arrived at Facility', time: isArrived ? 'Donor at check-in' : 'In transit / Pending', done: isArrived, color: '#38bdf8' }
  ];

  if (isCancelled) {
    steps.push({ title: 'Request Cancelled', time: r.cancelled_reason || 'Cancelled by staff', done: true, color: '#f87171' });
  } else if (isExpired) {
    steps.push({ title: 'Request Expired', time: '60 min window ended', done: true, color: '#94a3b8' });
  } else {
    steps.push({ title: isFulfilled ? 'Fulfilled (Intake Complete)' : 'Fulfillment', time: isFulfilled ? 'Donation approved' : 'Pending donation intake', done: isFulfilled, color: '#22c55e' });
  }

  timelineEl.innerHTML = steps.map((s, idx) => `
    <div style="display: flex; gap: 12px; align-items: flex-start;">
      <div style="display: flex; flex-direction: column; align-items: center;">
        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${s.done ? s.color : '#475569'}; margin-top: 4px;"></span>
        ${idx < steps.length - 1 ? '<span style="display: inline-block; width: 2px; height: 20px; background: rgba(255,255,255,0.1); margin: 2px 0;"></span>' : ''}
      </div>
      <div>
        <div style="font-size: 13px; font-weight: ${s.done ? '600' : '400'}; color: ${s.done ? '#fff' : '#94a3b8'};">${s.title}</div>
        <div style="font-size: 11.5px; color: var(--hosp-text-muted);">${s.time}</div>
      </div>
    </div>
  `).join('');
}

async function loadRequestDonorsList(reqId) {
  const container = document.getElementById('drawerDonorList');
  const countEl = document.getElementById('drawerDonorCount');
  if (!container) return;

  container.innerHTML = '<div style="font-size: 12px; color: var(--hosp-text-muted);">Loading contacted donors...</div>';

  try {
    const res = await fetch(`/api/hospital/requests/${reqId}/donors`, { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      const donors = Array.isArray(json.data) ? json.data : [];
      if (countEl) countEl.textContent = donors.length;

      if (donors.length === 0) {
        container.innerHTML = '<div style="font-size: 12.5px; color: var(--hosp-text-muted); padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px;">No donors contacted yet.</div>';
        return;
      }

      container.innerHTML = donors.map(d => {
        const dStatus = (d.status || 'NOTIFIED').toUpperCase();
        let statusBadgeClass = 'normal';
        let statusLabel = 'Notified';
        if (dStatus === 'ACCEPTED' || dStatus === 'DONATED') { statusBadgeClass = 'available'; statusLabel = 'Accepted'; }
        else if (dStatus === 'ARRIVED') { statusBadgeClass = 'accepted'; statusLabel = 'Arrived'; }
        else if (dStatus === 'DECLINED') { statusBadgeClass = 'low'; statusLabel = 'Declined'; }
        else if (dStatus === 'EXPIRED') { statusBadgeClass = 'expired'; statusLabel = 'Expired'; }

        const distStr = d.distanceKm !== null ? `${d.distanceKm} km away` : '';
        const etaStr = d.etaMinutes !== null ? `(${d.etaMinutes} min)` : '';
        const isAcceptedDonor = dStatus === 'ACCEPTED' || dStatus === 'ARRIVED' || dStatus === 'DONATED';

        let contactSection = '';
        if (isAcceptedDonor && (d.phone || d.email)) {
          contactSection = `
            <div style="display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap;">
              ${d.phone ? `
                <a href="tel:${escapeHtml(d.phone)}" class="btn-call-donor" style="background: #059669; color: #fff; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-phone"></i>
                  <span>Call ${escapeHtml(d.phone)}</span>
                </a>
              ` : ''}
              ${d.email ? `
                <a href="mailto:${escapeHtml(d.email)}" style="background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-envelope"></i>
                  <span>${escapeHtml(d.email)}</span>
                </a>
              ` : ''}
            </div>
          `;
        } else if (dStatus === 'DECLINED') {
          contactSection = `<div style="font-size: 11px; color: #f87171; margin-top: 5px;"><i class="fa-solid fa-circle-xmark"></i> Donor declined this request.</div>`;
        } else {
          contactSection = `<div style="font-size: 11px; color: #94a3b8; margin-top: 5px;"><i class="fa-solid fa-shield-halved"></i> Contact details masked until donor accepts.</div>`;
        }

        return `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--hosp-border); border-radius: 8px; padding: 10px 12px; font-size: 12.5px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); padding: 1px 6px; border-radius: 4px;">
                  ${escapeHtml(d.donorId || 'DNR')}
                </span>
                <strong style="color: #fff; font-size: 13px;">${escapeHtml(d.donorName || 'Donor')}</strong>
                <span style="background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">
                  ${escapeHtml(d.bloodType || '')}
                </span>
                ${distStr ? `<span style="font-size: 11.5px; color: var(--hosp-text-muted);">&bull; ${distStr} ${etaStr}</span>` : ''}
              </div>
              <span class="chip-status ${statusBadgeClass}" style="font-size: 11px; padding: 2px 8px; font-weight: 700;">${statusLabel}</span>
            </div>
            ${contactSection}
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<div style="font-size: 12px; color: #f87171;">Could not load donor responses.</div>';
    }
  } catch (_) {
    container.innerHTML = '<div style="font-size: 12px; color: #f87171;">Network notice loading responses.</div>';
  }
}

/* ============================================================
   DRAWER ACTIONS & CONFIRMATION MODALS (Group 4.5)
   ============================================================ */
function setupDrawerActions() {
  // 1. Cancel Action
  const btnCancel = document.getElementById('btnDrawerCancel');
  const modalCancel = document.getElementById('modalCancelRequest');
  const btnCancelClose = document.getElementById('btnCancelModalClose');
  const btnConfirmCancel = document.getElementById('btnConfirmCancelRequest');
  const inputCancelReason = document.getElementById('cancelReasonInput');

  if (btnCancel && modalCancel) {
    btnCancel.addEventListener('click', () => {
      if (inputCancelReason) inputCancelReason.value = '';
      modalCancel.style.display = 'flex';
    });
  }
  if (btnCancelClose && modalCancel) {
    btnCancelClose.addEventListener('click', () => { modalCancel.style.display = 'none'; });
  }
  if (btnConfirmCancel && modalCancel) {
    btnConfirmCancel.addEventListener('click', async () => {
      const reason = (inputCancelReason ? inputCancelReason.value : '').trim();
      if (!reason || reason.length < 3) {
        alert('Please enter a cancellation reason (minimum 3 characters).');
        return;
      }
      try {
        const res = await fetch(`/api/hospital/requests/${selectedRequest.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason })
        });
        if (res.ok) {
          modalCancel.style.display = 'none';
          showToast('Request cancelled successfully', 'info');
          closeRequestDrawer();
          loadRecordsTable();
        } else {
          const err = await res.json();
          alert(err.message || 'Failed to cancel request');
        }
      } catch (e) {
        alert('Network error cancelling request');
      }
    });
  }

  // 2. Extend Radius Action
  const btnExtend = document.getElementById('btnDrawerExtend');
  const modalExtend = document.getElementById('modalExtendRadius');
  const btnExtendClose = document.getElementById('btnExtendRadiusClose');
  const btnConfirmExtend = document.getElementById('btnConfirmExtendRadius');
  const selRadius = document.getElementById('selExtendRadius');

  if (btnExtend && modalExtend) {
    btnExtend.addEventListener('click', () => {
      if (selRadius && selectedRequest) {
        const curRad = selectedRequest.radiusKm || 10;
        if (curRad >= 20) selRadius.value = '25';
        else if (curRad >= 15) selRadius.value = '20';
        else selRadius.value = '15';
      }
      modalExtend.style.display = 'flex';
    });
  }
  if (btnExtendClose && modalExtend) {
    btnExtendClose.addEventListener('click', () => { modalExtend.style.display = 'none'; });
  }
  if (btnConfirmExtend && modalExtend) {
    btnConfirmExtend.addEventListener('click', async () => {
      const radius = parseFloat(selRadius ? selRadius.value : 15);
      try {
        const res = await fetch(`/api/hospital/requests/${selectedRequest.id}/extend-radius`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ radius })
        });
        if (res.ok) {
          modalExtend.style.display = 'none';
          showToast(`Search perimeter extended to ${radius} km`, 'success');
          selectedRequest.radiusKm = radius;
          document.getElementById('drawerRadius').textContent = `${radius} km`;
          loadRecordsTable();
        } else {
          alert('Failed to extend radius');
        }
      } catch (e) {
        alert('Network error extending radius');
      }
    });
  }

  // 3. Mark Fulfilled Action
  const btnFulfill = document.getElementById('btnDrawerFulfill');
  const modalFulfill = document.getElementById('modalFulfillRequest');
  const btnFulfillClose = document.getElementById('btnFulfillModalClose');
  const btnConfirmFulfill = document.getElementById('btnConfirmFulfillRequest');
  const inputFulfillNote = document.getElementById('fulfillNoteInput');

  if (btnFulfill && modalFulfill) {
    btnFulfill.addEventListener('click', () => {
      if (inputFulfillNote) inputFulfillNote.value = '';
      modalFulfill.style.display = 'flex';
    });
  }
  if (btnFulfillClose && modalFulfill) {
    btnFulfillClose.addEventListener('click', () => { modalFulfill.style.display = 'none'; });
  }
  if (btnConfirmFulfill && modalFulfill) {
    btnConfirmFulfill.addEventListener('click', async () => {
      const note = (inputFulfillNote ? inputFulfillNote.value : '').trim();
      if (!note || note.length < 3) {
        alert('Please enter a fulfillment note (minimum 3 characters).');
        return;
      }
      try {
        const res = await fetch(`/api/hospital/requests/${selectedRequest.id}/fulfill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ note })
        });
        if (res.ok) {
          modalFulfill.style.display = 'none';
          showToast('Request marked as fulfilled', 'success');
          closeRequestDrawer();
          loadRecordsTable();
        } else {
          const err = await res.json();
          alert(err.message || 'Failed to fulfill request');
        }
      } catch (e) {
        alert('Network error fulfilling request');
      }
    });
  }

  // 4. Duplicate Request Action
  const btnDuplicate = document.getElementById('btnDrawerDuplicate');
  const modalDuplicate = document.getElementById('modalDuplicateRequest');
  const btnDuplicateClose = document.getElementById('btnDuplicateModalClose');
  const btnConfirmDuplicate = document.getElementById('btnConfirmDuplicateRequest');

  if (btnDuplicate && modalDuplicate) {
    btnDuplicate.addEventListener('click', () => {
      modalDuplicate.style.display = 'flex';
    });
  }
  if (btnDuplicateClose && modalDuplicate) {
    btnDuplicateClose.addEventListener('click', () => { modalDuplicate.style.display = 'none'; });
  }
  if (btnConfirmDuplicate && modalDuplicate) {
    btnConfirmDuplicate.addEventListener('click', () => {
      modalDuplicate.style.display = 'none';
      closeRequestDrawer();

      // Pre-fill Find Donors dispatch form in tab-dispatch
      if (selectedRequest) {
        const bgSel = document.getElementById('dispBloodGroup') || document.getElementById('selSearchBloodGroup');
        const unitsInp = document.getElementById('dispUnits') || document.getElementById('inpSearchUnits');
        const urgSel = document.getElementById('dispUrgency') || document.getElementById('selSearchUrgency');
        const notesInp = document.getElementById('dispNotes') || document.getElementById('inpSearchNotes');

        if (bgSel) bgSel.value = selectedRequest.blood_type || selectedRequest.bloodType || 'A+';
        if (unitsInp) unitsInp.value = selectedRequest.units_requested || 1;
        if (urgSel) urgSel.value = (selectedRequest.urgency_level || 'HIGH').toUpperCase();
        if (notesInp) notesInp.value = selectedRequest.fulfillment_note || selectedRequest.notes || '';
      }

      switchTab('tab-dispatch');
      showToast('Request parameters loaded into Find Donors', 'info');
    });
  }
}

/* ============================================================
   EXPORT CSV (Group 4.2: Respects all active filters)
   ============================================================ */
function exportCsv() {
  if (recordsFiltered.length === 0) {
    alert('No matching records available to export.');
    return;
  }
  const headers = [
    'Request ID',
    'Sent Date',
    'Sent Time',
    'Patient Name',
    'Ward / Bed',
    'Blood Group',
    'Units',
    'Urgency',
    'Radius (km)',
    'Donors Notified',
    'Donors Accepted',
    'Donors Arrived',
    'Status',
    'First Response Time',
    'Created By',
    'Fulfillment Note',
    'Cancellation Reason'
  ];

  const rows = recordsFiltered.map(r => {
    const idFormatted = `#REQ-${String(r.id).padStart(3, '0')}`;
    const dateObj = r.created_at ? new Date(r.created_at) : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString('en-GB') : '';
    const timeStr = dateObj ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const blood = r.blood_type || r.bloodType || '';
    const units = r.units_requested || 1;
    const urg = r.urgency_level || r.urgency || 'Normal';
    const radius = (r.radiusKm !== null && r.radiusKm !== undefined) ? r.radiusKm : 10;
    const notified = r.donorsNotified ?? 0;
    const accepted = r.donorsAccepted ?? 0;
    const arrived = r.donorsArrived ?? 0;
    const status = r.status || 'Active';
    const respTime = r.firstResponseTime || '-';
    const staff = r.staffUser || 'Hospital Staff';
    const pName = (r.patient_name || r.patientName || 'Emergency Patient').replace(/"/g, '""');
    const ward = (r.wardInfo || '').replace(/"/g, '""');
    const fNote = (r.fulfillment_note || r.notes || '').replace(/"/g, '""');
    const cReason = (r.cancelled_reason || '').replace(/"/g, '""');

    return [
      `"${idFormatted}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${pName}"`,
      `"${ward}"`,
      `"${blood}"`,
      `"${units}"`,
      `"${urg}"`,
      `"${radius}"`,
      `"${notified}"`,
      `"${accepted}"`,
      `"${arrived}"`,
      `"${status}"`,
      `"${respTime}"`,
      `"${staff}"`,
      `"${fNote}"`,
      `"${cReason}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `RED404_MyRequests_Export_${Date.now()}.csv`);
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

  function getLoggedInStaffName() {
    const p = window.currentHospitalProfile || {};
    const hospName = (p.name || p.hospitalName || p.hospital_name || '').trim().toLowerCase();

    const candidates = [p.adminName, p.admin_name, p.staffName, p.staff_name, p.contactPerson, p.contact_person];
    for (const c of candidates) {
      if (c && typeof c === 'string' && c.trim()) {
        const clean = c.trim();
        if (clean.toLowerCase() !== hospName && clean.toLowerCase() !== 'hospital') {
          return clean;
        }
      }
    }

    try {
      const raw = sessionStorage.getItem('red404_hospital_user') || sessionStorage.getItem('hospital_session') || sessionStorage.getItem('red404_hospital_session') || localStorage.getItem('red404_hospital_user');
      if (raw) {
        const u = JSON.parse(raw);
        const userCandidates = [u.adminName, u.admin_name, u.staffName, u.staff_name, u.contactPerson];
        for (const c of userCandidates) {
          if (c && typeof c === 'string' && c.trim()) {
            const clean = c.trim();
            if (clean.toLowerCase() !== hospName && clean.toLowerCase() !== 'hospital') {
              return clean;
            }
          }
        }
      }
    } catch (_) {}

    return 'Attending Staff';
  }

  function resetCheckinForm(keepInput, keepSuccessCard) {
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

    const reasonEl = document.getElementById('approveDisabledReason');
    if (reasonEl) {
      reasonEl.textContent = 'Look up a donor first';
      reasonEl.style.display = 'block';
    }

    if (verdictBanner) verdictBanner.style.display = 'none';
    if (btnRecordDonation) btnRecordDonation.disabled = true;
    if (btnDeferDonation) btnDeferDonation.disabled = true;
    if (!keepSuccessCard && successCard) successCard.style.display = 'none';
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
    lookupBtn.addEventListener('click', () => performDonorLookup());
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', () => performDonorLookup());
  }

  async function performDonorLookup(preserveSuccessCard) {
    if (!inputId) return;
    const query = inputId.value.trim();
    if (!query) {
      alert('Please enter a valid Donor ID or Smart ID.');
      inputId.focus();
      return;
    }

    resetCheckinForm(true, preserveSuccessCard);
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

  window.lookupDonor = async function(query, preserveSuccessCard) {
    if (inputId) inputId.value = query;
    await performDonorLookup(preserveSuccessCard);
  };

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

    // Part 6 Step 4: Check-in lookup card shows donor's last check (date, hospital, hemoglobin, weight, vitals)
    const prevCheckCard = document.getElementById('dlcPreviousCheckContent');
    if (prevCheckCard) {
      const hc = d.lastHealthCheck;
      if (hc && (hc.date || hc.checkedAt)) {
        const checkDate = hc.date || (hc.checkedAt ? hc.checkedAt.substring(0, 10) : '');
        const hospName = hc.hospitalName || 'Verified Hospital';
        const parts = [];
        if (hc.weight != null) parts.push(`Weight: ${hc.weight} kg`);
        if (hc.hemoglobin != null) parts.push(`Hemoglobin: ${hc.hemoglobin} g/dL`);
        if (hc.bloodPressure != null) parts.push(`BP: ${hc.bloodPressure} mmHg`);
        else if (hc.bpSys != null && hc.bpDia != null) parts.push(`BP: ${Math.round(hc.bpSys)}/${Math.round(hc.bpDia)} mmHg`);
        if (hc.pulse != null) parts.push(`Pulse: ${hc.pulse} bpm`);
        if (hc.temperature != null) parts.push(`Temp: ${hc.temperature} °F`);
        const valuesStr = parts.length > 0 ? parts.join(' · ') : 'No vitals recorded';
        const outcome = hc.outcome || 'Approved';
        const outcomeColor = (outcome === 'Deferred' || outcome === 'DEFERRED') ? '#f5a524' : '#3ecf8e';

        prevCheckCard.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
            <span>Previous check: <strong style="color: #fff;">${escapeHtml(checkDate)}</strong> at <strong style="color: #fff;">${escapeHtml(hospName)}</strong></span>
            <span style="font-weight: 600; font-size: 11px; color: ${outcomeColor}; text-transform: uppercase;">${escapeHtml(outcome)}</span>
          </div>
          <div style="color: var(--hosp-text-muted); font-size: 12px; line-height: 1.4;">
            ${escapeHtml(valuesStr)}
          </div>
        `;
      } else {
        prevCheckCard.textContent = 'No previous hospital checks recorded';
      }
    }

    // Toggle Clear Deferral button visibility
    const clearDefWrap = document.getElementById('dlcClearDeferralWrap');
    if (clearDefWrap) {
      const isDef = Boolean(d.isDeferred || (d.eligibility && d.eligibility.deferred));
      clearDefWrap.style.display = isDef ? 'block' : 'none';
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
        const nextDateStr = elig.next_eligible_date || d.nextEligibleDate || '';
        let formattedDate = nextDateStr;
        try {
          const nd = new Date(nextDateStr);
          if (!isNaN(nd.getTime())) {
            formattedDate = nd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        } catch (_) {}
        const daysLeft = elig.days_until_eligible || d.daysUntilEligible || 0;
        capNotice.textContent = `Next eligible on ${formattedDate} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'})`;
      }
    }

    // Total donations (Step 2)
    const totalEl = document.getElementById('dlcTotalDonations');
    if (totalEl) totalEl.textContent = d.totalDonations !== undefined ? d.totalDonations : 0;

    donorCard.style.display = 'block';

    // Unlock Clinical Vitals Panel
    if (vitalsFieldset) {
      vitalsFieldset.disabled = false;
      vitalsFieldset.style.opacity = '1';
    }
    if (vitalsDisabledHint) vitalsDisabledHint.style.display = 'none';
    if (btnDeferDonation) btnDeferDonation.disabled = false;

    // Prefill confirmed blood group
    const confirmedBg = document.getElementById('vitConfirmedBloodGroup');
    const donorBg = d.bloodType || d.bloodGroup || d.blood_type || 'O+';
    if (confirmedBg) {
      confirmedBg.value = donorBg;
    }
    const boxReason = document.getElementById('boxBloodGroupReason');
    const inputReason = document.getElementById('vitBloodGroupReason');
    if (boxReason) boxReason.style.display = 'none';
    if (inputReason) inputReason.value = '';
    if (confirmedBg) {
      confirmedBg.onchange = () => {
        const changed = confirmedBg.value !== donorBg;
        if (boxReason) boxReason.style.display = changed ? 'block' : 'none';
        evaluateVitals();
      };
    }

    // Donation volume defaults to 450
    const volumeSelect = document.getElementById('vitVolumeMl');
    if (volumeSelect) volumeSelect.value = '450';

    // Staff Name: default to logged-in staff member - NEVER hospital name
    const staffInput = document.getElementById('vitStaffName');
    if (staffInput) {
      staffInput.value = getLoggedInStaffName();
    }

    // ALL vitals fields start completely empty (Step 2 Rule 3: no prefilled weight or vitals)
    if (vitWeight) vitWeight.value = '';
    if (vitHb) vitHb.value = '';
    if (vitBpSystolic) vitBpSystolic.value = '';
    if (vitBpDiastolic) vitBpDiastolic.value = '';
    if (vitPulse) vitPulse.value = '';
    if (vitTemp) vitTemp.value = '';
    const notesInput = document.getElementById('vitNotes');
    if (notesInput) notesInput.value = '';

    // Clear all inline errors
    document.querySelectorAll('.vital-err').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });

    // Trigger evaluation
    evaluateVitals();
  }

  // Live input & blur evaluation on all vitals & staff name
  [vitWeight, vitHb, vitBpSystolic, vitBpDiastolic, vitPulse, vitTemp, document.getElementById('vitStaffName'), document.getElementById('vitBloodGroupReason')].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', evaluateVitals);
      inp.addEventListener('blur', evaluateVitals);
    }
  });
  const confBgSelect = document.getElementById('vitConfirmedBloodGroup');
  if (confBgSelect) confBgSelect.addEventListener('change', evaluateVitals);
  const volSelect = document.getElementById('vitVolumeMl');
  if (volSelect) volSelect.addEventListener('change', evaluateVitals);

  function evaluateVitals() {
    const reasonEl = document.getElementById('approveDisabledReason');
    const setDisabled = (reason) => {
      if (btnRecordDonation) btnRecordDonation.disabled = true;
      if (reasonEl) {
        reasonEl.textContent = reason || '';
        reasonEl.style.display = reason ? 'block' : 'none';
      }
    };

    const setEnabled = () => {
      if (btnRecordDonation) btnRecordDonation.disabled = false;
      if (reasonEl) {
        reasonEl.textContent = '';
        reasonEl.style.display = 'none';
      }
    };

    if (!currentLoadedDonor) {
      if (verdictBanner) verdictBanner.style.display = 'none';
      setDisabled('Look up a donor first');
      return;
    }

    if (btnDeferDonation) btnDeferDonation.disabled = false;

    // Helper to set field error
    const setFieldError = (errId, msg) => {
      const el = document.getElementById(errId);
      if (el) {
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
      }
    };

    const showVerdictFail = (msg) => {
      if (verdictBanner) {
        verdictBanner.style.display = 'block';
        verdictBanner.style.background = 'rgba(239, 68, 68, 0.12)';
        verdictBanner.style.border = '1px solid rgba(239, 68, 68, 0.35)';
        verdictBanner.style.color = '#fca5a5';
        if (verdictTitle) verdictTitle.textContent = 'Not Fit / Deferral Recommended';
        if (verdictIcon) {
          verdictIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        }
        if (verdictReasons) verdictReasons.textContent = msg;
      }
    };

    // Read raw inputs
    const rawW = vitWeight ? vitWeight.value.trim() : '';
    const rawHb = vitHb ? vitHb.value.trim() : '';
    const rawSys = vitBpSystolic ? vitBpSystolic.value.trim() : '';
    const rawDia = vitBpDiastolic ? vitBpDiastolic.value.trim() : '';
    const rawPul = vitPulse ? vitPulse.value.trim() : '';
    const rawTmp = vitTemp ? vitTemp.value.trim() : '';

    const wVal = parseFloat(rawW);
    const hbVal = parseFloat(rawHb);
    const sysVal = parseFloat(rawSys);
    const diaVal = parseFloat(rawDia);
    const pulVal = parseFloat(rawPul);
    const tmpVal = parseFloat(rawTmp);

    // Clear all inline errors initially
    ['errVitWeight', 'errVitHb', 'errVitBpSystolic', 'errVitBpDiastolic', 'errVitPulse', 'errVitTemp'].forEach(id => setFieldError(id, ''));

    // Check completeness: all required to approve
    if (!rawW || !rawHb || !rawSys || !rawDia || !rawPul || !rawTmp) {
      if (verdictBanner) verdictBanner.style.display = 'none';
      setDisabled('All clinical vitals are required to approve donation');
      return;
    }

    // Input fields & acceptable clinical ranges validation:
    // 1. Weight (kg, 45-200)
    if (isNaN(wVal) || wVal < 45 || wVal > 200) {
      const msg = (isNaN(wVal) || wVal < 45)
        ? `Weight ${rawW || ''} kg is below the required 45 kg minimum`
        : `Weight ${rawW || ''} kg exceeds the 200 kg maximum`;
      setFieldError('errVitWeight', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // 2. Hemoglobin (g/dL, 5-25, acceptable >= 12.5)
    if (isNaN(hbVal) || hbVal < 5 || hbVal > 25) {
      const msg = `Hemoglobin must be between 5 and 25 g/dL`;
      setFieldError('errVitHb', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (hbVal < 12.5) {
      const msg = `Hemoglobin ${hbVal} g/dL is below the required 12.5 g/dL`;
      setFieldError('errVitHb', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (hbVal > 20.0) {
      const msg = `Hemoglobin ${hbVal} g/dL exceeds safe limit (20.0 g/dL)`;
      setFieldError('errVitHb', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // 3. BP Systolic (70-220, acceptable 100-180)
    if (isNaN(sysVal) || sysVal < 70 || sysVal > 220) {
      const msg = `BP Systolic must be between 70 and 220 mmHg`;
      setFieldError('errVitBpSystolic', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (sysVal < 100 || sysVal > 180) {
      const msg = `Systolic BP ${sysVal} mmHg is outside acceptable range (100-180 mmHg)`;
      setFieldError('errVitBpSystolic', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // 4. BP Diastolic (40-130, acceptable 50-100)
    if (isNaN(diaVal) || diaVal < 40 || diaVal > 130) {
      const msg = `BP Diastolic must be between 40 and 130 mmHg`;
      setFieldError('errVitBpDiastolic', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (diaVal < 50 || diaVal > 100) {
      const msg = `Diastolic BP ${diaVal} mmHg is outside acceptable range (50-100 mmHg)`;
      setFieldError('errVitBpDiastolic', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // 5. Pulse (40-180 bpm, acceptable 50-100 bpm)
    if (isNaN(pulVal) || pulVal < 40 || pulVal > 180) {
      const msg = `Pulse must be between 40 and 180 bpm`;
      setFieldError('errVitPulse', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (pulVal < 50 || pulVal > 100) {
      const msg = `Pulse rate ${pulVal} bpm is outside acceptable range (50-100 bpm)`;
      setFieldError('errVitPulse', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // 6. Temperature (95-104 °F, acceptable 95.0-99.5 °F)
    if (isNaN(tmpVal) || tmpVal < 95 || tmpVal > 104) {
      const msg = `Temperature must be between 95 and 104 °F`;
      setFieldError('errVitTemp', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }
    if (tmpVal < 95.0 || tmpVal > 99.5) {
      const msg = `Temperature ${tmpVal} °F is outside acceptable range (95.0-99.5 °F)`;
      setFieldError('errVitTemp', msg);
      showVerdictFail(msg);
      setDisabled(msg);
      return;
    }

    // Doctor / Staff Name check
    const staffNameInp = document.getElementById('vitStaffName');
    if (!staffNameInp || !staffNameInp.value.trim()) {
      setDisabled('Doctor / Staff name is required');
      return;
    }

    // Blood group reason check if changed
    const boxReason = document.getElementById('boxBloodGroupReason');
    const inpReason = document.getElementById('vitBloodGroupReason');
    if (boxReason && boxReason.style.display !== 'none') {
      if (!inpReason || !inpReason.value.trim() || inpReason.value.trim().length < 3) {
        setDisabled('Reason is required when modifying blood group');
        return;
      }
    }

    // ALL VITALS WITHIN ACCEPTABLE RANGE!
    if (verdictBanner) {
      verdictBanner.style.display = 'block';
      verdictBanner.style.background = 'rgba(34, 197, 94, 0.12)';
      verdictBanner.style.border = '1px solid rgba(34, 197, 94, 0.35)';
      verdictBanner.style.color = '#86efac';
      if (verdictTitle) verdictTitle.textContent = 'Clinically Fit';
      if (verdictIcon) {
        verdictIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      }
      if (verdictReasons) {
        verdictReasons.textContent = `All vitals within normal clinical thresholds (Weight ${wVal} kg, Hb ${hbVal} g/dL, BP ${Math.round(sysVal)}/${Math.round(diaVal)}, Pulse ${Math.round(pulVal)} bpm, Temp ${tmpVal} °F).`;
      }
    }

    setEnabled();
  }

  function validateField(inputEl, errElId, rawStr, val, min, max, errMsg) {
    const errEl = document.getElementById(errElId);
    if (!errEl || !inputEl) return;
    if (!rawStr || rawStr === '') {
      errEl.textContent = '';
      errEl.style.display = 'none';
      return;
    }
    if (isNaN(val) || val < min || val > max) {
      errEl.textContent = errMsg;
      errEl.style.display = 'block';
    } else {
      errEl.textContent = '';
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
  const deferralReasonSelect = document.getElementById('deferralReasonSelect');
  const deferDurationSelect = document.getElementById('deferDurationSelect');
  const deferCustomDateWrap = document.getElementById('deferCustomDateWrap');
  const deferUntilInput = document.getElementById('deferUntilInput');
  const deferralReasonNotes = document.getElementById('deferralReasonInput');
  const btnConfirmDeferral = document.getElementById('btnConfirmDeferral');
  const btnCancelDeferral = document.getElementById('btnCancelDeferral');

  if (deferDurationSelect) {
    deferDurationSelect.addEventListener('change', () => {
      if (deferCustomDateWrap) {
        deferCustomDateWrap.style.display = (deferDurationSelect.value === 'custom') ? 'block' : 'none';
      }
    });
  }

  if (btnDeferDonation) {
    btnDeferDonation.addEventListener('click', () => {
      if (!currentLoadedDonor) return;
      if (deferUntilInput) deferUntilInput.value = '';
      if (deferCustomDateWrap) deferCustomDateWrap.style.display = 'none';
      if (deferDurationSelect) deferDurationSelect.value = '14';
      if (deferralReasonNotes) deferralReasonNotes.value = '';

      // Auto-detect matching deferral reason from failing field
      if (deferralReasonSelect) {
        const rawW = vitWeight ? parseFloat(vitWeight.value.trim()) : null;
        const rawHb = vitHb ? parseFloat(vitHb.value.trim()) : null;
        const rawSys = vitBpSystolic ? parseFloat(vitBpSystolic.value.trim()) : null;
        const rawDia = vitBpDiastolic ? parseFloat(vitBpDiastolic.value.trim()) : null;
        const rawPul = vitPulse ? parseFloat(vitPulse.value.trim()) : null;
        const rawTmp = vitTemp ? parseFloat(vitTemp.value.trim()) : null;

        if (rawHb != null && !isNaN(rawHb) && rawHb < 12.5) {
          deferralReasonSelect.value = 'Low Hemoglobin';
        } else if ((rawSys != null && (rawSys < 100 || rawSys > 180)) || (rawDia != null && (rawDia < 50 || rawDia > 100))) {
          deferralReasonSelect.value = 'High/Low BP';
        } else if (rawW != null && !isNaN(rawW) && rawW < 45) {
          deferralReasonSelect.value = 'Underweight';
        } else if (rawTmp != null && !isNaN(rawTmp) && (rawTmp < 95.0 || rawTmp > 99.5)) {
          deferralReasonSelect.value = 'High Temp';
        } else if (rawPul != null && !isNaN(rawPul) && (rawPul < 50 || rawPul > 100)) {
          deferralReasonSelect.value = 'Pulse Abnormal';
        } else {
          deferralReasonSelect.value = 'Staff Discretion';
        }
      }

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
      const selectedReason = deferralReasonSelect ? deferralReasonSelect.value : 'Staff Discretion';
      const notes = deferralReasonNotes ? deferralReasonNotes.value.trim() : '';
      const fullReason = notes ? `${selectedReason} - ${notes}` : selectedReason;

      let durationDays = 14;
      let deferUntilVal = null;
      if (deferDurationSelect) {
        if (deferDurationSelect.value === 'custom') {
          deferUntilVal = (deferUntilInput && deferUntilInput.value) ? deferUntilInput.value.trim() : null;
          if (!deferUntilVal) {
            alert('Please select a custom deferral date.');
            if (deferUntilInput) deferUntilInput.focus();
            return;
          }
        } else {
          durationDays = parseInt(deferDurationSelect.value, 10) || 14;
        }
      }

      try {
        const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const staffNameInput = document.getElementById('vitStaffName');
        const staffName = (staffNameInput && staffNameInput.value.trim()) || getLoggedInStaffName();

        const vitalsData = {};
        if (vitWeight && vitWeight.value) vitalsData.weight = parseFloat(vitWeight.value);
        if (vitHb && vitHb.value) vitalsData.hemoglobin = parseFloat(vitHb.value);
        if (vitBpSystolic && vitBpSystolic.value) vitalsData.systolic = parseFloat(vitBpSystolic.value);
        if (vitBpDiastolic && vitBpDiastolic.value) vitalsData.diastolic = parseFloat(vitBpDiastolic.value);
        if (vitPulse && vitPulse.value) vitalsData.pulse = parseInt(vitPulse.value, 10);
        if (vitTemp && vitTemp.value) vitalsData.temperature = parseFloat(vitTemp.value);

        const res = await fetch('/api/hospital/donors/defer', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            donorId: currentLoadedDonor.donorId || currentLoadedDonor.id,
            reason: selectedReason,
            durationDays: durationDays,
            deferUntil: deferUntilVal,
            staffUser: staffName,
            vitals: Object.keys(vitalsData).length > 0 ? vitalsData : null
          }),
          credentials: 'include'
        });

        if (deferModal) deferModal.style.display = 'none';

        if (res.ok) {
          if (typeof showToast === 'function') {
            showToast(`Donor ${currentLoadedDonor.name} deferred for ${durationDays} days.`, 'info');
          } else {
            alert(`Donor ${currentLoadedDonor.name} deferred for ${durationDays} days.`);
          }
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

  // Part 6 Step 3 Item 4: Clear donor deferral handler
  const btnClearDonorDeferral = document.getElementById('btnClearDonorDeferral');
  if (btnClearDonorDeferral) {
    btnClearDonorDeferral.addEventListener('click', async () => {
      if (!currentLoadedDonor) return;
      const donorName = currentLoadedDonor.name || 'this donor';
      if (!confirm(`Are you sure you want to lift the hospital deferral for ${donorName}?`)) return;

      try {
        const token = (typeof Store !== 'undefined' ? Store.get('hospitalToken') : null) || localStorage.getItem('red404_hospitalToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const staffName = getLoggedInStaffName();
        const res = await fetch('/api/hospital/donors/clear-deferral', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            donorId: currentLoadedDonor.donorId || currentLoadedDonor.id,
            staffUser: staffName
          }),
          credentials: 'include'
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (typeof showToast === 'function') {
            showToast(`Deferral lifted for ${donorName}. Donor notified.`, 'success');
          } else {
            alert(`Deferral lifted for ${donorName}. Donor has been notified.`);
          }
          // Refresh check-in lookup
          const qId = currentLoadedDonor.donorId || currentLoadedDonor.id;
          fetchDonorDetails(qId);
        } else {
          alert('Failed to clear deferral: ' + (data.message || 'Server error'));
        }
      } catch (err) {
        alert('Network error clearing deferral: ' + err.message);
      }
    });
  }

  // Approve donation submit (Part 5 & Part 6 & Step 2)
  if (vitalsForm) {
    vitalsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentLoadedDonor) return;

      evaluateVitals();
      if (btnRecordDonation && btnRecordDonation.disabled) {
        return;
      }

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
      const staffUser = (staffInput && staffInput.value.trim()) || getLoggedInStaffName();

      const notesInput = document.getElementById('vitNotes');
      const notes = notesInput ? notesInput.value.trim() : '';

      const donorName = currentLoadedDonor.name || 'Verified Donor';
      const targetDonorCopy = Object.assign({}, currentLoadedDonor);

      const proceedWithApproval = async () => {
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
            donorId: targetDonorCopy.donorId || targetDonorCopy.id,
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
              btnRecordDonation.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Approve donation</span>
              `;
            }
            return;
          }

          // Show success toast
          if (typeof showToast === 'function') {
            showToast(`Donation recorded! +1 unit ${confirmedBg} added to inventory.`, 'success', 3500);
          }

          // Update local inventory display immediately
          if (typeof initInventory === 'function') {
            try { initInventory(); } catch (_) {}
          }
          if (typeof loadHospitalInventory === 'function') {
            try { loadHospitalInventory(); } catch (_) {}
          }

          // Reset check-in form and loaded donor state (Part 2, Requirement 2)
          resetCheckinForm(false, true);

          // Reset Approve donation button text (no stuck "Recording donation...")
          if (btnRecordDonation) {
            btnRecordDonation.disabled = true;
            btnRecordDonation.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Approve donation</span>
            `;
          }

          // Hide vitals form and donor card so ONLY success state is visible
          if (donorCard) donorCard.style.display = 'none';
          if (formDonorVitals) formDonorVitals.style.display = 'none';

          // Show ONLY success card
          if (successCard) {
            successCard.style.display = 'block';
            if (successTitle) {
              successTitle.textContent = `Donation Verified & Approved (${confirmedBg}, ${volumeMl} mL)`;
            }
            if (successMsg) {
              successMsg.textContent = `Donor ${donorName} (${targetDonorCopy.donorId || targetDonorCopy.id}) recorded successfully. +1 unit ${confirmedBg} added to inventory.`;
            }
          }

        } catch (err) {
          alert('Network error while saving donation record: ' + err.message);
          if (btnRecordDonation) {
            btnRecordDonation.disabled = false;
            btnRecordDonation.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Approve donation</span>
            `;
          }
        }
      };

      // Part 2 Requirement 4: In-app styled confirmation modal
      const modal = document.getElementById('modalConfirmDonationApproval');
      const modalText = document.getElementById('confirmDonationModalText');
      const btnConfirmModal = document.getElementById('btnConfirmDonationAction');
      const btnCancelModal = document.getElementById('btnCancelDonationModal');

      if (modal && modalText && btnConfirmModal && btnCancelModal) {
        modalText.innerHTML = `Record <strong>${volumeMl} mL</strong> blood donation for <strong>${escapeHtml(donorName)}</strong> (${escapeHtml(confirmedBg)})?<br><span style="font-size:12.5px;color:#94a3b8;display:block;margin-top:6px;">Hospital inventory will immediately increase by 1 unit.</span>`;
        modal.style.display = 'flex';

        const onConfirm = () => {
          modal.style.display = 'none';
          btnConfirmModal.removeEventListener('click', onConfirm);
          btnCancelModal.removeEventListener('click', onCancel);
          proceedWithApproval();
        };
        const onCancel = () => {
          modal.style.display = 'none';
          btnConfirmModal.removeEventListener('click', onConfirm);
          btnCancelModal.removeEventListener('click', onCancel);
        };
        btnConfirmModal.addEventListener('click', onConfirm);
        btnCancelModal.addEventListener('click', onCancel);
      } else {
        // Fallback if modal container not in DOM
        if (window.confirm(`Record ${volumeMl} mL donation for ${donorName} (${confirmedBg})? Inventory will increase by 1 unit.`)) {
          proceedWithApproval();
        }
      }
    });
  }

  // Next donor button (Part 2, Requirement 2)
  if (btnNextDonor) {
    btnNextDonor.addEventListener('click', () => {
      resetCheckinForm(false, false);
      if (formDonorVitals) formDonorVitals.style.display = '';
      if (successCard) successCard.style.display = 'none';
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

/* ============================================================
   FIRST-LOGIN CHECKLIST (VERIFIED DASHBOARD ONBOARDING)
   ============================================================ */
function initFirstLoginChecklist(profile) {
  const card = document.getElementById('cardFirstLoginChecklist');
  if (!card) return;

  const dismissed = sessionStorage.getItem('red404_checklist_dismissed');
  if (dismissed === 'true') {
    card.style.display = 'none';
    return;
  }

  // Check 1: Stock
  const stockEl = document.getElementById('statusStockStep');
  const hasStock = (window.currentHospitalStockUnits && window.currentHospitalStockUnits > 0);
  if (stockEl) {
    stockEl.textContent = hasStock ? 'Units recorded' : 'Needs initial units';
    stockEl.style.color = hasStock ? '#16a34a' : 'var(--text-tertiary)';
  }

  // Check 2: Location
  const locEl = document.getElementById('statusLocationStep');
  const hasLoc = profile && profile.latitude && profile.longitude;
  if (locEl) {
    locEl.textContent = hasLoc ? 'Location verified' : 'Pin entrance on map';
    locEl.style.color = hasLoc ? '#16a34a' : 'var(--text-tertiary)';
  }

  // Check 3: Emergency number
  const emEl = document.getElementById('statusEmergencyStep');
  const hasEm = profile && profile.emergencyContact && profile.emergencyContact.trim().length >= 10;
  if (emEl) {
    emEl.textContent = hasEm ? profile.emergencyContact : 'Add 24x7 helpline';
    emEl.style.color = hasEm ? '#16a34a' : 'var(--text-tertiary)';
  }

  card.style.display = 'block';

  const btnDismiss = document.getElementById('btnDismissChecklist');
  if (btnDismiss) {
    btnDismiss.onclick = () => {
      sessionStorage.setItem('red404_checklist_dismissed', 'true');
      card.style.display = 'none';
    };
  }
}


