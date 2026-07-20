param(
  [ValidateSet("Install", "Repair", "Uninstall", "Commission")]
  [string]$Mode = "Install",
  [Parameter(Mandatory=$true)][string]$NodeId,
  [string]$LensicallyOrigin = "https://api.lensically.com",
  [string]$EnrollmentToken,
  [string]$InstallRoot = "$env:ProgramData\Lensically\LocalExecutionNode",
  [string]$TaskName = "LensicallyLocalExecutionNode"
)

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
  return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function New-Secret([int]$Bytes = 32) {
  $secretBytes = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($secretBytes).TrimEnd("=")
}

function Write-NodeLog([string]$Message) {
  $logDir = Join-Path $InstallRoot "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $safe = $Message -replace '[A-Za-z0-9_./+=-]{32,}', '[redacted]'
  Add-Content -Encoding UTF8 -Path (Join-Path $logDir "install.log") -Value "$(Get-Date -Format o) $safe"
}

function Copy-NodeFiles {
  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  New-Item -ItemType Directory -Force -Path "$InstallRoot\workers\active" | Out-Null
  New-Item -ItemType Directory -Force -Path "$InstallRoot\workers\previous" | Out-Null
  New-Item -ItemType Directory -Force -Path "$InstallRoot\logs" | Out-Null
  Copy-Item -Force "$PSScriptRoot\..\worker\src\worker.mjs" "$InstallRoot\workers\active\worker.mjs"
  Copy-Item -Force "$PSScriptRoot\..\worker\src\worker.mjs" "$InstallRoot\workers\previous\worker.mjs"
  Copy-Item -Force "$PSScriptRoot\..\bootstrap\src\service.mjs" "$InstallRoot\service.mjs"
}

function Protect-NodeAcl {
  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  & icacls $InstallRoot /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to harden install root ACL." }
  $configPath = Join-Path $InstallRoot "config.json"
  if (Test-Path $configPath) {
    & icacls $configPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to harden config ACL." }
  }
}

function Write-Config {
  if (-not $EnrollmentToken -and $Mode -eq "Install") { throw "EnrollmentToken is required for first install." }
  $existing = $null
  $configPath = Join-Path $InstallRoot "config.json"
  if (Test-Path $configPath) { $existing = Get-Content -Raw $configPath | ConvertFrom-Json }
  $credential = if ($existing.device_credential) { $existing.device_credential } else { New-Secret 48 }
  @{
    node_id = $NodeId
    lensically_origin = $LensicallyOrigin.TrimEnd("/")
    enrollment_token = $EnrollmentToken
    enrolled_at = $existing.enrolled_at
    device_credential = $credential
    repository_path = (Resolve-Path "$PSScriptRoot\..\..").Path
  } | ConvertTo-Json | Set-Content -Encoding UTF8 -Path $configPath
  Protect-NodeAcl

  @{
    active_slot = "active"
    previous_slot = "previous"
    worker_version = "local-worker-v1"
  } | ConvertTo-Json | Set-Content -Encoding UTF8 -Path (Join-Path $InstallRoot "state.json")
}

function Register-NodeTask {
  if (-not (Test-IsAdmin)) { throw "Elevated PowerShell is required to register the boot-time SYSTEM Scheduled Task." }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { throw "Node.js is required before installing the Lensically Local Execution Node." }
  $action = New-ScheduledTaskAction -Execute $node.Source -Argument "`"$InstallRoot\service.mjs`"" -WorkingDirectory $InstallRoot
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Days 30)
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}

function Start-NodeTask {
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 3
  $task = Get-ScheduledTask -TaskName $TaskName
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-NodeLog "Task state=$($task.State) lastResult=$($info.LastTaskResult)"
  return @{ state = "$($task.State)"; last_result = $info.LastTaskResult }
}

if ($Mode -eq "Uninstall") {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
  Write-NodeLog "Uninstalled scheduled task $TaskName"
  return
}

Copy-NodeFiles
Protect-NodeAcl
Write-Config
Register-NodeTask
$start = Start-NodeTask

if ($Mode -eq "Commission") {
  $task = Get-ScheduledTask -TaskName $TaskName
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  $logFile = Join-Path $InstallRoot "logs\bootstrap.log"
  [pscustomobject]@{
    task_name = $TaskName
    host_mechanism = "Windows Scheduled Task at boot as SYSTEM"
    no_interactive_login_required = $true
    restart_configured = $true
    state = "$($task.State)"
    last_task_result = $info.LastTaskResult
    bootstrap_log_exists = Test-Path $logFile
    install_root = $InstallRoot
  } | ConvertTo-Json
} else {
  Write-Host "Installed Lensically Local Execution Node as boot-time Scheduled Task."
  Write-Host "Node ID: $NodeId"
  Write-Host "Origin: $LensicallyOrigin"
  Write-Host "Task: $TaskName"
  Write-Host "Task state: $($start.state)"
}
