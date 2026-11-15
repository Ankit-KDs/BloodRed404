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
      'hero.btnBecomeDonor': 'Become a Donor',
      'hero.btnRegisterHospital': 'Register Hospital',
      'hero.verificationNotice': 'Partner hospital verification required',

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
      'stats.avgResponse': 'Avg. Response (min)',
      'stats.successRate': '% Success Rate',
      'stats.noData': 'No data yet',

      // Blood Stock
      'stock.title': 'Blood available across partner hospitals',
      'stock.subtitle': 'Real-time inventory aggregated from verified hospitals across our network.',
      'stock.empty': 'Live stock appears here once more hospitals join.',

      // Who Can Donate & FAQ
      'eligibility.title': 'Who Can Donate Blood',
      'eligibility.age': 'Age: 18 to 65 years',
      'eligibility.weight': 'Weight: At least 45 kg',
      'eligibility.gap': 'Gap between donations: 90 days for men, 120 days for women',
      'faq.title': 'Frequently Asked Questions',
      'privacy.note': 'Privacy Note: Hospitals see your phone number only after you accept a request.',
      'ready.title': 'Ready to Save Lives?',
      'ready.subtitle': 'Join our network today. Immediate notification when a patient nearby needs your blood.',

      // Donor Dashboard
      'dash.emergencyTitle': 'Emergency requests near you',
      'dash.noRequests': 'No active requests near you',
      'dash.seeRequests': 'See requests',
      'dash.nearbyHospitals': 'Find Nearby Blood Banks',
      'dash.nearbyDesc': 'Check blood availability at hospitals near you.',
      'dash.searchBloodBanks': 'Search verified blood banks',
      'dash.verifiedHospitals': 'Verified hospitals',
      'dash.notifications': 'Notifications',
      'dash.recentUpdates': 'Recent updates',
      'dash.recentDonations': 'Recent donations',
      'dash.community': 'Community',
      'dash.seeAllNotif': 'See all notifications',
      'dash.accountCreated': 'Account created',
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

      // Eligibility Capsule
      'eligibility.noDonation': "No donation yet. You're ready.",
      'eligibility.readyAfter': "You can donate. The hospital does a final check before donating.",
      'eligibility.waitingCheck': 'Waiting for hospital check',

      // Emergencies (Alerts)
      'alerts.noRequests': 'No active requests',
      'alerts.standby': "You'll be notified here when a hospital near you needs your blood group.",
      'alerts.locationOff': 'Location off',
      'alerts.locationConnected': 'Live GPS: Connected',
      'alerts.enableLocation': 'Enable',
      'alerts.callHospital': 'Call hospital',
      'alerts.directions': 'Directions',

      // My Donations
      'donations.yourDonations': 'Your donations',
      'donations.recordedBy': 'Donations recorded by hospitals',
      'donations.downloadCert': 'Download certificate',
      'donations.exportCsv': 'Export CSV',
      'donations.level': 'Level',
      'donations.colDate': 'Date',
      'donations.colHospital': 'Hospital',
      'donations.colBloodGroup': 'Blood group',
      'donations.colVolume': 'Volume (mL)',
      'donations.colRecordId': 'Record ID',
      'donations.colCertificate': 'Certificate',
      'donations.empty': 'No verified donations yet.',

      // Profile
      'profile.digitalId': 'Digital Blood Donor ID',
      'profile.editDetail': 'Edit Detail',
      'profile.changeOnMap': 'Change on Map',
      'profile.prefLang': 'Preferred Language',
      'profile.notifPrefs': 'Notification Preferences',
      'profile.scannableQr': 'Scannable donor QR'
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
      'hero.btnBecomeDonor': 'रक्तदाता बनें',
      'hero.btnRegisterHospital': 'अस्पताल पंजीकृत करें',
      'hero.verificationNotice': 'साझेदार अस्पताल सत्यापन आवश्यक है',

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
      'stats.avgResponse': 'औसत प्रतिक्रिया (मिनट)',
      'stats.successRate': '% सफलता दर',
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
      'ready.title': 'क्या आप जीवन बचाने के लिए तैयार हैं?',
      'ready.subtitle': 'आज ही हमारे नेटवर्क से जुड़ें। जब आपके आस-पास किसी मरीज को आपके रक्त की आवश्यकता होगी तो तुरंत सूचना मिलेगी।',

      // Donor Dashboard
      'dash.emergencyTitle': 'आपके आस-पास आपातकालीन अनुरोध',
      'dash.noRequests': 'आपके आस-पास कोई सक्रिय अनुरोध नहीं',
      'dash.seeRequests': 'अनुरोध देखें',
      'dash.nearbyHospitals': 'नजदीकी रक्त बैंक खोजें',
      'dash.nearbyDesc': 'अपने नजदीकी अस्पतालों में रक्त की उपलब्धता देखें।',
      'dash.searchBloodBanks': 'सत्यापित रक्त बैंक खोजें',
      'dash.verifiedHospitals': 'सत्यापित अस्पताल',
      'dash.notifications': 'सूचनाएं',
      'dash.recentUpdates': 'हालिया अपडेट',
      'dash.recentDonations': 'हालिया रक्तदान',
      'dash.community': 'समुदाय',
      'dash.seeAllNotif': 'सभी सूचनाएं देखें',
      'dash.accountCreated': 'खाता बनाया गया',
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

      // Eligibility Capsule
      'eligibility.noDonation': 'अभी कोई रक्तदान नहीं हुआ। आप तैयार हैं।',
      'eligibility.readyAfter': 'आप रक्तदान कर सकते हैं। रक्तदान से पहले अस्पताल अंतिम जांच करता है।',
      'eligibility.waitingCheck': 'अस्पताल जांच की प्रतीक्षा है',

      // Emergencies (Alerts)
      'alerts.noRequests': 'कोई सक्रिय अनुरोध नहीं',
      'alerts.standby': 'जब आपके आस-पास के अस्पताल को आपके रक्त समूह की आवश्यकता होगी, तो आपको यहां सूचित किया जाएगा।',
      'alerts.locationOff': 'स्थान बंद है',
      'alerts.locationConnected': 'लाइव GPS: कनेक्टेड',
      'alerts.enableLocation': 'चालू करें',
      'alerts.callHospital': 'अस्पताल को कॉल करें',
      'alerts.directions': 'दिशा-निर्देश',

      // My Donations
      'donations.yourDonations': 'आपके रक्तदान',
      'donations.recordedBy': 'अस्पतालों द्वारा दर्ज रक्तदान',
      'donations.downloadCert': 'प्रमाण पत्र डाउनलोड करें',
      'donations.exportCsv': 'CSV निर्यात करें',
      'donations.level': 'स्तर',
      'donations.colDate': 'दिनांक',
      'donations.colHospital': 'अस्पताल',
      'donations.colBloodGroup': 'रक्त समूह',
      'donations.colVolume': 'मात्रा (mL)',
      'donations.colRecordId': 'रिकॉर्ड ID',
      'donations.colCertificate': 'प्रमाण पत्र',
      'donations.empty': 'अभी तक कोई सत्यापित रक्तदान नहीं।',

      // Profile
      'profile.digitalId': 'डिजिटल रक्तदाता पहचान पत्र',
      'profile.editDetail': 'विवरण संपादित करें',
      'profile.changeOnMap': 'मानचित्र पर बदलें',
      'profile.prefLang': 'पसंदीदा भाषा',
      'profile.notifPrefs': 'सूचना प्राथमिकताएं',
      'profile.scannableQr': 'स्कैन करने योग्य रक्तदाता QR'
    }
  };

  // Plain-text phrase map for automatic leaf node translation
  const PHRASE_MAP = {
    'Home': 'होम',
    'Dashboard': 'डैशबोर्ड',
    'Emergencies': 'आपातकाल',
    'Donation History': 'दान इतिहास',
    'Health Profile': 'स्वास्थ्य प्रोफ़ाइल',
    'Logout': 'लॉगआउट',
    'Privacy & Security': 'गोपनीयता और सुरक्षा',
    'Emergency requests near you': 'आपके आस-पास आपातकालीन अनुरोध',
    'No active requests near you': 'आपके आस-पास कोई सक्रिय अनुरोध नहीं',
    'See requests': 'अनुरोध देखें',
    'Find Nearby Blood Banks': 'नजदीकी रक्त बैंक खोजें',
    'Check blood availability at hospitals near you.': 'अपने नजदीकी अस्पतालों में रक्त की उपलब्धता देखें।',
    'Search verified blood banks': 'सत्यापित रक्त बैंक खोजें',
    'Verified hospitals': 'सत्यापित अस्पताल',
    'Verified partner hospitals': 'सत्यापित साझेदार अस्पताल',
    'Notifications': 'सूचनाएं',
    'Recent updates': 'हालिया अपडेट',
    'Recent donations': 'हालिया रक्तदान',
    'Community': 'समुदाय',
    'See all notifications': 'सभी सूचनाएं देखें',
    'Account created': 'खाता बनाया गया',
    'Available to donate': 'रक्तदान के लिए उपलब्ध',
    'Paused': 'विराम पर',
    'Pause': 'रोकें',
    'Resume Availability': 'उपलब्धता पुनः चालू करें',
    'Upcoming Donation Drives': 'आगामी रक्तदान शिविर',
    'No upcoming donation drives in your area right now.': 'वर्तमान में आपके क्षेत्र में कोई आगामी शिविर नहीं है।',
    "I'll attend": 'मैं आऊंगा',
    'Not now': 'अभी नहीं',
    'Earned Badges': 'अर्जित पदक',
    'First Savior': 'प्रथम रक्षक',
    'First verified donation': 'पहला सत्यापित रक्तदान',
    'Golden Hour Hero': 'गोल्डन ऑवर हीरो',
    'Donation within 60 min of alert': 'अलर्ट के 60 मिनट के भीतर रक्तदान',
    'Night Owl': 'नाइट आउल',
    'Donation between 9 PM and 6 AM': 'रात 9 बजे से सुबह 6 बजे के बीच रक्तदान',
    'Rare Vanguard': 'दुर्लभ रक्षक',
    'Rare blood group (O- or AB-) donation': 'दुर्लभ रक्त समूह (O- या AB-) रक्तदान',
    'Life Giver V': 'जीवन दाता V',
    '5 verified donations': '5 सत्यापित रक्तदान',
    'Apex Guardian': 'शीर्ष संरक्षक',
    '10 verified donations': '10 सत्यापित रक्तदान',
    'No active requests': 'कोई सक्रिय अनुरोध नहीं',
    "You'll be notified here when a hospital near you needs your blood group.": 'जब आपके आस-पास के अस्पताल को आपके रक्त समूह की आवश्यकता होगी, तो आपको यहां सूचित किया जाएगा।',
    'Location off': 'स्थान बंद है',
    'Live GPS: Connected': 'लाइव GPS: कनेक्टेड',
    'Enable': 'चालू करें',
    'Call hospital': 'अस्पताल को कॉल करें',
    'Directions': 'दिशा-निर्देश',
    'Your donations': 'आपके रक्तदान',
    'Donations recorded by hospitals': 'अस्पतालों द्वारा दर्ज रक्तदान',
    'Download certificate': 'प्रमाण पत्र डाउनलोड करें',
    'Export CSV': 'CSV निर्यात करें',
    'Level': 'स्तर',
    'Date': 'दिनांक',
    'Hospital': 'अस्पताल',
    'Blood group': 'रक्त समूह',
    'Volume (mL)': 'मात्रा (mL)',
    'Record ID': 'रिकॉर्ड ID',
    'Certificate': 'प्रमाण पत्र',
    'No verified donations yet.': 'अभी तक कोई सत्यापित रक्तदान नहीं।',
    'Digital Blood Donor ID': 'डिजिटल रक्तदाता पहचान पत्र',
    'Digital Blood Donor Identity Card': 'डिजिटल रक्तदाता पहचान पत्र',
    'Edit Detail': 'विवरण संपादित करें',
    'Change on Map': 'मानचित्र पर बदलें',
    'Preferred Language': 'पसंदीदा भाषा',
    'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Scannable donor QR': 'स्कैन करने योग्य रक्तदाता QR',
    'Waiting for hospital check': 'अस्पताल जांच की प्रतीक्षा है',
    "No donation yet. You're ready.": 'अभी कोई रक्तदान नहीं हुआ। आप तैयार हैं।',
    "You can donate. The hospital does a final check before donating.": 'आप रक्तदान कर सकते हैं। रक्तदान से पहले अस्पताल अंतिम जांच करता है।',
    'Become a Donor': 'रक्तदाता बनें',
    'Register Hospital': 'अस्पताल पंजीकृत करें',
    'Partner hospital verification required': 'साझेदार अस्पताल सत्यापन आवश्यक है',
    'Ready to Save Lives?': 'क्या आप जीवन बचाने के लिए तैयार हैं?',
    'Join our network today. Immediate notification when a patient nearby needs your blood.': 'आज ही हमारे नेटवर्क से जुड़ें। जब आपके आस-पास किसी मरीज को आपके रक्त की आवश्यकता होगी तो तुरंत सूचना मिलेगी।',
    'Who Can Donate Blood': 'रक्तदान कौन कर सकता है',
    'Frequently Asked Questions': 'अक्सर पूछे जाने वाले प्रश्न',
    'What We Offer': 'हम क्या प्रदान करते हैं',
    'Registered Donors': 'पंजीकृत रक्तदाता',
    'Partner Hospitals': 'साझेदार अस्पताल',
    'Verified Donations': 'सत्यापित रक्तदान',
    'Lives Saved': 'बचाई गई जानें',
    'No data yet': 'अभी कोई डेटा नहीं'
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
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('red404_language_changed', { detail: { lang } }));
      }
    } catch (_) {}
  }

  function applyTranslations(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    
    // 1. Explicit [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && dict[key] !== undefined) {
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

    // 2. Translate leaf elements using static human-drafted phrase map
    if (lang === 'hi' && document.body && document.createTreeWalker) {
      const filterVal = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_ELEMENT) ? NodeFilter.SHOW_ELEMENT : 1;
      const textNodeType = (typeof Node !== 'undefined' && Node.TEXT_NODE) ? Node.TEXT_NODE : 3;
      const walker = document.createTreeWalker(document.body, filterVal, null, false);
      let node;
      while ((node = walker.nextNode())) {
        // Only target leaf elements (elements with no child elements, or exactly 1 icon child)
        if (node.children && (node.children.length === 0 || (node.children.length === 1 && node.children[0].tagName === 'I'))) {
          if (node.classList && (node.classList.contains('lang-toggle-btn') || node.classList.contains('lang-toggle-pill'))) continue;
          if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') continue;

          let rawText = '';
          const icon = node.querySelector ? node.querySelector('i') : null;
          if (icon) {
            // Text outside the icon
            rawText = Array.from(node.childNodes || [])
              .filter(cn => cn.nodeType === textNodeType)
              .map(cn => cn.nodeValue)
              .join('').trim();
          } else {
            rawText = (node.textContent || '').trim();
          }

          if (rawText && PHRASE_MAP[rawText]) {
            if (!node.getAttribute('data-orig-en')) {
              node.setAttribute('data-orig-en', rawText);
            }
            const hiText = PHRASE_MAP[rawText];
            if (icon) {
              node.innerHTML = '';
              node.appendChild(icon);
              node.appendChild(document.createTextNode(' ' + hiText));
            } else {
              node.textContent = hiText;
            }
          }
        }
      }
    } else {
      // Revert any phrase mapped elements back to English
      document.querySelectorAll('[data-orig-en]').forEach(el => {
        const orig = el.getAttribute('data-orig-en');
        if (orig) {
          const icon = el.querySelector('i');
          if (icon) {
            el.innerHTML = '';
            el.appendChild(icon);
            el.appendChild(document.createTextNode(' ' + orig));
          } else {
            el.textContent = orig;
          }
        }
      });
    }

    document.documentElement.lang = lang;
  }

  function setupLanguageToggles() {
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
      // Remove old listener clones to prevent double triggers
      const clone = btn.cloneNode(true);
      if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', (e) => {
        e.preventDefault();
        const chosen = clone.getAttribute('data-lang');
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
    TRANSLATIONS,
    applyTranslations
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
