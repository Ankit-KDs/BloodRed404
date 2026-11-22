import urllib.request
import json
import http.cookiejar

BASE = 'https://bloodred404-production.up.railway.app'
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

print('=== 1. VERIFY STATIC & ROUTING ALIASES ===')
for path in ['/favicon.ico', '/public-search.html', '/eligibility.html', '/who-can-donate.html', '/privacy.html', '/faq.html', '/api/system/health']:
    try:
        req = urllib.request.Request(BASE + path, headers={'User-Agent': 'TestClient/1.0'})
        with opener.open(req, timeout=10) as r:
            body = r.read()
            print(f'{path}: HTTP {r.status} (Length: {len(body)})')
    except urllib.error.HTTPError as he:
        print(f'{path}: HTTP Error {he.code}')
    except Exception as e:
        print(f'{path}: Error ({e})')

print('\n=== 2. VERIFY PUBLIC SEARCH DEFAULT LISTING ===')
search_url = f'{BASE}/api/donors/availability?bloodGroup=A%2B&lat=28.9845&lng=77.7064&radiusKm=20'
try:
    req = urllib.request.Request(search_url, headers={'User-Agent': 'TestClient/1.0'})
    with opener.open(req, timeout=10) as r:
        body = json.loads(r.read().decode('utf-8'))
        data = body.get('data', body)
        print(f'Status: {r.status}')
        print(f'Eligible nearby count: {data.get("eligibleNearbyCount")}')
        print(f'Eligible nearby display: "{data.get("eligibleNearbyDisplay")}"')
        donors = data.get('donors', [])
        print(f'Listed donors count: {len(donors)}')
        if donors:
            first_donor = donors[0]
            print(f'First donor fields: {list(first_donor.keys())}')
            print(f'First donor sample: {first_donor}')
            # Check privacy constraints:
            forbidden = ['phone', 'email', 'address', 'latitude', 'longitude', 'donorId', 'id', 'dob', 'age', 'gender']
            leaked = [k for k in forbidden if k in first_donor]
            if leaked:
                print(f'PRIVACY VIOLATION! Leaked fields: {leaked}')
            else:
                print('PASS: No PII or exact coordinates in donor search payload!')
except Exception as e:
    print(f'Public search error: {e}')

print('\n=== 3. VERIFY EMPTY SEARCH MESSAGE ===')
empty_url = f'{BASE}/api/donors/availability?bloodGroup=AB-&lat=0.01&lng=0.01&radiusKm=5'
try:
    req = urllib.request.Request(empty_url, headers={'User-Agent': 'TestClient/1.0'})
    with opener.open(req, timeout=10) as r:
        body = json.loads(r.read().decode('utf-8'))
        data = body.get('data', body)
        print(f'Empty search display: "{data.get("eligibleNearbyDisplay")}"')
except Exception as e:
    print(f'Empty search error: {e}')

print('\n=== 4. VERIFY DONOR LOGIN & SESSION ===')
login_url = f'{BASE}/api/donor/login'
try:
    payload = json.dumps({'loginEmail': 'ak30kr02@gmail.com', 'password': 'Password@123'}).encode('utf-8')
    req = urllib.request.Request(login_url, data=payload, headers={'Content-Type': 'application/json'})
    with opener.open(req, timeout=10) as r:
        res = json.loads(r.read().decode('utf-8'))
        print(f'Login with Password@123 status: {r.status}, response: {res.get("message")}')
except urllib.error.HTTPError as he:
    # Try 12345678
    try:
        payload = json.dumps({'loginEmail': 'ak30kr02@gmail.com', 'password': '12345678'}).encode('utf-8')
        req = urllib.request.Request(login_url, data=payload, headers={'Content-Type': 'application/json'})
        with opener.open(req, timeout=10) as r:
            res = json.loads(r.read().decode('utf-8'))
            print(f'Login with 12345678 status: {r.status}, response: {res.get("message")}')
    except Exception as e2:
        print(f'Login attempt 2 error: {e2}')

print('\n=== 5. VERIFY PROFILE FETCH ===')
try:
    req = urllib.request.Request(f'{BASE}/api/donor/profile', headers={'User-Agent': 'TestClient/1.0'})
    with opener.open(req, timeout=10) as r:
        prof = json.loads(r.read().decode('utf-8'))
        donor = prof.get('data', {}).get('donor', prof.get('data', {}))
        print(f'Profile status: {r.status}')
        print(f'Donor Name: {donor.get("name")}, Blood: {donor.get("bloodType")}, DonorID: {donor.get("donorId")}')
        print(f'Public Search Opt-in: {donor.get("publicSearchOptIn")}')
        print(f'Has health check: {donor.get("hasRealVitals") or donor.get("weight")}')
except Exception as e:
    print(f'Profile fetch error: {e}')
