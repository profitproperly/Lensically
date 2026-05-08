param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$dashboardUrl = "http://127.0.0.1:9119"
$logPath = Join-Path $repoRoot "logs\hermes-dashboard.log"

New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null

Push-Location $repoRoot
try {
  Start-Process -FilePath "wsl.exe" -ArgumentList @(
    "bash",
    "-lc",
    "cd /mnt/c/Auto-Threads/lensically; /home/brian/.local/bin/hermes dashboard --port 9119 --no-open > /mnt/c/Auto-Threads/lensically/logs/hermes-dashboard.log 2>&1"
  ) -WindowStyle Hidden

  Start-Sleep -Seconds 3
  Start-Process $dashboardUrl
} finally {
  Pop-Location
}
