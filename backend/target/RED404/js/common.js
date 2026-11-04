/* ============================================================
   RED404 — COMMON JS
   Shared utilities, navbar, particles, animations
============================================================ */

'use strict';

/* ==================== NAVBAR ==================== */
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

/* Scroll effect */
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

/* Hamburger */
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  /* Close on link click */
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
}

/* Active nav link on scroll */
const sections = document.querySelectorAll('section[id]');
if (sections.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
}

/* ==================== PARTICLES ==================== */
function initParticles(containerId = 'particles', count = 50) {
  const container = document.getElementById(containerId);
  if (!container) return;

  for (let i = 0; i < count; i++) {
    const p    = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 2;
    const delay    = Math.random() * 10;
    const duration = Math.random() * 12 + 8;

    p.style.cssText = `
      width:             ${size}px;
      height:            ${size}px;
      left:              ${Math.random() * 100}%;
      top:               ${Math.random() * 100}%;
      animation-delay:   ${delay}s;
      animation-duration:${duration}s;
      opacity:           ${Math.random() * 0.35 + 0.05};
    `;
    container.appendChild(p);
  }
}

/* ==================== FLOATING BLOOD DROPS ==================== */
function initFloatingDrops(containerId = 'floatingDrops', count = 15) {
    //HERE IS THE NEW
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const drop      = document.createElement('div');
    drop.className  = 'floating-drop';
    const size      = Math.random() * 1.5 + 0.8;
    const left      = Math.random() * 100;
    const delay     = Math.random() * 15;
    const duration  = Math.random() * 15 + 12;

    drop.innerHTML  = '<i class="fas fa-tint"></i>';
    drop.style.cssText = `
      left:               ${left}%;
      font-size:          ${size}rem;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
    `;
    container.appendChild(drop);
  }
}
//TO THE HERE

'use strict';

/* ==================== DOM READY ==================== */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initParticles('particles', 50);
  initFloatingDrops('floatingDrops', 12);
  initScrollReveal();
  initCounterAnimations();
  initStatBarAnimations();
  initTooltips();
  initSmoothScroll();
});

/* ==================== NAVBAR ==================== */
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  if (!navbar) return;

  /* Scroll effect */
  const handleScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); /* Run once on load */

  /* Hamburger toggle */
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      navLinks.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    /* Close on nav link click */
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    /* Close on outside click */
    document.addEventListener('click', e => {
      if (!navbar.contains(e.target)) {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* Active nav link on scroll using IntersectionObserver */
  const sections = document.querySelectorAll('section[id]');
  if (sections.length) {
    const sectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            const activeLink = document.querySelector(
              `.nav-link[href="#${entry.target.id}"]`
            );
            if (activeLink) activeLink.classList.add('active');
          }
        });
      },
      { threshold: 0.45, rootMargin: '-80px 0px 0px 0px' }
    );
    sections.forEach(s => sectionObserver.observe(s));
  }
}

/* ==================== PARTICLES ==================== */
function initParticles(containerId = 'particles', count = 50) {
  const container = document.getElementById(containerId);
  if (!container) return;

  /* Clear existing */
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const p        = document.createElement('div');
    p.className    = 'particle';
    const size     = Math.random() * 5 + 2;
    const delay    = Math.random() * 12;
    const duration = Math.random() * 14 + 8;
    const left     = Math.random() * 100;

    p.style.cssText = `
      width:              ${size}px;
      height:             ${size}px;
      left:               ${left}%;
      bottom:             -${size}px;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
      opacity:            ${Math.random() * 0.3 + 0.05};
    `;
    container.appendChild(p);
  }
}

/* ==================== FLOATING BLOOD DROPS ==================== */
function initFloatingDrops(containerId = 'floatingDrops', count = 12) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const drop      = document.createElement('div');
    drop.className  = 'floating-drop';
    const size      = Math.random() * 1.5 + 0.8;
    const left      = Math.random() * 100;
    const delay     = Math.random() * 15;
    const duration  = Math.random() * 15 + 12;

    drop.innerHTML  = '<i class="fas fa-tint"></i>';
    drop.style.cssText = `
      left:               ${left}%;
      font-size:          ${size}rem;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
    `;
    container.appendChild(drop);
  }
}

/* ==================== SCROLL REVEAL ==================== */
function initScrollReveal() {
  const elements = document.querySelectorAll(
    '.about-card, .step-item, .stat-card, .dsa-card, ' +
    '.zone-info-card, .dash-stat-card, .hosp-stat-card'
  );

  if (!elements.length) return;

  /* Add reveal class */
  elements.forEach((el, idx) => {
    el.classList.add('reveal');
    /* Stagger delay based on data-delay attribute or index */
    const delay = el.dataset.delay || (idx % 4) * 100;
    el.style.transitionDelay = `${delay}ms`;
  });

  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  elements.forEach(el => revealObserver.observe(el));
}

/* ==================== COUNTER ANIMATIONS ==================== */
function initCounterAnimations() {
  const counters = document.querySelectorAll('[data-target]');
  if (!counters.length) return;

  const counterObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(c => counterObserver.observe(c));
}

function animateCounter(el) {
  const target   = parseInt(el.dataset.target, 10);
  const duration = 2000;
  const step     = 16;
  const steps    = duration / step;
  const increment = target / steps;
  let   current  = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current).toLocaleString();
  }, step);
}

/* ==================== STAT BAR ANIMATIONS ==================== */
function initStatBarAnimations() {
  const bars = document.querySelectorAll('.bar-fill, .inv-level-fill, .rr-progress-fill');
  if (!bars.length) return;

  const barObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          /* Trigger CSS transition by reading computed width from style */
          const el = entry.target;
          const targetWidth = el.style.width;
          el.style.width = '0%';
          requestAnimationFrame(() => {
            setTimeout(() => {
              el.style.width = targetWidth;
            }, 100);
          });
          barObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.3 }
  );

  bars.forEach(b => barObserver.observe(b));
}

/* ==================== SMOOTH SCROLL ==================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navbarHeight = document.getElementById('navbar')?.offsetHeight || 80;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  });
}

/* ==================== TOOLTIPS ==================== */
function initTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    const tip = document.createElement('div');
    tip.className   = 'tooltip-text';
    tip.textContent = el.dataset.tooltip;

    if (!el.classList.contains('tooltip-wrap')) {
      el.classList.add('tooltip-wrap');
    }
    el.appendChild(tip);
  });
}

/* ==================== TOAST NOTIFICATIONS ==================== */
function showToast(message, type = 'info', duration = 3500) {
  const icons = {
    success: 'fa-check-circle',
    error:   'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle',
  };

  const toast       = document.createElement('div');
  toast.className   = `toast toast-${type}`;
  toast.innerHTML   = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;

  document.body.appendChild(toast);

  /* Trigger transition */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  /* Auto remove */
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);

  return toast;
}

/* ==================== MODAL HELPERS ==================== */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('modal-visible'));
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('modal-visible');
  document.body.style.overflow = '';
  setTimeout(() => { modal.style.display = 'none'; }, 300);
}

/* Close modal on backdrop click */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal(e.target.id);
  }
});

/* Close modal on Escape key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay[style*="flex"]').forEach(m => {
      closeModal(m.id);
    });
  }
});

/* ==================== PASSWORD TOGGLE ==================== */
function togglePassword(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type    = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type    = 'password';
    icon.className = 'fas fa-eye';
  }
}

/* ==================== GEOLOCATION ==================== */
function detectLocation(options = {}) {
  const {
    onStart    = () => {},
    onSuccess  = () => {},
    onError    = () => {},
    reverseGeocode = true,
  } = options;

  if (!navigator.geolocation) {
    onError('Geolocation is not supported by your browser.');
    return;
  }

  onStart();

  navigator.geolocation.getCurrentPosition(
    async position => {
      const { latitude: lat, longitude: lng } = position.coords;
      const coords = { lat: lat.toFixed(6), lng: lng.toFixed(6) };

      if (!reverseGeocode) {
        onSuccess(coords);
        return;
      }

      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        );
        const data = await res.json();
        const addr = data.address || {};

        onSuccess({
          ...coords,
          displayName: data.display_name || '',
          road:        addr.road || '',
          neighbourhood: addr.neighbourhood || addr.suburb || '',
          city:        addr.city || addr.town || addr.village || '',
          state:       addr.state || '',
          postcode:    addr.postcode || '',
          country:     addr.country || '',
        });
      } catch {
        /* Reverse geocode failed — still return coords */
        onSuccess(coords);
      }
    },
    err => {
      const messages = {
        1: 'Location access denied. Please allow location permission.',
        2: 'Location unavailable. Please try again.',
        3: 'Location request timed out. Please try again.',
      };
      onError(messages[err.code] || 'Unknown location error.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

/* ==================== HAVERSINE DISTANCE ==================== */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const toRad = d => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLon  = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ==================== ZONE CALCULATOR ==================== */
function getZone(distanceKm) {
  if (distanceKm <= 5)  return { zone: 1, label: 'Zone 1 (0–5 km)',   color: '#e63946' };
  if (distanceKm <= 10) return { zone: 2, label: 'Zone 2 (5–10 km)',  color: '#ff8800' };
  if (distanceKm <= 20) return { zone: 3, label: 'Zone 3 (10–20 km)', color: '#4285f4' };
  return                       { zone: 4, label: 'Zone 4 (20+ km)',    color: '#9898b8' };
}

/* ==================== DIJKSTRA'S ALGORITHM ==================== */
/**
 * Dijkstra's shortest path algorithm.
 * @param {Object} graph - Adjacency list: { node: [[neighbour, weight], ...] }
 * @param {string} start - Start node key
 * @param {string} end   - End node key
 * @returns {{ distance: number, path: string[] }}
 */
function dijkstra(graph, start, end) {
  const dist    = {};
  const prev    = {};
  const visited = new Set();
  const nodes   = Object.keys(graph);

  /* Initialize */
  nodes.forEach(n => { dist[n] = Infinity; prev[n] = null; });
  dist[start] = 0;

  /* Simple min-priority queue using array (suitable for small graphs) */
  const pq = [{ node: start, cost: 0 }];

  while (pq.length) {
    /* Extract minimum */
    pq.sort((a, b) => a.cost - b.cost);
    const { node: u } = pq.shift();

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === end) break;

    (graph[u] || []).forEach(([v, weight]) => {
      if (visited.has(v)) return;
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        pq.push({ node: v, cost: alt });
      }
    });
  }

  /* Reconstruct path */
  const path = [];
  let   curr = end;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev[curr];
  }

  return {
    distance: dist[end] === Infinity ? -1 : dist[end],
    path:     dist[end] === Infinity ? [] : path,
  };
}

/* ==================== PRIORITY QUEUE (Min-Heap) ==================== */
class MinHeap {
  constructor(compareFn = (a, b) => a.priority - b.priority) {
    this.heap      = [];
    this.compareFn = compareFn;
  }

  get size() { return this.heap.length; }
  isEmpty()  { return this.size === 0; }

  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.size - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const top  = this.heap[0];
    const last = this.heap.pop();
    if (this.size > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() { return this.heap[0] || null; }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compareFn(this.heap[idx], this.heap[parent]) < 0) {
        [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
        idx = parent;
      } else break;
    }
  }

  _sinkDown(idx) {
    const n = this.size;
    while (true) {
      let smallest = idx;
      const l = 2 * idx + 1;
      const r = 2 * idx + 2;
      if (l < n && this.compareFn(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compareFn(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest !== idx) {
        [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
        idx = smallest;
      } else break;
    }
  }
}

/* ==================== DONOR QUEUE (DSA) ==================== */
class DonorQueue {
  constructor() { this._queue = []; }

  enqueue(donor) {
    this._queue.push({ ...donor, enqueuedAt: Date.now() });
  }

  dequeue()     { return this._queue.shift() || null; }
  peek()        { return this._queue[0]       || null; }
  get size()    { return this._queue.length; }
  isEmpty()     { return this._queue.length === 0; }
  toArray()     { return [...this._queue]; }

  /* Search by blood type */
  findByBloodType(type) {
    return this._queue.filter(d => d.bloodType === type);
  }

  /* Binary search by donor ID (assumes sorted by id) */
  binarySearchById(id) {
    let lo = 0, hi = this._queue.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this._queue[mid].id === id)       return this._queue[mid];
      if (this._queue[mid].id < id)         lo = mid + 1;
      else                                  hi = mid - 1;
    }
    return null;
  }
}

/* ==================== REQUEST HISTORY STACK (DSA) ==================== */
class RequestStack {
  constructor(maxSize = 50) {
    this._stack   = [];
    this._maxSize = maxSize;
  }

  push(request) {
    if (this._stack.length >= this._maxSize) this._stack.shift();
    this._stack.push({ ...request, timestamp: Date.now() });
  }

  pop()      { return this._stack.pop()  || null; }
  peek()     { return this._stack[this._stack.length - 1] || null; }
  get size() { return this._stack.length; }
  isEmpty()  { return this._stack.length === 0; }
  toArray()  { return [...this._stack].reverse(); }
  clear()    { this._stack = []; }
}

/* ==================== ZONE BFS SEARCH ==================== */
/**
 * BFS zone-by-zone donor search.
 * @param {Array}  donors       - Array of donor objects with { lat, lng, bloodType, available }
 * @param {number} hospitalLat  - Hospital latitude
 * @param {number} hospitalLng  - Hospital longitude
 * @param {string} bloodType    - Required blood type (e.g. 'O+')
 * @param {number[]} zoneRadii  - Zone radii in km, e.g. [5, 10, 20]
 * @returns {Array} Sorted array of matching donors per zone
 */
function bfsZoneSearch(donors, hospitalLat, hospitalLng, bloodType, zoneRadii = [5, 10, 20]) {
  const results = [];
  const used    = new Set();

  for (const radius of zoneRadii) {
    const zoneDonors = donors.filter(donor => {
      if (used.has(donor.id)) return false;
      if (donor.bloodType !== bloodType && !isCompatible(bloodType, donor.bloodType)) return false;
      if (!donor.available) return false;
      const dist = haversineKm(hospitalLat, hospitalLng, donor.lat, donor.lng);
      return dist <= radius;
    });

    /* Sort by distance */
    zoneDonors.sort((a, b) => {
      const da = haversineKm(hospitalLat, hospitalLng, a.lat, a.lng);
      const db = haversineKm(hospitalLat, hospitalLng, b.lat, b.lng);
      return da - db;
    });

    zoneDonors.forEach(d => used.add(d.id));
    if (zoneDonors.length) results.push({ zone: zoneRadii.indexOf(radius) + 1, radius, donors: zoneDonors });
    if (results.length && results[0].donors.length >= 3) break; /* Enough donors found */
  }

  return results;
}

/* Blood type compatibility */
function isCompatible(required, donorType) {
  const compatibility = {
    'A+':  ['A+', 'A-', 'O+', 'O-'],
    'A-':  ['A-', 'O-'],
    'B+':  ['B+', 'B-', 'O+', 'O-'],
    'B-':  ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+':  ['O+', 'O-'],
    'O-':  ['O-'],
  };
  return (compatibility[required] || []).includes(donorType);
}

/* ==================== FORM VALIDATION HELPERS ==================== */
const Validate = {
  required: (val) => val.trim().length > 0,
  email:    (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
  phone:    (val) => /^\d{10}$/.test(val.replace(/[\s\-()]/g, '')),
  pincode:  (val) => /^\d{6}$/.test(val.trim()),
  password: (val) => val.length >= 8,
  match:    (a, b) => a === b,
  minAge:   (dob, minYears = 18) => {
    const today = new Date();
    const birth = new Date(dob);
    const age   = today.getFullYear() - birth.getFullYear();
    const m     = today.getMonth() - birth.getMonth();
    return age > minYears || (age === minYears && m >= 0);
  },
  minWeight: (val, min = 45) => parseFloat(val) >= min,
};

function showFieldError(errorId, message) {
  const el = document.getElementById(errorId);
  if (el) {
    el.textContent = message;
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
  }
}

function clearFieldError(errorId) {
  const el = document.getElementById(errorId);
  if (el) el.textContent = '';
}

function clearAllErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
}

function shakeInput(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('shake');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => inputEl.classList.add('shake'));
  });
  setTimeout(() => inputEl.classList.remove('shake'), 600);
}

/* ==================== LOCAL STORAGE HELPERS ==================== */
const Store = {
  set(key, value) {
    try {
      localStorage.setItem(`red404_${key}`, JSON.stringify(value));
    } catch { /* Storage full or unavailable */ }
  },

  get(key, fallback = null) {
    try {
      const item = localStorage.getItem(`red404_${key}`);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  remove(key) {
    localStorage.removeItem(`red404_${key}`);
  },

  clear() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('red404_'))
      .forEach(k => localStorage.removeItem(k));
  },
};

/* ==================== SESSION / AUTH HELPERS ==================== */
const Auth = {
  saveSession(user) {
    Store.set('session', { user, loginTime: Date.now() });
  },

  getSession() {
    const session = Store.get('session');
    if (!session) return null;
    /* Auto-expire after 24 hours */
    const hoursElapsed = (Date.now() - session.loginTime) / 3600000;
    if (hoursElapsed > 24) {
      this.clearSession();
      return null;
    }
    return session.user;
  },

  clearSession() {
    Store.remove('session');
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  redirectIfNotLoggedIn(redirectUrl = 'donor-login.html') {
    if (!this.isLoggedIn()) {
      window.location.href = redirectUrl;
    }
  },

  redirectIfLoggedIn(redirectUrl = 'donor-dashboard.html') {
    if (this.isLoggedIn()) {
      window.location.href = redirectUrl;
    }
  },
};

/* ==================== API HELPER ==================== */
const API = {
  baseUrl: 'http://localhost:8080/RED404/api',

  async request(endpoint, options = {}) {
    const session = Auth.getSession();
    const headers = {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    };

    try {
      const res  = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  get(endpoint)         { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body)  { return this.request(endpoint, { method: 'POST',  body: JSON.stringify(body) }); },
  put(endpoint, body)   { return this.request(endpoint, { method: 'PUT',   body: JSON.stringify(body) }); },
  delete(endpoint)      { return this.request(endpoint, { method: 'DELETE' }); },
};

/* ==================== DATE / TIME HELPERS ==================== */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dateStr) {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 60)  return 'Just now';
  if (minutes < 60)  return `${minutes}m ago`;
  if (hours   < 24)  return `${hours}h ago`;
  if (days    < 7)   return `${days}d ago`;
  return formatDate(dateStr);
}

function secondsToMMSS(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ==================== COUNTDOWN TIMER ==================== */
function startCountdown(seconds, onTick, onComplete) {
  let remaining = seconds;

  onTick(remaining);

  const timer = setInterval(() => {
    remaining -= 1;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(timer);
      if (typeof onComplete === 'function') onComplete();
    }
  }, 1000);

  return timer; /* Return timer id so caller can cancel */
}

/* ==================== DEBOUNCE / THROTTLE ==================== */
function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, limit = 200) {
  let lastRun = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      return fn.apply(this, args);
    }
  };
}

/* ==================== STRING HELPERS ==================== */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
}

function initials(fullName) {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function maskPhone(phone) {
  const p = phone.replace(/\D/g, '');
  return p.length >= 10 ? `${p.slice(0, 2)}XXXXXX${p.slice(-2)}` : phone;
}

/* ==================== CLIPBOARD ==================== */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success', 2000);
    return true;
  } catch {
    showToast('Failed to copy.', 'error', 2000);
    return false;
  }
}

/* ==================== PRINT / EXPORT ==================== */
function printElement(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>RED404 — Print</title>
        <style>
          body { font-family: Arial, sans-serif; color: #000; background: #fff; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>${el.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.print();
}

/* ==================== GLOBAL EXPOSE ==================== */
window.RED404 = {
  showToast,
  openModal,
  closeModal,
  togglePassword,
  detectLocation,
  haversineKm,
  getZone,
  dijkstra,
  MinHeap,
  DonorQueue,
  RequestStack,
  bfsZoneSearch,
  isCompatible,
  Validate,
  showFieldError,
  clearFieldError,
  clearAllErrors,
  shakeInput,
  Store,
  Auth,
  API,
  formatDate,
  formatTime,
  timeAgo,
  secondsToMMSS,
  startCountdown,
  debounce,
  throttle,
  capitalize,
  initials,
  maskPhone,
  copyToClipboard,
  printElement,
};