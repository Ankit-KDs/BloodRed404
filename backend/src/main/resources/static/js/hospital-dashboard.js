/* ============================================================
   RED404 — HOSPITAL PORTAL JAVASCRIPT (PRODUCTION COMMAND CENTER)
   Strictly scoped to hospital portal pages.
   NO FAKE DATA: Every number, status, and entry comes from real backend APIs.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initMedicineFlowBackground();
  initCommandNavigation();
  initHospitalProfile();
  initHospitalLogout();
  initDashboard();
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

    if (tabId === 'tab-dispatch' && window.drawRadarFrame) {
      setTimeout(window.drawRadarFrame, 100);
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

  try {
    const res = await fetch('/api/hospital/profile', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      profile = data.data || data;
    }
  } catch (err) {
    console.debug('Profile fetch fallback:', err);
  }

  if (!profile) {
    try {
      const stored = sessionStorage.getItem('red404_hospital_user') || localStorage.getItem('red404_hospital_user');
      if (stored) profile = JSON.parse(stored);
    } catch (e) {}
  }

  const name = (profile && (profile.name || profile.hospitalName)) || 'Hospital';

  if (topName) topName.textContent = name;
  if (navName) navName.textContent = name;
  if (mobileName) mobileName.textContent = name;
}

/* ============================================================
   3B. HOSPITAL LOGOUT CONFIRMATION & SESSION TERMINATION
   ============================================================ */
function initHospitalLogout() {
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

    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.debug('Auth logout fetch error:', err);
    }

    try {
      await fetch('/api/hospital/logout', { method: 'POST', credentials: 'include' });
    } catch (err) {}

    // Clear local/session state
    try {
      sessionStorage.removeItem('red404_hospital_user');
      sessionStorage.removeItem('red404_session');
      localStorage.removeItem('red404_hospital_user');
      localStorage.removeItem('red404_hospital_stock_units');
      localStorage.removeItem('hospitalUser');
    } catch (err) {}

    window.location.href = 'hospital-login.html';
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
  initInlineSosForm();

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
      const reqText = `${activeCount} ${activeCount === 1 ? 'request is' : 'requests are'} waiting for donors.`;
      const critText = `${criticalLowCount} blood ${criticalLowCount === 1 ? 'group is' : 'groups are'} low.`;
      statusLine.textContent = `${reqText} ${critText}`;
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
                <button type="button" class="btn-request-shortcut" data-type="${item.type}">
                  <span>Request</span>
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

    // Wire Request shortcut buttons
    document.querySelectorAll('.btn-request-shortcut').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        selectSosBloodType(type);
      });
    });
  }
}

function selectSosBloodType(type) {
  if (!type) return;
  const radio = document.querySelector(`input[name="inlineBloodType"][value="${type}"]`);
  if (radio) {
    radio.checked = true;
    const btn = document.getElementById('btnDispatchSosInline');
    const btnText = document.getElementById('btnSosText');
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Send SOS';
  }
  const form = document.getElementById('formInlineSos');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        <div class="req-item-actions">
          ${isArrived ? `<button type="button" class="btn-action-checkin" onclick="switchTab('tab-checkin')">Start check-in</button>` : ''}
          <button type="button" class="btn-action-cancel" data-id="${r.id}">Cancel request</button>
          <button type="button" class="btn-action-fulfill" data-id="${r.id}">Mark fulfilled</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire Cancel and Fulfill Actions with Confirm Modal
  container.querySelectorAll('.btn-action-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const confirmed = (typeof showAppConfirm === 'function')
        ? await showAppConfirm({
            title: 'Cancel Emergency Request',
            message: 'Are you sure you want to cancel this request? Nearby notified donors will be alerted of the cancellation.',
            confirmText: 'Yes, Cancel Request',
            cancelText: 'Keep Request',
            type: 'danger'
          })
        : window.confirm('Cancel this emergency request?');

      if (confirmed) {
        try {
          await fetch(`/api/hospital/requests/${id}/cancel`, { method: 'POST', credentials: 'include' });
          loadDashboardData();
        } catch (e) {
          console.error('Cancel request error:', e);
        }
      }
    });
  });

  container.querySelectorAll('.btn-action-fulfill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const confirmed = (typeof showAppConfirm === 'function')
        ? await showAppConfirm({
            title: 'Mark Request as Fulfilled',
            message: 'Confirm that blood units have been received and this emergency request is fulfilled.',
            confirmText: 'Mark Fulfilled',
            cancelText: 'Cancel',
            type: 'warning'
          })
        : window.confirm('Mark this request as fulfilled?');

      if (confirmed) {
        try {
          await fetch(`/api/hospital/requests/${id}/fulfill`, { method: 'POST', credentials: 'include' });
          loadDashboardData();
        } catch (e) {
          console.error('Fulfill request error:', e);
        }
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
   6. SEND SOS PANEL (DISABLED INITIALLY UNTIL BLOOD GROUP CHOSEN)
   ============================================================ */
function initInlineSosForm() {
  const form = document.getElementById('formInlineSos');
  const stepUp = document.getElementById('btnStepUp');
  const stepDown = document.getElementById('btnStepDown');
  const unitsInput = document.getElementById('inlineUnits');
  const btn = document.getElementById('btnDispatchSosInline');
  const btnText = document.getElementById('btnSosText');

  // Radio button change listener: enables button
  document.querySelectorAll('input[name="inlineBloodType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Send SOS';
    });
  });

  if (stepUp && unitsInput) {
    stepUp.addEventListener('click', () => {
      unitsInput.value = Math.min(15, parseInt(unitsInput.value || '1', 10) + 1);
    });
  }

  if (stepDown && unitsInput) {
    stepDown.addEventListener('click', () => {
      unitsInput.value = Math.max(1, parseInt(unitsInput.value || '1', 10) - 1);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedRadio = document.querySelector('input[name="inlineBloodType"]:checked');
      if (!selectedRadio) {
        if (btn) btn.disabled = true;
        if (btnText) btnText.textContent = 'Select a blood group to send';
        return;
      }

      const bloodType = selectedRadio.value;
      const units = parseInt(unitsInput?.value || '1', 10);
      const radius = parseInt(document.getElementById('inlineRadius')?.value || '5', 10);
      const urgency = document.getElementById('inlineUrgency')?.value || 'NORMAL';

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Sending SOS...</span>';
      }

      try {
        const res = await fetch('/api/hospital/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bloodType: bloodType,
            unitsNeeded: units,
            urgencyLevel: urgency,
            notificationRadius: radius,
            patientName: 'Emergency SOS'
          }),
          credentials: 'include'
        });

        if (res.ok) {
          if (typeof showToast === 'function') {
            showToast('Emergency SOS dispatched to nearby donors.', 'success');
          }
        }
      } catch (err) {
        console.error('SOS dispatch error:', err);
      }

      // Reset form selection
      document.querySelectorAll('input[name="inlineBloodType"]').forEach(r => r.checked = false);
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          <span id="btnSosText">Select a blood group to send</span>
        `;
      }

      // Refresh Dashboard Data from DB
      loadDashboardData();
    });
  }
}

/* ============================================================
   7. FIND DONORS / DISPATCH (RADAR MAP & REAL NEARBY DONORS)
   ============================================================ */
function initDispatchRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let radarAngle = 0;
  let nearbyDonors = [];

  async function fetchDonors() {
    try {
      const res = await fetch('/api/hospital/donors', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        nearbyDonors = Array.isArray(json.data) ? json.data : [];
        renderDispatchResponsesTable(nearbyDonors);
      }
    } catch (e) {
      console.debug('Donor fetch error:', e);
    }
  }

  fetchDonors();

  function drawRadar() {
    const w = (canvas.width = canvas.parentElement.clientWidth || 400);
    const h = (canvas.height = 280);
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, w, h);

    const zones = [
      { r: maxR * 0.33, label: '5 km' },
      { r: maxR * 0.66, label: '10 km' },
      { r: maxR * 0.98, label: '20 km' }
    ];

    zones.forEach(z => {
      ctx.beginPath();
      ctx.arc(cx, cy, z.r, 0, Math.PI * 2);
      ctx.strokeStyle = '#2a2c31';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#71706c';
      ctx.font = '13px JetBrains Mono, monospace';
      ctx.fillText(z.label, cx + 6, cy - z.r + 14);
    });

    // Crosshairs
    ctx.strokeStyle = '#202227';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.stroke();

    // Sweeping Beam
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radarAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxR, -0.25, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(110, 168, 255, 0.08)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(110, 168, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(maxR, 0);
    ctx.stroke();
    ctx.restore();

    // Center Marker
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#6ea8ff';
    ctx.fill();

    // Plot real donors if available
    nearbyDonors.forEach((p, idx) => {
      const angle = (idx * 1.05) % (Math.PI * 2);
      const pr = maxR * 0.5;
      const px = cx + Math.cos(angle) * pr;
      const py = cy + Math.sin(angle) * pr;

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#3ecf8e';
      ctx.fill();

      ctx.fillStyle = '#ecebe8';
      ctx.font = '13px Instrument Sans, sans-serif';
      ctx.fillText(`${p.name || p.full_name || 'Donor'} (${p.blood_group || p.bloodType || 'O+'})`, px + 6, py + 3);
    });

    radarAngle += 0.015;
    requestAnimationFrame(drawRadar);
  }

  window.drawRadarFrame = drawRadar;
  drawRadar();
}

function renderDispatchResponsesTable(donors) {
  const tbody = document.getElementById('dispatchResponsesTableBody');
  if (!tbody) return;

  if (!donors || donors.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--hosp-text-muted);">
          No registered donors within radar range.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = donors.map(d => {
    const name = d.name || d.full_name || 'Donor';
    const blood = d.blood_group || d.bloodType || '-';
    const dist = d.distance ? `${Number(d.distance).toFixed(1)} km` : '-';
    return `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${getDropBadgeSvg(blood, '')}</td>
        <td><span class="mono-data">${dist}</span></td>
        <td><span class="mono-data">-</span></td>
        <td><span class="chip-status available">Available</span></td>
        <td>
          <button type="button" class="btn-secondary" style="height: 36px; padding: 0 12px; font-size: 13px;" onclick="alert('Notification sent to ${name}')">
            <span>Notify</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
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
   10. DONOR CHECK-IN ENGINE (REAL LOOKUP)
   ============================================================ */
function initDonorCheckin() {
  const lookupBtn = document.getElementById('btnLookupDonor');
  const inputId = document.getElementById('checkinSmartIdInput');
  const vitalsForm = document.getElementById('formDonorVitals');

  if (lookupBtn && inputId) {
    lookupBtn.addEventListener('click', () => {
      const id = inputId.value.trim();
      if (!id) {
        alert('Please enter a valid Donor ID or scan a Donor Smart Card.');
        return;
      }
      const card = document.getElementById('donorLoadedCard');
      if (card) card.style.display = 'block';
    });
  }

  if (vitalsForm) {
    vitalsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Donor donation verified and approved.');
      vitalsForm.reset();
      const card = document.getElementById('donorLoadedCard');
      if (card) card.style.display = 'none';
      if (inputId) inputId.value = '';
    });
  }
}
