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
  let donorCurrentPage = 1;
  let donorTotalPages = 1;
  let donorTotalCount = 0;
  let donorPageSize = 25;

  async function loadDonors(page = 1) {
    donorCurrentPage = page;
    const tbody = document.getElementById('donor-table-body');
    const badge = document.getElementById('donor-count-badge');
    const searchInput = document.getElementById('donorSearchInput');
    const q = (searchInput?.value || '').trim();
    if (!tbody) return;

    try {
      let url = `/api/admin/donors?page=${page}&size=${donorPageSize}`;
      if (q) url += `&query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      let donors = [];
      if (json.data && Array.isArray(json.data.donors)) {
        donors = json.data.donors;
        donorTotalCount = json.data.total != null ? json.data.total : donors.length;
        donorTotalPages = Math.max(1, Math.ceil(donorTotalCount / donorPageSize));
      } else if (Array.isArray(json.data)) {
        donors = json.data;
        donorTotalCount = donors.length;
        donorTotalPages = 1;
      }
      allDonors = donors;

      if (badge) badge.textContent = donorTotalCount;
      updateDonorPaginationControls();
      renderDonorsTable(allDonors);
    } catch (err) {
      console.warn('Notice loading donors:', err);
      renderEmptyTable(tbody, 6, 'No registered donors found in MySQL database.');
      if (badge) badge.textContent = '0';
    }
  }

  function updateDonorPaginationControls() {
    const info = document.getElementById('donorPaginationInfo');
    const currentNum = document.getElementById('donorCurrentPageNum');
    const prevBtn = document.getElementById('btnDonorPrevPage');
    const nextBtn = document.getElementById('btnDonorNextPage');

    const start = donorTotalCount === 0 ? 0 : (donorCurrentPage - 1) * donorPageSize + 1;
    const end = Math.min(donorCurrentPage * donorPageSize, donorTotalCount);

    if (info) info.textContent = `Showing ${start}-${end} of ${donorTotalCount} donors`;
    if (currentNum) currentNum.textContent = String(donorCurrentPage);
    if (prevBtn) prevBtn.disabled = donorCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = donorCurrentPage >= donorTotalPages;
  }

  window.changeDonorPage = function (delta) {
    const target = donorCurrentPage + delta;
    if (target >= 1 && target <= donorTotalPages) {
      loadDonors(target);
    }
  };

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
        <td data-label="Smart ID">
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
        <td data-label="Blood Group">
          <span class="blood-type-tag">${escapeHtml(d.bloodGroup || d.bloodType || '-')}</span>
        </td>

        <!-- Column 3: Registered City & Last Seen -->
        <td data-label="Location">
          <div class="donor-zone-cell" style="display: flex; flex-direction: column; gap: 3px;">
            <span class="donor-city-val" style="font-size: 13px; color: #f8fafc;"><strong style="color: #94a3b8; font-size: 11px; text-transform: uppercase;">Registered:</strong> ${escapeHtml(registeredCity)}</span>
            <span class="donor-subzone-val" style="font-size: 12px; color: #94a3b8;"><strong style="color: #38bdf8; font-size: 11px; text-transform: uppercase;">Last Seen:</strong> ${escapeHtml(zoneDisplay !== 'Location not shared' ? zoneDisplay + ' • ' : '')}${escapeHtml(lastSeen)}</span>
          </div>
        </td>

        <!-- Column 4: Total Donations -->
        <td data-label="Donations" style="font-family: var(--admin-font-mono); font-weight: 600; color: #ffffff;">
          ${Number(d.totalDonations || 0)}
        </td>

        <!-- Column 5: Status (Direct Interactive Clickable Toggle) -->
        <td data-label="Status">
          <button type="button" 
                  class="status-badge-btn status-badge-${statusClass}" 
                  onclick="window.toggleDonor(${d.id})" 
                  title="Click to toggle status between Active and Suspended">
            <span class="status-badge-text">${statusLabel}</span>
            <i class="fas fa-arrows-rotate status-toggle-icon"></i>
          </button>
        </td>

        <!-- Column 6: Actions (Direct Profile Button + Direct Delete Button + Kebab Menu) -->
        <td data-label="Actions">
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

  /* ============================================================
     ADMIN DONOR DRAWER (Part 2 & Part 4)
  ============================================================ */
  let currentDonorId = null;
  let currentDonorSmartId = null;
  let currentDonorName = null;
  let lastActiveElement = null;
  let donorActivityPage = 1;
  const donorCache = {};

  window.openDonorDrawer = async function (donorId) {
    if (!donorId) return;
    document.querySelectorAll('.kebab-dropdown.show').forEach(m => m.classList.remove('show'));
    currentDonorId = donorId;
    currentProfileDonorId = donorId;
    lastActiveElement = document.activeElement;

    const overlay = document.getElementById('donorDrawerOverlay');
    if (!overlay) return;

    // 1. Instant Shell Populate (<10ms) from table cache
    const cachedRow = allDonors.find(d => d.id === donorId);
    if (cachedRow) {
      currentDonorSmartId = cachedRow.smartId || ('DNR-' + donorId);
      currentDonorName = cachedRow.name || 'Donor Profile';
      document.getElementById('donorDrawerTitle').textContent = currentDonorName;
      document.getElementById('donorDrawerSmartId').textContent = currentDonorSmartId;
      const statusEl = document.getElementById('donorDrawerStatus');
      if (statusEl) {
        const st = cachedRow.status || 'Active';
        statusEl.textContent = st;
        statusEl.className = 'status-chip ' + (st.toLowerCase() === 'suspended' ? 'chip-suspended' : 'chip-active');
      }
      document.getElementById('donorDrawerRegistered').textContent = 'Registered ' + (cachedRow.createdAt ? new Date(cachedRow.createdAt).toLocaleDateString() : '-');
      document.getElementById('donor-val-smartId').textContent = currentDonorSmartId;
      document.getElementById('donor-val-name').textContent = currentDonorName;
      document.getElementById('donor-val-availability').textContent = cachedRow.status || 'Active';
      document.getElementById('donor-val-bloodGroup').textContent = cachedRow.bloodGroup || '-';
    }

    // Reset to Profile tab
    switchDonorDrawerTab('profile');

    // Show drawer instantly
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Check 30s Client Cache
    const now = Date.now();
    if (donorCache[donorId] && (now - donorCache[donorId].timestamp) < 30000) {
      populateDonorDrawerDetails(donorCache[donorId].data);
      return;
    }

    // Set skeleton indicators for detail fields
    setDonorDrawerSkeletons();

    try {
      const res = await fetch(`/api/admin/donors/${donorId}`, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          donorCache[donorId] = { timestamp: now, data: json.data };
          populateDonorDrawerDetails(json.data);
        }
      }
    } catch (err) {
      console.warn('Error fetching donor details:', err);
    }
  };

  // Backward compatibility alias
  window.viewDonorProfile = window.openDonorDrawer;

  function setDonorDrawerSkeletons() {
    ['donor-val-ageGender', 'donor-val-cityState', 'donor-val-registeredOn', 'donor-val-lastLogin',
     'donor-val-totalDonations', 'donor-val-lastDonation', 'donor-val-nextEligible', 'donor-val-healthCheck',
     'donor-val-email', 'donor-val-phone', 'donor-val-publicSearch', 'donor-val-termsAccepted', 'donor-val-locationShared'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span class="drawer-skeleton"></span>';
    });
  }

  function populateDonorDrawerDetails(data) {
    if (!data) return;
    const acc = data.account || {};
    const bh = data.bloodHealth || {};
    const con = data.contact || {};
    const cns = data.consents || {};

    currentDonorSmartId = acc.smartId || ('DNR-' + currentDonorId);
    currentDonorName = acc.name || 'Donor Profile';

    // Header
    const titleEl = document.getElementById('donorDrawerTitle');
    if (titleEl) titleEl.textContent = currentDonorName;
    const sIdEl = document.getElementById('donorDrawerSmartId');
    if (sIdEl) sIdEl.textContent = currentDonorSmartId;
    const statusEl = document.getElementById('donorDrawerStatus');
    if (statusEl) {
      const st = acc.availability || data.status || 'Active';
      statusEl.textContent = st;
      statusEl.className = 'status-chip ' + (st.toLowerCase() === 'suspended' ? 'chip-suspended' : 'chip-active');
    }
    const regEl = document.getElementById('donorDrawerRegistered');
    if (regEl) regEl.textContent = 'Registered ' + (acc.registeredOn ? new Date(acc.registeredOn).toLocaleDateString() : '-');

    // Group 1: Account
    setElemText('donor-val-smartId', currentDonorSmartId);
    setElemText('donor-val-name', currentDonorName);
    const ageGender = (acc.age ? (acc.age + ' yrs') : 'Age not provided') + (acc.gender ? (', ' + acc.gender) : '');
    setElemText('donor-val-ageGender', ageGender);
    setElemText('donor-val-cityState', (acc.city && acc.city !== 'Not provided') ? `${acc.city}${acc.state ? ', ' + acc.state : ''}` : 'Not provided');
    setElemText('donor-val-registeredOn', acc.registeredOn ? formatTimestamp(acc.registeredOn) : 'Not provided');
    setElemText('donor-val-lastLogin', acc.lastLogin ? formatTimestamp(acc.lastLogin) : 'Never');
    setElemText('donor-val-availability', acc.availability || 'Active');

    // Group 2: Blood and health summary
    const bgStatusStr = (bh.bloodGroup || data.bloodGroup || 'Unknown') + ' (' + (bh.bloodGroupStatus || 'Self-declared') + ')';
    setElemText('donor-val-bloodGroup', bgStatusStr);
    setElemText('donor-val-totalDonations', (bh.totalVerifiedDonations !== undefined ? bh.totalVerifiedDonations : data.totalDonations || 0) + ' verified donations');
    setElemText('donor-val-lastDonation', bh.lastDonationDate || data.lastDonation || 'Never');
    setElemText('donor-val-nextEligible', bh.nextEligibleDate || 'Eligible now');
    const hcStr = (bh.lastHealthCheckDate && bh.lastHealthCheckDate !== 'No health checks recorded')
      ? `${bh.lastHealthCheckDate} — ${bh.lastHealthCheckOutcome || 'Fit'}`
      : 'No health checks recorded';
    setElemText('donor-val-healthCheck', hcStr);

    // Group 3: Contact (Masked by default)
    setElemText('donor-val-email', con.maskedEmail || maskClientEmail(data.email));
    setElemText('donor-val-phone', con.maskedPhone || maskClientPhone(data.phone));
    setElemText('donor-val-address', con.maskedAddress || '••••••••••••');

    // Reset reveal buttons
    resetRevealButton('btnRevealDonorEmail');
    resetRevealButton('btnRevealDonorPhone');
    resetRevealButton('btnRevealDonorAddress');
    const btnAddr = document.getElementById('btnRevealDonorAddress');
    if (btnAddr && con.maskedAddress === 'Not provided') {
      btnAddr.style.display = 'none';
    }

    // Group 4: Consents
    setElemText('donor-val-publicSearch', cns.publicSearch || 'Enabled');
    setElemText('donor-val-termsAccepted', cns.termsAccepted || 'v1.0 (Accepted on Registration)');
    setElemText('donor-val-locationShared', cns.locationShared || 'No');

    // Footer Toggle Status Label
    const toggleLabel = document.getElementById('donorStatusToggleLabel');
    if (toggleLabel) {
      toggleLabel.textContent = (acc.availability === 'Suspended') ? 'Reactivate' : 'Suspend';
    }
  }

  function setElemText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = (text !== null && text !== undefined && String(text).trim()) ? String(text).trim() : 'Not provided';
  }

  function maskClientEmail(e) {
    if (!e || !e.includes('@')) return 'Not provided';
    const at = e.indexOf('@');
    return e.charAt(0) + '***@' + e.substring(at + 1);
  }

  function maskClientPhone(p) {
    if (!p || p.length < 5) return 'Not provided';
    const c = p.replace(/\D/g, '');
    return c.substring(0, 2) + '******' + c.substring(c.length - 2);
  }

  function resetRevealButton(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.style.display = 'inline-flex';
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-eye"></i> <span>Reveal</span>';
    }
  }

  window.closeDonorDrawer = function () {
    const overlay = document.getElementById('donorDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.style.display = 'none', 200);
    }
    currentDonorId = null;
    currentProfileDonorId = null;
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  window.closeDonorProfileModal = window.closeDonorDrawer;

  window.switchDonorDrawerTab = function (tabName) {
    const btnProf = document.getElementById('tabBtnDonorProfile');
    const btnAct = document.getElementById('tabBtnDonorActivity');
    const paneProf = document.getElementById('donorPaneProfile');
    const paneAct = document.getElementById('donorPaneActivity');

    if (tabName === 'activity') {
      btnProf?.classList.remove('active');
      btnAct?.classList.add('active');
      if (paneProf) paneProf.style.display = 'none';
      if (paneAct) paneAct.style.display = 'flex';
      donorActivityPage = 1;
      fetchDonorActivity(currentDonorId, 1);
    } else {
      btnAct?.classList.remove('active');
      btnProf?.classList.add('active');
      if (paneAct) paneAct.style.display = 'none';
      if (paneProf) paneProf.style.display = 'flex';
    }
  };

  async function fetchDonorActivity(donorId, page = 1) {
    const container = document.getElementById('donorActivityTimeline');
    const loadMoreBtn = document.getElementById('btnLoadMoreDonorActivity');
    if (!container || !donorId) return;

    if (page === 1) {
      container.innerHTML = '<div style="color: #94a3b8; font-size: 13px;">Loading donor activity...</div>';
    }

    try {
      const res = await fetch(`/api/admin/donors/${donorId}/activity?page=${page}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        const events = json.data?.events || [];
        if (page === 1) container.innerHTML = '';

        if (events.length === 0 && page === 1) {
          container.innerHTML = '<div style="color: #94a3b8; font-size: 13px;">No recorded events on file.</div>';
          if (loadMoreBtn) loadMoreBtn.style.display = 'none';
          return;
        }

        events.forEach(ev => {
          const item = document.createElement('div');
          item.className = 'drawer-timeline-item';
          item.innerHTML = `
            <div class="drawer-timeline-top">
              <span class="drawer-timeline-action">[${escapeHtml(ev.action || 'EVENT')}]</span>
              <span class="drawer-timeline-time">${formatTimestamp(ev.timestamp)}</span>
            </div>
            <div class="drawer-timeline-details">${escapeHtml(ev.details || '-')}</div>
            <div class="drawer-timeline-actor">Actor: ${escapeHtml(ev.actor || 'System')}</div>
          `;
          container.appendChild(item);
        });

        if (loadMoreBtn) {
          loadMoreBtn.style.display = json.data?.hasMore ? 'inline-block' : 'none';
        }
      }
    } catch (err) {
      if (page === 1) container.innerHTML = '<div style="color: #f87171; font-size: 13px;">Error loading activity events.</div>';
    }
  }

  window.loadMoreDonorActivity = function () {
    if (!currentDonorId) return;
    donorActivityPage++;
    fetchDonorActivity(currentDonorId, donorActivityPage);
  };

  window.revealDonorContact = async function (field) {
    if (!currentDonorId) return;
    const btnId = field === 'email' ? 'btnRevealDonorEmail' : (field === 'address' ? 'btnRevealDonorAddress' : 'btnRevealDonorPhone');
    const valId = field === 'email' ? 'donor-val-email' : (field === 'address' ? 'donor-val-address' : 'donor-val-phone');
    const btn = document.getElementById(btnId);
    const valEl = document.getElementById(valId);
    if (!btn || !valEl) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const res = await fetch(`/api/admin/donors/${currentDonorId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const rawVal = json.data.value;
          valEl.textContent = rawVal;
          let remaining = 30;
          btn.innerHTML = `<span class="reveal-timer-pill">Auto-hiding in ${remaining}s</span>`;
          const timer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              clearInterval(timer);
              if (field === 'email') valEl.textContent = maskClientEmail(rawVal);
              else if (field === 'address') valEl.textContent = '••••••••••••';
              else valEl.textContent = maskClientPhone(rawVal);
              resetRevealButton(btnId);
            } else {
              const pill = btn.querySelector('.reveal-timer-pill');
              if (pill) pill.textContent = `Auto-hiding in ${remaining}s`;
            }
          }, 1000);
          showToast(`Donor ${field} revealed and logged to audit trail.`, 'info', 2000);
        }
      }
    } catch (err) {
      showToast('Error revealing contact info', 'error');
      resetRevealButton(btnId);
    }
  };

  /* Donor Status Toggle Modal */
  window.openDonorStatusModal = function () {
    if (!currentDonorId) return;
    const modal = document.getElementById('donorStatusModal');
    const reasonInput = document.getElementById('donorStatusInputReason');
    if (reasonInput) reasonInput.value = '';
    if (modal) modal.style.display = 'flex';
  };

  window.closeDonorStatusModal = function () {
    const modal = document.getElementById('donorStatusModal');
    if (modal) modal.style.display = 'none';
  };

  window.confirmToggleDonorStatus = async function () {
    if (!currentDonorId) return;
    const reason = document.getElementById('donorStatusInputReason')?.value.trim();
    if (!reason) {
      showToast('Please provide a mandatory reason for changing account status.', 'error');
      return;
    }
    const btn = document.getElementById('btnConfirmDonorStatus');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const res = await fetch(`/api/admin/donors/${currentDonorId}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason })
      });
      if (res.ok) {
        const json = await res.json();
        showToast(json.message || 'Status updated', 'success');
        closeDonorStatusModal();
        delete donorCache[currentDonorId];
        openDonorDrawer(currentDonorId);
        loadDonors();
      } else {
        const json = await res.json();
        showToast(json.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast('Connection error updating status', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm'; }
    }
  };

  /* Donor Delete Modal */
  window.openDonorDeleteModal = function () {
    if (!currentDonorId) return;
    const modal = document.getElementById('donorDeleteModal');
    document.getElementById('deleteDonorModalName').textContent = currentDonorName || 'Donor';
    document.getElementById('deleteDonorModalExpectedId').textContent = currentDonorSmartId || '';
    const inputId = document.getElementById('deleteDonorInputId');
    const inputReason = document.getElementById('deleteDonorInputReason');
    if (inputId) inputId.value = '';
    if (inputReason) inputReason.value = '';
    if (modal) modal.style.display = 'flex';
  };

  window.closeDonorDeleteModal = function () {
    const modal = document.getElementById('donorDeleteModal');
    if (modal) modal.style.display = 'none';
  };

  window.confirmDeleteDonor = async function () {
    if (!currentDonorId) return;
    const typedId = document.getElementById('deleteDonorInputId')?.value.trim();
    const reason = document.getElementById('deleteDonorInputReason')?.value.trim();

    if (!typedId || typedId.toLowerCase() !== (currentDonorSmartId || '').toLowerCase()) {
      showToast(`Please type the exact Smart ID "${currentDonorSmartId}" to confirm.`, 'error');
      return;
    }
    if (!reason) {
      showToast('A reason for deletion is mandatory.', 'error');
      return;
    }

    const btn = document.getElementById('btnConfirmDeleteDonor');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...'; }

    try {
      const res = await fetch(`/api/admin/donors/${currentDonorId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typedSmartId: typedId, reason: reason })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.message || 'Donor account deactivated', 'success');
        closeDonorDeleteModal();
        closeDonorDrawer();
        delete donorCache[currentDonorId];
        loadDonors();
      } else {
        showToast(json.message || 'Deletion failed', 'error');
      }
    } catch (err) {
      showToast('Connection error during deletion', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-can"></i> Permanently Deactivate'; }
    }
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

  let hospCurrentPage = 1;
  let hospTotalPages = 1;
  let hospTotalCount = 0;
  let hospPageSize = 25;

  async function loadHospitals(page = 1, isManual = false) {
    if (typeof page === 'boolean') {
      isManual = page;
      page = hospCurrentPage;
    }
    hospCurrentPage = page;
    const tbody = document.getElementById('hospital-table-body');
    const syncBtn = document.getElementById('btnSyncHospitals');
    const searchInput = document.getElementById('hospitalSearchInput');
    const q = (searchInput?.value || '').trim();

    if (isManual && syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }

    try {
      let url = `/api/admin/hospitals?status=${encodeURIComponent(hospActiveStatusTab)}&page=${page}&size=${hospPageSize}`;
      if (q) url += `&query=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      const data = json.data || {};
      if (data.counts) {
        hospCounts = data.counts;
        updateSubtabBadges(hospCounts);
      }

      let hospitals = [];
      if (Array.isArray(data.hospitals)) {
        hospitals = data.hospitals;
        hospTotalCount = data.total != null ? data.total : hospitals.length;
        hospTotalPages = Math.max(1, Math.ceil(hospTotalCount / hospPageSize));
      } else if (Array.isArray(data)) {
        hospitals = data;
        hospTotalCount = hospitals.length;
        hospTotalPages = 1;
      }
      allHospitals = hospitals;

      const lastUpdatedEl = document.getElementById('hosp-last-updated');
      if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
      }

      updateHospPaginationControls();
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

  function updateHospPaginationControls() {
    const info = document.getElementById('hospPaginationInfo');
    const currentNum = document.getElementById('hospCurrentPageNum');
    const prevBtn = document.getElementById('btnHospPrevPage');
    const nextBtn = document.getElementById('btnHospNextPage');

    const start = hospTotalCount === 0 ? 0 : (hospCurrentPage - 1) * hospPageSize + 1;
    const end = Math.min(hospCurrentPage * hospPageSize, hospTotalCount);

    if (info) info.textContent = `Showing ${start}-${end} of ${hospTotalCount} facilities`;
    if (currentNum) currentNum.textContent = String(hospCurrentPage);
    if (prevBtn) prevBtn.disabled = hospCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = hospCurrentPage >= hospTotalPages;
  }

  window.changeHospPage = function (delta) {
    const target = hospCurrentPage + delta;
    if (target >= 1 && target <= hospTotalPages) {
      loadHospitals(target);
    }
  };

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
      const docCount = (h.documentsCount != null ? h.documentsCount : (h.docCount != null ? h.docCount : 0));
      const stockUnits = (h.totalStockUnits != null ? h.totalStockUnits : (h.stockUnits != null ? h.stockUnits : (h.totalUnits != null ? h.totalUnits : 0)));
      const stockText = h.stockSummary || (stockUnits + ' Units');
      const effUpdated = h.updatedAt || h.lastUpdated || h.createdAt;

      tr.innerHTML = `
        <td data-label="Hospital">
          <div style="font-weight: 600; color: #f8fafc; font-size: 14px;">${escapeHtml(h.name || h.hospitalName || '-')}</div>
          <div style="font-size: 12px; color: var(--admin-text-muted); margin-top: 2px;">
            <i class="fas fa-location-dot" style="font-size: 11px;"></i> ${escapeHtml(h.location || h.city || 'Location Not Specified')}
          </div>
        </td>
        <td data-label="Type" style="font-size: 13px; color: #cbd5e1;">
          ${escapeHtml(h.type || h.hospitalType || 'Facility')}
        </td>
        <td data-label="Submitted" style="font-size: 12px; color: #94a3b8;" title="${escapeHtml(String(h.createdAt || h.submittedTime || ''))}">
          ${formatRelativeTime(h.createdAt || h.submittedTime)}
        </td>
        <td data-label="Status">
          <span class="hosp-status-pill hosp-status-${meta.cls}">
            <i class="fas fa-${meta.icon}"></i> ${escapeHtml(meta.label)}
          </span>
        </td>
        <td data-label="Email" style="font-size: 13px; color: #cbd5e1;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(h.email || h.hospitalEmail || '-')}</span>
            <i class="fas fa-circle-check" style="color: #4ade80; font-size: 12px;" title="Official Email Verified"></i>
          </div>
        </td>
        <td data-label="Documents" style="font-size: 13px; color: #cbd5e1;">
          <span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
            <i class="fas fa-file-lines" style="color: #94a3b8; font-size: 11px;"></i>
            <span>${docCount} docs</span>
          </span>
        </td>
        <td data-label="Stock" style="font-size: 13px; color: #f8fafc; font-family: var(--admin-font-mono);">
          ${isVerified ? escapeHtml(stockText) : '<span style="color: var(--admin-text-muted);">—</span>'}
        </td>
        <td data-label="Updated" style="font-size: 12px; color: #94a3b8;" title="${escapeHtml(String(effUpdated || ''))}">
          ${formatRelativeTime(effUpdated)}
        </td>
        <td data-label="Actions">
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <button type="button" class="admin-action-btn btn-view-hosp-details" data-id="${h.id}" title="Review Hospital Application & Facility Dossier">
              <i class="fas fa-eye"></i> Details
            </button>
            <button type="button" class="admin-action-btn btn-danger-action btn-delete-hosp" data-id="${h.id}" data-name="${safeHospName}" title="Delete Hospital">
              <i class="fas fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      // Explicit click event listeners (bypassing CSP inline restrictions)
      const btnDetails = tr.querySelector('.btn-view-hosp-details');
      if (btnDetails) {
        btnDetails.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.openHospitalDrawer(h.id);
        });
      }

      const btnDelete = tr.querySelector('.btn-delete-hosp');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.openDeleteHospModal(h.id, safeHospName);
        });
      }

      // Tap card anywhere on row opens the details modal
      tr.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('input')) {
          window.openHospitalDrawer(h.id);
        }
      });
      tbody.appendChild(tr);
    });
  }

  /* ============================================================
     ADMIN HOSPITAL DRAWER (Part 3 & Part 4)
  ============================================================ */
  const hospitalCache = {};
  let hospRevealTimers = {};
  let hospActivityPage = 1;

  window.openHospitalDrawer = async function (hospId, forceRefresh = false) {
    if (!hospId) return;
    const numId = parseInt(hospId, 10) || hospId;
    currentProfileHospitalId = numId;
    lastActiveElement = document.activeElement;

    const overlay = document.getElementById('hospitalDrawerOverlay');
    if (!overlay) return;

    // Default to Overview tab
    switchHospitalDrawerTab('overview');

    // 1. Instant Shell Populate (<10ms) from table row
    const cachedRow = allHospitals.find(h => h.id == numId);
    if (cachedRow) {
      const hName = cachedRow.name || cachedRow.hospitalName || 'Hospital';
      const ref = cachedRow.applicationRef || ('HSP-' + numId);
      const st = cachedRow.verificationStatus || cachedRow.status || 'pending_review';
      const meta = getStatusMeta(st);

      const titleEl = document.getElementById('hospitalDrawerTitle');
      if (titleEl) titleEl.textContent = hName;
      const refEl = document.getElementById('hospitalDrawerRef');
      if (refEl) refEl.textContent = ref;
      const statusEl = document.getElementById('hospitalDrawerStatus');
      if (statusEl) {
        statusEl.textContent = meta.label;
        statusEl.className = `status-chip hosp-status-${meta.cls}`;
      }
      const subEl = document.getElementById('hospitalDrawerSubmitted');
      if (subEl) subEl.textContent = 'Submitted ' + (cachedRow.createdAt ? new Date(cachedRow.createdAt).toLocaleDateString() : '-');
      const updEl = document.getElementById('hospitalDrawerLastUpdatedText');
      if (updEl) updEl.textContent = 'just now';

      // Instant Overview fields from row
      const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };
      setEl('hosp-overview-type', cachedRow.type || cachedRow.hospitalType || 'Facility');
      setEl('hosp-overview-cityState', (cachedRow.city || cachedRow.location || '-') + (cachedRow.state ? ', ' + cachedRow.state : ''));
      setEl('hosp-overview-contactPerson', cachedRow.adminName || 'Not recorded');
      setEl('hosp-overview-emergency', cachedRow.emergencyContact || cachedRow.hospitalPhone || '-');
      setEl('hosp-overview-hours', cachedRow.operatingHours || '24x7 Emergency Services');

      const chipEl = document.getElementById('hospOverviewStatusChip');
      const descEl = document.getElementById('hospOverviewStatusDesc');
      if (chipEl) {
        chipEl.textContent = meta.label;
        chipEl.className = `status-chip hosp-status-${meta.cls}`;
      }
      if (descEl) {
        descEl.textContent = st === 'verified' ? 'Verified clinical facility with active network dispatch rights.' :
          (st === 'needs_info' ? 'Additional compliance documents requested from hospital administration.' :
          (st === 'rejected' ? 'Application rejected due to compliance non-conformance.' :
          (st === 'suspended' ? 'Facility dispatch temporarily suspended.' : 'Application awaiting institutional review.')));
      }

      // Configure footer buttons by status
      updateHospitalFooterButtons(st);
    }

    // Show drawer overlay
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('open'));
    const closeBtn = overlay.querySelector('.drawer-close-btn');
    if (closeBtn) closeBtn.focus();

    if (forceRefresh) {
      delete hospitalCache[numId];
    }

    // 2. Fetch fresh fast summary (<500ms) with 30s cache
    const cacheEntry = hospitalCache[numId];
    const now = Date.now();
    if (!cacheEntry || (now - cacheEntry.timestamp > 30000)) {
      try {
        const headers = {};
        if (cacheEntry && cacheEntry.etag) headers['If-None-Match'] = cacheEntry.etag;
        const res = await fetch(`/api/admin/hospitals/${numId}`, { headers });
        if (res.status === 200) {
          const json = await res.json();
          if (json.success && json.data) {
            hospitalCache[numId] = {
              data: json.data,
              etag: res.headers.get('ETag'),
              timestamp: now
            };
            populateHospitalOverview(json.data);
          }
        }
      } catch (err) {
        console.warn('Notice fetching hospital summary:', err);
      }
    } else {
      populateHospitalOverview(cacheEntry.data);
    }

    // Fetch latest activity preview for Overview tab
    loadHospitalLatestActivityPreview(numId);
  };

  window.viewHospitalDetails = window.openHospitalDrawer;

  window.closeHospitalDrawer = function () {
    const overlay = document.getElementById('hospitalDrawerOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      setTimeout(() => { overlay.style.display = 'none'; }, 200);
    }
    currentProfileHospitalId = null;
    // Clear reveal timers
    Object.values(hospRevealTimers).forEach(t => clearTimeout(t));
    hospRevealTimers = {};
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
  };

  window.refreshCurrentHospitalDrawer = function () {
    if (!currentProfileHospitalId) return;
    delete hospitalCache[currentProfileHospitalId];
    openHospitalDrawer(currentProfileHospitalId);
    showToast('Hospital profile refreshed.', 'info', 1500);
  };

  function updateHospitalFooterButtons(statusRaw) {
    const norm = (statusRaw || 'pending_review').toLowerCase().trim();
    const btnApprove = document.getElementById('btnApproveHosp');
    const btnRequestInfo = document.getElementById('btnRequestInfoHosp');
    const btnReject = document.getElementById('btnRejectHosp');
    const btnSuspend = document.getElementById('btnSuspendHosp');
    const btnReactivate = document.getElementById('btnReactivateHosp');

    if (btnApprove) btnApprove.style.display = (norm === 'pending_review' || norm === 'needs_info' || norm === 'rejected') ? 'inline-flex' : 'none';
    if (btnRequestInfo) btnRequestInfo.style.display = (norm !== 'suspended') ? 'inline-flex' : 'none';
    if (btnReject) btnReject.style.display = (norm === 'pending_review' || norm === 'needs_info' || norm === 'suspended') ? 'inline-flex' : 'none';
    if (btnSuspend) btnSuspend.style.display = (norm === 'verified') ? 'inline-flex' : 'none';
    if (btnReactivate) btnReactivate.style.display = (norm === 'suspended') ? 'inline-flex' : 'none';
  }

  function populateHospitalOverview(hosp) {
    if (!hosp) return;
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };
    const ov = hosp.overview || hosp;
    setEl('hosp-overview-type', ov.categoryType || hosp.type || hosp.hospitalType);
    setEl('hosp-overview-cityState', ov.cityState || ((hosp.city || hosp.location || '-') + (hosp.state ? ', ' + hosp.state : '')));
    setEl('hosp-overview-contactPerson', ov.contactPersonName || hosp.adminName || 'Not recorded');
    setEl('hosp-overview-emergency', ov.emergencyHelpline || hosp.emergencyContact || hosp.hospitalPhone || '-');
    setEl('hosp-overview-hours', ov.operatingHours || hosp.operatingHours || '24x7 Emergency Services');

    const st = hosp.verificationStatus || hosp.status || 'pending_review';
    updateHospitalFooterButtons(st);
  }

  async function loadHospitalLatestActivityPreview(hospId) {
    const previewEl = document.getElementById('hosp-overview-latestActivity');
    if (!previewEl) return;
    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}/activity?page=1&size=1`);
      if (res.ok) {
        const json = await res.json();
        const events = json.data?.events || [];
        if (events.length > 0) {
          const ev = events[0];
          previewEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:600; color:#38bdf8; font-size:12px;">${escapeHtml(ev.action || 'Activity')}</span>
              <span style="color:#94a3b8; font-size:11px;">${formatRelativeTime(ev.timestamp)}</span>
            </div>
            <div style="color:#cbd5e1; font-size:12px;">${escapeHtml(ev.details || '-')}</div>
            <div style="color:#64748b; font-size:11px; margin-top:2px;">By ${escapeHtml(ev.admin || 'System')}</div>
          `;
        } else {
          previewEl.innerHTML = `<span style="color:#94a3b8; font-size:12px;">No activity logged yet.</span>`;
        }
      }
    } catch (_) {
      previewEl.innerHTML = `<span style="color:#94a3b8; font-size:12px;">Activity status ready.</span>`;
    }
  }

  /* Switch Tab in Hospital Drawer */
  window.switchHospitalDrawerTab = function (tabName) {
    const tabs = ['overview', 'facility', 'documents', 'stock', 'activity'];
    tabs.forEach(t => {
      const cap = t.charAt(0).toUpperCase() + t.slice(1);
      const btn = document.getElementById(`tabBtnHosp${cap}`);
      const pane = document.getElementById(`hospPane${cap}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) {
        pane.classList.toggle('active', t === tabName);
        pane.style.display = (t === tabName) ? 'block' : 'none';
      }
    });

    if (!currentProfileHospitalId) return;

    if (tabName === 'facility') {
      loadHospitalFacilityTab(currentProfileHospitalId);
    } else if (tabName === 'documents') {
      loadHospitalDocumentsTab(currentProfileHospitalId);
    } else if (tabName === 'stock') {
      loadHospitalStockTab(currentProfileHospitalId);
    } else if (tabName === 'activity') {
      hospActivityPage = 1;
      loadHospitalActivityTab(currentProfileHospitalId, 1);
    }
  };

  /* Lazy Load Facility Tab */
  async function loadHospitalFacilityTab(hospId) {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };

    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}/facility`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const fac = json.data || {};

      // 1. Separate Registration Number and Blood Bank Licence!
      setEl('hosp-fac-regNo', fac.registrationNo || 'REG-PENDING');
      setEl('hosp-fac-licence', fac.bloodBankLicense || 'LIC-NOT-APPLICABLE');
      setEl('hosp-fac-eraktkosh', fac.eraktkoshId || '-');
      setEl('hosp-fac-beds', fac.beds ? `${fac.beds} Beds` : 'Not Specified');

      // Website
      const webEl = document.getElementById('hosp-fac-website');
      if (webEl) {
        if (fac.website && fac.website.trim()) {
          const url = fac.website.startsWith('http') ? fac.website : 'https://' + fac.website;
          webEl.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:underline;"><i class="fas fa-arrow-up-right-from-square"></i> ${escapeHtml(fac.website)}</a>`;
        } else {
          webEl.textContent = 'None Provided';
        }
      }

      // Services
      const srvEl = document.getElementById('hosp-fac-services');
      if (srvEl) {
        const sList = Array.isArray(fac.services) ? fac.services : (fac.services ? String(fac.services).split(',') : []);
        if (sList.length === 0) {
          srvEl.textContent = 'Standard Clinical Services';
        } else {
          srvEl.innerHTML = sList.map(s => `<span class="hosp-service-chip" style="margin:2px 4px 2px 0;"><i class="fas fa-circle-check"></i> ${escapeHtml(s.trim())}</span>`).join('');
        }
      }

      // Contact Person (Masked by default)
      setEl('hosp-fac-adminName', fac.contactPersonName || fac.adminName || 'Not recorded');
      setEl('hosp-fac-adminDesignation', fac.contactPersonDesignation || fac.adminDesignation || 'Hospital Administrator');
      setEl('hosp-fac-phone', fac.maskedPhone || fac.phoneMasked || '••••••••••');
      setEl('hosp-fac-email', fac.maskedEmail || fac.emailMasked || '••••••••••');

      // Location
      setEl('hosp-fac-address', fac.address || 'Address Not Recorded');
      setEl('hosp-fac-landmark', fac.landmark || 'None Specified');
      const cityStatePin = `${fac.city || '-'}${fac.state ? ', ' + fac.state : ''}${fac.pincode ? ' - ' + fac.pincode : ''}`;
      setEl('hosp-fac-cityStatePin', cityStatePin);

      // Coordinates
      const lat = fac.latitude != null ? parseFloat(fac.latitude) : NaN;
      const lng = fac.longitude != null ? parseFloat(fac.longitude) : NaN;
      const hasCoords = !isNaN(lat) && !isNaN(lng);

      const coordsDd = document.getElementById('hosp-fac-coords-dd');
      if (coordsDd) {
        coordsDd.textContent = hasCoords ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : 'Coordinates not set';
      }

      // External Maps Link
      const mapsLink = document.getElementById('hospFacilityMapsLink');
      if (mapsLink) {
        if (hasCoords) {
          mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          mapsLink.style.display = 'inline-flex';
        } else {
          mapsLink.style.display = 'none';
        }
      }

      // Lazy 240px Leaflet Map on facility tab only
      const mapContainer = document.getElementById('hospFacilityMap');
      if (mapContainer && typeof L !== 'undefined') {
        if (hasCoords) {
          if (!modalHospMap) {
            modalHospMap = L.map('hospFacilityMap', { zoomControl: true }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(modalHospMap);
            modalHospMarker = L.marker([lat, lng]).addTo(modalHospMap);
          } else {
            modalHospMap.setView([lat, lng], 14);
            if (modalHospMarker) modalHospMarker.setLatLng([lat, lng]);
            else modalHospMarker = L.marker([lat, lng]).addTo(modalHospMap);
          }
          modalHospMarker.bindPopup(`<b>${escapeHtml(fac.name || 'Hospital')}</b><br>${escapeHtml(fac.address || '')}`);
          setTimeout(() => { if (modalHospMap) modalHospMap.invalidateSize(); }, 150);
        } else if (modalHospMap) {
          modalHospMap.setView([20.5937, 78.9629], 5);
        }
      }
    } catch (err) {
      console.warn('Notice loading hospital facility:', err);
    }
  }

  /* Toggle Coordinates Display */
  window.toggleCoordinatesDisplay = function () {
    const dt = document.getElementById('hosp-fac-coords-dt');
    const dd = document.getElementById('hosp-fac-coords-dd');
    const btn = document.getElementById('btnToggleCoords');
    if (!dt || !dd || !btn) return;

    const isHidden = dt.style.display === 'none';
    dt.style.display = isHidden ? 'block' : 'none';
    dd.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? 'Hide coordinates' : 'Show coordinates';
  };

  /* Reveal Hospital Contact with 30s auto-hide and audit log */
  window.revealHospitalContact = async function (field) {
    if (!currentProfileHospitalId) return;
    const btn = document.getElementById(field === 'phone' ? 'btnRevealHospPhone' : 'btnRevealHospEmail');
    const span = document.getElementById(field === 'phone' ? 'hosp-fac-phone' : 'hosp-fac-email');
    if (!btn || !span) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
      const res = await fetch(`/api/admin/hospitals/${currentProfileHospitalId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field })
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const val = data.data.value;
        const originalMasked = span.textContent;
        span.textContent = val;
        span.classList.add('revealed-field');

        let secondsLeft = 30;
        btn.innerHTML = `<i class="fas fa-clock"></i> <span>${secondsLeft}s</span>`;

        if (hospRevealTimers[field]) clearInterval(hospRevealTimers[field]);
        hospRevealTimers[field] = setInterval(() => {
          secondsLeft--;
          if (secondsLeft > 0) {
            btn.innerHTML = `<i class="fas fa-clock"></i> <span>${secondsLeft}s</span>`;
          } else {
            clearInterval(hospRevealTimers[field]);
            delete hospRevealTimers[field];
            span.textContent = originalMasked;
            span.classList.remove('revealed-field');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-eye"></i> <span>Reveal</span>';
          }
        }, 1000);

        showToast(`${field === 'phone' ? 'Phone' : 'Email'} revealed. Auto-hiding in 30 seconds.`, 'info', 2500);
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-eye"></i> <span>Reveal</span>';
        showToast(data.message || 'Failed to reveal contact', 'error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-eye"></i> <span>Reveal</span>';
      showToast('Network error revealing contact', 'error');
    }
  };

  /* Lazy Load Documents Tab (Generic Labels, Signed URLs, Zero original filenames) */
  async function loadHospitalDocumentsTab(hospId) {
    const container = document.getElementById('hospDocumentsContainer');
    if (!container) return;
    container.innerHTML = `<div style="color:#94a3b8; font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>`;

    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}/documents`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const raw = json.data;
      const docs = Array.isArray(raw) ? raw : (Array.isArray(raw?.documents) ? raw.documents : []);

      if (docs.length === 0) {
        container.innerHTML = `<div style="color:var(--admin-text-muted); font-size:13px; padding:12px 0;">No uploaded compliance documents on file for this facility.</div>`;
        return;
      }

      container.innerHTML = docs.map(d => {
        const previewUrl = d.previewUrl || d.signedUrl || d.downloadUrl || '#';
        const downloadUrl = d.downloadUrl || d.signedUrl || d.previewUrl || '#';
        const docLabel = d.label || 'Compliance Document';
        const fileType = (d.fileType || 'PDF').toUpperCase();
        const sizeText = d.size || 'Verified Scan (PDF)';
        const safeLabel = escapeHtml(docLabel).replace(/'/g, "\\'");

        return `
        <div class="admin-doc-card">
          <div class="admin-doc-info">
            <i class="fas fa-file-pdf" style="color:#ef4444; font-size:20px;"></i>
            <div>
              <div style="font-weight:600; color:#f8fafc; font-size:13px;">${escapeHtml(docLabel)}</div>
              <div style="font-size:11px; color:#94a3b8; font-family:var(--admin-font-mono);">${escapeHtml(fileType)} • ${escapeHtml(sizeText)}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-doc-action" onclick="openDocPreview('${escapeHtml(previewUrl)}', '${safeLabel}')" title="Preview document in viewer">
              <i class="fas fa-eye"></i> <span>Preview</span>
            </button>
            <a href="${escapeHtml(downloadUrl)}" class="btn-doc-action" download title="Download document directly">
              <i class="fas fa-download"></i> <span>Download</span>
            </a>
          </div>
        </div>
      `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div style="color:#f87171; font-size:13px;">Unable to load compliance documents.</div>`;
    }
  }

  /* In-app Document Viewer Modal */
  window.openDocPreview = function (url, label) {
    const modal = document.getElementById('docViewerModal');
    const titleEl = document.getElementById('docViewerTitle');
    const frame = document.getElementById('docViewerFrame');
    if (!modal || !frame) return;

    if (titleEl) titleEl.textContent = label || 'Document Preview';
    frame.src = url;
    modal.style.display = 'flex';
  };

  window.closeDocViewerModal = function () {
    const modal = document.getElementById('docViewerModal');
    const frame = document.getElementById('docViewerFrame');
    if (modal) modal.style.display = 'none';
    if (frame) frame.src = 'about:blank';
  };

  /* Lazy Load Stock Tab */
  async function loadHospitalStockTab(hospId) {
    const content = document.getElementById('hospStockContent');
    const timeEl = document.getElementById('hospStockSyncedTime');
    if (!content) return;
    content.innerHTML = `<div style="color:#94a3b8; font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Loading stock reserves...</div>`;

    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}/stock`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const stockData = json.data || {};

      const isVerified = (stockData.isVerified === true || stockData.verified === true);
      if (!isVerified) {
        content.innerHTML = `
          <div style="padding:14px; background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.15); border-radius:8px; color:#94a3b8; font-size:13px; text-align:center;">
            <i class="fas fa-lock" style="margin-right:6px; color:#fbbf24;"></i>
            Blood stock reserve management is available only after hospital credentials are fully approved.
          </div>
        `;
        return;
      }

      const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const inv = stockData.inventory ? Object.assign({}, stockData.inventory) : {};
      if (Array.isArray(stockData.groups)) {
        stockData.groups.forEach(g => {
          if (g.bloodGroup) inv[g.bloodGroup] = g.units;
        });
      }
      const totalUnits = Number(stockData.totalUnits != null ? stockData.totalUnits : (stockData.totalStockUnits != null ? stockData.totalStockUnits : 0));

      if (timeEl) timeEl.textContent = `Live Reserve: ${totalUnits} Units`;

      let gridHtml = `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(75px, 1fr)); gap:8px;">`;
      bloodTypes.forEach(bt => {
        const units = Number(inv[bt] || 0);
        let stateColor = '#4ade80';
        let stateLabel = 'OK';
        if (units <= 2) {
          stateColor = '#f87171';
          stateLabel = 'Critical';
        } else if (units <= 5) {
          stateColor = '#fbbf24';
          stateLabel = 'Low';
        }

        gridHtml += `
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 8px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
            <span style="font-weight:700; font-size:14px; color:${stateColor};">${bt}</span>
            <div style="font-weight:700; font-size:16px; color:#f8fafc;">${units}</div>
            <span style="font-size:10px; color:${stateColor}; text-transform:uppercase; font-weight:600;">${stateLabel}</span>
          </div>
        `;
      });
      gridHtml += `</div>`;
      content.innerHTML = gridHtml;
    } catch (err) {
      content.innerHTML = `<div style="color:#f87171; font-size:13px;">Unable to load blood stock reserves.</div>`;
    }
  }

  /* Lazy Load Activity Tab (20 per page, Real Admin Names, Human labels) */
  async function loadHospitalActivityTab(hospId, page = 1) {
    const timelineEl = document.getElementById('hospActivityTimeline');
    const loadMoreBtn = document.getElementById('btnLoadMoreHospActivity');
    if (!timelineEl) return;

    if (page === 1) {
      timelineEl.innerHTML = `<div style="color:#94a3b8; font-size:13px;"><i class="fas fa-spinner fa-spin"></i> Loading activity...</div>`;
    }

    try {
      const res = await fetch(`/api/admin/hospitals/${hospId}/activity?page=${page}&size=20`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const events = json.data?.events || [];
      const totalPages = json.data?.totalPages || 1;

      if (page === 1 && events.length === 0) {
        timelineEl.innerHTML = `<div style="color:var(--admin-text-muted); font-size:13px; padding:12px 0;">No activity events recorded for this facility yet.</div>`;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      const rowsHtml = events.map(ev => `
        <div class="timeline-event-item" style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#38bdf8; font-size:12px;">${escapeHtml(ev.action || 'ACTIVITY')}</strong>
            <span style="color:#94a3b8; font-size:11px;">${formatTimestamp(ev.timestamp)}</span>
          </div>
          <div style="color:#cbd5e1; font-size:13px;">${escapeHtml(ev.details || '-')}</div>
          <div style="color:#64748b; font-size:11px;">Admin: <span style="color:#94a3b8;">${escapeHtml(ev.admin || 'System')}</span></div>
        </div>
      `).join('');

      if (page === 1) timelineEl.innerHTML = rowsHtml;
      else timelineEl.insertAdjacentHTML('beforeend', rowsHtml);

      if (loadMoreBtn) {
        loadMoreBtn.style.display = (page < totalPages) ? 'inline-block' : 'none';
      }
    } catch (err) {
      if (page === 1) timelineEl.innerHTML = `<div style="color:#f87171; font-size:13px;">Unable to load activity timeline.</div>`;
    }
  }

  window.loadMoreHospActivity = function () {
    if (!currentProfileHospitalId) return;
    hospActivityPage++;
    loadHospitalActivityTab(currentProfileHospitalId, hospActivityPage);
  };

  /* Hospital Delete Modal (Typed exact hospital name) */
  window.openHospitalDeleteModal = function () {
    if (!currentProfileHospitalId) return;
    const hosp = allHospitals.find(h => h.id === currentProfileHospitalId);
    deleteTargetHospId = currentProfileHospitalId;
    deleteTargetHospName = hosp ? (hosp.name || hosp.hospitalName) : (document.getElementById('hospitalDrawerTitle')?.textContent || 'Hospital');

    const expectedEl = document.getElementById('deleteExpectedHospName');
    if (expectedEl) expectedEl.textContent = deleteTargetHospName;

    const inputEl = document.getElementById('txtDeleteConfirmHospName');
    if (inputEl) inputEl.value = '';

    window.checkHospDeleteMatch();

    const modal = document.getElementById('hospitalDeleteModal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeHospitalDeleteModal = function () {
    const modal = document.getElementById('hospitalDeleteModal');
    if (modal) modal.style.display = 'none';
  };

  window.checkHospDeleteMatch = function () {
    const inputEl = document.getElementById('txtDeleteConfirmHospName');
    const btn = document.getElementById('btnConfirmDeleteHosp');
    if (!inputEl || !btn) return;

    const typed = inputEl.value.trim().toLowerCase();
    const expected = deleteTargetHospName.trim().toLowerCase();
    const isMatch = (typed === expected && expected.length > 0);

    btn.disabled = !isMatch;
    btn.style.cursor = isMatch ? 'pointer' : 'not-allowed';
    btn.style.opacity = isMatch ? '1' : '0.5';
  };

  window.confirmDeleteHospital = async function () {
    if (!deleteTargetHospId) return;
    const inputEl = document.getElementById('txtDeleteConfirmHospName');
    const confirmName = inputEl?.value?.trim() || '';

    try {
      showToast('Deleting hospital and terminating active sessions...', 'info', 2000);
      const res = await fetch(`/api/admin/hospitals/${deleteTargetHospId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: confirmName })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Hospital "${deleteTargetHospName}" has been soft-deleted.`, 'success', 3500);
        window.closeHospitalDeleteModal();
        window.closeHospitalDrawer();
        await loadHospitals();
      } else {
        showToast(data.message || 'Failed to delete hospital account.', 'error', 4500);
      }
    } catch (err) {
      showToast('Connection error while deleting hospital account.', 'error');
    }
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

  // Global Escape key handler for keyboard accessibility (Part 2 & Part 3)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const docModal = document.getElementById('docViewerModal');
      if (docModal && docModal.style.display !== 'none' && docModal.style.display !== '') {
        closeDocViewerModal();
        return;
      }
      const hospDelModal = document.getElementById('hospitalDeleteModal');
      if (hospDelModal && hospDelModal.style.display !== 'none' && hospDelModal.style.display !== '') {
        closeHospitalDeleteModal();
        return;
      }
      const donorDelModal = document.getElementById('donorDeleteModal');
      if (donorDelModal && donorDelModal.style.display !== 'none' && donorDelModal.style.display !== '') {
        closeDonorDeleteModal();
        return;
      }
      const donorStModal = document.getElementById('donorStatusModal');
      if (donorStModal && donorStModal.style.display !== 'none' && donorStModal.style.display !== '') {
        closeDonorStatusModal();
        return;
      }
      const approveModal = document.getElementById('approveHospModal');
      if (approveModal && approveModal.style.display !== 'none' && approveModal.style.display !== '') {
        closeApproveModal();
        return;
      }
      const reasonModal = document.getElementById('reasonActionModal');
      if (reasonModal && reasonModal.style.display !== 'none' && reasonModal.style.display !== '') {
        closeReasonModal();
        return;
      }
      const hospDrawer = document.getElementById('hospitalDrawerOverlay');
      if (hospDrawer && hospDrawer.style.display !== 'none' && hospDrawer.style.display !== '') {
        closeHospitalDrawer();
        return;
      }
      const donorDrawer = document.getElementById('donorDrawerOverlay');
      if (donorDrawer && donorDrawer.style.display !== 'none' && donorDrawer.style.display !== '') {
        closeDonorDrawer();
        return;
      }
    }
  });

})();

