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
      renderEmptyTable(tbody, 5, 'No registered donors found in MySQL database.');
      if (badge) badge.textContent = '0';
    }
  }

  function renderDonorsTable(donors) {
    const tbody = document.getElementById('donor-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!donors || donors.length === 0) {
      renderEmptyTable(tbody, 5, 'No registered donors recorded in MySQL yet.');
      return;
    }

    donors.forEach(d => {
      const tr = document.createElement('tr');
      const isSuspended = (d.status || '').toLowerCase() === 'suspended';

      tr.innerHTML = `
        <td>
          <div class="smart-id-tag">${escapeHtml(d.smartId || '-')}</div>
          <div style="font-size: 11px; color: var(--admin-text-muted);">${escapeHtml(d.name || '')}</div>
        </td>
        <td>
          <span class="blood-type-tag">${escapeHtml(d.bloodGroup || '-')}</span>
        </td>
        <td style="font-family: var(--admin-font-mono); font-weight: 600; color: #ffffff;">
          ${Number(d.totalDonations || 0)}
        </td>
        <td>
          <span class="status-pill ${isSuspended ? 'status-suspended' : 'status-available'}">
            <span class="pulse-indicator ${isSuspended ? 'pulse-red' : 'pulse-green'}"></span>
            ${escapeHtml(d.status || 'Available')}
          </span>
        </td>
        <td>
          <button class="admin-action-btn btn-suspend" onclick="window.toggleDonor(${d.id})">
            <i class="fas fa-${isSuspended ? 'check' : 'ban'}"></i>
            ${isSuspended ? 'Reactivate' : 'Suspend'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.toggleDonor = async function(donorId) {
    if (!donorId) return;
    try {
      const res = await fetch(`/api/admin/donors/${donorId}/toggle-status`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Donor status updated', 'success');
        loadDonors();
      } else {
        showToast(data.message || 'Failed to update donor status', 'error');
      }
    } catch (err) {
      showToast('Connection error updating donor', 'error');
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
        const q = (e.target.value || '').trim().toLowerCase();
        if (!q) {
          renderDonorsTable(allDonors);
          return;
        }
        const filtered = allDonors.filter(d =>
          (d.smartId && d.smartId.toLowerCase().includes(q)) ||
          (d.name && d.name.toLowerCase().includes(q)) ||
          (d.bloodGroup && d.bloodGroup.toLowerCase().includes(q)) ||
          (d.location && d.location.toLowerCase().includes(q))
        );
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
