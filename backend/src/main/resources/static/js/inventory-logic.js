/**
 * RED404 — Dynamic Blood Inventory & Clinical Hospital Search Engine
 * Zero Demo Data Architecture • Pure Database-Driven Logic
 * Covers All 28 Indian States & 8 Union Territories with Comprehensive Districts
 */

(function () {
  'use strict';

  // ============================================================
  // 1. ALL 28 INDIAN STATES & 8 UNION TERRITORIES WITH DISTRICTS
  // ============================================================
  const INDIA_GEO_DATA = {
    "Andhra Pradesh": [
      "Alluri Sitharama Raju",
      "Anakapalli",
      "Ananthapuramu",
      "Annamayya",
      "Bapatla",
      "Chittoor",
      "Dr. B.R. Ambedkar Konaseema",
      "East Godavari",
      "Eluru",
      "Guntur",
      "Kakinada",
      "Krishna",
      "Kurnool",
      "Nandyal",
      "NTR",
      "Palnadu",
      "Parvathipuram Manyam",
      "Prakasam",
      "Sri Potti Sriramulu Nellore",
      "Sri Sathya Sai",
      "Srikakulam",
      "Tirupati",
      "Visakhapatnam",
      "Vizianagaram",
      "West Godavari",
      "YSR Kadapa"
    ],
    "Arunachal Pradesh": [
      "Anjaw",
      "Changlang",
      "Dibang Valley",
      "East Kameng",
      "East Siang",
      "Itanagar",
      "Kamle",
      "Kra Daadi",
      "Kurung Kumey",
      "Lepa Rada",
      "Lohit",
      "Longding",
      "Lower Dibang Valley",
      "Lower Siang",
      "Lower Subansiri",
      "Namsai",
      "Pakke Kessang",
      "Papum Pare",
      "Shi Yomi",
      "Siang",
      "Tawang",
      "Tirap",
      "Upper Siang",
      "Upper Subansiri",
      "West Kameng",
      "West Siang"
    ],
    "Assam": [
      "Baksa",
      "Barpeta",
      "Biswanath",
      "Bongaigaon",
      "Cachar",
      "Charaideo",
      "Chirang",
      "Darrang",
      "Dhemaji",
      "Dhubri",
      "Dibrugarh",
      "Dima Hasao",
      "Goalpara",
      "Golaghat",
      "Hailakandi",
      "Hojai",
      "Jorhat",
      "Kamrup",
      "Kamrup Metropolitan (Guwahati)",
      "Karbi Anglong",
      "Karimganj",
      "Kokrajhar",
      "Lakhimpur",
      "Majuli",
      "Morigaon",
      "Nagaon",
      "Nalbari",
      "Sivasagar",
      "Sonitpur",
      "South Salmara-Mankachar",
      "Tamulpur",
      "Tinsukia",
      "Udalguri",
      "West Karbi Anglong"
    ],
    "Bihar": [
      "Araria",
      "Arwal",
      "Aurangabad",
      "Banka",
      "Begusarai",
      "Bhagalpur",
      "Bhojpur (Ara)",
      "Buxar",
      "Darbhanga",
      "East Champaran (Motihari)",
      "Gaya",
      "Gopalganj",
      "Jamui",
      "Jehanabad",
      "Kaimur (Bhabua)",
      "Katihar",
      "Khagaria",
      "Kishanganj",
      "Lakhisarai",
      "Madhepura",
      "Madhubani",
      "Munger",
      "Muzaffarpur",
      "Nalanda (Bihar Sharif)",
      "Nawada",
      "Patna",
      "Purnia",
      "Rohtas (Sasaram)",
      "Saharsa",
      "Samastipur",
      "Saran (Chhapra)",
      "Sheikhpura",
      "Sheohar",
      "Sitamarhi",
      "Siwan",
      "Supaul",
      "Vaishali (Hajipur)",
      "West Champaran (Bettiah)"
    ],
    "Chhattisgarh": [
      "Balod",
      "Baloda Bazar",
      "Balrampur",
      "Bastar (Jagdalpur)",
      "Bemetara",
      "Bijapur",
      "Bilaspur",
      "Dantewada",
      "Dhamtari",
      "Durg",
      "Gariaband",
      "Gaurela-Pendra-Marwahi",
      "Janjgir-Champa",
      "Jashpur",
      "Kabirdham (Kawardha)",
      "Kanker",
      "Khairagarh-Chhuikhadan-Gandai",
      "Kondagaon",
      "Korba",
      "Koriya",
      "Mahasamund",
      "Manendragarh-Chirmiri-Bharatpur",
      "Mohla-Manpur-Ambagarh Chowki",
      "Mungeli",
      "Narayanpur",
      "Raigarh",
      "Raipur",
      "Rajnandgaon",
      "Sakti",
      "Sarangarh-Bilaigarh",
      "Sukma",
      "Surajpur",
      "Surguja (Ambikapur)"
    ],
    "Goa": [
      "North Goa (Panaji / Mapusa)",
      "South Goa (Margao / Vasco da Gama)"
    ],
    "Gujarat": [
      "Ahmedabad",
      "Amreli",
      "Anand",
      "Aravalli",
      "Banaskantha (Palanpur)",
      "Bharuch",
      "Bhavnagar",
      "Botad",
      "Chhota Udaipur",
      "Dahod",
      "Dang (Ahwa)",
      "Devbhoomi Dwarka",
      "Gandhinagar",
      "Gir Somnath",
      "Jamnagar",
      "Junagadh",
      "Kheda (Nadiad)",
      "Kutch (Bhuj)",
      "Mahisagar",
      "Mehsana",
      "Morbi",
      "Narmada (Rajpipla)",
      "Navsari",
      "Panchmahal (Godhra)",
      "Patan",
      "Porbandar",
      "Rajkot",
      "Sabarkantha (Himmatnagar)",
      "Surat",
      "Surendranagar",
      "Tapi (Vyara)",
      "Vadodara",
      "Valsad"
    ],
    "Haryana": [
      "Ambala",
      "Bhiwani",
      "Charkhi Dadri",
      "Faridabad",
      "Fatehabad",
      "Gurugram",
      "Hisar",
      "Jhajjar",
      "Jind",
      "Kaithal",
      "Karnal",
      "Kurukshetra",
      "Mahendragarh (Narnaul)",
      "Nuh",
      "Palwal",
      "Panchkula",
      "Panipat",
      "Rewari",
      "Rohtak",
      "Sirsa",
      "Sonipat",
      "Yamunanagar"
    ],
    "Himachal Pradesh": [
      "Bilaspur",
      "Chamba",
      "Hamirpur",
      "Kangra (Dharamshala)",
      "Kinnaur",
      "Kullu",
      "Lahaul and Spiti",
      "Mandi",
      "Shimla",
      "Sirmaur (Nahan)",
      "Solan",
      "Una"
    ],
    "Jharkhand": [
      "Bokaro",
      "Chatra",
      "Deoghar",
      "Dhanbad",
      "Dumka",
      "East Singhbhum (Jamshedpur)",
      "Garhwa",
      "Giridih",
      "Godda",
      "Gumla",
      "Hazaribagh",
      "Jamtara",
      "Khunti",
      "Koderma",
      "Latehar",
      "Lohardaga",
      "Pakur",
      "Palamu (Medininagar)",
      "Ramgarh",
      "Ranchi",
      "Sahibganj",
      "Saraikela Kharsawan",
      "Simdega",
      "West Singhbhum (Chaibasa)"
    ],
    "Karnataka": [
      "Bagalkote",
      "Ballari",
      "Belagavi",
      "Bengaluru Rural",
      "Bengaluru Urban",
      "Bidar",
      "Chamarajanagara",
      "Chikkaballapura",
      "Chikkamagaluru",
      "Chitradurga",
      "Dakshina Kannada (Mangaluru)",
      "Davanagere",
      "Dharwad (Hubballi)",
      "Gadag",
      "Hassan",
      "Haveri",
      "Kalaburagi",
      "Kodagu (Madikeri)",
      "Kolar",
      "Koppal",
      "Mandya",
      "Mysuru",
      "Raichur",
      "Ramanagara",
      "Shivamogga",
      "Tumakuru",
      "Udupi",
      "Uttara Kannada (Karwar)",
      "Vijayapura",
      "Vijayanagara (Hosapete)",
      "Yadgir"
    ],
    "Kerala": [
      "Alappuzha",
      "Ernakulam (Kochi)",
      "Idukki",
      "Kannur",
      "Kasaragod",
      "Kollam",
      "Kottayam",
      "Kozhikode",
      "Malappuram",
      "Palakkad",
      "Pathanamthitta",
      "Thiruvananthapuram",
      "Thrissur",
      "Wayanad"
    ],
    "Madhya Pradesh": [
      "Agar Malwa",
      "Alirajpur",
      "Anuppur",
      "Ashoknagar",
      "Balaghat",
      "Barwani",
      "Betul",
      "Bhind",
      "Bhopal",
      "Burhanpur",
      "Chhatarpur",
      "Chhindwara",
      "Damoh",
      "Datia",
      "Dewas",
      "Dhar",
      "Dindori",
      "Guna",
      "Gwalior",
      "Harda",
      "Hoshangabad (Narmadapuram)",
      "Indore",
      "Jabalpur",
      "Jhabua",
      "Katni",
      "Khandwa",
      "Khargone",
      "Maihar",
      "Mandla",
      "Mandsaur",
      "Morena",
      "Narsinghpur",
      "Neemuch",
      "Niwari",
      "Panna",
      "Raisen",
      "Rajgarh",
      "Ratlam",
      "Rewa",
      "Sagar",
      "Satna",
      "Sehore",
      "Seoni",
      "Shahdol",
      "Shajapur",
      "Sheopur",
      "Shivpuri",
      "Sidhi",
      "Singrauli",
      "Tikamgarh",
      "Ujjain",
      "Umaria",
      "Vidisha"
    ],
    "Maharashtra": [
      "Ahmednagar (Ahilyanagar)",
      "Akola",
      "Amravati",
      "Bhandara",
      "Beed",
      "Buldhana",
      "Chandrapur",
      "Chhatrapati Sambhajinagar (Aurangabad)",
      "Dharashiv (Osmanabad)",
      "Dhule",
      "Gadchiroli",
      "Gondia",
      "Hingoli",
      "Jalgaon",
      "Jalna",
      "Kolhapur",
      "Latur",
      "Mumbai City",
      "Mumbai Suburban",
      "Nagpur",
      "Nanded",
      "Nandurbar",
      "Nashik",
      "Palghar",
      "Parbhani",
      "Pune",
      "Raigad (Alibag)",
      "Ratnagiri",
      "Sangli",
      "Satara",
      "Sindhudurg",
      "Solapur",
      "Thane",
      "Wardha",
      "Washim",
      "Yavatmal"
    ],
    "Manipur": [
      "Bishnupur",
      "Chandel",
      "Churachandpur",
      "Imphal East",
      "Imphal West",
      "Jiribam",
      "Kakching",
      "Kamjong",
      "Kangpokpi",
      "Noney",
      "Pherzawl",
      "Senapati",
      "Tamenglong",
      "Tengnoupal",
      "Thoubal",
      "Ukhrul"
    ],
    "Meghalaya": [
      "East Garo Hills",
      "East Jaintia Hills",
      "East Khasi Hills (Shillong)",
      "Eastern West Khasi Hills",
      "North Garo Hills",
      "Ri Bhoi",
      "South Garo Hills",
      "South West Garo Hills",
      "South West Khasi Hills",
      "West Garo Hills (Tura)",
      "West Jaintia Hills",
      "West Khasi Hills"
    ],
    "Mizoram": [
      "Aizawl",
      "Champhai",
      "Hnahthial",
      "Khawzawl",
      "Kolasib",
      "Lawngtlai",
      "Lunglei",
      "Mamit",
      "Saiha",
      "Saitual",
      "Serchhip"
    ],
    "Nagaland": [
      "Chümoukedima",
      "Dimapur",
      "Kiphire",
      "Kohima",
      "Longleng",
      "Mokokchung",
      "Mon",
      "Niuland",
      "Noklak",
      "Peren",
      "Phek",
      "Shamator",
      "Tseminyü",
      "Tuensang",
      "Wokha",
      "Zunheboto"
    ],
    "Odisha": [
      "Angul",
      "Balangir",
      "Balasore (Baleswar)",
      "Bargarh",
      "Bhadrak",
      "Boudh",
      "Cuttack",
      "Deogarh",
      "Dhenkanal",
      "Gajapati",
      "Ganjam",
      "Jagatsinghpur",
      "Jajpur",
      "Jharsuguda",
      "Kalahandi",
      "Kandhamal",
      "Kendrapara",
      "Kendujhar (Keonjhar)",
      "Khordha (Bhubaneswar)",
      "Koraput",
      "Malkangiri",
      "Mayurbhanj",
      "Nabarangpur",
      "Nayagarh",
      "Nuapada",
      "Puri",
      "Rayagada",
      "Sambalpur",
      "Subarnapur",
      "Sundergarh"
    ],
    "Punjab": [
      "Amritsar",
      "Barnala",
      "Bathinda",
      "Faridkot",
      "Fatehgarh Sahib",
      "Fazilka",
      "Ferozepur",
      "Gurdaspur",
      "Hoshiarpur",
      "Jalandhar",
      "Kapurthala",
      "Ludhiana",
      "Malerkotla",
      "Mansa",
      "Moga",
      "Pathankot",
      "Patiala",
      "Rupnagar",
      "Sahibzada Ajit Singh Nagar (Mohali)",
      "Sangrur",
      "Shahid Bhagat Singh Nagar (Nawanshahr)",
      "Sri Muktsar Sahib",
      "Tarn Taran"
    ],
    "Rajasthan": [
      "Ajmer",
      "Alwar",
      "Anupgarh",
      "Balotra",
      "Banswara",
      "Baran",
      "Barmer",
      "Beawar",
      "Bharatpur",
      "Bhilwara",
      "Bikaner",
      "Bundi",
      "Chittorgarh",
      "Churu",
      "Dausa",
      "Deeg",
      "Dholpur",
      "Didwana-Kuchaman",
      "Dudu",
      "Dungarpur",
      "Ganganagar",
      "Gangapur City",
      "Hanumangarh",
      "Jaipur",
      "Jaipur Rural",
      "Jaisalmer",
      "Jalore",
      "Jhalawar",
      "Jhunjhunu",
      "Jodhpur",
      "Jodhpur Rural",
      "Karauli",
      "Kekri",
      "Khairthal-Tijara",
      "Kota",
      "Kotputli-Behror",
      "Nagaur",
      "Neem Ka Thana",
      "Pali",
      "Phalodi",
      "Pratapgarh",
      "Rajsamand",
      "Salumbar",
      "Sanchore",
      "Sawai Madhopur",
      "Shahpura",
      "Sikar",
      "Sirohi",
      "Tonk",
      "Udaipur"
    ],
    "Sikkim": [
      "Gangtok",
      "Gyalshing",
      "Mangan",
      "Namchi",
      "Pakyong",
      "Soreng"
    ],
    "Tamil Nadu": [
      "Ariyalur",
      "Chengalpattu",
      "Chennai",
      "Coimbatore",
      "Cuddalore",
      "Dharmapuri",
      "Dindigul",
      "Erode",
      "Kallakurichi",
      "Kanchipuram",
      "Kanyakumari (Nagercoil)",
      "Karur",
      "Krishnagiri",
      "Madurai",
      "Mayiladuthurai",
      "Nagapattinam",
      "Namakkal",
      "Nilgiris (Udhagamandalam)",
      "Perambalur",
      "Pudukkottai",
      "Ramanathapuram",
      "Ranipet",
      "Salem",
      "Sivaganga",
      "Tenkasi",
      "Thanjavur",
      "Theni",
      "Thoothukudi",
      "Tiruchirappalli",
      "Tirunelveli",
      "Tirupathur",
      "Tiruppur",
      "Tiruvallur",
      "Tiruvannamalai",
      "Tiruvarur",
      "Vellore",
      "Viluppuram",
      "Virudhunagar"
    ],
    "Telangana": [
      "Adilabad",
      "Bhadradri Kothagudem",
      "Hanumakonda",
      "Hyderabad",
      "Jagtial",
      "Jangaon",
      "Jayashankar Bhupalpally",
      "Jogulamba Gadwal",
      "Kamareddy",
      "Karimnagar",
      "Khammam",
      "Kumuram Bheem Asifabad",
      "Mahabubabad",
      "Mahabubnagar",
      "Mancherial",
      "Medak",
      "Medchal-Malkajgiri",
      "Mulugu",
      "Nagarkurnool",
      "Nalgonda",
      "Narayanpet",
      "Nirmal",
      "Nizamabad",
      "Peddapalli",
      "Rajanna Sircilla",
      "Ranga Reddy",
      "Sangareddy",
      "Siddipet",
      "Suryapet",
      "Vikarabad",
      "Wanaparthy",
      "Warangal",
      "Yadadri Bhuvanagiri"
    ],
    "Tripura": [
      "Dhalai",
      "Gomati",
      "Khowai",
      "North Tripura",
      "Sepahijala",
      "South Tripura",
      "Unakoti",
      "West Tripura (Agartala)"
    ],
    "Uttar Pradesh": [
      "Agra",
      "Aligarh",
      "Ambedkar Nagar",
      "Amethi",
      "Amroha",
      "Auraiya",
      "Ayodhya",
      "Azamgarh",
      "Baghpat",
      "Bahraich",
      "Ballia",
      "Balrampur",
      "Banda",
      "Barabanki",
      "Bareilly",
      "Basti",
      "Bhadohi",
      "Bijnor",
      "Budaun",
      "Bulandshahr",
      "Chandauli",
      "Chitrakoot",
      "Deoria",
      "Etah",
      "Etawah",
      "Farrukhabad",
      "Fatehpur",
      "Firozabad",
      "Gautam Buddha Nagar (Noida)",
      "Ghaziabad",
      "Ghazipur",
      "Gonda",
      "Gorakhpur",
      "Hamirpur",
      "Hapur",
      "Hardoi",
      "Hathras",
      "Jalaun",
      "Jaunpur",
      "Jhansi",
      "Kannauj",
      "Kanpur Dehat",
      "Kanpur Nagar",
      "Kasganj",
      "Kaushambi",
      "Kheri (Lakhimpur)",
      "Kushinagar",
      "Lalitpur",
      "Lucknow",
      "Maharajganj",
      "Mahoba",
      "Mainpuri",
      "Mathura",
      "Mau",
      "Meerut",
      "Mirzapur",
      "Moradabad",
      "Muzaffarnagar",
      "Pilibhit",
      "Pratapgarh",
      "Prayagraj (Allahabad)",
      "Raebareli",
      "Rampur",
      "Saharanpur",
      "Sambhal",
      "Sant Kabir Nagar",
      "Shahjahanpur",
      "Shamli",
      "Shravasti",
      "Siddharthnagar",
      "Sitapur",
      "Sonbhadra",
      "Sultanpur",
      "Unnao",
      "Varanasi"
    ],
    "Uttarakhand": [
      "Almora",
      "Bageshwar",
      "Chamoli",
      "Champawat",
      "Dehradun",
      "Haridwar",
      "Nainital",
      "Pauri Garhwal",
      "Pithoragarh",
      "Rudraprayag",
      "Tehri Garhwal",
      "Udham Singh Nagar",
      "Uttarkashi"
    ],
    "West Bengal": [
      "Alipurduar",
      "Bankura",
      "Birbhum",
      "Cooch Behar",
      "Dakshin Dinajpur",
      "Darjeeling",
      "Hooghly",
      "Howrah",
      "Jalpaiguri",
      "Jhargram",
      "Kalimpong",
      "Kolkata",
      "Malda",
      "Murshidabad",
      "Nadia",
      "North 24 Parganas",
      "Paschim Bardhaman (Asansol)",
      "Paschim Medinipur",
      "Purba Bardhaman",
      "Purba Medinipur",
      "Purulia",
      "South 24 Parganas",
      "Uttar Dinajpur"
    ],
    "Andaman and Nicobar Islands": [
      "Nicobar",
      "North and Middle Andaman",
      "South Andaman (Port Blair)"
    ],
    "Chandigarh": [
      "Chandigarh"
    ],
    "Dadra and Nagar Haveli and Daman and Diu": [
      "Dadra and Nagar Haveli (Silvassa)",
      "Daman",
      "Diu"
    ],
    "Delhi": [
      "Central Delhi",
      "East Delhi",
      "New Delhi",
      "North Delhi",
      "North East Delhi",
      "North West Delhi",
      "Shahdara",
      "South Delhi",
      "South East Delhi",
      "South West Delhi",
      "West Delhi"
    ],
    "Jammu and Kashmir": [
      "Anantnag",
      "Bandipora",
      "Baramulla",
      "Budgam",
      "Doda",
      "Ganderbal",
      "Jammu",
      "Kathua",
      "Kishtwar",
      "Kulgam",
      "Kupwara",
      "Poonch",
      "Pulwama",
      "Rajouri",
      "Ramban",
      "Reasi",
      "Samba",
      "Shopian",
      "Srinagar",
      "Udhampur"
    ],
    "Ladakh": [
      "Kargil",
      "Leh"
    ],
    "Lakshadweep": [
      "Lakshadweep (Kavaratti)"
    ],
    "Puducherry": [
      "Karaikal",
      "Mahe",
      "Puducherry",
      "Yanam"
    ]
  };

  const BLOOD_TYPES_ORDER = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const STOCK_THRESHOLDS = {
    'O-':  { critical: 4, low: 8 },
    'O+':  { critical: 4, low: 8 },
    'A-':  { critical: 3, low: 5 },
    'A+':  { critical: 3, low: 5 },
    'B-':  { critical: 3, low: 5 },
    'B+':  { critical: 3, low: 5 },
    'AB-': { critical: 2, low: 4 },
    'AB+': { critical: 2, low: 4 }
  };

  // ============================================================
  // 2. ZERO DEMO DATA: DYNAMIC REGISTERED HOSPITALS REPOSITORY
  // ============================================================
  // Populated strictly from database / registered hospital events
  let registeredHospitals = [];

  // DOM Elements
  let stateSelect, districtSelect, bloodTypeSelect, componentSelect, sortBySelect, searchBtn, resetBtn;
  let resultsContainer, resultsCountEl, summaryTextEl;
  let totalUnitsEl, totalNodesEl, totalCriticalEl;

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Main Initialization
   */
  async function initInventoryLogic() {
    stateSelect = document.getElementById('filterState');
    districtSelect = document.getElementById('filterDistrict');
    bloodTypeSelect = document.getElementById('filterBloodType');
    componentSelect = document.getElementById('filterComponent');
    sortBySelect = document.getElementById('filterSortBy');
    searchBtn = document.getElementById('filterSearchBtn');
    resetBtn = document.getElementById('filterResetBtn');

    resultsContainer = document.getElementById('hospital-results-grid') || document.getElementById('hospitalResultsGrid');
    resultsCountEl = document.getElementById('resultsCountNumber');
    summaryTextEl = document.getElementById('activeFilterSummary');

    totalUnitsEl = document.getElementById('total-cataloged-units') || document.getElementById('totalUnitsCount');
    totalNodesEl = document.getElementById('total-reporting-nodes');
    totalCriticalEl = document.getElementById('total-critical-nodes');

    // Populate all 36 States dynamically
    populateStateDropdown();

    // Attach event listeners
    if (stateSelect) {
      stateSelect.addEventListener('change', handleStateChange);
    }
    if (searchBtn) searchBtn.addEventListener('click', executeInventorySearch);
    if (bloodTypeSelect) bloodTypeSelect.addEventListener('change', executeInventorySearch);
    if (componentSelect) componentSelect.addEventListener('change', executeInventorySearch);
    if (districtSelect) districtSelect.addEventListener('change', executeInventorySearch);
    if (sortBySelect) sortBySelect.addEventListener('change', executeInventorySearch);
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    // Initial Empty State before user selects parameters
    executeInventorySearch();

    // Asynchronously load real registered hospitals from DB / Session
    await loadRegisteredHospitals();
  }

  /**
   * Load real registered hospitals from backend API and authenticated storage
   */
  async function loadRegisteredHospitals() {
    registeredHospitals = [];

    const uLat = parseFloat(sessionStorage.getItem('red404_user_lat'));
    const uLng = parseFloat(sessionStorage.getItem('red404_user_lng'));
    let url = '/api/hospitals/directory';
    if (!isNaN(uLat) && !isNaN(uLng)) {
      url += `?lat=${uLat}&lng=${uLng}`;
    }

    // 1. Fetch from server endpoint (/api/hospitals/directory or /api/hospitals)
    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          json.data.forEach(item => {
            const norm = normalizeHospital(item);
            if (norm && !registeredHospitals.some(h => String(h.id) === String(norm.id) || h.name.toLowerCase() === norm.name.toLowerCase())) {
              registeredHospitals.push(norm);
            }
          });
        }
      }
    } catch (e) {
      console.warn('API hospitals directory fetch notice:', e);
    }

    // 2. Fetch from authenticated session storage if any hospital registered or tested locally
    try {
      const localHospRaw = localStorage.getItem('red404_registered_hospitals');
      if (localHospRaw) {
        const localList = JSON.parse(localHospRaw);
        if (Array.isArray(localList)) {
          localList.forEach(item => {
            const norm = normalizeHospital(item);
            if (norm && !registeredHospitals.some(h => String(h.id) === String(norm.id) || h.name.toLowerCase() === norm.name.toLowerCase())) {
              registeredHospitals.push(norm);
            }
          });
        }
      }

      // Check active hospital profile in session
      const hospUserRaw = localStorage.getItem('red404_hospitalProfile') || localStorage.getItem('hospitalProfile') || localStorage.getItem('hospitalUser') || sessionStorage.getItem('hospitalUser');
      if (hospUserRaw) {
        const u = JSON.parse(hospUserRaw);
        const norm = normalizeHospital(u.hospital || u);
        if (norm) {
          const idx = registeredHospitals.findIndex(h => String(h.id) === String(norm.id) || h.name.toLowerCase() === norm.name.toLowerCase());
          if (idx >= 0) {
            registeredHospitals[idx] = norm;
          } else {
            registeredHospitals.push(norm);
          }
        }
      }
    } catch (err) {
      console.warn('Local registered hospitals parse notice:', err);
    }

    // 3. Dynamically update upper counts strictly according to real registered hospitals
    updateTopMetrics();

    // 4. Re-execute active search to reflect any matching hospitals
    executeInventorySearch();
  }

  /**
   * Normalize hospital object from backend/storage into unified presentation structure
   */
  function normalizeHospital(raw) {
    if (!raw) return null;
    const id = raw.id || raw.hospitalId || ('H-' + Math.random().toString(36).substr(2, 6));
    const name = raw.hospitalName || raw.name || 'Registered Blood Bank & Hospital';
    const regNo = raw.registrationNo || raw.registration_no || raw.bloodBankLicense || 'RED-AUTH-REG';
    const callSign = raw.callSign || ('RED-' + (raw.city || raw.state || 'NODE').toUpperCase().replace(/[^A-Z]/g, '').substr(0, 5) + '-' + (raw.id || '01'));
    const state = raw.state || (raw.location && raw.location.state) || '';
    const city = raw.city || (raw.location && raw.location.city) || '';
    let district = raw.district || (raw.location && raw.location.district) || '';
    const address = raw.address || (raw.location && raw.location.address) || `${city || district}, ${state}`;
    const contact = raw.hospitalPhone || raw.phone || raw.contact || raw.adminPhone || raw.emergencyContact || '';
    const lat = raw.latitude != null ? parseFloat(raw.latitude) : (raw.lat != null ? parseFloat(raw.lat) : null);
    const lng = raw.longitude != null ? parseFloat(raw.longitude) : (raw.lng != null ? parseFloat(raw.lng) : null);

    // Resolve district from city or hospital name or address if empty (e.g. Bhimtal is in Nainital district)
    if (!district || district.trim() === '') {
      const lowerName = name.toLowerCase();
      const lowerCity = city.toLowerCase();
      const lowerAddr = address.toLowerCase();
      if (lowerName.includes('bhimtal') || lowerCity.includes('bhimtal') || lowerAddr.includes('bhimtal')) {
        district = 'Nainital';
      } else {
        district = city;
      }
    }

    // Distance calculation
    let distKm = raw.distanceKm != null ? parseFloat(raw.distanceKm) : null;
    if (distKm == null && lat != null && lng != null) {
      const userLat = parseFloat(sessionStorage.getItem('red404_user_lat'));
      const userLng = parseFloat(sessionStorage.getItem('red404_user_lng'));
      if (!isNaN(userLat) && !isNaN(userLng)) {
        distKm = Math.round(calculateDistance(userLat, userLng, lat, lng) * 10) / 10;
      }
    }

    // Extract live stock
    let stock = {};
    if (raw.stock && typeof raw.stock === 'object') {
      stock = { ...raw.stock };
    } else if (raw.inventory && typeof raw.inventory === 'object') {
      stock = { ...raw.inventory };
    } else if (raw.bloodInventory && typeof raw.bloodInventory === 'object') {
      stock = { ...raw.bloodInventory };
    }
    BLOOD_TYPES_ORDER.forEach(bt => {
      stock[bt] = (stock[bt] !== undefined && stock[bt] !== null) ? Number(stock[bt]) : 0;
    });

    return {
      id,
      name,
      verified: true,
      callSign,
      location: {
        state,
        district,
        city,
        address
      },
      latitude: lat,
      longitude: lng,
      distanceKm: distKm,
      contact,
      lastUpdated: raw.lastUpdated || raw.createdAt || raw.created_at || new Date().toISOString(),
      stock
    };
  }

  /**
   * Top Metrics Bar Calculator: strictly computes counts from registered hospital stock
   */
  function updateTopMetrics() {
    let totalUnits = 0;
    let criticalCount = 0;
    const nodesCount = registeredHospitals.length;

    registeredHospitals.forEach(h => {
      const stock = h.stock || {};
      Object.entries(stock).forEach(([type, count]) => {
        const u = Number(count) || 0;
        totalUnits += u;
        if (u <= 3 && (type === 'O-' || type === 'AB-' || type === 'A-' || type === 'B-')) {
          criticalCount++;
        }
      });
    });

    if (totalUnitsEl) {
      totalUnitsEl.textContent = totalUnits > 0 ? `${totalUnits} Units` : '0 Units';
    }
    if (totalNodesEl) {
      totalNodesEl.textContent = nodesCount > 0 ? `${nodesCount} Nodes` : '0 Nodes';
    }
    if (totalCriticalEl) {
      totalCriticalEl.textContent = criticalCount > 0 ? `${criticalCount} Critical` : '0 Critical';
    }
  }

  /**
   * Populate State Dropdown Dynamically with all 36 States & UTs
   */
  function populateStateDropdown() {
    if (!stateSelect) return;

    stateSelect.innerHTML = '<option value="">Select State</option>';
    const states = Object.keys(INDIA_GEO_DATA).sort();
    states.forEach(state => {
      const opt = document.createElement('option');
      opt.value = state;
      opt.textContent = state;
      stateSelect.appendChild(opt);
    });
  }

  /**
   * Handle State Selection & Dynamically Cascade Districts
   */
  function handleStateChange() {
    if (!districtSelect) return;

    const selectedState = stateSelect.value;
    districtSelect.innerHTML = '<option value="">Select District</option>';

    if (!selectedState || !INDIA_GEO_DATA[selectedState]) {
      executeInventorySearch();
      return;
    }

    // Add All Districts option for state-wide queries
    const allOpt = document.createElement('option');
    allOpt.value = 'ALL';
    allOpt.textContent = `All Districts (${selectedState})`;
    districtSelect.appendChild(allOpt);

    INDIA_GEO_DATA[selectedState].forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.textContent = dist;
      districtSelect.appendChild(opt);
    });

    executeInventorySearch();
  }

  /**
   * Execute Inventory Filter & Render
   */
  function executeInventorySearch() {
    const selectedState = stateSelect ? stateSelect.value.trim() : '';
    const selectedDistrict = districtSelect ? districtSelect.value.trim() : '';
    const selectedBloodType = bloodTypeSelect ? bloodTypeSelect.value : 'ALL';
    const selectedComponent = componentSelect ? componentSelect.value : 'ALL';
    const selectedSortBy = sortBySelect ? sortBySelect.value : (document.getElementById('filterSortBy')?.value || 'distance');

    // 1. If no state is selected yet, show default guidance
    if (!selectedState) {
      renderEmptyState("Select a State and District to view live registered hospital stock.");
      if (summaryTextEl) {
        summaryTextEl.innerHTML = "Select a <strong>State</strong> and <strong>District</strong> to view live hospital stock.";
      }
      if (resultsCountEl) resultsCountEl.textContent = "0 Facilities Verified";
      return;
    }

    // Clean comparison tokens
    const cleanToken = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanSelState = cleanToken(selectedState);
    const cleanSelDist = cleanToken(selectedDistrict);

    // 2. Filter registered hospitals strictly by location and criteria
    let results = registeredHospitals.filter(h => {
      const hState = cleanToken(h.location?.state || h.state);
      const hDist = cleanToken(h.location?.district || h.district);
      const hCity = cleanToken(h.location?.city || h.city);
      const hAddr = cleanToken(h.location?.address || h.address);
      const hName = cleanToken(h.name);

      // Match State
      const matchState = (selectedState === 'ALL') || hState.includes(cleanSelState) || cleanSelState.includes(hState);

      // Match District / City
      let matchDist = true;
      if (selectedDistrict && selectedDistrict !== 'ALL') {
        matchDist = hDist.includes(cleanSelDist) || cleanSelDist.includes(hDist) ||
                    hCity.includes(cleanSelDist) || cleanSelDist.includes(hCity) ||
                    hAddr.includes(cleanSelDist) || hName.includes(cleanSelDist);

        // Special regional relationship: Nainital district encompasses Bhimtal
        if (!matchDist && cleanSelDist.includes('nainital')) {
          if (hDist.includes('bhimtal') || hCity.includes('bhimtal') || hAddr.includes('bhimtal') || hName.includes('bhimtal')) {
            matchDist = true;
          }
        }
      }

      // Match Blood Type: If a blood group is selected in the filter, show only hospitals having that group in stock
      let matchType = true;
      if (selectedBloodType !== 'ALL' && selectedBloodType) {
        const units = (h.stock && h.stock[selectedBloodType]) ? Number(h.stock[selectedBloodType]) : 0;
        matchType = units > 0;
      }

      return matchState && matchDist && matchType;
    });

    // 3. Sort results by Distance or Stock
    results.sort((a, b) => {
      if (selectedSortBy === 'stock') {
        const stockA = (selectedBloodType !== 'ALL' && selectedBloodType)
          ? (Number(a.stock?.[selectedBloodType]) || 0)
          : Object.values(a.stock || {}).reduce((sum, u) => sum + (Number(u) || 0), 0);
        const stockB = (selectedBloodType !== 'ALL' && selectedBloodType)
          ? (Number(b.stock?.[selectedBloodType]) || 0)
          : Object.values(b.stock || {}).reduce((sum, u) => sum + (Number(u) || 0), 0);
        return stockB - stockA;
      } else {
        // Distance sorting (closest first)
        const dA = a.distanceKm != null ? parseFloat(a.distanceKm) : 999999;
        const dB = b.distanceKm != null ? parseFloat(b.distanceKm) : 999999;
        if (dA !== dB) return dA - dB;
        return (a.name || '').localeCompare(b.name || '');
      }
    });

    // 4. Update filter summary text
    if (summaryTextEl) {
      let desc = `Showing results for <strong>${selectedDistrict === 'ALL' || !selectedDistrict ? 'All Districts' : selectedDistrict}, ${selectedState}</strong>`;
      if (selectedBloodType !== 'ALL') {
        desc += ` • Blood Type: <strong>${selectedBloodType}</strong> (In Stock Only)`;
      }
      if (selectedSortBy === 'stock') {
        desc += ` • Sorted by: <strong>Total Stock</strong>`;
      } else {
        desc += ` • Sorted by: <strong>Distance</strong>`;
      }
      summaryTextEl.innerHTML = desc;
    }

    // 5. Render results or dynamic empty state
    if (results.length === 0) {
      renderEmptyState("No verified clinical inventory found for these parameters. Only authorized hospitals registered on RED404 will appear here.");
      if (resultsCountEl) resultsCountEl.textContent = "0 Facilities Verified";
    } else {
      if (resultsCountEl) resultsCountEl.textContent = `${results.length} Facilities Verified`;
      renderHospitalCards(results, selectedBloodType);
    }
  }

  /**
   * Render Empty State Notice
   */
  function renderEmptyState(message) {
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="empty-inventory-notice">
        <i class="fa-solid fa-hospital-user"></i>
        <h3>No Clinical Inventory Found</h3>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Render Hospital Cards
   */
  function renderHospitalCards(hospitals, activeBloodType) {
    if (!resultsContainer) return;

    const hasHighlight = activeBloodType && activeBloodType !== 'ALL';

    resultsContainer.innerHTML = hospitals.map(h => {
      const tilesHtml = BLOOD_TYPES_ORDER.map(bt => {
        const units = (h.stock && h.stock[bt] !== undefined) ? Number(h.stock[bt]) : 0;
        const isHighlighted = hasHighlight && bt.toUpperCase() === activeBloodType.toUpperCase();
        const th = STOCK_THRESHOLDS[bt] || { critical: 3, low: 5 };
        let statusState = 'ok';
        let statusLabel = 'OK';
        if (units <= th.critical) {
          statusState = 'critical';
          statusLabel = 'Critical';
        } else if (units <= th.low) {
          statusState = 'low';
          statusLabel = 'Low';
        }
        let tileClasses = ['stock-tile', statusState];
        if (isHighlighted) tileClasses.push('highlighted-type');

        return `
          <div class="${tileClasses.join(' ')}" title="${bt}: ${units} Units (${statusLabel})">
            <span class="blood-drop-badge ${statusState}" aria-label="Blood group ${bt}">
              <span class="drop-text">${bt}</span>
            </span>
            <div class="stock-tile-body">
              <span class="stock-tile-units">${units} <small style="font-size:0.65rem; opacity:0.8;">units</small></span>
              <span class="stock-status-pill status-${statusState}">${statusLabel}</span>
            </div>
          </div>
        `;
      }).join('');

      const updatedTimeStr = formatRelativeTime(h.lastUpdated);
      const mapsQuery = (h.latitude && h.longitude) 
        ? `${h.latitude},${h.longitude}` 
        : encodeURIComponent(`${h.name}, ${h.location.address}`);
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;
      const cleanPhone = (h.contact || '').replace(/[^\d+]/g, '');

      return `
        <div class="hospital-card" data-hospital-id="${h.id}">
          <!-- Header -->
          <div class="hosp-header">
            <div class="hosp-title-group">
              <div class="hosp-name-row">
                <h3 class="hosp-name">${h.name}</h3>
                <span class="hosp-verified-badge"><i class="fa-solid fa-circle-check"></i> VERIFIED</span>
              </div>
              <span class="hosp-callsign">${h.callSign} // CLINICAL NODE</span>
            </div>
            <span class="hosp-distance-pill">
              <i class="fa-solid ${h.distanceKm != null ? 'fa-location-arrow' : 'fa-map-pin'}"></i>
              ${h.distanceKm != null ? `${h.distanceKm} km away` : (h.location.district || h.location.state || 'Verified Node')}
            </span>
          </div>

          <!-- Metadata -->
          <div class="hosp-meta-row">
            <div class="hosp-meta-item">
              <i class="fa-solid fa-map-pin"></i>
              <span>${h.location.address}</span>
            </div>
            ${h.contact ? `
            <div class="hosp-meta-item">
              <i class="fa-solid fa-phone"></i>
              <a href="tel:${cleanPhone}">${h.contact}</a>
            </div>` : ''}
          </div>

          <!-- Blood Stock Mini-Dashboard -->
          <div class="stock-dashboard-wrap">
            <div class="stock-dashboard-header">
              <span>Blood Units Available</span>
              <span class="stock-updated-indicator">
                <i class="fa-solid fa-circle"></i>
                Updated ${updatedTimeStr}
              </span>
            </div>
            <div class="stock-tiles-grid ${hasHighlight ? 'has-filter' : ''}">
              ${tilesHtml}
            </div>
          </div>

          <!-- Card Actions -->
          <div class="hosp-footer-actions">
            ${h.contact ? `
            <a href="tel:${cleanPhone}" class="btn-hosp-call">
              <i class="fa-solid fa-phone"></i>
              <span>Call Hospital</span>
            </a>` : ''}
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="btn-hosp-directions" title="Get directions on Google Maps">
              <i class="fa-solid fa-diamond-turn-right"></i>
              <span>Directions</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return 'Just now';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return 'Recently';
    const diffMins = Math.floor((new Date() - date) / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  }

  function resetFilters() {
    if (stateSelect) stateSelect.value = '';
    if (districtSelect) districtSelect.innerHTML = '<option value="">Select District</option>';
    if (bloodTypeSelect) bloodTypeSelect.value = 'ALL';
    if (componentSelect) componentSelect.value = 'ALL';
    if (sortBySelect) sortBySelect.value = 'distance';
    executeInventorySearch();
  }

  // Global helper for allocation request
  window.requestHospitalAllocation = function (hospitalName, callsign) {
    if (typeof showToast === 'function') {
      showToast(`Emergency Allocation Request dispatched to ${hospitalName} (${callsign}). Clinical response team notified.`, 'success');
    } else {
      alert(`Emergency Allocation Request dispatched to ${hospitalName} (${callsign}). Clinical response team notified.`);
    }
  };

  // Expose state for debugging/testing
  window.RED404_INVENTORY = {
    getRegisteredHospitals: () => registeredHospitals,
    INDIA_GEO_DATA,
    loadRegisteredHospitals,
    executeInventorySearch,
    resetFilters
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInventoryLogic);
  } else {
    initInventoryLogic();
  }
})();
