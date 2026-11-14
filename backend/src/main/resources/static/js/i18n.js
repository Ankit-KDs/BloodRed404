/**
 * RED404 — Multi-Language Support Engine (English & Hindi)
 * 
 * NOTE: Hindi translations below are a human-drafted dictionary.
 * STATUS: [NEEDS HUMAN REVIEW]
 * RULES:
 * 1. Do NOT use runtime machine translation.
 * 2. Numbers (0-9), blood groups (A+, O-, etc.), and IDs (DNR-*) stay in Latin digits.
 * 3. Choice is persisted in localStorage ('red404_lang') and synced with donor profile.
 */

(function () {
  'use strict';

  const TRANSLATIONS = {
    en: {
      // Navigation
      'nav.home': 'Home',
      'nav.about': 'About Us',
      'nav.search': 'Blood Search',
      'nav.contact': 'Contact',
      'nav.donorLogin': 'Donor Login',
      'nav.hospitalLogin': 'Hospital Login',
      'nav.dashboard': 'Dashboard',
      'nav.emergencies': 'Emergencies',
      'nav.donations': 'Donation History',
      'nav.profile': 'Health Profile',
      'nav.logout': 'Logout',

      // Home Hero
      'hero.badge': 'Live Blood Network Active',
      'hero.titleLine1': 'Every Drop',
      'hero.titleLine2': 'Saves A Life',
      'hero.subtitle': 'RED404 connects voluntary blood donors with nearby hospitals in real time. Fast, verified, and completely secure.',
      'hero.btnSearch': 'Search Blood Stock',
      'hero.btnRegister': 'Register as Donor',

      // Home Services
      'services.title': 'What We Offer',
      'services.subtitle': 'Reliable technology designed for rapid clinical response and donor safety.',
      'services.tab1': 'Blood search',
      'services.tab2': 'Blood bank directory',
      'services.tab3': 'Health screening',
      'services.tab4': 'Portal access',
      'services.tab5': 'Donation drives',

      // Home Stats
      'stats.donors': 'Registered Donors',
      'stats.hospitals': 'Partner Hospitals',
      'stats.donations': 'Verified Donations',
      'stats.livesSaved': 'Lives Saved',
      'stats.noData': 'No data yet',

      // Blood Stock
      'stock.title': 'Blood available across partner hospitals',
      'stock.subtitle': 'Real-time inventory aggregated from verified hospitals across our network.',
      'stock.empty': 'Live stock appears here once more hospitals join.',

      // Who Can Donate & FAQ
      'eligibility.title': 'Who Can Donate Blood',
      'eligibility.age': 'Age: 18 to 65 years',
      'eligibility.weight': 'Weight: At least 45 kg',
      'eligibility.gap': 'Gap between donations: 90 days (120 days for females)',
      'faq.title': 'Frequently Asked Questions',
      'privacy.note': 'Privacy Note: Hospitals see your phone number only after you accept a request.',

      // Donor Dashboard
      'dash.emergencyTitle': 'Emergency requests near you',
      'dash.noRequests': 'No active requests near you',
      'dash.seeRequests': 'See requests',
      'dash.nearbyHospitals': 'Find Nearby Blood Banks',
      'dash.nearbyDesc': 'View verified partner hospitals near you with real-time available blood units and direct route navigation.',
      'dash.notifications': 'Notifications',
      'dash.recentUpdates': 'RECENT UPDATES',
      'dash.seeAllNotif': 'See all notifications',
      'dash.accountCreated': 'Account created on',
      'dash.verifiedBy': 'Verified by',
      'dash.selfDeclared': 'Self-declared',

      // Status Row
      'status.location': 'Location',
      'status.notifications': 'Notifications',
      'status.availability': 'Availability',
      'status.available': 'Available to donate',
      'status.paused': 'Paused',
      'status.pause': 'Pause',
      'status.resume': 'Resume Availability',

      // Drives
      'drives.title': 'Upcoming Donation Drives',
      'drives.empty': 'No upcoming donation drives in your area right now.',
      'drives.attend': "I'll attend",
      'drives.decline': 'Not now',

      // Badges
      'badges.title': 'Earned Badges',
      'badges.firstSavior': 'First Savior',
      'badges.firstSaviorRule': 'First verified donation',
      'badges.goldenHour': 'Golden Hour Hero',
      'badges.goldenHourRule': 'Donation within 60 min of alert',
      'badges.nightOwl': 'Night Owl',
      'badges.nightOwlRule': 'Donation between 9 PM and 6 AM',
      'badges.rareVanguard': 'Rare Vanguard',
      'badges.rareVanguardRule': 'Rare blood group (O- or AB-) donation',
      'badges.lifeGiver': 'Life Giver V',
      'badges.lifeGiverRule': '5 verified donations',
      'badges.apexGuardian': 'Apex Guardian',
      'badges.apexGuardianRule': '10 verified donations',

      // History & Certificate
      'history.title': 'Clinical Donation Ledger & Records',
      'history.empty': 'No verified donations yet. Awaiting your first rescue.',
      'history.downloadCert': 'Download certificate',
      'history.exportCsv': 'Export CSV'
    },

    hi: {
      // Navigation
      'nav.home': 'होम',
      'nav.about': 'हमारे बारे में',
      'nav.search': 'रक्त खोज',
      'nav.contact': 'संपर्क',
      'nav.donorLogin': 'रक्तदाता लॉगिन',
      'nav.hospitalLogin': 'अस्पताल लॉगिन',
      'nav.dashboard': 'डैशबोर्ड',
      'nav.emergencies': 'आपातकाल',
      'nav.donations': 'दान इतिहास',
      'nav.profile': 'स्वास्थ्य प्रोफ़ाइल',
      'nav.logout': 'लॉगआउट',

      // Home Hero
      'hero.badge': 'लाइव ब्लड नेटवर्क सक्रिय',
      'hero.titleLine1': 'हर एक बूँद',
      'hero.titleLine2': 'जीवन बचाती है',
      'hero.subtitle': 'RED404 स्वैच्छिक रक्तदाताओं को नजदीकी अस्पतालों से वास्तविक समय में जोड़ता है। सुरक्षित, सत्यापित और तीव्र।',
      'hero.btnSearch': 'रक्त उपलब्धता देखें',
      'hero.btnRegister': 'रक्तदाता बनें',

      // Home Services
      'services.title': 'हम क्या प्रदान करते हैं',
      'services.subtitle': 'मरीजों की आपातकालीन सुरक्षा और त्वरित प्रतिक्रिया के लिए बनाई गई विश्वसनीय तकनीक।',
      'services.tab1': 'रक्त खोज',
      'services.tab2': 'रक्त बैंक निर्देशिका',
      'services.tab3': 'स्वास्थ्य जांच',
      'services.tab4': 'पोर्टल पहुंच',
      'services.tab5': 'रक्तदान शिविर',

      // Home Stats
      'stats.donors': 'पंजीकृत रक्तदाता',
      'stats.hospitals': 'साझेदार अस्पताल',
      'stats.donations': 'सत्यापित रक्तदान',
      'stats.livesSaved': 'बचाई गई जानें',
      'stats.noData': 'अभी कोई डेटा नहीं',

      // Blood Stock
      'stock.title': 'साझेदार अस्पतालों में उपलब्ध रक्त',
      'stock.subtitle': 'हमारे नेटवर्क के सत्यापित अस्पतालों से संकलित लाइव स्टॉक।',
      'stock.empty': 'अधिक अस्पतालों के जुड़ने पर लाइव स्टॉक यहां दिखाई देगा।',

      // Who Can Donate & FAQ
      'eligibility.title': 'रक्तदान कौन कर सकता है',
      'eligibility.age': 'आयु: 18 से 65 वर्ष',
      'eligibility.weight': 'वजन: न्यूनतम 45 किग्रा',
      'eligibility.gap': 'दान के बीच अंतर: 90 दिन (महिलाओं के लिए 120 दिन)',
      'faq.title': 'अक्सर पूछे जाने वाले प्रश्न',
      'privacy.note': 'गोपनीयता नोट: अनुरोध स्वीकार करने के बाद ही अस्पताल आपका फोन नंबर देख सकते हैं।',

      // Donor Dashboard
      'dash.emergencyTitle': 'आपके आस-पास आपातकालीन अनुरोध',
      'dash.noRequests': 'आपके क्षेत्र में कोई सक्रिय अनुरोध नहीं',
      'dash.seeRequests': 'अनुरोध देखें',
      'dash.nearbyHospitals': 'नजदीकी रक्त बैंक खोजें',
      'dash.nearbyDesc': 'अपने नजदीकी सत्यापित अस्पतालों में उपलब्ध रक्त इकाइयां और सीधा मार्ग देखें।',
      'dash.notifications': 'सूचनाएं',
      'dash.recentUpdates': 'हालिया अपडेट',
      'dash.seeAllNotif': 'सभी सूचनाएं देखें',
      'dash.accountCreated': 'खाता निर्माण तिथि',
      'dash.verifiedBy': 'द्वारा सत्यापित',
      'dash.selfDeclared': 'स्व-घोषित',

      // Status Row
      'status.location': 'स्थान',
      'status.notifications': 'सूचनाएं',
      'status.availability': 'उपलब्धता',
      'status.available': 'रक्तदान के लिए उपलब्ध',
      'status.paused': 'विराम पर',
      'status.pause': 'रोकें',
      'status.resume': 'उपलब्धता पुनः चालू करें',

      // Drives
      'drives.title': 'आगामी रक्तदान शिविर',
      'drives.empty': 'वर्तमान में आपके क्षेत्र में कोई आगामी शिविर नहीं है।',
      'drives.attend': 'मैं आऊंगा',
      'drives.decline': 'अभी नहीं',

      // Badges
      'badges.title': 'अर्जित पदक',
      'badges.firstSavior': 'प्रथम रक्षक',
      'badges.firstSaviorRule': 'पहला सत्यापित रक्तदान',
      'badges.goldenHour': 'गोल्डन ऑवर हीरो',
      'badges.goldenHourRule': 'अलर्ट के 60 मिनट के भीतर रक्तदान',
      'badges.nightOwl': 'नाइट आउल',
      'badges.nightOwlRule': 'रात 9 बजे से सुबह 6 बजे के बीच रक्तदान',
      'badges.rareVanguard': 'दुर्लभ रक्षक',
      'badges.rareVanguardRule': 'दुर्लभ रक्त समूह (O- या AB-) रक्तदान',
      'badges.lifeGiver': 'जीवन दाता V',
      'badges.lifeGiverRule': '5 सत्यापित रक्तदान',
      'badges.apexGuardian': 'शीर्ष संरक्षक',
      'badges.apexGuardianRule': '10 सत्यापित रक्तदान',

      // History & Certificate
      'history.title': 'रक्तदान खाता बही व प्रमाण पत्र',
      'history.empty': 'अभी तक कोई सत्यापित रक्तदान नहीं। आपके पहले बचाव की प्रतीक्षा है।',
      'history.downloadCert': 'प्रमाण पत्र डाउनलोड करें',
      'history.exportCsv': 'CSV निर्यात करें'
    }
  };

  let currentLang = 'en';

  function initI18n() {
    // 1. Resolve initial language
    const saved = localStorage.getItem('red404_lang');
    if (saved && (saved === 'en' || saved === 'hi')) {
      currentLang = saved;
    } else {
      // Check session user if available
      try {
        const sess = JSON.parse(localStorage.getItem('red404_donor_session') || sessionStorage.getItem('red404_donor_session') || '{}');
        const u = sess.user || sess;
        if (u && (u.preferredLanguage || u.preferred_language)) {
          const l = (u.preferredLanguage || u.preferred_language).toLowerCase();
          if (l === 'hi' || l === 'en') currentLang = l;
        }
      } catch (_) {}
    }

    applyTranslations(currentLang);
    setupLanguageToggles();
  }

  function t(key, fallback) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    if (dict && dict[key] !== undefined) {
      return dict[key];
    }
    const enDict = TRANSLATIONS.en;
    return (enDict && enDict[key] !== undefined) ? enDict[key] : (fallback || key);
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'hi') return;
    currentLang = lang;
    localStorage.setItem('red404_lang', lang);

    applyTranslations(currentLang);
    updateToggleButtonsUI(currentLang);

    // Sync with backend if donor is logged in
    try {
      fetch('/api/donor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: lang }),
        credentials: 'include'
      }).catch(() => {});
    } catch (_) {}

    // Dispatch event so other dynamic components can re-render text
    window.dispatchEvent(new CustomEvent('red404_language_changed', { detail: { lang } }));
  }

  function applyTranslations(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && dict[key] !== undefined) {
        // Keep any child icons if element has icon + text
        const icon = el.querySelector('i');
        if (icon) {
          el.innerHTML = '';
          el.appendChild(icon);
          el.appendChild(document.createTextNode(' ' + dict[key]));
        } else {
          el.textContent = dict[key];
        }
      }
    });

    document.documentElement.lang = lang;
  }

  function setupLanguageToggles() {
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const chosen = btn.getAttribute('data-lang');
        if (chosen) setLanguage(chosen);
      });
    });
    updateToggleButtonsUI(currentLang);
  }

  function updateToggleButtonsUI(lang) {
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
      const bLang = btn.getAttribute('data-lang');
      if (bLang === lang) {
        btn.classList.add('active');
        btn.style.color = '#38bdf8';
        btn.style.fontWeight = '700';
      } else {
        btn.classList.remove('active');
        btn.style.color = '#94a3b8';
        btn.style.fontWeight = '500';
      }
    });
  }

  window.RED404_I18N = {
    t,
    setLanguage,
    getLanguage: () => currentLang,
    TRANSLATIONS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
