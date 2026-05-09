param(
  [int]$Port = 4317
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $repoRoot "logs\manifest-agent-desktop.log"
$url = "http://127.0.0.1:$Port"
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null

$repoSkillRoot = Join-Path $repoRoot "hermes-skills"
if (Test-Path $repoSkillRoot) {
  wsl.exe bash -lc "mkdir -p ~/.hermes/skills/social-media && cp -R /mnt/c/Auto-Threads/lensically/hermes-skills/* ~/.hermes/skills/social-media/"
}

$existing = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match "^node(\.exe)?$" -and $_.CommandLine -like "*manifest-agent-desktop.mjs*"
}

if (-not $existing) {
  $previousPort = $env:MANIFEST_AGENT_DESKTOP_PORT
  $env:MANIFEST_AGENT_DESKTOP_PORT = "$Port"
  $scriptPath = Join-Path $repoRoot "scripts\manifest-agent-desktop.mjs"
  $command = "& { Set-Location '$repoRoot'; `$env:MANIFEST_AGENT_DESKTOP_PORT = '$Port'; & '$nodePath' '$scriptPath' *>> '$logPath' }"
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile",
    "-WindowStyle", "Hidden",
    "-Command", $command
  ) -WorkingDirectory $repoRoot -WindowStyle Hidden
  if ($null -eq $previousPort) {
    Remove-Item Env:MANIFEST_AGENT_DESKTOP_PORT -ErrorAction SilentlyContinue
  } else {
    $env:MANIFEST_AGENT_DESKTOP_PORT = $previousPort
  }
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
