/* ============================================================
   RED404 — AUTH JS
   Donor & Hospital Register / Login logic
============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initAuthParticles();
  initDonorRegisterForm();
  initDonorLoginForm();
  initHospitalRegisterForm();
  initHospitalLoginForm();
  initPasswordStrengthMeters();
  initStepNavigation();
});

/* ==================== PARTICLES ==================== */
function initAuthParticles() {
  const container = document.getElementById('authParticles');
  if (!container) return;

  for (let i = 0; i < 40; i++) {
    const p        = document.createElement('div');
    p.className    = 'particle';
    const size     = Math.random() * 5 + 2;
    const delay    = Math.random() * 10;
    const duration = Math.random() * 12 + 8;

    p.style.cssText = `
      width:              ${size}px;
      height:             ${size}px;
      left:               ${Math.random() * 100}%;
      bottom:             -${size}px;
      animation-delay:    ${delay}s;
      animation-duration: ${duration}s;
      opacity:            ${Math.random() * 0.25 + 0.05};
    `;
    container.appendChild(p);
  }
}

/* ==================== STEP NAVIGATION — DONOR ==================== */
let currentDonorStep    = 1;
let currentHospStep     = 1;
const DONOR_TOTAL_STEPS = 3;
const HOSP_TOTAL_STEPS  = 3;

function initStepNavigation() {
  /* Expose step functions globally for onclick usage in HTML */
  window.nextStep     = nextDonorStep;
  window.prevStep     = prevDonorStep;
  window.nextHospStep = nextHospitalStep;
  window.prevHospStep = prevHospitalStep;
}

function nextDonorStep(current) {
  if (!validateDonorStep(current)) return;
  transitionStep(`step${current}`, `step${current + 1}`, 'forward');
  currentDonorStep = current + 1;
  updateProgressBar(currentDonorStep, 'donor');
  scrollToFormTop();
}

function prevDonorStep(current) {
  transitionStep(`step${current}`, `step${current - 1}`, 'backward');
  currentDonorStep = current - 1;
  updateProgressBar(currentDonorStep, 'donor');
  scrollToFormTop();
}

function nextHospitalStep(current) {
  if (!validateHospStep(current)) return;
  transitionStep(`hstep${current}`, `hstep${current + 1}`, 'forward');
  currentHospStep = current + 1;
  updateProgressBar(currentHospStep, 'hospital');
  scrollToFormTop();
}

function prevHospitalStep(current) {
  transitionStep(`hstep${current}`, `hstep${current - 1}`, 'backward');
  currentHospStep = current - 1;
  updateProgressBar(currentHospStep, 'hospital');
  scrollToFormTop();
}

function transitionStep(fromId, toId, direction) {
  const fromEl = document.getElementById(fromId);
  const toEl   = document.getElementById(toId);
  if (!fromEl || !toEl) return;

  const outClass = direction === 'forward' ? 'slide-out-left'  : 'slide-out-right';
  const inClass  = direction === 'forward' ? 'slide-in-right'  : 'slide-in-left';

  fromEl.classList.add(outClass);

  setTimeout(() => {
    fromEl.classList.remove('active', outClass);
    fromEl.style.display = 'none';
    toEl.style.display   = 'block';
    toEl.classList.add(inClass);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toEl.classList.add('active');
        toEl.classList.remove(inClass);
      });
    });
  }, 350);
}

function updateProgressBar(activeStep, type) {
  const steps = document.querySelectorAll('.fpb-step');
  const lines = document.querySelectorAll('.fpb-line');

  steps.forEach((step, idx) => {
    step.classList.remove('active', 'completed');
    if (idx + 1 < activeStep)  step.classList.add('completed');
    if (idx + 1 === activeStep) step.classList.add('active');
  });

  lines.forEach((line, idx) => {
    line.classList.toggle('filled', idx + 1 < activeStep);
  });
}

function scrollToFormTop() {
  const formContainer = document.querySelector('.auth-right-panel');
  if (formContainer) {
    formContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ==================== DONOR STEP VALIDATION ==================== */
function validateDonorStep(step) {
  let valid = true;

  const err = (id, msg) => {
    showFieldError(id, msg);
    valid = false;
  };

  const clearAll = (...ids) => ids.forEach(id => clearFieldError(id));

  if (step === 1) {
    clearAll(
      'firstNameErr','lastNameErr','emailErr',
      'phoneErr','dobErr','genderErr','passwordErr','confirmPassErr'
    );

    const fn   = document.getElementById('firstName')?.value.trim()    || '';
    const ln   = document.getElementById('lastName')?.value.trim()     || '';
    const em   = document.getElementById('email')?.value.trim()        || '';
    const ph   = document.getElementById('phone')?.value.trim()        || '';
    const dob  = document.getElementById('dob')?.value                 || '';
    const gen  = document.querySelector('input[name="gender"]:checked');
    const pw   = document.getElementById('password')?.value            || '';
    const cpw  = document.getElementById('confirmPass')?.value         || '';

    if (!fn)  err('firstNameErr', 'First name is required.');
    if (!ln)  err('lastNameErr',  'Last name is required.');
    if (!Validate.email(em)) err('emailErr', 'Enter a valid email address.');
    if (!Validate.phone(ph)) err('phoneErr', 'Enter a valid 10-digit number.');
    if (!dob) {
      err('dobErr', 'Date of birth is required.');
    } else if (!Validate.minAge(dob, 18)) {
      err('dobErr', 'You must be at least 18 years old.');
    }
    if (!gen) err('genderErr', 'Please select your gender.');
    if (!Validate.password(pw)) err('passwordErr', 'Password must be at least 8 characters.');
    if (!Validate.match(pw, cpw)) err('confirmPassErr', 'Passwords do not match.');
  }

  if (step === 2) {
    clearAll('bloodTypeErr', 'weightErr', 'availabilityErr');

    const bt   = document.querySelector('input[name="bloodType"]:checked');
    const wt   = document.getElementById('weight')?.value    || '';
    const avail = document.getElementById('availability')?.value || '';

    if (!bt)  err('bloodTypeErr', 'Please select your blood type.');
    if (!Validate.minWeight(wt, 45)) err('weightErr', 'Minimum weight is 45 kg to donate.');
    if (!avail) err('availabilityErr', 'Please select your availability.');
  }

  if (step === 3) {
    clearAll('addressErr', 'cityErr', 'stateErr', 'pincodeErr', 'termsErr');

    const addr  = document.getElementById('address')?.value.trim()  || '';
    const city  = document.getElementById('city')?.value.trim()     || '';
    const state = document.getElementById('state')?.value           || '';
    const pin   = document.getElementById('pincode')?.value.trim()  || '';
    const terms = document.getElementById('terms')?.checked;

    if (!addr)  err('addressErr', 'Street address is required.');
    if (!city)  err('cityErr',    'City is required.');
    if (!state) err('stateErr',   'Please select a state.');
    if (!Validate.pincode(pin)) err('pincodeErr', 'Enter a valid 6-digit PIN code.');
    if (!terms) err('termsErr',   'You must agree to the Terms of Service.');
  }

  if (!valid) shakeFirstError();
  return valid;
}

/* ==================== HOSPITAL STEP VALIDATION ==================== */
function validateHospStep(step) {
  let valid = true;

  const err      = (id, msg) => { showFieldError(id, msg); valid = false; };
  const clearAll = (...ids)  => ids.forEach(id => clearFieldError(id));

  if (step === 1) {
    clearAll(
      'hospitalNameErr','registrationNoErr','hospitalTypeErr',
      'hospEmailErr','hospPhoneErr'
    );

    const name  = document.getElementById('hospitalName')?.value.trim()  || '';
    const regNo = document.getElementById('registrationNo')?.value.trim()|| '';
    const type  = document.getElementById('hospitalType')?.value          || '';
    const email = document.getElementById('hospEmail')?.value.trim()      || '';
    const phone = document.getElementById('hospPhone')?.value.trim()      || '';

    if (!name)  err('hospitalNameErr',   'Hospital name is required.');
    if (!regNo) err('registrationNoErr', 'Registration number is required.');
    if (!type)  err('hospitalTypeErr',   'Please select hospital type.');
    if (!Validate.email(email)) err('hospEmailErr', 'Enter a valid email address.');
    if (!Validate.phone(phone)) err('hospPhoneErr', 'Enter a valid 10-digit number.');
  }

  if (step === 2) {
    clearAll(
      'adminFirstNameErr','adminLastNameErr','adminDesignationErr',
      'adminPhoneErr','adminEmailErr','adminPasswordErr',
      'adminConfirmPasswordErr','emergencyContactErr'
    );

    const fn    = document.getElementById('adminFirstName')?.value.trim()        || '';
    const ln    = document.getElementById('adminLastName')?.value.trim()         || '';
    const desg  = document.getElementById('adminDesignation')?.value             || '';
    const ph    = document.getElementById('adminPhone')?.value.trim()            || '';
    const em    = document.getElementById('adminEmail')?.value.trim()            || '';
    const pw    = document.getElementById('adminPassword')?.value                || '';
    const cpw   = document.getElementById('adminConfirmPassword')?.value         || '';
    const emer  = document.getElementById('emergencyContact')?.value.trim()      || '';

    if (!fn)  err('adminFirstNameErr',        'First name is required.');
    if (!ln)  err('adminLastNameErr',          'Last name is required.');
    if (!desg) err('adminDesignationErr',      'Please select a designation.');
    if (!Validate.phone(ph)) err('adminPhoneErr', 'Enter a valid 10-digit number.');
    if (!Validate.email(em)) err('adminEmailErr', 'Enter a valid email address.');
    if (!Validate.password(pw)) err('adminPasswordErr', 'Password must be at least 8 characters.');
    if (!Validate.match(pw, cpw)) err('adminConfirmPasswordErr', 'Passwords do not match.');
    if (!Validate.phone(emer)) err('emergencyContactErr', 'Enter a valid 10-digit emergency number.');
  }

  if (step === 3) {
    clearAll('hospAddressErr','hospCityErr','hospStateErr','hospPincodeErr','hospTermsErr');

    const addr  = document.getElementById('hospAddress')?.value.trim()  || '';
    const city  = document.getElementById('hospCity')?.value.trim()     || '';
    const state = document.getElementById('hospState')?.value            || '';
    const pin   = document.getElementById('hospPincode')?.value.trim()  || '';
    const terms = document.getElementById('hospTerms')?.checked;

    if (!addr)  err('hospAddressErr', 'Street address is required.');
    if (!city)  err('hospCityErr',    'City is required.');
    if (!state) err('hospStateErr',   'Please select a state.');
    if (!Validate.pincode(pin)) err('hospPincodeErr', 'Enter a valid 6-digit PIN code.');
    if (!terms) err('hospTermsErr',   'You must agree to the Terms to continue.');
  }

  if (!valid) shakeFirstError();
  return valid;
}

function shakeFirstError() {
  const firstError = document.querySelector('.field-error:not(:empty)');
  if (!firstError) return;
  const input = firstError.closest('.form-group')?.querySelector('input, select, textarea');
  if (input) shakeInput(input);
  firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ==================== PASSWORD STRENGTH ==================== */
function initPasswordStrengthMeters() {
  const pairs = [
    { inputId: 'password',       fillId: 'strengthFill',     textId: 'strengthText' },
    { inputId: 'adminPassword',  fillId: 'hospStrengthFill',  textId: 'hospStrengthText' },
  ];

  pairs.forEach(({ inputId, fillId, textId }) => {
    const input = document.getElementById(inputId);
    const fill  = document.getElementById(fillId);
    const text  = document.getElementById(textId);
    if (!input || !fill || !text) return;

    input.addEventListener('input', () => {
      const result = scorePassword(input.value);
      fill.style.width      = result.width;
      fill.style.background = result.color;
      text.textContent      = result.label;
      text.style.color      = result.color;
    });
  });
}

function scorePassword(val) {
  if (!val) return { width: '0%', color: '#5a5a7a', label: 'Enter password' };

  let score = 0;
  if (val.length >= 8)            score++;
  if (val.length >= 12)           score++;
  if (/[A-Z]/.test(val))          score++;
  if (/[0-9]/.test(val))          score++;
  if (/[^A-Za-z0-9]/.test(val))   score++;

  const levels = [
    { label: 'Too weak',    color: '#ff4444', width: '15%'  },
    { label: 'Weak',        color: '#ff6644', width: '30%'  },
    { label: 'Fair',        color: '#ff8800', width: '50%'  },
    { label: 'Good',        color: '#ffcc00', width: '70%'  },
    { label: 'Strong',      color: '#44bb00', width: '88%'  },
    { label: 'Very strong', color: '#00cc44', width: '100%' },
  ];

  return levels[Math.min(score, levels.length - 1)];
}

/* ==================== DONOR REGISTER FORM ==================== */
function initDonorRegisterForm() {
  const form = document.getElementById('donorRegisterForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateDonorStep(3)) return;

    const submitBtn = document.getElementById('submitBtn');
    setButtonLoading(submitBtn, true);

    const payload = buildDonorPayload();
    const result = await API.post('/donors/register', payload);
    setButtonLoading(submitBtn, false);

    if (result.success) {
      form.reset();
      document.getElementById('successModal').style.display = 'flex';
    } else {
      showToast(result.error || 'Registration failed. Please try again.', 'error');
    }
  });
}

function buildDonorPayload() {
  return {
    firstName:       document.getElementById('firstName')?.value.trim(),
    lastName:        document.getElementById('lastName')?.value.trim(),
    email:           document.getElementById('email')?.value.trim(),
    phone:           document.getElementById('phone')?.value.trim(),
    dateOfBirth:     document.getElementById('dob')?.value,
    gender:          document.querySelector('input[name="gender"]:checked')?.value,
    password:        document.getElementById('password')?.value,
    bloodType:       document.querySelector('input[name="bloodType"]:checked')?.value,
    weight:          parseFloat(document.getElementById('weight')?.value),
    lastDonation:    document.getElementById('lastDonation')?.value || null,
    availability:    document.getElementById('availability')?.value,
    address:         document.getElementById('address')?.value.trim(),
    city:            document.getElementById('city')?.value.trim(),
    state:           document.getElementById('state')?.value,
    pincode:         document.getElementById('pincode')?.value.trim(),
    latitude:        document.getElementById('lat')?.value   || null,
    longitude:       document.getElementById('lng')?.value   || null,
    zone:            document.getElementById('zone')?.value  || null,
    smsNotif:        document.getElementById('smsNotif')?.checked   ?? true,
    pushNotif:       document.getElementById('pushNotif')?.checked  ?? true,
    emailNotif:      document.getElementById('emailNotif')?.checked ?? false,
    conditions:      [...document.querySelectorAll('input[name="conditions"]:checked')]
                       .map(cb => cb.value),
  };
}

/* ==================== DONOR LOGIN FORM ==================== */
function initDonorLoginForm() {
  const form = document.getElementById('donorLoginForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    clearFieldError('loginEmailErr');
    clearFieldError('loginPasswordErr');

    const identifier = document.getElementById('loginEmail')?.value.trim()    || '';
    const password   = document.getElementById('loginPassword')?.value         || '';
    let valid        = true;

    if (!identifier) {
      showFieldError('loginEmailErr', 'Email or phone number is required.');
      valid = false;
    }
    if (!password) {
      showFieldError('loginPasswordErr', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector('.btn-submit');
    setButtonLoading(submitBtn, true);

    const result = await API.post('/donors/login', { identifier, password });

    setButtonLoading(submitBtn, false);

    if (result.success) {
      Auth.saveSession(result.data.donor);
      Store.set('donorToken', result.data.token);
      showToast('Login successful! Redirecting...', 'success', 1500);
      setTimeout(() => { window.location.href = 'donor-dashboard.html'; }, 1500);
    } else {
      showToast(result.error || 'Invalid credentials. Please try again.', 'error');
      shakeInput(document.getElementById('loginPassword'));
    }
  });
}

/* ==================== HOSPITAL REGISTER FORM ==================== */
function initHospitalRegisterForm() {
  const form = document.getElementById('hospitalRegisterForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateHospStep(3)) return;

    const submitBtn = document.getElementById('hospSubmitBtn');
    setButtonLoading(submitBtn, true);

    const payload = buildHospitalPayload();
    const result  = await API.post('/hospitals/register', payload);

    setButtonLoading(submitBtn, false);

    if (result.success) {
      document.getElementById('hospSuccessModal').style.display = 'flex';
    } else {
      showToast(result.error || 'Registration failed. Please try again.', 'error');
    }
  });
}

function buildHospitalPayload() {
  return {
    hospitalName:      document.getElementById('hospitalName')?.value.trim(),
    registrationNo:    document.getElementById('registrationNo')?.value.trim(),
    hospitalType:      document.getElementById('hospitalType')?.value,
    beds:              parseInt(document.getElementById('beds')?.value) || 0,
    bloodBankLicense:  document.getElementById('bloodBankLicense')?.value.trim() || null,
    hospitalEmail:     document.getElementById('hospEmail')?.value.trim(),
    hospitalPhone:     document.getElementById('hospPhone')?.value.trim(),
    website:           document.getElementById('hospWebsite')?.value.trim() || null,
    services:          [...document.querySelectorAll('input[name="services"]:checked')]
                        .map(cb => cb.value),
    adminFirstName:    document.getElementById('adminFirstName')?.value.trim(),
    adminLastName:     document.getElementById('adminLastName')?.value.trim(),
    adminDesignation:  document.getElementById('adminDesignation')?.value,
    adminPhone:        document.getElementById('adminPhone')?.value.trim(),
    adminEmail:        document.getElementById('adminEmail')?.value.trim(),
    password:          document.getElementById('adminPassword')?.value,
    emergencyContact:  document.getElementById('emergencyContact')?.value.trim(),
    address:           document.getElementById('hospAddress')?.value.trim(),
    landmark:          document.getElementById('hospLandmark')?.value.trim() || null,
    city:              document.getElementById('hospCity')?.value.trim(),
    state:             document.getElementById('hospState')?.value,
    pincode:           document.getElementById('hospPincode')?.value.trim(),
    latitude:          document.getElementById('hospLat')?.value   || null,
    longitude:         document.getElementById('hospLng')?.value   || null,
    zone:              document.getElementById('hospZone')?.value  || null,
    operatingHours:    document.querySelector('input[name="opHours"]:checked')?.value || '24x7',
    zoneRadius:        parseInt(document.getElementById('zoneRadius')?.value) || 10,
    smsNotif:          document.getElementById('hospSmsNotif')?.checked   ?? true,
    pushNotif:         document.getElementById('hospPushNotif')?.checked  ?? true,
    emailNotif:        document.getElementById('hospEmailNotif')?.checked ?? false,
  };
}

/* ==================== HOSPITAL LOGIN FORM ==================== */
function initHospitalLoginForm() {
  const form = document.getElementById('hospitalLoginForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    clearFieldError('hospLoginEmailErr');
    clearFieldError('hospLoginPasswordErr');

    const email    = document.getElementById('hospLoginEmail')?.value.trim()    || '';
    const password = document.getElementById('hospLoginPassword')?.value         || '';
    let   valid    = true;

    if (!Validate.email(email)) {
      showFieldError('hospLoginEmailErr', 'Enter a valid email address.');
      valid = false;
    }
    if (!password) {
      showFieldError('hospLoginPasswordErr', 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    const submitBtn = form.querySelector('.btn-submit');
    setButtonLoading(submitBtn, true);

    const result = await API.post('/hospitals/login', { email, password });

    setButtonLoading(submitBtn, false);

    if (result.success) {
      Auth.saveSession(result.data.hospital);
      Store.set('hospitalToken', result.data.token);
      showToast('Login successful! Redirecting...', 'success', 1500);
      setTimeout(() => { window.location.href = 'hospital-dashboard.html'; }, 1500);
    } else {
      showToast(result.error || 'Invalid credentials. Please try again.', 'error');
      shakeInput(document.getElementById('hospLoginPassword'));
    }
  });
}

/* ==================== FORGOT PASSWORD ==================== */
window.showForgotModal = function () {
  document.getElementById('forgotModal').style.display = 'flex';
};

window.hideForgotModal = function () {
  document.getElementById('forgotModal').style.display = 'none';
};

window.showHospForgotModal = function () {
  document.getElementById('hospForgotModal').style.display = 'flex';
};

window.sendResetLink = async function () {
  const email = document.getElementById('resetEmail')?.value.trim();
  if (!Validate.email(email || '')) {
    showToast('Please enter a valid email address.', 'warning');
    return;
  }

  await API.post('/auth/forgot-password', { email, role: 'donor' });
  const modal = document.getElementById('forgotModal');
  if (modal) {
    modal.querySelector('.modal-box').innerHTML = `
      <div style="text-align:center;padding:1.5rem 1rem;">
        <div class="success-circle" style="margin:0 auto 1.25rem;">
          <i class="fas fa-check"></i>
        </div>
        <h3>Reset Link Sent!</h3>
        <p style="margin-bottom:1.5rem;">
          Check <strong>${email}</strong> for the password reset link.
          It may take a few minutes.
        </p>
        <button class="btn btn-primary"
          onclick="document.getElementById('forgotModal').style.display='none'">
          Close
        </button>
      </div>`;
  }
};


window.sendHospResetLink = async function () {
  const email = document.getElementById('hospResetEmail')?.value.trim();
  if (!Validate.email(email || '')) {
    showToast('Please enter a valid email address.', 'warning');
    return;
  }

  await API.post('/auth/forgot-password', { email, role: 'hospital' });

  const modal = document.getElementById('hospForgotModal');
  if (modal) {
    modal.querySelector('.modal-box').innerHTML = `
      <div style="text-align:center;padding:1.5rem 1rem;">
        <div class="success-circle" style="margin:0 auto 1.25rem;">
          <i class="fas fa-check"></i>
        </div>
        <h3>Reset Link Sent!</h3>
        <p style="margin-bottom:1.5rem;">
          Check <strong>${email}</strong> for the password reset link.
        </p>
        <button class="btn btn-primary"
          onclick="document.getElementById('hospForgotModal').style.display='none'">
          Close
        </button>
      </div>`;
  }
};

/* ==================== GEOLOCATION — DONOR ==================== */
window.detectLocation = function () {
  const statusEl  = document.getElementById('locationStatus');
  const coordsDiv = document.getElementById('coordsDisplay');
  const btn       = document.querySelector('#locationDetect button');

  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';
    btn.disabled  = true;
  }

  RED404.detectLocation({
    onStart: () => {
      if (statusEl) statusEl.textContent = 'Detecting your location...';
    },
        onSuccess: data => {
      /* Fill hidden fields */
      const latEl = document.getElementById('lat');
      const lngEl = document.getElementById('lng');
      if (latEl) latEl.value = data.lat;
      if (lngEl) lngEl.value = data.lng;

      /* Fill display fields */
      const latDisplay = document.getElementById('latDisplay');
      const lngDisplay = document.getElementById('lngDisplay');
      if (latDisplay) latDisplay.textContent = data.lat;
      if (lngDisplay) lngDisplay.textContent = data.lng;

      /* Fill address fields */
      const addressEl = document.getElementById('address');
      const cityEl    = document.getElementById('city');
      const pincodeEl = document.getElementById('pincode');

      if (addressEl && data.road) {
        addressEl.value = `${data.road}${data.neighbourhood ? ', ' + data.neighbourhood : ''}`;
      }
      if (cityEl    && data.city)     cityEl.value     = data.city;
      if (pincodeEl && data.postcode) pincodeEl.value  = data.postcode;

      /* Compute zone using city centre as reference */
      const CITY_LAT = 19.0760;
      const CITY_LNG = 72.8777;
      const distKm   = RED404.haversineKm(
        parseFloat(data.lat), parseFloat(data.lng),
        CITY_LAT, CITY_LNG
      );
      const zoneInfo = RED404.getZone(distKm);
      const zoneEl   = document.getElementById('zone');
      if (zoneEl) zoneEl.value = zoneInfo.label;

      /* Show coords panel */
      const coordsDiv = document.getElementById('coordsDisplay');
      if (coordsDiv) coordsDiv.style.display = 'flex';

      /* Update button */
      if (btn) {
        btn.innerHTML        = '<i class="fas fa-check-circle"></i> Location Detected';
        btn.style.background = 'linear-gradient(135deg,#00cc44,#009933)';
        btn.disabled         = false;
      }

      if (statusEl) {
        statusEl.textContent = `Zone assigned: ${zoneInfo.label}`;
        statusEl.style.color = zoneInfo.color;
      }

      RED404.showToast('Location detected successfully!', 'success');
    },

    onError: message => {
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = '#ff4444';
      }
      if (btn) {
        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Auto-Detect My Location';
        btn.disabled  = false;
      }
      RED404.showToast(message, 'error');
    },
  });
};

/* ==================== GEOLOCATION — HOSPITAL ==================== */
window.detectHospitalLocation = function () {
  const statusEl  = document.getElementById('hospLocationStatus');
  const coordsDiv = document.getElementById('hospCoordsDisplay');
  const btn       = document.querySelector('#hospLocationDetect button');

  if (btn) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';
    btn.disabled  = true;
  }

  RED404.detectLocation({
    onStart: () => {
      if (statusEl) statusEl.textContent = 'Detecting hospital location...';
    },

    onSuccess: data => {
      /* Hidden fields */
      const hospLatEl = document.getElementById('hospLat');
      const hospLngEl = document.getElementById('hospLng');
      if (hospLatEl) hospLatEl.value = data.lat;
      if (hospLngEl) hospLngEl.value = data.lng;

      /* Display fields */
      const latDisplay     = document.getElementById('hospLatDisplay');
      const lngDisplay     = document.getElementById('hospLngDisplay');
      const addressDisplay = document.getElementById('hospAddressDisplay');
      if (latDisplay)     latDisplay.textContent     = data.lat;
      if (lngDisplay)     lngDisplay.textContent     = data.lng;
      if (addressDisplay) addressDisplay.textContent = data.displayName || 'Location found';

      /* Auto-fill address fields */
      const addrEl    = document.getElementById('hospAddress');
      const cityEl    = document.getElementById('hospCity');
      const pincodeEl = document.getElementById('hospPincode');

      if (addrEl && data.road) {
        addrEl.value = `${data.road}${data.neighbourhood ? ', ' + data.neighbourhood : ''}`;
      }
      if (cityEl    && data.city)     cityEl.value     = data.city;
      if (pincodeEl && data.postcode) pincodeEl.value  = data.postcode;

      /* Compute zone */
      const CITY_LAT = 19.0760;
      const CITY_LNG = 72.8777;
      const distKm   = RED404.haversineKm(
        parseFloat(data.lat), parseFloat(data.lng),
        CITY_LAT, CITY_LNG
      );
      const zoneInfo = RED404.getZone(distKm);
      const zoneEl   = document.getElementById('hospZone');
      if (zoneEl) zoneEl.value = zoneInfo.label;

      /* Show coords panel */
      if (coordsDiv) coordsDiv.style.display = 'flex';

      /* Update button */
      if (btn) {
        btn.innerHTML        = '<i class="fas fa-check-circle"></i> Location Detected';
        btn.style.background = 'linear-gradient(135deg,#00cc44,#009933)';
        btn.disabled         = false;
      }

      if (statusEl) {
        statusEl.textContent = `Zone assigned: ${zoneInfo.label}`;
        statusEl.style.color = zoneInfo.color;
      }

      RED404.showToast('Hospital location detected!', 'success');
    },

    onError: message => {
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = '#ff4444';
      }
      if (btn) {
        btn.innerHTML = '<i class="fas fa-crosshairs"></i> Auto-Detect Hospital Location';
        btn.disabled  = false;
      }
      RED404.showToast(message, 'error');
    },
  });
};

/* ==================== RANGE SLIDER LABEL ==================== */
window.updateRadiusLabel = function (val) {
  const label = document.getElementById('radiusLabel');
  if (label) label.textContent = `${val} km`;

  /* Update range track fill */
  const range = document.getElementById('zoneRadius');
  if (range) {
    const min     = parseInt(range.min)   || 5;
    const max     = parseInt(range.max)   || 50;
    const pct     = ((parseInt(val) - min) / (max - min)) * 100;
    range.style.background = `linear-gradient(90deg, var(--red-primary) ${pct}%, var(--bg-surface2) ${pct}%)`;
  }
};

/* ==================== DOCUMENT UPLOAD ==================== */
(function initDocUpload() {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleDocUploadFiles(e.dataTransfer.files);
  });
})();

window.handleDocUpload = function (event) {
  handleDocUploadFiles(event.target.files);
};

function handleDocUploadFiles(files) {
  const container = document.getElementById('uploadedFiles');
  if (!container) return;

  const MAX_SIZE    = 5 * 1024 * 1024; /* 5 MB */
  const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

  Array.from(files).forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_EXT.includes(ext)) {
      RED404.showToast(`${file.name}: unsupported file type.`, 'error');
      return;
    }
    if (file.size > MAX_SIZE) {
      RED404.showToast(`${file.name} exceeds the 5 MB limit.`, 'error');
      return;
    }

    const id  = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const div = document.createElement('div');
    div.className = 'uploaded-file-item';
    div.id        = id;
    div.innerHTML = `
      <div class="uf-icon">
        <i class="fas ${ext === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i>
      </div>
      <div class="uf-info">
        <span class="uf-name">${file.name}</span>
        <span class="uf-size">${(file.size / 1024).toFixed(1)} KB</span>
      </div>
      <div class="uf-progress">
        <div class="uf-bar">
          <div class="uf-fill" id="fill_${id}" style="width:0%"></div>
        </div>
        <span class="uf-pct" id="pct_${id}">0%</span>
      </div>
      <button class="uf-remove" onclick="removeUploadedFile('${id}')" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(div);
    simulateFileUpload(id);
  });
}

function simulateFileUpload(id) {
  const fill = document.getElementById(`fill_${id}`);
  const pct  = document.getElementById(`pct_${id}`);
  if (!fill || !pct) return;

  let   progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 20 + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      pct.style.color = '#00cc66';
    }
    fill.style.width  = `${Math.min(progress, 100)}%`;
    pct.textContent   = `${Math.floor(Math.min(progress, 100))}%`;
  }, 180);
}

window.removeUploadedFile = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'slideOutRight 0.3s ease forwards';
  setTimeout(() => el.remove(), 300);
};

/* ==================== BUTTON LOADING STATE ==================== */
function setButtonLoading(btn, isLoading) {
  if (!btn) return;

  const textEl   = btn.querySelector('.btn-text');
  const loaderEl = btn.querySelector('.btn-loader');

  if (isLoading) {
    if (textEl)   textEl.style.display   = 'none';
    if (loaderEl) loaderEl.style.display = 'inline-flex';
    btn.disabled = true;
    btn.classList.add('loading');
  } else {
    if (textEl)   textEl.style.display   = 'inline-flex';
    if (loaderEl) loaderEl.style.display = 'none';
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}



/* ==================== EXPOSE HELPERS TO WINDOW ==================== */
window.togglePassword   = RED404.togglePassword;
window.showToast        = RED404.showToast;
window.closeModal       = RED404.closeModal;
window.showFieldError   = RED404.showFieldError;
window.clearFieldError  = RED404.clearFieldError;
window.shakeInput       = RED404.shakeInput;