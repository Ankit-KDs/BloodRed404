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
    '.about-card, .step-item, .stat-card, .zone-info-card, .cta-content'
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

  const zoneSection = document.querySelector('.zones-section');
  if (zoneSection) io.observe(zoneSection);
}

/* ==================== OUR SERVICES TABS ==================== */
function initServicesTabs() {
  const tabCards = document.querySelectorAll('.service-tab-card');
  const panes = document.querySelectorAll('.service-pane');
  if (!tabCards.length || !panes.length) return;

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

      // Update Panes with smooth fade transition
      panes.forEach(pane => {
        if (pane.id === targetId) {
          pane.style.display = 'block';
          requestAnimationFrame(() => {
            pane.classList.add('active');
          });
        } else {
          pane.classList.remove('active');
          setTimeout(() => {
            if (!pane.classList.contains('active')) {
              pane.style.display = 'none';
            }
          }, 200);
        }
      });
    });
  });

  // Campaign explore button toast handler
  const btnCampaigns = document.getElementById('btnExploreCampaigns');
  if (btnCampaigns) {
    btnCampaigns.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof showToast === 'function') {
        showToast('Upcoming donation drive listings will open for your district shortly!', 'info', 3500);
      } else {
        alert('Upcoming voluntary blood donation drives will be announced for your city soon.');
      }
    });
  }
}
