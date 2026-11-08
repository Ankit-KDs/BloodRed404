/**
 * RED404 — Clinical Donation History & Verified Certificates Engine
 * Dynamic Zero-Demo-Data Architecture
 */

(function () {
  'use strict';

  let donorName = 'Ankit Kumar';
  let donorBloodGroup = 'A+';
  let donationRecords = [];

  function initMyDonations() {
    // 1. Session lookup
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) {
        const session = JSON.parse(raw);
        const user = session.user || session;
        donorName = user.name || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : donorName);
        donorBloodGroup = user.bloodGroup || donorBloodGroup;

        if (Array.isArray(user.donations)) {
          donationRecords = user.donations;
        }
      }
    } catch (e) {
      console.warn('Session parse notice:', e);
    }

    // Check if RED404_STATE has donations
    if (window.RED404_STATE && Array.isArray(window.RED404_STATE.donorData.donations)) {
      donationRecords = window.RED404_STATE.donorData.donations;
      donorName = window.RED404_STATE.donorData.name || donorName;
      donorBloodGroup = window.RED404_STATE.donorData.bloodGroup || donorBloodGroup;
    }

    renderImpactStats();
    renderDonationsTable();
    setupExportBtn();
    setupModalEvents();
  }

  function renderImpactStats() {
    const totalCountEl = document.getElementById('statTotalDonations');
    const livesSavedEl = document.getElementById('statLivesSaved');
    const totalVolumeEl = document.getElementById('statTotalVolume');
    const tierEl = document.getElementById('statActiveTier');

    const totalDonations = donationRecords.length;
    const livesSaved = totalDonations * 3; // (Total Donations * 3)
    const totalVolume = totalDonations * 450; // (Total Donations * 450 mL)

    if (totalCountEl) totalCountEl.textContent = totalDonations;
    if (livesSavedEl) livesSavedEl.textContent = `${livesSaved} Lives`;
    if (totalVolumeEl) totalVolumeEl.textContent = `${totalVolume.toLocaleString()} mL`;

    if (tierEl) {
      if (totalDonations >= 10) tierEl.textContent = 'Apex Guardian';
      else if (totalDonations >= 5) tierEl.textContent = 'Platinum Lifesaver';
      else if (totalDonations >= 1) tierEl.textContent = 'Bronze Guardian';
      else tierEl.textContent = 'Novice Rescuer';
    }
  }

  function renderDonationsTable() {
    const tableBody = document.getElementById('donationsTableBody');
    if (!tableBody) return;

    if (!donationRecords || donationRecords.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 16px; color: #94a3b8;">
            <i class="fa-solid fa-heart-circle-plus" style="font-size: 2rem; color: #64748b; margin-bottom: 10px; display: block;"></i>
            <strong style="color: #ffffff; display: block; margin-bottom: 4px;">No Verified Donations Yet</strong>
            <span>No verified donations yet. Awaiting your first rescue.</span>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = donationRecords.map((rec) => {
      const compClass = (rec.type || '').toLowerCase().includes('platelet') ? 'platelets' : 'whole-blood';
      const icon = (rec.type || '').toLowerCase().includes('platelet') ? 'fa-vial' : 'fa-droplet';

      return `
        <tr>
          <td>
            <span class="ref-code">${rec.refCode || 'RED-00000'}</span>
          </td>
          <td>
            <strong style="color: #ffffff;">${rec.date || 'N/A'}</strong>
          </td>
          <td>
            <div class="hosp-info-cell">
              <span class="hosp-info-name">${rec.hospital || 'Clinical Blood Depot'}</span>
              <span class="hosp-info-loc"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;margin-right:4px;"></i>${rec.location || 'Meerut'}</span>
            </div>
          </td>
          <td>
            <span class="badge-component ${compClass}">
              <i class="fa-solid ${icon}"></i>
              ${rec.type || 'Whole Blood'}
            </span>
          </td>
          <td>
            <strong style="color: #ffffff;">${rec.volume || '450 mL'}</strong>
            <div style="font-size: 0.74rem; color: #64748b;">(${rec.units || '1 Unit'})</div>
          </td>
          <td>
            <span class="badge-status-verified">
              <i class="fa-solid fa-circle-check"></i>
              VERIFIED
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn-cert-download" onclick="window.openCertificate('${rec.certId || 'CERT-00'}', '${rec.refCode || 'RED-00'}', '${rec.date || ''}', '${rec.hospital || ''}', '${rec.type || ''}')">
              <i class="fa-solid fa-award"></i>
              <span>Certificate</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Modal actions
  window.openCertificate = function (certId, refCode, date, hospital, type) {
    const modal = document.getElementById('certModalBackdrop');
    if (!modal) return;

    const modalName = document.getElementById('modalCertDonorName');
    const modalBlood = document.getElementById('modalCertBloodGroup');
    const modalRef = document.getElementById('modalCertRefCode');
    const modalDate = document.getElementById('modalCertDate');
    const modalHosp = document.getElementById('modalCertHospital');
    const modalType = document.getElementById('modalCertType');
    const modalId = document.getElementById('modalCertId');

    if (modalName) modalName.textContent = donorName;
    if (modalBlood) modalBlood.textContent = donorBloodGroup;
    if (modalRef) modalRef.textContent = refCode;
    if (modalDate) modalDate.textContent = date;
    if (modalHosp) modalHosp.textContent = hospital;
    if (modalType) modalType.textContent = type;
    if (modalId) modalId.textContent = certId;

    modal.classList.add('show');
  };

  function setupModalEvents() {
    const modal = document.getElementById('certModalBackdrop');
    const closeBtn = document.getElementById('certCloseBtn');
    const printBtn = document.getElementById('certPrintBtn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  function setupExportBtn() {
    const exportBtn = document.getElementById('exportCsvBtn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', () => {
      if (donationRecords.length === 0) {
        if (typeof showToast === 'function') {
          showToast('No donation records available to export.', 'info');
        } else {
          alert('No donation records available to export.');
        }
        return;
      }

      const headers = ['Reference Code', 'Date', 'Hospital', 'Type', 'Volume', 'Units', 'Status', 'Certificate ID'];
      const rows = donationRecords.map(r => [
        r.refCode || 'RED-00',
        `"${r.date || ''}"`,
        `"${r.hospital || ''}"`,
        `"${r.type || ''}"`,
        `"${r.volume || ''}"`,
        `"${r.units || ''}"`,
        'VERIFIED',
        r.certId || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `RED404_Donation_Records_${donorName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMyDonations);
  } else {
    initMyDonations();
  }
})();
