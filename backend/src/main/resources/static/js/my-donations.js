/**
 * RED404 — Clinical Donation History & Verified Certificates Engine
 */

(function () {
  'use strict';

  const DEFAULT_DONATION_RECORDS = [
    {
      refCode: 'RED-01042',
      date: '12 Aug 2026',
      hospital: 'Prem Hospital Blood Bank',
      location: 'Delhi Road, Meerut',
      type: 'Whole Blood',
      volume: '450 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2026-0812'
    },
    {
      refCode: 'RED-00985',
      date: '15 May 2026',
      hospital: 'KMC Hospital & Research Centre',
      location: 'Baghpat Bypass, Meerut',
      type: 'Platelets',
      volume: '350 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2026-0515'
    },
    {
      refCode: 'RED-00871',
      date: '04 Feb 2026',
      hospital: 'Subharti Blood Bank & Trauma Center',
      location: 'NH-58, Meerut',
      type: 'Whole Blood',
      volume: '450 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2026-0204'
    },
    {
      refCode: 'RED-00760',
      date: '10 Nov 2025',
      hospital: 'Anand Hospital Blood Depot',
      location: 'Garh Road, Meerut',
      type: 'Whole Blood',
      volume: '450 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2025-1110'
    },
    {
      refCode: 'RED-00624',
      date: '02 Aug 2025',
      hospital: 'District Hospital Blood Bank',
      location: 'Civil Lines, Meerut',
      type: 'Whole Blood',
      volume: '450 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2025-0802'
    },
    {
      refCode: 'RED-00511',
      date: '24 Apr 2025',
      hospital: 'Prem Hospital Blood Bank',
      location: 'Delhi Road, Meerut',
      type: 'Whole Blood',
      volume: '450 mL',
      units: '1 Unit',
      verified: true,
      certId: 'CERT-2025-0424'
    }
  ];

  let donorName = 'Ankit Kumar';
  let donorBloodGroup = 'O-';

  function initMyDonations() {
    // 1. Session lookup
    try {
      const raw = localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || localStorage.getItem('donorUser');
      if (raw) {
        const session = JSON.parse(raw);
        donorName = session.name || (session.user && session.user.name) || donorName;
        donorBloodGroup = session.bloodGroup || (session.user && session.user.bloodGroup) || donorBloodGroup;
      }
    } catch (e) {
      console.warn('Session parse notice:', e);
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

    const totalDonations = DEFAULT_DONATION_RECORDS.length;
    const livesSaved = totalDonations * 3; // Standard clinical impact factor
    const totalVolume = totalDonations * 450; // In mL

    if (totalCountEl) totalCountEl.textContent = totalDonations;
    if (livesSavedEl) livesSavedEl.textContent = `${livesSaved} Lives`;
    if (totalVolumeEl) totalVolumeEl.textContent = `${totalVolume.toLocaleString()} mL`;
  }

  function renderDonationsTable() {
    const tableBody = document.getElementById('donationsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = DEFAULT_DONATION_RECORDS.map((rec) => {
      const compClass = rec.type.toLowerCase().includes('platelet') ? 'platelets' : 'whole-blood';
      const icon = rec.type.toLowerCase().includes('platelet') ? 'fa-vial' : 'fa-droplet';

      return `
        <tr>
          <td>
            <span class="ref-code">${rec.refCode}</span>
          </td>
          <td>
            <strong style="color: #ffffff;">${rec.date}</strong>
          </td>
          <td>
            <div class="hosp-info-cell">
              <span class="hosp-info-name">${rec.hospital}</span>
              <span class="hosp-info-loc"><i class="fa-solid fa-location-dot" style="font-size:0.7rem;margin-right:4px;"></i>${rec.location}</span>
            </div>
          </td>
          <td>
            <span class="badge-component ${compClass}">
              <i class="fa-solid ${icon}"></i>
              ${rec.type}
            </span>
          </td>
          <td>
            <strong style="color: #ffffff;">${rec.volume}</strong>
            <div style="font-size: 0.74rem; color: #64748b;">(${rec.units})</div>
          </td>
          <td>
            <span class="badge-status-verified">
              <i class="fa-solid fa-circle-check"></i>
              VERIFIED
            </span>
          </td>
          <td style="text-align: right;">
            <button class="btn-cert-download" onclick="window.openCertificate('${rec.certId}', '${rec.refCode}', '${rec.date}', '${rec.hospital}', '${rec.type}')">
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

    document.getElementById('modalCertDonorName').textContent = donorName;
    document.getElementById('modalCertBloodGroup').textContent = donorBloodGroup;
    document.getElementById('modalCertRefCode').textContent = refCode;
    document.getElementById('modalCertDate').textContent = date;
    document.getElementById('modalCertHospital').textContent = hospital;
    document.getElementById('modalCertType').textContent = type;
    document.getElementById('modalCertId').textContent = certId;

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
      const headers = ['Reference Code', 'Date', 'Hospital', 'Type', 'Volume', 'Units', 'Status', 'Certificate ID'];
      const rows = DEFAULT_DONATION_RECORDS.map(r => [
        r.refCode,
        `"${r.date}"`,
        `"${r.hospital}"`,
        `"${r.type}"`,
        `"${r.volume}"`,
        `"${r.units}"`,
        'VERIFIED',
        r.certId
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
