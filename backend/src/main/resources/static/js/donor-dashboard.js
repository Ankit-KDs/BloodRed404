
/* ================================================================
   RED404 — Donor Dashboard JS (Real-time + Backend Connected)
   ================================================================ */

const API_BASE = '/api';

// ============================================================
// API HELPER (uses common.js API or direct fetch with credentials)
// ============================================================
async function apiCall(endpoint, options = {}) {
  let ep = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  if (ep.startsWith('/donor/')) {
    ep = ep.replace('/donor/', '/donors/');
  }
  if (typeof API !== 'undefined' && typeof API.request === 'function') {
    return await API.request(ep, options);
  }
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  const config = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...(options.headers || {}) } };
  const token = (typeof Store !== 'undefined' && Store.get('donorToken')) || localStorage.getItem('red404_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE}${ep}`, config);
    if (response.status === 401) {
      window.location.href = 'donor-login.html';
      return null;
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`API ${ep} failed:`, err);
    return null;
  }
}

// ============================================================
// AUTH CHECK ON LOAD (Strict Real-time Validation)
// ============================================================
async function verifySession() {
  try {
    const res = await apiCall('/auth/check-session', { method: 'GET' });
    if (res && res.success && res.data && (res.data.donor || res.data.role === 'DONOR')) {
      const donorData = res.data.donor || res.data;
      if (typeof Auth !== 'undefined') Auth.saveSession(donorData);
      return donorData;
    }
  } catch (err) {
    console.warn('Session check failed:', err);
  }
  // Not authenticated on server — wipe client cache and redirect
  if (typeof Auth !== 'undefined') Auth.clearSession();
  if (typeof Store !== 'undefined') {
    Store.rm('donorToken');
    Store.rm('donorSession');
  }
  localStorage.removeItem('red404_token');
  localStorage.removeItem('red404_user');
  sessionStorage.clear();
  window.location.replace('donor-login.html');
  return null;
}

function renderDonorProfileData(d) {
  if (!d) return;
  const name = d.fullName || d.name || 'Donor';
  const initial = name.charAt(0).toUpperCase();
  const blood = d.bloodType || '—';

  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) avatarEl.textContent = initial;

  const profNameEl = document.getElementById('sidebarProfileName');
  if (profNameEl) profNameEl.textContent = name;

  const bloodEl = document.getElementById('sidebarBloodType');
  if (bloodEl) bloodEl.textContent = blood;

  const welcomeEl = document.getElementById('welcomeName');
  if (welcomeEl) welcomeEl.textContent = name.split(' ')[0];

  const profileAvatarLarge = document.getElementById('profileAvatarLarge');
  if (profileAvatarLarge && profileAvatarLarge.firstChild) {
    profileAvatarLarge.firstChild.textContent = initial;
  }
  const profileNameDisplay = document.getElementById('profileNameDisplay');
  if (profileNameDisplay) profileNameDisplay.textContent = name;

  const profileBloodBadge = document.getElementById('profileBloodBadge');
  if (profileBloodBadge) profileBloodBadge.textContent = blood;

  const setIfExists = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };

  setIfExists('pil-name', name);
  setIfExists('pil-blood', blood);
  setIfExists('pil-phone', d.phone);
  setIfExists('pil-email', d.email);
  setIfExists('pil-city', `${d.city || ''}${d.state ? ', ' + d.state : ''}`);
  setIfExists('pil-zone', d.zone || 'Zone 1 (0-5 km)');
  setIfExists('pil-weight', d.weight ? `${d.weight} kg` : '—');
  setIfExists('pil-last-don', d.lastDonationDate || d.lastDonation ? formatDate(d.lastDonationDate || d.lastDonation) : 'Never');
  setIfExists('pil-next-elig', d.nextEligibleDate ? formatDate(d.nextEligibleDate) : 'Eligible Now');
  setIfExists('pil-joined', d.memberSince || d.createdAt ? formatDate(d.memberSince || d.createdAt) : 'Recently');
  setIfExists('pil-avail', capitalize(d.availability || 'Available'));

  const availBtn = document.getElementById('availabilityToggle');
  const availLabel = document.getElementById('availabilityLabel');
  if (availBtn && availLabel) {
    if (d.availability === 'unavailable' || d.availability === 'Unavailable') {
      availBtn.classList.remove('available');
      availLabel.textContent = 'Unavailable';
    } else {
      availBtn.classList.add('available');
      availLabel.textContent = 'Available';
    }
  }
  window.__donor = d;
}

// ============================================================
// LOAD DONOR PROFILE
// ============================================================
async function loadDonorProfile() {
  const local = typeof Auth !== 'undefined' ? Auth.getSession() : null;
  if (local) renderDonorProfileData(local);

  const res = await apiCall('/donor/profile');
  if (res && res.success && res.data) {
    renderDonorProfileData(res.data);
  }
}

// ============================================================
// LOAD DASHBOARD STATS
// ============================================================
async function loadDashboardStats() {
  const res = await apiCall('/donor/dashboard-stats');
  if (!res || !res.success) return;
  const s = res.data;

  // Welcome banner
  animateCounter('totalDonationsWelcome', s.totalDonations || 0);
  animateCounter('livesSavedWelcome', s.livesImpacted || 0);
  animateCounter('badgesEarnedWelcome', s.badgesEarned || 0);

  // Stats cards
  animateCounter('statTotalDonations', s.totalDonations || 0);
  animateCounter('statLivesImpacted', s.livesImpacted || 0);
  animateCounter('statBadgesEarned', s.badgesEarned || 0);

  document.getElementById('statDonationsTrend').textContent = `+${s.donationsThisYear || 0} this year`;
  document.getElementById('statDaysToEligible').textContent = s.daysToNextEligible ?? '—';
  document.getElementById('statNextEligibleDate').textContent = s.nextEligibleDate ? formatDate(s.nextEligibleDate) : '—';
  document.getElementById('statDonorLevel').textContent = `${s.donorLevel || '—'} level`;

  // Donor level card
  document.getElementById('levelTitle').textContent = s.donorLevel || 'New Donor';
  document.getElementById('levelBadge').textContent = `Level ${s.donorLevelNumber || 1}`;
  document.getElementById('levelSubtitle').textContent =
    `${s.donationsToNextLevel || 0} more donations to reach ${s.nextLevel || 'next level'}`;

  const progressPct = Math.round(((s.totalDonations || 0) / (s.nextLevelThreshold || 10)) * 100);
  document.getElementById('levelProgressWrap').innerHTML = `
    <div class="level-progress-label">
      <span>${s.donorLevel || 'New Donor'}</span>
      <span style="color:#e63946;font-weight:700">${s.totalDonations || 0} / ${s.nextLevelThreshold || 10}</span>
    </div>
    <div class="progress-bar-wrap" style="margin-top:0.35rem">
      <div class="progress-fill" style="width:0%;background:linear-gradient(90deg,#e63946,#ff8800);transition:width 1.2s ease;"></div>
    </div>
  `;
  setTimeout(() => {
    const fill = document.querySelector('#levelProgressWrap .progress-fill');
    if (fill) fill.style.width = `${Math.min(progressPct, 100)}%`;
  }, 200);
}

// ============================================================
// LOAD DONATION CHART (12 months)
// ============================================================
async function loadDonationChart() {
  const res = await apiCall('/donor/donation-chart');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = (res && res.success) ? res.data : new Array(12).fill(0);
  const max = Math.max(...data, 1);

  const html = months.map((m, i) => {
    const h = Math.max(4, (data[i] / max) * 100);
    return `
      <div class="chart-bar-group">
        <div class="chart-bar" style="height:${h}%" title="${data[i]} donation(s) in ${m}"></div>
        <span class="chart-bar-label">${m}</span>
      </div>`;
  }).join('');
  document.getElementById('chartBars').innerHTML = html;
}

// ============================================================
// LOAD DONATION HISTORY
// ============================================================
async function loadDonationHistory() {
  const res = await apiCall('/donor/donation-history');
  const tbody = document.getElementById('donationHistoryBody');
  if (!res || !res.success || !res.data || res.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="history-empty"><i class="fas fa-inbox"></i><p>No donations yet. Start your journey today!</p></div></td></tr>`;
    document.getElementById('historyCount').textContent = '0';
    return;
  }
  const rows = res.data.map(d => `
    <tr>
      <td>#${d.donationId}</td>
      <td>${formatDate(d.donationDate)}</td>
      <td>${d.hospitalName}</td>
      <td><span class="blood-tag o-pos">${d.bloodType}</span></td>
      <td>${d.units}</td>
      <td><span class="badge badge-${d.status === 'COMPLETED' ? 'green' : 'orange'}">${d.status}</span></td>
    </tr>
  `).join('');
  tbody.innerHTML = rows;
  document.getElementById('historyCount').textContent = res.data.length;
}

// ============================================================
// LOAD BADGES
// ============================================================
async function loadBadges() {
  const res = await apiCall('/donor/badges');
  const grid = document.getElementById('badgesGrid');
  if (!res || !res.success) {
    grid.innerHTML = `<p style="color:var(--text-muted)">Could not load badges.</p>`;
    return;
  }
  const badges = res.data || [];
  const earnedCount = badges.filter(b => b.earned).length;
  document.getElementById('badgesEarnedCount').textContent = earnedCount;
  document.getElementById('badgesTotalCount').textContent = badges.length;

  grid.innerHTML = badges.map(b => `
    <div class="badge-card ${b.earned ? 'earned' : 'locked'}">
      <div class="badge-icon">${b.icon || '🏆'}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.description}</div>
      ${b.earned
      ? `<div class="badge-earned-date">Earned ${formatDate(b.earnedDate)}</div>`
      : `<div class="badge-progress">${b.progress || 0}/${b.target || 1}</div>`}
    </div>
  `).join('');
}

// ============================================================
// LOAD NOTIFICATIONS
// ============================================================
async function loadNotifications() {
  const res = await apiCall('/donor/notifications');
  const list = document.getElementById('notifList');
  if (!res || !res.success) {
    list.innerHTML = `<p style="padding:1rem;color:var(--text-muted)">No notifications.</p>`;
    return;
  }
  const items = res.data || [];
  const unreadCount = items.filter(n => !n.read).length;
  document.getElementById('topbarNotifCount').textContent = unreadCount;
  document.getElementById('sidebarNotifBadge').textContent = unreadCount;

  if (items.length === 0) {
    list.innerHTML = `<div class="history-empty" style="padding:2rem;text-align:center;"><i class="fas fa-bell-slash"></i><p>No notifications</p></div>`;
    return;
  }

  list.innerHTML = items.map(n => `
    <div class="notif-item ${!n.read ? 'unread' : ''}" data-id="${n.id}" onclick="markNotificationRead(${n.id})">
      <div class="notif-icon ${n.iconType || 'info'}"><i class="fas ${n.icon || 'fa-bell'}"></i></div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.description}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
      ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
    </div>
  `).join('');
}

async function markNotificationRead(id) {
  await apiCall(`/donor/notifications/${id}/read`, { method: 'POST' });
  loadNotifications();
}

async function markAllNotificationsRead() {
  await apiCall('/donor/notifications/mark-all-read', { method: 'POST' });
  showToast('All notifications marked as read', 'success');
  loadNotifications();
}

// ============================================================
// LOAD BLOOD REQUESTS (live + nearby)
// ============================================================
async function loadBloodRequests() {
  const res = await apiCall('/donor/blood-requests');
  if (!res || !res.success) return;
  const requests = res.data || [];

  const live = requests.find(r => r.status === 'LIVE' || r.urgency === 'CRITICAL');
  const nearby = requests.filter(r => r !== live);

  // Active request banner (overview + requests page)
  const arbHtml = live ? renderActiveRequest(live) : '';
  document.getElementById('activeRequestContainer').innerHTML = arbHtml;
  document.getElementById('liveRequestContainer').innerHTML = arbHtml;

  // Start countdown if any
  // Start countdown if any
  if (live && live.expiresAt) startRequestTimer(live.expiresAt);

  // Nearby requests list
  const nearbyList = document.getElementById('nearbyRequestsList');
  if (nearby.length === 0) {
    nearbyList.innerHTML = `
      <div class="history-empty" style="padding:2rem;text-align:center;">
        <i class="fas fa-check-circle" style="color:#00cc66"></i>
        <p>No nearby requests right now. We'll notify you when one comes in.</p>
      </div>`;
  } else {
    nearbyList.innerHTML = nearby.map(r => `
      <div class="notif-item">
        <div class="notif-icon ${urgencyToIconClass(r.urgency)}"><i class="fas fa-tint"></i></div>
        <div class="notif-body">
          <div class="notif-title">${r.bloodType} Blood Needed — ${r.hospitalName}</div>
          <div class="notif-desc">${r.units} unit(s) required. Distance: ${r.distanceKm} km · ETA ~${r.etaMinutes} min</div>
          <div class="notif-time">
            <span class="arb-urgency ${r.urgency.toLowerCase()}" style="font-size:0.68rem">
              <i class="fas ${urgencyIcon(r.urgency)}"></i> ${capitalize(r.urgency)}
            </span>
            <button onclick="acceptRequest('${r.requestId}')" style="margin-left:0.6rem;background:none;border:none;color:var(--red-light);font-weight:600;cursor:pointer;font-size:0.78rem">
              <i class="fas fa-check"></i> Respond
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function renderActiveRequest(r) {
  return `
    <div class="active-request-banner" style="margin-bottom:1.5rem">
      <div class="arb-header">
        <span class="arb-badge"><i class="fas fa-circle"></i> LIVE REQUEST</span>
        <span class="arb-timer">
          <i class="fas fa-stopwatch"></i>
          <span id="requestTimer">--:--</span>
        </span>
      </div>
      <div class="arb-body">
        <div class="arb-blood-type">${r.bloodType}</div>
        <div class="arb-info">
          <div class="arb-hospital">${r.hospitalName}</div>
          <div class="arb-details">
            <div class="arb-detail-item"><i class="fas fa-map-marker-alt"></i><span>${r.distanceKm} km</span></div>
            <div class="arb-detail-item"><i class="fas fa-car"></i><span>${r.etaMinutes} min</span></div>
            <div class="arb-detail-item"><i class="fas fa-tint"></i><span>${r.units} units</span></div>
          </div>
          <span class="arb-urgency ${r.urgency.toLowerCase()}">
            <i class="fas ${urgencyIcon(r.urgency)}"></i> ${capitalize(r.urgency)}
          </span>
        </div>
        <div class="arb-actions">
          <button class="btn-accept" onclick="acceptRequest('${r.requestId}')">
            <i class="fas fa-check"></i> Accept
          </button>
          <button class="btn-decline" onclick="declineRequest('${r.requestId}')">
            <i class="fas fa-times"></i> Decline
          </button>
        </div>
      </div>
    </div>
  `;
}

function urgencyToIconClass(urgency) {
  switch ((urgency || '').toUpperCase()) {
    case 'CRITICAL': return 'alert';
    case 'HIGH': return 'alert';
    case 'NORMAL': return 'info';
    default: return 'info';
  }
}
function urgencyIcon(urgency) {
  switch ((urgency || '').toUpperCase()) {
    case 'CRITICAL': return 'fa-exclamation-triangle';
    case 'HIGH': return 'fa-exclamation';
    case 'NORMAL': return 'fa-check';
    default: return 'fa-info';
  }
}

// ============================================================
// REQUEST TIMER
// ============================================================
let timerInterval = null;
function startRequestTimer(expiresAt) {
  if (timerInterval) clearInterval(timerInterval);
  const expiry = new Date(expiresAt).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    const els = document.querySelectorAll('#requestTimer');
    els.forEach(el => el.textContent = `${m}:${s}`);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      loadBloodRequests(); // refresh on expiry
    }
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}


// Har 10 second mein naye requests check karne ke liye
function initRealTimePolling() {
  setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/requests/active`);
      const result = await res.json();
      if (result.success && result.data.length > 0) {
        // Dashboard update logic yahan likhein
        renderActiveRequests(result.data, document.getElementById('activeRequestsList'));
        showToast("New Emergency Alert!", "critical");
      }
    } catch (e) { console.error("Polling error", e); }
  }, 10000);
}


// ============================================================
// ACCEPT / DECLINE BLOOD REQUEST
// ============================================================
async function acceptRequest(requestId) {
  const res = await apiCall(`/donor/blood-requests/${requestId}/accept`, { method: 'POST' });
  if (!res || !res.success) return;

  showToast('Request accepted! Route is being calculated…', 'success');

  // Show route card with details from response
  const route = res.data;
  const routeCard = document.getElementById('routeCard');
  routeCard.style.display = 'block';
  document.getElementById('donorMapPlaceholder').innerHTML = `
    <div class="map-placeholder-icon" style="color:#00cc66"><i class="fas fa-route"></i></div>
    <p>
      <strong>Route active to ${route.hospitalName}</strong><br/>
      Computed via <strong>Real-Time Route Optimization</strong>.
    </p>
  `;
  document.getElementById('routeInfo').innerHTML = `
    <div class="route-info-item"><i class="fas fa-map-marker-alt"></i><span>Distance: <strong>${route.distanceKm} km</strong></span></div>
    <div class="route-info-item"><i class="fas fa-clock"></i><span>ETA: <strong>~${route.etaMinutes} minutes</strong></span></div>
    <div class="route-info-item"><i class="fas fa-hospital"></i><span>${route.hospitalName}</span></div>
    <div class="route-info-item"><i class="fas fa-tint"></i><span>Blood: <strong>${route.bloodType} · ${route.units} units</strong></span></div>
  `;

  // Refresh data
  loadBloodRequests();
  loadNotifications();
}

async function declineRequest(requestId) {
  const ok = await showAppConfirm({
    title: 'Decline Blood Request',
    message: 'Are you sure you want to decline this blood request?',
    type: 'warning',
    icon: 'fa-exclamation-triangle',
    confirmText: 'Decline Request',
    cancelText: 'Keep Request'
  });
  if (!ok) return;
  const res = await apiCall(`/donor/blood-requests/${requestId}/decline`, { method: 'POST' });
  if (!res || !res.success) return;
  showToast('Request declined', 'info');
  loadBloodRequests();
  loadNotifications();
}

// ============================================================
// AVAILABILITY TOGGLE
// ============================================================
async function toggleAvailability() {
  const btn = document.getElementById('availabilityToggle');
  const label = document.getElementById('availabilityLabel');
  const isAvailable = btn.classList.contains('available');
  const newState = !isAvailable;

  const res = await apiCall('/donor/availability', {
    method: 'PUT',
    body: JSON.stringify({ available: newState })
  });
  if (!res || !res.success) return;

  if (newState) {
    btn.classList.add('available');
    label.textContent = 'Available';
    showToast("You're now available for donations", 'success');
  } else {
    btn.classList.remove('available');
    label.textContent = 'Unavailable';
    showToast("You're now marked unavailable", 'warning');
  }
}

// ============================================================
// EDIT PROFILE
// ============================================================
function openEditProfileModal() {
  const d = window.__donor || {};
  document.getElementById('editFullName').value = d.fullName || '';
  document.getElementById('editPhone').value = d.phone || '';
  document.getElementById('editAddress').value = d.address || '';
  document.getElementById('editCity').value = d.city || '';
  document.getElementById('editWeight').value = d.weight || '';
  document.getElementById('editAvailability').value = d.availability || 'always';
  openModal('editProfileModal');
}

async function submitEditProfile(e) {
  e.preventDefault();
  const form = document.getElementById('editProfileForm');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.weight = payload.weight ? Number(payload.weight) : null;

  const res = await apiCall('/donor/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (!res || !res.success) return;

  showToast('Profile updated successfully!', 'success');
  closeModal('editProfileModal');
  loadDonorProfile();
}

// ============================================================
// CHANGE PASSWORD
// ============================================================
function openChangePasswordModal() {
  document.getElementById('changePasswordForm').reset();
  openModal('changePasswordModal');
}

async function submitChangePassword(e) {
  e.preventDefault();
  const current = document.getElementById('currentPassword').value;
  const next = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmNewPassword').value;

  if (next.length < 8) return showToast('New password must be at least 8 characters', 'error');
  if (next !== confirm) return showToast('Passwords do not match', 'error');

  const res = await apiCall('/donor/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: current, newPassword: next })
  });
  if (!res || !res.success) return;

  showToast('Password updated successfully', 'success');
  closeModal('changePasswordModal');
}

// ============================================================
// AVATAR UPLOAD
// ============================================================
async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return showToast('Image must be under 2 MB', 'error');

  const fd = new FormData();
  fd.append('avatar', file);

  const token = localStorage.getItem('red404_token');
  try {
    const res = await fetch(`${API_BASE}/donor/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: fd
    });
    const data = await res.json();
    if (data.success) {
      showToast('Avatar updated!', 'success');
      loadDonorProfile();
    } else {
      showToast(data.message || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast('Upload failed', 'error');
  }
}

// ============================================================
// LOAD SETTINGS
// ============================================================
async function loadSettings() {
  const res = await apiCall('/donor/settings');
  if (!res || !res.success) return;
  const s = res.data;
  document.getElementById('notifRequests').checked = !!s.notifRequests;
  document.getElementById('notifSMS').checked = !!s.notifSMS;
  document.getElementById('notifEmail').checked = !!s.notifEmail;
  document.getElementById('notifBadges').checked = !!s.notifBadges;
  document.getElementById('privProfile').checked = !!s.privProfile;
  document.getElementById('privLocation').checked = !!s.privLocation;
  document.getElementById('priv2FA').checked = !!s.priv2FA;
}

async function updateSetting(key, value) {
  const res = await apiCall('/donor/settings', {
    method: 'PUT',
    body: JSON.stringify({ [key]: value })
  });
  if (res && res.success) {
    showToast('Setting saved', 'success');
  }
}

// ============================================================
// EXPORT DONATION HISTORY (CSV)
// ============================================================
async function exportDonationHistory() {
  const token = localStorage.getItem('red404_token');
  try {
    const res = await fetch(`${API_BASE}/donor/donation-history/export`, {
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donation-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Export downloaded', 'success');
  } catch (err) {
    showToast('Could not export history', 'error');
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function donorLogout() {
  const ok = await showAppConfirm({
    title: 'Logout',
    message: 'Are you sure you want to logout from your Donor account?',
    type: 'danger',
    icon: 'fa-sign-out-alt',
    confirmText: 'Logout',
    cancelText: 'Stay Logged In'
  });
  if (!ok) return;
  try {
    await apiCall('/auth/logout', { method: 'POST' });
  } catch (e) { }
  if (typeof Auth !== 'undefined') Auth.clearSession();
  if (typeof Store !== 'undefined') {
    Store.rm('donorToken');
    Store.rm('donorSession');
  }
  localStorage.removeItem('red404_token');
  localStorage.removeItem('red404_user');
  sessionStorage.clear();
  window.location.replace('donor-login.html');
}

// ============================================================
// NAV / PAGE SWITCHING
// ============================================================
function showDashboardPage(page) {
  document.querySelectorAll('.dash-page').forEach(p => p.classList.remove('active-page'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active-page');

  // Update breadcrumb / title
  const titles = {
    overview: 'Overview',
    requests: 'Blood Requests',
    history: 'Donation History',
    badges: 'My Badges',
    profile: 'My Profile'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  document.getElementById('pageBreadcrumb').textContent = titles[page] || '';

  // Lazy-load on tab switch
  if (page === 'history') loadDonationHistory();
  if (page === 'badges') loadBadges();
  if (page === 'requests') loadBloodRequests();

  // Close mobile sidebar
  document.querySelector('.sidebar')?.classList.remove('mobile-open');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function setActiveNav(page) {
  document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));
  const item = document.querySelector(`.sidebar .nav-item[data-page="${page}"]`);
  if (item) item.classList.add('active');
}

// Bind sidebar nav clicks
function bindNavigation() {
  document.querySelectorAll('.sidebar .nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      showDashboardPage(page);
      setActiveNav(page);
    });
  });

  // Sidebar collapse
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('mainSidebar').classList.toggle('collapsed');
    document.getElementById('dashboardMain').classList.toggle('expanded');
  });

  // Mobile toggle
  document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.add('mobile-open');
    document.getElementById('mobileSidebarBackdrop').style.display = 'block';
  });

  // Show mobile toggle on small screens
  const checkMobile = () => {
    const mobileBtn = document.getElementById('mobileSidebarToggle');
    if (mobileBtn) mobileBtn.style.display = window.innerWidth <= 1024 ? 'flex' : 'none';
  };
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('open');
    m.style.display = 'flex';
  }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('open');
    m.style.display = 'none';
  }
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(24px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ============================================================
// UTILITIES
// ============================================================
function animateCounter(elementId, target, duration = 1200) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
  return formatDate(iso);
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================================
// REAL-TIME POLLING (every 30s)
// You can replace this with WebSocket / Server-Sent Events later
// ============================================================
// let pollingInterval = null;
// function startRealtimePolling() {
//   if (pollingInterval) clearInterval(pollingInterval);
//   pollingInterval = setInterval(() => {
//     loadNotifications();
//     loadBloodRequests();
//   }, 30000); // 30 seconds
// }


// Har 10-15 seconds mein data refresh karne ke liye polling
function startRealTimeUpdates() {
  setInterval(async () => {
    // Purane code ke functions ko call karein
    if (typeof loadActiveRequests === 'function') loadActiveRequests();
    if (typeof loadNearbyDonors === 'function') loadNearbyDonors();
  }, 15000);
}

// Initial load ke baad polling shuru karein
document.addEventListener('DOMContentLoaded', () => {
  // ... aapka purana init code ...
  startRealTimeUpdates();
});

// ============================================================
// BOOTSTRAP / INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify session
  const session = await verifySession();
  if (!session) return;

  // 2. Hide loading screen
  const loadingScreen = document.getElementById('authLoadingScreen');
  if (loadingScreen) loadingScreen.style.display = 'none';

  // 3. Bind navigation
  bindNavigation();

  // 4. Initial data load (parallel)
  await Promise.all([
    loadDonorProfile(),
    loadDashboardStats(),
    loadDonationChart(),
    loadNotifications(),
    loadBloodRequests()
  ]);

  // 5. Start real-time polling
  startRealtimePolling();

  // 6. Handle hash navigation
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`page-${hash}`)) {
    showDashboardPage(hash);
    setActiveNav(hash);
  }
});

// Expose globally for inline onclick handlers
window.showDashboardPage = showDashboardPage;
window.setActiveNav = setActiveNav;
window.acceptRequest = acceptRequest;
window.declineRequest = declineRequest;
window.toggleAvailability = toggleAvailability;
window.openEditProfileModal = openEditProfileModal;
window.submitEditProfile = submitEditProfile;
window.openChangePasswordModal = openChangePasswordModal;
window.submitChangePassword = submitChangePassword;
window.uploadAvatar = uploadAvatar;
window.updateSetting = updateSetting;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.exportDonationHistory = exportDonationHistory;
window.donorLogout = donorLogout;
window.openModal = openModal;
window.closeModal = closeModal;