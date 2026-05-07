param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".lensically-agent.env"

$secureKey = Read-Host "Lensically INTERNAL_API_KEY" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $internalKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($internalKey)) {
  throw "Lensically INTERNAL_API_KEY is required."
}

$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content -LiteralPath $envPath
}

$nextLines = $lines | Where-Object {
  $_ -notmatch "^LENSICALLY_INTERNAL_API_KEY=" -and
  $_ -notmatch "^LENSICALLY_API_BASE_URL="
}
$nextLines += "LENSICALLY_INTERNAL_API_KEY=$internalKey"
$nextLines += "LENSICALLY_API_BASE_URL=https://api.lensically.com"

[IO.File]::WriteAllText($envPath, ($nextLines -join [Environment]::NewLine) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host "Lensically agent API configuration saved to .lensically-agent.env."
