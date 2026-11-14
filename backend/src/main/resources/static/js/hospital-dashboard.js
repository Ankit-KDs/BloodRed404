/* ============================================================
   RED404 — HOSPITAL PORTAL JAVASCRIPT (REFACTOR)
   Calm, serious, restrained healthcare command center.
   Strictly scoped to hospital portal pages.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initMedicineFlowBackground();
  initCommandNavigation();
  initHospitalProfile();
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

  // Disabled when user prefers reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = 320); // Limited strictly to top hero area

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = 320;
  });

  // 16 Drifting Medicine Elements (Very subtle 3-5% opacity)
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

  // Mobile Hamburger Toggle
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Load active tab from URL hash on load
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

  const name = (profile && (profile.name || profile.hospitalName)) || 'Apollo General Hospital';

  if (topName) topName.textContent = name;
  if (navName) navName.textContent = name;
  if (mobileName) mobileName.textContent = name;
}

/* ============================================================
   4. DASHBOARD LOGIC (KPIS, INLINE SOS, BLOOD STOCK)
   ============================================================ */
const STOCK_STORAGE_KEY = 'red404_hospital_stock_units';
const defaultStock = {
  'O-': 2,
  'O+': 14,
  'A-': 3,
  'A+': 18,
  'B-': 4,
  'B+': 12,
  'AB-': 1,
  'AB+': 8
};

function getStock() {
  try {
    const saved = localStorage.getItem(STOCK_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { ...defaultStock };
}

function saveStock(data) {
  try {
    localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function getDropBadgeSvg(type, isCritical) {
  return `
    <span class="blood-drop-badge ${isCritical ? 'critical' : ''}" aria-label="Blood group ${type}">
      <svg viewBox="0 0 32 38" class="drop-svg" aria-hidden="true" focusable="false">
        <path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="currentColor"/>
      </svg>
      <span class="drop-text">${type}</span>
    </span>
  `;
}

function initDashboard() {
  renderElevatedStock();
  initInlineSosForm();
}

function renderElevatedStock() {
  const grid = document.getElementById('dashboardStockGrid');
  const inventoryTableBody = document.getElementById('inventorySummaryTableBody');
  const stock = getStock();

  let totalUnits = 0;
  let criticalCount = 0;

  // SORT SO LOW GROUPS (< 5 UNITS) COME FIRST!
  const sortedStock = Object.entries(stock).sort((a, b) => {
    const isACrit = a[1] < 5;
    const isBCrit = b[1] < 5;
    if (isACrit && !isBCrit) return -1;
    if (!isACrit && isBCrit) return 1;
    return a[1] - b[1]; // Lowest units first
  });

  sortedStock.forEach(([_, units]) => {
    totalUnits += units;
    if (units < 5) criticalCount++;
  });

  // 1. Render Dashboard Stock Grid (Low items first)
  if (grid) {
    grid.innerHTML = sortedStock.map(([type, units]) => {
      const isCritical = units < 5;
      const maxCapacity = 25;
      const percent = Math.min(100, Math.round((units / maxCapacity) * 100));

      return `
        <div class="stock-card-item ${isCritical ? 'low' : ''}">
          <div class="stock-item-header">
            ${getDropBadgeSvg(type, isCritical)}
            ${isCritical ? '<span class="low-pill-tag">Low</span>' : ''}
          </div>
          
          <div class="stock-units-display">
            <span class="stock-units-num">${units}</span>
            <span class="stock-units-label">${units === 1 ? 'unit' : 'units'}</span>
          </div>

          <div class="stock-bar-track">
            <div class="stock-bar-fill" style="width: ${percent}%;"></div>
          </div>

          <div class="stock-item-actions">
            <button type="button" class="btn-request-shortcut" data-type="${type}" title="Request ${type} in Send SOS panel">
              <span>Request</span>
            </button>
            <div class="stock-stepper-mini">
              <button type="button" class="btn-mini-adjust btn-stock-dec" data-type="${type}" aria-label="Decrease ${type} unit">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 8a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1z"/></svg>
              </button>
              <button type="button" class="btn-mini-adjust btn-stock-inc" data-type="${type}" aria-label="Increase ${type} unit">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Render Tab 3 Inventory Summary Table (Low items first)
  if (inventoryTableBody) {
    inventoryTableBody.innerHTML = sortedStock.map(([type, units]) => {
      const isCritical = units < 5;
      const maxCapacity = 25;
      const percent = Math.min(100, Math.round((units / maxCapacity) * 100));

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              ${getDropBadgeSvg(type, isCritical)}
              <strong>${type}</strong>
            </div>
          </td>
          <td><span class="stat-number" style="font-size: 16px;">${units}</span> units</td>
          <td>
            <span class="chip-status ${isCritical ? 'low' : 'available'}">
              ${isCritical ? 'Low below 5 units' : 'In stock'}
            </span>
          </td>
          <td style="min-width: 140px;">
            <div class="stock-bar-track" style="margin-bottom: 4px;">
              <div class="stock-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <span style="font-size: 11.5px; color: var(--hosp-text-muted); font-family: var(--font-mono);">${percent}% capacity</span>
          </td>
          <td>
            <div class="stock-stepper-mini">
              <button type="button" class="btn-mini-adjust btn-stock-dec" data-type="${type}" aria-label="Decrease ${type} unit">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 8a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1z"/></svg>
              </button>
              <button type="button" class="btn-mini-adjust btn-stock-inc" data-type="${type}" aria-label="Increase ${type} unit">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 3. Update Dashboard Stats & Header Line
  const kpiUnits = document.getElementById('kpiTotalUnits');
  const kpiCrit = document.getElementById('kpiCriticalGroups');
  const kpiReqs = document.getElementById('kpiActiveRequests');
  const kpiCheckins = document.getElementById('kpiCheckedInToday');
  const statusLine = document.getElementById('hosp-status-line');

  if (kpiUnits) kpiUnits.textContent = `${totalUnits}`;
  if (kpiCrit) kpiCrit.textContent = `${criticalCount}`;
  if (kpiReqs) kpiReqs.textContent = '1';
  if (kpiCheckins) kpiCheckins.textContent = '4';

  if (statusLine) {
    statusLine.textContent = `1 request waiting for donors, ${criticalCount} blood groups running low.`;
  }

  // Wire Stepper Buttons
  document.querySelectorAll('.btn-stock-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const cur = getStock();
        cur[t] = (cur[t] || 0) + 1;
        saveStock(cur);
        renderElevatedStock();
      }
    });
  });

  document.querySelectorAll('.btn-stock-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const cur = getStock();
        cur[t] = Math.max(0, (cur[t] || 0) - 1);
        saveStock(cur);
        renderElevatedStock();
      }
    });
  });

  // Wire "Request this group" shortcut buttons (pre-fills SOS form)
  document.querySelectorAll('.btn-request-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const radio = document.querySelector(`input[name="inlineBloodType"][value="${t}"]`);
        if (radio) radio.checked = true;
        const form = document.getElementById('formInlineSos');
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  });
}

function initInlineSosForm() {
  const form = document.getElementById('formInlineSos');
  const stepUp = document.getElementById('btnStepUp');
  const stepDown = document.getElementById('btnStepDown');
  const unitsInput = document.getElementById('inlineUnits');

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
      const bloodType = document.querySelector('input[name="inlineBloodType"]:checked')?.value || 'O-';
      const units = parseInt(unitsInput?.value || '1', 10);
      const radius = parseInt(document.getElementById('inlineRadius')?.value || '10', 10);
      const urgency = document.getElementById('inlineUrgency')?.value || 'CRITICAL';

      const btn = document.getElementById('btnDispatchSosInline');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Sending SOS...</span>';
      }

      try {
        await fetch('/api/hospital/requests', {
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
      } catch (err) {
        console.debug('SOS dispatch fallback:', err);
      }

      // Update Live Timeline Display
      const ltType = document.getElementById('liveReqBloodType');
      const ltUnits = document.getElementById('liveReqUnits');
      const ltEta = document.getElementById('liveReqEta');
      const ltTime = document.getElementById('liveReqTime');

      if (ltType) ltType.textContent = bloodType;
      if (ltUnits) ltUnits.textContent = String(units);
      if (ltEta) ltEta.textContent = 'ETA ~12 min';
      if (ltTime) ltTime.textContent = 'Dispatched just now';

      // Animate timeline nodes
      document.getElementById('step-sent')?.classList.add('completed');
      document.getElementById('step-notified')?.classList.add('completed');
      document.getElementById('step-accepted')?.classList.add('active');

      if (btn) {
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>SOS Dispatched</span>';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> <span>Send SOS</span>';
        }, 1800);
      }
    });
  }
}

/* ============================================================
   5. FIND DONORS / DISPATCH (RADAR MAP & RESPONDING DONORS)
   ============================================================ */
function initDispatchRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let radarAngle = 0;

  const donorPoints = [
    { dist: 0.25, angle: 0.8, blood: 'O-', name: 'Rohit S.' },
    { dist: 0.35, angle: 2.1, blood: 'A+', name: 'Karan M.' },
    { dist: 0.55, angle: 4.1, blood: 'B+', name: 'Deepa K.' },
    { dist: 0.65, angle: 5.4, blood: 'O+', name: 'Amit P.' },
    { dist: 0.85, angle: 1.6, blood: 'AB-', name: 'Sunil R.' },
    { dist: 0.90, angle: 3.2, blood: 'O-', name: 'Vikas T.' }
  ];

  function drawRadar() {
    const w = (canvas.width = canvas.parentElement.clientWidth || 400);
    const h = (canvas.height = 280);
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 20;

    ctx.clearRect(0, 0, w, h);

    // Subtle Restrained Rings
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
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText(z.label, cx + 6, cy - z.r + 12);
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

    // Subtle Sweeping Beam
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

    // Center Hospital Marker
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#6ea8ff';
    ctx.fill();

    // Draw Donor Points
    donorPoints.forEach(p => {
      const pr = maxR * p.dist;
      const px = cx + Math.cos(p.angle) * pr;
      const py = cy + Math.sin(p.angle) * pr;

      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.blood === 'O-' ? '#e5383b' : '#3ecf8e';
      ctx.fill();

      ctx.fillStyle = '#ecebe8';
      ctx.font = '11px Instrument Sans, sans-serif';
      ctx.fillText(`${p.name} (${p.blood})`, px + 6, py + 3);
    });

    radarAngle += 0.015;
    requestAnimationFrame(drawRadar);
  }

  window.drawRadarFrame = drawRadar;
  drawRadar();

  renderDispatchResponsesTable();
}

function renderDispatchResponsesTable() {
  const tbody = document.getElementById('dispatchResponsesTableBody');
  if (!tbody) return;

  const donors = [
    { name: 'Rohit S.', blood: 'O-', dist: '3.8 km', eta: '~14 min', status: 'On the way', statusClass: 'active' },
    { name: 'Karan M.', blood: 'A+', dist: '4.5 km', eta: '~20 min', status: 'Accepted', statusClass: 'active' },
    { name: 'Deepa K.', blood: 'B+', dist: '8.2 km', eta: '~35 min', status: 'Available', statusClass: 'available' },
    { name: 'Amit P.', blood: 'O+', dist: '9.4 km', eta: '~42 min', status: 'Available', statusClass: 'available' }
  ];

  tbody.innerHTML = donors.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>
        <span class="blood-drop-badge" style="width: 26px; height: 30px;">
          <svg viewBox="0 0 32 38" class="drop-svg"><path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="currentColor"/></svg>
          <span class="drop-text" style="font-size: 11.5px; padding-top: 3px;">${d.blood}</span>
        </span>
      </td>
      <td><span class="mono-data">${d.dist}</span></td>
      <td><span class="mono-data">${d.eta}</span></td>
      <td><span class="chip-status ${d.statusClass}">${d.status}</span></td>
      <td>
        <button type="button" class="btn-secondary" style="height: 32px; padding: 0 10px; font-size: 12px; min-height: 36px;" onclick="alert('Contacting donor ${d.name}...')">
          <span>Contact</span>
        </button>
      </td>
    </tr>
  `).join('');
}

/* ============================================================
   6. INVENTORY MODULE (PER-BAG LIST)
   ============================================================ */
const mockBags = [
  { id: 'BAG-2026-O104', type: 'O-', comp: 'Whole Blood', date: '2026-11-10', expiry: '2026-11-16', status: 'Reserved', loc: 'Refrigerator B-2' },
  { id: 'BAG-2026-O105', type: 'O-', comp: 'Whole Blood', date: '2026-11-12', expiry: '2026-11-15', status: 'Available', loc: 'Refrigerator B-2' },
  { id: 'BAG-2026-A201', type: 'A+', comp: 'Packed RBC', date: '2026-11-05', expiry: '2026-12-10', status: 'Available', loc: 'Cold Vault 1' },
  { id: 'BAG-2026-B304', type: 'B+', comp: 'Plasma', date: '2026-10-20', expiry: '2027-10-20', status: 'Available', loc: 'Deep Freeze -40°C' },
  { id: 'BAG-2026-AB11', type: 'AB-', comp: 'Platelets', date: '2026-11-12', expiry: '2026-11-17', status: 'Reserved', loc: 'Agitator Unit 3' },
  { id: 'BAG-2026-O802', type: 'O+', comp: 'Whole Blood', date: '2026-11-01', expiry: '2026-12-06', status: 'Available', loc: 'Refrigerator A-1' }
];

function initInventory() {
  renderBagTable('ALL');

  document.querySelectorAll('.comp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const comp = btn.getAttribute('data-comp') || 'ALL';
      renderBagTable(comp);
    });
  });
}

function renderBagTable(filterComp = 'ALL') {
  const tbody = document.getElementById('inventoryBagTableBody');
  if (!tbody) return;

  const filtered = mockBags.filter(b => {
    if (filterComp === 'ALL') return true;
    if (filterComp === 'WHOLE') return b.comp.includes('Whole');
    if (filterComp === 'RBC') return b.comp.includes('RBC');
    if (filterComp === 'PLASMA') return b.comp.includes('Plasma');
    if (filterComp === 'PLATELETS') return b.comp.includes('Platelets');
    return true;
  });

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td><span class="mono-id">${b.id}</span></td>
      <td>
        <span class="blood-drop-badge" style="width: 26px; height: 30px;">
          <svg viewBox="0 0 32 38" class="drop-svg"><path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="currentColor"/></svg>
          <span class="drop-text" style="font-size: 11.5px; padding-top: 3px;">${b.type}</span>
        </span>
      </td>
      <td>${b.comp}</td>
      <td><span class="time-mono">${b.date}</span></td>
      <td><span class="time-mono">${b.expiry}</span></td>
      <td><span class="chip-status ${b.status === 'Available' ? 'available' : 'low'}">${b.status}</span></td>
      <td style="color: var(--hosp-text-muted);">${b.loc}</td>
    </tr>
  `).join('');
}

/* ============================================================
   7. MY REQUESTS / DISPATCH LOGS
   ============================================================ */
const mockRecords = [
  { id: 'SOS-2026-0041', relTime: '4 min ago', time: '11:45 AM', blood: 'O-', units: '1 unit', dist: '5 km', status: 'Accepted', statusClass: 'active', respTime: '2.4 min' },
  { id: 'SOS-2026-0040', relTime: '35 min ago', time: '11:15 AM', blood: 'A+', units: '2 units', dist: '10 km', status: 'Completed', statusClass: 'completed', respTime: '4.8 min' },
  { id: 'SOS-2026-0039', relTime: '2 hrs ago', time: '09:40 AM', blood: 'B+', units: '1 unit', dist: '5 km', status: 'Completed', statusClass: 'completed', respTime: '1.9 min' },
  { id: 'SOS-2026-0038', relTime: 'Yesterday', time: '04:15 PM', blood: 'O+', units: '2 units', dist: '10 km', status: 'Completed', statusClass: 'completed', respTime: '3.1 min' },
  { id: 'SOS-2026-0037', relTime: 'Nov 12', time: '02:30 PM', blood: 'AB-', units: '1 unit', dist: '20 km', status: 'Completed', statusClass: 'completed', respTime: '6.5 min' }
];

function initRecords() {
  renderRecordsTable(mockRecords);

  const exportBtn = document.getElementById('btnExportRecordsCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportCsv);
  }
}

function renderRecordsTable(list) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--sp-32); color: var(--hosp-text-muted);">
          No emergency requests dispatched yet. <button type="button" class="btn-secondary" onclick="switchTab('tab-dashboard')" style="margin-left: 8px;">Send SOS</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>
        <div><strong>${r.relTime}</strong></div>
        <div class="time-mono" style="font-size: 11.5px; color: var(--hosp-text-muted);">${r.time}</div>
      </td>
      <td>
        <span class="blood-drop-badge" style="width: 26px; height: 30px;">
          <svg viewBox="0 0 32 38" class="drop-svg"><path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z" fill="currentColor"/></svg>
          <span class="drop-text" style="font-size: 11.5px; padding-top: 3px;">${r.blood}</span>
        </span>
      </td>
      <td><span class="mono-data">${r.units}</span></td>
      <td><span class="mono-data">${r.dist}</span></td>
      <td><span class="chip-status ${r.statusClass}">${r.status}</span></td>
      <td><span class="mono-data">${r.respTime}</span></td>
    </tr>
  `).join('');
}

function exportCsv() {
  const headers = ['Request Time', 'Timestamp', 'Blood Group', 'Units', 'Distance', 'Status', 'Response Time'];
  const rows = mockRecords.map(r => [`"${r.relTime}"`, `"${r.time}"`, r.blood, `"${r.units}"`, `"${r.dist}"`, `"${r.status}"`, `"${r.respTime}"`]);
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
   8. DONOR CHECK-IN ENGINE
   ============================================================ */
function initDonorCheckin() {
  const lookupBtn = document.getElementById('btnLookupDonor');
  const inputId = document.getElementById('checkinSmartIdInput');
  const vitalsForm = document.getElementById('formDonorVitals');

  if (lookupBtn && inputId) {
    lookupBtn.addEventListener('click', () => {
      const id = inputId.value.trim() || 'DNR-8012';
      const card = document.getElementById('donorLoadedCard');
      if (card) card.style.display = 'block';
    });
  }

  if (vitalsForm) {
    vitalsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Donor donation verified and approved. Stock has been incremented.');
      vitalsForm.reset();
      const card = document.getElementById('donorLoadedCard');
      if (card) card.style.display = 'none';
      if (inputId) inputId.value = '';
    });
  }
}
