/* ============================================================
   RED404 — HOME PAGE JS
============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initParticlesHome();
  initFloatingDropsHome();
  initHeroCounters();
  initStatsCounters();
  initStatBars();
  initScrollRevealHome();
  initHeroMapAnimation();
  initBloodTicker();
  initZoneDiagramAnimation();
  initServicesTabs();
  loadDynamicPlatformStats();
});

/* ==================== PARTICLES ==================== */
function initParticlesHome() {
  const container = document.getElementById('particles');
  if (!container) return;

  for (let i = 0; i < 55; i++) {
    const p        = document.createElement('div');
    p.className    = 'particle';
    const size     = Math.random() * 5 + 2;
    const delay    = Math.random() * 14;
    const duration = Math.random() * 14 + 10;

    p.style.cssText = `
      width:              ${size}px;
      height:             ${size}px;
      left:               ${Math.random() * 100}%;
      bottom:             -${size}px;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
      opacity:            ${Math.random() * 0.2 + 0.05};
    `;
    container.appendChild(p);
  }
}

/* ==================== FLOATING DROPS ==================== */
function initFloatingDropsHome() {
  const container = document.getElementById('floatingDrops');
  if (!container) return;

  for (let i = 0; i < 14; i++) {
    const drop     = document.createElement('div');
    drop.className = 'floating-drop';
    const size     = Math.random() * 1.4 + 0.7;
    const delay    = Math.random() * 18;
    const duration = Math.random() * 14 + 12;

    drop.innerHTML    = '<i class="fas fa-tint"></i>';
    drop.style.cssText = `
      left:               ${Math.random() * 100}%;
      font-size:          ${size}rem;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
    `;
    container.appendChild(drop);
  }
}

/* ==================== HERO COUNTERS ==================== */
function initHeroCounters() {
  const counters = document.querySelectorAll('.hero-stats-bar .stat-num');
  if (!counters.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateHeroCounter(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.8 });

  counters.forEach(c => io.observe(c));
}

function animateHeroCounter(el) {
  const target   = parseInt(el.dataset.target, 10);
  if (isNaN(target)) return;

  const duration = 2200;
  const steps    = 60;
  const stepVal  = target / steps;
  let   current  = 0;

  const timer = setInterval(() => {
    current = Math.min(current + stepVal, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current >= target) clearInterval(timer);
  }, duration / steps);
}

/* ==================== STATS SECTION COUNTERS ==================== */
function initStatsCounters() {
  const counters = document.querySelectorAll('.stats-section .stat-count');
  if (!counters.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateHeroCounter(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => io.observe(c));
}

/* ==================== STAT BARS ==================== */
function initStatBars() {
  const bars = document.querySelectorAll('.bar-fill');
  if (!bars.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el          = entry.target;
        const targetWidth = el.style.width;
        el.style.width    = '0%';
        requestAnimationFrame(() => {
          setTimeout(() => {
            el.style.transition = 'width 1.5s ease';
            el.style.width      = targetWidth;
          }, 150);
        });
        io.unobserve(el);
      }
    });
  }, { threshold: 0.4 });

  bars.forEach(b => io.observe(b));
}

/* ==================== SCROLL REVEAL ==================== */
function initScrollRevealHome() {
  const targets = document.querySelectorAll(
    '.about-card, .stat-card, .cta-content'
  );

  targets.forEach((el, idx) => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.65s ease, transform 0.65s ease`;
    el.style.transitionDelay = `${(el.dataset.delay || (idx % 4) * 100)}ms`;
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  targets.forEach(el => io.observe(el));
}

/* ==================== HERO MAP ANIMATION ==================== */
function initHeroMapAnimation() {
  /* Animate donor nodes appearing */
  document.querySelectorAll('.donor-node').forEach((node, idx) => {
    node.style.opacity   = '0';
    node.style.transform = 'translate(-50%,-50%) scale(0)';
    setTimeout(() => {
      node.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
      node.style.opacity    = '1';
      node.style.transform  = 'translate(-50%,-50%) scale(1)';
    }, 800 + idx * 200);
  });

  /* Animate connection lines */
  document.querySelectorAll('.conn-line').forEach((line, idx) => {
    line.style.opacity = '0';
    setTimeout(() => {
      line.style.transition = 'opacity 0.5s ease';
      line.style.opacity    = '0.35';
    }, 1500 + idx * 150);
  });
}

/* ==================== BLOOD TICKER ==================== */
function initBloodTicker() {
  const ticker = document.querySelector('.ticker-content');
  if (!ticker) return;

  /* Pause on hover */
  ticker.addEventListener('mouseenter', () => {
    ticker.style.animationPlayState = 'paused';
  });
  ticker.addEventListener('mouseleave', () => {
    ticker.style.animationPlayState = 'running';
  });
}

/* ==================== ZONE DIAGRAM ANIMATION ==================== */
function initZoneDiagramAnimation() {
  const zoneSection = document.querySelector('.zones-section');
  if (!zoneSection) return;
  const rings = document.querySelectorAll('.zd-ring');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        rings.forEach((ring, idx) => {
          ring.style.opacity   = '0';
          ring.style.transform = 'translate(-50%,-50%) scale(0.5)';
          setTimeout(() => {
            ring.style.transition = 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)';
            ring.style.opacity    = '1';
            ring.style.transform  = 'translate(-50%,-50%) scale(1)';
          }, idx * 200);
        });

        /* Animate donor dots */
        document.querySelectorAll('.zd-donor').forEach((dot, idx) => {
          dot.style.opacity   = '0';
          dot.style.transform = 'translate(-50%,-50%) scale(0)';
          setTimeout(() => {
            dot.style.transition = 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)';
            dot.style.opacity    = '1';
            dot.style.transform  = 'translate(-50%,-50%) scale(1)';
          }, 600 + idx * 120);
        });

        io.disconnect();
      }
    });
  }, { threshold: 0.3 });

  io.observe(zoneSection);
}

/* ==================== OUR SERVICES TABS & ACCORDION ==================== */
function initServicesTabs() {
  const tabCards = document.querySelectorAll('.service-tab-card');
  const panes = document.querySelectorAll('.service-pane');

  // Desktop Tabs Handler
  if (tabCards.length && panes.length) {
    tabCards.forEach(card => {
      card.addEventListener('click', () => {
        const targetId = card.getAttribute('data-tab');
        if (!targetId) return;

        // Update Tab Cards active state
        tabCards.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
        });
        card.classList.add('active');
        card.setAttribute('aria-selected', 'true');

        // INSTANT Pane Switch (Zero delay to avoid millisecond dual-stacked layout glitch)
        panes.forEach(pane => {
          if (pane.id === targetId) {
            pane.style.display = 'block';
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
            pane.style.display = 'none';
          }
        });
      });
    });
  }

  // Mobile Accordion Handler
  const accCards = document.querySelectorAll('.service-acc-card');
  accCards.forEach(card => {
    const header = card.querySelector('.service-acc-header');
    if (!header) return;

    header.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');

      // Close all other accordion items
      accCards.forEach(c => {
        if (c !== card) {
          c.classList.remove('open');
          const otherIcon = c.querySelector('.sah-icon');
          if (otherIcon) otherIcon.className = 'fas fa-plus sah-icon';
          const otherBtn = c.querySelector('.service-acc-header');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current item
      if (isOpen) {
        card.classList.remove('open');
        const icon = card.querySelector('.sah-icon');
        if (icon) icon.className = 'fas fa-plus sah-icon';
        header.setAttribute('aria-expanded', 'false');
      } else {
        card.classList.add('open');
        const icon = card.querySelector('.sah-icon');
        if (icon) icon.className = 'fas fa-minus sah-icon';
        header.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Campaign explore button toast handler
  const btnCampaigns = document.querySelectorAll('.btn-explore-campaigns-action, #btnExploreCampaigns');
  btnCampaigns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof showToast === 'function') {
        showToast('Upcoming donation drive listings will open for your district shortly!', 'info', 3500);
      } else {
        alert('Upcoming voluntary blood donation drives will be announced for your city soon.');
      }
    });
  });
}

/* ==================== DYNAMIC DATABASE PLATFORM STATS ==================== */
async function loadDynamicPlatformStats() {
  try {
    let res = await fetch('/api/system/stats');
    if (!res.ok) res = await fetch('/api/stats');
    if (!res.ok) res = await fetch('/api/donors/platform-stats');
    if (!res.ok) return;

    const json = await res.json();
    if (!json || !json.data) return;

    const data = json.data;
    const regDonors = data.registeredDonors ?? data.totalDonors ?? 0;
    const activeDonors = data.activeDonors ?? regDonors;
    const hospitals = data.partnerHospitals ?? data.hospitals ?? 0;
    const lives = data.livesSaved ?? 0;
    const zones = data.activeZones ?? (regDonors > 0 || hospitals > 0 ? 1 : 0);
    const avgResp = data.avgResponseMin ?? 8;
    const successRate = data.successRate ?? 98;

    // Update Hero elements data-target
    const heroD = document.getElementById('heroActiveDonors');
    if (heroD) heroD.dataset.target = activeDonors;
    const heroH = document.getElementById('heroHospitals');
    if (heroH) heroH.dataset.target = hospitals;
    const heroL = document.getElementById('heroLivesSaved');
    if (heroL) heroL.dataset.target = lives;
    const heroZ = document.getElementById('heroZonesActive');
    if (heroZ) heroZ.dataset.target = zones;

    // Update Stats Section elements data-target
    const sReg = document.getElementById('statRegDonors');
    if (sReg) sReg.dataset.target = regDonors;
    const sHosp = document.getElementById('statHospitals');
    if (sHosp) sHosp.dataset.target = hospitals;
    const sLives = document.getElementById('statLivesSaved');
    if (sLives) sLives.dataset.target = lives;
    const sResp = document.getElementById('statAvgResponse');
    if (sResp) sResp.dataset.target = avgResp;
    const sZones = document.getElementById('statActiveZones');
    if (sZones) sZones.dataset.target = zones;
    const sRate = document.getElementById('statSuccessRate');
    if (sRate) sRate.dataset.target = successRate;

    // Update Progress Bars based on real metrics
    const bReg = document.getElementById('barRegDonors');
    if (bReg) bReg.style.width = Math.min(100, Math.max(10, regDonors * 10)) + '%';
    const bHosp = document.getElementById('barHospitals');
    if (bHosp) bHosp.style.width = Math.min(100, Math.max(10, hospitals * 20)) + '%';
    const bLives = document.getElementById('barLivesSaved');
    if (bLives) bLives.style.width = Math.min(100, Math.max(10, lives * 10)) + '%';
    const bResp = document.getElementById('barAvgResponse');
    if (bResp) bResp.style.width = Math.min(100, Math.max(25, 100 - avgResp * 5)) + '%';
    const bZones = document.getElementById('barActiveZones');
    if (bZones) bZones.style.width = Math.min(100, Math.max(10, zones * 25)) + '%';
    const bRate = document.getElementById('barSuccessRate');
    if (bRate) bRate.style.width = Math.min(100, successRate) + '%';

    // Animate counters with real database figures
    document.querySelectorAll('.hero-stats-bar .stat-num, .stats-section .stat-count').forEach(el => {
      animateHeroCounter(el);
    });
  } catch (err) {
    console.warn('Could not load dynamic platform stats:', err);
  }
}
