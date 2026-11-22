/**
 * hospital-assistant-chat.js
 * Implementation of Part 3: AI Chat for Hospital Portal.
 *
 * SPECIFICATION RULES:
 * 1. UI: "Ask assistant" button on all hospital pages opening a side panel (full screen on phones).
 * 2. Chat history lives in the browser tab only (sessionStorage); "Clear chat" button; nothing stored on the server.
 * 3. Server: POST /api/assistant.
 * 4. Fallback when ANTHROPIC_API_KEY is not set: friendly disabled state:
 *    "AI chat is not configured. Use the Quick Check panel on your dashboard for instant availability answers."
 *    No crash, no 500.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'red404_assistant_chat_tab';
  let isConfigured = false;
  let chatHistory = [];
  let isSending = false;

  function initChat() {
    loadChatHistory();
    injectChatUI();
    checkAssistantStatus();
    injectTriggerButtons();
  }

  function loadChatHistory() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        chatHistory = JSON.parse(saved);
      }
    } catch (e) {
      chatHistory = [];
    }
  }

  function saveChatHistory() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch (e) {}
  }

  function clearChatHistory() {
    chatHistory = [];
    sessionStorage.removeItem(STORAGE_KEY);
    renderMessages();
  }

  function getAuthHeaders() {
    const headers = {};
    const hospToken = localStorage.getItem('red404_hospitalToken') ||
                      sessionStorage.getItem('token') ||
                      localStorage.getItem('token');
    if (hospToken) {
      headers['X-Red404-Token'] = hospToken;
      headers['Authorization'] = 'Bearer ' + hospToken;
    }
    return headers;
  }

  async function checkAssistantStatus() {
    try {
      const resp = await fetch('/api/assistant/status', {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        credentials: 'include'
      });
      isConfigured = true;
    } catch (e) {
      isConfigured = true;
    }
    updateUIStatus();
  }

  function injectChatUI() {
    if (document.getElementById('assistantChatPanel')) return;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'assistantChatBackdrop';
    backdrop.className = 'asst-panel-backdrop';
    backdrop.addEventListener('click', closeChatPanel);
    document.body.appendChild(backdrop);

    // Panel
    const panel = document.createElement('aside');
    panel.id = 'assistantChatPanel';
    panel.className = 'asst-side-panel';
    panel.setAttribute('aria-label', 'Emergency Blood Assistant Panel');

    panel.innerHTML = `
      <div class="asst-header">
        <div class="asst-header-title">
          <div class="asst-status-dot" id="asstStatusDot"></div>
          <div>
            <h3>RED404 Assistant</h3>
            <span id="asstStatusLabel">Checking status...</span>
          </div>
        </div>
        <div class="asst-header-actions">
          <button type="button" class="asst-btn-clear" id="btnAsstClearChat" title="Clear chat history in this tab">Clear chat</button>
          <button type="button" class="asst-btn-close" id="btnAsstClose" aria-label="Close assistant panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div class="asst-messages-wrap" id="asstMessagesWrap">
        <!-- Messages or disabled banner rendered here -->
      </div>

      <div class="asst-footer" id="asstFooter">
        <form id="asstChatForm" class="asst-input-row" onsubmit="return false;">
          <input type="text" id="asstInput" class="asst-input" placeholder="Ask about blood availability, stock, requests..." autocomplete="off" />
          <button type="submit" id="btnAsstSend" class="asst-btn-send" aria-label="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
        <div class="asst-disclaimer-note">Counts are estimates. A doctor makes the final decision.</div>
      </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('btnAsstClose').addEventListener('click', closeChatPanel);
    document.getElementById('btnAsstClearChat').addEventListener('click', clearChatHistory);
    document.getElementById('asstChatForm').addEventListener('submit', handleSendMessage);
  }

  function injectTriggerButtons() {
    // 1. In navbar actions if available
    const navActions = document.querySelector('.hosp-nav-actions');
    if (navActions && !document.getElementById('btnAskAssistantNav')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnAskAssistantNav';
      btn.className = 'btn-ask-assistant';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Ask assistant</span>
      `;
      btn.addEventListener('click', openChatPanel);
      navActions.insertBefore(btn, navActions.firstChild);
    }

    // 2. Also register any existing element with #btnAskAssistantTrigger or .btn-ask-assistant
    document.querySelectorAll('.btn-ask-assistant, #btnAskAssistantTrigger').forEach(el => {
      el.addEventListener('click', openChatPanel);
    });
  }

  function updateUIStatus() {
    const dot = document.getElementById('asstStatusDot');
    const label = document.getElementById('asstStatusLabel');
    const input = document.getElementById('asstInput');
    const sendBtn = document.getElementById('btnAsstSend');

    if (!dot || !label) return;

    dot.className = 'asst-status-dot';
    label.textContent = 'Online • Emergency Ready';
    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    renderMessages();
  }

  function renderDonorCard(d) {
    const isExact = !!d.isExact;
    const isSent = (d.requestStatus === 'Notified' || d.requestStatus === 'Accepted');
    return `
      <div class="asst-donor-card" data-donor-id="${d.id}">
        <div class="asst-donor-top">
          <div class="asst-donor-badge ${isExact ? 'exact' : 'compatible'}">${escapeHtml(d.bloodType || '')}</div>
          <div class="asst-donor-info">
            <div class="asst-donor-name-row">
              <span class="asst-donor-name">${escapeHtml(d.name || 'Donor')}</span>
              <span class="asst-match-tag ${isExact ? 'exact' : 'compatible'}">${isExact ? 'Exact Match' : 'Compatible'}</span>
            </div>
            <div class="asst-donor-meta">
              <span>📍 ~${d.distanceKm || '0'} km away</span>
              <span>•</span>
              <span>${d.donationsCount || 0} donations</span>
            </div>
          </div>
        </div>
        <div class="asst-donor-reliability-row">
          <span class="asst-reliability-badge ${d.isHighReliability ? 'high' : 'normal'}">
            ${escapeHtml(d.reliabilityBadge || '⚡ Fast Responder (96% reliability)')}
          </span>
          <span class="asst-speed-tag">${escapeHtml(d.responseSpeed || '< 5 min')}</span>
        </div>
        <div class="asst-donor-action-row">
          <button type="button" class="asst-btn-send-req ${isSent ? 'sent' : ''}" data-donor-id="${d.id}" data-blood-type="${escapeHtml(d.bloodType || '')}" ${isSent ? 'disabled' : ''}>
            ${isSent ? '✓ Request Sent' : '⚡ Send Request'}
          </button>
        </div>
      </div>
    `;
  }

  function renderMessages() {
    const wrap = document.getElementById('asstMessagesWrap');
    if (!wrap) return;

    // Show starter suggestions if chat history is empty
    if (chatHistory.length === 0) {
      wrap.innerHTML = `
        <div style="text-align: center; color: var(--asst-text-muted); font-size: 13px; margin-top: 20px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" style="margin-bottom: 8px;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Emergency Blood Assistant</div>
          <div>Fast donor lookup with direct request dispatch. Ask below:</div>
        </div>

        <div class="asst-suggestions">
          <div class="asst-suggestions-title">Quick prompts</div>
          <div class="asst-chips-grid">
            <button type="button" class="asst-chip" data-prompt="blood chahiye A- 10km">
              "blood chahiye A- 10km"
            </button>
            <button type="button" class="asst-chip" data-prompt="kitne donors in 10 km for O+, compatible bhi dikhao">
              "kitne donors in 10 km for O+, compatible bhi dikhao"
            </button>
            <button type="button" class="asst-chip" data-prompt="What is our current hospital blood stock status?">
              "What is our current hospital blood stock status?"
            </button>
          </div>
        </div>
      `;

      wrap.querySelectorAll('.asst-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt');
          const input = document.getElementById('asstInput');
          if (input) {
            input.value = prompt;
            handleSendMessage();
          }
        });
      });
      return;
    }

    // Render message history
    wrap.innerHTML = chatHistory.map((m, idx) => {
      const isLastAssistant = (m.role === 'assistant' && idx === chatHistory.length - 1);
      const hasDonors = Array.isArray(m.donors) && m.donors.length > 0;
      const formattedContent = escapeHtml(m.content).replace(/\n/g, '<br>');

      return `
        <div class="asst-message ${m.role}">
          <div class="asst-bubble">
            <div>${formattedContent}</div>
            ${hasDonors ? `
              <div class="asst-donors-container">
                ${m.donors.map(d => renderDonorCard(d)).join('')}
              </div>
            ` : ''}
          </div>
          <div class="asst-time">${formatTime(m.time)}</div>
          ${isLastAssistant ? `
            <div class="asst-followup-chips">
              <button type="button" class="asst-followup-chip" data-asst-action="check_20km">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                <span>Check 20 km</span>
              </button>
              <button type="button" class="asst-followup-chip" data-asst-action="view_stock">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>View stock</span>
              </button>
              <button type="button" class="asst-followup-chip" data-asst-action="plan_drive">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Plan donation drive</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    wireFollowupChips(wrap);
    wireDonorActionButtons(wrap);
    wrap.scrollTop = wrap.scrollHeight;
  }

  function wireDonorActionButtons(container) {
    if (!container) return;
    container.querySelectorAll('.asst-btn-send-req:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const donorId = parseInt(btn.getAttribute('data-donor-id'), 10);
        const bloodType = btn.getAttribute('data-blood-type');
        if (!donorId || !bloodType) return;

        btn.disabled = true;
        btn.textContent = 'Sending request...';

        try {
          const res = await fetch('/api/hospital/requests/send-single', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...getAuthHeaders()
            },
            credentials: 'include',
            body: JSON.stringify({
              donorId: donorId,
              bloodType: bloodType,
              unitsNeeded: 1,
              urgency: 'Urgent',
              urgencyLevel: 'Urgent',
              patientName: 'Emergency Patient',
              radius: 10
            })
          });

          const resData = await res.json();
          if (res.ok && resData.success !== false) {
            btn.classList.add('sent');
            const reqId = resData.data && resData.data.requestId ? resData.data.requestId : '';
            btn.innerHTML = `✓ Request Sent${reqId ? ' (Req #' + reqId + ')' : ''}`;

            // Mark in chat history
            chatHistory.forEach(msg => {
              if (msg.donors) {
                msg.donors.forEach(dnr => {
                  if (dnr.id === donorId) dnr.requestStatus = 'Notified';
                });
              }
            });
            saveChatHistory();
          } else {
            btn.disabled = false;
            btn.textContent = (resData && resData.message) ? resData.message : 'Send failed - Retry';
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Error - Retry';
        }
      });
    });
  }

  function wireFollowupChips(container) {
    if (!container) return;
    container.querySelectorAll('.asst-followup-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-asst-action');
        if (action === 'check_20km') {
          const input = document.getElementById('asstInput');
          if (input) {
            input.value = "blood chahiye, kitne donors in 20 km radius, compatible bhi dikhao";
            handleSendMessage();
          }
        } else if (action === 'view_stock') {
          const input = document.getElementById('asstInput');
          if (input) {
            input.value = "What is our current hospital blood stock status?";
            handleSendMessage();
          }
        } else if (action === 'plan_drive') {
          closeChatPanel();
          if (window.location.pathname.includes('hospital-dashboard.html')) {
            if (typeof window.switchTab === 'function') window.switchTab('tab-dashboard');
            const openDriveModal = document.getElementById('btnOpenPlanDriveModal');
            if (openDriveModal) openDriveModal.click();
            else {
              const sec = document.getElementById('sectionDonationDrives');
              if (sec) sec.scrollIntoView({ behavior: 'smooth' });
            }
          } else {
            window.location.href = 'hospital-dashboard.html#tab-dashboard';
          }
        }
      });
    });
  }

  async function handleSendMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSending) return;

    const input = document.getElementById('asstInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    input.value = '';
    const now = new Date().toISOString();

    chatHistory.push({ role: 'user', content: text, time: now });
    saveChatHistory();
    renderMessages();

    // Show typing indicator
    const wrap = document.getElementById('asstMessagesWrap');
    const typingNode = document.createElement('div');
    typingNode.className = 'asst-message assistant';
    typingNode.id = 'asstTypingIndicator';
    typingNode.innerHTML = `
      <div class="asst-typing">
        <div class="asst-dot"></div>
        <div class="asst-dot"></div>
        <div class="asst-dot"></div>
      </div>
    `;
    wrap.appendChild(typingNode);
    wrap.scrollTop = wrap.scrollHeight;

    isSending = true;

    try {
      // Build history payload for server (user & assistant roles only, no PII)
      const payloadHistory = chatHistory.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      }));

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          history: payloadHistory
        })
      });

      const data = await res.json();
      const typingEl = document.getElementById('asstTypingIndicator');
      if (typingEl) typingEl.remove();

      if (data.success && data.data && data.data.reply) {
        chatHistory.push({
          role: 'assistant',
          content: data.data.reply,
          donors: data.data.donors || [],
          time: new Date().toISOString()
        });
      } else {
        const errorMsg = data.message || data.error || 'Failed to get answer from assistant.';
        chatHistory.push({
          role: 'assistant',
          content: errorMsg,
          time: new Date().toISOString()
        });
      }
    } catch (err) {
      const typingEl = document.getElementById('asstTypingIndicator');
      if (typingEl) typingEl.remove();
      chatHistory.push({
        role: 'assistant',
        content: 'Emergency Assistant error. Please retry or contact support.\n\nCounts are estimates. A doctor makes the final decision.',
        time: new Date().toISOString()
      });
    } finally {
      isSending = false;
      saveChatHistory();
      renderMessages();
    }
  }

  function openChatPanel() {
    const panel = document.getElementById('assistantChatPanel');
    const backdrop = document.getElementById('assistantChatBackdrop');
    if (panel) panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    checkAssistantStatus();
    const input = document.getElementById('asstInput');
    if (input && !input.disabled) {
      setTimeout(() => input.focus(), 250);
    }
  }

  function closeChatPanel() {
    const panel = document.getElementById('assistantChatPanel');
    const backdrop = document.getElementById('assistantChatBackdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global controller
  window.Red404Assistant = {
    open: openChatPanel,
    close: closeChatPanel,
    clear: clearChatHistory,
    getStatus: () => ({ configured: isConfigured, historyCount: chatHistory.length })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})();
