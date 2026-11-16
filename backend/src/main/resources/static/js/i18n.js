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
      'nav.donorSearch': 'Donor Search',
      'nav.bloodBanks': 'Blood Banks',
      'nav.eligibility': 'Eligibility',
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
      'services.title': 'Our Services',
      'services.titlePre': 'Our',
      'services.titleHighlight': 'Services',
      'services.subtitle': 'Connecting voluntary donors with nearby hospitals when emergency blood is needed.',
      'services.tab1': 'Blood Availability Search',
      'services.tab2': 'Blood Bank Directory',
      'services.tab3': 'Health Screening',
      'services.tab4': 'Portal Access',
      'services.tab5': 'Donation Drives',

      // Service Pane 1
      'services.pane1.heading': 'Real-Time Blood Availability Search',
      'services.pane1.text': 'Check blood availability within 5km to 20km. See available donors and regional stock without sharing personal identities.',
      'services.pane1.feat1': '5km to 20km radius search',
      'services.pane1.feat2': 'Private and secure: donor personal details stay anonymous.',
      'services.pane1.feat3': 'Fast alerts directly to matching donors',
      'services.pane1.btn': 'Search Availability',
      'services.pane1.accText': 'Check blood availability within 5km to 20km without sharing personal details.',

      // Service Pane 2
      'services.pane2.heading': 'Blood Bank Directory',
      'services.pane2.text': 'Find verified hospital blood banks and blood storage centres. Look up contact numbers and available blood units.',
      'services.pane2.feat1': 'Verified partner hospitals',
      'services.pane2.feat1Mob': 'Verified government & partner hospitals',
      'services.pane2.feat2': 'Direct phone and contact details',
      'services.pane2.feat3': 'Blood units by group, updated by each hospital',
      'services.pane2.btn': 'View Directory',
      'services.pane2.accText': 'Find verified hospital blood banks and blood storage centres near you.',

      // Service Pane 3
      'services.pane3.heading': 'Interactive Health Screening',
      'services.pane3.text': 'Not sure if you are eligible to donate today? Take our quick interactive health screening to instantly verify your status based on age, weight, and recent medical history.',
      'services.pane3.feat1': 'Adheres to WHO & NBTC donor standards',
      'services.pane3.feat2': 'Interactive questionnaire for rapid eligibility check',
      'services.pane3.feat3': 'Clear guidance on recovery times and donation gaps',
      'services.pane3.btn': 'Start Health Screening',
      'services.pane3.accText': 'Check your eligibility to donate blood with our quick screening questions.',

      // Service Pane 4
      'services.pane4.heading': 'Secure Portal Access',
      'services.pane4.text': 'Dedicated portals for registered voluntary donors and verified hospitals to manage requests and donations.',
      'services.pane4.feat1': 'Donor Portal: track donations, eligibility and requests',
      'services.pane4.feat2': 'Hospital Portal: request blood and update inventory',
      'services.pane4.feat3': 'Secure authentication and verified accounts',
      'services.pane4.btnDonor': 'Donor Login',
      'services.pane4.btnHospital': 'Hospital Login',
      'services.pane4.accText': 'Dedicated portals for registered voluntary donors and verified hospitals.',

      // Service Pane 5
      'services.pane5.heading': 'Donation Drives',
      'services.pane5.text': 'Verified partner hospitals organize blood donation drives. Registered voluntary donors receive invitations and can RSVP directly.',
      'services.pane5.feat1': 'Verified blood donation camps',
      'services.pane5.feat2': 'Location, date and organizer details',
      'services.pane5.feat3': 'Easy RSVP and directions',
      'services.pane5.btn': 'Register to Participate',
      'services.pane5.btnMob': 'Explore Campaigns',
      'services.pane5.accText': 'Find upcoming blood donation drives and camps organized near you.',

      // Home Stats
      'hero.statsRegisteredDonors': 'Registered Donors',
      'hero.statsVerifiedHospitals': 'Verified Hospitals',
      'hero.statsDonationsRecorded': 'Donations Recorded',
      'stats.registeredDonors': 'Registered Donors',
      'stats.verifiedHospitals': 'Verified Hospitals',
      'stats.donationsRecorded': 'Donations Recorded',
      'bloodTypes.label': 'Blood Types We Cover:',
      'stats.donors': 'Registered Donors',
      'stats.hospitals': 'Partner Hospitals',
      'stats.donations': 'Verified Donations',
      'stats.livesSaved': 'Lives Saved',
      'stats.avgResponse': 'Avg. Response (min)',
      'stats.successRate': '% Success Rate',
      'stats.noData': 'No data yet',

      // Blood Stock
      'stock.live': 'LIVE',
      'stock.title': 'Blood available at partner hospitals',
      'stock.subtitle': 'Units recorded by verified partner hospitals.',
      'stock.empty': 'Live stock appears here once more hospitals join.',
      'stock.units': 'Units',
      'stock.ok': 'OK',
      'stock.low': 'Low',
      'stock.critical': 'Critical',
      'stock.updatedAgo': 'Updated {ago}',
      'stock.updatedJustNow': 'Updated just now',

      // Public Availability Search
      'search.heroBadge': 'Public Blood Availability Search',
      'search.heroTitle': 'Find Voluntary Donors',
      'search.promptTitle': 'Find Voluntary Donors',
      'search.promptDesc': 'Select a blood group and enter your city or PIN code, then click Search to find available voluntary donors near you.',
      'bloodBanks.promptTitle': 'Verified Blood Bank Directory',
      'bloodBanks.promptDesc': 'Search by hospital name, city, or PIN code, click "Near me", or select a blood group filter to view verified blood banks and real-time reserves.',
      'search.heroSubtitle': 'Looking for hospital stock? See the blood bank directory.',
      'search.lookingForStock': 'Looking for hospital stock? See the',
      'search.bloodBankDir': 'blood bank directory',
      'search.labelBloodGroup': 'Blood Group',
      'search.labelLocation': 'Location',
      'search.labelRadius': 'Radius',
      'search.placeholderLocation': 'City or 6-digit PIN (e.g. Bhimtal, 263136)',
      'search.btnUseGps': 'Use GPS',
      'search.btnGpsDetecting': 'Detecting...',
      'search.btnGpsActive': 'Location on',
      'search.btnSubmit': 'Search',
      'search.btnSearching': 'Searching...',
      'search.privacyNotice': 'Your location is approximate. Only donors who have chosen to appear in public search are listed.',
      'search.infoLine': 'Only hospitals can send blood requests.',
      'search.hospitalLogin': 'Hospital login',
      'search.becomeDonor': 'Become a donor',
      'search.medicalNotice': 'Only hospitals can send blood requests.',
      'search.hospitalsHeading': 'Verified Partner Hospitals',
      'search.hospitalsSub': 'Accredited institutions with confirmed blood bank stock within {radius} km.',
      'search.noHospitals': 'No partner hospitals with confirmed stock in this immediate radius.',
      'search.unitsOf': 'units of',
      'search.compatibleGroups': 'Compatible groups ({units} units)',
      'search.stockUpdated': 'Stock updated {ago}',
      'search.directions': 'Directions',
      'search.emergencyPhone': 'Emergency:',
      'search.donorsHeading': 'Nearby Voluntary Donors (Aggregate Counts)',
      'search.donorsSub': 'Active, eligible voluntary donors matching clinical criteria within radial bands. This is not a guarantee of availability.',
      'search.exactMatch': 'Exact Match',
      'search.compatibleLabel': 'Compatible Groups:',
      'search.totalInBand': 'Total in Band:',
      'search.none': 'None',
      'search.fewerThan3': 'Fewer than 3',
      'search.locationRequired': 'Location Required',
      'search.locationRequiredDesc': 'Please enter your city, 6-digit PIN code, or click "Use GPS" to check availability within {radius} km.',
      'search.emptyTitle': 'No Current Availability in this Radial Band',
      'search.emptyDesc': 'No verified partner hospitals or active voluntary donors found within {radius} km for {bloodGroup}. Try selecting a wider radius (e.g. 20 km) or entering a neighboring city or PIN code.',
      'search.expandRadius': 'Expand to 20 km',
      'search.rateLimitTitle': 'Rate Limit Active',
      'search.errorTitle': 'Unable to Complete Availability Search',
      'search.retry': 'Retry Search',

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
      'profile.saveChanges': 'Save changes',
      'profile.vitalsTitle': 'Donor Profile & Vital Health Stats',
      'profile.historyTitle': 'Health Check History',
      'profile.trackerTitle': 'Medical Eligibility Tracker',
      'profile.milestonesTitle': 'Donor Impact Milestones',
      'profile.age': 'Age:',
      'profile.weight': 'Weight:',
      'profile.pulse': 'Pulse:',
      'profile.hemoglobin': 'Hemoglobin:',
      'profile.bloodPressure': 'Blood Pressure:',
      'profile.temperature': 'Body Temperature:',
      'profile.waitingCheck': 'Waiting for hospital check',
      'profile.withinRange': 'Within usual range',
      'profile.outsideRange': 'Outside usual range. Please speak to the hospital doctor',
      'profile.residentialAddress': 'Residential Address',
      'profile.fatherName': "Father's Name",
      'profile.verifiedFacility': 'Verified Facility',
      'profile.lastDonationDate': 'Last Donation Date',
      'profile.knownAllergies': 'Known Allergies',
      'profile.existingConditions': 'Existing Medical Conditions',
      'profile.currentMedications': 'Current Medications',
      'profile.previousSurgeries': 'Previous Surgeries (< 12 mos)',
      'profile.noneRecorded': 'None recorded',

      // About Page (Part 6)
      'about.h1': 'Helping hospitals find blood donors nearby',
      'about.intro': 'RED404 is a voluntary community project that connects registered blood donors with verified hospitals in the same area. When a hospital needs blood for a patient, it can reach eligible donors nearby in minutes instead of calling people one by one.',
      'about.whyTitle': 'Why we built it',
      'about.whyDesc': 'Finding the right blood group in time often depends on phone calls, messages and luck. Donors want to help but rarely know when they are needed. Hospitals know what they need but cannot see who is nearby and able to donate. RED404 puts both sides in one place.',
      'about.forDonorsTitle': 'For donors',
      'about.forDonorsDesc': 'You register with your blood group and location. A hospital confirms your details when you visit. You are notified only when your blood group is needed nearby and you are eligible. You can accept or decline, get directions, and pause your availability whenever you like. After a donation you see it in your history, can download a certificate and see when you can donate again.',
      'about.forHospitalsTitle': 'For hospitals',
      'about.forHospitalsDesc': 'A hospital registers and is verified by our team before it can send requests. You keep your blood stock up to date, search for eligible donors by blood group and distance, send a request, and record each donation when the donor arrives.',
      'about.verifiedByTitle': 'Verified by whom?',
      'about.verifiedByDesc': 'Hospitals are reviewed and verified by our platform team before they can broadcast requests.',
      'about.privacyTitle': 'Your privacy',
      'about.privacyDesc': 'Hospitals see your phone number only after you accept their request. Public pages never show your phone, address or exact location. Donors appear in public search only if they choose to. Your location is used only to find requests near you. You can ask us to delete your account.',
      'about.safetyTitle': 'Safety and medical decisions',
      'about.safetyDesc': 'Basic eligibility guidelines (age, weight, hemoglobin and the gap between donations) are shown on the site. They are a guide, not medical advice. A hospital doctor makes the final decision, and health measurements come from the hospital, not from the donor.',
      'about.notServiceTitle': 'What RED404 is not',
      'about.notServiceDesc': 'RED404 is not an ambulance or emergency service. In a medical emergency call 112. It is not a blood bank itself; stock figures are entered by each hospital and may be a few minutes old.',
      'about.questionsTitle': 'Questions or feedback',
      'about.questionsPrefix': 'If you have questions, feedback or need assistance, visit our',
      'about.contactLink': 'Contact',
      'about.questionsOr': 'section or',
      'about.faqLink': 'FAQ',
      'about.questionsEmail': 'or email us at',
      'about.btnBecomeDonor': 'Become a donor',
      'about.btnRegisterHospital': 'Register your hospital'
    },

    hi: {
      // Navigation
      'nav.home': 'होम',
      'nav.about': 'हमारे बारे में',
      'nav.search': 'रक्त खोज',
      'nav.donorSearch': 'रक्तदाता खोज',
      'nav.bloodBanks': 'रक्त बैंक',
      'nav.eligibility': 'पात्रता',
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
      'services.title': 'हमारी सेवाएं',
      'services.titlePre': 'हमारी',
      'services.titleHighlight': 'सेवाएं',
      'services.subtitle': 'आपातकालीन स्थिति में स्वैच्छिक रक्तदाताओं को नजदीकी अस्पतालों से जोड़ना।',
      'services.tab1': 'रक्त उपलब्धता खोज',
      'services.tab2': 'रक्त बैंक निर्देशिका',
      'services.tab3': 'स्वास्थ्य जांच',
      'services.tab4': 'पोर्टल पहुंच',
      'services.tab5': 'रक्तदान शिविर',

      // Service Pane 1
      'services.pane1.heading': 'वास्तविक समय रक्त उपलब्धता खोज',
      'services.pane1.text': '5 किमी से 20 किमी के दायरे में रक्त उपलब्धता की जांच करें। व्यक्तिगत पहचान साझा किए बिना उपलब्ध रक्तदाताओं और क्षेत्रीय स्टॉक को देखें।',
      'services.pane1.feat1': '5 किमी से 20 किमी त्रिज्या खोज',
      'services.pane1.feat2': 'निजी और सुरक्षित: रक्तदाता का व्यक्तिगत विवरण गोपनीय रहता है।',
      'services.pane1.feat3': 'योग्य रक्तदाताओं को सीधे त्वरित अलर्ट',
      'services.pane1.btn': 'उपलब्धता खोजें',
      'services.pane1.accText': 'व्यक्तिगत विवरण साझा किए बिना 5 किमी से 20 किमी के भीतर रक्त उपलब्धता की जांच करें।',

      // Service Pane 2
      'services.pane2.heading': 'रक्त बैंक निर्देशिका',
      'services.pane2.text': 'सत्यापित अस्पताल रक्त बैंक और रक्त भंडारण केंद्र खोजें। संपर्क नंबर और उपलब्ध रक्त यूनिट देखें।',
      'services.pane2.feat1': 'सत्यापित साझेदार अस्पताल',
      'services.pane2.feat1Mob': 'सत्यापित सरकारी और साझेदार अस्पताल',
      'services.pane2.feat2': 'सीधा फोन नंबर और संपर्क विवरण',
      'services.pane2.feat3': 'रक्त समूह के अनुसार यूनिट, प्रत्येक अस्पताल द्वारा अपडेट किया गया',
      'services.pane2.btn': 'निर्देशिका देखें',
      'services.pane2.accText': 'अपने नजदीकी सत्यापित अस्पताल रक्त बैंक और रक्त भंडारण केंद्र खोजें।',

      // Service Pane 3
      'services.pane3.heading': 'इंटरएक्टिव स्वास्थ्य जांच',
      'services.pane3.text': 'क्या आप सुनिश्चित नहीं हैं कि आज रक्तदान कर सकते हैं? आयु, वजन और हालिया चिकित्सा इतिहास के आधार पर अपनी स्थिति की तुरंत जांच करने के लिए हमारा त्वरित इंटरएक्टिव स्वास्थ्य परीक्षण लें।',
      'services.pane3.feat1': 'WHO और NBTC रक्तदाता मानकों का पालन',
      'services.pane3.feat2': 'त्वरित पात्रता जांच के लिए इंटरएक्टिव प्रश्नावली',
      'services.pane3.feat3': 'पुनर्प्राप्ति समय और रक्तदान अंतराल पर स्पष्ट मार्गदर्शन',
      'services.pane3.btn': 'स्वास्थ्य जांच शुरू करें',
      'services.pane3.accText': 'हमारे त्वरित जांच प्रश्नों के साथ रक्तदान करने की अपनी पात्रता की जांच करें।',

      // Service Pane 4
      'services.pane4.heading': 'सुरक्षित पोर्टल पहुंच',
      'services.pane4.text': 'पंजीकृत स्वैच्छिक रक्तदाताओं और सत्यापित अस्पतालों के लिए अनुरोध और रक्तदान प्रबंधन हेतु समर्पित पोर्टल।',
      'services.pane4.feat1': 'रक्तदाता पोर्टल: रक्तदान, पात्रता और अनुरोधों को ट्रैक करें',
      'services.pane4.feat2': 'अस्पताल पोर्टल: रक्त का अनुरोध करें और इन्वेंट्री अपडेट करें',
      'services.pane4.feat3': 'सुरक्षित प्रमाणीकरण और सत्यापित खाते',
      'services.pane4.btnDonor': 'रक्तदाता लॉगिन',
      'services.pane4.btnHospital': 'अस्पताल लॉगिन',
      'services.pane4.accText': 'पंजीकृत स्वैच्छिक रक्तदाताओं और सत्यापित अस्पतालों के लिए समर्पित पोर्टल।',

      // Service Pane 5
      'services.pane5.heading': 'रक्तदान शिविर',
      'services.pane5.text': 'सत्यापित साझेदार अस्पताल रक्तदान शिविर आयोजित करते हैं। पंजीकृत स्वैच्छिक रक्तदाताओं को आमंत्रण प्राप्त होते हैं और वे सीधे पुष्टि कर सकते हैं।',
      'services.pane5.feat1': 'सत्यापित रक्तदान शिविर',
      'services.pane5.feat2': 'स्थान, तिथि और आयोजक विवरण',
      'services.pane5.feat3': 'आसान RSVP और दिशा-निर्देश',
      'services.pane5.btn': 'भाग लेने के लिए पंजीकरण करें',
      'services.pane5.btnMob': 'अभियानों को देखें',
      'services.pane5.accText': 'अपने नजदीकी आगामी रक्तदान शिविर और कैंप खोजें।',

      // Home Stats
      'hero.statsRegisteredDonors': 'पंजीकृत रक्तदाता',
      'hero.statsVerifiedHospitals': 'सत्यापित अस्पताल',
      'hero.statsDonationsRecorded': 'दर्ज रक्तदान',
      'stats.registeredDonors': 'पंजीकृत रक्तदाता',
      'stats.verifiedHospitals': 'सत्यापित अस्पताल',
      'stats.donationsRecorded': 'दर्ज रक्तदान',
      'bloodTypes.label': 'रक्त समूह जिन्हें हम कवर करते हैं:',
      'stats.donors': 'पंजीकृत रक्तदाता',
      'stats.hospitals': 'साझेदार अस्पताल',
      'stats.donations': 'सत्यापित रक्तदान',
      'stats.livesSaved': 'बचाई गई जानें',
      'stats.avgResponse': 'औसत प्रतिक्रिया (मिनट)',
      'stats.successRate': '% सफलता दर',
      'stats.noData': 'अभी कोई डेटा नहीं',

      // Blood Stock
      'stock.live': 'लाइव',
      'stock.title': 'साझेदार अस्पतालों में उपलब्ध रक्त',
      'stock.subtitle': 'सत्यापित सहयोगी अस्पतालों द्वारा दर्ज की गई रक्त इकाइयाँ।',
      'stock.empty': 'अधिक अस्पतालों के जुड़ने पर लाइव स्टॉक यहां दिखाई देगा।',
      'stock.units': 'यूनिट',
      'stock.ok': 'उपलब्ध',
      'stock.low': 'कम',
      'stock.critical': 'अति गंभीर',
      'stock.updatedAgo': '{ago} अपडेट किया गया',
      'stock.updatedJustNow': 'अभी-अभी अपडेट किया गया',

      // Public Availability Search
      'search.heroBadge': 'सार्वजनिक रक्तदाता खोज',
      'search.heroTitle': 'स्वैच्छिक रक्तदाता खोजें',
      'search.promptTitle': 'स्वैच्छिक रक्तदाता खोजें',
      'search.promptDesc': 'रक्त समूह चुनें और अपना शहर या पिन कोड दर्ज करें, फिर अपने नजदीकी उपलब्ध स्वैच्छिक रक्तदाताओं को खोजने के लिए खोजें पर क्लिक करें।',
      'bloodBanks.promptTitle': 'सत्यापित ब्लड बैंक निर्देशिका',
      'bloodBanks.promptDesc': 'अस्पताल का नाम, शहर या पिन कोड द्वारा खोजें, "मेरे पास" पर क्लिक करें, या सत्यापित ब्लड बैंक और रीयल-टाइम स्टॉक देखने के लिए रक्त समूह फ़िल्टर चुनें।',
      'search.heroSubtitle': 'अस्पताल रक्त बैंक स्टॉक देखना चाहते हैं? रक्त बैंक निर्देशिका देखें।',
      'search.lookingForStock': 'अस्पताल रक्त बैंक स्टॉक देखना चाहते हैं? देखें',
      'search.bloodBankDir': 'रक्त बैंक निर्देशिका',
      'search.labelBloodGroup': 'रक्त समूह',
      'search.labelLocation': 'स्थान',
      'search.labelRadius': 'दायरा',
      'search.placeholderLocation': 'शहर या 6 अंकों का पिन कोड (उदा. भीमताल, 263136)',
      'search.btnUseGps': 'GPS उपयोग करें',
      'search.btnGpsDetecting': 'स्थान खोज रहे हैं...',
      'search.btnGpsActive': 'स्थान सक्रिय',
      'search.btnSubmit': 'खोजें',
      'search.btnSearching': 'खोज रहे हैं...',
      'search.privacyNotice': 'आपका स्थान अनुमानित है। केवल वे रक्तदाता दिखाए जाते हैं जिन्होंने सार्वजनिक खोज में शामिल होने का विकल्प चुना है।',
      'search.infoLine': 'केवल अस्पताल ही रक्त अनुरोध भेज सकते हैं।',
      'search.hospitalLogin': 'अस्पताल लॉगिन',
      'search.becomeDonor': 'रक्तदाता बनें',
      'search.medicalNotice': 'केवल अस्पताल ही रक्त अनुरोध भेज सकते हैं।',
      'search.hospitalsHeading': 'सत्यापित साझेदार अस्पताल',
      'search.hospitalsSub': 'इस {radius} किमी दायरे में उपलब्ध रक्त बैंक स्टॉक वाले मान्यता प्राप्त अस्पताल।',
      'search.noHospitals': 'इस तत्काल दायरे में पुष्ट स्टॉक वाला कोई साझेदार अस्पताल नहीं मिला।',
      'search.unitsOf': 'यूनिट',
      'search.compatibleGroups': 'संगत समूह ({units} यूनिट)',
      'search.stockUpdated': 'स्टॉक अपडेट: {ago}',
      'search.directions': 'दिशा-निर्देश',
      'search.emergencyPhone': 'आपातकालीन:',
      'search.donorsHeading': 'नजदीकी स्वैच्छिक रक्तदाता (कुल संख्या)',
      'search.donorsSub': 'दायरे में मौजूद पात्र स्वैच्छिक रक्तदाता। यह उपलब्धता की गारंटी नहीं है।',
      'search.exactMatch': 'सटीक मिलान',
      'search.compatibleLabel': 'अन्य संगत समूह:',
      'search.totalInBand': 'दायरे में कुल:',
      'search.none': 'कोई नहीं',
      'search.fewerThan3': '3 से कम',
      'search.locationRequired': 'स्थान आवश्यक है',
      'search.locationRequiredDesc': 'कृपया अपना शहर, 6 अंकों का पिन कोड दर्ज करें या "GPS उपयोग करें" पर क्लिक करें।',
      'search.emptyTitle': 'इस दायरे में वर्तमान में कोई उपलब्धता नहीं है',
      'search.emptyDesc': 'इस दायरे में कोई सत्यापित अस्पताल या सक्रिय रक्तदाता नहीं मिला। कृपया दायरा बढ़ाकर (उदा. 20 किमी) देखें या नजदीकी शहर/पिन कोड दर्ज करें।',
      'search.expandRadius': '20 किमी तक बढ़ाएं',
      'search.rateLimitTitle': 'अनुरोध सीमा सक्रिय',
      'search.errorTitle': 'उपलब्धता खोज पूर्ण करने में असमर्थ',
      'search.retry': 'पुनः प्रयास करें',

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
      'profile.saveChanges': 'परिवर्तन सहेजें',
      'profile.vitalsTitle': 'रक्तदाता प्रोफ़ाइल और स्वास्थ्य आंकड़े',
      'profile.historyTitle': 'स्वास्थ्य जांच इतिहास',
      'profile.trackerTitle': 'चिकित्सा पात्रता ट्रैकर',
      'profile.milestonesTitle': 'रक्तदाता प्रभाव मील के पत्थर',
      'profile.age': 'आयु:',
      'profile.weight': 'वजन:',
      'profile.pulse': 'नाड़ी:',
      'profile.hemoglobin': 'हीमोग्लोबिन:',
      'profile.bloodPressure': 'रक्तचाप:',
      'profile.temperature': 'शरीर का तापमान:',
      'profile.waitingCheck': 'अस्पताल जांच की प्रतीक्षा',
      'profile.withinRange': 'सामान्य सीमा में',
      'profile.outsideRange': 'सामान्य सीमा से बाहर। कृपया अस्पताल के डॉक्टर से परामर्श लें',
      'profile.residentialAddress': 'आवासीय पता',
      'profile.fatherName': 'पिता का नाम',
      'profile.verifiedFacility': 'सत्यापित अस्पताल',
      'profile.lastDonationDate': 'अंतिम रक्तदान तिथि',
      'profile.knownAllergies': 'ज्ञात एलर्जी',
      'profile.existingConditions': 'मौजूदा चिकित्सा स्थितियां',
      'profile.currentMedications': 'वर्तमान दवाएं',
      'profile.previousSurgeries': 'पिछली सर्जरी (< 12 महीने)',
      'profile.noneRecorded': 'कोई दर्ज नहीं',

      // About Page (Part 6)
      'about.h1': 'आस-पास के रक्तदाताओं को खोजने में अस्पतालों की मदद',
      'about.intro': 'RED404 एक स्वैच्छिक सामुदायिक पहल है जो एक ही क्षेत्र के पंजीकृत रक्तदाताओं को सत्यापित अस्पतालों से जोड़ती है। जब किसी अस्पताल को मरीज के लिए रक्त की आवश्यकता होती है, तो वह एक-एक करके फोन करने के बजाय कुछ ही मिनटों में नजदीकी पात्र रक्तदाताओं तक पहुंच सकता है।',
      'about.whyTitle': 'हमने इसे क्यों बनाया',
      'about.whyDesc': 'समय पर सही ब्लड ग्रुप मिलना अक्सर फोन कॉल, संदेशों और किस्मत पर निर्भर करता है। रक्तदाता मदद करना चाहते हैं लेकिन उन्हें शायद ही कभी पता चलता है कि उनकी आवश्यकता कब है। अस्पतालों को पता होता है कि उन्हें क्या चाहिए, लेकिन वे यह नहीं देख पाते कि कौन पास में है और रक्तदान कर सकता है। RED404 दोनों पक्षों को एक जगह लाता है।',
      'about.forDonorsTitle': 'रक्तदाताओं के लिए',
      'about.forDonorsDesc': 'आप अपने ब्लड ग्रुप और स्थान के साथ पंजीकरण करते हैं। जब आप अस्पताल जाते हैं तो अस्पताल आपके विवरण की पुष्टि करता है। आपको केवल तभी सूचित किया जाता है जब आपके आस-पास आपके ब्लड ग्रुप की आवश्यकता होती है और आप पात्र होते हैं। आप स्वीकार या अस्वीकार कर सकते हैं, दिशा-निर्देश प्राप्त कर सकते हैं, और जब चाहें अपनी उपलब्धता को रोक सकते हैं। रक्तदान के बाद आप इसे अपने इतिहास में देख सकते हैं, प्रमाणपत्र डाउनलोड कर सकते हैं और देख सकते हैं कि आप दोबारा कब रक्तदान कर सकते हैं।',
      'about.forHospitalsTitle': 'अस्पतालों के लिए',
      'about.forHospitalsDesc': 'एक अस्पताल पंजीकरण करता है और अनुरोध भेजने से पहले हमारी टीम द्वारा सत्यापित किया जाता है। आप अपने रक्त स्टॉक को अद्यतित रखते हैं, ब्लड ग्रुप और दूरी के आधार पर पात्र रक्तदाताओं की खोज करते हैं, अनुरोध भेजते हैं, और रक्तदाता के आने पर प्रत्येक रक्तदान दर्ज करते हैं।',
      'about.verifiedByTitle': 'किसके द्वारा सत्यापित?',
      'about.verifiedByDesc': 'अनुरोध भेजने से पहले अस्पतालों की समीक्षा और सत्यापन हमारी टीम द्वारा किया जाता है।',
      'about.privacyTitle': 'आपकी गोपनीयता',
      'about.privacyDesc': 'आपके द्वारा उनके अनुरोध को स्वीकार करने के बाद ही अस्पताल आपका फोन नंबर देख सकते हैं। सार्वजनिक पृष्ठ कभी भी आपका फोन, पता या सटीक स्थान नहीं दिखाते हैं। रक्तदाता केवल तभी सार्वजनिक खोज में दिखाई देते हैं जब वे ऐसा चुनते हैं। आपके स्थान का उपयोग केवल आपके आस-पास के अनुरोधों को खोजने के लिए किया जाता है। आप किसी भी समय अपना खाता हटाने का अनुरोध कर सकते हैं।',
      'about.safetyTitle': 'सुरक्षा और चिकित्सीय निर्णय',
      'about.safetyDesc': 'बुनियादी पात्रता दिशानिर्देश (आयु, वजन, हीमोग्लोबिन और रक्तदान के बीच का अंतराल) साइट पर दिखाए गए हैं। वे केवल एक मार्गदर्शन हैं, चिकित्सीय सलाह नहीं। अस्पताल का डॉक्टर अंतिम निर्णय लेता है, और स्वास्थ्य माप अस्पताल द्वारा लिए जाते हैं, रक्तदाता द्वारा नहीं।',
      'about.notServiceTitle': 'RED404 क्या नहीं है',
      'about.notServiceDesc': 'RED404 कोई एम्बुलेंस या आपातकालीन सेवा नहीं है। आपातकालीन स्थिति में 112 पर कॉल करें। यह स्वयं कोई रक्त बैंक नहीं है; स्टॉक के आंकड़े प्रत्येक अस्पताल द्वारा दर्ज किए जाते हैं और कुछ मिनट पुराने हो सकते हैं।',
      'about.questionsTitle': 'सवाल या प्रतिक्रिया',
      'about.questionsPrefix': 'यदि आपके पास प्रश्न, प्रतिक्रिया हैं या सहायता की आवश्यकता है, तो हमारे',
      'about.contactLink': 'संपर्क',
      'about.questionsOr': 'अनुभाग या',
      'about.faqLink': 'FAQ',
      'about.questionsEmail': 'पर जाएं, या हमें',
      'about.btnBecomeDonor': 'रक्तदाता बनें',
      'about.btnRegisterHospital': 'अस्पताल पंजीकृत करें'
    }
  };

  // Comprehensive plain-text phrase map for automatic leaf node, placeholder, and attribute translation
  const PHRASE_MAP = {
    // Navigation & Common Links
    'Home': 'होम',
    'About Us': 'हमारे बारे में',
    'Donor Search': 'रक्तदाता खोज',
    'Blood Search': 'रक्त खोज',
    'Blood Banks': 'रक्त बैंक',
    'Eligibility': 'पात्रता',
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
    'Our Services': 'हमारी सेवाएं',
    'Our': 'हमारी',
    'Services': 'सेवाएं',
    'Connecting voluntary donors with nearby hospitals when emergency blood is needed.': 'आपातकालीन स्थिति में स्वैच्छिक रक्तदाताओं को नजदीकी अस्पतालों से जोड़ना।',
    'Blood search': 'रक्त खोज',
    'Blood Availability Search': 'रक्त उपलब्धता खोज',
    'Blood bank directory': 'रक्त बैंक निर्देशिका',
    'Blood Bank Directory': 'रक्त बैंक निर्देशिका',
    'Health screening': 'स्वास्थ्य जांच',
    'Health Screening': 'स्वास्थ्य जांच',
    'Interactive Health Screening': 'इंटरएक्टिव स्वास्थ्य जांच',
    'Portal access': 'पोर्टल पहुंच',
    'Portal Access': 'पोर्टल पहुंच',
    'Secure Portal Access': 'सुरक्षित पोर्टल पहुंच',
    'Donation drives': 'रक्तदान शिविर',
    'Donation Drives': 'रक्तदान शिविर',
    'Real-Time Blood Availability Search': 'वास्तविक समय रक्त उपलब्धता खोज',
    'Check blood availability within 5km to 20km. See available donors and regional stock without sharing personal identities.': '5 किमी से 20 किमी के दायरे में रक्त उपलब्धता की जांच करें। व्यक्तिगत पहचान साझा किए बिना उपलब्ध रक्तदाताओं और क्षेत्रीय स्टॉक को देखें।',
    '5km to 20km radius search': '5 किमी से 20 किमी त्रिज्या खोज',
    'Private and secure: donor personal details stay anonymous.': 'निजी और सुरक्षित: रक्तदाता का व्यक्तिगत विवरण गोपनीय रहता है।',
    'Fast alerts directly to matching donors': 'योग्य रक्तदाताओं को सीधे त्वरित अलर्ट',
    'Search Availability': 'उपलब्धता खोजें',
    'Check blood availability within 5km to 20km without sharing personal details.': 'व्यक्तिगत विवरण साझा किए बिना 5 किमी से 20 किमी के भीतर रक्त उपलब्धता की जांच करें।',
    'Find verified hospital blood banks and blood storage centres. Look up contact numbers and available blood units.': 'सत्यापित अस्पताल रक्त बैंक और रक्त भंडारण केंद्र खोजें। संपर्क नंबर और उपलब्ध रक्त यूनिट देखें।',
    'Verified partner hospitals': 'सत्यापित साझेदार अस्पताल',
    'Verified government & partner hospitals': 'सत्यापित सरकारी और साझेदार अस्पताल',
    'Direct phone and contact details': 'सीधा फोन नंबर और संपर्क विवरण',
    'Blood units by group, updated by each hospital': 'रक्त समूह के अनुसार यूनिट, प्रत्येक अस्पताल द्वारा अपडेट किया गया',
    'View Directory': 'निर्देशिका देखें',
    'Find verified hospital blood banks and blood storage centres near you.': 'अपने नजदीकी सत्यापित अस्पताल रक्त बैंक और रक्त भंडारण केंद्र खोजें।',
    'Not sure if you are eligible to donate today? Take our quick interactive health screening to instantly verify your status based on age, weight, and recent medical history.': 'क्या आप सुनिश्चित नहीं हैं कि आज रक्तदान कर सकते हैं? आयु, वजन और हालिया चिकित्सा इतिहास के आधार पर अपनी स्थिति की तुरंत जांच करने के लिए हमारा त्वरित इंटरएक्टिव स्वास्थ्य परीक्षण लें।',
    'Adheres to WHO & NBTC donor standards': 'WHO और NBTC रक्तदाता मानकों का पालन',
    'Interactive questionnaire for rapid eligibility check': 'त्वरित पात्रता जांच के लिए इंटरएक्टिव प्रश्नावली',
    'Clear guidance on recovery times and donation gaps': 'पुनर्प्राप्ति समय और रक्तदान अंतराल पर स्पष्ट मार्गदर्शन',
    'Start Health Screening': 'स्वास्थ्य जांच शुरू करें',
    'Check your eligibility to donate blood with our quick screening questions.': 'हमारे त्वरित जांच प्रश्नों के साथ रक्तदान करने की अपनी पात्रता की जांच करें।',
    'Dedicated portals for registered voluntary donors and verified hospitals to manage requests and donations.': 'पंजीकृत स्वैच्छिक रक्तदाताओं और सत्यापित अस्पतालों के लिए अनुरोध और रक्तदान प्रबंधन हेतु समर्पित पोर्टल।',
    'Donor Portal: track donations, eligibility and requests': 'रक्तदाता पोर्टल: रक्तदान, पात्रता और अनुरोधों को ट्रैक करें',
    'Hospital Portal: request blood and update inventory': 'अस्पताल पोर्टल: रक्त का अनुरोध करें और इन्वेंट्री अपडेट करें',
    'Secure authentication and verified accounts': 'सुरक्षित प्रमाणीकरण और सत्यापित खाते',
    'Dedicated portals for registered voluntary donors and verified hospitals.': 'पंजीकृत स्वैच्छिक रक्तदाताओं और सत्यापित अस्पतालों के लिए समर्पित पोर्टल।',
    'Verified partner hospitals organize blood donation drives. Registered voluntary donors receive invitations and can RSVP directly.': 'सत्यापित साझेदार अस्पताल रक्तदान शिविर आयोजित करते हैं। पंजीकृत स्वैच्छिक रक्तदाताओं को आमंत्रण प्राप्त होते हैं और वे सीधे पुष्टि कर सकते हैं।',
    'Verified blood donation camps': 'सत्यापित रक्तदान शिविर',
    'Location, date and organizer details': 'स्थान, तिथि और आयोजक विवरण',
    'Easy RSVP and directions': 'आसान RSVP और दिशा-निर्देश',
    'Register to Participate': 'भाग लेने के लिए पंजीकरण करें',
    'Explore Campaigns': 'अभियानों को देखें',
    'Find upcoming blood donation drives and camps organized near you.': 'अपने नजदीकी आगामी रक्तदान शिविर और कैंप खोजें।',
    'Registered Donors': 'पंजीकृत रक्तदाता',
    'Partner Hospitals': 'साझेदार अस्पताल',
    'Verified Donations': 'सत्यापित रक्तदान',
    'Lives Saved': 'बचाई गई जानें',
    'Avg. Response (min)': 'औसत प्रतिक्रिया (मिनट)',
    '% Success Rate': '% सफलता दर',
    'No data yet': 'अभी कोई डेटा नहीं',
    'Blood available across partner hospitals': 'सहयोगी अस्पतालों में उपलब्ध रक्त',
    'Blood available at partner hospitals': 'सहयोगी अस्पतालों में उपलब्ध रक्त',
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
    'Location': 'स्थान',
    'Radius': 'दायरा',
    'Use GPS': 'GPS उपयोग करें',
    'Location on': 'स्थान सक्रिय',
    'Live GPS: Connected': 'स्थान सक्रिय',
    'Location off': 'स्थान बंद है',
    'GPS Active': 'स्थान सक्रिय',
    'Search': 'खोजें',
    'Searching...': 'खोज रहे हैं...',
    'Units': 'यूनिट',
    'OK': 'उपलब्ध',
    'Low': 'कम',
    'Critical': 'अति गंभीर',
    'LIVE': 'लाइव',
    'Updated just now': 'अभी-अभी अपडेट किया गया',
    'Exact Match': 'सटीक मिलान',
    'Compatible Groups': 'अन्य संगत समूह',
    'Compatible Groups:': 'अन्य संगत समूह:',
    'Total in Band': 'दायरे में कुल',
    'Total in Band:': 'दायरे में कुल:',
    'None': 'कोई नहीं',
    'Fewer than 3': '3 से कम',
    'Directions': 'दिशा-निर्देश',
    'Emergency:': 'आपातकालीन:',
    'Search Results': 'खोज परिणाम',
    'Aggregates verified': 'सत्यापित आंकड़े',
    'units of': 'यूनिट',
    'Verified Partner Hospitals': 'सत्यापित साझेदार अस्पताल',
    'Nearby Voluntary Donors (Aggregate Counts)': 'नजदीकी स्वैच्छिक रक्तदाता (कुल संख्या)',
    'Public Blood Availability Search': 'सार्वजनिक रक्त उपलब्धता खोज',
    'Blood Availability in Your Area': 'आपके क्षेत्र में रक्त उपलब्धता',
    'City or 6-digit PIN (e.g. Bhimtal, 263136)': 'शहर या 6 अंकों का पिन कोड (उदा. भीमताल, 263136)',
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
    '10-digit mobile number': '10 अंकों का मोबाइल नंबर',

    // Part 6 Clinical Health Checks & Profile Translations
    'Donor Profile & Vital Health Stats': 'रक्तदाता प्रोफ़ाइल और स्वास्थ्य आंकड़े',
    'Medical Eligibility Tracker': 'चिकित्सा पात्रता ट्रैकर',
    'Donor Impact Milestones': 'रक्तदाता प्रभाव मील के पत्थर',
    'Health Check History': 'स्वास्थ्य जांच इतिहास',
    'Last 5 Records': 'अंतिम 5 रिकॉर्ड',
    'Outcome': 'परिणाम',
    'Vitals & Status': 'लक्षण और स्थिति',
    'Passed clinical screening': 'नैदानिक जांच में उत्तीर्ण',
    'Under medical review': 'चिकित्सा समीक्षाधीन',
    'Approved': 'स्वीकृत',
    'Deferred': 'स्थगित',
    'Age:': 'आयु:',
    'Weight:': 'वजन:',
    'Weight': 'वजन',
    'Pulse:': 'नाड़ी:',
    'Pulse': 'नाड़ी',
    'Pulse / Heart Rate': 'नाड़ी / हृदय गति',
    'Hemoglobin:': 'हीमोग्लोबिन:',
    'Hemoglobin': 'हीमोग्लोबिन',
    'Blood Pressure:': 'रक्तचाप:',
    'Blood Pressure': 'रक्तचाप',
    'Body Temperature:': 'शरीर का तापमान:',
    'Body Temperature': 'शरीर का तापमान',
    'Within usual range': 'सामान्य सीमा में',
    'Outside usual range. Please speak to the hospital doctor': 'सामान्य सीमा से बाहर। कृपया अस्पताल के डॉक्टर से परामर्श लें',
    'Outside usual range — speak to the hospital doctor': 'सामान्य सीमा से बाहर — कृपया अस्पताल के डॉक्टर से परामर्श लें',
    'Waiting for hospital check': 'अस्पताल जांच की प्रतीक्षा',
    'None recorded': 'कोई दर्ज नहीं',
    'Set exact location on map or via GPS': 'मानचित्र या GPS द्वारा सटीक स्थान निर्धारित करें',
    'Verified Facility': 'सत्यापित अस्पताल',
    'Last Donation Date': 'अंतिम रक्तदान तिथि',
    'Residential Address': 'आवासीय पता',
    'Residential street address': 'आवासीय सड़क का पता',
    "Father's Name": 'पिता का नाम',
    "Father's full name (optional)": 'पिता का पूरा नाम (वैकल्पिक)',
    'Known Allergies': 'ज्ञात एलर्जी',
    'Known drug allergies or leave blank': 'ज्ञात दवा एलर्जी या खाली छोड़ें',
    'Existing Medical Conditions': 'मौजूदा चिकित्सा स्थितियां',
    'Medical conditions or leave blank': 'चिकित्सा स्थितियां या खाली छोड़ें',
    'Current Medications': 'वर्तमान दवाएं',
    'Current medications or leave blank': 'वर्तमान दवाएं या खाली छोड़ें',
    'Previous Surgeries': 'पिछली सर्जरी',
    'Previous Surgeries (< 12 mos)': 'पिछली सर्जरी (< 12 महीने)',
    'Previous surgeries or leave blank': 'पिछली सर्जरी या खाली छोड़ें',
    'Notification Preferences': 'अधिसूचना प्राथमिकताएं',
    'SMS Alerts': 'एसएमएस अलर्ट',
    'Email Alerts': 'ईमेल अलर्ट',
    'Push Notifications': 'पुश नोटिफिकेशन',
    'Tap QR to zoom • Scan for details': 'ज़ूम करने के लिए QR दबाएं • विवरण के लिए स्कैन करें',
    'Regenerate QR': 'QR पुनः बनाएं',
    'Edit Donor Profile': 'रक्तदाता प्रोफ़ाइल संपादित करें',
    'Identity & Demographics': 'पहचान और जनसांख्यिकी',
    'Contact & Residence': 'संपर्क और निवास',
    'Clinical Vitals & Health Screening': 'नैदानिक लक्षण और स्वास्थ्य जांच',
    'Update your contact and demographic details below. Clinical vitals and donation recovery intervals are verified and set by hospital staff during check-in.': 'नीचे अपना संपर्क और जनसांख्यिकी विवरण अपडेट करें। नैदानिक लक्षण और रक्तदान रिकवरी अवधि चेक-इन के दौरान अस्पताल के कर्मचारियों द्वारा सत्यापित और निर्धारित की जाती है।',
    'Digital Blood Donor QR': 'डिजिटल रक्तदाता QR',
    'Scan with camera to view official verified intake details': 'आधिकारिक सत्यापित विवरण देखने के लिए कैमरे से स्कैन करें',
    'Tap outside or press Esc to dismiss': 'खारिज करने के लिए बाहर टैप करें या Esc दबाएं',
    'System: Online': 'सिस्टम: ऑनलाइन',
    'HEALTH STATUS: FIT TO DONATE': 'स्वास्थ्य स्थिति: रक्तदान के लिए उपयुक्त',
    'HEALTH STATUS: MEDICAL REVIEW REQUIRED': 'स्वास्थ्य स्थिति: चिकित्सा समीक्षा आवश्यक',
    'HEALTH STATUS: AWAITING HOSPITAL HEALTH VERIFICATION': 'स्वास्थ्य स्थिति: अस्पताल स्वास्थ्य सत्यापन की प्रतीक्षा है',
    'Verified during hospital intake': 'अस्पताल चेक-इन के दौरान सत्यापित',
    'Saving changes...': 'परिवर्तन सहेजे जा रहे हैं...',
    'NEGATIVE': 'नेगेटिव',
    'LOCKED': 'लॉक',
    'UNLOCKED': 'अनलॉक',
    'LOCKED • Req. 5 Donations': 'लॉक • 5 रक्तदान आवश्यक',
    'LOCKED • Req. 10 Donations': 'लॉक • 10 रक्तदान आवश्यक'
  };

  let currentLang = 'en';
  let isApplying = false;

  function initI18n() {
    // 1. Resolve initial language from URL search params, localStorage, or session
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = (urlParams.get('lang') || '').toLowerCase();
      if (urlLang === 'en' || urlLang === 'hi') {
        currentLang = urlLang;
        localStorage.setItem('red404_lang', urlLang);
      }
    } catch (_) {}

    const saved = localStorage.getItem('red404_lang');
    if (!currentLang && saved && (saved === 'en' || saved === 'hi')) {
      currentLang = saved;
    } else if (!currentLang) {
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

  function matchDynamicPhrase(text) {
    if (!text || typeof text !== 'string') return null;
    let m;
    // 1. "The hospital could not accept your donation on <date>. Please speak to the hospital. You can try again on <date>."
    if ((m = text.match(/^The hospital could not accept your donation on (.+?)\. Please speak to the hospital\.\s*You can try again on (.+?)\.?$/))) {
      return `अस्पताल ${m[1]} को आपका रक्तदान स्वीकार नहीं कर सका। कृपया अस्पताल से संपर्क करें। आप ${m[2]} को पुनः प्रयास कर सकते हैं।`;
    }
    // 2. "The hospital could not accept your donation on <date>. Please speak to the hospital."
    if ((m = text.match(/^The hospital could not accept your donation on (.+?)\. Please speak to the hospital\.?$/))) {
      return `अस्पताल ${m[1]} को आपका रक्तदान स्वीकार नहीं कर सका। कृपया अस्पताल से संपर्क करें।`;
    }
    // 3. "Next eligible on <date> (<N> days)" or "(<N> day)"
    if ((m = text.match(/^Next eligible on (.+?)\s*\((.+?)\)$/))) {
      const daysPart = m[2].replace(/days?/i, 'दिन');
      return `अगली पात्रता: ${m[1]} (${daysPart})`;
    }
    // 4. "Checked at <hosp> on <date>"
    if ((m = text.match(/^Checked at (.+?)\s+on\s+(.+)$/))) {
      return `${m[1]} में ${m[2]} को जांच की गई`;
    }
    // 5. "Checked on <date> at <hosp>"
    if ((m = text.match(/^Checked on (.+?)\s+at\s+(.+)$/))) {
      return `${m[2]} में ${m[1]} को जांच की गई`;
    }
    // 6. "Last checked at <hosp> on <date>"
    if ((m = text.match(/^Last checked at (.+?)\s+on\s+(.+)$/))) {
      return `अंतिम जांच: ${m[1]} में ${m[2]} को`;
    }
    // 7. "Medically verified at <hosp> on <date>"
    if ((m = text.match(/^Medically verified at (.+?)\s+on\s+(.+)$/))) {
      return `${m[1]} में ${m[2]} को चिकित्सकीय रूप से सत्यापित`;
    }
    // 8. "Earned Badges: <N> / <M>"
    if ((m = text.match(/^Earned Badges:\s*(\d+)\s*\/\s*(\d+)$/))) {
      return `अर्जित पदक: ${m[1]} / ${m[2]}`;
    }
    // 9. "<N> Record" or "<N> Records"
    if ((m = text.match(/^(\d+)\s+Records?$/i))) {
      return `${m[1]} रिकॉर्ड`;
    }
    // 10. "Next eligible: <date>"
    if ((m = text.match(/^Next eligible:\s*(.+)$/i))) {
      return `अगली पात्रता: ${m[1]}`;
    }
    // 11. "Signed in as <email>"
    if ((m = text.match(/^Signed in as\s*(.+)$/))) {
      return `लॉग इन किया गया: ${m[1]}`;
    }
    // 12. "Checked at <hosp>, <date>"
    if ((m = text.match(/^Checked at (.+?),\s*(.+)$/))) {
      return `${m[1]}, ${m[2]} में जांच की गई`;
    }
    // 13. "Coordinates: <lat>, <lng>"
    if ((m = text.match(/^Coordinates:\s*(.+)$/i))) {
      return `निर्देशांक: ${m[1]}`;
    }
    return null;
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

            const hiText = PHRASE_MAP[rawText] || matchDynamicPhrase(rawText);
            if (rawText && hiText) {
              if (!node.getAttribute('data-orig-en')) {
                node.setAttribute('data-orig-en', rawText);
              }
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

        // 2b. Translate read-only / disabled inputs in Hindi mode
        document.querySelectorAll('input[readonly], input[disabled]').forEach(el => {
          const val = (el.value || '').trim();
          if (!val) return;
          const hiVal = PHRASE_MAP[val] || matchDynamicPhrase(val);
          if (hiVal) {
            if (!el.getAttribute('data-orig-value')) {
              el.setAttribute('data-orig-value', el.value);
            }
            el.value = hiVal;
          }
        });

        // 2c. Translate select options in Hindi mode
        document.querySelectorAll('select option').forEach(opt => {
          const text = (opt.textContent || '').trim();
          if (!text) return;
          const hiOpt = PHRASE_MAP[text] || matchDynamicPhrase(text);
          if (hiOpt) {
            if (!opt.getAttribute('data-orig-text')) {
              opt.setAttribute('data-orig-text', text);
            }
            opt.textContent = hiOpt;
          }
        });
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

        // Revert read-only inputs back to English
        document.querySelectorAll('input[data-orig-value]').forEach(el => {
          const orig = el.getAttribute('data-orig-value');
          if (orig) {
            el.value = orig;
          }
        });

        // Revert select options back to English
        document.querySelectorAll('select option[data-orig-text]').forEach(opt => {
          const orig = opt.getAttribute('data-orig-text');
          if (orig) {
            opt.textContent = orig;
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
        btn.style.setProperty('background', '#800000', 'important');
        btn.style.setProperty('color', '#ffffff', 'important');
        btn.style.setProperty('font-weight', '700', 'important');
      } else {
        btn.classList.remove('active');
        btn.style.setProperty('background', '#ffffff', 'important');
        btn.style.setProperty('color', '#800000', 'important');
        btn.style.setProperty('font-weight', '700', 'important');
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
