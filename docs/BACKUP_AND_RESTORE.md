# RED404 Database Backup, Retention, and Restore SOP

## 1. Overview
This document defines the standard operating procedures (SOP) for automated daily database backups, cryptographic verification, retention pruning, and recovery testing for the RED404 platform.

---

## 2. Backup Strategy & Scheduling

### Automated Daily Backup Job
The backup script (`backend/scripts/backup-database.ps1`) performs:
1. Online, non-blocking single-transaction export (`--single-transaction --quick`).
2. Inclusion of triggers, routines, and table schemas.
3. Cryptographic SHA-256 integrity hashing logged to `backups/backup_manifest.csv`.
4. Automatic retention pruning (default: 7 days daily backups).

### Scheduling via Windows Task Scheduler
To schedule the backup daily at 02:00 AM on Windows:
```powershell
schtasks /create /tn "RED404_Daily_Database_Backup" /tr "powershell -ExecutionPolicy Bypass -File C:\Desktop\Red404_projectt_firstOne\backend\scripts\backup-database.ps1" /sc daily /st 02:00 /ru SYSTEM
```

### Scheduling via Linux Cron (for container/cloud deployments)
```cron
0 2 * * * /usr/bin/mysqldump --single-transaction --quick -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE | gzip > /var/backups/red404_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```

---

## 3. Retention & Off-Site Storage
- **Local Retention:** 7 daily rolling backups stored in `backups/`.
- **Weekly Archive:** Sunday backup archived to cold cloud storage (AWS S3 Glacier or GCP Cloud Storage Nearline) with lifecycle rule set to 90 days.
- **Encryption at Rest:** Backups stored in cloud buckets MUST be encrypted using AES-256 (SSE-S3 or customer-managed KMS keys).

---

## 4. Documented Restore Test Procedure

### Automated Verification Test
Run the restore verification test in non-destructive test mode:
```powershell
powershell -ExecutionPolicy Bypass -File backend\scripts\restore-database.ps1 -TestMode
```

**Verification Steps Performed:**
1. Verifies SHA-256 checksum against manifest.
2. Creates an isolated test database `red404_restore_test`.
3. Loads the full schema, triggers, and data.
4. Executes row count checks across core tables:
   - `donors`
   - `hospitals`
   - `blood_requests`
5. Cleans up `red404_restore_test` upon verification pass.

### Production Emergency Restore
To restore in production during an incident:
```powershell
# 1. Stop web application service to prevent incoming writes
# 2. Execute restore with target backup file
powershell -ExecutionPolicy Bypass -File backend\scripts\restore-database.ps1 -BackupFile "backups\red404_backup_20261117_020000.sql" -Force
# 3. Start web application and check /api/health
```
