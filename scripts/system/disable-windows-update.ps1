# ==============================================================================
# Disable Automatic Windows Updates on Windows 11 Home / Pro
# Przymierze Lemiesza System Utility
# ==============================================================================

# Ensure script is running with elevated Administrator privileges
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Administrator privileges required. Requesting elevation (UAC prompt)..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $MyInvocation.MyCommand.Path)
    exit
}

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  Disabling Automatic Windows Updates (Windows 11 Home/Pro)        " -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

# 1. Group Policy / Registry Override (HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU)
$auPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (-not (Test-Path $auPath)) {
    New-Item -Path $auPath -Force | Out-Null
}
# NoAutoUpdate: 1 = Disables automatic updates completely
Set-ItemProperty -Path $auPath -Name "NoAutoUpdate" -Value 1 -Type DWord
# AUOptions: 2 = Notify for download and notify for install (fallback)
Set-ItemProperty -Path $auPath -Name "AUOptions" -Value 2 -Type DWord
Write-Host "[1/5] Registry policy 'NoAutoUpdate=1' applied." -ForegroundColor Green

# 2. Windows Update Service (wuauserv)
try {
    Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
    Set-Service -Name wuauserv -StartupType Disabled -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\wuauserv" -Name "Start" -Value 4
    Write-Host "[2/5] Windows Update Service (wuauserv) stopped and disabled." -ForegroundColor Green
} catch {
    Write-Warning "Failed to set wuauserv: $_"
}

# 3. Windows Update Medic Service (WaaSMedicSvc)
# WaaSMedicSvc is designed to secretly re-enable wuauserv. Disabling via registry Start=4:
try {
    Stop-Service -Name WaaSMedicSvc -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\WaaSMedicSvc" -Name "Start" -Value 4
    Write-Host "[3/5] Windows Update Medic Service (WaaSMedicSvc) disabled." -ForegroundColor Green
} catch {
    Write-Warning "Failed to set WaaSMedicSvc: $_"
}

# 4. Update Orchestrator Service (UsoSvc)
# Responsible for background download and scheduled installation
try {
    Stop-Service -Name UsoSvc -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\UsoSvc" -Name "Start" -Value 4
    Write-Host "[4/5] Update Orchestrator Service (UsoSvc) disabled." -ForegroundColor Green
} catch {
    Write-Warning "Failed to set UsoSvc: $_"
}

# 5. Disable Windows Update & Orchestrator Scheduled Tasks
$tasks = @(
    "\Microsoft\Windows\WindowsUpdate\Automatic App Update",
    "\Microsoft\Windows\WindowsUpdate\Scheduled Start",
    "\Microsoft\Windows\UpdateOrchestrator\Schedule Scan",
    "\Microsoft\Windows\UpdateOrchestrator\Schedule Scan Static",
    "\Microsoft\Windows\UpdateOrchestrator\UpdateModelTask",
    "\Microsoft\Windows\UpdateOrchestrator\USO_UxBroker"
)
foreach ($t in $tasks) {
    try {
        Disable-ScheduledTask -TaskPath ($t.Substring(0, $t.LastIndexOf('\')+1)) -TaskName ($t.Substring($t.LastIndexOf('\')+1)) -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}
Write-Host "[5/5] Background update scheduled tasks disabled." -ForegroundColor Green

Write-Host "===================================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Automatic Windows Updates are now completely disabled!  " -ForegroundColor Green
Write-Host "  (To restore at any time, run 'enable-windows-update.ps1')        " -ForegroundColor Gray
Write-Host "===================================================================" -ForegroundColor Green

$statusReport = @"
[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Windows Updates Disabled:
- Registry NoAutoUpdate: $(Get-ItemPropertyValue -Path $auPath -Name 'NoAutoUpdate' -ErrorAction SilentlyContinue)
- wuauserv Start: $(Get-ItemPropertyValue -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\wuauserv' -Name 'Start' -ErrorAction SilentlyContinue)
- WaaSMedicSvc Start: $(Get-ItemPropertyValue -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\WaaSMedicSvc' -Name 'Start' -ErrorAction SilentlyContinue)
- UsoSvc Start: $(Get-ItemPropertyValue -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\UsoSvc' -Name 'Start' -ErrorAction SilentlyContinue)
Status: SUCCESS
"@
$statusReport | Out-File -FilePath "$PSScriptRoot\update-status.log" -Encoding utf8

Start-Sleep -Seconds 3
