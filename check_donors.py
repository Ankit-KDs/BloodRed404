import urllib.request
import json
import http.cookiejar

BASE = 'https://bloodred404-production.up.railway.app'
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Admin login
login_data = json.dumps({'email': 'admin@red404.org', 'authCode': 'Red404admin@2026!'}).encode('utf-8')
req = urllib.request.Request(f'{BASE}/api/admin/stealth-auth', data=login_data, headers={'Content-Type': 'application/json'})
opener.open(req)

for did in [11, 13, 14]:
    try:
        req = urllib.request.Request(f'{BASE}/api/admin/donors/{did}')
        with opener.open(req) as r:
            d = json.loads(r.read().decode('utf-8')).get('data', {})
            acc = d.get('account', {})
            contact = d.get('contact', {})
            print(f"Donor {did}: name={acc.get('name')}, email={contact.get('email')}, phone={contact.get('phone')}, smartId={acc.get('smartId')}")
    except Exception as e:
        print(f"Donor {did}: {e}")
