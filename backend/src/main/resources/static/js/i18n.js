/**
 * RED404 — Multi-Language Support Engine (English & Hindi)
 * 
 * High-fidelity human-drafted translation dictionary and automatic phrase engine.
 * RULES:
 * 1. Do NOT use runtime machine translation.
 * 2. Numbers (0-9), blood groups (A+, O-, etc.), and IDs (DNR-*, REQ-*, CERT-*) stay in Latin digits.
 * 3. Choice is persisted in localStorage ('red404_lang') and shared uniformly across public and donor pages.
 * 4. Fallback: If a string is not translated, show English (never undefined, null, or blank).
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
      'profile.scannableQr': 'Scannable donor QR',
      'profile.saveChanges': 'Save changes'
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
      'profile.scannableQr': 'स्कैन करने योग्य रक्तदाता QR',
      'profile.saveChanges': 'परिवर्तन सहेजें'
    }
  };

  // Comprehensive plain-text phrase map for automatic leaf node, placeholder, and attribute translation
  const PHRASE_MAP = {
    // Navigation & Common Links
    'Home': 'होम',
    'About Us': 'हमारे बारे में',
    'Donor Search': 'रक्तदाता खोज',
    'Blood Search': 'रक्त खोज',
    'Contact': 'संपर्क',
    'Donor Login': 'रक्तदाता लॉगिन',
    'Hospital Login': 'अस्पताल लॉगिन',
    'Dashboard': 'डैशबोर्ड',
    'Emergencies': 'आपातकाल',
    'Donation History': 'दान इतिहास',
    'Health Profile': 'स्वास्थ्य प्रोफ़ाइल',
    'Logout': 'लॉगआउट',
    'Quick Links': 'त्वरित लिंक',
    'Explore': 'अन्वेषण करें',
    'Help & Support': 'सहायता और समर्थन',
    'Report Issue': 'समस्या दर्ज करें',
    'Privacy & Policy': 'गोपनीयता और नीति',
    'Privacy Policy': 'गोपनीयता नीति',
    'Terms of Service': 'सेवा की शर्तें',
    'Terms & Conditions': 'नियम और शर्तें',
    'Privacy First': 'गोपनीयता पहले',
    'Privacy & Security': 'गोपनीयता और सुरक्षा',
    'Process Flow': 'कार्य प्रक्रिया',
    'Live Impact': 'लाइव प्रभाव',
    'National Emergency: 112': 'राष्ट्रीय आपातकाल: 112',
    'Toll-Free Helpline:': 'टोल-फ्री हेल्पलाइन:',

    // Home Hero & Marketing
    'Live Blood Network Active': 'लाइव ब्लड नेटवर्क सक्रिय',
    'Every Drop': 'हर एक बूँद',
    'Saves A Life': 'जीवन बचाती है',
    'Search Blood Stock': 'रक्त उपलब्धता देखें',
    'Register as Donor': 'रक्तदाता पंजीकरण',
    'Become a Donor': 'रक्तदाता बनें',
    'Register Hospital': 'अस्पताल पंजीकृत करें',
    'Partner hospital verification required': 'साझेदार अस्पताल सत्यापन आवश्यक है',
    'What We Offer': 'हम क्या प्रदान करते हैं',
    'What we offer': 'हम क्या प्रदान करते हैं',
    'Blood search': 'रक्त खोज',
    'Blood bank directory': 'रक्त बैंक निर्देशिका',
    'Blood Bank Directory': 'रक्त बैंक निर्देशिका',
    'Health screening': 'स्वास्थ्य जांच',
    'Health Screening': 'स्वास्थ्य जांच',
    'Portal access': 'पोर्टल पहुंच',
    'Portal Access': 'पोर्टल पहुंच',
    'Donation drives': 'रक्तदान शिविर',
    'Donation Drives': 'रक्तदान शिविर',
    'Registered Donors': 'पंजीकृत रक्तदाता',
    'Partner Hospitals': 'साझेदार अस्पताल',
    'Verified Donations': 'सत्यापित रक्तदान',
    'Lives Saved': 'बचाई गई जानें',
    'Avg. Response (min)': 'औसत प्रतिक्रिया (मिनट)',
    '% Success Rate': '% सफलता दर',
    'No data yet': 'अभी कोई डेटा नहीं',
    'Blood available across partner hospitals': 'साझेदार अस्पतालों में उपलब्ध रक्त',
    'Real-time inventory aggregated from verified hospitals across our network.': 'हमारे नेटवर्क के सत्यापित अस्पतालों से संकलित लाइव स्टॉक।',
    'Live stock appears here once more hospitals join.': 'अधिक अस्पतालों के जुड़ने पर लाइव स्टॉक यहां दिखाई देगा।',
    'Who Can Donate Blood': 'रक्तदान कौन कर सकता है',
    'Frequently Asked Questions': 'अक्सर पूछे जाने वाले प्रश्न',
    'Frequently Asked': 'अक्सर पूछे जाने वाले प्रश्न',
    'Ready to Save Lives?': 'क्या आप जीवन बचाने के लिए तैयार हैं?',
    'Join our network today. Immediate notification when a patient nearby needs your blood.': 'आज ही हमारे नेटवर्क से जुड़ें। जब आपके आस-पास किसी मरीज को आपके रक्त की आवश्यकता होगी तो तुरंत सूचना मिलेगी।',
    'Join the Network': 'नेटवर्क से जुड़ें',

    // Blood Availability Search Page
    'Haversine Radial Search Engine': 'हैवरसाइन रेडियल खोज इंजन',
    'Real-Time Blood Availability': 'वास्तविक समय रक्त उपलब्धता',
    'Real-Time Blood Availability Search': 'वास्तविक समय रक्त उपलब्धता खोज',
    'Check real-time blood availability within a 5km to 20km Haversine radius.': '5 किमी से 20 किमी के दायरे में वास्तविक समय में रक्त उपलब्धता की जांच करें।',
    'Blood Group': 'रक्त समूह',
    'Blood Group *': 'रक्त समूह *',
    'All Groups': 'सभी समूह',
    'A+ Positive': 'A+ पॉज़िटिव',
    'A- Negative': 'A- नेगेटिव',
    'B+ Positive': 'B+ पॉज़िटिव',
    'B- Negative': 'B- नेगेटिव',
    'AB+ Positive': 'AB+ पॉज़िटिव',
    'AB- Negative': 'AB- नेगेटिव',
    'O+ Positive': 'O+ पॉज़िटिव',
    'O- Negative': 'O- नेगेटिव',
    'Current Location': 'वर्तमान स्थान',
    'Detecting Live GPS...': 'लाइव GPS का पता लगाया जा रहा है...',
    'Radial Radius': 'रेडियल दायरा',
    'Within 5 km': '5 किमी के भीतर',
    'Within 10 km': '10 किमी के भीतर',
    'Within 15 km': '15 किमी के भीतर',
    'Within 20 km': '20 किमी के भीतर',
    'Blood Type': 'रक्त प्रकार',
    'Whole Blood': 'संपूर्ण रक्त',
    'Whole Blood (WB)': 'संपूर्ण रक्त (WB)',
    'Packed Red Cells': 'पैक्ड रेड सेल्स',
    'Platelets (PRP)': 'प्लेटलेट्स (PRP)',
    'Plasma': 'प्लाज्मा',
    'Search Availability': 'उपलब्धता खोजें',
    'Scanning Live Telemetry...': 'लाइव टेलीमेट्री स्कैन की जा रही है...',
    'Telemetry Live': 'टेलीमेट्री लाइव',
    'Action Restricted: Only verified hospitals can dispatch SOS requests.': 'कार्रवाई प्रतिबंधित: केवल सत्यापित अस्पताल ही आपातकालीन SOS अनुरोध भेज सकते हैं।',
    'Dismiss': 'खारिज करें',
    'Go to Hospital Login': 'अस्पताल लॉगिन पर जाएं',
    'Reset Filters': 'फ़िल्टर रीसेट करें',
    'Units Available': 'इकाइयां उपलब्ध',
    'Verified Partner Hospital': 'सत्यापित साझेदार अस्पताल',
    'Get Directions': 'दिशा-निर्देश प्राप्त करें',
    'Call Hospital': 'अस्पताल को कॉल करें',
    'Request via Hospital': 'अस्पताल के माध्यम से अनुरोध करें',
    'Sort By': 'क्रमबद्ध करें',
    'Distance': 'दूरी',
    'Distance (Closest)': 'दूरी (निकटतम)',
    'Total Stock': 'कुल स्टॉक',
    'Total Stock (Highest)': 'कुल स्टॉक (अधिकतम)',

    // About Us Page
    'ABOUT THE COMPANY': 'कंपनी के बारे में',
    '1. Precision & Speed': '1. सटीकता और गति',
    'Hyper-Local Spatial Routing': 'अति-स्थानीय स्थानिक मार्ग',
    '2. Total Data Security': '2. पूर्ण डेटा सुरक्षा',
    'Zero-Knowledge Identity Protection': 'पहचान संरक्षण और पूर्ण गोपनीयता',
    '3. Seamless Infrastructure': '3. निर्बाध बुनियादी ढांचा',
    'Direct Hospital Integration': 'प्रत्यक्ष अस्पताल एकीकरण',

    // Eligibility Checker & Screening
    'AI Clinical Health Screening Chatbot': 'AI क्लिनिकल स्वास्थ्य जांच चैटबॉट',
    'Interactive Donor Eligibility': 'इंटरैक्टिव रक्तदाता पात्रता',
    'Restart Assessment': 'पुनः प्रारंभ करें',
    'Check Full Eligibility': 'पूर्ण पात्रता जांचें',
    'WHO / NBTC Standards Active': 'WHO / NBTC मानक सक्रिय',

    // Donor Dashboard & Alert Hub
    'Emergency requests near you': 'आपके आस-पास आपातकालीन अनुरोध',
    'No active requests near you': 'आपके आस-पास कोई सक्रिय अनुरोध नहीं',
    'See requests': 'अनुरोध देखें',
    'Find Nearby Blood Banks': 'नजदीकी रक्त बैंक खोजें',
    'Check blood availability at hospitals near you.': 'अपने नजदीकी अस्पतालों में रक्त की उपलब्धता देखें।',
    'Search verified blood banks': 'सत्यापित रक्त बैंक खोजें',
    'Verified hospitals': 'सत्यापित अस्पताल',
    'Notifications': 'सूचनाएं',
    'Recent updates': 'हालिया अपडेट',
    'Recent donations': 'हालिया रक्तदान',
    'Community': 'समुदाय',
    'COMMUNITY': 'समुदाय',
    'See all notifications': 'सभी सूचनाएं देखें',
    'See all notifications →': 'सभी सूचनाएं देखें →',
    'Account created': 'खाता बनाया गया',
    'Verified by': 'द्वारा सत्यापित',
    'Self-declared': 'स्व-घोषित',
    'Location': 'स्थान',
    'Availability': 'उपलब्धता',
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
    'FIRST SAVIOR': 'प्रथम रक्षक',
    'First verified donation': 'पहला सत्यापित रक्तदान',
    'Golden Hour Hero': 'गोल्डन ऑवर हीरो',
    'GOLDEN HOUR HERO': 'गोल्डन ऑवर हीरो',
    'Donation within 60 min of alert': 'अलर्ट के 60 मिनट के भीतर रक्तदान',
    'Night Owl': 'नाइट आउल',
    'NIGHT OWL': 'नाइट आउल',
    'Donation between 9 PM and 6 AM': 'रात 9 बजे से सुबह 6 बजे के बीच रक्तदान',
    'Rare Vanguard': 'दुर्लभ रक्षक',
    'RARE VANGUARD': 'दुर्लभ रक्षक',
    'Rare blood group (O- or AB-) donation': 'दुर्लभ रक्त समूह (O- या AB-) रक्तदान',
    'Life Giver V': 'जीवन दाता V',
    'LIFE GIVER V': 'जीवन दाता V',
    '5 verified donations': '5 सत्यापित रक्तदान',
    'Apex Guardian': 'शीर्ष संरक्षक',
    'APEX GUARDIAN': 'शीर्ष संरक्षक',
    '10 verified donations': '10 सत्यापित रक्तदान',
    'Waiting for hospital check': 'अस्पताल जांच की प्रतीक्षा है',
    "No donation yet. You're ready.": 'अभी कोई रक्तदान नहीं हुआ। आप तैयार हैं।',
    "You can donate. The hospital does a final check before donating.": 'आप रक्तदान कर सकते हैं। रक्तदान से पहले अस्पताल अंतिम जांच करता है।',
    'No active requests': 'कोई सक्रिय अनुरोध नहीं',
    "You'll be notified here when a hospital near you needs your blood group.": 'जब आपके आस-पास के अस्पताल को आपके रक्त समूह की आवश्यकता होगी, तो आपको यहां सूचित किया जाएगा।',
    'Location off': 'स्थान बंद है',
    'Live GPS: Connected': 'लाइव GPS: कनेक्टेड',
    'Enable': 'चालू करें',
    'Call hospital': 'अस्पताल को कॉल करें',
    'Directions': 'दिशा-निर्देश',
    'Units Needed': 'इकाइयों की आवश्यकता',
    'Exact match': 'सटीक मिलान',
    'Compatible match': 'संगत मिलान',
    'Accept': 'स्वीकार करें',
    'Decline': 'अस्वीकार करें',
    'Accepted': 'स्वीकृत',
    'Declined': 'अस्वीकृत',
    'Withdrawn': 'वापस लिया गया',
    'Donated': 'दान किया',
    'Arrived': 'पहुंच गए',
    'Pending': 'लंबित',
    'PENDING': 'लंबित',
    'POSITIVE': 'पॉज़िटिव',

    // My Clinical Donations
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
    'Done': 'पूर्ण',
    'Print / Save as PDF': 'प्रिंट / PDF के रूप में सहेजें',
    'My Donations': 'मेरे रक्तदान',

    // Profile & Digital ID
    'Digital Blood Donor ID': 'डिजिटल रक्तदाता पहचान पत्र',
    'Digital Blood Donor Identity Card': 'डिजिटल रक्तदाता पहचान पत्र',
    'Edit Detail': 'विवरण संपादित करें',
    'Change on Map': 'मानचित्र पर बदलें',
    'Preferred Language': 'पसंदीदा भाषा',
    'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Scannable donor QR': 'स्कैन करने योग्य रक्तदाता QR',
    'Save changes': 'परिवर्तन सहेजें',
    'Update your details. Your QR pass updates automatically.': 'अपना विवरण अपडेट करें। आपका क्यूआर पास स्वतः अपडेट हो जाएगा।',
    'Set by hospital': 'अस्पताल द्वारा निर्धारित',
    'Request correction': 'सुधार का अनुरोध करें',
    'Turn on location': 'स्थान चालू करें',
    'Turn on location to receive nearby requests': 'आस-पास के अनुरोध प्राप्त करने के लिए स्थान चालू करें',
    'Auto-Detect My Location': 'मेरा स्थान स्वतः पहचानें',
    'Saved Location & Coordinates': 'सहेजा गया स्थान और निर्देशांक',
    'Street Address': 'सड़क का पता',
    'City / District': 'शहर / जिला',
    'State / Region': 'राज्य / क्षेत्र',
    'PIN Code': 'पिन कोड',

    // Authentication Forms (Login & Register)
    'Welcome Back, Hero!': 'वापसी पर स्वागत है, रक्षक!',
    'Sign in to your RED404 account': 'अपने RED404 खाते में साइन इन करें',
    'Email or Phone': 'ईमेल या फोन',
    'Password': 'पासवर्ड',
    'Remember me': 'मुझे याद रखें',
    'Remember Me': 'मुझे याद रखें',
    'Forgot password?': 'पासवर्ड भूल गए?',
    'Forgot Password?': 'पासवर्ड भूल गए?',
    'Sign In': 'साइन इन करें',
    "Don't have an account?": 'खाता नहीं है?',
    'Register here': 'यहाँ पंजीकरण करें',
    'Already a donor?': 'पहले से रक्तदाता हैं?',
    'Login here': 'यहाँ लॉगिन करें',
    'Hospital Staff Login': 'अस्पताल स्टाफ लॉगिन',
    'Sign in with your hospital credentials': 'अपने अस्पताल क्रेडेंशियल से साइन इन करें',
    'Hospital Registration': 'अस्पताल पंजीकरण',
    'Donor Registration': 'रक्तदाता पंजीकरण',
    'Full Name': 'पूरा नाम',
    'Full Name *': 'पूरा नाम *',
    'Mobile Phone *': 'मोबाइल फोन *',
    'Email Address': 'ईमेल पता',
    'Gender': 'लिंग',
    'Select Gender': 'लिंग चुनें',
    'Male': 'पुरुष',
    'Female': 'महिला',
    'Other': 'अन्य',
    'City': 'शहर',
    'State': 'राज्य',
    'Select State': 'राज्य चुनें',
    'Select District': 'ज़िला चुनें',
    'Date of Birth': 'जन्म तिथि',
    'Weight (kg)': 'वजन (किग्रा)',
    'Confirm Password': 'पासवर्ड की पुष्टि करें',
    'Next': 'आगे',
    'Previous': 'पीछे',
    'Back': 'पीछे',
    'Submit': 'जमा करें',
    'Cancel': 'रद्द करें',
    'Registration Successful!': 'पंजीकरण सफल!',
    'Go to Dashboard': 'डैशबोर्ड पर जाएं',

    // Placeholders
    'Email or phone number': 'ईमेल या फ़ोन नंबर',
    'Your password': 'आपका पासवर्ड',
    'Confirm password': 'पासवर्ड की पुष्टि करें',
    'Search verified blood banks': 'सत्यापित रक्त बैंक खोजें',
    'Search by hospital name or city...': 'अस्पताल के नाम या शहर से खोजें...',
    'Full legal name': 'पूरा कानूनी नाम',
    '10-digit mobile number': '10 अंकों का मोबाइल नंबर'
  };

  let currentLang = 'en';
  let isApplying = false;

  function initI18n() {
    // 1. Resolve initial language from localStorage or session
    const saved = localStorage.getItem('red404_lang');
    if (saved && (saved === 'en' || saved === 'hi')) {
      currentLang = saved;
    } else {
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

    // Listen for storage changes across tabs or windows
    window.addEventListener('storage', (e) => {
      if (e.key === 'red404_lang' && e.newValue && (e.newValue === 'en' || e.newValue === 'hi')) {
        if (e.newValue !== currentLang) {
          currentLang = e.newValue;
          applyTranslations(currentLang);
          updateToggleButtonsUI(currentLang);
        }
      }
    });

    // Debounced mutation observer to translate newly rendered dynamic DOM elements
    if (typeof MutationObserver !== 'undefined' && document.body) {
      let mutTimer = null;
      const observer = new MutationObserver((mutations) => {
        if (isApplying || currentLang !== 'hi') return;
        let hasRelevantAdditions = false;
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
            hasRelevantAdditions = true;
            break;
          }
        }
        if (hasRelevantAdditions) {
          if (mutTimer) clearTimeout(mutTimer);
          mutTimer = setTimeout(() => {
            applyTranslations('hi');
          }, 80);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
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

    // Sync with backend profile if donor is logged in
    try {
      fetch('/api/donor/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredLanguage: lang }),
        credentials: 'include'
      }).catch(() => {});
    } catch (_) {}

    // Dispatch global event for custom components
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('red404_language_changed', { detail: { lang } }));
      }
    } catch (_) {}
  }

  function applyTranslations(lang) {
    if (isApplying) return;
    isApplying = true;

    try {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

      // 1. Explicit [data-i18n] elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && dict[key] !== undefined) {
          const icon = el.querySelector('i, svg');
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
          // Leaf elements (0 child elements or exactly 1 icon/svg child)
          const childCount = node.children ? node.children.length : 0;
          const isLeaf = (childCount === 0 || (childCount === 1 && node.children[0] && (node.children[0].tagName === 'I' || node.children[0].tagName === 'SVG')));
          if (isLeaf) {
            if (node.classList && (node.classList.contains('lang-toggle-btn') || node.classList.contains('lang-toggle-pill') || node.classList.contains('nav-lang-toggle'))) continue;
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'CODE') continue;

            let rawText = '';
            const icon = node.querySelector ? node.querySelector('i, svg') : null;
            if (icon) {
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
        // Revert phrase mapped elements back to English
        document.querySelectorAll('[data-orig-en]').forEach(el => {
          const orig = el.getAttribute('data-orig-en');
          if (orig) {
            const icon = el.querySelector('i, svg');
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

      // 3. Input & Textarea Placeholders
      document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
        const ph = el.getAttribute('placeholder');
        if (!ph) return;
        if (lang === 'hi') {
          const trimmed = ph.trim();
          if (PHRASE_MAP[trimmed]) {
            if (!el.getAttribute('data-orig-placeholder')) {
              el.setAttribute('data-orig-placeholder', ph);
            }
            el.setAttribute('placeholder', PHRASE_MAP[trimmed]);
          }
        } else {
          const origPh = el.getAttribute('data-orig-placeholder');
          if (origPh) {
            el.setAttribute('placeholder', origPh);
          }
        }
      });

      // 4. Element Title Attributes
      document.querySelectorAll('[title]').forEach(el => {
        const title = el.getAttribute('title');
        if (!title) return;
        if (lang === 'hi') {
          const trimmed = title.trim();
          if (PHRASE_MAP[trimmed]) {
            if (!el.getAttribute('data-orig-title')) {
              el.setAttribute('data-orig-title', title);
            }
            el.setAttribute('title', PHRASE_MAP[trimmed]);
          }
        } else {
          const origTitle = el.getAttribute('data-orig-title');
          if (origTitle) {
            el.setAttribute('title', origTitle);
          }
        }
      });

      document.documentElement.lang = lang;
    } finally {
      isApplying = false;
    }
  }

  function setupLanguageToggles() {
    document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
      // Clean clone to avoid duplicate listeners
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
    PHRASE_MAP,
    applyTranslations,
    setupLanguageToggles
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();
