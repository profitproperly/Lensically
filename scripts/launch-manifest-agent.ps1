param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $repoRoot "logs\manifest-agent-bridge.log"
$agentControlUrl = "https://app.lensically.com/agent-control"
$bridgeUrl = "http://127.0.0.1:4127/status"

New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null

$existingBridge = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*manifest-agent-bridge.mjs*"
}

if (-not $existingBridge) {
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-ExecutionPolicy",
    "Bypass",
    "-NoProfile",
    "-Command",
    "cd '$repoRoot'; node .\scripts\manifest-agent-bridge.mjs *> '$logPath'"
  ) -WindowStyle Minimized
}

$started = $false
for ($attempt = 0; $attempt -lt 12; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -Uri $bridgeUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $started = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $started) {
  Start-Process "notepad.exe" $logPath
  throw "Manifest agent bridge did not start. Opened the log file."
}

Start-Process $agentControlUrl
