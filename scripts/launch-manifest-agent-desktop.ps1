param(
  [int]$Port = 4317
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $repoRoot "logs\manifest-agent-desktop.log"
$url = "http://127.0.0.1:$Port"

New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null

$existing = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*manifest-agent-desktop.mjs*"
}

if (-not $existing) {
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-ExecutionPolicy",
    "Bypass",
    "-NoProfile",
    "-Command",
    "cd '$repoRoot'; `$env:MANIFEST_AGENT_DESKTOP_PORT='$Port'; node .\scripts\manifest-agent-desktop.mjs *> '$logPath'"
  ) -WindowStyle Minimized
}

$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -Uri "$url/status" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  Start-Process "notepad.exe" $logPath
  throw "Manifest Mental Agent desktop app did not start. Opened the log file."
}

Start-Process $url
