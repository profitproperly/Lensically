$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
$installer = Join-Path $repoRoot "lensically-local-node\scripts\install-local-node.ps1"
$bootstrap = Join-Path $repoRoot "lensically-local-node\bootstrap\src\service.mjs"

$installerText = Get-Content -Raw $installer
$bootstrapText = Get-Content -Raw $bootstrap

if ($installerText -match "New-Service") { throw "installer_must_not_use_new_service" }
if ($installerText -notmatch "New-ScheduledTaskAction") { throw "scheduled_task_action_missing" }
if ($installerText -notmatch "New-ScheduledTaskTrigger -AtStartup") { throw "startup_trigger_missing" }
if ($installerText -notmatch "New-ScheduledTaskPrincipal -UserId `"SYSTEM`"") { throw "system_principal_missing" }
if ($installerText -notmatch "RestartCount") { throw "restart_policy_missing" }
if ($installerText -notmatch "Unregister-ScheduledTask") { throw "uninstall_path_missing" }
if ($bootstrapText -notmatch "/api/operator/local-node/enroll") { throw "enrollment_call_missing" }
if ($bootstrapText -notmatch "x-lensically-node-credential") { throw "per_node_credential_header_missing" }
if ($bootstrapText -match "x-lensically-node-secret") { throw "global_node_secret_header_forbidden" }
if ($bootstrapText -notmatch "logs") { throw "bootstrap_logging_missing" }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "[local-node-commissioning] source checks ok; full SYSTEM Scheduled Task commissioning skipped because this process is not elevated."
  exit 0
}

Write-Host "[local-node-commissioning] elevated commissioning available; run installer -Mode Commission with a real enrollment token to validate live heartbeat."
