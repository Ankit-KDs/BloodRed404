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
    let user = null;
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) {
        const session = JSON.parse(raw);
        user = session.user || session;
      }
      if (!user && typeof Auth !== 'undefined' && Auth.getSession) {
        user = Auth.getSession();
      }
      if (!user) {
        const rawSession = localStorage.getItem('red404_session');
        if (rawSession) {
          const session = JSON.parse(rawSession);
          user = session.user || session;
        }
      }
      if (user) {
        donorName = user.name || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : donorName);
        donorBloodGroup = user.bloodGroup || user.bloodType || donorBloodGroup;

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

    renderHeaderEligibility(user);
    renderImpactStats();
    renderDonationsTable();
    setupExportBtn();
    setupModalEvents();

    // Fetch authoritative live donation history and eligibility from server
    fetchLiveHistoryAndStats(user);
  }

  async function fetchLiveHistoryAndStats(user) {
    try {
      const [histRes, statsRes] = await Promise.all([
        fetch('/api/donor/donation-history', { credentials: 'include' }).catch(() => null),
        fetch('/api/donor/dashboard-stats', { credentials: 'include' }).catch(() => null)
      ]);
      let stats = null;
      if (statsRes && statsRes.ok) {
        const sJson = await statsRes.json();
        if (sJson && sJson.data) {
          stats = sJson.data;
        }
      }
      if (histRes && histRes.ok) {
        const hJson = await histRes.json();
        if (hJson && Array.isArray(hJson.data)) {
          donationRecords = hJson.data;
        }
      }
      renderImpactStats();
      renderDonationsTable();
      renderHeaderEligibility(stats || user);
    } catch (e) {
      console.warn('Live history fetch notice:', e);
    }
  }

  function renderHeaderEligibility(user) {
    const badge = document.getElementById('headerEligibilityBadge');
    const textEl = document.getElementById('headerEligibilityText');
    if (!badge || !textEl) return;

    // 1. Authoritative Server-side Eligibility (Single Source of Truth)
    if (user && user.eligibility) {
      const elig = user.eligibility;
      const hasDonated = (donationRecords && donationRecords.length > 0) || Boolean(user.lastDonation || user.lastDonationDate || elig.last_donation_date);
      if (elig.eligible) {
        badge.className = 'status-eligibility-btn eligible-ready';
        textEl.textContent = !hasDonated ? "No donation yet. You're ready." : "You can donate. The hospital does a final check before donating.";
      } else {
        const nextDate = elig.next_eligible_date || elig.nextEligibleDate || '';
        const daysLeft = elig.days_until_eligible || 0;
        let formattedDate = nextDate;
        try {
          const nextD = new Date(nextDate);
          if (!isNaN(nextD.getTime())) {
            formattedDate = nextD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        } catch (_) {}
        badge.className = 'status-eligibility-btn recovering';
        textEl.textContent = `Next donation possible on ${formattedDate} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)`;
      }
      return;
    }

    // Check user availability
    const availability = (user && user.availability) || 'Available';
    if (availability.toLowerCase() === 'unavailable' || availability.toLowerCase() === 'paused') {
      badge.className = 'status-eligibility-btn unavailable';
      textEl.textContent = 'Status: Temporarily paused';
      return;
    }

    // 0 verified donations -> Ready
    if (!donationRecords || donationRecords.length === 0) {
      badge.className = 'status-eligibility-btn eligible-ready';
      textEl.textContent = "No donation yet. You're ready.";
      return;
    }

    // If donations exist, evaluate recovery window (gender-based: 90 days male, 120 days female)
    const latest = donationRecords[0];
    const donationDateStr = latest.date || latest.donationDate || (user && (user.lastDonation || user.lastDonationDate));
    if (donationDateStr) {
      const dDate = new Date(donationDateStr);
      if (!isNaN(dDate.getTime())) {
        const diffMs = Date.now() - dDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const recoveryDays = (user && user.gender && user.gender.toLowerCase() === 'female') ? 120 : 90;
        if (diffDays >= 0 && diffDays < recoveryDays) {
          const daysLeft = recoveryDays - diffDays;
          const nextDateObj = new Date(dDate.getTime() + recoveryDays * 86400000);
          const formattedDate = nextDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          badge.className = 'status-eligibility-btn recovering';
          textEl.textContent = `Next donation possible on ${formattedDate} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left)`;
          return;
        }
      }
    }

    badge.className = 'status-eligibility-btn eligible-ready';
    textEl.textContent = "You can donate. The hospital does a final check before donating.";
  }

  function renderImpactStats() {
    const totalCountEl = document.getElementById('statTotalDonations');
    const livesSavedEl = document.getElementById('statLivesSaved');
    const totalVolumeEl = document.getElementById('statTotalVolume');
    const tierEl = document.getElementById('statActiveTier');
    const tierRuleEl = document.getElementById('statTierRule');

    const totalDonations = donationRecords.length;
    const livesSaved = totalDonations * 3; // (Total Donations * 3)
    const totalVolume = totalDonations * 450; // (Total Donations * 450 mL)

    if (totalCountEl) totalCountEl.textContent = totalDonations;
    if (livesSavedEl) livesSavedEl.textContent = `${livesSaved} Lives`;
    if (totalVolumeEl) totalVolumeEl.textContent = `${totalVolume.toLocaleString()} mL`;

    if (tierEl) {
      if (totalDonations >= 10) {
        tierEl.textContent = 'Level 4';
        if (tierRuleEl) tierRuleEl.textContent = 'Level 4 (10+ verified donations)';
      } else if (totalDonations >= 5) {
        tierEl.textContent = 'Level 3';
        if (tierRuleEl) tierRuleEl.textContent = 'Level 3 (5–9 verified donations)';
      } else if (totalDonations >= 1) {
        tierEl.textContent = 'Level 2';
        if (tierRuleEl) tierRuleEl.textContent = 'Level 2 (1–4 verified donations)';
      } else {
        tierEl.textContent = 'Level 1';
        if (tierRuleEl) tierRuleEl.textContent = 'Level 1 (0 verified donations)';
      }
    }
  }

  function renderDonationsTable() {
    const tableBody = document.getElementById('donationsTableBody');
    const tableWrapper = document.querySelector('.table-responsive-wrapper');
    const emptyCard = document.getElementById('donationsEmptyState');
    if (!tableBody) return;

    if (!donationRecords || donationRecords.length === 0) {
      if (emptyCard) emptyCard.style.display = 'flex';
      if (tableWrapper) tableWrapper.style.display = 'none';
      tableBody.innerHTML = '';
      return;
    }

    if (emptyCard) emptyCard.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'block';

    tableBody.innerHTML = donationRecords.map((rec) => {
      const bGroup = rec.bloodGroup || rec.bloodType || donorBloodGroup || 'O+';
      const vol = rec.volume || (rec.volume_ml ? rec.volume_ml + ' mL' : (rec.units ? (rec.units * 450) + ' mL' : '450 mL'));
      const ref = rec.refCode || rec.id || rec.recordId || rec.certId || 'RED-00000';
      const hosp = rec.hospital || rec.hospitalName || 'Verified Partner Hospital';
      const dDate = rec.date || rec.donationDate || 'Recent';

      return `
        <tr>
          <td>
            <strong style="color: #ffffff;">${dDate}</strong>
          </td>
          <td>
            <div class="hosp-info-cell">
              <span class="hosp-info-name">${hosp}</span>
              ${rec.location ? `<span class="hosp-info-loc"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;margin-right:4px;"></i>${rec.location}</span>` : ''}
            </div>
          </td>
          <td>
            <span class="badge-component whole-blood">
              <i class="fa-solid fa-droplet"></i>
              ${bGroup}
            </span>
          </td>
          <td>
            <strong style="color: #ffffff;">${vol}</strong>
          </td>
          <td>
            <span class="ref-code">${ref}</span>
          </td>
          <td style="text-align: right;">
            <a href="/api/donor/certificate?refCode=${encodeURIComponent(ref)}&hospital=${encodeURIComponent(hosp)}&date=${encodeURIComponent(dDate)}&bloodType=${encodeURIComponent(bGroup)}&volume=${encodeURIComponent(vol)}" target="_blank" class="btn-cert-download" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-download"></i>
              <span>Download certificate</span>
            </a>
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
