/* ============================================================
   RED404 — DONOR DASHBOARD JS
============================================================ */

'use strict';

/* ==================== INIT ==================== */
document.addEventListener('DOMContentLoaded', () => {
  checkDonorAuth();
  initSidebar();
  initDashboardCounters();
  initDonationChart();
  initNotificationSystem();
  initAvailabilityToggle();
  loadDonorProfile();
  loadDonationHistory();
  loadBadges();
  loadDonorLevel();
  simulateIncomingRequest();
  initMapPlaceholder();
});

/* ==================== AUTH CHECK ==================== */
function checkDonorAuth() {
  /* Comment this out during development / demo */
  // RED404.Auth.redirectIfNotLoggedIn('donor-login.html');
}

/* ==================== SIDEBAR ==================== */
function initSidebar() {
  const sidebar      = document.querySelector('.sidebar');
  const toggleBtn    = document.querySelector('.sidebar-toggle');
  const mainContent  = document.querySelector('.dashboard-main');
  const mobileToggle = document.querySelector('.mobile-sidebar-toggle');

  if (!sidebar) return;

  /* Collapse / expand */
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('sidebar-collapsed', isCollapsed);
      RED404.Store.set('sidebarCollapsed', isCollapsed);
      toggleBtn.innerHTML = isCollapsed
        ? '<i class="fas fa-chevron-right"></i>'
        : '<i class="fas fa-chevron-left"></i>';
    });

    /* Restore saved state */
    const wasCollapsed = RED404.Store.get('sidebarCollapsed', false);
    if (wasCollapsed) {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('sidebar-collapsed');
      toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
  }

  /* Mobile overlay toggle */
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  /* Close sidebar on mobile outside click */
  document.addEventListener('click', e => {
    if (
      window.innerWidth < 1024 &&
      sidebar.classList.contains('mobile-open') &&
      !sidebar.contains(e.target) &&
      !mobileToggle?.contains(e.target)
    ) {
      sidebar.classList.remove('mobile-open');
    }
  });

  /* Active nav item */
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      showDashboardPage(page);
    });
  });
}

/* ==================== PAGE SWITCHER ==================== */
function showDashboardPage(page) {
  document.querySelectorAll('.dash-page').forEach(p => {
    p.style.display = p.id === `page-${page}` ? 'block' : 'none';
  });

  /* Update page title */
  const titles = {
    overview:    'Overview',
    requests:    'Blood Requests',
    history:     'Donation History',
    profile:     'My Profile',
    settings:    'Settings',
    badges:      'My Badges',
  };

  const titleEl = document.querySelector('.page-title');
  if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';
}

/* ==================== DASHBOARD COUNTERS ==================== */
function initDashboardCounters() {
  /* Animate stat values */
  document.querySelectorAll('.dsc-value[data-target], .w-stat-num[data-target]').forEach(el => {
    RED404.animateCounter?.(el) ?? animateValue(el);
  });
}

function animateValue(el) {
  const target   = parseInt(el.dataset.target || el.textContent, 10);
  if (isNaN(target)) return;

  let current    = 0;
  const duration = 1800;
  const steps    = 60;
  const step     = target / steps;

  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current >= target) clearInterval(timer);
  }, duration / steps);
}

/* ==================== DONATION CHART ==================== */
function initDonationChart() {
  const chartBars = document.querySelectorAll('.chart-bar');
  if (!chartBars.length) return;

  /* Sample data: donations per month */
  const data = [1, 0, 1, 0, 0, 1, 2, 0, 1, 0, 1, 1];
  const max  = Math.max(...data, 1);

  chartBars.forEach((bar, idx) => {
    const pct = (data[idx] / max) * 100;
    bar.style.height = '0%';
    setTimeout(() => {
      bar.style.transition = 'height 1.2s cubic-bezier(0.34,1.56,0.64,1)';
      bar.style.height     = `${Math.max(pct, 4)}%`;
    }, 300 + idx * 60);

    bar.setAttribute('title', `${data[idx]} donation${data[idx] !== 1 ? 's' : ''}`);
  });
}

/* ==================== NOTIFICATION SYSTEM ==================== */
function initNotificationSystem() {
  /* Mark all as read */
  const markAllBtn = document.getElementById('markAllRead');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
        const dot = item.querySelector('.notif-unread-dot');
        if (dot) dot.remove();
      });

      /* Update badge count */
      const badge = document.querySelector('.topbar-notif-count');
      if (badge) badge.style.display = 'none';

      RED404.showToast('All notifications marked as read.', 'success', 2000);
    });
  }

  /* Update notification badge */
  updateNotifBadge();
}

function updateNotifBadge() {
  const unreadCount = document.querySelectorAll('.notif-item.unread').length;
  const badge       = document.querySelector('.topbar-notif-count');
  const navBadge    = document.querySelector('.nav-badge[data-type="notifications"]');

  if (badge) {
    badge.textContent    = unreadCount;
    badge.style.display  = unreadCount > 0 ? 'flex' : 'none';
  }
  if (navBadge) {
    navBadge.textContent = unreadCount;
  }
}

/* ==================== AVAILABILITY TOGGLE ==================== */
function initAvailabilityToggle() {
  const toggle = document.querySelector('.availability-toggle');
  if (!toggle) return;

  let isAvailable = RED404.Store.get('donorAvailable', true);
  updateAvailabilityUI(toggle, isAvailable);

  toggle.addEventListener('click', async () => {
    isAvailable = !isAvailable;
    updateAvailabilityUI(toggle, isAvailable);
    RED404.Store.set('donorAvailable', isAvailable);

    /* Sync with backend */
    await RED404.API.put('/donors/availability', { available: isAvailable });

    RED404.showToast(
      isAvailable
        ? 'You are now available for donations.'
        : 'You have been set as unavailable.',
      isAvailable ? 'success' : 'info',
      2500
    );
  });
}

function updateAvailabilityUI(toggle, isAvailable) {
  const dot  = toggle.querySelector('.avail-dot');
  const text = toggle.querySelector('span:last-child');

  toggle.classList.toggle('available',   isAvailable);
  toggle.classList.toggle('unavailable', !isAvailable);

  if (text) text.textContent = isAvailable ? 'Available' : 'Unavailable';
}

/* ==================== LOAD DONOR PROFILE ==================== */
async function loadDonorProfile() {
  /* Try to load from backend */
  const result = await RED404.API.get('/donors/profile');

  let donor;
  if (result.success) {
    donor = result.data;
  } else {
    /* Fallback mock data */
    donor = {
      firstName:       'Rahul',
      lastName:        'Sharma',
      bloodType:       'O+',
      phone:           '+91 98765 43210',
      email:           'rahul.sharma@email.com',
      city:            'Mumbai',
      state:           'Maharashtra',
      totalDonations:  7,
      lastDonation:    '2024-08-15',
      nextEligible:    '2024-11-15',
      joined:          '2022-03-10',
      availability:    'always',
      zone:            'Zone 1 (0–5 km)',
      weight:          72,
    };
  }

  populateDonorProfile(donor);
}

function populateDonorProfile(donor) {
  const fullName = `${donor.firstName} ${donor.lastName}`;

  /* Sidebar profile */
  const profileName   = document.querySelector('.profile-name');
  const profileBlood  = document.querySelector('.profile-blood');
  const profileAvatar = document.querySelector('.profile-avatar');

  if (profileName)   profileName.textContent   = fullName;
  if (profileBlood)  profileBlood.textContent  = donor.bloodType;
  if (profileAvatar) profileAvatar.textContent = RED404.initials(fullName);

  /* Welcome banner */
  const welcomeNameEl = document.querySelector('.welcome-text h2 span');
  if (welcomeNameEl) welcomeNameEl.textContent = donor.firstName;

  /* Profile card fields */
  const fields = {
    'pil-name':       fullName,
    'pil-blood':      donor.bloodType,
    'pil-phone':      donor.phone,
    'pil-email':      donor.email,
    'pil-city':       `${donor.city}, ${donor.state}`,
    'pil-zone':       donor.zone,
    'pil-last-don':   donor.lastDonation   ? RED404.formatDate(donor.lastDonation)   : 'Never',
    'pil-next-elig':  donor.nextEligible   ? RED404.formatDate(donor.nextEligible)   : 'Eligible now',
    'pil-joined':     donor.joined         ? RED404.formatDate(donor.joined)         : '--',
    'pil-avail':      RED404.capitalize(donor.availability || ''),
    'pil-weight':     donor.weight ? `${donor.weight} kg` : '--',
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  /* Profile large avatar */
  const largeAvatar = document.querySelector('.profile-avatar-large');
  if (largeAvatar) largeAvatar.textContent = RED404.initials(fullName);

  const nameLargeEl = document.querySelector('.profile-name-display');
  if (nameLargeEl) nameLargeEl.textContent = fullName;
}

/* ==================== DONATION HISTORY ==================== */
async function loadDonationHistory() {
  const tableBody = document.getElementById('donationHistoryBody');
  if (!tableBody) return;

  const result = await RED404.API.get('/donors/donations');
  let   donations;

  if (result.success) {
    donations = result.data;
  } else {
    /* Mock data */
    donations = [
      { id: 'DON001', date: '2024-08-15', hospital: 'City General Hospital', bloodType: 'O+', units: 1, status: 'completed' },
      { id: 'DON002', date: '2024-05-20', hospital: 'Apollo Medical Center',  bloodType: 'O+', units: 1, status: 'completed' },
      { id: 'DON003', date: '2024-02-10', hospital: 'Fortis Hospital',        bloodType: 'O+', units: 1, status: 'completed' },
      { id: 'DON004', date: '2023-11-05', hospital: 'Lilavati Hospital',      bloodType: 'O+', units: 1, status: 'completed' },
      { id: 'DON005', date: '2023-08-01', hospital: 'Kokilaben Hospital',     bloodType: 'O+', units: 1, status: 'completed' },
    ];
  }

  if (!donations.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="history-empty">
            <i class="fas fa-history"></i>
            <p>No donation history yet. Your first donation will appear here.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = donations.map((d, idx) => `
    <tr style="animation:slideInUp 0.4s ease ${idx * 60}ms both">
      <td>${d.id}</td>
      <td>${RED404.formatDate(d.date)}</td>
      <td>${d.hospital}</td>
      <td>
        <span class="blood-tag o-pos">${d.bloodType}</span>
      </td>
      <td>${d.units} unit${d.units !== 1 ? 's' : ''}</td>
      <td>
        <span class="badge badge-green">
          <i class="fas fa-check-circle"></i> ${RED404.capitalize(d.status)}
        </span>
      </td>
    </tr>
  `).join('');
}

/* ==================== BADGES ==================== */
async function loadBadges() {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;

  const allBadges = [
    { icon: '🩸', name: 'First Drop',     desc: 'Made your first donation',    earned: true  },
    { icon: '🔥', name: 'On Fire',        desc: '3 donations in a year',        earned: true  },
    { icon: '⭐', name: 'Star Donor',     desc: '5 total donations',            earned: true  },
    { icon: '🦸', name: 'Hero',           desc: '10 total donations',           earned: false },
    { icon: '💎', name: 'Diamond',        desc: '25 total donations',           earned: false },
    { icon: '🏆', name: 'Champion',       desc: '50 total donations',           earned: false },
    { icon: '⚡', name: 'Quick Response', desc: 'Responded within 5 minutes',   earned: true  },
    { icon: '🌍', name: 'Community Hero', desc: 'Donated in 3 different zones', earned: false },
  ];

  grid.innerHTML = allBadges.map((badge, idx) => `
    <div class="badge-item ${badge.earned ? 'earned' : 'locked'}"
         style="animation:scaleIn 0.4s ease ${idx * 60}ms both"
         title="${badge.desc}">
      <div class="badge-icon-wrap">
        <span style="font-size:1.6rem">${badge.icon}</span>
        ${!badge.earned ? '<div class="badge-lock-icon"><i class="fas fa-lock"></i></div>' : ''}
      </div>
      <span class="badge-name">${badge.name}</span>
      <span class="badge-desc">${badge.desc}</span>
    </div>
  `).join('');
}

/* ==================== DONOR LEVEL ==================== */
async function loadDonorLevel() {
  const levelCard = document.querySelector('.level-card');
  if (!levelCard) return;

  /* Level definitions */
  const levels = [
    { name: 'New Donor',    minDonations: 0,   icon: '🌱', color: '#9898b8' },
    { name: 'Contributor',  minDonations: 2,   icon: '💧', color: '#4285f4' },
    { name: 'Active Donor', minDonations: 5,   icon: '🩸', color: '#e63946' },
    { name: 'Hero Donor',   minDonations: 10,  icon: '🦸', color: '#ff8800' },
    { name: 'Life Saver',   minDonations: 20,  icon: '⭐', color: '#ffcc00' },
    { name: 'Champion',     minDonations: 50,  icon: '🏆', color: '#00cc66' },
  ];

  const totalDonations = 7; /* Fetch from API in production */

  const currentLevel = [...levels].reverse().find(l => totalDonations >= l.minDonations);
  const nextLevel    = levels.find(l => l.minDonations > totalDonations);

  const needed   = nextLevel ? nextLevel.minDonations - totalDonations : 0;
  const progress = nextLevel
    ? ((totalDonations - currentLevel.minDonations) /
       (nextLevel.minDonations - currentLevel.minDonations)) * 100
    : 100;

  const levelTitleEl    = levelCard.querySelector('.level-title');
  const levelSubEl      = levelCard.querySelector('.level-subtitle');
  const levelIconEl     = levelCard.querySelector('.level-icon-wrap');
  const levelBarEl      = levelCard.querySelector('.strength-fill, .level-bar-fill');
  const levelProgressEl = levelCard.querySelector('.level-progress-wrap');

  if (levelIconEl)  levelIconEl.textContent  = currentLevel.icon;
  if (levelTitleEl) levelTitleEl.textContent = currentLevel.name;
  if (levelSubEl) {
    levelSubEl.textContent = nextLevel
      ? `${needed} more donation${needed !== 1 ? 's' : ''} to reach ${nextLevel.name}`
      : '🎉 Maximum level reached!';
  }

  if (levelProgressEl) {
    levelProgressEl.innerHTML = `
      <div class="level-progress-label">
        <span>${currentLevel.name}</span>
        <span style="color:${currentLevel.color}">
          ${totalDonations}${nextLevel ? ` / ${nextLevel.minDonations}` : ' donations'}
        </span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-fill" style="width:0%;background:linear-gradient(90deg,${currentLevel.color},${nextLevel?.color || currentLevel.color})"></div>
      </div>
    `;

    /* Animate bar after render */
    setTimeout(() => {
      const fill = levelProgressEl.querySelector('.progress-fill');
      if (fill) fill.style.width = `${progress}%`;
    }, 400);
  }
}

/* ==================== SIMULATE INCOMING REQUEST ==================== */
function simulateIncomingRequest() {
  const banner = document.getElementById('activeRequestBanner');
  if (!banner) return;

  /* In production, this comes from WebSocket / SSE */
  const mockRequest = {
    id:        'REQ-2024-0891',
    bloodType: 'O+',
    hospital:  'Kokilaben Dhirubhai Ambani Hospital',
    distance:  '2.4 km',
    eta:       '8 min',
    urgency:   'critical',
    units:     2,
    expiresIn: 300, /* 5 minutes in seconds */
  };

  populateRequestBanner(mockRequest);

  /* Start countdown timer */
  RED404.startCountdown(
    mockRequest.expiresIn,
    remaining => {
      const timerEl = document.getElementById('requestTimer');
      if (timerEl) {
        timerEl.textContent = RED404.secondsToMMSS(remaining);
        if (remaining <= 60) timerEl.style.color = '#ff4444';
      }
    },
    () => {
      /* Timer expired */
      if (banner) {
        banner.style.animation = 'none';
        banner.style.opacity   = '0.4';
        banner.style.pointerEvents = 'none';
        RED404.showToast('Blood request has expired.', 'warning');
      }
    }
  );
}

function populateRequestBanner(req) {
  const banner = document.getElementById('activeRequestBanner');
  if (!banner) return;

  const bloodTypeEl  = banner.querySelector('.arb-blood-type');
  const hospitalEl   = banner.querySelector('.arb-hospital');
  const distanceEl   = banner.querySelector('[data-arb="distance"]');
  const etaEl        = banner.querySelector('[data-arb="eta"]');
  const unitsEl      = banner.querySelector('[data-arb="units"]');
  const urgencyEl    = banner.querySelector('.arb-urgency');

  if (bloodTypeEl) bloodTypeEl.textContent = req.bloodType;
  if (hospitalEl)  hospitalEl.textContent  = req.hospital;
  if (distanceEl)  distanceEl.textContent  = req.distance;
  if (etaEl)       etaEl.textContent       = req.eta;
  if (unitsEl)     unitsEl.textContent     = `${req.units} unit${req.units !== 1 ? 's' : ''}`;
  if (urgencyEl) {
    urgencyEl.className = `arb-urgency ${req.urgency}`;
    urgencyEl.innerHTML = `
      <i class="fas fa-${req.urgency === 'critical' ? 'exclamation-triangle' : 'info-circle'}"></i>
      ${RED404.capitalize(req.urgency)}
    `;
  }

  banner.style.display = 'block';
}

/* ==================== ACCEPT / DECLINE REQUEST ==================== */
window.acceptRequest = async function (requestId) {
  const btn = document.getElementById('acceptBtn');
  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accepting...';
    btn.disabled  = true;
  }

  const result = await RED404.API.post(`/requests/${requestId}/accept`, {});

  if (result.success || true) { /* Mock success */
    RED404.showToast('Request accepted! Route is being calculated...', 'success');
    showRouteCard();
    updateNotificationAfterAccept(requestId);
  } else {
    RED404.showToast(result.error || 'Failed to accept request.', 'error');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check"></i> Accept';
      btn.disabled  = false;
    }
  }
};

window.declineRequest = async function (requestId) {
  const result = await RED404.API.post(`/requests/${requestId}/decline`, {});

  const banner = document.getElementById('activeRequestBanner');
  if (banner) {
    banner.style.transition = 'opacity 0.4s ease';
    banner.style.opacity    = '0';
    setTimeout(() => { banner.style.display = 'none'; }, 400);
  }

  RED404.showToast('Request declined. You will be notified of the next request.', 'info');
};

function showRouteCard() {
  const routeCard = document.getElementById('routeCard');
  if (routeCard) {
    routeCard.style.display = 'block';
    routeCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateNotificationAfterAccept(requestId) {
  const notifList = document.querySelector('.notif-list');
  if (!notifList) return;

  const newNotif = document.createElement('div');
  newNotif.className = 'notif-item unread';
  newNotif.style.animation = 'slideInDown 0.4s ease';
  newNotif.innerHTML = `
    <div class="notif-icon done"><i class="fas fa-check"></i></div>
    <div class="notif-body">
      <div class="notif-title">Request Accepted</div>
      <div class="notif-desc">You accepted a blood request. Navigate to the hospital.</div>
      <div class="notif-time">Just now</div>
    </div>
    <div class="notif-unread-dot"></div>
  `;

  notifList.insertBefore(newNotif, notifList.firstChild);
  updateNotifBadge();
}

/* ==================== MAP PLACEHOLDER ==================== */
function initMapPlaceholder() {
  const mapEl = document.getElementById('donorMapPlaceholder');
  if (!mapEl) return;

  /* In production, initialize Google Maps or Leaflet here */
  mapEl.innerHTML = `
    <div class="map-placeholder-icon">
      <i class="fas fa-map-marked-alt"></i>
    </div>
    <p>Accept a blood request to see the route to the hospital.<br>
    Powered by <strong>Dijkstra's Shortest Path Algorithm</strong>.</p>
  `;
}

/* ==================== PROFILE EDIT ==================== */
window.editProfile = async function () {
  const form = document.getElementById('editProfileForm');
  if (!form) return;

  const payload = {
    phone:        document.getElementById('editPhone')?.value.trim(),
    address:      document.getElementById('editAddress')?.value.trim(),
    city:         document.getElementById('editCity')?.value.trim(),
    availability: document.getElementById('editAvailability')?.value,
  };

  const result = await RED404.API.put('/donors/profile', payload);

  if (result.success || true) {
    RED404.showToast('Profile updated successfully!', 'success');
    RED404.closeModal('editProfileModal');
    loadDonorProfile();
  } else {
    RED404.showToast(result.error || 'Failed to update profile.', 'error');
  }
};

/* ==================== CHANGE PASSWORD ==================== */
window.changePassword = async function () {
  const current = document.getElementById('currentPassword')?.value || '';
  const newPass = document.getElementById('newPassword')?.value     || '';
  const confirm = document.getElementById('confirmNewPassword')?.value || '';

  if (!current || !newPass || !confirm) {
    RED404.showToast('All password fields are required.', 'warning');
    return;
  }

  if (!RED404.Validate.password(newPass)) {
    RED404.showToast('New password must be at least 8 characters.', 'warning');
    return;
  }

  if (!RED404.Validate.match(newPass, confirm)) {
    RED404.showToast('New passwords do not match.', 'error');
    return;
  }

  const result = await RED404.API.post('/donors/change-password', {
    currentPassword: current,
    newPassword:     newPass,
  });

  if (result.success || true) {
    RED404.showToast('Password changed successfully!', 'success');
    RED404.closeModal('changePasswordModal');
  } else {
    RED404.showToast(result.error || 'Failed to change password.', 'error');
  }
};

/* ==================== LOGOUT ==================== */
window.donorLogout = function () {
  RED404.Auth.clearSession();
  RED404.Store.remove('donorToken');
  RED404.showToast('Logged out successfully.', 'info', 1500);
  setTimeout(() => { window.location.href = 'donor-login.html'; }, 1500);
};