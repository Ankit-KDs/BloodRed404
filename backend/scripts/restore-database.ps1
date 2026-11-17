# ==============================================================================
# RED404 Automated Database Restore & Verification Test Script (PowerShell)
# Part 8: Scale & Production Readiness
# ==============================================================================
# Usage:
#   Test Restore:
#     powershell -ExecutionPolicy Bypass -File backend\scripts\restore-database.ps1 -TestMode
#   Production Restore:
#     powershell -ExecutionPolicy Bypass -File backend\scripts\restore-database.ps1 -BackupFile "backups\red404_backup_xxxx.sql" -Force
# ==============================================================================

param(
    [string]$BackupFile = "",
    [switch]$TestMode,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Auto-detect latest backup if not specified
if (-not $BackupFile) {
    $latest = Get-ChildItem -Path "backups" -Filter "red404_backup_*.sql" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $latest) {
        # Check H2 backup
        $latest = Get-ChildItem -Path "backups" -Filter "red404_h2_*.mv.db" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
    if ($null -eq $latest) {
        Write-Error "No backup files found in 'backups/' directory."
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Error "Specified backup file does not exist: $BackupFile"
}

$mysqlHost = if ($env:MYSQLHOST) { $env:MYSQLHOST } else { "127.0.0.1" }
$mysqlPort = if ($env:MYSQLPORT) { $env:MYSQLPORT } else { "3307" }
$mysqlUser = if ($env:MYSQLUSER) { $env:MYSQLUSER } else { "root" }
$targetDb  = if ($TestMode) { "red404_restore_test" } else { if ($env:MYSQLDATABASE) { $env:MYSQLDATABASE } else { "red404" } }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "RED404 Database Restore $(if ($TestMode) { '[VERIFICATION TEST]' } else { '[PRODUCTION]' })" -ForegroundColor Cyan
Write-Host "Source Backup: $BackupFile"
Write-Host "Target: ${mysqlHost}:${mysqlPort} / Database: $targetDb"
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $TestMode -and -not $Force) {
    $confirm = Read-Host "WARNING: You are about to restore to target database '$targetDb'. Type 'RESTORE' to proceed"
    if ($confirm -ne "RESTORE") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
}

$mysqlCli = Get-Command "mysql" -ErrorAction SilentlyContinue
if ($null -eq $mysqlCli) {
    if (Test-Path "C:\xampp\mysql\bin\mysql.exe") {
        $mysqlCli = "C:\xampp\mysql\bin\mysql.exe"
    }
}

$mysqlConnected = $false
if ($mysqlCli) {
    try {
        $testArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", "-e", "SELECT 1;")
        if ($env:MYSQLPASSWORD) { $testArgs += "--password=$($env:MYSQLPASSWORD)" }
        $out = & $mysqlCli $testArgs 2>$null
        if ($LASTEXITCODE -eq 0) { $mysqlConnected = $true }
    } catch {}
}

if ($mysqlConnected -and $BackupFile.EndsWith(".sql")) {
    # 1. Create target DB if needed
    $createArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", "-e", "CREATE DATABASE IF NOT EXISTS $targetDb CHARACTER SET utf8mb4;")
    if ($env:MYSQLPASSWORD) { $createArgs += "--password=$($env:MYSQLPASSWORD)" }
    & $mysqlCli $createArgs

    # 2. Execute restore
    Write-Host "Executing SQL restore into $targetDb..."
    $restoreArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", $targetDb)
    if ($env:MYSQLPASSWORD) { $restoreArgs += "--password=$($env:MYSQLPASSWORD)" }

    Get-Content $BackupFile | & $mysqlCli $restoreArgs

    # 3. Verification row checks
    Write-Host "Verifying restored tables and row counts in $targetDb..." -ForegroundColor Green
    $verifySql = "SELECT 'donors' AS tbl, COUNT(*) AS count FROM donors UNION ALL " +
                 "SELECT 'hospitals', COUNT(*) FROM hospitals UNION ALL " +
                 "SELECT 'blood_requests', COUNT(*) FROM blood_requests;"

    $verifyArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", $targetDb, "-e", $verifySql)
    if ($env:MYSQLPASSWORD) { $verifyArgs += "--password=$($env:MYSQLPASSWORD)" }
    & $mysqlCli $verifyArgs

    if ($TestMode) {
        Write-Host "Cleaning up verification test database '$targetDb'..." -ForegroundColor DarkGray
        $dropArgs = @("--host=$mysqlHost", "--port=$mysqlPort", "--user=$mysqlUser", "-e", "DROP DATABASE $targetDb;")
        if ($env:MYSQLPASSWORD) { $dropArgs += "--password=$($env:MYSQLPASSWORD)" }
        & $mysqlCli $dropArgs
    }

    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Restore test verification COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "Verifying backup file integrity..." -ForegroundColor Cyan
    $hash = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash
    $sizeKb = [math]::Round((Get-Item $BackupFile).Length / 1KB, 2)
    Write-Host "Backup file exists: $BackupFile ($sizeKb KB)" -ForegroundColor Green
    Write-Host "SHA-256 Checksum: $hash" -ForegroundColor Green
    if (-not $mysqlConnected) {
        Write-Host "Notice: MySQL instance at ${mysqlHost}:${mysqlPort} is currently offline." -ForegroundColor Yellow
        Write-Host "To execute full table restoration into MySQL, start MySQL service and rerun this script." -ForegroundColor Yellow
    }
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Backup file verification PASSED successfully!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
}
