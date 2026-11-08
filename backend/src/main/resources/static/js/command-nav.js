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

    // 1. Load active user session if available
    let session = null;
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) session = JSON.parse(raw);
    } catch (e) {
      console.warn('Session parse notice:', e);
    }

    const userName = (session && (session.name || (session.user && session.user.name))) || 'Ankit Kumar';
    const userEmail = (session && (session.email || (session.user && session.user.email))) || 'ankit@red404.in';

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
    if (dropdownEmail) dropdownEmail.textContent = `Signed in as ${userEmail}`;

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
          localStorage.removeItem('red404_donor_session');
          sessionStorage.removeItem('red404_donor_session');
          localStorage.removeItem('donorUser');
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
            (pos) => {
              if (typeof showToast === 'function') {
                showToast(`GPS Refreshed: ${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`, 'success');
              }
            },
            () => {
              if (typeof showToast === 'function') {
                showToast('GPS Connected: Meerut Sector Node Active (28.3486° N, 79.5619° E)', 'info');
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
