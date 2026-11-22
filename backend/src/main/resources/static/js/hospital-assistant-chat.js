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

  async function checkAssistantStatus() {
    try {
      const resp = await fetch('/api/assistant/status', {
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const json = await resp.json();
        isConfigured = !!(json.data && json.data.configured);
      } else {
        isConfigured = false;
      }
    } catch (e) {
      isConfigured = false;
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

    if (isConfigured) {
      dot.className = 'asst-status-dot';
      label.textContent = 'Online • Read-Only';
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
    } else {
      dot.className = 'asst-status-dot disabled';
      label.textContent = 'Disabled (Quick Check Active)';
      if (input) input.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
    }

    renderMessages();
  }

  function renderMessages() {
    const wrap = document.getElementById('asstMessagesWrap');
    if (!wrap) return;

    // Fallback when ANTHROPIC_API_KEY is not set
    if (!isConfigured) {
      wrap.innerHTML = `
        <div class="asst-disabled-banner">
          <div class="asst-disabled-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
          </div>
          <h4>AI chat is not configured</h4>
          <p>Use the Quick Check panel on your dashboard for instant availability answers.</p>
          <button type="button" class="asst-btn-open-qc" id="btnAsstOpenQC">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
            <span>Open Quick Check</span>
          </button>
        </div>
      `;

      const qcBtn = document.getElementById('btnAsstOpenQC');
      if (qcBtn) {
        qcBtn.addEventListener('click', () => {
          closeChatPanel();
          if (window.Red404QuickCheck && typeof window.Red404QuickCheck.openDrawer === 'function') {
            window.Red404QuickCheck.openDrawer();
          } else {
            const dBtn = document.getElementById('btnQuickCheckDrawerTrigger');
            if (dBtn) dBtn.click();
          }
        });
      }
      return;
    }

    // Configured: Show message history or starter chips
    if (chatHistory.length === 0) {
      wrap.innerHTML = `
        <div style="text-align: center; color: var(--asst-text-muted); font-size: 13px; margin-top: 20px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" style="margin-bottom: 8px;">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Urgent Blood Assistant</div>
          <div>Ask questions like "blood chahiye, kitne donors in this radius, compatible bhi dikhao"</div>
        </div>

        <div class="asst-suggestions">
          <div class="asst-suggestions-title">Quick prompts</div>
          <div class="asst-chips-grid">
            <button type="button" class="asst-chip" data-prompt="blood chahiye, kitne donors in 10 km for O+, compatible bhi dikhao">
              "blood chahiye, kitne donors in 10 km for O+, compatible bhi dikhao"
            </button>
            <button type="button" class="asst-chip" data-prompt="Current hospital blood stock status">
              "What is our current hospital blood stock status?"
            </button>
            <button type="button" class="asst-chip" data-prompt="Active emergency blood requests summary">
              "Show our active emergency blood requests"
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
      return `
        <div class="asst-message ${m.role}">
          <div class="asst-bubble">${escapeHtml(m.content)}</div>
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
              <button type="button" class="asst-followup-chip" data-asst-action="open_find_donors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>Open in Find Donors</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Wire follow-up suggestion chips
    wrap.querySelectorAll('.asst-followup-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-asst-action');
        if (action === 'check_20km') {
          if (isConfigured) {
            const input = document.getElementById('asstInput');
            if (input) {
              input.value = "blood chahiye, kitne donors in 20 km radius, compatible bhi dikhao";
              handleSendMessage();
            }
          } else {
            closeChatPanel();
            if (window.Red404QuickCheck) {
              window.Red404QuickCheck.openDrawer();
            }
          }
        } else if (action === 'view_stock') {
          if (isConfigured) {
            const input = document.getElementById('asstInput');
            if (input) {
              input.value = "What is our current hospital blood stock status?";
              handleSendMessage();
            }
          } else {
            closeChatPanel();
            if (window.location.pathname.includes('hospital-dashboard.html')) {
              if (typeof window.switchTab === 'function') window.switchTab('tab-stock');
            } else {
              window.location.href = 'hospital-dashboard.html#tab-stock';
            }
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
        } else if (action === 'open_find_donors') {
          closeChatPanel();
          if (window.location.pathname.includes('hospital-dashboard.html')) {
            if (typeof window.switchTab === 'function') window.switchTab('tab-dispatch');
          } else {
            window.location.href = 'hospital-dashboard.html#tab-dispatch';
          }
        }
      });
    });

    wrap.scrollTop = wrap.scrollHeight;
  }

  async function handleSendMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSending || !isConfigured) return;

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
          'Accept': 'application/json'
        },
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
        content: 'Assistant unavailable. Use the Quick Check panel on your dashboard for instant availability answers.',
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
