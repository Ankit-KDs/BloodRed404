# ==============================================================================
# RED404 Automated Database Backup Script (PowerShell)
# Part 8: Scale & Production Readiness
# ==============================================================================
# Usage:
#   powershell -ExecutionPolicy Bypass -File backend\scripts\backup-database.ps1
# Schedule:
#   Run daily at 02:00 AM via Windows Task Scheduler or cron.
# ==============================================================================

param(
    [string]$BackupDir = "backups",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Ensure backup directory exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$backupFile = Join-Path $BackupDir "red404_backup_$timestamp.sql"

# Detect environment / credentials
$mysqlHost = if ($env:MYSQLHOST) { $env:MYSQLHOST } else { "127.0.0.1" }
$mysqlPort = if ($env:MYSQLPORT) { $env:MYSQLPORT } else { "3307" }
$mysqlUser = if ($env:MYSQLUSER) { $env:MYSQLUSER } else { "root" }
$mysqlDb   = if ($env:MYSQLDATABASE) { $env:MYSQLDATABASE } else { "red404" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "RED404 Database Backup Initiated: $timestamp" -ForegroundColor Cyan
Write-Host "Target: ${mysqlHost}:${mysqlPort} / Database: $mysqlDb" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$mysqldump = Get-Command "mysqldump" -ErrorAction SilentlyContinue
if ($null -eq $mysqldump) {
    # Check common XAMPP path
    if (Test-Path "C:\xampp\mysql\bin\mysqldump.exe") {
        $mysqldump = "C:\xampp\mysql\bin\mysqldump.exe"
    }
}

if ($mysqldump) {
    Write-Host "Using mysqldump at: $mysqldump"
    $dumpArgs = @(
        "--host=$mysqlHost",
        "--port=$mysqlPort",
        "--user=$mysqlUser",
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        "--result-file=$backupFile",
        $mysqlDb
    )

    if ($env:MYSQLPASSWORD) {
        $dumpArgs += "--password=$($env:MYSQLPASSWORD)"
    }

    try {
        & $mysqldump $dumpArgs 2>$null
    } catch {
        Write-Host "Notice: mysqldump exited with error." -ForegroundColor DarkGray
    }
}

if (-not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
    if (Test-Path $backupFile) { Remove-Item $backupFile -Force }
    Write-Host "mysqldump not applicable or empty. Invoking RED404 online backup API..." -ForegroundColor Yellow
    try {
        $apiResp = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/backup" -Method Post -Headers @{"X-Admin-Clearance"="LEVEL0-BACKUP-SYSTEM"} -ErrorAction Stop
        if ($apiResp.success) {
            $backupFile = $apiResp.data.filePath
            Write-Host "Online database backup generated via RED404 API: $backupFile" -ForegroundColor Green
        }
    } catch {
        Write-Host "Notice: Online backup API call failed: $_" -ForegroundColor DarkGray
    }
}

if (Test-Path $backupFile) {
    $fileInfo = Get-Item $backupFile
    $hash = (Get-FileHash -Path $backupFile -Algorithm SHA256).Hash
    Write-Host "----------------------------------------------------------"
    Write-Host "Backup Created Successfully!" -ForegroundColor Green
    Write-Host "File: $($fileInfo.FullName)"
    Write-Host "Size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB"
    Write-Host "SHA-256: $hash"
    Write-Host "----------------------------------------------------------"

    # Save metadata log
    "$timestamp,$($fileInfo.Name),$($fileInfo.Length),$hash" | Out-File -FilePath "$BackupDir/backup_manifest.csv" -Append -Encoding UTF8

    # Retention pruning: remove backups older than $RetentionDays
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -File | Where-Object { $_.LastWriteTime -lt $cutoff -and $_.Name -like "red404_backup_*" } | ForEach-Object {
        Write-Host "Pruning expired backup: $($_.Name)" -ForegroundColor DarkGray
        Remove-Item $_.FullName -Force
    }
} else {
    Write-Error "Backup file was not created."
}
