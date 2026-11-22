/**
 * hospital-assistant-chat.js
 * RED404 Hospital Portal AI Assistant Agent.
 *
 * SPECIFICATION:
 * 1. UI: "Ask assistant" button on all hospital pages opening a side panel (full screen on phones).
 * 2. Chat history lives in browser tab only (sessionStorage); "Clear chat" button; nothing stored on server.
 * 3. Server: POST /api/assistant. Uses Groq / Gemini with real tool calling against live MySQL data.
 * 4. Honest status: Displays "AI Key Not Configured" if neither GROQ_API_KEY nor GEMINI_API_KEY is configured.
 * 5. Direct Donor Request Dispatch: Render interactive donor cards with "⚡ Send Request" button.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'red404_assistant_chat_tab';
  let isConfigured = false;
  let activeModelInfo = '';
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
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.data) {
          isConfigured = !!json.data.configured;
          activeModelInfo = json.data.model || '';
        } else {
          isConfigured = false;
          activeModelInfo = '';
        }
      } else {
        isConfigured = false;
        activeModelInfo = '';
      }
    } catch (e) {
      isConfigured = false;
      activeModelInfo = '';
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
          <input type="text" id="asstInput" class="asst-input" placeholder="Ask about nearby donors, blood stock, active requests..." autocomplete="off" />
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

    if (isConfigured) {
      dot.className = 'asst-status-dot online';
      label.textContent = activeModelInfo ? `Online • ${activeModelInfo}` : 'Online • Emergency Ready';
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    } else {
      dot.className = 'asst-status-dot unconfigured';
      label.textContent = 'AI Key Not Configured';
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    }

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

    // Show starter suggestions or unconfigured banner if chat history is empty
    if (chatHistory.length === 0) {
      if (!isConfigured) {
        wrap.innerHTML = `
          <div class="asst-disabled-banner">
            <div class="asst-disabled-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h4 style="color: #fff; margin: 10px 0 4px; font-size: 14px;">AI Key Not Configured</h4>
            <p style="color: var(--asst-text-muted); font-size: 12.5px; margin: 0 0 14px; line-height: 1.5;">Configure <code>GROQ_API_KEY</code> or <code>GEMINI_API_KEY</code> in server environment variables to enable the AI Assistant agent.</p>
          </div>
        `;
        return;
      }

      wrap.innerHTML = `
        <div style="text-align: center; color: var(--asst-text-muted); font-size: 13px; margin-top: 20px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" style="margin-bottom: 8px;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Emergency Blood AI Agent</div>
          <div>Live tool-calling agent across donors, stock, requests & check-ins. Ask below:</div>
        </div>

        <div class="asst-suggestions">
          <div class="asst-suggestions-title">Quick prompts</div>
          <div class="asst-chips-grid">
            <button type="button" class="asst-chip" data-prompt="aas paas ke sare donors dikhao jo 5 km ke radius me hai">
              "aas paas ke sare donors dikhao jo 5 km ke radius me hai"
            </button>
            <button type="button" class="asst-chip" data-prompt="O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao">
              "O+ urgent chahiye 10 km me, jaldi accept karne wale dikhao"
            </button>
            <button type="button" class="asst-chip" data-prompt="hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?">
              "hamare hospital me kaunse blood group critical ya low hai aur koi bag expire ho raha hai kya?"
            </button>
            <button type="button" class="asst-chip" data-prompt="aaj kitne active requests aur check-ins hai?">
              "aaj kitne active requests aur check-ins hai?"
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
      const followUps = Array.isArray(m.quickFollowUps) && m.quickFollowUps.length > 0 ? m.quickFollowUps : [];
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
          ${(isLastAssistant && followUps.length > 0) ? `
            <div class="asst-followup-chips">
              ${followUps.map(f => `
                <button type="button" class="asst-followup-chip" data-prompt="${escapeHtml(f)}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                  <span>${escapeHtml(f)}</span>
                </button>
              `).join('')}
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
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          const input = document.getElementById('asstInput');
          if (input) {
            input.value = prompt;
            handleSendMessage();
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
      // Build history payload for server (last 10 messages, user & assistant roles only, zero PII)
      const payloadHistory = chatHistory.slice(-10).map(h => ({
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
          stock: data.data.stock || null,
          requests: data.data.requests || null,
          quickFollowUps: data.data.quickFollowUps || [],
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
    getStatus: () => ({ configured: isConfigured, model: activeModelInfo, historyCount: chatHistory.length })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})();
