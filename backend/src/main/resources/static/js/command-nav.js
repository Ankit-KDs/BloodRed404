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
      if (!session && typeof Auth !== 'undefined' && Auth.getSession) {
        const u = Auth.getSession();
        if (u) session = { user: u };
      }
      if (!session) {
        const rawSession = localStorage.getItem('red404_session');
        if (rawSession) session = JSON.parse(rawSession);
      }
    } catch (e) {
      console.warn('Session parse notice:', e);
    }

    const currentUser = session ? (session.user || session) : null;
    const userName = (currentUser && (currentUser.name || (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : null))) || 'Verified Donor';
    const userEmail = (currentUser && currentUser.email) || '';

    // Compute initials (e.g., Ankit Kumar -> AK)
    const initials = userName
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'VD';

    if (avatarInitials) avatarInitials.textContent = initials;
    if (dropdownName) dropdownName.textContent = userName;
    if (dropdownUserEmailSpan) {
      dropdownUserEmailSpan.textContent = userEmail;
    } else if (dropdownEmail) {
      dropdownEmail.textContent = `Signed in as ${userEmail}`;
    }

    function extractDDMM(dobStr) {
      if (!dobStr) return null;
      let s = String(dobStr).trim();
      if (!s || s.toLowerCase() === 'null') return null;
      if (s.includes(' ')) s = s.substring(0, s.indexOf(' '));
      if (s.includes('T')) s = s.substring(0, s.indexOf('T'));
      const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (ymd) return `${ymd[3].padStart(2, '0')}${ymd[2].padStart(2, '0')}`;
      const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (dmy) return `${dmy[1].padStart(2, '0')}${dmy[2].padStart(2, '0')}`;
      return null;
    }

    function syncIdDob(id, dobStr) {
      const ddmm = extractDDMM(dobStr);
      if (!id || !id.startsWith('DNR-') || !ddmm) return id;
      const p = id.split('-');
      if (p.length >= 3) {
        return `DNR-${ddmm}-${p.slice(2).join('-')}`;
      }
      return id;
    }

    let donorId = (currentUser && (currentUser.donorId || currentUser.donor_id || (typeof currentUser.id === 'string' && currentUser.id.startsWith('DNR-') ? currentUser.id : null)));
    if (!donorId && currentUser) {
      try {
        const list = JSON.parse(localStorage.getItem('red404_registered_donors') || '[]');
        const m = list.find(d => (d.email && d.email === currentUser.email) || (d.id && d.id == currentUser.id));
        if (m && (m.donorId || m.donor_id)) {
          donorId = m.donorId || m.donor_id;
        }
      } catch (_) { }
    }
    if (!donorId) {
      const num = currentUser ? (100 + ((parseInt(currentUser.id || 1, 10) * 137 + 241) % 900)) : 719;
      const initial = (userName && userName.trim().length > 0) ? userName.trim()[0].toUpperCase() : 'A';
      donorId = `DNR-1011-${initial}${num}`;
    }
    if (currentUser && (currentUser.dob || currentUser.dateOfBirth)) {
      donorId = syncIdDob(donorId, currentUser.dob || currentUser.dateOfBirth);
    }
    const dropdownDonorId = document.getElementById('dropdownDonorIdText');
    if (dropdownDonorId) {
      dropdownDonorId.textContent = donorId;
    }

    // 2. Avatar dropdown toggle
    if (avatarTrigger && dropdown) {
      avatarTrigger.addEventListener('click', (e) => {
        // If user clicked inside the dropdown itself, don't re-toggle
        if (dropdown.contains(e.target)) {
          return;
        }
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

      // Close dropdown if clicking on a navigation link inside dropdown
      dropdown.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
          dropdown.classList.remove('show');
          avatarTrigger.setAttribute('aria-expanded', 'false');
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

    // 3. Logout Confirmation Modal
    function showLogoutModal() {
      let modal = document.getElementById('logoutConfirmModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'logoutConfirmModal';
        modal.className = 'logout-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'logoutModalTitle');
        modal.innerHTML = `
          <div class="logout-modal-card">
            <div class="lmc-glow-ring">
              <i class="fa-solid fa-power-off"></i>
            </div>
            <h3 class="lmc-title" id="logoutModalTitle">Confirm Session Termination</h3>
            <p class="lmc-message">Are you sure you want to log out of your RED404 donor node?</p>
            <div class="lmc-actions">
              <button type="button" class="lmc-btn lmc-btn-cancel" id="cancelLogoutBtn">Cancel</button>
              <button type="button" class="lmc-btn lmc-btn-confirm" id="confirmLogoutBtn">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
                <span>Confirm Logout</span>
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        const cancelBtn = modal.querySelector('#cancelLogoutBtn');
        const confirmBtn = modal.querySelector('#confirmLogoutBtn');

        const closeModal = () => {
          modal.classList.remove('active');
        };

        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
          }
        });

        confirmBtn.addEventListener('click', () => {
          try {
            if (typeof Auth !== 'undefined' && Auth.clearSession) {
              Auth.clearSession();
            }
            localStorage.removeItem('red404_donor_session');
            sessionStorage.removeItem('red404_donor_session');
            localStorage.removeItem('red404_session');
            localStorage.removeItem('donorUser');
            localStorage.removeItem('red404_donorToken');
          } catch (err) { }
          window.location.href = 'donor-login.html';
        });
      }

      // Close dropdown menu
      if (dropdown) dropdown.classList.remove('show');
      if (avatarTrigger) avatarTrigger.setAttribute('aria-expanded', 'false');

      // Animate modal entry
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // 4. Settings & Privacy Modal Controller
    function getFreshUser() {
      try {
        const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('red404_auth_session') || sessionStorage.getItem('red404_auth_session') || localStorage.getItem('donorUser') || localStorage.getItem('red404_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.user || parsed.id || parsed.email || parsed.donorId || parsed.donor_id)) {
            const u = parsed.user || parsed;
            if (u && (u.id || u.email || u.donorId)) return u;
          }
        }
        if (typeof Auth !== 'undefined' && Auth.getSession) {
          const u = Auth.getSession();
          if (u) return u;
        }
        if (typeof window !== 'undefined' && window.currentDonor) {
          return window.currentDonor;
        }
        const rawSession = localStorage.getItem('red404_session');
        if (rawSession) {
          const s = JSON.parse(rawSession);
          if (s) return s.user || s;
        }
        const emailEl = document.getElementById('userEmail') || document.querySelector('.dropdown-email') || document.querySelector('.nav-user-email');
        if (emailEl && emailEl.textContent && emailEl.textContent.includes('@')) {
          const text = emailEl.textContent.trim().replace(/^Signed in as\s*/i, '');
          return { email: text };
        }
      } catch (_) { }
      return currentUser;
    }

    function getSettingsHeaders() {
      const activeUser = getFreshUser();
      const donorId = (activeUser && (activeUser.donorId || activeUser.donor_id || activeUser.id)) || '';
      const donorEmail = (activeUser && activeUser.email) || '';
      let token = '';
      try {
        if (typeof Store !== 'undefined' && Store.get) {
          token = Store.get('donorToken') || '';
        }
        if (!token) {
          token = localStorage.getItem('red404_donorToken') || sessionStorage.getItem('red404_donorToken') || '';
        }
      } catch (_) { }
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (donorId) headers['X-Donor-Id'] = String(donorId);
      if (donorEmail) headers['X-Donor-Email'] = donorEmail;
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }

    function clearPasswordInputs(modal) {
      if (!modal) return;
      const pwForm = modal.querySelector('#changePasswordForm');
      if (pwForm) pwForm.reset();
      const currentInput = modal.querySelector('#currentPasswordInput');
      const newInput = modal.querySelector('#newPasswordInput');
      const confirmInput = modal.querySelector('#confirmPasswordInput');
      if (currentInput) currentInput.value = '';
      if (newInput) newInput.value = '';
      if (confirmInput) confirmInput.value = '';
      const alertBox = modal.querySelector('#passwordAlertBox');
      if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.textContent = '';
        alertBox.className = 'smc-alert-box';
      }
    }

    function showSettingsPrivacyModal(defaultTab = 'securityTab') {
      let modal = document.getElementById('settingsPrivacyModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'settingsPrivacyModal';
        modal.className = 'settings-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="settings-modal-card">
            <div class="smc-header">
              <div class="smc-header-left">
                <div class="smc-icon-badge">
                  <i class="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <h3 class="smc-title">Privacy &amp; Security</h3>
                  <p class="smc-subtitle">Account security, active sessions, and data privacy controls</p>
                </div>
              </div>
              <button type="button" class="smc-close-btn" id="closeSettingsModalBtn" aria-label="Close settings">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="smc-tabs-nav">
              <button type="button" class="smc-tab-btn active" data-tab="securityTab">
                <i class="fa-solid fa-key"></i>
                <span>Account Security</span>
              </button>
              <button type="button" class="smc-tab-btn" data-tab="sessionsTab">
                <i class="fa-solid fa-laptop-medical"></i>
                <span>Active Sessions</span>
                <span class="smc-count-pill" id="activeSessionsCount">--</span>
              </button>
              <button type="button" class="smc-tab-btn smc-tab-danger" data-tab="dangerTab">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Danger Zone</span>
              </button>
            </div>

            <div class="smc-body">
              <!-- TAB 1: ACCOUNT SECURITY -->
              <div class="smc-tab-pane active" id="securityTab">
                <div class="smc-section-intro">
                  <h4>Change Account Password</h4>
                  <p>Choose a secure password with at least 6 characters. Old password credentials will be instantly invalidated across all devices.</p>
                </div>

                <form id="changePasswordForm" class="smc-form" autocomplete="off">
                  <div class="smc-form-group">
                    <label for="currentPasswordInput">Current Password</label>
                    <div class="smc-input-wrap">
                      <i class="fa-solid fa-lock input-icon"></i>
                      <input type="password" id="currentPasswordInput" required placeholder="Enter current password" autocomplete="new-password" />
                      <button type="button" class="toggle-pw-btn" data-target="currentPasswordInput" aria-label="Toggle password visibility">
                        <i class="fa-regular fa-eye"></i>
                      </button>
                    </div>
                  </div>

                  <div class="smc-form-group">
                    <label for="newPasswordInput">New Password</label>
                    <div class="smc-input-wrap">
                      <i class="fa-solid fa-key input-icon"></i>
                      <input type="password" id="newPasswordInput" required minlength="6" placeholder="Enter new password (min. 6 chars)" autocomplete="new-password" />
                      <button type="button" class="toggle-pw-btn" data-target="newPasswordInput" aria-label="Toggle password visibility">
                        <i class="fa-regular fa-eye"></i>
                      </button>
                    </div>
                  </div>

                  <div class="smc-form-group">
                    <label for="confirmPasswordInput">Confirm New Password</label>
                    <div class="smc-input-wrap">
                      <i class="fa-solid fa-shield-check input-icon"></i>
                      <input type="password" id="confirmPasswordInput" required minlength="6" placeholder="Repeat new password" autocomplete="new-password" />
                      <button type="button" class="toggle-pw-btn" data-target="confirmPasswordInput" aria-label="Toggle password visibility">
                        <i class="fa-regular fa-eye"></i>
                      </button>
                    </div>
                  </div>

                  <div id="passwordAlertBox" class="smc-alert-box" style="display: none;"></div>

                  <div class="smc-form-actions">
                    <button type="submit" class="smc-btn smc-btn-primary" id="btnUpdatePassword">
                      <i class="fa-solid fa-circle-check"></i>
                      <span>Update Password</span>
                    </button>
                  </div>
                </form>
              </div>

              <!-- TAB 2: ACTIVE SESSIONS -->
              <div class="smc-tab-pane" id="sessionsTab">
                <div class="smc-section-intro">
                  <h4>Active Login Sessions</h4>
                  <p>Real-time list of verified devices authenticated to your account. You can terminate individual sessions or revoke all other nodes remotely.</p>
                </div>

                <div id="sessionsLoadingIndicator" class="smc-loading-state">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                  <span>Querying active sessions from database...</span>
                </div>

                <div id="sessionsListContainer" class="smc-sessions-list" style="display: none;"></div>

                <div class="smc-sessions-footer">
                  <button type="button" id="btnKillAllOtherSessions" class="smc-btn smc-btn-secondary" disabled style="opacity: 0.45; cursor: not-allowed; pointer-events: none;" title="No other active device sessions found.">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                    <span>Log out of all other devices</span>
                  </button>
                </div>
              </div>

              <!-- TAB 3: DANGER ZONE -->
              <div class="smc-tab-pane" id="dangerTab">
                <div class="smc-danger-box">
                  <div class="smc-danger-head">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <h4>Permanent Account Deletion</h4>
                  </div>
                  <p class="smc-danger-desc">
                    This action is <strong>irreversible</strong>. Executing this will permanently wipe your donor registration, clinical intake forms, donation ledger history, and active SOS routing credentials from the RED404 database.
                  </p>
                  <div class="smc-danger-list">
                    <div><i class="fa-solid fa-xmark"></i> Permanent deletion of profile and clinical intake snapshots</div>
                    <div><i class="fa-solid fa-xmark"></i> Irrevocable purge of blood donation logs and telemetry tokens</div>
                    <div><i class="fa-solid fa-xmark"></i> Immediate session termination across all active devices</div>
                  </div>
                  <button type="button" id="btnTriggerDeleteAccount" class="smc-btn smc-btn-danger">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Permanently Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        bindSettingsModalEvents(modal);
      }

      // Always blank password inputs and clear alerts on open
      clearPasswordInputs(modal);

      // Tab selection
      const targetBtn = modal.querySelector(`.smc-tab-btn[data-tab="${defaultTab}"]`) || modal.querySelector('.smc-tab-btn');
      if (targetBtn) targetBtn.click();

      // Close dropdown menu if open
      if (dropdown) dropdown.classList.remove('show');
      if (avatarTrigger) avatarTrigger.setAttribute('aria-expanded', 'false');

      // Animate entry
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });

      // Always reload active sessions
      loadActiveSessions(modal);
    }

    function bindSettingsModalEvents(modal) {
      // 1. Tab switching
      modal.querySelectorAll('.smc-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tabId = btn.getAttribute('data-tab');
          modal.querySelectorAll('.smc-tab-btn').forEach(b => b.classList.remove('active'));
          modal.querySelectorAll('.smc-tab-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const pane = modal.querySelector('#' + tabId);
          if (pane) pane.classList.add('active');
          clearPasswordInputs(modal);
          if (tabId === 'sessionsTab') {
            loadActiveSessions(modal);
          }
        });
      });

      // 2. Password toggle eye buttons
      modal.querySelectorAll('.toggle-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          const input = modal.querySelector('#' + targetId);
          if (!input) return;
          const isPw = input.type === 'password';
          input.type = isPw ? 'text' : 'password';
          btn.innerHTML = isPw ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
        });
      });

      // 3. Close handlers (always blank password fields on close)
      const closeModal = () => {
        clearPasswordInputs(modal);
        modal.classList.remove('active');
      };
      const closeBtn = modal.querySelector('#closeSettingsModalBtn');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });

      // 4. Change Password submit
      const pwForm = modal.querySelector('#changePasswordForm');
      const alertBox = modal.querySelector('#passwordAlertBox');
      const btnUpdate = modal.querySelector('#btnUpdatePassword');

      if (pwForm) {
        pwForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (alertBox) {
            alertBox.style.display = 'none';
            alertBox.textContent = '';
          }

          const currentPassword = (modal.querySelector('#currentPasswordInput').value || '').trim();
          const newPassword = (modal.querySelector('#newPasswordInput').value || '').trim();
          const confirmPassword = (modal.querySelector('#confirmPasswordInput').value || '').trim();

          if (!currentPassword) {
            alertBox.className = 'smc-alert-box error';
            alertBox.textContent = 'Please enter your current password.';
            alertBox.style.display = 'block';
            return;
          }

          if (newPassword.length < 6) {
            alertBox.className = 'smc-alert-box error';
            alertBox.textContent = 'New password must be at least 6 characters.';
            alertBox.style.display = 'block';
            return;
          }

          if (newPassword !== confirmPassword) {
            alertBox.className = 'smc-alert-box error';
            alertBox.textContent = 'New passwords do not match. Please verify.';
            alertBox.style.display = 'block';
            return;
          }

          btnUpdate.disabled = true;
          btnUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

          try {
            const activeUser = getFreshUser();
            const payload = {
              donorId: (activeUser && (activeUser.donorId || activeUser.donor_id || activeUser.id)) || '',
              email: (activeUser && activeUser.email) || '',
              currentPassword,
              newPassword,
              confirmPassword
            };
            const res = await fetch('/api/settings/change-password', {
              method: 'POST',
              headers: getSettingsHeaders(),
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json && json.success) {
              alertBox.className = 'smc-alert-box success';
              alertBox.textContent = json.message || 'Password successfully updated with BCrypt hashing!';
              alertBox.style.display = 'block';
              clearPasswordInputs(modal);
              alertBox.style.display = 'block'; // Keep success message visible
              alertBox.textContent = json.message || 'Password successfully updated!';
              if (typeof showToast === 'function') {
                showToast('Password updated successfully!', 'success');
              }
            } else {
              alertBox.className = 'smc-alert-box error';
              alertBox.textContent = (json && json.message) || 'Current password does not match our records.';
              alertBox.style.display = 'block';
            }
          } catch (err) {
            alertBox.className = 'smc-alert-box error';
            alertBox.textContent = 'Network error while updating password.';
            alertBox.style.display = 'block';
          } finally {
            btnUpdate.disabled = false;
            btnUpdate.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Update Password</span>';
          }
        });
      }

      // 5. Kill all other sessions button
      const btnKillOthers = modal.querySelector('#btnKillAllOtherSessions');
      if (btnKillOthers) {
        btnKillOthers.addEventListener('click', async () => {
          if (btnKillOthers.disabled) return;
          if (!confirm('Log out of all other devices? This will invalidate all active sessions except this current window.')) {
            return;
          }
          btnKillOthers.disabled = true;
          btnKillOthers.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Revoking other sessions...';
          try {
            const res = await fetch('/api/settings/sessions/kill-others', {
              method: 'POST',
              headers: getSettingsHeaders(),
              credentials: 'include',
              body: JSON.stringify({
                donorId: (currentUser && currentUser.id) || '',
                email: (currentUser && currentUser.email) || ''
              })
            });
            const json = await res.json();
            if (json && json.success) {
              if (typeof showToast === 'function') {
                showToast('All other sessions terminated successfully.', 'success');
              }
              loadActiveSessions(modal);
            } else {
              alert((json && json.message) || 'Failed to terminate other sessions.');
            }
          } catch (err) {
            alert('Network error while revoking sessions.');
          } finally {
            btnKillOthers.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Log out of all other devices</span>';
          }
        });
      }

      // 6. Danger Zone: Permanently Delete Account
      const btnDelete = modal.querySelector('#btnTriggerDeleteAccount');
      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          const userConfirmation = prompt(
            "CRITICAL WARNING:\n\nThis will PERMANENTLY and IRREVERSIBLY delete your RED404 account, clinical records, and donation history.\n\nType DELETE in capital letters to proceed:"
          );

          if (userConfirmation !== 'DELETE') {
            if (userConfirmation !== null) {
              alert("Account deletion canceled. Confirmation keyword did not match 'DELETE'.");
            }
            return;
          }

          btnDelete.disabled = true;
          btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting account permanently...';

          try {
            const activeUser = getFreshUser();
            const payload = {
              donorId: (activeUser && (activeUser.donorId || activeUser.donor_id || activeUser.id)) || '',
              email: (activeUser && activeUser.email) || '',
              phone: (activeUser && activeUser.phone) || ''
            };
            const res = await fetch('/api/settings/delete-account', {
              method: 'POST',
              headers: getSettingsHeaders(),
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json && json.success) {
              try {
                localStorage.clear();
                sessionStorage.clear();
              } catch (_) { }
              alert('Your RED404 account and all associated records have been permanently deleted.');
              window.location.href = 'index.html';
            } else {
              alert((json && json.message) || 'Account deletion failed. Please try again.');
              btnDelete.disabled = false;
              btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Permanently Delete Account</span>';
            }
          } catch (err) {
            alert('Network error during account deletion.');
            btnDelete.disabled = false;
            btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Permanently Delete Account</span>';
          }
        });
      }
    }

    async function loadActiveSessions(modal) {
      const loader = modal.querySelector('#sessionsLoadingIndicator');
      const container = modal.querySelector('#sessionsListContainer');
      const countPill = modal.querySelector('#activeSessionsCount');
      const btnKillOthers = modal.querySelector('#btnKillAllOtherSessions');
      if (!container) return;

      if (btnKillOthers) {
        btnKillOthers.disabled = true;
        btnKillOthers.style.opacity = '0.45';
        btnKillOthers.style.cursor = 'not-allowed';
        btnKillOthers.style.pointerEvents = 'none';
      }

      if (loader) loader.style.display = 'flex';
      container.style.display = 'none';

      try {
        const res = await fetch('/api/settings/sessions', {
          method: 'GET',
          headers: getSettingsHeaders(),
          credentials: 'include'
        });
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
          renderSessionsList(modal, json.data);
          if (countPill) countPill.textContent = json.data.length;
        } else {
          container.innerHTML = '<div style="color: #94a3b8; padding: 24px; text-align: center;">No active session records found.</div>';
          container.style.display = 'block';
          if (countPill) countPill.textContent = '0';
          if (btnKillOthers) {
            btnKillOthers.disabled = true;
            btnKillOthers.style.opacity = '0.45';
            btnKillOthers.style.cursor = 'not-allowed';
            btnKillOthers.style.pointerEvents = 'none';
            btnKillOthers.title = 'No other active device sessions found.';
          }
        }
      } catch (err) {
        container.innerHTML = '<div style="color: #f87171; padding: 24px; text-align: center;">Failed to load active sessions.</div>';
        container.style.display = 'block';
        if (btnKillOthers) {
          btnKillOthers.disabled = true;
          btnKillOthers.style.opacity = '0.45';
          btnKillOthers.style.cursor = 'not-allowed';
          btnKillOthers.style.pointerEvents = 'none';
        }
      } finally {
        if (loader) loader.style.display = 'none';
      }
    }

    function renderSessionsList(modal, sessions) {
      const container = modal.querySelector('#sessionsListContainer');
      const btnKillOthers = modal.querySelector('#btnKillAllOtherSessions');
      if (!container) return;
      container.innerHTML = '';

      if (!sessions || sessions.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; padding: 20px; text-align: center;">No active sessions detected.</div>';
        container.style.display = 'block';
        if (btnKillOthers) {
          btnKillOthers.disabled = true;
          btnKillOthers.style.opacity = '0.45';
          btnKillOthers.style.cursor = 'not-allowed';
          btnKillOthers.style.pointerEvents = 'none';
          btnKillOthers.title = 'No other active device sessions found.';
        }
        return;
      }

      // Check if any other sessions exist (excluding current)
      const otherSessions = sessions.filter(s => !s.isCurrent);
      if (btnKillOthers) {
        if (otherSessions.length > 0) {
          btnKillOthers.disabled = false;
          btnKillOthers.style.opacity = '1';
          btnKillOthers.style.cursor = 'pointer';
          btnKillOthers.style.pointerEvents = 'auto';
          btnKillOthers.removeAttribute('title');
        } else {
          btnKillOthers.disabled = true;
          btnKillOthers.style.opacity = '0.45';
          btnKillOthers.style.cursor = 'not-allowed';
          btnKillOthers.style.pointerEvents = 'none';
          btnKillOthers.title = 'No other active device sessions found.';
        }
      }

      sessions.forEach(s => {
        const card = document.createElement('div');
        card.className = `smc-session-card ${s.isCurrent ? 'is-current' : ''}`;

        let iconClass = 'fa-laptop';
        const dev = (s.device || '').toLowerCase();
        if (dev.includes('phone') || dev.includes('iphone') || dev.includes('android')) {
          iconClass = 'fa-mobile-screen-button';
        } else if (dev.includes('ipad') || dev.includes('tablet')) {
          iconClass = 'fa-tablet-screen-button';
        }

        card.innerHTML = `
          <div class="smc-session-left">
            <div class="smc-session-icon">
              <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="smc-session-info">
              <div class="smc-session-title">${escapeHtml(s.device)} • ${escapeHtml(s.browser)}</div>
              <div class="smc-session-meta">
                <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.location)}</span>
                <span><i class="fa-solid fa-network-wired"></i> ${escapeHtml(s.ipAddress)}</span>
                <span><i class="fa-regular fa-clock"></i> Active since: ${escapeHtml(s.loginTimestamp)}</span>
              </div>
            </div>
          </div>
          <div class="smc-session-right">
            ${s.isCurrent
            ? '<span class="badge-current-session"><i class="fa-solid fa-circle-check"></i> Current Session</span>'
            : `<button type="button" class="btn-revoke-session" data-session-id="${escapeHtml(s.sessionId)}">
                  <i class="fa-solid fa-ban"></i>
                  <span>Logout</span>
                 </button>`
          }
          </div>
        `;
        container.appendChild(card);
      });

      container.style.display = 'flex';

      // Bind revoke button listeners
      container.querySelectorAll('.btn-revoke-session').forEach(btn => {
        btn.addEventListener('click', async () => {
          const sid = btn.getAttribute('data-session-id');
          if (!sid) return;
          const origText = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Revoking...';
          try {
            const res = await fetch('/api/settings/sessions/kill', {
              method: 'POST',
              headers: getSettingsHeaders(),
              credentials: 'include',
              body: JSON.stringify({
                sessionId: sid,
                donorId: (currentUser && currentUser.id) || '',
                email: (currentUser && currentUser.email) || ''
              })
            });
            const json = await res.json();
            if (json && json.success) {
              if (typeof showToast === 'function') {
                showToast('Device session terminated successfully.', 'success');
              }
              loadActiveSessions(modal);
            } else {
              alert((json && json.message) || 'Failed to revoke session');
              btn.disabled = false;
              btn.innerHTML = origText;
            }
          } catch (err) {
            alert('Network error while revoking session.');
            btn.disabled = false;
            btn.innerHTML = origText;
          }
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogoutModal();
      });
    }

    // 4. Privacy & Security Modal (Account Security, Active Sessions, Danger Zone)
    const openPrivacySecurity = (defaultTab = 'securityTab') => {
      showSettingsPrivacyModal(defaultTab);
    };

    if (privacyBtn) {
      privacyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openPrivacySecurity('securityTab');
      });
    }

    // Intercept any click on Privacy & Security inside dropdown
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const text = (item.textContent || '').trim().toLowerCase();
        if (text.includes('privacy & security')) {
          e.preventDefault();
          openPrivacySecurity('securityTab');
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
              } catch (_) { }
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
    // 7. Conditional Emergency Radar Blinking Dot
    updateEmergencyIndicator();
    // Async check from backend if not already determined in storage
    if (checkActiveEmergenciesCount() === 0) {
      fetch('/api/requests').then(res => res.ok ? res.json() : null).then(json => {
        if (json && json.success && Array.isArray(json.data)) {
          const active = json.data.filter(r => (r.status || 'Active').toLowerCase() === 'active');
          sessionStorage.setItem('red404_active_emergencies_count', String(active.length));
          updateEmergencyIndicator(active.length);
        }
      }).catch(() => { });
    }
  }

  function updateEmergencyIndicator(count) {
    const pulseDots = document.querySelectorAll('.tab-radar-pulse');
    const alertTabs = document.querySelectorAll('.alert-radar-tab');
    let hasAlerts = false;

    if (typeof count === 'number') {
      hasAlerts = count > 0;
    } else {
      hasAlerts = checkActiveEmergenciesCount() > 0;
    }

    pulseDots.forEach(dot => {
      if (hasAlerts) {
        dot.classList.add('active');
        dot.style.display = 'inline-block';
      } else {
        dot.classList.remove('active');
        dot.style.display = 'none';
      }
    });

    alertTabs.forEach(tab => {
      if (hasAlerts) {
        tab.classList.add('has-emergencies');
      } else {
        tab.classList.remove('has-emergencies');
      }
    });
  }

  function checkActiveEmergenciesCount() {
    try {
      if (window.RED404_STATE && window.RED404_STATE.donorData && Array.isArray(window.RED404_STATE.donorData.activeAlerts)) {
        return window.RED404_STATE.donorData.activeAlerts.length;
      }
      const rawCount = sessionStorage.getItem('red404_active_emergencies_count');
      if (rawCount !== null) return parseInt(rawCount, 10) || 0;

      const raw = sessionStorage.getItem('red404_active_emergencies') || localStorage.getItem('red404_active_emergencies');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (_) { }
    return 0; // Default: 0 active emergencies -> hidden
  }

  window.updateEmergencyIndicator = updateEmergencyIndicator;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandNav);
  } else {
    initCommandNav();
  }
})();

