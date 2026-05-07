param(
  [string]$Model = "anthropic/claude-sonnet-4"
)

$ErrorActionPreference = "Stop"

$hermesPath = wsl bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; command -v hermes || true"
$resolvedHermesPath = if ($null -eq $hermesPath) { "" } else { $hermesPath.Trim() }
if (-not $resolvedHermesPath) {
  throw "Hermes is not installed in WSL. Run npm run hermes:install first."
}

$secureKey = Read-Host "OpenRouter API key" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($apiKey)) {
  throw "OpenRouter API key is required."
}

$envPath = wsl bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; hermes config env-path"
if ($LASTEXITCODE -ne 0 -or -not $envPath) {
  throw "Could not locate Hermes .env path."
}

$windowsEnvPath = wsl wslpath -w "$($envPath.Trim())"
$windowsEnvPath = $windowsEnvPath.Trim()
$envDirectory = Split-Path -Parent $windowsEnvPath
if (-not (Test-Path $envDirectory)) {
  New-Item -ItemType Directory -Path $envDirectory | Out-Null
}

$lines = @()
if (Test-Path $windowsEnvPath) {
  $lines = Get-Content -LiteralPath $windowsEnvPath
}

$nextLines = $lines | Where-Object { $_ -notmatch "^OPENROUTER_API_KEY=" }
$nextLines += "OPENROUTER_API_KEY=$apiKey"
Set-Content -LiteralPath $windowsEnvPath -Value $nextLines -Encoding UTF8

wsl bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; hermes config set model.provider openrouter; hermes config set model.default '$Model'; hermes memory status || true"

Write-Host "Hermes OpenRouter configuration saved."
