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
    // Initial active tab load
    loadTabContent('tab-donors');
    // Background health check
    loadSystemHealth();
  });

  /* ==================== 1. AUTH GUARD ==================== */
  async function initAuthGuard() {
    try {
      const res = await fetch('/api/admin/check-auth');
      if (!res.ok) {
        // Not authorized, return to login
        sessionStorage.removeItem('red404_super_admin');
        sessionStorage.removeItem('red404_admin_token');
        window.location.replace('donor-login.html');
      }
    } catch (_) {
      // Backend unreachable or offline
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

      // Zone & City
      const cityName = d.city || d.location || 'Local Node';
      const zoneName = d.zone ? 'Zone ' + d.zone : (d.state || 'General Area');

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
          <span class="blood-type-tag">${escapeHtml(d.bloodGroup || '-')}</span>
        </td>

        <!-- Column 3: Zone / City -->
        <td>
          <div class="donor-zone-cell">
            <span class="donor-city-val">${escapeHtml(cityName)}</span>
            <span class="donor-subzone-val">${escapeHtml(zoneName)}</span>
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

        <!-- Column 6: Actions (Direct Profile Button + Kebab Menu) -->
        <td>
          <div class="admin-actions-cell">
            <button type="button" class="btn-view-profile" onclick="window.viewDonorProfile(${d.id})" title="View Full Dossier">
              <i class="fas fa-id-card"></i>
              <span>Profile</span>
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
  window.toggleRevealName = function(donorId) {
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
  window.toggleKebabMenu = function(event, donorId) {
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
      const rect = btn.getBoundingClientRect();
      const openUpwards = (window.innerHeight - rect.bottom) < 150;
      targetMenu.style.position = 'fixed';
      targetMenu.style.right = Math.max(10, window.innerWidth - rect.right) + 'px';
      targetMenu.style.top = openUpwards ? (rect.top - 95) + 'px' : (rect.bottom + 6) + 'px';
      targetMenu.style.zIndex = '99999';
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
    const cityStatePin = `${donor.city || '-'}${donor.state ? ', ' + donor.state : ''}${donor.pincode ? ' - ' + donor.pincode : ''}`;
    setSpan('modal-donor-city-state-pin', cityStatePin);

    const zoneCoords = `${donor.zone ? 'Zone ' + donor.zone : 'Zone Standard'}${donor.latitude && donor.longitude ? ' • GPS: ' + donor.latitude + ', ' + donor.longitude : ''}`;
    setSpan('modal-donor-zone-coords', zoneCoords);

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
  window.viewDonorProfile = async function(donorId) {
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
  window.refreshCurrentDonorProfile = async function() {
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

  window.closeDonorProfileModal = function() {
    const modal = document.getElementById('donorProfileModal');
    if (modal) {
      modal.style.display = 'none';
    }
    currentProfileDonorId = null;
  };

  /* Send Password Reset Link */
  window.handleSendPasswordReset = async function() {
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

  window.toggleDonor = async function(donorId) {
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
  window.deleteDonorAccount = async function(donorId, donorName) {
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
  async function loadHospitals() {
    const tbody = document.getElementById('hospital-table-body');
    const badge = document.getElementById('hospital-count-badge');
    if (!tbody) return;

    try {
      const res = await fetch('/api/admin/hospitals');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      allHospitals = Array.isArray(json.data) ? json.data : [];

      if (badge) badge.textContent = allHospitals.length;
      renderHospitalsTable(allHospitals);
    } catch (err) {
      console.warn('Notice loading hospitals:', err);
      renderEmptyTable(tbody, 5, 'No registered hospitals found in MySQL database.');
      if (badge) badge.textContent = '0';
    }
  }

  function renderHospitalsTable(hospitals) {
    const tbody = document.getElementById('hospital-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!hospitals || hospitals.length === 0) {
      renderEmptyTable(tbody, 5, 'No partner hospitals or blood banks registered yet.');
      return;
    }

    hospitals.forEach(h => {
      const tr = document.createElement('tr');
      const isVerified = (h.verificationStatus || '').toLowerCase() === 'verified';

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #ffffff;">${escapeHtml(h.name || '-')}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">
            <i class="fas fa-location-dot"></i> ${escapeHtml(h.location || 'Location Not Specified')}
          </div>
        </td>
        <td>
          <span class="status-pill ${isVerified ? 'status-verified' : 'status-pending'}">
            <i class="fas fa-${isVerified ? 'circle-check' : 'clock'}"></i>
            ${escapeHtml(h.verificationStatus || 'Pending')}
          </span>
        </td>
        <td>
          <span style="font-family: var(--admin-font-mono); font-size: 12px; color: #f8fafc;">
            ${escapeHtml(h.stockOverview || '0 Units')}
          </span>
        </td>
        <td style="font-size: 11px; color: var(--admin-text-muted); font-family: var(--admin-font-mono);">
          ${formatTimestamp(h.lastSynced)}
        </td>
        <td>
          <button class="admin-action-btn" onclick="window.viewHospitalDetails(${h.id})">
            <i class="fas fa-eye"></i> Details
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.viewHospitalDetails = function(hospId) {
    const hosp = allHospitals.find(item => item.id === hospId);
    if (!hosp) return;
    showToast(`Hospital: ${hosp.name} (${hosp.location || 'N/A'}) - Total Stock: ${hosp.totalStockUnits || 0} Units`, 'info', 4000);
  };

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

  window.resolveIssue = async function(issueId) {
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
      hospSearch.addEventListener('input', e => {
        const q = (e.target.value || '').trim().toLowerCase();
        if (!q) {
          renderHospitalsTable(allHospitals);
          return;
        }
        const filtered = allHospitals.filter(h =>
          (h.name && h.name.toLowerCase().includes(q)) ||
          (h.location && h.location.toLowerCase().includes(q)) ||
          (h.verificationStatus && h.verificationStatus.toLowerCase().includes(q))
        );
        renderHospitalsTable(filtered);
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
        try {
          await fetch('/api/admin/logout', { method: 'POST' });
        } catch (_) {}
        sessionStorage.removeItem('red404_super_admin');
        sessionStorage.removeItem('red404_admin_token');
        showToast('Admin Session Terminated. Exiting Enclave...', 'info', 1200);
        setTimeout(() => {
          window.location.replace('donor-login.html');
        }, 800);
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

