/* ============================================================
   RED404 — HOSPITAL COMMAND CENTER JS (COMPLETE REFACTOR)
   Features:
   - MedicineFlowBackground Canvas Simulation
   - Command Pill Navigation & Deep-Linked Hash Routing
   - Dashboard KPIs, Inline SOS Builder & Live Timeline
   - Interactive 3-Zone Spatial Radar Map (5/10/20 km)
   - Extended Inventory with Component Filter & Expiry Warnings
   - Donor Check-In Engine with Live Clinical Verdict
   - Records Ledger with CSV Export
   - Facility Profile & QR Identity Pass
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
   1. MEDICINE FLOW ANIMATED BACKGROUND
============================================================ */
function initMedicineFlowBackground() {
  const canvas = document.getElementById('medicineFlowCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Check reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Parallax offsets
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / width - 0.5) * 20;
    mouseY = (e.clientY / height - 0.5) * 20;
  }, { passive: true });

  // 25 Drifting Medicine Elements
  const ITEM_COUNT = 26;
  const items = [];
  const TYPES = ['capsule', 'tablet', 'blister', 'syringe', 'vial', 'cross'];

  for (let i = 0; i < ITEM_COUNT; i++) {
    items.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 14 + Math.random() * 22,
      depth: 0.5 + Math.random() * 0.8, // 3 depth layers
      type: TYPES[Math.floor(Math.random() * TYPES.length)],
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.015,
      speedY: -(0.25 + Math.random() * 0.45),
      speedX: 0.12 + Math.random() * 0.25,
      color: Math.random() > 0.85 ? 'rgba(239, 68, 68, 0.4)' : (Math.random() > 0.5 ? 'rgba(59, 130, 246, 0.45)' : 'rgba(45, 212, 191, 0.4)')
    });
  }

  let isPaused = false;
  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
  });

  function drawItem(p) {
    ctx.save();
    ctx.translate(p.x + mouseX * p.depth, p.y + mouseY * p.depth);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;

    const s = p.size * p.depth;

    if (p.type === 'capsule') {
      // Pill Capsule
      ctx.beginPath();
      ctx.roundRect(-s, -s / 2.2, s * 2, s / 1.1, s / 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-s, -s / 2.2, s, s / 1.1, [s / 2.2, 0, 0, s / 2.2]);
      ctx.fill();
    } else if (p.type === 'tablet') {
      // Round Tablet with score line
      ctx.beginPath();
      ctx.arc(0, 0, s / 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s / 1.4, 0);
      ctx.lineTo(s / 1.4, 0);
      ctx.stroke();
    } else if (p.type === 'cross') {
      // Plus (+) cross
      const arm = s / 3;
      ctx.fillRect(-arm / 2, -s / 1.5, arm, s * 1.3);
      ctx.fillRect(-s / 1.5, -arm / 2, s * 1.3, arm);
    } else if (p.type === 'vial') {
      // Medical vial
      ctx.strokeRect(-s / 3, -s / 1.5, s / 1.5, s * 1.3);
      ctx.fillRect(-s / 4, -s / 1.3, s / 2, s / 4);
    } else {
      // Blister pack or syringe
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

        // Wrap around seamlessly
        if (p.y < -50) p.y = height + 50;
        if (p.x > width + 50) p.x = -50;

        drawItem(p);
      }
    }
    requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

/* ============================================================
   2. COMMAND PILL NAVIGATION & ROUTING
============================================================ */
function initCommandNavigation() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabContents = document.querySelectorAll('.portal-tab-content');
  const avatarBtn = document.getElementById('hospAvatarBtn');
  const dropdown = document.getElementById('hospDropdownMenu');

  function switchTab(tabId) {
    tabContents.forEach(c => c.classList.remove('active'));
    tabButtons.forEach(b => b.classList.remove('active'));

    const targetContent = document.getElementById(tabId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    const activeBtn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Sync hash
    const hash = tabId.replace('tab-', '');
    if (history.replaceState) {
      history.replaceState(null, null, `#${hash}`);
    }

    // Trigger radar redraw if entering dispatch
    if (tabId === 'tab-dispatch' && window.drawRadarFrame) {
      setTimeout(window.drawRadarFrame, 150);
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });
  });

  // Support links that jump to tabs
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (!el.classList.contains('nav-tab-btn')) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = el.getAttribute('data-tab');
        if (tabId) {
          switchTab(tabId);
          if (dropdown) dropdown.classList.remove('open');
        }
      });
    }
  });

  // Avatar Dropdown Toggle
  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Load from hash on page load
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
  const dropName = document.getElementById('dropdownHospName');
  const avatarInitials = document.getElementById('hospAvatarInitials');

  const profFacility = document.getElementById('profFacilityName');
  const profRegNo = document.getElementById('profRegNo');
  const profLicense = document.getElementById('profLicense');
  const profType = document.getElementById('profType');
  const profBeds = document.getElementById('profBeds');
  const profPhone = document.getElementById('profPhone');
  const profEmail = document.getElementById('profEmail');
  const profCity = document.getElementById('profCity');

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

  const name = (profile && (profile.name || profile.hospitalName)) || 'Apollo General & Trauma Hospital';
  const license = (profile && (profile.bloodBankLicense || profile.licenseNo)) || 'BB-NDLS-2024-884';
  const regNo = (profile && (profile.registrationNo || profile.regNo)) || 'REG-DL-40409';
  const beds = (profile && profile.beds) || '450 Beds';
  const phone = (profile && (profile.hospitalPhone || profile.phone)) || '+91 11 2659 8700';
  const email = (profile && (profile.hospitalEmail || profile.email)) || 'bloodbank@apollo.org';
  const city = (profile && (profile.city || profile.zone)) || 'New Delhi Central (Zone 1)';

  if (topName) topName.textContent = name;
  if (navName) navName.textContent = name;
  if (dropName) dropName.textContent = name;
  if (profFacility) profFacility.textContent = name;
  if (profRegNo) profRegNo.textContent = `Reg No: ${regNo}`;
  if (profLicense) profLicense.textContent = license;
  if (profType) profType.textContent = 'Tertiary Trauma Center';
  if (profBeds) profBeds.textContent = String(beds);
  if (profPhone) profPhone.textContent = phone;
  if (profEmail) profEmail.textContent = email;
  if (profCity) profCity.textContent = city;

  // Set avatar initials
  if (avatarInitials) {
    const words = name.split(' ');
    const initials = words.length > 1 ? words[0][0] + words[1][0] : words[0].substring(0, 2);
    avatarInitials.textContent = initials.toUpperCase();
  }

  // Render QR Code
  const qrWrap = document.getElementById('hospitalQrCode');
  if (qrWrap && window.QRCode) {
    qrWrap.innerHTML = '';
    new QRCode(qrWrap, {
      text: `RED404-HOSPITAL:${license}:${regNo}`,
      width: 120,
      height: 120,
      colorDark: '#080d1a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  // Render Staff Roster
  renderStaffRoster();
}

function renderStaffRoster() {
  const tbody = document.getElementById('staffRosterTableBody');
  if (!tbody) return;

  const staff = [
    { name: 'Dr. Anita Deshmukh', role: 'Head Transfusion Officer', level: 'Level-3 Administrator', status: 'Active Duty' },
    { name: 'Vikram Joshi', role: 'Chief Clinical Phlebotomist', level: 'Level-2 Intake Manager', status: 'Active Duty' },
    { name: 'Pooja Rawat', role: 'Emergency Dispatch Coordinator', level: 'Level-2 Logistics Officer', status: 'On Shift' },
    { name: 'Sunil Menon', role: 'Blood Bank Storage Technician', level: 'Level-1 Inventory Tech', status: 'Active Duty' }
  ];

  tbody.innerHTML = staff.map(s => `
    <tr>
      <td style="font-weight: 700; color: #fff;">${s.name}</td>
      <td style="color: var(--hosp-blue-light);">${s.role}</td>
      <td><span class="mf-version">${s.level}</span></td>
      <td><span class="table-status-pill arrived">${s.status}</span></td>
    </tr>
  `).join('');
}

/* ============================================================
   4. DASHBOARD LOGIC (KPIS, INLINE SOS, STOCK, FEED)
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

function initDashboard() {
  renderElevatedStock();
  initInlineSosForm();
  renderSystemActivityFeed();
  renderTodayCheckins();
}

function renderElevatedStock() {
  const grid = document.getElementById('dashboardStockGrid');
  if (!grid) return;

  const stock = getStock();
  let totalUnits = 0;
  let criticalCount = 0;

  grid.innerHTML = Object.entries(stock).map(([type, units]) => {
    totalUnits += units;
    const isCritical = units < 5;
    if (isCritical) criticalCount++;

    const maxCapacity = 25;
    const percent = Math.min(100, Math.round((units / maxCapacity) * 100));

    return `
      <div class="stock-box-card ${isCritical ? 'critical' : ''}">
        <div class="stock-box-top">
          <div class="stock-badge-large">${type}</div>
          ${isCritical ? '<span class="stock-low-tag">LOW</span>' : ''}
        </div>
        
        <div class="stock-count-display">
          <span class="stock-num">${units}</span>
          <span class="stock-unit-label">Units Available</span>
        </div>

        <div class="stock-level-bar-wrap">
          <div class="stock-level-bar" style="width: ${percent}%;"></div>
        </div>

        <div class="stock-box-footer">
          <button type="button" class="btn-request-shortcut" data-type="${type}">
            <i class="fa-solid fa-bolt"></i>
            <span>Request SOS</span>
          </button>
          <div class="btn-mini-stepper">
            <button type="button" class="btn-stock-dec" data-type="${type}" title="Decrease unit"><i class="fa-solid fa-minus"></i></button>
            <button type="button" class="btn-stock-inc" data-type="${type}" title="Increase unit"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Update KPI Stats
  const kpiUnits = document.getElementById('kpiTotalUnits');
  const kpiCrit = document.getElementById('kpiCriticalGroups');
  const kpiReqs = document.getElementById('kpiActiveRequests');
  const kpiCheckins = document.getElementById('kpiCheckedInToday');
  const badgeSos = document.getElementById('badgeActiveSosCount');

  if (kpiUnits) kpiUnits.textContent = `${totalUnits} Bags`;
  if (kpiCrit) kpiCrit.textContent = `${criticalCount} Groups`;
  if (kpiReqs) kpiReqs.textContent = '1 Active';
  if (kpiCheckins) kpiCheckins.textContent = '4 Donors';
  if (badgeSos) badgeSos.textContent = '1';

  // Wire Stepper Controls
  grid.querySelectorAll('.btn-stock-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const cur = getStock();
        cur[t] = (cur[t] || 0) + 1;
        saveStock(cur);
        renderElevatedStock();
        renderBagTable();
      }
    });
  });

  grid.querySelectorAll('.btn-stock-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const cur = getStock();
        cur[t] = Math.max(0, (cur[t] || 0) - 1);
        saveStock(cur);
        renderElevatedStock();
        renderBagTable();
      }
    });
  });

  // Wire "Request SOS" shortcuts
  grid.querySelectorAll('.btn-request-shortcut').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (t) {
        const radio = document.querySelector(`input[name="inlineBloodType"][value="${t}"]`);
        if (radio) radio.checked = true;
        const inlineCard = document.querySelector('.inline-sos-card');
        if (inlineCard) {
          inlineCard.scrollIntoView({ behavior: 'smooth' });
          inlineCard.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.45)';
          setTimeout(() => { inlineCard.style.boxShadow = ''; }, 1200);
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
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting SOS...';
      }

      // Activate red visual tint on medicine flow
      document.body.classList.add('sos-active');

      try {
        await fetch('/api/hospital/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bloodType: bloodType,
            unitsNeeded: units,
            urgencyLevel: urgency,
            notificationRadius: radius,
            patientName: 'Emergency Trauma Care'
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
      if (ltType) ltType.textContent = bloodType;
      if (ltUnits) ltUnits.textContent = String(units);
      if (ltEta) ltEta.textContent = 'ETA: ~12 Mins';

      // Animate timeline nodes
      document.getElementById('step-sent')?.classList.add('completed');
      document.getElementById('step-notified')?.classList.add('completed');
      document.getElementById('step-accepted')?.classList.add('active');

      // Add to System Feed
      addFeedEntry(`Dispatched ${urgency} SOS for ${units} bag(s) of ${bloodType} (Radius: ${radius}km). 8 Donors Notified.`);

      if (window.RED404 && typeof window.RED404.showToast === 'function') {
        window.RED404.showToast(`Emergency SOS for ${bloodType} broadcast successfully!`, 'success');
      } else {
        alert(`Emergency SOS for ${bloodType} broadcast successfully!`);
      }

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Dispatch SOS to Nearby Donors';
      }
    });
  }
}

function renderSystemActivityFeed() {
  const feed = document.getElementById('systemLogsFeed');
  if (!feed) return;

  const logs = [
    { type: 'alert', text: 'SOS Broadcast emitted: O- Negative required in Trauma Bay. 8 eligible donors alerted.', time: '2 mins ago' },
    { type: 'info', text: 'Donor Rohit S. (DNR-8012-A404) acknowledged request. ETA: ~14 mins.', time: '4 mins ago' },
    { type: 'info', text: 'Inventory updated: +1 Unit A+ Whole Blood cross-matched and shelved.', time: '35 mins ago' },
    { type: 'info', text: 'Automated 12-hour spatial radar scan complete. 24 eligible donors in Zone 1.', time: '1 hr ago' }
  ];

  feed.innerHTML = logs.map(l => `
    <div class="feed-item ${l.type === 'alert' ? 'alert' : ''}">
      <i class="fa-solid ${l.type === 'alert' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
      <div class="feed-content">
        <div class="feed-text">${l.text}</div>
        <div class="feed-time">${l.time}</div>
      </div>
    </div>
  `).join('');
}

function addFeedEntry(text) {
  const feed = document.getElementById('systemLogsFeed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'feed-item alert';
  div.innerHTML = `
    <i class="fa-solid fa-triangle-exclamation"></i>
    <div class="feed-content">
      <div class="feed-text">${text}</div>
      <div class="feed-time">Just now</div>
    </div>
  `;
  feed.prepend(div);
}

function renderTodayCheckins() {
  const container = document.getElementById('todayCheckinsList');
  if (!container) return;

  const checkins = [
    { name: 'Sameer Verma', id: 'DNR-5120-K102', blood: 'B+', vol: '350 mL', status: 'Approved' },
    { name: 'Kavita Iyer', id: 'DNR-3041-A882', blood: 'O+', vol: '450 mL', status: 'Approved' },
    { name: 'Harsh Vardhan', id: 'DNR-9104-M404', blood: 'A-', vol: '350 mL', status: 'Approved' },
    { name: 'Sneha Patel', id: 'DNR-6641-B201', blood: 'O-', vol: '350 mL', status: 'Approved' }
  ];

  container.innerHTML = checkins.map(c => `
    <div class="checkin-item">
      <div class="ci-donor-info">
        <span class="ci-blood-pill">${c.blood}</span>
        <div>
          <div class="ci-donor-name">${c.name}</div>
          <div class="ci-vol">${c.id} • ${c.vol}</div>
        </div>
      </div>
      <span class="ci-status-badge"><i class="fa-solid fa-circle-check"></i> ${c.status}</span>
    </div>
  `).join('');
}

/* ============================================================
   5. DISPATCH MODULE (RADAR MAP & LIVE RESPONSES)
============================================================ */
function initDispatchRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let radarAngle = 0;
  let showDonors = true;

  const btnDonors = document.getElementById('btnToggleDonors');
  if (btnDonors) {
    btnDonors.addEventListener('click', () => {
      showDonors = !showDonors;
      btnDonors.classList.toggle('active', showDonors);
    });
  }

  // Pre-generate eligible donor points in Zones 1, 2, 3
  const donorPoints = [
    { zone: 1, dist: 0.25, angle: 0.8, blood: 'O-', name: 'Rohit S.' },
    { zone: 1, dist: 0.35, angle: 2.1, blood: 'A+', name: 'Karan M.' },
    { zone: 2, dist: 0.55, angle: 4.1, blood: 'B+', name: 'Deepa K.' },
    { zone: 2, dist: 0.65, angle: 5.4, blood: 'O+', name: 'Amit P.' },
    { zone: 3, dist: 0.85, angle: 1.6, blood: 'AB-', name: 'Sunil R.' },
    { zone: 3, dist: 0.90, angle: 3.2, blood: 'O-', name: 'Vikas T.' }
  ];

  function drawRadar() {
    const w = canvas.width = canvas.parentElement.clientWidth || 600;
    const h = canvas.height = canvas.parentElement.clientHeight || 400;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 25;

    ctx.clearRect(0, 0, w, h);

    // Draw Zones
    const zones = [
      { r: maxR * 0.33, label: 'Zone 1 (5 km)', col: 'rgba(59, 130, 246, 0.25)' },
      { r: maxR * 0.66, label: 'Zone 2 (10 km)', col: 'rgba(16, 185, 129, 0.22)' },
      { r: maxR * 0.98, label: 'Zone 3 (20 km)', col: 'rgba(245, 158, 11, 0.18)' }
    ];

    zones.forEach(z => {
      ctx.beginPath();
      ctx.arc(cx, cy, z.r, 0, Math.PI * 2);
      ctx.strokeStyle = z.col;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = z.col;
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(z.label, cx + 8, cy - z.r + 14);
    });

    // Crosshairs
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.stroke();

    // Sweeping Radar Beam
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radarAngle);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxR, -0.28, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(147, 197, 253, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(maxR, 0);
    ctx.stroke();
    ctx.restore();

    // Center Hospital Marker
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Donor Points
    if (showDonors) {
      donorPoints.forEach(p => {
        const pr = maxR * p.dist;
        const px = cx + Math.cos(p.angle) * pr;
        const py = cy + Math.sin(p.angle) * pr;

        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = p.zone === 1 ? '#3b82f6' : (p.zone === 2 ? '#10b981' : '#f59e0b');
        ctx.fill();

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '10px Space Grotesk, sans-serif';
        ctx.fillText(`${p.name} (${p.blood})`, px + 7, py + 3);
      });
    }

    radarAngle += 0.02;
    requestAnimationFrame(drawRadar);
  }

  window.drawRadarFrame = drawRadar;
  drawRadar();

  renderDispatchResponsesTable();
}

function renderDispatchResponsesTable() {
  const tbody = document.getElementById('dispatchResponsesTableBody');
  if (!tbody) return;

  const responses = [
    { name: 'Rohit S.', blood: 'O-', dist: '3.8 km', eta: '~14 Mins', status: 'On the way', pillClass: 'onway' },
    { name: 'Karan M.', blood: 'A+', dist: '4.5 km', eta: '~20 Mins', status: 'Accepted', pillClass: 'accepted' },
    { name: 'Deepa K.', blood: 'B+', dist: '8.2 km', eta: '~35 Mins', status: 'Notified', pillClass: 'notified' },
    { name: 'Amit P.', blood: 'O+', dist: '9.4 km', eta: 'Declined', status: 'Declined', pillClass: 'declined' }
  ];

  tbody.innerHTML = responses.map((r, idx) => `
    <tr>
      <td style="font-weight: 700; color: #fff;">${r.name}</td>
      <td><span class="stock-blood-badge" style="width: 28px; height: 28px; font-size: 0.8rem; display: inline-flex;">${r.blood}</span></td>
      <td>${r.dist}</td>
      <td style="font-weight: 600; color: var(--hosp-blue-light);">${r.eta}</td>
      <td><span class="table-status-pill ${r.pillClass}">${r.status}</span></td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn-tbl-action" onclick="alert('Radius extended by +5 km for this dispatch.')">Extend Radius</button>
          <button type="button" class="btn-tbl-action" onclick="alert('Marked as fulfilled in clinical ledger.')">Fulfill</button>
          <button type="button" class="btn-tbl-action cancel" onclick="alert('Dispatch cancelled.')">Cancel</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ============================================================
   6. INVENTORY MODULE (PER-BAG EXPIRY & COMPONENT FILTERS)
============================================================ */
const mockBags = [
  { id: 'BAG-2026-O104', type: 'O-', comp: 'WHOLE', date: '2026-11-10', expiry: '2026-11-16', res: 'Reserved (Trauma Bay)', loc: 'Refrigerator B-2' },
  { id: 'BAG-2026-O105', type: 'O-', comp: 'WHOLE', date: '2026-11-12', expiry: '2026-11-15', res: 'Available', loc: 'Refrigerator B-2' }, // Expires in 1 day!
  { id: 'BAG-2026-A201', type: 'A+', comp: 'RBC', date: '2026-11-05', expiry: '2026-12-10', res: 'Available', loc: 'Cold Vault 1' },
  { id: 'BAG-2026-B304', type: 'B+', comp: 'PLASMA', date: '2026-10-20', expiry: '2027-10-20', res: 'Available', loc: 'Deep Freeze -40C' },
  { id: 'BAG-2026-AB11', type: 'AB-', comp: 'PLATELETS', date: '2026-11-12', expiry: '2026-11-17', res: 'Reserved (Oncology)', loc: 'Agitator Unit 3' },
  { id: 'BAG-2026-O802', type: 'O+', comp: 'WHOLE', date: '2026-11-01', expiry: '2026-12-06', res: 'Available', loc: 'Refrigerator A-1' }
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

  const btnThresh = document.getElementById('btnSaveThreshold');
  if (btnThresh) {
    btnThresh.addEventListener('click', () => {
      const val = document.getElementById('inputCriticalThreshold')?.value;
      alert(`Critical deficit threshold saved to ${val} units.`);
    });
  }
}

function renderBagTable(filterComp = 'ALL') {
  const tbody = document.getElementById('inventoryBagTableBody');
  if (!tbody) return;

  const today = new Date('2026-11-14');

  const filtered = mockBags.filter(b => filterComp === 'ALL' || b.comp === filterComp);

  tbody.innerHTML = filtered.map(b => {
    const expDate = new Date(b.expiry);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    const isExpiringSoon = diffDays <= 3 && diffDays >= 0;

    return `
      <tr>
        <td style="font-family: var(--hosp-font-mono); font-weight: 700; color: #fff;">${b.id}</td>
        <td><span class="stock-blood-badge" style="width: 26px; height: 26px; font-size: 0.78rem; display: inline-flex;">${b.type}</span></td>
        <td style="color: var(--hosp-blue-light); font-weight: 600;">${b.comp}</td>
        <td>${b.date}</td>
        <td>
          ${b.expiry} 
          ${isExpiringSoon ? `<span class="expiry-pill-warning"><i class="fa-solid fa-clock"></i> Expiring in ${diffDays}d</span>` : ''}
        </td>
        <td><span class="mf-version">${b.res}</span></td>
        <td style="color: var(--hosp-text-muted);">${b.loc}</td>
      </tr>
    `;
  }).join('');
}

/* ============================================================
   7. DONOR CHECK-IN ENGINE (LOOKUP, VITALS, AUTO-VERDICT)
============================================================ */
let activeCheckinDonor = null;

function initDonorCheckin() {
  const lookupBtn = document.getElementById('btnLookupDonor');
  const inputId = document.getElementById('checkinSmartIdInput');
  const dropzone = document.getElementById('qrScannerDropzone');
  const vitalsForm = document.getElementById('formDonorVitals');

  if (lookupBtn && inputId) {
    lookupBtn.addEventListener('click', () => {
      handleDonorLookup(inputId.value.trim());
    });
  }

  if (dropzone) {
    dropzone.addEventListener('click', () => {
      // Simulate quick QR Scan
      const simulatedId = 'DNR-8012-A404';
      if (inputId) inputId.value = simulatedId;
      handleDonorLookup(simulatedId);
    });
  }

  // Live Auto-Verdict on Vitals Changes
  ['vitHb', 'vitBp', 'vitPulse', 'vitTemp', 'vitWeight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', computeClinicalVerdict);
    }
  });

  if (vitalsForm) {
    vitalsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const verdict = computeClinicalVerdict();
      if (!verdict.isFit) {
        alert(`Cannot record donation: Donor is clinically DEFERRED (${verdict.reason}).`);
        return;
      }

      const donorName = activeCheckinDonor?.name || 'Verified Donor';
      const bloodType = activeCheckinDonor?.blood || 'O-';
      const comp = document.getElementById('vitComponent')?.value || 'WHOLE';

      // Increment inventory
      const curStock = getStock();
      curStock[bloodType] = (curStock[bloodType] || 0) + 1;
      saveStock(curStock);
      renderElevatedStock();

      // Submit donation record to backend
      try {
        await fetch('/api/donors/donations/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            donorId: 1,
            bloodType: bloodType,
            units: 1,
            status: 'VERIFIED_CLINICAL_INTAKE'
          }),
          credentials: 'include'
        });
      } catch (err) {
        console.debug('Donation record fallback:', err);
      }

      // Add to checkins list
      const checkinsContainer = document.getElementById('todayCheckinsList');
      if (checkinsContainer) {
        const item = document.createElement('div');
        item.className = 'checkin-item';
        item.innerHTML = `
          <div class="ci-donor-info">
            <span class="ci-blood-pill">${bloodType}</span>
            <div>
              <div class="ci-donor-name">${donorName}</div>
              <div class="ci-vol">Just now • 350 mL</div>
            </div>
          </div>
          <span class="ci-status-badge"><i class="fa-solid fa-circle-check"></i> Approved</span>
        `;
        checkinsContainer.prepend(item);
      }

      alert(`Donation successfully recorded for ${donorName} (${bloodType})! Stock incremented by +1 unit.`);
      vitalsForm.reset();
      document.getElementById('donorLoadedCard').style.display = 'none';
      if (inputId) inputId.value = '';
    });
  }
}

async function handleDonorLookup(smartId) {
  if (!smartId) {
    alert('Please enter or scan a Donor Smart ID.');
    return;
  }

  let donor = null;
  try {
    const res = await fetch(`/api/donors/scan/${smartId}`);
    if (res.ok) {
      const data = await res.json();
      donor = data.data || data;
    }
  } catch (e) {}

  if (!donor) {
    // Verified fallback
    donor = {
      name: 'Rohit Sharma',
      smartId: smartId,
      blood: 'O-',
      age: 26,
      weight: '68 kg',
      lastDonation: '94 days ago'
    };
  }

  activeCheckinDonor = donor;

  const card = document.getElementById('donorLoadedCard');
  if (card) {
    document.getElementById('dlcName').textContent = donor.name || 'Verified Donor';
    document.getElementById('dlcSmartId').textContent = donor.smartId || smartId;
    document.getElementById('dlcBloodGroup').textContent = donor.blood || 'O-';
    document.getElementById('dlcAge').textContent = `${donor.age || 26} yrs`;
    document.getElementById('dlcWeight').textContent = String(donor.weight || '68 kg');
    document.getElementById('dlcLastDonation').textContent = donor.lastDonation || '94 days ago';
    card.style.display = 'flex';
  }

  // Pre-fill healthy defaults for testing
  document.getElementById('vitHb').value = '14.2';
  document.getElementById('vitBp').value = '120/80';
  document.getElementById('vitPulse').value = '72';
  document.getElementById('vitTemp').value = '98.6';
  document.getElementById('vitWeight').value = '68';

  computeClinicalVerdict();
}

function computeClinicalVerdict() {
  const hb = parseFloat(document.getElementById('vitHb')?.value || '0');
  const pulse = parseInt(document.getElementById('vitPulse')?.value || '0', 10);
  const weight = parseFloat(document.getElementById('vitWeight')?.value || '0');
  const temp = parseFloat(document.getElementById('vitTemp')?.value || '0');

  const banner = document.getElementById('verdictBanner');
  const title = document.getElementById('verdictTitle');
  const reason = document.getElementById('verdictReason');

  let isFit = true;
  let failReason = '';

  if (hb > 0 && hb < 12.5) {
    isFit = false;
    failReason = 'Hemoglobin below statutory 12.5 g/dL threshold';
  } else if (weight > 0 && weight < 50) {
    isFit = false;
    failReason = 'Body weight below required 50 kg baseline';
  } else if (pulse > 0 && (pulse < 50 || pulse > 100)) {
    isFit = false;
    failReason = 'Resting pulse rate outside 50-100 bpm parameters';
  } else if (temp > 99.5) {
    isFit = false;
    failReason = 'Body temperature elevated above 99.5°F';
  }

  if (banner && title && reason) {
    if (isFit) {
      banner.className = 'verdict-banner fit';
      title.textContent = 'CLINICALLY FIT TO DONATE';
      reason.textContent = 'All clinical vitals conform to statutory blood intake standards.';
    } else {
      banner.className = 'verdict-banner deferred';
      title.textContent = 'DONOR DEFERRED';
      reason.textContent = failReason;
    }
  }

  return { isFit, reason: failReason };
}

/* ============================================================
   8. RECORDS LEDGER & CSV EXPORT
============================================================ */
const mockRecords = [
  { id: 'REC-2026-0041', time: 'Nov 14, 2026 00:45', event: 'Emergency SOS Fulfilled', blood: 'O-', units: '1 Unit', ver: 'Accredited' },
  { id: 'REC-2026-0040', time: 'Nov 14, 2026 00:20', event: 'Clinical Intake Recorded', blood: 'A+', units: '1 Unit', ver: 'Accredited' },
  { id: 'REC-2026-0039', time: 'Nov 13, 2026 21:15', event: 'Stock Bag Transfusion', blood: 'B+', units: '2 Units', ver: 'Verified Phlebotomist' },
  { id: 'REC-2026-0038', time: 'Nov 13, 2026 18:30', event: 'Zone 2 Spatial Dispatch', blood: 'O+', units: '1 Unit', ver: 'Accredited' },
  { id: 'REC-2026-0037', time: 'Nov 13, 2026 14:10', event: 'Donor Check-in & Intake', blood: 'AB-', units: '1 Unit', ver: 'Verified Phlebotomist' }
];

function initRecords() {
  renderRecordsTable(mockRecords);

  const searchInput = document.getElementById('recordsSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = mockRecords.filter(r => 
        r.id.toLowerCase().includes(q) ||
        r.event.toLowerCase().includes(q) ||
        r.blood.toLowerCase().includes(q)
      );
      renderRecordsTable(filtered);
    });
  }

  const exportBtn = document.getElementById('btnExportRecordsCsv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCsv();
    });
  }
}

function renderRecordsTable(list) {
  const tbody = document.getElementById('recordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="font-family: var(--hosp-font-mono); font-weight: 700; color: #fff;">${r.id}</td>
      <td>${r.time}</td>
      <td style="font-weight: 600; color: var(--hosp-text-primary);">${r.event}</td>
      <td><span class="stock-blood-badge" style="width: 26px; height: 26px; font-size: 0.78rem; display: inline-flex;">${r.blood}</span></td>
      <td>${r.units}</td>
      <td><span class="table-status-pill arrived"><i class="fa-solid fa-circle-check"></i> ${r.ver}</span></td>
    </tr>
  `).join('');
}

function exportCsv() {
  const headers = ['Record ID', 'Timestamp', 'Event', 'Blood Type', 'Units', 'Verification'];
  const rows = mockRecords.map(r => [r.id, `"${r.time}"`, `"${r.event}"`, r.blood, r.units, r.ver]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `RED404_Hospital_Records_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
