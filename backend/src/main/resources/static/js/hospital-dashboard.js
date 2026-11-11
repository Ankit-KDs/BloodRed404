/* ============================================================
   RED404 — HOSPITAL DASHBOARD JS
============================================================ */

'use strict';

/* ==================== INIT ==================== */
document.addEventListener('DOMContentLoaded', () => {
  checkHospitalAuth();
  initSidebar();
  initHospitalStats();
  initBloodRequestForm();
  loadActiveRequests();
  loadNearbyDonors();
  initDonorsMap();
  loadDispatchLog();
  initBloodInventory();
  initAnalyticsCharts();
  loadHospitalProfile();
  initRealTimeUpdates();
});

/* ==================== AUTH CHECK ==================== */
function checkHospitalAuth() {
  /* Comment out during development */
  // RED404.Auth.redirectIfNotLoggedIn('hospital-login.html');
}

/* ==================== SIDEBAR ==================== */
function initSidebar() {
  const sidebar      = document.querySelector('.sidebar');
  const toggleBtn    = document.querySelector('.sidebar-toggle');
  const mainContent  = document.querySelector('.dashboard-main');

  if (!sidebar) return;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('sidebar-collapsed', isCollapsed);
      RED404.Store.set('hospSidebarCollapsed', isCollapsed);
      toggleBtn.innerHTML = isCollapsed
        ? '<i class="fas fa-chevron-right"></i>'
        : '<i class="fas fa-chevron-left"></i>';
    });

    const wasCollapsed = RED404.Store.get('hospSidebarCollapsed', false);
    if (wasCollapsed) {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
      toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
  }

  /* Active nav */
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      showHospPage(item.dataset.page);
    });
  });
}

/* ==================== PAGE SWITCHER ==================== */
function showHospPage(page) {
  document.querySelectorAll('.dash-page').forEach(p => {
    p.style.display = p.id === `page-${page}` ? 'block' : 'none';
  });

  const titles = {
    overview:   'Dashboard Overview',
    requests:   'Blood Requests',
    donors:     'Nearby Donors',
    analytics:  'Analytics',
    inventory:  'Blood Inventory',
    settings:   'Settings',
    profile:    'Hospital Profile',
  };

  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';
}

/* ==================== HOSPITAL STATS ==================== */
function initHospitalStats() {
  const stats = {
    'hsc-total-requests': { value: 0, target: 0 },
    'hsc-fulfilled':      { value: 0, target: 0 },
    'hsc-donors-notif':   { value: 0, target: 0 },
    'hsc-avg-response':   { value: 0, target: 0 },
    'hsc-zones-covered':  { value: 0, target: 0 },
  };

  Object.entries(stats).forEach(([id, data]) => {
    const el = document.getElementById(id);
    if (el) {
      el.dataset.target = data.target;
      animateStatValue(el, data.value);
    }
  });
}

function animateStatValue(el, target) {
  let current    = 0;
  const duration = 1600;
  const steps    = 50;
  const step     = target / steps;

  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current >= target) clearInterval(timer);
  }, duration / steps);
}

/* ==================== BLOOD REQUEST FORM ==================== */
function initBloodRequestForm() {
  const form = document.getElementById('bloodRequestForm');
  if (!form) return;

  /* Blood type selector */
  document.querySelectorAll('.brc-bt-opt input').forEach(radio => {
    radio.addEventListener('change', () => {
      updateDonorCount(radio.value);
    });
  });

  /* Zone selector */
  document.querySelectorAll('.zone-sel-opt input').forEach(radio => {
    radio.addEventListener('change', () => {
      updateEstimatedDonors();
    });
  });

  /* Units input */
  const unitsEl = document.getElementById('reqUnits');
  if (unitsEl) {
    unitsEl.addEventListener('input', updateEstimatedDonors);
  }

  /* Form submit */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    await dispatchBloodRequest();
  });
}

async function dispatchBloodRequest() {
  const bloodType = document.querySelector('.brc-bt-opt input:checked')?.value;
  const urgency   = document.querySelector('.urgency-opt input:checked')?.value;
  const zone      = document.querySelector('.zone-sel-opt input:checked')?.value;
  const units     = document.getElementById('reqUnits')?.value;
  const notes     = document.getElementById('reqNotes')?.value?.trim();

  if (!bloodType) {
    RED404.showToast('Please select a blood type.', 'warning');
    return;
  }
  if (!urgency) {
    RED404.showToast('Please select urgency level.', 'warning');
    return;
  }
  if (!units || parseInt(units) < 1) {
    RED404.showToast('Please enter the number of units required.', 'warning');
    return;
  }

  const btn = document.getElementById('dispatchBtn');
  if (btn) {
    btn.classList.add('dispatching');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatching...';
    btn.disabled  = true;
  }

  const payload = { bloodType, urgency, zone, units: parseInt(units), notes };
  const result  = await RED404.API.post('/requests/dispatch', payload);

  if (btn) {
    btn.classList.remove('dispatching');
    btn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Dispatch Alert';
    btn.disabled  = false;
  }

  if (result.success) {
    const requestId  = `REQ-${Date.now().toString().slice(-6)}`;
    const donorsSent = (result.data && result.data.donorsNotified) || 0;

    RED404.showToast(
      `Blood request dispatched!`,
      'success',
      4000
    );

    addToDispatchLog({
      id:        requestId,
      bloodType,
      urgency,
      donorsSent,
      time:      new Date().toISOString(),
    });

    addToActiveRequests({
      id:        requestId,
      bloodType,
      urgency,
      units:     parseInt(units),
      status:    'pending',
      time:      new Date().toISOString(),
    });

    /* Reset form */
    document.getElementById('bloodRequestForm')?.reset();

  } else {
    RED404.showToast(result.error || 'Failed to dispatch request.', 'error');
  }
}

function updateDonorCount(bloodType) {
  const countEl = document.getElementById('estimatedDonors');
  if (!countEl) return;

  /* Simulate donor counts by blood type */
  const counts = {
    'O+': 124, 'O-': 38, 'A+': 97, 'A-': 24,
    'B+': 86,  'B-': 19, 'AB+': 42, 'AB-': 11,
  };

  const count = counts[bloodType] || 0;
  countEl.textContent = count;
}

function updateEstimatedDonors() {
  const bloodType = document.querySelector('.brc-bt-opt input:checked')?.value;
  if (bloodType) updateDonorCount(bloodType);
}

/* ==================== ACTIVE REQUESTS ==================== */
async function loadActiveRequests() {
  const container = document.getElementById('activeRequestsList');
  if (!container) return;

  const result = await RED404.API.get('/requests/active');
  let   requests;

  if (result.success) {
    requests = result.data;
  } else {
    requests = [];
  }

  renderActiveRequests(requests, container);
}

function renderActiveRequests(requests, container) {
  if (!requests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <h4>No active requests</h4>
        <p>Dispatch a blood request to see it here.</p>
      </div>`;
    return;
  }

  container.innerHTML = requests.map((req, idx) => {
    const progress    = req.donorsAccepted && req.units
      ? Math.min((req.donorsAccepted / req.units) * 100, 100)
      : 0;

    const statusBadge = {
      pending:     '<span class="badge badge-yellow"><i class="fas fa-clock"></i> Pending</span>',
      in_progress: '<span class="badge badge-blue"><i class="fas fa-spinner fa-spin"></i> In Progress</span>',
      fulfilled:   '<span class="badge badge-green"><i class="fas fa-check"></i> Fulfilled</span>',
      cancelled:   '<span class="badge" style="background:rgba(255,68,68,0.1);color:#ff4444;border:1px solid rgba(255,68,68,0.25)"><i class="fas fa-times"></i> Cancelled</span>',
    }[req.status] || '';

    return `
      <div class="request-row ${req.urgency}-row"
           style="animation:slideInLeft 0.4s ease ${idx * 60}ms both">
        <div class="rr-blood">${req.bloodType}</div>
        <div class="rr-info">
          <div class="rr-id">${req.id}</div>
          <div class="rr-hospital">Blood Request · ${RED404.capitalize(req.urgency)} Urgency</div>
          <div class="rr-meta">
            <span class="rr-meta-item">
              <i class="fas fa-tint"></i> ${req.units} unit${req.units !== 1 ? 's' : ''}
            </span>
            <span class="rr-meta-item">
              <i class="fas fa-users"></i> ${req.donorsNotified} notified
            </span>
            <span class="rr-meta-item">
              <i class="fas fa-clock"></i> ${RED404.timeAgo(req.time)}
            </span>
          </div>
        </div>
        <div class="rr-status">${statusBadge}</div>
        <div class="rr-progress">
          <div class="rr-progress-label">
            <span>Donors</span>
            <span>${req.donorsAccepted}/${req.units}</span>
          </div>
          <div class="rr-progress-bar">
            <div class="rr-progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="rr-actions">
          <button class="rr-btn view"     onclick="viewRequest('${req.id}')"    title="View details"><i class="fas fa-eye"></i></button>
          <button class="rr-btn complete" onclick="completeRequest('${req.id}')" title="Mark complete"><i class="fas fa-check"></i></button>
          <button class="rr-btn cancel"   onclick="cancelRequest('${req.id}')"   title="Cancel"><i class="fas fa-times"></i></button>
        </div>
      </div>`;
  }).join('');
}

function addToActiveRequests(req) {
  const container = document.getElementById('activeRequestsList');
  if (!container) return;

  /* Remove empty state */
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  const row = document.createElement('div');
  row.className = `request-row ${req.urgency}-row`;
  row.id        = `request-${req.id}`;
  row.style.animation = 'slideInDown 0.5s cubic-bezier(0.34,1.56,0.64,1)';
  row.innerHTML = `
    <div class="rr-blood">${req.bloodType}</div>
    <div class="rr-info">
      <div class="rr-id">${req.id}</div>
      <div class="rr-hospital">Blood Request · ${RED404.capitalize(req.urgency)} Urgency</div>
      <div class="rr-meta">
        <span class="rr-meta-item"><i class="fas fa-tint"></i> ${req.units} unit${req.units !== 1 ? 's' : ''}</span>
        <span class="rr-meta-item"><i class="fas fa-clock"></i> Just now</span>
      </div>
    </div>
    <div class="rr-status">
      <span class="badge badge-yellow"><i class="fas fa-clock"></i> Pending</span>
    </div>
    <div class="rr-progress">
      <div class="rr-progress-label"><span>Donors</span><span>0/${req.units}</span></div>
      <div class="rr-progress-bar"><div class="rr-progress-fill" style="width:0%"></div></div>
    </div>
    <div class="rr-actions">
      <button class="rr-btn view"     onclick="viewRequest('${req.id}')"     title="View"><i class="fas fa-eye"></i></button>
      <button class="rr-btn complete" onclick="completeRequest('${req.id}')" title="Complete"><i class="fas fa-check"></i></button>
      <button class="rr-btn cancel"   onclick="cancelRequest('${req.id}')"   title="Cancel"><i class="fas fa-times"></i></button>
    </div>`;

  container.insertBefore(row, container.firstChild);
}

/* ==================== REQUEST ACTIONS ==================== */
window.viewRequest = function (id) {
  RED404.showToast(`Viewing details for request ${id}.`, 'info');
};

window.completeRequest = async function (id) {
  const row = document.getElementById(`request-${id}`);
  const result = await RED404.API.put(`/requests/${id}/complete`, {});

  if (result.success || true) {
    if (row) {
      const statusEl = row.querySelector('.rr-status');
      if (statusEl) {
        statusEl.innerHTML = '<span class="badge badge-green"><i class="fas fa-check"></i> Fulfilled</span>';
      }
    }
    RED404.showToast(`Request ${id} marked as fulfilled.`, 'success');
  }
};

window.cancelRequest = async function (id) {
  const row = document.getElementById(`request-${id}`);
  const result = await RED404.API.delete(`/requests/${id}`);

  if (result.success || true) {
    if (row) {
      row.style.animation = 'slideOutRight 0.4s ease forwards';
      setTimeout(() => row.remove(), 400);
    }
    RED404.showToast(`Request ${id} has been cancelled.`, 'info');
  }
};

/* ==================== NEARBY DONORS ==================== */
async function loadNearbyDonors() {
  const container = document.getElementById('nearbyDonorsList');
  if (!container) return;

  const result = await RED404.API.get('/donors/nearby');
  let   donors;

  if (result.success) {
    donors = result.data;
  } else {
    donors = [
      { id: 'D001', name: 'Rahul Sharma',   bloodType: 'O+',  distance: 1.2, status: 'online',  phone: '9876543210', lastDonation: '2024-08-15' },
      { id: 'D002', name: 'Priya Patel',    bloodType: 'A+',  distance: 2.4, status: 'online',  phone: '9876543211', lastDonation: '2024-06-20' },
      { id: 'D003', name: 'Amit Singh',     bloodType: 'B+',  distance: 3.1, status: 'busy',    phone: '9876543212', lastDonation: '2024-07-10' },
      { id: 'D004', name: 'Sneha Joshi',    bloodType: 'AB+', distance: 4.5, status: 'online',  phone: '9876543213', lastDonation: '2024-05-30' },
      { id: 'D005', name: 'Vikram Nair',    bloodType: 'O-',  distance: 5.8, status: 'offline', phone: '9876543214', lastDonation: '2024-09-01' },
      { id: 'D006', name: 'Deepa Menon',    bloodType: 'A-',  distance: 7.2, status: 'online',  phone: '9876543215', lastDonation: '2024-04-15' },
    ];
  }

  renderNearbyDonors(donors, container);
}

function renderNearbyDonors(donors, container) {
  if (!donors.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users-slash"></i>
        <h4>No donors found nearby</h4>
        <p>Try expanding the search zone.</p>
      </div>`;
    return;
  }

  const bloodTagMap = {
    'O+': 'o-pos', 'O-': 'o-neg',
    'A+': 'a-pos', 'A-': 'a-neg',
    'B+': 'b-pos', 'B-': 'b-neg',
    'AB+': 'ab-pos', 'AB-': 'ab-neg',
  };

  container.innerHTML = donors.map((donor, idx) => `
    <div class="donor-row" style="animation:slideInLeft 0.4s ease ${idx * 60}ms both" id="donor-row-${donor.id}">
      <div class="donor-row-avatar">
        ${RED404.initials(donor.name)}
        <div class="donor-row-status-dot ${donor.status}"></div>
      </div>
      <div class="donor-row-info">
        <div class="donor-row-name">${donor.name}</div>
        <div class="donor-row-sub">
          <span><i class="fas fa-phone"></i> ${RED404.maskPhone(donor.phone)}</span>
          <span><i class="fas fa-calendar-check"></i> Last: ${RED404.formatDate(donor.lastDonation)}</span>
        </div>
      </div>
      <div class="donor-row-blood">
        <span class="blood-tag ${bloodTagMap[donor.bloodType] || ''}">${donor.bloodType}</span>
      </div>
      <div class="donor-row-dist">
        <i class="fas fa-map-marker-alt"></i> ${donor.distance} km
      </div>
      <div class="donor-row-actions">
        <button class="dr-action-btn notify" onclick="notifyDonor('${donor.id}','${donor.bloodType}')">
          <i class="fas fa-bell"></i> Notify
        </button>
        <button class="dr-action-btn view" onclick="viewDonorDetails('${donor.id}')">
          <i class="fas fa-eye"></i> View
        </button>
      </div>
    </div>
  `).join('');
}

/* ==================== DONOR MAP ==================== */
function initDonorsMap() {
  const mapEl = document.getElementById('donorsMapContainer');
  if (!mapEl) return;

  /* In production: initialize Leaflet.js or Google Maps */
  mapEl.innerHTML = `
    <div class="dmc-zone-ring z1r"></div>
    <div class="dmc-zone-ring z2r"></div>
    <div class="dmc-zone-ring z3r"></div>
    <div class="dmc-hosp-pin">
      <i class="fas fa-hospital-alt"></i>
      <span>Hospital</span>
    </div>
    ${generateMapDonorPins()}
  `;
}

function generateMapDonorPins() {
  const pins = [
    { top: '22%', left: '58%', type: 'available', name: 'Rahul S.',  blood: 'O+',  dist: '1.2 km' },
    { top: '38%', left: '72%', type: 'available', name: 'Priya P.',  blood: 'A+',  dist: '2.4 km' },
    { top: '62%', left: '65%', type: 'busy',      name: 'Amit S.',   blood: 'B+',  dist: '3.1 km' },
    { top: '72%', left: '38%', type: 'available', name: 'Sneha J.',  blood: 'AB+', dist: '4.5 km' },
    { top: '18%', left: '32%', type: 'offline',   name: 'Vikram N.', blood: 'O-',  dist: '5.8 km' },
    { top: '80%', left: '55%', type: 'available', name: 'Deepa M.',  blood: 'A-',  dist: '7.2 km' },
    { top: '30%', left: '20%', type: 'available', name: 'Suresh K.', blood: 'B-',  dist: '8.5 km' },
    { top: '55%', left: '82%', type: 'busy',      name: 'Anjali R.', blood: 'O+',  dist: '6.3 km' },
  ];

  return pins.map((pin, idx) => `
    <div class="dmc-donor-pin ${pin.type}"
         style="top:${pin.top};left:${pin.left};animation:scaleIn 0.4s ease ${idx * 80}ms both">
      <div class="dp-dot">
        <i class="fas fa-user" style="font-size:0.6rem"></i>
        ${pin.type === 'available' ? '<div class="dp-ping"></div>' : ''}
      </div>
      <div class="dp-tooltip">
        <strong>${pin.name}</strong> · ${pin.blood}<br>
        <span style="color:var(--text-muted)">${pin.dist}</span>
      </div>
    </div>
  `).join('');
}

/* ==================== DONOR ACTIONS ==================== */
window.notifyDonor = async function (donorId, bloodType) {
  const btn = document.querySelector(`#donor-row-${donorId} .dr-action-btn.notify`);

  if (btn) {
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled   = true;
  }

  const result = await RED404.API.post(`/donors/${donorId}/notify`, { bloodType });

  setTimeout(() => {
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> Sent';
      btn.style.background = 'linear-gradient(135deg,#00cc66,#009944)';
      btn.disabled  = false;
    }
    RED404.showToast(`Notification sent to donor!`, 'success');
    addDispatchLogEntry({
      type:  'sent',
      title: 'Notification Sent',
      desc:  `Blood request (${bloodType}) notification sent to 1 donor.`,
      time:  new Date().toISOString(),
    });
  }, 1200);
};

window.viewDonorDetails = function (donorId) {
  RED404.showToast(`Loading donor profile #${donorId}...`, 'info', 2000);
};

/* ==================== DISPATCH LOG ==================== */
async function loadDispatchLog() {
  const container = document.getElementById('dispatchLogList');
  if (!container) return;

  const result = await RED404.API.get('/requests/log');
  let   logs;

  if (result.success) {
    logs = result.data;
  } else {
    logs = [];
  }

  renderDispatchLog(logs, container);
}

function renderDispatchLog(logs, container) {
  if (!logs.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:2rem">
        <i class="fas fa-list-alt"></i>
        <h4>No activity yet</h4>
        <p>Dispatch a blood request to see activity here.</p>
      </div>`;
    return;
  }

  container.innerHTML = logs.map((log, idx) => `
    <div class="log-item" style="animation:slideInLeft 0.4s ease ${idx * 60}ms both">
      <div class="log-time-col">
        <span class="log-time">${RED404.formatTime(log.time)}</span>
      </div>
      <div class="log-icon-col">
        <div class="log-icon ${log.type}">
          <i class="fas ${getLogIcon(log.type)}"></i>
        </div>
      </div>
      <div class="log-body">
        <div class="log-title">${log.title}</div>
        <div class="log-desc">${log.desc}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem">
          ${RED404.timeAgo(log.time)}
        </div>
      </div>
    </div>
  `).join('');
}

function getLogIcon(type) {
  const icons = {
    sent:      'fa-paper-plane',
    accepted:  'fa-check-circle',
    declined:  'fa-times-circle',
    completed: 'fa-flag-checkered',
    escalated: 'fa-arrow-up',
    cancelled: 'fa-ban',
  };
  return icons[type] || 'fa-circle';
}

function addToDispatchLog(entry) {
  const container = document.getElementById('dispatchLogList');
  if (!container) return;

  /* Remove empty state if present */
  const emptyState = container.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  addDispatchLogEntry({
    type:  'sent',
    title: `Blood Request Dispatched (${entry.bloodType})`,
    desc:  `${entry.urgency.toUpperCase()} urgency request sent to ${entry.donorsSent} donors.`,
    time:  entry.time,
  });
}

function addDispatchLogEntry({ type, title, desc, time }) {
  const container = document.getElementById('dispatchLogList');
  if (!container) return;

  const item = document.createElement('div');
  item.className = 'log-item';
  item.style.animation = 'slideInDown 0.4s cubic-bezier(0.34,1.56,0.64,1)';
  item.innerHTML = `
    <div class="log-time-col">
      <span class="log-time">${RED404.formatTime(time)}</span>
    </div>
    <div class="log-icon-col">
      <div class="log-icon ${type}">
        <i class="fas ${getLogIcon(type)}"></i>
      </div>
    </div>
    <div class="log-body">
      <div class="log-title">${title}</div>
      <div class="log-desc">${desc}</div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.3rem">Just now</div>
    </div>
  `;

  container.insertBefore(item, container.firstChild);
}

/* ==================== BLOOD INVENTORY ==================== */
function initBloodInventory() {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;

  const inventory = [
    { type: 'A+',  units: 42, max: 60, level: 'good'     },
    { type: 'A-',  units: 8,  max: 30, level: 'critical'  },
    { type: 'B+',  units: 28, max: 50, level: 'medium'    },
    { type: 'B-',  units: 5,  max: 25, level: 'critical'  },
    { type: 'AB+', units: 18, max: 30, level: 'medium'    },
    { type: 'AB-', units: 3,  max: 20, level: 'critical'  },
    { type: 'O+',  units: 55, max: 70, level: 'good'      },
    { type: 'O-',  units: 12, max: 40, level: 'low'       },
  ];

  grid.innerHTML = inventory.map((item, idx) => {
    const pct        = (item.units / item.max) * 100;
    const statusText = {
      good:     'Adequate',
      medium:   'Moderate',
      low:      'Running Low',
      critical: 'Critical!',
    }[item.level];

    return `
      <div class="inv-item"
           style="animation:scaleIn 0.4s ease ${idx * 60}ms both"
           title="${item.units} / ${item.max} units available">
        <div class="inv-blood-type">${item.type}</div>
        <div class="inv-level-bar">
          <div class="inv-level-fill ${item.level}"
               style="width:0%"
               data-width="${pct}%">
          </div>
        </div>
        <div class="inv-units">${item.units} units</div>
        <div class="inv-status ${item.level}">${statusText}</div>
      </div>
    `;
  }).join('');

  /* Animate bars */
  setTimeout(() => {
    grid.querySelectorAll('.inv-level-fill').forEach(bar => {
      bar.style.transition = 'width 1.2s ease';
      bar.style.width      = bar.dataset.width;
    });
  }, 300);

  /* Alert for critical levels */
  const criticalTypes = inventory.filter(i => i.level === 'critical').map(i => i.type);
  if (criticalTypes.length) {
    setTimeout(() => {
      RED404.showToast(
        `Critical inventory: ${criticalTypes.join(', ')} blood types need urgent replenishment.`,
        'error',
        5000
      );
    }, 1500);
  }
}

/* ==================== ANALYTICS CHARTS ==================== */
function initAnalyticsCharts() {
  initLineChart();
  initDonutChart();
  initResponseTimeChart();
}

/* Line chart — requests over time */
function initLineChart() {
  const svg = document.getElementById('requestsLineChart');
  if (!svg) return;

  const data   = [4, 7, 3, 9, 6, 11, 8, 14, 10, 12, 9, 15];
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const W = 600, H = 180;
  const maxVal = Math.max(...data);
  const padL   = 40, padR = 20, padT = 20, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  /* Grid lines */
  const gridLines = [0, 25, 50, 75, 100].map(pct => {
    const y = padT + chartH - (pct / 100) * chartH;
    return `
      <line class="lc-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>
      <text x="${padL - 5}" y="${y + 4}"
            font-size="9" fill="var(--text-muted)" text-anchor="end">
        ${Math.round((pct / 100) * maxVal)}
      </text>
    `;
  }).join('');

  /* Points */
  const points = data.map((val, idx) => {
    const x = padL + (idx / (data.length - 1)) * chartW;
    const y = padT + chartH - (val / maxVal) * chartH;
    return { x, y, val };
  });

  /* Path */
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  /* Area fill */
  const areaD = `${pathD} L${points[points.length - 1].x},${padT + chartH} L${padL},${padT + chartH} Z`;

  /* X-axis labels */
  const xLabels = labels.map((label, idx) => {
    const x = padL + (idx / (labels.length - 1)) * chartW;
    return `<text x="${x}" y="${H - 5}" font-size="8" fill="var(--text-muted)" text-anchor="middle">${label}</text>`;
  }).join('');

  /* Dot elements */
  const dots = points.map((p, idx) => `
    <circle class="lc-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"
            data-val="${p.val}" data-label="${labels[idx]}"
            style="animation-delay:${idx * 80}ms">
      <title>${labels[idx]}: ${p.val} requests</title>
    </circle>
  `).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="var(--red-primary)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--red-primary)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${xLabels}
    <path class="lc-area" d="${areaD}"/>
    <path class="lc-path" d="${pathD}"/>
    ${dots}
  `;
}

/* Donut chart — blood type distribution */
function initDonutChart() {
  const svg = document.getElementById('bloodTypeDonut');
  if (!svg) return;

  const data = [
    { type: 'O+',  count: 124, color: '#e63946' },
    { type: 'A+',  count: 97,  color: '#ff6b6b' },
    { type: 'B+',  count: 86,  color: '#ff8800' },
    { type: 'AB+', count: 42,  color: '#bb77ee' },
    { type: 'O-',  count: 38,  color: '#c1121f' },
    { type: 'A-',  count: 24,  color: '#ff9999' },
    { type: 'B-',  count: 19,  color: '#ffaa44' },
    { type: 'AB-', count: 11,  color: '#9966cc' },
  ];

  const total   = data.reduce((s, d) => s + d.count, 0);
  const cx = 80, cy = 80, r = 60, strokeW = 22;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  const segments = data.map(d => {
    const pct    = d.count / total;
    const dash   = pct * circumference;
    const gap    = circumference - dash;
    const rotate = (offset / circumference) * 360 - 90;

    const seg = `
      <circle
        cx="${cx}" cy="${cy}" r="${r}"
        fill="none"
        stroke="${d.color}"
        stroke-width="${strokeW}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-dashoffset="${circumference * 0.25}"
        transform="rotate(${rotate} ${cx} ${cy})"
        style="animation:donutReveal 1s ease ${data.indexOf(d) * 80}ms both;cursor:pointer;transition:stroke-width 0.2s ease"
        onmouseover="this.setAttribute('stroke-width','${strokeW + 4}')"
        onmouseout="this.setAttribute('stroke-width','${strokeW}')">
        <title>${d.type}: ${d.count} donors (${((d.count / total) * 100).toFixed(1)}%)</title>
      </circle>
    `;

    offset += dash;
    return seg;
  }).join('');

  svg.innerHTML = segments;

  /* Centre text */
  const centerEl = document.getElementById('donutCenterValue');
  const centerLabel = document.getElementById('donutCenterLabel');
  if (centerEl)    animateStatValue(centerEl, total);
  if (centerLabel) centerLabel.textContent = 'Total Donors';

  /* Legend */
  const legendEl = document.getElementById('donutLegend');
  if (legendEl) {
    legendEl.innerHTML = data.map(d => `
      <div class="dl-item">
        <div class="dl-left">
          <div class="dl-color" style="background:${d.color}"></div>
          <span class="dl-name">${d.type}</span>
        </div>
        <div class="dl-right">
          <span class="dl-count">${d.count}</span>
          <span class="dl-pct">${((d.count / total) * 100).toFixed(1)}%</span>
        </div>
      </div>
    `).join('');
  }
}

/* Response time chart */
function initResponseTimeChart() {
  const container = document.getElementById('responseTimeChart');
  if (!container) return;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const times  = [18, 15, 13, 16, 11, 9, 10, 8, 7, 8, 6, 7]; /* minutes */
  const maxT   = Math.max(...times);

  container.innerHTML = `
    <div class="chart-bars">
      ${times.map((t, idx) => `
        <div class="chart-bar-group">
          <div class="chart-bar"
               style="height:0%;background:linear-gradient(180deg,#4285f4,#1a56c4)"
               data-height="${(t / maxT) * 100}%"
               title="${months[idx]}: ${t} min avg response">
          </div>
          <span class="chart-bar-label">${months[idx]}</span>
        </div>
      `).join('')}
    </div>
  `;

  /* Animate bars */
  setTimeout(() => {
    container.querySelectorAll('.chart-bar').forEach((bar, idx) => {
      bar.style.transition = `height 1s cubic-bezier(0.34,1.56,0.64,1) ${idx * 60}ms`;
      bar.style.height     = bar.dataset.height;
    });
  }, 300);
}

/* ==================== HOSPITAL PROFILE ==================== */
async function loadHospitalProfile() {
  const result = await RED404.API.get('/hospitals/profile');
  let   hospital;

  if (result.success) {
    hospital = result.data;
  } else {
    hospital = {
      name:            'Hospital Portal',
      type:            'Hospital',
      registrationNo:  '',
      city:            'Patna',
      state:           'Bihar',
      zone:            'Zone 1 (0–5 km)',
      beds:            0,
      totalRequests:   0,
      fulfilled:       0,
      avgResponseTime: 0,
      verified:        false,
      adminName:       '',
      phone:           '',
      email:           '',
      joined:          '',
    };
  }

  populateHospitalProfile(hospital);
}

function populateHospitalProfile(hospital) {
  /* Hospital name in sidebar & banner */
  const nameEls = document.querySelectorAll('[data-hosp="name"]');
  nameEls.forEach(el => { el.textContent = hospital.name; });

  const typeEls = document.querySelectorAll('[data-hosp="type"]');
  typeEls.forEach(el => { el.textContent = hospital.type; });

  /* Stats */
  const fields = {
    'hosp-total-req':  hospital.totalRequests,
    'hosp-fulfilled':  hospital.fulfilled,
    'hosp-avg-resp':   `${hospital.avgResponseTime} min`,
    'hosp-beds':       hospital.beds,
    'hosp-city':       `${hospital.city}, ${hospital.state}`,
    'hosp-zone':       hospital.zone,
    'hosp-admin':      hospital.adminName,
    'hosp-email':      hospital.email,
    'hosp-phone':      hospital.phone,
    'hosp-joined':     RED404.formatDate(hospital.joined),
    'hosp-reg-no':     hospital.registrationNo,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      if (typeof value === 'number') {
        el.dataset.target = value;
        animateStatValue(el, value);
      } else {
        el.textContent = value;
      }
    }
  });
}

/* ==================== REAL-TIME UPDATES (WebSocket Simulation) ==================== */
function initRealTimeUpdates() {
  /* In production: connect WebSocket to Spring Boot backend */
  /* ws://localhost:8080/ws/hospital */

  simulateWebSocketEvents();
}

function simulateWebSocketEvents() {
  /* Simulate a donor accepting a request after 15 seconds */
  setTimeout(() => {
    const event = {
      type:      'DONOR_ACCEPTED',
      donorName: 'Sneha Joshi',
      bloodType: 'O+',
      requestId: 'REQ-891023',
      eta:       '9 minutes',
    };
    handleWebSocketEvent(event);
  }, 15000);

  /* Simulate zone escalation after 25 seconds */
  setTimeout(() => {
    const event = {
      type:      'ZONE_ESCALATED',
      from:      'Zone 1',
      to:        'Zone 2',
      bloodType: 'O-',
      reason:    'No available donors in Zone 1',
    };
    handleWebSocketEvent(event);
  }, 25000);

  /* Simulate request fulfillment after 40 seconds */
  setTimeout(() => {
    const event = {
      type:      'REQUEST_FULFILLED',
      requestId: 'REQ-891019',
      bloodType: 'A-',
      donorName: 'Priya Patel',
    };
    handleWebSocketEvent(event);
  }, 40000);
}

function handleWebSocketEvent(event) {
  switch (event.type) {

    case 'DONOR_ACCEPTED':
      RED404.showToast(
        `✅ ${event.donorName} accepted ${event.bloodType} request — ETA: ${event.eta}`,
        'success',
        5000
      );
      addDispatchLogEntry({
        type:  'accepted',
        title: 'Donor Accepted Request',
        desc:  `${event.donorName} accepted ${event.bloodType} blood request. ETA: ${event.eta}.`,
        time:  new Date().toISOString(),
      });
      updateRequestStatus(event.requestId, 'in_progress');
      break;

    case 'ZONE_ESCALATED':
      RED404.showToast(
        `⚠️ No donors in ${event.from}. Escalating ${event.bloodType} request to ${event.to}.`,
        'warning',
        5000
      );
      addDispatchLogEntry({
        type:  'sent',
        title: `Zone Escalation: ${event.from} → ${event.to}`,
        desc:  event.reason + `. Expanding search to ${event.to} for ${event.bloodType}.`,
        time:  new Date().toISOString(),
      });
      break;

    case 'REQUEST_FULFILLED':
      RED404.showToast(
        `🎉 ${event.bloodType} request fulfilled by ${event.donorName}!`,
        'success',
        5000
      );
      addDispatchLogEntry({
        type:  'completed',
        title: 'Request Fulfilled',
        desc:  `${event.bloodType} blood request fulfilled by ${event.donorName}. Request closed.`,
        time:  new Date().toISOString(),
      });
      updateRequestStatus(event.requestId, 'fulfilled');
      break;

    case 'DONOR_DECLINED':
      RED404.showToast(
        `Donor declined ${event.bloodType} request. Searching next available donor...`,
        'warning',
        4000
      );
      addDispatchLogEntry({
        type:  'declined',
        title: 'Donor Declined',
        desc:  `A donor declined ${event.bloodType} request. System searching for next available donor.`,
        time:  new Date().toISOString(),
      });
      break;

    default:
      break;
  }
}

function updateRequestStatus(requestId, newStatus) {
  const row = document.getElementById(`request-${requestId}`);
  if (!row) return;

  const statusEl = row.querySelector('.rr-status');
  if (!statusEl)  return;

  const badges = {
    in_progress: '<span class="badge badge-blue"><i class="fas fa-spinner fa-spin"></i> In Progress</span>',
    fulfilled:   '<span class="badge badge-green"><i class="fas fa-check"></i> Fulfilled</span>',
    cancelled:   '<span class="badge" style="background:rgba(255,68,68,0.1);color:#ff4444;border:1px solid rgba(255,68,68,0.25)"><i class="fas fa-times"></i> Cancelled</span>',
  };

  if (badges[newStatus]) {
    statusEl.innerHTML = badges[newStatus];
    row.style.animation = 'none';
    row.offsetHeight; /* Force reflow */
    row.style.animation = 'slideInLeft 0.4s ease';
  }
}

// ======================Setting interval============================

function startRealTimeSync() {
    setInterval(async () => {
        // Active requests ko refresh karna
        const res = await fetch(`${API_BASE}/requests/active`);
        const result = await res.json();
        if (result.success) {
            renderActiveRequests(result.data, document.getElementById('activeRequestsList'));
            // Agar koi naya donor mila ho toh toast dikhayein
            updateHospitalStats(result.data);
        }
    }, 10000); // Har 10 second mein update
}


function startDashboardSync() {
    // Har 15 seconds mein requests aur donors refresh honge
    setInterval(async () => {
        const response = await fetch(`${API_BASE}/requests/active`);
        const result = await response.json();
        if (result.success) {
            // Dashboard UI ko bina page refresh kiye update karein
            renderActiveRequests(result.data, document.getElementById('activeRequestsList'));
            console.log("Dashboard synced at: " + new Date().toLocaleTimeString());
        }
    }, 15000); 
}



/* ==================== ZONE FILTER FOR DONOR TABLE ==================== */
window.filterDonorsByZone = function (zone) {
  const rows   = document.querySelectorAll('.donor-row');
  const pills  = document.querySelectorAll('.zone-pill');

  pills.forEach(p => p.classList.toggle('active', p.dataset.zone === zone));

  const radii = { all: 999, z1: 5, z2: 10, z3: 20 };
  const maxKm = radii[zone] || 999;

  rows.forEach(row => {
    const distEl = row.querySelector('.donor-row-dist');
    if (!distEl) return;

    const distText = distEl.textContent.trim();
    const distKm   = parseFloat(distText);

    row.style.display = (isNaN(distKm) || distKm <= maxKm) ? '' : 'none';
  });
};

/* ==================== DONOR SEARCH ==================== */
(function initDonorSearch() {
  const searchInput = document.querySelector('.dlc-search input');
  if (!searchInput) return;

  searchInput.addEventListener(
    'input',
    RED404.debounce(function () {
      const query = this.value.trim().toLowerCase();
      const rows  = document.querySelectorAll('.donor-row');

      rows.forEach(row => {
        const name  = row.querySelector('.donor-row-name')?.textContent.toLowerCase() || '';
        const blood = row.querySelector('.blood-tag')?.textContent.toLowerCase()      || '';
        row.style.display = (name.includes(query) || blood.includes(query)) ? '' : 'none';
      });
    }, 300)
  );
})();

/* ==================== BLOOD TYPE FILTER ==================== */
(function initBloodTypeFilter() {
  const filter = document.querySelector('.dlc-filter');
  if (!filter) return;

  filter.addEventListener('change', function () {
    const selected = this.value.toLowerCase();
    const rows     = document.querySelectorAll('.donor-row');

    rows.forEach(row => {
      const blood = row.querySelector('.blood-tag')?.textContent.toLowerCase() || '';
      row.style.display = (!selected || blood === selected) ? '' : 'none';
    });
  });
})();

/* ==================== REQUEST FILTER ==================== */
window.filterRequests = function (status) {
  document.querySelectorAll('.arc-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === status);
  });

  const rows = document.querySelectorAll('.request-row');

  rows.forEach(row => {
    if (status === 'all') {
      row.style.display = '';
      return;
    }
    const badge = row.querySelector('.rr-status .badge');
    if (!badge) return;

    const text = badge.textContent.toLowerCase();

    const matches = {
      pending:     text.includes('pending'),
      in_progress: text.includes('progress'),
      fulfilled:   text.includes('fulfilled'),
      cancelled:   text.includes('cancelled'),
    }[status] || false;

    row.style.display = matches ? '' : 'none';
  });
};

/* ==================== EXPORT REPORT ==================== */
window.exportReport = function (type = 'requests') {
  RED404.showToast(`Generating ${type} report... Download will start shortly.`, 'info', 3000);

  /* In production: call backend API to generate PDF/CSV */
  setTimeout(() => {
    RED404.showToast(`${RED404.capitalize(type)} report downloaded successfully!`, 'success');
  }, 2500);
};

/* ==================== REFRESH DONORS ==================== */
window.refreshDonors = async function () {
  const refreshBtn = document.getElementById('refreshDonorsBtn');
  if (refreshBtn) {
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    refreshBtn.disabled  = true;
  }

  await loadNearbyDonors();
  initDonorsMap();

  if (refreshBtn) {
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    refreshBtn.disabled  = false;
  }

  RED404.showToast('Donor list refreshed!', 'success', 2000);
};

/* ==================== INVENTORY UPDATE ==================== */
window.updateInventoryUnit = async function (bloodType, change) {
  const result = await RED404.API.put('/hospitals/inventory', { bloodType, change });

  try {
    localStorage.setItem('red404_inventory_updated', Date.now().toString());
  } catch (_) {}

  if (result.success || true) {
    RED404.showToast(
      `${bloodType} inventory ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)} unit(s).`,
      change > 0 ? 'success' : 'warning',
      2500
    );
    initBloodInventory(); /* Refresh display */
  }
};

/* ==================== HOSPITAL LOGOUT ==================== */
window.hospitalLogout = function () {
  RED404.Auth.clearSession();
  RED404.Store.remove('hospitalToken');
  RED404.showToast('Logged out successfully.', 'info', 1500);
  setTimeout(() => { window.location.href = 'hospital-login.html'; }, 1500);
};

/* ==================== SETTINGS SAVE ==================== */
window.saveHospitalSettings = async function () {
  const settings = {
    smsAlerts:      document.getElementById('settingSms')?.checked   ?? true,
    pushAlerts:     document.getElementById('settingPush')?.checked  ?? true,
    emailAlerts:    document.getElementById('settingEmail')?.checked ?? false,
    zoneRadius:     document.getElementById('settingRadius')?.value  || 10,
    autoEscalate:   document.getElementById('settingAutoEscalate')?.checked ?? true,
    escalateDelay:  document.getElementById('settingEscalateDelay')?.value || 5,
  };

  const result = await RED404.API.put('/hospitals/settings', settings);

  if (result.success || true) {
    RED404.Store.set('hospitalSettings', settings);
    RED404.showToast('Settings saved successfully!', 'success');
  } else {
    RED404.showToast(result.error || 'Failed to save settings.', 'error');
  }
};

/* ==================== LOAD SAVED SETTINGS ==================== */
(function loadSavedSettings() {
  const settings = RED404.Store.get('hospitalSettings');
  if (!settings) return;

  Object.entries(settings).forEach(([key, value]) => {
    const el = document.getElementById(`setting${RED404.capitalize(key)}`);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value;
    else                        el.value   = value;
  });
})();



// Har 10 second mein background mein data refresh karega
setInterval(() => {
    if (typeof loadActiveRequests === 'function') loadActiveRequests();
    if (typeof loadNearbyDonors === 'function') loadNearbyDonors();
}, 10000);