param()

$ErrorActionPreference = "Stop"

function Invoke-Wsl {
  param([Parameter(Mandatory = $true)][string]$Command)
  wsl bash -lc $Command
}

$status = wsl --status 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "WSL2 is required for Hermes on Windows. Install WSL2 before running this setup."
}

Write-Host "WSL status:"
Write-Host $status

$existing = Invoke-Wsl "command -v hermes || true"
$existingPath = if ($null -eq $existing) { "" } else { $existing.Trim() }
if ($existingPath) {
  Write-Host "Hermes already installed at $existingPath."
  Invoke-Wsl "hermes --version || true"
  exit 0
}

Write-Host "Installing Hermes Agent in WSL..."
Invoke-Wsl "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"

Write-Host "Hermes install finished. Running diagnostics..."
Invoke-Wsl "source ~/.bashrc >/dev/null 2>&1 || true; command -v hermes && hermes --version || true"
