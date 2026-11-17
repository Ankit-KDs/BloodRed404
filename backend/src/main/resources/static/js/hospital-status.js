/* ============================================================
   RED404 — HOSPITAL STATUS CONTROLLER
   Handles live state transitions, document replacements, push
   notifications, application updates, and auto-redirect upon verification.
   ============================================================ */

'use strict';

let currentStatusData = null;
let statusPollInterval = null;
let targetReplaceDocType = null;

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  initStatusActions();
  startLivePolling();
});

function getAuthHeaders() {
  const headers = { 'Accept': 'application/json' };
  const token = sessionStorage.getItem('red404_hospitalToken') ||
                sessionStorage.getItem('hospitalToken') ||
                localStorage.getItem('red404_hospitalToken');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function loadStatus() {
  try {
    const res = await fetch('/api/hospitals/status', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    if (res.status === 401) {
      window.location.href = 'hospital-login.html';
      return;
    }

    if (!res.ok) {
      console.warn('Status response error:', res.status);
      return;
    }

    const json = await res.json();
    if (json.success && json.data) {
      currentStatusData = json.data;
      renderStatus(json.data);
    }
  } catch (err) {
    console.debug('Failed to fetch hospital application status:', err);
  }
}

function startLivePolling() {
  if (statusPollInterval) clearInterval(statusPollInterval);
  statusPollInterval = setInterval(loadStatus, 3000);
}

function renderStatus(data) {
  const status = (data.status || data.verificationStatus || 'pending_review').toLowerCase();
  const refNo = data.referenceNo || 'REF-HOSP-2026-PENDING';

  // Application reference
  const refEl = document.getElementById('applicationRefDisplay');
  if (refEl) refEl.textContent = `Application Reference: ${refNo}`;

  // Masked email
  const emailEl = document.getElementById('maskedEmailDisplay');
  if (emailEl) emailEl.textContent = data.maskedEmail || data.hospitalEmail || 'your registered email';

  // Summary Card fields
  setFieldText('valHospName', data.hospitalName);
  setFieldText('valHospType', data.hospitalType);
  setFieldText('valRegNo', data.registrationNo);
  setFieldText('valLicense', data.bloodBankLicense || 'None (Standard Facility)');
  setFieldText('valServices', data.services || 'Emergency Care');
  setFieldText('valAdminPerson', `${data.adminName || '-'} (${data.adminDesignation || 'Authorised Officer'})`);
  setFieldText('valPhone', data.adminPhone || data.hospitalPhone);
  setFieldText('valEmergency', data.emergencyContact || 'Not configured');
  setFieldText('valAddress', `${data.address || ''}, ${data.city || ''}, ${data.state || ''} ${data.pincode || ''}`.trim());
  setFieldText('summaryDateDisplay', data.createdAt ? `Submitted on ${data.createdAt}` : 'Recent submission');

  // Blood Bank License Document row visibility
  const docBbRow = document.getElementById('docRowBb');
  if (docBbRow) {
    const hasBbService = (data.services || '').toLowerCase().includes('blood bank');
    docBbRow.style.display = (hasBbService || data.bloodBankLicense) ? 'flex' : 'none';
  }

  // Stepper Elements
  const stepSubmitted = document.getElementById('stepSubmitted');
  const stepUnderReview = document.getElementById('stepUnderReview');
  const stepDecision = document.getElementById('stepDecision');

  const badgeDisplay = document.getElementById('statusBadgeDisplay');
  const badgeText = document.getElementById('statusBadgeText');
  const heroTitle = document.getElementById('statusHeroTitle');
  const heroDesc = document.getElementById('statusHeroDesc');
  const noticeBox = document.getElementById('actionNoticeBox');
  const noticeTitle = document.getElementById('actionNoticeTitle');
  const noticeBody = document.getElementById('actionNoticeBody');

  const btnResubmit = document.getElementById('btnResubmitApplication');
  const btnEdit = document.getElementById('btnEditApplication');
  const btnWithdraw = document.getElementById('btnWithdrawApplication');
  const btnNotify = document.getElementById('btnNotifyWhenApproved');

  // Reset classes
  if (badgeDisplay) badgeDisplay.className = `status-badge ${status}`;

  if (status === 'verified') {
    // Verified state
    if (stepSubmitted) stepSubmitted.className = 'timeline-step completed';
    if (stepUnderReview) stepUnderReview.className = 'timeline-step completed';
    if (stepDecision) {
      stepDecision.className = 'timeline-step completed';
      const circle = stepDecision.querySelector('.timeline-circle');
      if (circle) circle.innerHTML = '&#10003;';
    }

    if (badgeText) badgeText.textContent = 'Verified';
    if (heroTitle) heroTitle.textContent = 'Your Hospital Account is Verified';
    if (heroDesc) heroDesc.textContent = 'Your credentials and clinical registration have been verified. You now have full access to RED404 emergency dispatch and blood inventory management.';

    // Show top redirect banner
    const liveBanner = document.getElementById('verifiedLiveBanner');
    if (liveBanner && liveBanner.style.display !== 'block') {
      liveBanner.style.display = 'block';
      let countdown = 3;
      const countEl = document.getElementById('redirectCountdown');
      const timer = setInterval(() => {
        countdown--;
        if (countEl) countEl.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(timer);
          clearInterval(statusPollInterval);
          window.location.href = 'hospital-dashboard.html';
        }
      }, 1000);
    }
    return;
  }

  if (status === 'needs_info') {
    if (stepSubmitted) stepSubmitted.className = 'timeline-step completed';
    if (stepUnderReview) stepUnderReview.className = 'timeline-step active';
    if (stepDecision) stepDecision.className = 'timeline-step';

    if (badgeText) badgeText.textContent = 'Action Required';
    if (heroTitle) heroTitle.textContent = 'Additional Information Required';
    if (heroDesc) heroDesc.textContent = 'The administrative review team has requested additional information or document clarifications before your hospital can be approved.';

    if (noticeBox) {
      noticeBox.style.display = 'block';
      noticeBox.className = 'action-notice-box warning';
      if (noticeTitle) noticeTitle.textContent = 'Administrator Note / Action Required:';
      if (noticeBody) noticeBody.textContent = data.adminReason || 'Please review and update your documents or contact credentials, then click "Resubmit Application".';
    }

    if (btnResubmit) btnResubmit.style.display = 'inline-flex';
    if (btnEdit) btnEdit.style.display = 'inline-flex';
    if (btnWithdraw) btnWithdraw.style.display = 'inline-flex';
    if (btnNotify) btnNotify.style.display = 'none';

  } else if (status === 'rejected') {
    if (stepSubmitted) stepSubmitted.className = 'timeline-step completed';
    if (stepUnderReview) stepUnderReview.className = 'timeline-step completed';
    if (stepDecision) {
      stepDecision.className = 'timeline-step rejected';
      const circle = stepDecision.querySelector('.timeline-circle');
      if (circle) circle.innerHTML = '&times;';
    }

    if (badgeText) badgeText.textContent = 'Application Rejected';
    if (heroTitle) heroTitle.textContent = 'Application Review Decision: Rejected';
    if (heroDesc) heroDesc.textContent = 'Your facility application was not approved with the provided credentials. You may edit your details, replace documents, and resubmit for reconsideration.';

    if (noticeBox) {
      noticeBox.style.display = 'block';
      noticeBox.className = 'action-notice-box danger';
      if (noticeTitle) noticeTitle.textContent = 'Reason for Rejection:';
      if (noticeBody) noticeBody.textContent = data.adminReason || 'Registration credentials or facility documentation could not be verified.';
    }

    if (btnResubmit) {
      btnResubmit.style.display = 'inline-flex';
      btnResubmit.querySelector('span').textContent = 'Edit and resubmit';
    }
    if (btnEdit) btnEdit.style.display = 'inline-flex';
    if (btnWithdraw) btnWithdraw.style.display = 'inline-flex';
    if (btnNotify) btnNotify.style.display = 'none';

  } else if (status === 'suspended') {
    if (stepSubmitted) stepSubmitted.className = 'timeline-step completed';
    if (stepUnderReview) stepUnderReview.className = 'timeline-step completed';
    if (stepDecision) {
      stepDecision.className = 'timeline-step rejected';
      const circle = stepDecision.querySelector('.timeline-circle');
      if (circle) circle.innerHTML = '!';
    }

    if (badgeText) badgeText.textContent = 'Suspended';
    if (heroTitle) heroTitle.textContent = 'Hospital Account Suspended';
    if (heroDesc) heroDesc.textContent = 'Access to emergency broadcast and donor dispatch functions for this facility has been temporarily suspended by system administrators.';

    if (noticeBox) {
      noticeBox.style.display = 'block';
      noticeBox.className = 'action-notice-box danger';
      if (noticeTitle) noticeTitle.textContent = 'Suspension Details:';
      if (noticeBody) noticeBody.textContent = data.adminReason || 'Please contact RED404 Hospital Support to resolve this matter.';
    }

    if (btnResubmit) btnResubmit.style.display = 'none';
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnWithdraw) btnWithdraw.style.display = 'none';
    if (btnNotify) btnNotify.style.display = 'none';

  } else {
    // Default: pending_review
    if (stepSubmitted) stepSubmitted.className = 'timeline-step completed';
    if (stepUnderReview) stepUnderReview.className = 'timeline-step active';
    if (stepDecision) stepDecision.className = 'timeline-step';

    if (badgeText) badgeText.textContent = 'Under review';
    if (heroTitle) heroTitle.textContent = 'Your application is being reviewed.';
    if (heroDesc) heroDesc.textContent = `Our administrative verification team reviews medical credentials, blood bank licenses, and facility registrations. We will email you at ${data.maskedEmail || 'your registered email'} when the review is finished. Check your spam folder too.`;

    if (noticeBox) noticeBox.style.display = 'none';
    if (btnResubmit) btnResubmit.style.display = 'none';
    if (btnEdit) btnEdit.style.display = 'inline-flex';
    if (btnWithdraw) btnWithdraw.style.display = 'inline-flex';
    if (btnNotify) btnNotify.style.display = 'inline-flex';
  }
}

function setFieldText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value !== null && value !== undefined && String(value).trim() !== '') ? String(value) : '-';
}

function initStatusActions() {
  // Logout
  const btnLogout = document.getElementById('btnLogoutSession');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/hospitals/logout', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      sessionStorage.clear();
      window.location.href = 'hospital-login.html';
    });
  }

  // Notify Me When Approved (Web Push)
  const btnNotify = document.getElementById('btnNotifyWhenApproved');
  if (btnNotify) {
    btnNotify.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        alert('Web push notifications are not supported in this browser.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Subscribe to backend
          const subRes = await fetch('/api/hospitals/notifications/subscribe', {
            method: 'POST',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              endpoint: 'web-push-' + (currentStatusData ? currentStatusData.id : 'client'),
              keys: { p256dh: 'sample_p256dh', auth: 'sample_auth' }
            }),
            credentials: 'include'
          });

          if (subRes.ok) {
            btnNotify.innerHTML = '&#10003; Notifications Enabled';
            btnNotify.disabled = true;
            btnNotify.style.background = '#16a34a';
          }
        } else {
          alert('Notification permission was declined in browser settings.');
        }
      } catch (e) {
        console.warn('Push registration error:', e);
      }
    });
  }

  // Edit details button
  const btnEdit = document.getElementById('btnEditApplication');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      if (!currentStatusData) return;
      document.getElementById('editHospName').value = currentStatusData.hospitalName || '';
      document.getElementById('editPhone').value = currentStatusData.adminPhone || currentStatusData.hospitalPhone || '';
      document.getElementById('editEmergency').value = currentStatusData.emergencyContact || '';
      document.getElementById('editAddress').value = currentStatusData.address || '';
      document.getElementById('editOperatingHours').value = currentStatusData.operatingHours || '24x7';
      document.getElementById('editModal').style.display = 'flex';
    });
  }

  // Withdraw button
  const btnWithdraw = document.getElementById('btnWithdrawApplication');
  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', async () => {
      const confirmed = confirm('Are you sure you want to withdraw this application? This action cannot be undone.');
      if (!confirmed) return;

      try {
        const res = await fetch('/api/hospitals/application/withdraw', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include'
        });
        if (res.ok) {
          alert('Application withdrawn successfully.');
          sessionStorage.clear();
          window.location.href = 'hospital-register.html';
        } else {
          alert('Failed to withdraw application. Please try again.');
        }
      } catch (err) {
        alert('Network error while withdrawing application.');
      }
    });
  }

  // Resubmit button
  const btnResubmit = document.getElementById('btnResubmitApplication');
  if (btnResubmit) {
    btnResubmit.addEventListener('click', async () => {
      btnResubmit.disabled = true;
      btnResubmit.textContent = 'Resubmitting...';
      try {
        const res = await fetch('/api/hospitals/application/resubmit', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ note: 'Hospital responded with updated information/documents.' }),
          credentials: 'include'
        });
        if (res.ok) {
          await loadStatus();
          alert('Application resubmitted successfully! Our team will review your updates.');
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.message || 'Failed to resubmit. Please try again.');
        }
      } catch (e) {
        alert('Error resubmitting application.');
      } finally {
        btnResubmit.disabled = false;
        btnResubmit.textContent = 'Resubmit application';
      }
    });
  }

  // Document Replace file input handler
  const fileInput = document.getElementById('hiddenFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !targetReplaceDocType) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('Document exceeds the 5 MB limit.');
        fileInput.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', targetReplaceDocType);

      try {
        const res = await fetch('/api/hospitals/upload-document', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
          credentials: 'include'
        });

        const json = await res.json();
        if (json.success && json.data) {
          alert('Document replaced successfully!');
          await loadStatus();
        } else {
          alert(json.error || 'Failed to upload document. Please ensure it is a valid PDF, JPG, or PNG.');
        }
      } catch (err) {
        alert('Upload failed. Please check network connection.');
      } finally {
        fileInput.value = '';
        targetReplaceDocType = null;
      }
    });
  }
}

window.triggerDocReplace = function (docType) {
  targetReplaceDocType = docType;
  const input = document.getElementById('hiddenFileInput');
  if (input) input.click();
};

window.closeEditModal = function () {
  const modal = document.getElementById('editModal');
  if (modal) modal.style.display = 'none';
};

window.handleEditSubmit = async function (e) {
  e.preventDefault();
  const payload = {
    hospitalName: document.getElementById('editHospName').value.trim(),
    adminPhone: document.getElementById('editPhone').value.trim(),
    emergencyContact: document.getElementById('editEmergency').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    operatingHours: document.getElementById('editOperatingHours').value
  };

  try {
    const res = await fetch('/api/hospitals/application', {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    if (res.ok) {
      closeEditModal();
      await loadStatus();
      alert('Application details updated successfully.');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Failed to update details.');
    }
  } catch (err) {
    alert('Network error while saving details.');
  }
};
