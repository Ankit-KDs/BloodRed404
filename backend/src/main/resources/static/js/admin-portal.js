/**
 * RED404 — MASTER ADMIN PORTAL JAVASCRIPT
 * Tab-Based Navigation, Real-Time Java Injection, Zero Mock Data
 */

(function initAdminPortal() {
  'use strict';

  // State cache
  let allDonors = [];
  let allHospitals = [];
  let allFeedback = [];
  let allIssues = [];

  document.addEventListener('DOMContentLoaded', () => {
    initAuthGuard();
    initTabNavigation();
    initSearchFilters();
    initControls();
    initHospitalSubtabs();
    initAdminEventStream();
    // Initial active tab load
    loadTabContent('tab-donors');
    // Background health check
    loadSystemHealth();
  });

  /* ==================== 1. AUTH GUARD ==================== */
  async function initAuthGuard() {
    if (window.Red404Security) window.Red404Security.init('ADMIN');
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Accept': 'application/json', 'X-Red404-Role': 'ADMIN' },
        credentials: 'include'
      });
      if (res.status === 401) {
        // Explicitly unauthorized by server, return to login
        sessionStorage.removeItem('admin_session');
        sessionStorage.removeItem('red404_super_admin');
        sessionStorage.removeItem('red404_admin_token');
        localStorage.removeItem('admin_session');
        window.location.replace('donor-login.html');
      }
    } catch (_) {
      // Backend unreachable or offline - do not purge on network hiccup
    }
  }

  /* ==================== 2. TAB NAVIGATION ==================== */
  function initTabNavigation() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabPanels = document.querySelectorAll('.admin-tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        // Toggle button states
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle panel visibility
        tabPanels.forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(targetTab);
        if (activePanel) {
          activePanel.classList.add('active');
        }

        // Fetch & inject live data for selected tab
        loadTabContent(targetTab);
      });
    });
  }

  function loadTabContent(tabId) {
    switch (tabId) {
      case 'tab-donors':
        loadDonors();
        break;
      case 'tab-hospitals':
        loadHospitals();
        break;
      case 'tab-feedback':
        loadFeedback();
        break;
      case 'tab-issues':
        loadIssues();
        break;
      case 'tab-health':
        loadSystemHealth();
        loadActivityLogs();
        break;
      default:
        break;
    }
  }

  /* ==================== 3. TAB 1: DONORS ==================== */
  let currentProfileDonorId = null;

  async function loadDonors() {
    const tbody = document.getElementById('donor-table-body');
    const badge = document.getElementById('donor-count-badge');
    if (!tbody) return;

    try {
      const res = await fetch('/api/admin/donors');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      allDonors = Array.isArray(json.data) ? json.data : [];

      if (badge) badge.textContent = allDonors.length;
      renderDonorsTable(allDonors);
    } catch (err) {
      console.warn('Notice loading donors:', err);
      renderEmptyTable(tbody, 6, 'No registered donors found in MySQL database.');
      if (badge) badge.textContent = '0';
    }
  }

  function renderDonorsTable(donors) {
    const tbody = document.getElementById('donor-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Clean up any detached kebab dropdowns from previous render
    document.querySelectorAll('body > .kebab-dropdown').forEach(el => el.remove());

    if (!donors || donors.length === 0) {
      renderEmptyTable(tbody, 6, 'No registered donors found.');
      return;
    }

    donors.forEach(d => {
      const tr = document.createElement('tr');
      const isSuspended = (d.status || '').toLowerCase() === 'suspended';

      // Status Badge: '🟢 Active', '🟡 Standby', '🔴 Suspended'
      let statusClass = 'active';
      let statusLabel = '🟢 Active';
      const rawStatus = (d.status || '').toLowerCase();
      if (rawStatus === 'suspended' || rawStatus === 'inactive') {
        statusClass = 'suspended';
        statusLabel = '🔴 Suspended';
      } else if (rawStatus === 'standby' || rawStatus === 'busy' || rawStatus === 'pending') {
        statusClass = 'standby';
        statusLabel = '🟡 Standby';
      } else {
        statusClass = 'active';
        statusLabel = '🟢 Active';
      }

      // Format Zone cleanly without "Zone Zone"
      let zoneDisplay = d.zone || 'Location not shared';
      if (zoneDisplay && !zoneDisplay.startsWith('Zone') && zoneDisplay !== 'Location not shared') {
        zoneDisplay = 'Zone ' + zoneDisplay;
      }
      const registeredCity = d.registeredCity || (d.city ? `${d.city}${d.state ? ', ' + d.state : ''}` : 'Not provided');
      const lastSeen = d.lastSeenLocationTime || (d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : 'Location not shared');

      tr.innerHTML = `
        <!-- Column 1: Smart ID & Burned-ID Privacy -->
        <td>
          <div class="smart-id-cell">
            <span class="smart-id-tag">${escapeHtml(d.smartId || '-')}</span>
            <div class="donor-name-reveal-wrap">
              <span class="real-name-hidden" id="donor-name-${d.id}" data-masked="true" data-name="${escapeHtml(d.name || 'Anonymous')}">***</span>
              <button type="button" class="btn-reveal-name" onclick="window.toggleRevealName(${d.id})" title="Reveal Real Name">
                <i class="fas fa-eye" id="reveal-icon-${d.id}"></i>
              </button>
            </div>
          </div>
        </td>

        <!-- Column 2: Blood Group -->
        <td>
          <span class="blood-type-tag">${escapeHtml(d.bloodGroup || d.bloodType || '-')}</span>
        </td>

        <!-- Column 3: Registered City & Last Seen -->
        <td>
          <div class="donor-zone-cell" style="display: flex; flex-direction: column; gap: 3px;">
            <span class="donor-city-val" style="font-size: 13px; color: #f8fafc;"><strong style="color: #94a3b8; font-size: 11px; text-transform: uppercase;">Registered:</strong> ${escapeHtml(registeredCity)}</span>
            <span class="donor-subzone-val" style="font-size: 12px; color: #94a3b8;"><strong style="color: #38bdf8; font-size: 11px; text-transform: uppercase;">Last Seen:</strong> ${escapeHtml(zoneDisplay !== 'Location not shared' ? zoneDisplay + ' • ' : '')}${escapeHtml(lastSeen)}</span>
          </div>
        </td>

        <!-- Column 4: Total Donations -->
        <td style="font-family: var(--admin-font-mono); font-weight: 600; color: #ffffff;">
          ${Number(d.totalDonations || 0)}
        </td>

        <!-- Column 5: Status (Direct Interactive Clickable Toggle) -->
        <td>
          <button type="button" 
                  class="status-badge-btn status-badge-${statusClass}" 
                  onclick="window.toggleDonor(${d.id})" 
                  title="Click to toggle status between Active and Suspended">
            <span class="status-badge-text">${statusLabel}</span>
            <i class="fas fa-arrows-rotate status-toggle-icon"></i>
          </button>
        </td>

        <!-- Column 6: Actions (Direct Profile Button + Direct Delete Button + Kebab Menu) -->
        <td>
          <div class="admin-actions-cell">
            <button type="button" class="btn-view-profile" onclick="window.viewDonorProfile(${d.id})" title="View Full Dossier">
              <i class="fas fa-id-card"></i>
              <span>Profile</span>
            </button>
            <button type="button" class="btn-delete-donor" onclick="window.deleteDonorAccount(${d.id}, '${escapeHtml(d.name || 'this donor')}')" title="Permanently Delete Donor">
              <i class="fas fa-trash-can"></i>
              <span>Delete</span>
            </button>
            <div class="kebab-menu-wrap">
              <button type="button" class="admin-kebab-btn" onclick="window.toggleKebabMenu(event, ${d.id})" title="More Actions">
                <i class="fas fa-ellipsis-vertical"></i>
              </button>
              <div class="kebab-dropdown" id="kebab-menu-${d.id}">
                <button type="button" class="kebab-dropdown-item" onclick="window.viewDonorProfile(${d.id})">
                  <i class="fas fa-id-card"></i>
                  <span>View Full Profile</span>
                </button>
                <button type="button" class="kebab-dropdown-item ${isSuspended ? 'kebab-item-reactivate' : 'kebab-item-suspend'}" onclick="window.toggleDonor(${d.id})">
                  <i class="fas fa-${isSuspended ? 'shield-check' : 'ban'}"></i>
                  <span>${isSuspended ? 'Set to Active' : 'Set to Suspended'}</span>
                </button>
                <button type="button" class="kebab-dropdown-item kebab-item-delete" onclick="window.deleteDonorAccount(${d.id}, '${escapeHtml(d.name || 'this donor')}')">
                  <i class="fas fa-trash-can"></i>
                  <span>Delete Account</span>
                </button>
              </div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* Privacy-First Name Reveal Toggle */
  window.toggleRevealName = function (donorId) {
    const nameEl = document.getElementById(`donor-name-${donorId}`);
    const iconEl = document.getElementById(`reveal-icon-${donorId}`);
    if (!nameEl) return;

    const isMasked = nameEl.getAttribute('data-masked') === 'true';
    const realName = nameEl.getAttribute('data-name') || 'Anonymous';

    if (isMasked) {
      nameEl.textContent = realName;
      nameEl.className = 'real-name-revealed';
      nameEl.setAttribute('data-masked', 'false');
      if (iconEl) iconEl.className = 'fas fa-eye-slash';
    } else {
      nameEl.textContent = '***';
      nameEl.className = 'real-name-hidden';
      nameEl.setAttribute('data-masked', 'true');
      if (iconEl) iconEl.className = 'fas fa-eye';
    }
  };

  /* Three Dots (Kebab) Dropdown Toggle - Fixed Positioning to Never Clip */
  window.toggleKebabMenu = function (event, donorId) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const btn = (event && event.currentTarget) || (event && event.target && event.target.closest('.admin-kebab-btn'));
    const targetMenu = document.getElementById(`kebab-menu-${donorId}`);
    if (!targetMenu) return;

    const isAlreadyOpen = targetMenu.classList.contains('show');
    // Close any other open menus
    document.querySelectorAll('.kebab-dropdown.show').forEach(m => {
      m.classList.remove('show');
    });

    if (!isAlreadyOpen && btn) {
      // Move to body if needed so NO parent backdrop-filter or overflow-x can clip it
      if (targetMenu.parentElement !== document.body) {
        document.body.appendChild(targetMenu);
      }
      const rect = btn.getBoundingClientRect();
      const openUpwards = (window.innerHeight - rect.bottom) < 160;
      targetMenu.style.position = 'fixed';
      targetMenu.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
      targetMenu.style.top = openUpwards ? (rect.top - 142) + 'px' : (rect.bottom + 6) + 'px';
      targetMenu.style.zIndex = '999999';
      targetMenu.classList.add('show');
    }
  };

  /* Global click listener to close kebab menus on click outside */
  document.addEventListener('click', e => {
    if (!e.target.closest('.kebab-menu-wrap') && !e.target.closest('.kebab-dropdown')) {
      document.querySelectorAll('.kebab-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
      });
    }
  });

  /* Calculate Age from DOB string */
  function calcAge(dobStr) {
    if (!dobStr) return null;
    const birthDate = new Date(dobStr);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? age : null;
  }

  /* Populate all fields in the comprehensive donor profile modal */
  function populateDonorProfileModal(donor) {
    if (!donor) return;
    const setSpan = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val && String(val).trim()) ? val : '-';
    };

    // 1. Identity & Demographics
    setSpan('modal-donor-smart-id', donor.smartId);
    setSpan('modal-donor-name', donor.name);
    setSpan('modal-donor-father-name', donor.fatherName || 'Not recorded');

    let genderDobAge = (donor.gender || '-');
    if (donor.dob) {
      const age = calcAge(donor.dob);
      genderDobAge += (age ? ` • ${age} yrs` : '') + ` (${donor.dob})`;
    }
    setSpan('modal-donor-dob-age', genderDobAge);
    setSpan('modal-donor-blood-group', donor.bloodGroup);
    setSpan('modal-donor-type', donor.donorType || 'Regular LifeSaver');

    // 2. Communication & Contact
    setSpan('modal-donor-email', donor.email);
    setSpan('modal-donor-phone', donor.phone);
    setSpan('modal-donor-status', donor.status || 'Active');

    // 3. Spatial Routing & Location
    setSpan('modal-donor-address', donor.address || 'Address Not Recorded');
    const registeredCity = donor.registeredCity || (donor.city ? `${donor.city}${donor.state ? ', ' + donor.state : ''}${donor.pincode ? ' - ' + donor.pincode : ''}` : 'Not provided');
    setSpan('modal-donor-city-state-pin', registeredCity);

    let zoneDisplay = donor.zone || 'Location not shared';
    if (zoneDisplay && !zoneDisplay.startsWith('Zone') && zoneDisplay !== 'Location not shared') {
      zoneDisplay = 'Zone ' + zoneDisplay;
    }
    const lastSeen = donor.lastSeenLocationTime || (donor.latitude && donor.longitude ? `${donor.latitude}, ${donor.longitude}` : 'Location not shared');
    setSpan('modal-donor-zone-coords', `${zoneDisplay} • Last seen: ${lastSeen}`);

    // 4. Clinical Health Screening
    setSpan('modal-donor-weight', donor.weight ? donor.weight + ' kg' : 'Not recorded');
    setSpan('modal-donor-allergies', donor.allergies || 'None declared');
    setSpan('modal-donor-conditions', donor.conditions || 'None declared');
    setSpan('modal-donor-medications', donor.medications || 'None declared');
    setSpan('modal-donor-surgeries', donor.surgeries || 'None declared');

    // 5. Lifesaving Impact & History
    setSpan('modal-donor-total-donations', `${Number(donor.totalDonations || 0)} Successful Rescues`);
    setSpan('modal-donor-last-donation', donor.lastDonation || 'No donation recorded yet');
    setSpan('modal-donor-created-at', formatTimestamp(donor.createdAt));
  }

  /* View Donor Profile Modal - Immediately fetches 100% fresh live DB data */
  window.viewDonorProfile = async function (donorId) {
    document.querySelectorAll('.kebab-dropdown.show').forEach(menu => menu.classList.remove('show'));

    currentProfileDonorId = donorId;

    // First populate from cache for instant display
    const cached = allDonors.find(d => d.id === donorId);
    if (cached) {
      populateDonorProfileModal(cached);
    }

    const modal = document.getElementById('donorProfileModal');
    if (modal) {
      modal.style.display = 'flex';
    }

    // Immediately fetch 100% fresh, real-time data from database
    try {
      const res = await fetch(`/api/admin/donors/${donorId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          populateDonorProfileModal(json.data);
          // Sync cache
          const idx = allDonors.findIndex(item => item.id === donorId);
          if (idx !== -1) allDonors[idx] = Object.assign(allDonors[idx], json.data);
        }
      }
    } catch (err) {
      console.warn('Notice fetching fresh donor profile:', err);
    }
  };

  /* Sync Live Button inside Profile Modal */
  window.refreshCurrentDonorProfile = async function () {
    if (!currentProfileDonorId) return;

    const btn = document.getElementById('btnRefreshDonorProfile');
    const icon = btn?.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
      const res = await fetch(`/api/admin/donors/${currentProfileDonorId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          populateDonorProfileModal(json.data);
          // Sync cache
          const idx = allDonors.findIndex(item => item.id === currentProfileDonorId);
          if (idx !== -1) allDonors[idx] = Object.assign(allDonors[idx], json.data);
          showToast('Donor profile synced live with database', 'info', 1500);
        }
      }
    } catch (_) {
      showToast('Connection error syncing profile', 'error');
    } finally {
      if (icon) icon.classList.remove('fa-spin');
    }
  };

  window.closeDonorProfileModal = function () {
    const modal = document.getElementById('donorProfileModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentProfileDonorId = null;
  };

  /* Send Password Reset Link */
  window.handleSendPasswordReset = async function () {
    if (!currentProfileDonorId) return;

    const btn = document.getElementById('btnSendPasswordReset');
    const btnText = btn?.querySelector('.btn-reset-text');
    const btnLoader = btn?.querySelector('.btn-reset-loader');

    if (btn) btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline-flex';

    try {
      const res = await fetch(`/api/admin/donors/${currentProfileDonorId}/reset-password-link`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast(data.message || 'Password reset link sent to donor’s registered email', 'success', 3500);
        setTimeout(() => {
          closeDonorProfileModal();
        }, 900);
      } else {
        showToast(data.message || 'Failed to dispatch password reset link', 'error');
      }
    } catch (err) {
      showToast('Network error while dispatching password reset link', 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  };

  /* Delete Donor from Profile Modal */
  window.handleDeleteFromModal = async function () {
    if (!currentProfileDonorId) return;
    const donor = allDonors.find(d => d.id === currentProfileDonorId);
    const donorName = donor ? donor.name : 'this donor';
    const did = currentProfileDonorId;
    closeDonorProfileModal();
    await window.deleteDonorAccount(did, donorName);
  };

  window.toggleDonor = async function (donorId) {
    if (!donorId) return;
    document.querySelectorAll('.kebab-dropdown.show').forEach(menu => menu.classList.remove('show'));

    try {
      const res = await fetch(`/api/admin/donors/${donorId}/toggle-status`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Donor status updated', 'success');
        // Update donor in cache immediately
        const newStatus = data.data?.newStatus || 'Active';
        const d = allDonors.find(item => item.id === donorId);
        if (d) {
          d.status = newStatus;
          d.availability = newStatus;
        }
        renderDonorsTable(allDonors);
      } else {
        showToast(data.message || 'Failed to update donor status', 'error');
      }
    } catch (err) {
      showToast('Connection error updating donor', 'error');
    }
  };

  /* DELETE DONOR ACCOUNT - requires double confirmation */
  window.deleteDonorAccount = async function (donorId, donorName) {
    if (!donorId) return;
    document.querySelectorAll('.kebab-dropdown.show').forEach(menu => menu.classList.remove('show'));

    // First confirmation
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETE\n\nYou are about to permanently delete the account of:\n"${donorName}"\n\nThis action CANNOT be undone. All donation history and profile data will be erased.\n\nClick OK to continue to final confirmation, or Cancel to abort.`
    );
    if (!confirmed) {
      showToast('Delete cancelled.', 'info', 2000);
      return;
    }

    // Second confirmation (type-to-confirm style)
    const typedConfirm = window.prompt(
      `Final confirmation required.\n\nType  DELETE  (all caps) to permanently delete this donor account.`
    );
    if (!typedConfirm || typedConfirm.trim() !== 'DELETE') {
      showToast('Delete aborted. You must type DELETE exactly to confirm.', 'error', 3000);
      return;
    }

    try {
      showToast('Deleting donor account...', 'info', 2000);
      const res = await fetch(`/api/admin/donors/${donorId}/delete`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Donor "${donorName}" account permanently deleted.`, 'success', 4000);
        // Remove from local cache and re-render
        allDonors = allDonors.filter(item => item.id !== donorId);
        const badge = document.getElementById('donor-count-badge');
        if (badge) badge.textContent = allDonors.length;
        renderDonorsTable(allDonors);
      } else {
        showToast(data.message || 'Failed to delete donor account.', 'error');
      }
    } catch (err) {
      showToast('Connection error while deleting donor account.', 'error');
    }
  };

  /* ==================== 4. TAB 2: HOSPITALS ==================== */
  let hospActiveStatusTab = 'pending_review';
  let hospCounts = { pending_review: 0, needs_info: 0, verified: 0, rejected: 0, suspended: 0, all: 0 };
  let currentProfileHospitalId = null;
  let currentActionTargetStatus = null;
  let deleteTargetHospId = null;
  let deleteTargetHospName = '';
  let modalHospMap = null;
  let modalHospMarker = null;

  function initHospitalSubtabs() {
    const subtabs = document.querySelectorAll('#hosp-status-subtabs button[data-status]');
    subtabs.forEach(btn => {
      btn.addEventListener('click', () => {
        subtabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hospActiveStatusTab = btn.getAttribute('data-status') || 'pending_review';
        loadHospitals();
      });
    });
  }

  function updateSubtabBadges(counts) {
    if (!counts) return;
    const setBadge = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val != null ? val : 0);
    };

    setBadge('count-hosp-pending', counts.pending_review);
    setBadge('count-hosp-needs-info', counts.needs_info);
    setBadge('count-hosp-verified', counts.verified);
    setBadge('count-hosp-rejected', counts.rejected);
    setBadge('count-hosp-suspended', counts.suspended);
    setBadge('count-hosp-all', counts.all);

    // Nav pending badge
    const navPendingBadge = document.getElementById('nav-hosp-pending-badge');
    if (navPendingBadge) {
      const pendingCount = counts.pending_review || 0;
      if (pendingCount > 0) {
        navPendingBadge.textContent = String(pendingCount);
        navPendingBadge.style.display = 'inline-block';
      } else {
        navPendingBadge.style.display = 'none';
      }
    }

    // Header count badge
    const headerBadge = document.getElementById('hospital-count-badge');
    if (headerBadge) {
      const activeCount = counts[hospActiveStatusTab] != null ? counts[hospActiveStatusTab] : (counts.all || 0);
      headerBadge.textContent = String(activeCount);
    }
  }

  async function loadHospitals(isManual = false) {
    const tbody = document.getElementById('hospital-table-body');
    const syncBtn = document.getElementById('btnSyncHospitals');
    if (isManual && syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    try {
      const url = `/api/admin/hospitals?status=${encodeURIComponent(hospActiveStatusTab)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      const data = json.data || {};
      if (data.counts) {
        hospCounts = data.counts;
        updateSubtabBadges(hospCounts);
      }

      allHospitals = Array.isArray(data.hospitals) ? data.hospitals : (Array.isArray(data) ? data : []);

      const lastUpdatedEl = document.getElementById('hosp-last-updated');
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      }

      filterAndRenderHospitals();
      if (isManual) {
        showToast('Hospital records synced live from database.', 'success');
      }
    } catch (err) {
      console.warn('Notice loading hospitals:', err);
      if (tbody) renderEmptyTable(tbody, 9, 'Unable to load hospitals. Check server connection.');
      if (isManual) {
        showToast('Failed to sync hospitals from database.', 'error');
      }
    } finally {
      if (isManual && syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i> Sync';
      }
    }
  }

  function filterAndRenderHospitals() {
    const searchInput = document.getElementById('hospitalSearchInput');
    const q = (searchInput?.value || '').trim().toLowerCase();

    let list = allHospitals.slice();

    if (q) {
      list = list.filter(h => {
        const name = (h.name || h.hospitalName || '').toLowerCase();
        const city = (h.city || h.location || '').toLowerCase();
        const reg = (h.registrationNo || '').toLowerCase();
        const lic = (h.bloodBankLicense || '').toLowerCase();
        const email = (h.email || h.hospitalEmail || '').toLowerCase();
        const type = (h.type || h.hospitalType || '').toLowerCase();
        return name.includes(q) || city.includes(q) || reg.includes(q) || lic.includes(q) || email.includes(q) || type.includes(q);
      });
    }

    // Sort: if pending_review, sort oldest first (createdAt ASC)
    if (hospActiveStatusTab === 'pending_review') {
      list.sort((a, b) => {
        const tA = new Date(a.createdAt || a.submittedTime || 0).getTime();
        const tB = new Date(b.createdAt || b.submittedTime || 0).getTime();
        return tA - tB;
      });
    } else {
      list.sort((a, b) => {
        const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tB - tA;
      });
    }

    renderHospitalsTable(list);
  }

  function getStatusMeta(statusRaw) {
    const s = (statusRaw || 'pending_review').toLowerCase().trim();
    switch (s) {
      case 'verified':
        return { label: 'Verified', cls: 'verified', icon: 'circle-check' };
      case 'needs_info':
        return { label: 'Needs Info', cls: 'needs-info', icon: 'circle-question' };
      case 'rejected':
        return { label: 'Rejected', cls: 'rejected', icon: 'ban' };
      case 'suspended':
        return { label: 'Suspended', cls: 'suspended', icon: 'pause' };
      case 'pending_review':
      default:
        return { label: 'Pending Review', cls: 'pending', icon: 'clock' };
    }
  }

  function renderHospitalsTable(hospitals) {
    const tbody = document.getElementById('hospital-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!hospitals || hospitals.length === 0) {
      renderEmptyTable(tbody, 9, 'No hospitals found for this status.');
      return;
    }

    hospitals.forEach(h => {
      const tr = document.createElement('tr');
      const meta = getStatusMeta(h.verificationStatus || h.status);
      const isVerified = (h.verificationStatus || h.status || '').toLowerCase() === 'verified';
      const safeHospName = (h.name || h.hospitalName || 'Hospital').replace(/'/g, "\\'");

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: #f8fafc; font-size: 14px;">${escapeHtml(h.name || h.hospitalName || '-')}</div>
          <div style="font-size: 12px; color: var(--admin-text-muted); margin-top: 2px;">
            <i class="fas fa-location-dot" style="font-size: 11px;"></i> ${escapeHtml(h.location || h.city || 'Location Not Specified')}
          </div>
        </td>
        <td style="font-size: 13px; color: #cbd5e1;">
          ${escapeHtml(h.type || h.hospitalType || 'Facility')}
        </td>
        <td style="font-size: 12px; color: #94a3b8;" title="${escapeHtml(String(h.createdAt || h.submittedTime || ''))}">
          ${formatRelativeTime(h.createdAt || h.submittedTime)}
        </td>
        <td>
          <span class="hosp-status-pill hosp-status-${meta.cls}">
            <i class="fas fa-${meta.icon}"></i> ${escapeHtml(meta.label)}
          </span>
        </td>
        <td style="font-size: 13px; color: #cbd5e1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(h.email || h.hospitalEmail || '-')}</span>
            <i class="fas fa-circle-check" style="color: #4ade80; font-size: 12px;" title="Official Email Verified"></i>
          </div>
        </td>
        <td style="font-size: 13px; color: #cbd5e1;">
          <span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
            <i class="fas fa-file-lines" style="color: #94a3b8; font-size: 11px;"></i>
            <span>${h.documentsCount != null ? h.documentsCount : 0} docs</span>
          </span>
        </td>
        <td style="font-size: 13px; color: #f8fafc; font-family: var(--admin-font-mono);">
          ${isVerified ? escapeHtml(h.stockSummary || '0 Units') : '<span style="color: var(--admin-text-muted);">—</span>'}
        </td>
        <td style="font-size: 12px; color: #94a3b8;" title="${escapeHtml(String(h.updatedAt || h.createdAt || ''))}">
          ${formatRelativeTime(h.updatedAt || h.createdAt)}
        </td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <button type="button" class="admin-action-btn" onclick="window.viewHospitalDetails(${h.id})" title="Review Hospital Application & Facility Dossier">
              <i class="fas fa-eye"></i> Details
            </button>
            <button type="button" class="admin-action-btn btn-danger-action" onclick="window.openDeleteHospModal(${h.id}, '${safeHospName}')" title="Delete Hospital">
              <i class="fas fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* Populate all fields in the 7 plain sections of the comprehensive dossier */
  function populateHospitalProfileModal(hosp) {
    if (!hosp) return;
    const setSpan = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val !== null && val !== undefined && String(val).trim()) ? String(val).trim() : '-';
    };

    // Header Title & Badge
    const headerTitle = document.getElementById('modal-hosp-header-title');
    if (headerTitle) {
      headerTitle.textContent = hosp.name || hosp.hospitalName || 'Hospital Comprehensive Dossier';
    }

    // SECTION 1: APPLICATION
    const meta = getStatusMeta(hosp.verificationStatus || hosp.status);
    const statusContainer = document.getElementById('modal-hosp-status-container');
    if (statusContainer) {
      statusContainer.innerHTML = `<span class="hosp-status-pill hosp-status-${meta.cls}" id="modal-hosp-status"><i class="fas fa-${meta.icon}"></i> ${escapeHtml(meta.label)}</span>`;
    }
    setSpan('modal-hosp-submitted-at', formatTimestamp(hosp.createdAt || hosp.submittedTime));
    setSpan('modal-hosp-app-ref', hosp.applicationRef || 'N/A');

    // SECTION 2: FACILITY
    setSpan('modal-hosp-name', hosp.name || hosp.hospitalName);
    setSpan('modal-hosp-type', hosp.hospitalType || hosp.type || 'General Healthcare Facility');
    setSpan('modal-hosp-reg-no', hosp.registrationNo);
    setSpan('modal-hosp-license', (hosp.bloodBankLicense && hosp.bloodBankLicense !== 'N/A') ? hosp.bloodBankLicense : 'No Dedicated License Recorded');
    setSpan('modal-hosp-eraktkosh', hosp.eraktkoshId || '-');
    setSpan('modal-hosp-beds', hosp.beds ? `${hosp.beds} Beds` : 'Not Specified');

    const websiteEl = document.getElementById('modal-hosp-website');
    if (websiteEl) {
      const web = hosp.website;
      if (web && web.trim()) {
        const fullUrl = web.startsWith('http') ? web : 'https://' + web;
        websiteEl.innerHTML = `<a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;"><i class="fas fa-arrow-up-right-from-square"></i> ${escapeHtml(web)}</a>`;
      } else {
        websiteEl.textContent = 'None Provided';
      }
    }

    // Clinical Services Tags
    const servicesEl = document.getElementById('modal-hosp-services');
    if (servicesEl) {
      servicesEl.innerHTML = '';
      const rawServices = hosp.services || '';
      let serviceList = [];
      if (Array.isArray(rawServices)) {
        serviceList = rawServices;
      } else if (typeof rawServices === 'string') {
        try {
          const parsed = JSON.parse(rawServices);
          if (Array.isArray(parsed)) serviceList = parsed;
          else serviceList = rawServices.split(',').map(s => s.trim());
        } catch (_) {
          serviceList = rawServices.split(',').map(s => s.trim());
        }
      }
      serviceList = serviceList.filter(Boolean);

      const serviceMeta = {
        emergency: { label: '24/7 Emergency & Trauma', icon: 'truck-medical' },
        bloodbank: { label: 'Dedicated Blood Bank', icon: 'droplet' },
        icu: { label: 'Intensive Care Unit (ICU)', icon: 'heart-pulse' },
        surgery: { label: 'Trauma & Operation Theaters', icon: 'bed-pulse' },
        maternity: { label: 'Maternity & Neonatal Care', icon: 'person-breastfeeding' },
        dialysis: { label: 'Dialysis Center', icon: 'flask-round-pulse' }
      };

      if (serviceList.length === 0) {
        servicesEl.innerHTML = `<span style="font-size: 12px; color: var(--admin-text-muted);">Standard Clinical & Emergency Services</span>`;
      } else {
        serviceList.forEach(s => {
          const key = s.toLowerCase().trim();
          const sm = serviceMeta[key] || { label: s.charAt(0).toUpperCase() + s.slice(1), icon: 'circle-check' };
          const chip = document.createElement('span');
          chip.className = 'hosp-service-chip';
          chip.innerHTML = `<i class="fas fa-${sm.icon}"></i> ${escapeHtml(sm.label)}`;
          servicesEl.appendChild(chip);
        });
      }
    }

    // SECTION 3: CONTACT PERSON
    setSpan('modal-hosp-admin-name', hosp.adminName || 'Not recorded');
    setSpan('modal-hosp-admin-designation', hosp.adminDesignation || 'Hospital Administrator');
    setSpan('modal-hosp-admin-phone', hosp.adminPhone || hosp.phone);
    setSpan('modal-hosp-admin-email', hosp.adminEmail || hosp.email);
    setSpan('modal-hosp-emergency', hosp.emergencyContact || hosp.hospitalPhone || '24/7 Emergency Hotline Unlisted');

    // SECTION 4: LOCATION
    setSpan('modal-hosp-address', hosp.address || 'Address Not Recorded');
    setSpan('modal-hosp-landmark', hosp.landmark || 'None Specified');
    const cityStatePin = `${hosp.city || '-'}${hosp.state ? ', ' + hosp.state : ''}${hosp.pincode ? ' - ' + hosp.pincode : ''}`;
    setSpan('modal-hosp-city-state-pin', cityStatePin);
    setSpan('modal-hosp-hours', hosp.operatingHours || '24x7 Emergency Services');

    const coordsEl = document.getElementById('modal-hosp-coords');
    const lat = hosp.latitude != null ? parseFloat(hosp.latitude) : NaN;
    const lng = hosp.longitude != null ? parseFloat(hosp.longitude) : NaN;
    const hasValidCoords = !isNaN(lat) && !isNaN(lng);

    if (coordsEl) {
      if (hasValidCoords) {
        coordsEl.innerHTML = `<i class="fas fa-map-pin" style="color: #38bdf8;"></i> ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      } else {
        coordsEl.innerHTML = `<span style="color: var(--admin-text-muted);">Location coordinates not set</span>`;
      }
    }

    // Leaflet map setup
    const mapContainer = document.getElementById('modal-hosp-map');
    if (mapContainer && typeof L !== 'undefined') {
      try {
        if (hasValidCoords) {
          if (!modalHospMap) {
            modalHospMap = L.map('modal-hosp-map', { zoomControl: true }).setView([lat, lng], 14);
            if (window.Red404Map) {
              const res = window.Red404Map.createTileLayer('dark', null, mapContainer);
              if (res && res.layer) res.layer.addTo(modalHospMap);
              if (res && res.isDark) mapContainer.classList.add('dark-map');
            } else {
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
              }).addTo(modalHospMap);
            }
            modalHospMarker = L.marker([lat, lng]).addTo(modalHospMap);
          } else {
            modalHospMap.setView([lat, lng], 14);
            if (modalHospMarker) {
              modalHospMarker.setLatLng([lat, lng]);
            } else {
              modalHospMarker = L.marker([lat, lng]).addTo(modalHospMap);
            }
          }
          modalHospMarker.bindPopup(`<b>${escapeHtml(hosp.name || hosp.hospitalName || 'Hospital Entrance')}</b><br>${escapeHtml(hosp.address || '')}`).openPopup();
          setTimeout(() => {
            if (modalHospMap) modalHospMap.invalidateSize();
          }, 250);
        } else if (modalHospMap) {
          modalHospMap.setView([20.5937, 78.9629], 5);
        }
      } catch (mapErr) {
        console.warn('Notice initializing map:', mapErr);
      }
    }

    // SECTION 5: DOCUMENTS
    const docsContainer = document.getElementById('modal-hosp-docs-container');
    if (docsContainer) {
      docsContainer.innerHTML = '';
      const docs = hosp.documents || [];
      if (!Array.isArray(docs) || docs.length === 0) {
        docsContainer.innerHTML = `<div style="color: var(--admin-text-muted); font-size: 13px; padding: 8px 0;">No uploaded compliance documents on file for this facility.</div>`;
      } else {
        const docTypeTitles = {
          registrationCertificate: 'Hospital Registration Certificate',
          bloodBankLicense: 'Blood Bank License',
          authorisationLetter: 'Authorisation Letter / ID',
          idProof: 'Government ID of Authorised Signatory'
        };

        docs.forEach(d => {
          const title = docTypeTitles[d.docType] || d.docType || 'Compliance Document';
          const fileName = d.originalName || d.docId || 'document.pdf';
          const card = document.createElement('div');
          card.className = 'admin-doc-card';
          card.innerHTML = `
            <div class="admin-doc-info">
              <i class="fas fa-file-pdf" style="color: #ef4444; font-size: 20px;"></i>
              <div>
                <div style="font-weight: 600; color: #f8fafc; font-size: 13px;">${escapeHtml(title)}</div>
                <div style="font-size: 11px; color: #94a3b8; font-family: var(--admin-font-mono);">${escapeHtml(fileName)}</div>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <a href="${escapeHtml(d.previewUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-doc-action" title="Preview document in new tab">
                <i class="fas fa-eye"></i> <span>Preview</span>
              </a>
              <a href="${escapeHtml(d.downloadUrl || '#')}" class="btn-doc-action" download title="Download document directly">
                <i class="fas fa-download"></i> <span>Download</span>
              </a>
            </div>
          `;
          docsContainer.appendChild(card);
        });
      }
    }

    // SECTION 6: BLOOD STOCK
    const isVerified = (hosp.verificationStatus || hosp.status || '').toLowerCase() === 'verified';
    const stockSection = document.getElementById('modal-hosp-stock-section');
    if (stockSection) {
      if (!isVerified) {
        stockSection.innerHTML = `
          <div style="padding: 14px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; color: #94a3b8; font-size: 13px; text-align: center;">
            <i class="fas fa-lock" style="margin-right: 6px; color: #fbbf24;"></i>
            Blood stock management is available only after hospital verification is approved.
          </div>
        `;
      } else {
        const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        const inv = hosp.inventory || {};
        const totalUnits = Number(hosp.totalStockUnits || 0);

        let gridHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 13px; color: #cbd5e1;">Live Reserve: <strong style="color: #f8fafc;">${totalUnits} Units</strong></span>
            <span style="font-size: 11px; color: var(--admin-text-muted);">Verified Read-Only View</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(75px, 1fr)); gap: 8px;">
        `;

        bloodTypes.forEach(bt => {
          const units = Number(inv[bt] || 0);
          let state = 'ok';
          let stateColor = '#4ade80';
          if (units <= 2) {
            state = 'critical';
            stateColor = '#f87171';
          } else if (units <= 5) {
            state = 'low';
            stateColor = '#fbbf24';
          }

          gridHtml += `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <span style="font-weight: 700; font-size: 13px; color: ${stateColor};">${bt}</span>
              <div style="font-weight: 700; font-size: 15px; color: #f8fafc;">${units}</div>
              <span style="font-size: 10px; color: var(--admin-text-muted);">Units</span>
            </div>
          `;
        });
        gridHtml += `</div>`;
        stockSection.innerHTML = gridHtml;
      }
    }

    // SECTION 7: ACTIVITY TIMELINE
    const timelineEl = document.getElementById('modal-hosp-change-history');
    if (timelineEl) {
      const logs = hosp.auditLogs || hosp.changeHistory || [];
      if (!Array.isArray(logs) || logs.length === 0) {
        timelineEl.innerHTML = `<div style="color: var(--admin-text-muted); font-size: 13px;">No audit change logs recorded for this facility yet.</div>`;
      } else {
        timelineEl.innerHTML = logs.map(l => `
          <div style="padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              <strong style="color: #38bdf8; font-size: 12px;">[${escapeHtml(l.action || l.toStatus || 'AUDIT')}]</strong>
              <span style="color: var(--admin-text-muted); font-size: 11px;">${formatTimestamp(l.timestamp || l.createdAt)}</span>
            </div>
            <div style="color: #cbd5e1; font-size: 12px;">${escapeHtml(l.details || l.reason || 'Status updated')}</div>
            <div style="color: #64748b; font-size: 11px;">Admin: ${escapeHtml(l.adminEmail || l.admin || 'System')}</div>
          </div>
        `).join('');
      }
    }

    // STICKY ACTION BAR BUTTON VISIBILITY
    const normStatus = (hosp.verificationStatus || hosp.status || 'pending_review').toLowerCase().trim();
    const btnApprove = document.getElementById('btnApproveHosp');
    const btnRequestInfo = document.getElementById('btnRequestInfoHosp');
    const btnReject = document.getElementById('btnRejectHosp');
    const btnSuspend = document.getElementById('btnSuspendHosp');
    const btnReactivate = document.getElementById('btnReactivateHosp');

    if (btnApprove) btnApprove.style.display = (normStatus === 'pending_review' || normStatus === 'needs_info' || normStatus === 'rejected') ? 'inline-flex' : 'none';
    if (btnRequestInfo) btnRequestInfo.style.display = (normStatus !== 'suspended') ? 'inline-flex' : 'none';
    if (btnReject) btnReject.style.display = (normStatus === 'pending_review' || normStatus === 'needs_info' || normStatus === 'suspended') ? 'inline-flex' : 'none';
    if (btnSuspend) btnSuspend.style.display = (normStatus === 'verified') ? 'inline-flex' : 'none';
    if (btnReactivate) btnReactivate.style.display = (normStatus === 'suspended') ? 'inline-flex' : 'none';
  }

  /* View Hospital Details Modal - Immediately fetches live DB data */
  window.viewHospitalDetails = async function (hospId, isBackgroundRefresh = false) {
    if (!hospId) return;
    currentProfileHospitalId = hospId;

    const cached = allHospitals.find(item => item.id === hospId);
    if (cached) {
      populateHospitalProfileModal(cached);
    }

    const modal = document.getElementById('hospitalProfileModal');
    if (modal && !isBackgroundRefresh) {
      modal.style.display = 'flex';
      setTimeout(() => {
        if (modalHospMap) modalHospMap.invalidateSize();
      }, 250);
    }

    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          populateHospitalProfileModal(json.data);
          const idx = allHospitals.findIndex(item => item.id === hospId);
          if (idx !== -1) allHospitals[idx] = Object.assign(allHospitals[idx], json.data);
        }
      }
    } catch (err) {
      console.warn('Notice fetching fresh hospital profile:', err);
    }
  };

  /* Sync Live Button inside Hospital Profile Modal */
  window.refreshCurrentHospitalProfile = async function () {
    if (!currentProfileHospitalId) return;
    const btn = document.getElementById('btnRefreshHospitalProfile');
    const icon = btn?.querySelector('i');
    if (icon) icon.classList.add('fa-spin');

    try {
      await window.viewHospitalDetails(currentProfileHospitalId, true);
      showToast('Hospital dossier synced live with database.', 'info', 1500);
    } catch (_) {
      showToast('Connection error syncing hospital profile.', 'error');
    } finally {
      if (icon) icon.classList.remove('fa-spin');
    }
  };

  /* Close Hospital Profile Modal */
  window.closeHospitalProfileModal = function () {
    const modal = document.getElementById('hospitalProfileModal');
    if (modal) modal.style.display = 'none';
    currentProfileHospitalId = null;
  };

  /* ==================== APPROVAL COMPLIANCE CHECKLIST MODAL ==================== */
  window.openApproveModal = function () {
    if (!currentProfileHospitalId) return;
    const hosp = allHospitals.find(h => h.id === currentProfileHospitalId);
    const hospName = hosp ? (hosp.name || hosp.hospitalName) : 'Hospital';

    const nameEl = document.getElementById('approveModalHospName');
    if (nameEl) nameEl.textContent = hospName;

    const chk1 = document.getElementById('chkApproveDocs');
    const chk2 = document.getElementById('chkApproveReg');
    const chk3 = document.getElementById('chkApproveLoc');
    const note = document.getElementById('txtApproveNote');

    if (chk1) chk1.checked = false;
    if (chk2) chk2.checked = false;
    if (chk3) chk3.checked = false;
    if (note) note.value = '';

    window.checkApproveFormValidity();

    const modal = document.getElementById('approveHospModal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeApproveModal = function () {
    const modal = document.getElementById('approveHospModal');
    if (modal) modal.style.display = 'none';
  };

  window.checkApproveFormValidity = function () {
    const chk1 = document.getElementById('chkApproveDocs');
    const chk2 = document.getElementById('chkApproveReg');
    const chk3 = document.getElementById('chkApproveLoc');
    const btn = document.getElementById('btnConfirmApprove');

    const isValid = chk1 && chk1.checked && chk2 && chk2.checked && chk3 && chk3.checked;
    if (btn) {
      btn.disabled = !isValid;
      btn.style.cursor = isValid ? 'pointer' : 'not-allowed';
      btn.style.opacity = isValid ? '1' : '0.5';
    }
  };

  window.executeApproveHospital = async function () {
    if (!currentProfileHospitalId) return;
    const noteEl = document.getElementById('txtApproveNote');
    const reason = noteEl?.value?.trim() || 'Compliance verification complete: registration certificate, license, and physical location validated.';

    try {
      showToast('Approving hospital application...', 'info', 1500);
      const res = await fetch(`/api/admin/hospitals/${currentProfileHospitalId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verified', reason: reason })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('Hospital approved and granted full network access.', 'success', 3500);
        window.closeApproveModal();
        await window.viewHospitalDetails(currentProfileHospitalId, true);
        await loadHospitals();
      } else {
        showToast(data.message || 'Failed to approve hospital.', 'error');
      }
    } catch (err) {
      showToast('Connection error updating hospital status.', 'error');
    }
  };

  /* ==================== REASON ACTION MODAL (REQUEST INFO / REJECT / SUSPEND / REACTIVATE) ==================== */
  const REASON_PRESETS = {
    needs_info: [
      'Registration document is unreadable or blurry',
      'Blood bank license is expired or missing state seal',
      'Registration number does not match official state registry records',
      'Physical location or campus map pin requires clarification',
      'Authorisation letter missing hospital superintendent signature',
      'Other / Custom note'
    ],
    rejected: [
      'Facility credentials could not be verified with health ministry',
      'Fraudulent or non-authentic documentation uploaded',
      'Duplicate facility registration of an existing registered hospital',
      'Facility does not meet minimum clinical criteria for blood network',
      'Other / Custom note'
    ],
    suspended: [
      'Temporary administrative review pending compliance audit',
      'Reported blood bank license suspension by state authority',
      'Inaccurate blood stock reporting or clinical protocol issue',
      'Emergency helpline unreachable repeatedly during active dispatch',
      'Other / Custom note'
    ],
    verified: [
      'Re-verification completed successfully after document update',
      'Suspension lifted following satisfactory compliance audit',
      'Administrative review concluded with approved credentials',
      'Other / Custom note'
    ]
  };

  window.openReasonModal = function (targetStatus) {
    if (!currentProfileHospitalId) return;
    currentActionTargetStatus = targetStatus;

    const titleEl = document.getElementById('reasonModalTitle');
    const descEl = document.getElementById('reasonModalDesc');
    const selEl = document.getElementById('selPresetReason');
    const txtEl = document.getElementById('txtActionReason');
    const btnEl = document.getElementById('btnConfirmReasonAction');

    let titleText = 'Submit Decision';
    let titleIcon = 'circle-exclamation';
    let titleColor = '#60a5fa';
    let btnText = 'Submit Decision';
    let btnBg = '#3b82f6';
    let btnColor = '#ffffff';

    if (targetStatus === 'needs_info') {
      titleText = 'Request Additional Information';
      titleIcon = 'circle-question';
      titleColor = '#60a5fa';
      btnText = 'Request Info';
      btnBg = '#3b82f6';
    } else if (targetStatus === 'rejected') {
      titleText = 'Reject Hospital Application';
      titleIcon = 'ban';
      titleColor = '#f87171';
      btnText = 'Reject Application';
      btnBg = '#ef4444';
    } else if (targetStatus === 'suspended') {
      titleText = 'Suspend Hospital Account';
      titleIcon = 'pause';
      titleColor = '#fb923c';
      btnText = 'Suspend Account';
      btnBg = '#f97316';
    } else if (targetStatus === 'verified') {
      titleText = 'Reactivate Hospital Account';
      titleIcon = 'circle-check';
      titleColor = '#4ade80';
      btnText = 'Reactivate Account';
      btnBg = '#22c55e';
      btnColor = '#0f172a';
    }

    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-${titleIcon}" style="color: ${titleColor};"></i> ${escapeHtml(titleText)}`;
    }
    if (descEl) {
      descEl.textContent = `Select or type the specific reason/instructions for setting status to "${targetStatus}":`;
    }
    if (btnEl) {
      btnEl.textContent = btnText;
      btnEl.style.background = btnBg;
      btnEl.style.color = btnColor;
    }

    // Populate presets
    const presets = REASON_PRESETS[targetStatus] || ['Other / Custom note'];
    if (selEl) {
      selEl.innerHTML = presets.map((p, idx) => `<option value="${escapeHtml(p)}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
    }
    if (txtEl) {
      txtEl.value = presets[0] && !presets[0].startsWith('Other') ? presets[0] : '';
    }

    const modal = document.getElementById('reasonActionModal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeReasonModal = function () {
    const modal = document.getElementById('reasonActionModal');
    if (modal) modal.style.display = 'none';
    currentActionTargetStatus = null;
  };

  window.onPresetReasonChange = function () {
    const selEl = document.getElementById('selPresetReason');
    const txtEl = document.getElementById('txtActionReason');
    if (!selEl || !txtEl) return;
    const val = selEl.value;
    if (val.startsWith('Other')) {
      txtEl.value = '';
      txtEl.focus();
    } else {
      txtEl.value = val;
    }
  };

  window.executeReasonAction = async function () {
    if (!currentProfileHospitalId || !currentActionTargetStatus) return;
    const txtEl = document.getElementById('txtActionReason');
    const reason = txtEl?.value?.trim();
    if (!reason) {
      showToast('Please provide a reason or instructions before submitting.', 'error');
      if (txtEl) txtEl.focus();
      return;
    }

    try {
      showToast(`Submitting status decision: ${currentActionTargetStatus}...`, 'info', 1500);
      const res = await fetch(`/api/admin/hospitals/${currentProfileHospitalId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: currentActionTargetStatus, reason: reason })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Hospital status updated to "${currentActionTargetStatus}".`, 'success', 3500);
        window.closeReasonModal();
        await window.viewHospitalDetails(currentProfileHospitalId, true);
        await loadHospitals();
      } else {
        showToast(data.message || 'Failed to update hospital status.', 'error');
      }
    } catch (err) {
      showToast('Connection error updating hospital status.', 'error');
    }
  };

  /* ==================== DANGER ZONE DELETE CONFIRMATION MODAL ==================== */
  window.openDeleteHospModal = function (hospId, hospName) {
    const targetId = hospId || currentProfileHospitalId;
    if (!targetId) return;

    deleteTargetHospId = targetId;
    if (hospName) {
      deleteTargetHospName = hospName;
    } else {
      const h = allHospitals.find(item => item.id === targetId);
      deleteTargetHospName = h ? (h.name || h.hospitalName) : (document.getElementById('modal-hosp-name')?.textContent || 'Hospital');
    }

    const expectedEl = document.getElementById('deleteExpectedName');
    if (expectedEl) expectedEl.textContent = deleteTargetHospName;

    const inputEl = document.getElementById('txtDeleteConfirmName');
    if (inputEl) {
      inputEl.value = '';
    }

    window.checkDeleteMatch();

    const modal = document.getElementById('deleteHospModal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeDeleteHospModal = function () {
    const modal = document.getElementById('deleteHospModal');
    if (modal) modal.style.display = 'none';
    deleteTargetHospId = null;
    deleteTargetHospName = '';
  };

  window.checkDeleteMatch = function () {
    const inputEl = document.getElementById('txtDeleteConfirmName');
    const btn = document.getElementById('btnConfirmDeleteHosp');
    if (!inputEl || !btn) return;

    const typed = inputEl.value.trim().toLowerCase();
    const expected = deleteTargetHospName.trim().toLowerCase();
    const isMatch = (typed === expected && expected.length > 0);

    btn.disabled = !isMatch;
    btn.style.cursor = isMatch ? 'pointer' : 'not-allowed';
    btn.style.opacity = isMatch ? '1' : '0.5';
  };

  window.executeDeleteHospital = async function () {
    if (!deleteTargetHospId) return;
    const inputEl = document.getElementById('txtDeleteConfirmName');
    const confirmName = inputEl?.value?.trim() || '';

    try {
      showToast('Deleting hospital account and terminating active sessions...', 'info', 2500);
      const res = await fetch(`/api/admin/hospitals/${deleteTargetHospId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmName })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Hospital "${deleteTargetHospName}" has been soft-deleted.`, 'success', 4000);
        window.closeDeleteHospModal();
        if (currentProfileHospitalId === deleteTargetHospId) {
          window.closeHospitalProfileModal();
        }
        await loadHospitals();
      } else {
        showToast(data.message || 'Failed to delete hospital account.', 'error', 4500);
      }
    } catch (err) {
      showToast('Connection error while deleting hospital account.', 'error');
    }
  };

  /* ==================== REALTIME SSE STREAM (/api/admin/stream) ==================== */
  function initAdminEventStream() {
    if (typeof EventSource === 'undefined') {
      console.warn('SSE not supported in this browser environment.');
      return;
    }

    try {
      const es = new EventSource('/api/admin/stream');

      es.addEventListener('new-hospital-application', (evt) => {
        try {
          const data = JSON.parse(evt.data || '{}');
          showToast(`New hospital application: ${data.hospitalName || 'New Facility'} (${data.city || 'Location'})`, 'info', 5000);
          loadHospitals(false);
        } catch (_) {
          loadHospitals(false);
        }
      });

      es.addEventListener('hospital-status-changed', (evt) => {
        try {
          const data = JSON.parse(evt.data || '{}');
          loadHospitals(false);
          if (currentProfileHospitalId && data.hospitalId === currentProfileHospitalId) {
            window.viewHospitalDetails(currentProfileHospitalId, true);
          }
        } catch (_) {
          loadHospitals(false);
        }
      });

      es.addEventListener('hospital-deleted', (evt) => {
        try {
          const data = JSON.parse(evt.data || '{}');
          loadHospitals(false);
          if (currentProfileHospitalId && data.hospitalId === currentProfileHospitalId) {
            window.closeHospitalProfileModal();
          }
        } catch (_) {
          loadHospitals(false);
        }
      });

      es.onerror = () => {
        // Browser handles reconnection automatically
      };
    } catch (sseErr) {
      console.warn('Notice setting up admin event stream:', sseErr);
    }
  }

  /* ==================== 5. TAB 3: FEEDBACK ==================== */
  async function loadFeedback() {
    const container = document.getElementById('feedback-container');
    const badge = document.getElementById('feedback-count-badge');
    if (!container) return;

    try {
      const res = await fetch('/api/admin/feedback');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      allFeedback = Array.isArray(json.data) ? json.data : [];

      if (badge) badge.textContent = allFeedback.length;
      renderFeedbackGrid(allFeedback);
    } catch (err) {
      console.warn('Notice loading feedback:', err);
      container.innerHTML = `<div class="feedback-empty-state"><i class="fas fa-comments admin-empty-icon"></i><br>No user feedback records available in database.</div>`;
      if (badge) badge.textContent = '0';
    }
  }

  function renderFeedbackGrid(feedbackList) {
    const container = document.getElementById('feedback-container');
    if (!container) return;
    container.innerHTML = '';

    if (!feedbackList || feedbackList.length === 0) {
      container.innerHTML = `
        <div class="feedback-empty-state">
          <i class="fas fa-comments admin-empty-icon"></i>
          <div>No user feedback submissions logged yet.</div>
          <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">New submissions will stream here automatically.</div>
        </div>
      `;
      return;
    }

    feedbackList.forEach(fb => {
      const card = document.createElement('div');
      card.className = 'feedback-card';

      const stars = '★'.repeat(Math.max(1, Math.min(5, fb.rating || 5))) +
        '☆'.repeat(5 - Math.max(1, Math.min(5, fb.rating || 5)));

      card.innerHTML = `
        <div class="feedback-card-header">
          <div class="feedback-user-info">
            <div class="feedback-avatar"><i class="fas fa-user"></i></div>
            <div>
              <div class="feedback-name">${escapeHtml(fb.userName || 'Anonymous User')}</div>
              <div class="feedback-meta">${escapeHtml(fb.category || 'General')} • ${formatTimestamp(fb.createdAt)}</div>
            </div>
          </div>
          <div class="feedback-stars">${stars}</div>
        </div>
        <div class="feedback-body">${escapeHtml(fb.message || '')}</div>
      `;
      container.appendChild(card);
    });
  }

  /* ==================== 6. TAB 4: ISSUE REPORTS ==================== */
  async function loadIssues() {
    const tbody = document.getElementById('issues-table-body');
    const badge = document.getElementById('issues-count-badge');
    if (!tbody) return;

    try {
      const res = await fetch('/api/admin/issues');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      allIssues = Array.isArray(json.data) ? json.data : [];

      if (badge) badge.textContent = allIssues.length;
      renderIssuesTable(allIssues);
    } catch (err) {
      console.warn('Notice loading issues:', err);
      renderEmptyTable(tbody, 4, 'No open issue reports logged in database.');
      if (badge) badge.textContent = '0';
    }
  }

  function renderIssuesTable(issues) {
    const tbody = document.getElementById('issues-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!issues || issues.length === 0) {
      renderEmptyTable(tbody, 4, 'Zero pending issue tickets. All systems nominal.');
      return;
    }

    issues.forEach(iss => {
      const tr = document.createElement('tr');
      const isResolved = (iss.status || '').toUpperCase() === 'RESOLVED';

      tr.innerHTML = `
        <td>
          <span class="smart-id-tag">${escapeHtml(iss.ticketId || '#TKT-' + iss.id)}</span>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${formatTimestamp(iss.createdAt)}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #ffffff;">${escapeHtml(iss.reporter || 'Anonymous')}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(iss.contact || '-')}</div>
        </td>
        <td>
          <span class="status-pill status-open">${escapeHtml(iss.category || 'General')}</span>
          <div style="font-size: 12px; color: var(--admin-text-secondary); margin-top: 4px;">${escapeHtml(iss.description || '')}</div>
        </td>
        <td>
          <button class="admin-action-btn ${isResolved ? '' : 'btn-resolve'}" 
                  onclick="window.resolveIssue(${iss.id})" 
                  ${isResolved ? 'disabled' : ''}>
            <i class="fas fa-${isResolved ? 'check-double' : 'circle-check'}"></i>
            ${isResolved ? 'Resolved' : 'Resolve'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.resolveIssue = async function (issueId) {
    if (!issueId) return;
    try {
      const res = await fetch(`/api/admin/issues/${issueId}/resolve`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Issue marked as RESOLVED', 'success');
        loadIssues();
      } else {
        showToast(data.message || 'Failed to resolve ticket', 'error');
      }
    } catch (_) {
      showToast('Connection error resolving issue', 'error');
    }
  };

  /* ==================== 7. TAB 5: SYSTEM HEALTH & METRICS ==================== */
  async function loadSystemHealth() {
    const totalDonorsEl = document.getElementById('total-donors');
    const totalHospitalsEl = document.getElementById('total-hospitals');
    const totalSosEl = document.getElementById('total-sos');
    const mysqlStatusEl = document.getElementById('mysql-status');
    const dbEngineEl = document.getElementById('db-engine');
    const dbNameEl = document.getElementById('db-name');
    const dbLatencyEl = document.getElementById('db-latency');

    const startT = performance.now();
    try {
      const res = await fetch('/api/admin/health');
      const latencyMs = Math.round(performance.now() - startT);
      if (dbLatencyEl) dbLatencyEl.textContent = latencyMs + ' ms';

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const h = json.data || {};

      if (totalDonorsEl) totalDonorsEl.textContent = h.totalDonors ?? 0;
      if (totalHospitalsEl) totalHospitalsEl.textContent = h.totalHospitals ?? 0;
      if (totalSosEl) totalSosEl.textContent = h.totalSosHandled ?? 0;

      if (mysqlStatusEl) {
        if (h.mysqlConnected) {
          mysqlStatusEl.innerHTML = `<span class="pulse-indicator pulse-green"></span> MySQL Connected`;
        } else {
          mysqlStatusEl.innerHTML = `<span class="pulse-indicator pulse-red"></span> Database Degraded`;
        }
      }

      if (dbEngineEl) dbEngineEl.textContent = h.databaseProduct || 'MySQL 8.0';
      if (dbNameEl) dbNameEl.textContent = 'red404 (production)';
    } catch (err) {
      if (mysqlStatusEl) {
        mysqlStatusEl.innerHTML = `<span class="pulse-indicator pulse-red"></span> Gateway Disconnected`;
      }
      if (totalDonorsEl && totalDonorsEl.textContent === '-') totalDonorsEl.textContent = '0';
      if (totalHospitalsEl && totalHospitalsEl.textContent === '-') totalHospitalsEl.textContent = '0';
      if (totalSosEl && totalSosEl.textContent === '-') totalSosEl.textContent = '0';
    }
  }

  /* ==================== 8. TAB 5: ACTIVITY LOGS (TERMINAL FEED) ==================== */
  async function loadActivityLogs() {
    const feed = document.getElementById('activity-logs-container');
    if (!feed) return;

    try {
      const res = await fetch('/api/admin/logs');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const logs = Array.isArray(json.data) ? json.data : [];

      feed.innerHTML = '';
      if (logs.length === 0) {
        feed.innerHTML = `<div class="terminal-empty-state"><i class="fas fa-terminal admin-empty-icon"></i><br>No activity logged in current execution stack.</div>`;
        return;
      }

      logs.forEach(l => {
        const div = document.createElement('div');
        const type = (l.type || 'INFO').toUpperCase();
        let modifier = '';
        if (type.includes('AUTH') || type.includes('LOGIN')) modifier = 'log-auth';
        else if (type.includes('BOOT') || type.includes('SYS')) modifier = 'log-boot';
        else if (type.includes('ALERT') || type.includes('FAIL') || type.includes('ERROR')) modifier = 'log-alert';

        div.className = `log-entry ${modifier}`;
        div.innerHTML = `
          <span class="log-time">[${escapeHtml(l.timestamp || '--:--:--')}]</span>
          <span class="log-type">&lt;${escapeHtml(type)}&gt;</span>
          <span class="log-text">${escapeHtml(l.details || '')}</span>
        `;
        feed.appendChild(div);
      });
    } catch (_) {
      feed.innerHTML = `<div class="terminal-empty-state"><i class="fas fa-terminal admin-empty-icon"></i><br>Real-time terminal stream standby.</div>`;
    }
  }

  /* ==================== 9. SEARCH FILTERS ==================== */
  function initSearchFilters() {
    const donorSearch = document.getElementById('donorSearchInput');
    if (donorSearch) {
      donorSearch.addEventListener('input', e => {
        const rawQ = (e.target.value || '').trim();
        const q = rawQ.toLowerCase();
        const badge = document.getElementById('donor-count-badge');

        if (!q) {
          renderDonorsTable(allDonors);
          if (badge) badge.textContent = allDonors.length;
          return;
        }

        const cleanQ = q.replace(/\s+/g, '');
        const validBloodGroups = ['a+', 'a-', 'b+', 'b-', 'o+', 'o-', 'ab+', 'ab-'];
        let filtered = [];

        // 1. If user is explicitly searching a blood group (e.g. "O+", "A-", "AB+", etc.)
        if (validBloodGroups.includes(cleanQ)) {
          filtered = allDonors.filter(d => {
            const bg = (d.bloodGroup || '').toLowerCase().replace(/\s+/g, '');
            return bg === cleanQ;
          });
        }
        // 2. If user is searching by Smart ID (e.g. "DNR-1505-S184", "dnr")
        else if (cleanQ.startsWith('dnr')) {
          filtered = allDonors.filter(d => {
            const sid = (d.smartId || '').toLowerCase().replace(/\s+/g, '');
            return sid.includes(cleanQ);
          });
        }
        // 3. Name, city, phone, zone or precise attribute search
        else {
          filtered = allDonors.filter(d => {
            const name = (d.name || '').toLowerCase();
            const sid = (d.smartId || '').toLowerCase();
            const email = (d.email || '').toLowerCase();
            const phone = (d.phone || '').toLowerCase();
            const city = (d.city || '').toLowerCase();
            const zone = (d.zone || '').toLowerCase();
            const state = (d.state || '').toLowerCase();
            const bg = (d.bloodGroup || '').toLowerCase().replace(/\s+/g, '');

            return name.includes(q) ||
              sid.includes(q) ||
              email.includes(q) ||
              phone.includes(q) ||
              city.includes(q) ||
              zone.includes(q) ||
              state.includes(q) ||
              bg === cleanQ;
          });
        }

        if (badge) badge.textContent = filtered.length;
        renderDonorsTable(filtered);
      });
    }

    const hospSearch = document.getElementById('hospitalSearchInput');
    if (hospSearch) {
      hospSearch.addEventListener('input', () => {
        filterAndRenderHospitals();
      });
    }
  }

  /* ==================== 10. CONTROLS ==================== */
  function initControls() {
    const refreshBtn = document.getElementById('refreshTabBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const activeBtn = document.querySelector('.admin-tab-btn.active');
        const activeTab = activeBtn ? activeBtn.getAttribute('data-tab') : 'tab-donors';
        loadTabContent(activeTab);
        showToast('Refreshing live telemetry...', 'info', 1200);
      });
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        showToast('Admin session ended. Logging out...', 'info', 1000);
        setTimeout(async () => {
          if (window.Red404Security) {
            await window.Red404Security.logout('ADMIN');
          } else {
            try { await fetch('/api/admin/logout', { method: 'POST', headers: { 'X-Red404-Role': 'ADMIN' } }); } catch (_) { }
            try {
              sessionStorage.removeItem('admin_session');
              sessionStorage.removeItem('red404_super_admin');
              sessionStorage.removeItem('red404_admin_token');
              localStorage.removeItem('admin_session');
            } catch (_) { }
            window.location.replace('donor-login.html');
          }
        }, 600);
      });
    }
  }

  /* ==================== HELPERS ==================== */
  function renderEmptyTable(tbody, colSpan, message) {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="admin-empty-row">
          <i class="fas fa-database admin-empty-icon"></i>
          <div>${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
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

  function formatRelativeTime(ts) {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      const now = new Date();
      const diffSec = Math.floor((now - d) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return String(ts);
    }
  }

  // Refetch live hospital data on window focus and cadence (30s per Part 1)
  window.addEventListener('focus', () => {
    const activeBtn = document.querySelector('.admin-tab-btn.active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === 'tab-hospitals') {
      loadHospitals();
    }
  });
  setInterval(() => {
    const activeBtn = document.querySelector('.admin-tab-btn.active');
    if (activeBtn && activeBtn.getAttribute('data-tab') === 'tab-hospitals' && document.visibilityState === 'visible') {
      loadHospitals();
    }
  }, 30000);

  // Manual Sync Button
  const btnSyncHosp = document.getElementById('btnSyncHospitals');
  if (btnSyncHosp) {
    btnSyncHosp.addEventListener('click', async () => {
      await loadHospitals(true);
    });
  }

  function formatTimestamp(ts) {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return String(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return String(ts);
    }
  }

  function showToast(msg, type = 'info', duration = 3000) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `admin-toast toast-${type}`;
    const icon = type === 'success' ? 'circle-check' : (type === 'error' ? 'triangle-exclamation' : 'circle-info');
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 50);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

})();

