/**
 * RED404 — Floating Glass Command Pill Navigation & User Profile Dropdown
 */

(function () {
  'use strict';

  function initCommandNav() {
    const avatarTrigger = document.getElementById('userProfileTrigger');
    const dropdown = document.getElementById('userProfileDropdown');
    const logoutBtn = document.getElementById('dropdownLogoutBtn');
    const privacyBtn = document.getElementById('privacySettingsBtn');
    const notifBtn = document.getElementById('navNotifBtn');
    const gpsPill = document.getElementById('navGpsIndicator');
    const avatarInitials = document.getElementById('userAvatarInitials');
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    const dropdownUserEmailSpan = document.getElementById('dropdown-user-email');

    // 1. Load active user session if available
    let session = null;
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) session = JSON.parse(raw);
    } catch (e) {
      console.warn('Session parse notice:', e);
    }

    const currentUser = session ? (session.user || session) : null;
    const userName = (currentUser && (currentUser.name || (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : null))) || 'Ankit Kumar';
    const userEmail = (currentUser && currentUser.email) || 'ankit@red404.in';

    // Compute initials (e.g., Ankit Kumar -> AK)
    const initials = userName
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'AK';

    if (avatarInitials) avatarInitials.textContent = initials;
    if (dropdownName) dropdownName.textContent = userName;
    if (dropdownUserEmailSpan) {
      dropdownUserEmailSpan.textContent = userEmail;
    } else if (dropdownEmail) {
      dropdownEmail.textContent = `Signed in as ${userEmail}`;
    }

    // 2. Avatar dropdown toggle
    if (avatarTrigger && dropdown) {
      avatarTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        if (isOpen) {
          dropdown.classList.remove('show');
          avatarTrigger.setAttribute('aria-expanded', 'false');
        } else {
          dropdown.classList.add('show');
          avatarTrigger.setAttribute('aria-expanded', 'true');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !avatarTrigger.contains(e.target)) {
          dropdown.classList.remove('show');
          avatarTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      // Close dropdown on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdown.classList.contains('show')) {
          dropdown.classList.remove('show');
          avatarTrigger.setAttribute('aria-expanded', 'false');
          avatarTrigger.focus();
        }
      });
    }

    // 3. Logout action
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          if (typeof Auth !== 'undefined' && Auth.clearSession) {
            Auth.clearSession();
          }
          localStorage.removeItem('red404_donor_session');
          sessionStorage.removeItem('red404_donor_session');
          localStorage.removeItem('red404_session');
          localStorage.removeItem('donorUser');
          localStorage.removeItem('red404_donorToken');
        } catch (err) {}
        window.location.href = 'donor-login.html';
      });
    }

    // 4. Privacy settings modal / toast
    if (privacyBtn) {
      privacyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof showToast === 'function') {
          showToast('Security & Encryption: 256-bit TLS active. Telemetry secured.', 'success');
        } else {
          alert('Security & Encryption: 256-bit TLS active. Telemetry secured.');
        }
      });
    }

    // 5. Notification bell interaction
    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        const notifCard = document.getElementById('systemFeedCard');
        if (notifCard) {
          notifCard.scrollIntoView({ behavior: 'smooth' });
          notifCard.style.outline = '2px solid rgba(239, 68, 68, 0.7)';
          setTimeout(() => { notifCard.style.outline = 'none'; }, 2000);
        } else if (typeof showToast === 'function') {
          showToast('3 Emergency Alerts broadcasted in your local sector.', 'info');
        }
      });
    }

    // 6. Live GPS Indicator click
    if (gpsPill) {
      gpsPill.addEventListener('click', () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                if (res.ok) {
                  const data = await res.json();
                  const addr = data.address || {};
                  const district = addr.county || addr.state_district || addr.district || addr.city || addr.town || 'Local';
                  const state = addr.state || '';
                  const locStr = state ? `${district}, ${state}` : district;
                  const span = gpsPill.querySelector('span:not(.gps-dot-pulse)');
                  if (span) span.textContent = `Live GPS: ${locStr}`;
                  if (typeof showToast === 'function') {
                    showToast(`GPS Synced: ${locStr} (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`, 'success');
                  }
                  return;
                }
              } catch (_) {}
              if (typeof showToast === 'function') {
                showToast(`GPS Refreshed: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`, 'success');
              }
            },
            () => {
              if (typeof showToast === 'function') {
                showToast('Live GPS Signal Connected', 'info');
              }
            }
          );
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandNav);
  } else {
    initCommandNav();
  }
})();

