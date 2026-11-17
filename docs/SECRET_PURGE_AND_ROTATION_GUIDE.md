# RED404 Security, Secret Rotation & Scale Hardening Guide

## 1. Secrets Identified & Rotation Actions (Part 0 Scan)

The Part 0 diagnostic scan identified the following secrets and fallback keys that require rotation:

1. **`RED404_ADMIN_SECRET`**:
   - **Location:** Previously embedded as a static fallback in `AdminController.java`.
   - **Status:** **REMOVED from source code.** Loaded strictly from environment variable `RED404_ADMIN_SECRET`.
   - **Action Required:** Generate a new 32-character random alphanumeric secret and set it in your hosting platform (Railway/Render/AWS) and `.env`.
   - **Generation command:**
     ```powershell
     [System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | [byte[]]))
     ```

2. **Master Admin Email (`RED404_ADMIN_EMAIL`)**:
   - **Location:** Previously hardcoded in `AdminController.java`.
   - **Status:** **REMOVED from source code.** Loaded via `EnvConfig.getAdminEmail()`.

3. **Seed Donor Passwords in Migrations**:
   - **Location:** Plain text string `'12345678'` in `DatabaseSchemaMigrator.java`.
   - **Status:** **REMOVED from SQL statements.** Seed donor password is now hashed via `PasswordUtil.hashPassword()`.

---

## 2. Git History Secret Purge Procedure

If any secret or private file was previously committed to git history, use `git filter-repo` or BFG Repo-Cleaner to permanently purge it from history and refs:

### Option A: Using `git-filter-repo` (Recommended)
```bash
# 1. Install git-filter-repo
pip install git-filter-repo

# 2. Purge sensitive files from entire git history (if any existed)
git filter-repo --invert-paths --path .env --path-glob '*.pem' --path-glob '*.key'

# 3. Force push the rewritten history to your remote repository
git push origin --force --all
git push origin --force --tags
```

### Option B: Purging Specific Secret Strings Across All Commits
Create `expressions.txt` containing replacement rules:
```text
regex:RED404404404==>REDACTED_ADMIN_SECRET
```
Then run:
```bash
git filter-repo --replace-text expressions.txt
git push origin --force --all
```

---

## 3. Google Maps Browser API Key Restrictions & Quota Alerts

The Google Maps JavaScript API key is the **only** key permitted in client-side browser code. To prevent quota exhaustion, scraping, and billing spikes:

### Step 1: Restrict Application (HTTP Referrers)
In Google Cloud Console $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials** $\rightarrow$ Select your Maps Key:
1. Under **Key restrictions**, choose **Application restrictions** $\rightarrow$ **Websites**.
2. Add website restrictions:
   - `https://your-production-domain.com/*`
   - `https://*.your-production-domain.com/*`
   - `http://localhost:8080/*` (development only)
   - `http://127.0.0.1:8080/*` (development only)

### Step 2: Restrict API Scopes
Under **API restrictions**:
1. Select **Restrict key**.
2. Check **only** the APIs RED404 utilizes:
   - **Maps JavaScript API**
   - **Geocoding API**
3. Save changes.

### Step 3: Google Cloud Budget Alerts & Quotas
1. Go to **Billing** $\rightarrow$ **Budgets & alerts** in Google Cloud Console.
2. Create a monthly budget for Maps API (e.g., $10 or $25).
3. Set alert triggers at **50%**, **90%**, and **100%** of budget with email notifications to the infrastructure team.
4. Set daily request quotas under **APIs & Services** $\rightarrow$ **Maps JavaScript API** $\rightarrow$ **Quotas**:
   - Cap requests per day (e.g., 5,000 requests/day max) to prevent unexpected overage charges.

---

## 4. Manual Security & Compliance Actions Checklist

The following actions must be executed manually by the repository owner:

- [ ] **Rotate Master Admin Secret:** Configure `RED404_ADMIN_SECRET` in environment variables with a freshly generated secret.
- [ ] **Configure Google Maps Key Restrictions:** Set HTTP referrer restrictions and enable budget alerts in Google Cloud Console.
- [ ] **Enable GitHub Secret Scanning:**
  - Navigate to repository **Settings** $\rightarrow$ **Code security and analysis**.
  - Enable **Secret scanning** and **Push protection** to block accidental secret pushes.
- [ ] **Enforce Two-Factor Authentication (2FA):**
  - Enable 2FA on GitHub accounts with write access.
  - Enable 2FA on cloud hosting providers (Railway, Render, AWS, GCP).
  - Enable 2FA on domain registrars and DNS providers.
  - Enable 2FA on Brevo / email delivery accounts.
- [ ] **Schedule Database Backups:** Register `backend/scripts/backup-database.ps1` in Windows Task Scheduler or production Cron.
