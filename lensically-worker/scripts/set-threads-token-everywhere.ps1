param(
  [string]$AccountSecretName = "THREADS_TOKEN_MANIFEST_MENTAL"
)

$ErrorActionPreference = "Stop"

$workerRoot = Split-Path -Parent $PSScriptRoot
$devVarsPath = Join-Path $workerRoot ".dev.vars"

$secureToken = Read-Host "Paste the Threads access token for $AccountSecretName" -AsSecureString
$tokenBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($tokenBstr)

  if ([string]::IsNullOrWhiteSpace($plainToken)) {
    throw "Token cannot be empty."
  }

  $lines = @()
  if (Test-Path $devVarsPath) {
    $lines = Get-Content -LiteralPath $devVarsPath |
      Where-Object { $_ -notmatch "^\s*$([regex]::Escape($AccountSecretName))\s*=" }
  }

  $lines += "$AccountSecretName=$plainToken"
  Set-Content -LiteralPath $devVarsPath -Value $lines -Encoding UTF8

  Push-Location $workerRoot
  try {
    $plainToken | npx wrangler secret put $AccountSecretName | Out-Host
  } finally {
    Pop-Location
  }

  Write-Host "Saved $AccountSecretName to $devVarsPath and updated the Cloudflare secret."
} finally {
  if ($tokenBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)
  }
}
