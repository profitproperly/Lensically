param()

$ErrorActionPreference = "Stop"

$workerRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Join-Path $workerRoot ".cloudflare.deploy.ps1"

$accountId = Read-Host "Paste the Cloudflare account id"
if ([string]::IsNullOrWhiteSpace($accountId)) {
  throw "Cloudflare account id cannot be empty."
}

$secureToken = Read-Host "Paste the Cloudflare API token" -AsSecureString
$tokenBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($tokenBstr)

  if ([string]::IsNullOrWhiteSpace($plainToken)) {
    throw "Cloudflare API token cannot be empty."
  }

  $fileContent = @(
    '$env:CLOUDFLARE_ACCOUNT_ID="' + $accountId.Trim() + '"',
    '$env:CLOUDFLARE_API_TOKEN="' + $plainToken.Trim() + '"'
  )

  Set-Content -LiteralPath $credentialsPath -Value $fileContent -Encoding UTF8
  Write-Host "Saved Cloudflare deploy credentials to $credentialsPath"
} finally {
  if ($tokenBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenBstr)
  }
}
