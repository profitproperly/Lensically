$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$scriptPath = Join-Path $repoRoot "scripts\start-vectrix-qwen-worker.ps1"
$taskName = "Lensically Vectrix Qwen Worker"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Starts llama.cpp Qwen and schedules Vectrix Threads posts for tomorrow if missing." -Force | Out-Null
Write-Host "Installed startup task: $taskName"
