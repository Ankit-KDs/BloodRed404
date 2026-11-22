/**
 * RED404 Hospital Quick Availability Check Component (Round 15 Part 2)
 *
 * Requirements:
 * - No AI required; runs 100% deterministic local tool calls in < 1 second.
 * - 8 drop badges for blood groups, radius selector (5/10/20 km, default 10), toggle includeCompatible (default true).
 * - Calls donor_availability and get_stock.
 * - Renders Result Card directly from tool JSON: headline, table rows (exact first), distance bands,
 *   expandable "not available right now" breakdown, hospital stock badge, action buttons.
 * - English (EN) and Hindi (HI) support.
 * - Mounts on Dashboard and available via Drawer button on every hospital page.
 */
(function() {
  'use strict';

  const ALL_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const I18N = {
    en: {
      panelTitle: "Quick availability check",
      panelSubtitle: "Instant donor count and compatibility in your zone",
      selectBloodGroup: "Select blood group",
      radius: "Radius",
      includeCompatible: "Include compatible groups",
      btnCheck: "Check",
      checking: "Checking availability...",
      noDonorsFound: "No eligible donors within {radius} km. Try 20 km or plan a donation drive.",
      eligibleHeadline: "{count} eligible donors within {radius} km",
      eligibleHeadlineSingular: "1 eligible donor within {radius} km",
      exactMatch: "Exact match",
      compatibleGroup: "Compatible",
      groupCol: "Group",
      availableCol: "Available",
      breakdownCol: "Distance breakdown",
      notAvailableSummary: "Not available right now: {count}",
      reasonRecentlyDonated: "Cooldown after recent donation",
      reasonDeferred: "Medically or temporarily deferred",
      reasonPaused: "Availability paused by donor",
      reasonStaleLocation: "Location not updated in last 24h",
      reasonLocationOff: "Location GPS unpinned / off",
      reasonUnconfirmed: "Blood group unconfirmed",
      ourStock: "Our stock",
      units: "units",
      updated: "Updated",
      justNow: "just now",
      openFindDonors: "Open in Find Donors",
      try20km: "Try 20 km",
      planDrive: "Plan donation drive",
      doctorDisclaimer: "Counts are estimates. A doctor makes the final decision.",
      errorTitle: "Unable to retrieve availability data.",
      retry: "Retry",
      drawerTitle: "Quick Availability Check",
      navBtnText: "Quick Check",
      suggestionsTitle: "Suggestions",
      useCompatibleAction: "Use compatible in search",
      switch20kmAction: "Switch to 20 km",
      planDriveAction: "Plan donation drive"
    },
    hi: {
      panelTitle: "त्वरित उपलब्धता जांच",
      panelSubtitle: "आपके क्षेत्र में तत्काल डोनर गणना और अनुकूलता",
      selectBloodGroup: "रक्त समूह चुनें",
      radius: "त्रिज्या (दूरी)",
      includeCompatible: "संगत रक्त समूह शामिल करें",
      btnCheck: "जांचें",
      checking: "जांच जारी है...",
      noDonorsFound: "{radius} किमी के भीतर कोई योग्य रक्तदाता नहीं मिला। 20 किमी आज़माएं या रक्तदान शिविर की योजना बनाएं।",
      eligibleHeadline: "{radius} किमी के भीतर {count} योग्य रक्तदाता",
      eligibleHeadlineSingular: "{radius} किमी के भीतर 1 योग्य रक्तदाता",
      exactMatch: "सटीक मेल",
      compatibleGroup: "संगत",
      groupCol: "समूह",
      availableCol: "उपलब्ध",
      breakdownCol: "दूरी विवरण",
      notAvailableSummary: "फिलहाल अनुपलब्ध: {count}",
      reasonRecentlyDonated: "हालिया रक्तदान के बाद कूलडाउन",
      reasonDeferred: "चिकित्सीय रूप से आस्थगित",
      reasonPaused: "डोनर द्वारा उपलब्धता रोकी गई",
      reasonStaleLocation: "पिछले 24 घंटों में लोकेशन अपडेट नहीं हुई",
      reasonLocationOff: "लोकेशन जीपीएस बंद / पिन नहीं",
      reasonUnconfirmed: "रक्त समूह असत्यापित",
      ourStock: "हमारा स्टॉक",
      units: "यूनिट",
      updated: "अपडेट किया गया",
      justNow: "अभी-अभी",
      openFindDonors: "डोनर खोज में खोलें",
      try20km: "20 किमी आज़माएं",
      planDrive: "रक्तदान शिविर की योजना बनाएं",
      doctorDisclaimer: "गणना अनुमानित है। अंतिम निर्णय डॉक्टर का होता है।",
      errorTitle: "उपलब्धता डेटा प्राप्त करने में असमर्थ।",
      retry: "पुनः प्रयास करें",
      drawerTitle: "त्वरित उपलब्धता जांच",
      navBtnText: "उपलब्धता जांचें",
      suggestionsTitle: "सुझाव",
      useCompatibleAction: "खोज में संगत शामिल करें",
      switch20kmAction: "20 किमी पर बदलें",
      planDriveAction: "रक्तदान शिविर की योजना बनाएं"
    }
  };

  // Shared state
  let currentLang = localStorage.getItem('red404_lang') === 'hi' ? 'hi' : 'en';
  let selectedGroup = 'O+';
  let selectedRadius = 10;
  let includeCompatible = true;
  let lastResultData = null;
  let lastStockData = null;

  function t(key, params) {
    const dict = I18N[currentLang] || I18N.en;
    let str = dict[key] || I18N.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return str;
  }

  function setLanguage(lang) {
    currentLang = lang === 'hi' ? 'hi' : 'en';
    localStorage.setItem('red404_lang', currentLang);
    renderAllPanels();
  }

  /**
   * Builds the HTML template for the Quick Check Panel.
   */
  function buildPanelTemplate(prefix) {
    return `
      <div class="qc-header">
        <div class="qc-title-group">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            ${t('panelTitle')}
          </h3>
          <p>${t('panelSubtitle')}</p>
        </div>
        <div class="qc-lang-toggle">
          <button type="button" class="qc-lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          <button type="button" class="qc-lang-btn ${currentLang === 'hi' ? 'active' : ''}" data-lang="hi">HI</button>
        </div>
      </div>

      <!-- Blood Group Drop Badges (8 Groups) -->
      <label class="qc-section-label">${t('selectBloodGroup')}</label>
      <div class="qc-blood-grid" id="${prefix}_bloodGrid">
        ${ALL_GROUPS.map(g => `
          <button type="button" class="qc-blood-btn ${g === selectedGroup ? 'selected' : ''}" data-group="${g}" aria-label="Select blood group ${g}">
            <svg viewBox="0 0 32 38"><path d="M16 3 C16 3 4 17 4 25 A12 12 0 0 0 28 25 C28 17 16 3 16 3 Z"/></svg>
            <span>${g}</span>
          </button>
        `).join('')}
      </div>

      <!-- Radius & Compatible Toggle -->
      <div class="qc-controls-row">
        <div class="qc-radius-group">
          <span class="qc-section-label" style="margin: 0;">${t('radius')}:</span>
          <div class="qc-radius-pills" id="${prefix}_radiusPills">
            <button type="button" class="qc-radius-pill ${selectedRadius === 5 ? 'active' : ''}" data-radius="5">5 km</button>
            <button type="button" class="qc-radius-pill ${selectedRadius === 10 ? 'active' : ''}" data-radius="10">10 km</button>
            <button type="button" class="qc-radius-pill ${selectedRadius === 20 ? 'active' : ''}" data-radius="20">20 km</button>
          </div>
        </div>

        <label class="qc-toggle-label">
          <input type="checkbox" id="${prefix}_toggleCompatible" ${includeCompatible ? 'checked' : ''} />
          <span>${t('includeCompatible')}</span>
        </label>
      </div>

      <!-- Action Button -->
      <div class="qc-action-row">
        <button type="button" class="qc-btn-check" id="${prefix}_btnCheck">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span id="${prefix}_btnCheckText">${t('btnCheck')}</span>
        </button>
      </div>

      <!-- Container for Loading / Result Card / Error -->
      <div id="${prefix}_resultContainer"></div>
    `;
  }

  function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Red404-Role': 'HOSPITAL'
    };
    const token = localStorage.getItem('red404_hospitalToken') || sessionStorage.getItem('token');
    if (token) {
      headers['X-Red404-Token'] = token;
      headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
  }

  /**
   * Executes donor_availability and get_stock in parallel.
   */
  async function performQuickCheck(containerPrefix) {
    const resBox = document.getElementById(`${containerPrefix}_resultContainer`);
    const btnCheck = document.getElementById(`${containerPrefix}_btnCheck`);
    const btnText = document.getElementById(`${containerPrefix}_btnCheckText`);

    if (btnCheck) btnCheck.disabled = true;
    if (btnText) btnText.textContent = t('checking');

    // Loading State
    if (resBox) {
      resBox.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #94a3b8;">
          <div style="display: inline-block; width: 24px; height: 24px; border: 2.5px solid rgba(239,68,68,0.25); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px;"></div>
          <div style="font-size: 13px;">${t('checking')}</div>
        </div>
      `;
    }

    const startTime = performance.now();

    try {
      // Parallel fetch to backend assistant tools
      const [availRes, stockRes] = await Promise.all([
        fetch('/api/hospital/assistant/tool/donor-availability', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            bloodGroup: selectedGroup,
            radiusKm: selectedRadius,
            includeCompatible: includeCompatible
          })
        }).then(r => r.json()),

        fetch('/api/hospital/assistant/tool/get-stock', {
          method: 'POST',
          headers: getAuthHeaders(),
          credentials: 'include'
        }).then(r => r.json())
      ]);

      const durationMs = Math.round(performance.now() - startTime);

      if (!availRes.success) {
        throw new Error(availRes.message || availRes.error || 'Failed to check donor availability');
      }

      lastResultData = availRes.data;
      lastStockData = stockRes && stockRes.success ? stockRes.data : null;

      renderResultCard(containerPrefix, lastResultData, lastStockData, durationMs);
    } catch (err) {
      console.error('Quick Check Error:', err);
      if (resBox) {
        resBox.innerHTML = `
          <div style="padding: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #fca5a5; font-size: 13px; margin-top: 14px;">
            <div style="font-weight: 700; margin-bottom: 4px;">${t('errorTitle')}</div>
            <div style="font-size: 12px; margin-bottom: 10px;">${escapeHtml(err.message || 'Network request failed')}</div>
            <button type="button" class="qc-btn-try20" id="${containerPrefix}_btnRetry" style="padding: 4px 12px; font-size: 12px;">${t('retry')}</button>
          </div>
        `;
        const retryBtn = document.getElementById(`${containerPrefix}_btnRetry`);
        if (retryBtn) {
          retryBtn.addEventListener('click', () => performQuickCheck(containerPrefix));
        }
      }
    } finally {
      if (btnCheck) btnCheck.disabled = false;
      if (btnText) btnText.textContent = t('btnCheck');
    }
  }

  /**
   * PART 4: Deterministic Rule-Based Suggestions computed strictly from tool JSON.
   */
  function computeRuleBasedSuggestions(avail, stock, requestedUnits) {
    const suggestions = [];
    if (!avail) return suggestions;

    const bg = avail.bloodGroup || selectedGroup;
    const radius = avail.radiusKm || selectedRadius;
    const totalEligible = avail.totalEligible || 0;
    const compGroups = avail.compatibleGroups || [];

    const exactObj = compGroups.find(cg => cg.isExact || cg.group === bg);
    const exactCount = exactObj ? exactObj.count : 0;

    const compOnly = compGroups.filter(cg => !cg.isExact && cg.group !== bg && cg.count > 0);
    const compCount = compOnly.reduce((acc, g) => acc + g.count, 0);
    const compNames = compOnly.map(g => g.group).join(', ');

    let groupStock = null;
    if (stock && Array.isArray(stock.groups)) {
      groupStock = stock.groups.find(g => g.group === bg);
    }
    const stockUnits = groupStock ? groupStock.units : 0;
    const stockStatus = groupStock ? groupStock.status : 'OK';
    const isStockLowOrCrit = stockStatus === 'Critical' || stockStatus === 'Low' || (groupStock && stockUnits <= (groupStock.lowThreshold || 4));

    // Rule 1: exact count == 0 and compatible count > 0
    if (exactCount === 0 && compCount > 0) {
      const text = currentLang === 'hi'
        ? `0 सटीक [${bg}] डोनर, लेकिन ${compCount} संगत डोनर मिले (${compNames})। संगत पर विचार करें।`
        : `0 exact [${bg}] donors, but ${compCount} compatible donors found (${compNames}). Consider compatible.`;
      const actionLabel = currentLang === 'hi' ? 'खोज में संगत शामिल करें' : 'Use compatible in search';
      suggestions.push({
        id: 'rule1',
        type: 'info',
        text: text,
        actionLabel: actionLabel,
        actionType: 'use_compatible'
      });
    }

    // Rule 2: total eligible < requested units (or < 2 if units not given) and radius < 20 km
    const reqU = requestedUnits || 2;
    if (totalEligible > 0 && totalEligible < reqU && radius < 20) {
      const text = currentLang === 'hi'
        ? `${radius} किमी में केवल ${totalEligible} डोनर उपलब्ध हैं। 20 किमी तक विस्तार करें?`
        : `Only ${totalEligible} donors within ${radius} km. Expand to 20 km?`;
      const actionLabel = currentLang === 'hi' ? '20 किमी पर बदलें' : 'Switch to 20 km';
      suggestions.push({
        id: 'rule2',
        type: 'warning',
        text: text,
        actionLabel: actionLabel,
        actionType: 'switch_20km'
      });
    }

    // Rule 3: our stock for the requested group is Low or Critical
    if (isStockLowOrCrit) {
      const text = currentLang === 'hi'
        ? `हमारा [${bg}] स्टॉक ${stockStatus} (${stockUnits} यूनिट) है। योजना बनाते समय स्टॉक का ध्यान रखें।`
        : `Our [${bg}] stock is ${stockStatus} (${stockUnits} units). Keep stock in mind when planning.`;
      const actionLabel = currentLang === 'hi' ? 'रक्तदान शिविर की योजना बनाएं' : 'Plan donation drive';
      suggestions.push({
        id: 'rule3',
        type: 'critical',
        text: text,
        actionLabel: actionLabel,
        actionType: 'plan_drive'
      });
    }

    // Rule 4: exact count == 0 and compatible count == 0
    if (exactCount === 0 && compCount === 0) {
      const text = currentLang === 'hi'
        ? `${radius} किमी के भीतर कोई डोनर नहीं मिला। क्षेत्रीय ब्लड बैंकों से संपर्क करें या रिप्लेसमेंट शिविर की योजना बनाएं।`
        : `No matching donors within ${radius} km. Contact regional blood banks or schedule a replacement drive.`;
      const actionLabel = radius < 20
        ? (currentLang === 'hi' ? '20 किमी पर बदलें' : 'Switch to 20 km')
        : (currentLang === 'hi' ? 'रक्तदान शिविर की योजना बनाएं' : 'Plan donation drive');
      suggestions.push({
        id: 'rule4',
        type: 'warning',
        text: text,
        actionLabel: actionLabel,
        actionType: radius < 20 ? 'switch_20km' : 'plan_drive'
      });
    }

    return suggestions;
  }

  function renderSuggestionsCard(prefix, suggestions) {
    if (!suggestions || suggestions.length === 0) return '';
    return `
      <div class="qc-suggestions-card" id="${prefix}_suggestionsCard">
        <div class="qc-suggestions-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>${t('suggestionsTitle') || 'Suggestions'}</span>
        </div>
        ${suggestions.map((s, idx) => `
          <div class="qc-suggestion-item ${s.type || ''}" id="${prefix}_suggItem_${idx}">
            <div class="qc-sugg-text">${escapeHtml(s.text)}</div>
            ${s.actionLabel ? `
              <button type="button" class="qc-sugg-action-btn ${s.type === 'critical' ? 'red' : s.type === 'warning' ? 'amber' : ''}" data-action="${s.actionType}" id="${prefix}_suggBtn_${idx}">
                ${escapeHtml(s.actionLabel)}
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renders Result Card directly from tool JSON.
   */
  function renderResultCard(prefix, avail, stock, durationMs) {
    const resBox = document.getElementById(`${prefix}_resultContainer`);
    if (!resBox || !avail) return;

    const totalEligible = avail.totalEligible || 0;
    const radius = avail.radiusKm || selectedRadius;
    const compatibleGroups = avail.compatibleGroups || [];
    const notAvailTotal = avail.notAvailableTotal || 0;
    const reasons = avail.notAvailableReasons || {};

    // Stock for the requested group
    let groupStock = null;
    if (stock && Array.isArray(stock.groups)) {
      groupStock = stock.groups.find(g => g.group === selectedGroup);
    }
    const stockUnits = groupStock ? groupStock.units : 0;
    const stockStatus = groupStock ? groupStock.status : 'OK';
    const isCriticalOrLow = stockStatus === 'Critical' || stockStatus === 'Low' || stockUnits <= (groupStock ? groupStock.lowThreshold : 4);

    // Compute Part 4 Rule-based Suggestions
    const suggestions = computeRuleBasedSuggestions(avail, stock, 1);

    // Empty state
    if (totalEligible === 0) {
      resBox.innerHTML = `
        <div class="qc-result-card" style="border-left: 3px solid #f59e0b;">
          <div class="qc-result-header">
            <h4 class="qc-headline empty">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>${t('noDonorsFound', { radius: radius })}</span>
            </h4>
            ${renderStockPill(stockUnits, stockStatus)}
          </div>

          <!-- Part 4 Rule-Based Suggestions -->
          ${renderSuggestionsCard(prefix, suggestions)}

          <!-- Muted reasons accordion -->
          ${renderUnavailableAccordion(prefix, notAvailTotal, reasons)}

          <!-- Action buttons for empty state -->
          <div class="qc-button-row">
            ${radius < 20 ? `
              <button type="button" class="qc-btn-try20" id="${prefix}_btnTry20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                <span>${t('try20km')}</span>
              </button>
            ` : ''}
            <button type="button" class="qc-btn-drive" id="${prefix}_btnPlanDrive">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>${t('planDrive')}</span>
            </button>
          </div>

          <div class="qc-card-footer">
            <span>${t('doctorDisclaimer')}</span>
            <span>${t('updated')} ${t('justNow')} (${durationMs}ms)</span>
          </div>
        </div>
      `;
      bindResultCardActions(prefix, avail, radius);
      return;
    }

    // Populated Result Card
    const headlineText = totalEligible === 1
      ? t('eligibleHeadlineSingular', { radius: radius })
      : t('eligibleHeadline', { count: totalEligible, radius: radius });

    resBox.innerHTML = `
      <div class="qc-result-card" style="border-left: 3px solid #22c55e;">
        <div class="qc-result-header">
          <h4 class="qc-headline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>${headlineText}</span>
          </h4>
          ${renderStockPill(stockUnits, stockStatus)}
        </div>

        <!-- Groups Table -->
        <div class="qc-table-wrap">
          <table class="qc-table">
            <thead>
              <tr>
                <th>${t('groupCol')}</th>
                <th>${t('availableCol')}</th>
                <th>${t('breakdownCol')}</th>
              </tr>
            </thead>
            <tbody>
              ${compatibleGroups.map(cg => {
                const isExact = cg.isExact || cg.group === selectedGroup;
                const bands = avail.distanceBands || {};
                return `
                  <tr class="${isExact ? 'exact-row' : ''}">
                    <td>
                      <span class="qc-group-badge ${isExact ? 'exact' : ''}">${cg.group}</span>
                      <span style="font-size: 11px; color: ${isExact ? '#f87171' : '#94a3b8'}; margin-left: 4px;">
                        ${isExact ? `(${t('exactMatch')})` : `(${t('compatibleGroup')})`}
                      </span>
                    </td>
                    <td>
                      <strong style="color: ${cg.count > 0 ? '#fff' : '#64748b'}; font-size: 14px;">${cg.count}</strong>
                    </td>
                    <td>
                      <div class="qc-band-chips">
                        ${Object.entries(bands).map(([bName, bCount]) => `
                          <span class="qc-band-chip">${bName}: <strong>${isExact ? bCount : '-'}</strong></span>
                        `).join('')}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Part 4 Rule-Based Suggestions -->
        ${renderSuggestionsCard(prefix, suggestions)}

        <!-- Expandable "Not available right now" section -->
        ${renderUnavailableAccordion(prefix, notAvailTotal, reasons)}

        <!-- Action Buttons -->
        <div class="qc-button-row">
          <button type="button" class="qc-btn-find" id="${prefix}_btnFindDonors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>${t('openFindDonors')}</span>
          </button>

          ${radius < 20 ? `
            <button type="button" class="qc-btn-try20" id="${prefix}_btnTry20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
              <span>${t('try20km')}</span>
            </button>
          ` : ''}

          ${isCriticalOrLow ? `
            <button type="button" class="qc-btn-drive" id="${prefix}_btnPlanDrive">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>${t('planDrive')}</span>
            </button>
          ` : ''}
        </div>

        <div class="qc-card-footer">
          <span>${t('doctorDisclaimer')}</span>
          <span>${t('updated')} ${t('justNow')} (${durationMs}ms)</span>
        </div>
      </div>
    `;

    bindResultCardActions(prefix, avail, radius);
  }

  function renderStockPill(units, status) {
    const stLower = (status || 'OK').toLowerCase();
    let cls = 'ok';
    if (stLower.includes('crit')) cls = 'critical';
    else if (stLower.includes('low')) cls = 'low';

    return `
      <span class="qc-stock-pill ${cls}">
        <span>${t('ourStock')}: <strong>${units} ${t('units')}</strong> (${status})</span>
      </span>
    `;
  }

  function renderUnavailableAccordion(prefix, total, reasons) {
    return `
      <div class="qc-unavail-accordion">
        <button type="button" class="qc-unavail-trigger" id="${prefix}_unavailTrigger" aria-expanded="false">
          <span>${t('notAvailableSummary', { count: total })}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="qc-unavail-reasons" id="${prefix}_unavailReasons">
          <div class="qc-reason-item">
            <span>${t('reasonRecentlyDonated')}</span>
            <strong>${reasons.recentlyDonated || 0}</strong>
          </div>
          <div class="qc-reason-item">
            <span>${t('reasonDeferred')}</span>
            <strong>${reasons.deferred || 0}</strong>
          </div>
          <div class="qc-reason-item">
            <span>${t('reasonPaused')}</span>
            <strong>${reasons.paused || 0}</strong>
          </div>
          <div class="qc-reason-item">
            <span>${t('reasonStaleLocation')}</span>
            <strong>${reasons.staleLocation || 0}</strong>
          </div>
          <div class="qc-reason-item">
            <span>${t('reasonLocationOff')}</span>
            <strong>${reasons.locationOff || 0}</strong>
          </div>
          <div class="qc-reason-item">
            <span>${t('reasonUnconfirmed')}</span>
            <strong>${reasons.bloodGroupUnconfirmed || 0}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function bindResultCardActions(prefix, avail, radius) {
    // Accordion toggle
    const trigger = document.getElementById(`${prefix}_unavailTrigger`);
    const reasonsBox = document.getElementById(`${prefix}_unavailReasons`);
    if (trigger && reasonsBox) {
      trigger.addEventListener('click', () => {
        const isOpen = reasonsBox.classList.contains('open');
        if (isOpen) {
          reasonsBox.classList.remove('open');
          trigger.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          reasonsBox.classList.add('open');
          trigger.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    }

    // Try 20 km button
    const try20Btn = document.getElementById(`${prefix}_btnTry20`);
    if (try20Btn) {
      try20Btn.addEventListener('click', () => {
        selectedRadius = 20;
        syncControlsAcrossPanels();
        performQuickCheck(prefix);
      });
    }

    // Plan donation drive button
    const driveBtn = document.getElementById(`${prefix}_btnPlanDrive`);
    if (driveBtn) {
      driveBtn.addEventListener('click', () => {
        // If drawer is open, close it
        closeDrawer();
        if (window.location.pathname.includes('hospital-dashboard.html')) {
          if (typeof window.switchTab === 'function') {
            window.switchTab('tab-dashboard');
          }
          const openDriveModal = document.getElementById('btnOpenPlanDriveModal');
          if (openDriveModal) {
            openDriveModal.click();
          } else {
            const sec = document.getElementById('sectionDonationDrives');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          window.location.href = 'hospital-dashboard.html#tab-dashboard';
        }
      });
    }

    // Open in Find Donors button
    const findBtn = document.getElementById(`${prefix}_btnFindDonors`);
    if (findBtn) {
      findBtn.addEventListener('click', async () => {
        try {
          findBtn.disabled = true;
          findBtn.innerHTML = `<span>Loading search...</span>`;

          // Call prepare_search tool
          const prepRes = await fetch('/api/hospital/assistant/tool/prepare-search', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              bloodGroup: selectedGroup,
              radiusKm: selectedRadius,
              includeCompatible: includeCompatible,
              units: 1,
              urgency: 'Normal'
            })
          }).then(r => r.json());

          const prefill = prepRes && prepRes.data ? prepRes.data.prefill : {
            bloodGroup: selectedGroup,
            radiusKm: selectedRadius,
            includeCompatible: includeCompatible
          };

          // Store prefill for cross-page navigation or tab switch
          sessionStorage.setItem('red404_find_prefill', JSON.stringify(prefill));

          closeDrawer();

          if (window.location.pathname.includes('hospital-dashboard.html')) {
            if (typeof window.switchTab === 'function') {
              window.switchTab('tab-dispatch');
            }
            applyPrefillToFindDonorsForm(prefill);
          } else {
            window.location.href = 'hospital-dashboard.html#tab-dispatch';
          }
        } catch (e) {
          console.error('Error in prepare_search dispatch:', e);
          const fallbackPrefill = {
            bloodGroup: selectedGroup,
            radiusKm: selectedRadius,
            includeCompatible: includeCompatible
          };
          sessionStorage.setItem('red404_find_prefill', JSON.stringify(fallbackPrefill));
          if (window.location.pathname.includes('hospital-dashboard.html')) {
            if (typeof window.switchTab === 'function') {
              window.switchTab('tab-dispatch');
            }
            applyPrefillToFindDonorsForm(fallbackPrefill);
          } else {
            window.location.href = 'hospital-dashboard.html#tab-dispatch';
          }
        } finally {
          findBtn.disabled = false;
        }
      });
    }

    // PART 4: Wire suggestion action buttons (1-click, strictly read-only, never auto-dispatches)
    const resBox = document.getElementById(`${prefix}_resultBox`);
    if (resBox) {
      resBox.querySelectorAll('.qc-sugg-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const action = btn.getAttribute('data-action');
          if (action === 'switch_20km') {
            selectedRadius = 20;
            syncControlsAcrossPanels();
            performQuickCheck(prefix);
          } else if (action === 'use_compatible') {
            includeCompatible = true;
            syncControlsAcrossPanels();
            const findBtn = document.getElementById(`${prefix}_btnFindDonors`);
            if (findBtn) {
              findBtn.click();
            } else {
              performQuickCheck(prefix);
            }
          } else if (action === 'plan_drive') {
            const driveBtn = document.getElementById(`${prefix}_btnPlanDrive`);
            if (driveBtn) {
              driveBtn.click();
            } else {
              closeDrawer();
              if (window.location.pathname.includes('hospital-dashboard.html')) {
                if (typeof window.switchTab === 'function') {
                  window.switchTab('tab-dashboard');
                }
                const openDriveModal = document.getElementById('btnOpenPlanDriveModal');
                if (openDriveModal) {
                  openDriveModal.click();
                } else {
                  const sec = document.getElementById('sectionDonationDrives');
                  if (sec) sec.scrollIntoView({ behavior: 'smooth' });
                }
              } else {
                window.location.href = 'hospital-dashboard.html#tab-dashboard';
              }
            }
          }
        });
      });
    }
  }

  /**
   * Applies prefill payload from prepare_search to the Find Donors form.
   * Search form is prefilled and ready to search, but NOT sent automatically.
   */
  function applyPrefillToFindDonorsForm(prefill) {
    if (!prefill) return;

    // 1. Blood group radio
    const bg = prefill.bloodGroup || selectedGroup;
    const r = document.querySelector(`input[name="dispBloodGroup"][value="${bg}"]`);
    if (r) {
      r.checked = true;
      try { r.click(); } catch (_) {}
      r.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 2. Radius
    const radEl = document.getElementById('dispRadius');
    if (radEl && prefill.radiusKm) {
      radEl.value = String(prefill.radiusKm);
      radEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Units
    const unitsEl = document.getElementById('dispUnits');
    if (unitsEl && prefill.unitsNeeded) {
      unitsEl.value = String(prefill.unitsNeeded);
    }

    // 4. Urgency
    const urgEl = document.getElementById('dispUrgency');
    if (urgEl && prefill.urgency) {
      const u = prefill.urgency.charAt(0).toUpperCase() + prefill.urgency.slice(1).toLowerCase();
      urgEl.value = u;
    }

    // 5. Scroll and highlight form
    const form = document.getElementById('formFullDispatch');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function attachPanelEvents(prefix) {
    const root = document.getElementById(`${prefix}_root`);
    if (!root) return;

    // Language buttons
    root.querySelectorAll('.qc-lang-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.currentTarget.getAttribute('data-lang');
        setLanguage(lang);
      });
    });

    // Blood group buttons
    root.querySelectorAll('.qc-blood-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedGroup = e.currentTarget.getAttribute('data-group');
        syncControlsAcrossPanels();
      });
    });

    // Radius pills
    root.querySelectorAll('.qc-radius-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedRadius = parseInt(e.currentTarget.getAttribute('data-radius'), 10) || 10;
        syncControlsAcrossPanels();
      });
    });

    // Compatible toggle
    const toggle = document.getElementById(`${prefix}_toggleCompatible`);
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        includeCompatible = e.target.checked;
        syncControlsAcrossPanels();
      });
    }

    // Check button
    const checkBtn = document.getElementById(`${prefix}_btnCheck`);
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        performQuickCheck(prefix);
      });
    }
  }

  function syncControlsAcrossPanels() {
    ['qcDash', 'qcDrawer'].forEach(p => {
      const root = document.getElementById(`${p}_root`);
      if (!root) return;

      // Update blood badges
      root.querySelectorAll('.qc-blood-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.getAttribute('data-group') === selectedGroup);
      });

      // Update radius pills
      root.querySelectorAll('.qc-radius-pill').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.getAttribute('data-radius'), 10) === selectedRadius);
      });

      // Update toggle
      const tog = document.getElementById(`${p}_toggleCompatible`);
      if (tog) tog.checked = includeCompatible;
    });
  }

  function renderAllPanels() {
    // 1. Dashboard panel
    const dashMount = document.getElementById('quickCheckDashboardMount');
    if (dashMount) {
      dashMount.innerHTML = `
        <article class="quick-check-card" id="qcDash_root">
          ${buildPanelTemplate('qcDash')}
        </article>
      `;
      attachPanelEvents('qcDash');
      if (lastResultData) {
        renderResultCard('qcDash', lastResultData, lastStockData, 0);
      }
    }

    // 2. Drawer panel
    const drawerMount = document.getElementById('quickCheckDrawerBody');
    if (drawerMount) {
      drawerMount.innerHTML = `
        <div id="qcDrawer_root">
          ${buildPanelTemplate('qcDrawer')}
        </div>
      `;
      attachPanelEvents('qcDrawer');
      if (lastResultData) {
        renderResultCard('qcDrawer', lastResultData, lastStockData, 0);
      }
    }
  }

  /**
   * Initializes the slide-in drawer on the page.
   */
  function initDrawer() {
    if (document.getElementById('quickCheckDrawer')) return;

    const drawerHtml = `
      <div class="qc-drawer-backdrop" id="quickCheckBackdrop" aria-hidden="true"></div>
      <aside class="qc-drawer" id="quickCheckDrawer" role="dialog" aria-modal="true" aria-label="${t('drawerTitle')}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="font-weight: 700; color: #fff; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>${t('drawerTitle')}</span>
          </div>
          <button type="button" class="qc-drawer-close" id="btnCloseQuickCheckDrawer" aria-label="Close drawer">&times;</button>
        </div>
        <div id="quickCheckDrawerBody"></div>
      </aside>
    `;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    const backdrop = document.getElementById('quickCheckBackdrop');
    const closeBtn = document.getElementById('btnCloseQuickCheckDrawer');
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // Escape key closes drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isDrawerOpen()) closeDrawer();
    });
  }

  function isDrawerOpen() {
    const d = document.getElementById('quickCheckDrawer');
    return d && d.classList.contains('open');
  }

  function openDrawer() {
    const d = document.getElementById('quickCheckDrawer');
    const b = document.getElementById('quickCheckBackdrop');
    if (d && b) {
      d.classList.add('open');
      b.classList.add('open');
      document.body.style.overflow = 'hidden';
      // Sync controls
      syncControlsAcrossPanels();
    }
  }

  function closeDrawer() {
    const d = document.getElementById('quickCheckDrawer');
    const b = document.getElementById('quickCheckBackdrop');
    if (d && b) {
      d.classList.remove('open');
      b.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  /**
   * Inserts the "Quick Check" button into the navbar if present.
   */
  function injectNavbarDrawerButton() {
    const navActions = document.querySelector('.hosp-nav-actions');
    if (navActions && !document.getElementById('btnQuickCheckDrawerTrigger')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-nav-quick-check';
      btn.id = 'btnQuickCheckDrawerTrigger';
      btn.setAttribute('aria-label', t('quickCheckBtn'));
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <span>${t('navBtnText')}</span>
      `;
      btn.addEventListener('click', openDrawer);
      navActions.insertBefore(btn, navActions.firstChild);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Check for prefill on tab-dispatch load
  function checkPrefillOnLoad() {
    try {
      const stored = sessionStorage.getItem('red404_find_prefill');
      if (stored) {
        sessionStorage.removeItem('red404_find_prefill');
        const pf = JSON.parse(stored);
        applyPrefillToFindDonorsForm(pf);
      }
    } catch (e) {
      console.warn('Error reading prefill:', e);
    }
  }

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initDrawer();
    injectNavbarDrawerButton();
    renderAllPanels();
    checkPrefillOnLoad();
  });

  // Export functions globally
  window.Red404QuickCheck = {
    openDrawer: openDrawer,
    closeDrawer: closeDrawer,
    setLanguage: setLanguage,
    performCheck: performQuickCheck,
    applyPrefill: applyPrefillToFindDonorsForm,
    computeSuggestions: computeRuleBasedSuggestions
  };
})();
