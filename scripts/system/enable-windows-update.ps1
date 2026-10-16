# ==============================================================================
# Re-enable Automatic Windows Updates on Windows 11 Home / Pro
# Przymierze Lemiesza System Utility
# ==============================================================================

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Administrator privileges required. Requesting elevation (UAC prompt)..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f $MyInvocation.MyCommand.Path)
    exit
}

Write-Host "Re-enabling Windows Update services and registry defaults..." -ForegroundColor Cyan

# 1. Remove Registry Policy
$auPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (Test-Path $auPath) {
    Remove-ItemProperty -Path $auPath -Name "NoAutoUpdate" -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $auPath -Name "AUOptions" -ErrorAction SilentlyContinue
}

# 2. Re-enable Services
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\wuauserv" -Name "Start" -Value 3 # Manual
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\WaaSMedicSvc" -Name "Start" -Value 3 # Manual
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\UsoSvc" -Name "Start" -Value 2 # Automatic
Set-Service -Name wuauserv -StartupType Manual -ErrorAction SilentlyContinue

# 3. Re-enable Scheduled Tasks
$tasks = @(
    "\Microsoft\Windows\WindowsUpdate\Scheduled Start",
    "\Microsoft\Windows\UpdateOrchestrator\Schedule Scan"
)
foreach ($t in $tasks) {
    try {
        Enable-ScheduledTask -TaskPath ($t.Substring(0, $t.LastIndexOf('\')+1)) -TaskName ($t.Substring($t.LastIndexOf('\')+1)) -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

Write-Host "SUCCESS: Windows Update has been restored to default settings." -ForegroundColor Green
Start-Sleep -Seconds 3
