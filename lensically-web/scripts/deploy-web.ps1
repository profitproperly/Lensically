param()

$ErrorActionPreference = "Stop"

$webRoot = Split-Path -Parent $PSScriptRoot
$workerRoot = Join-Path (Split-Path -Parent $webRoot) "lensically-worker"
$credentialsPath = Join-Path $workerRoot ".cloudflare.deploy.ps1"

if (-not (Test-Path $credentialsPath)) {
  throw "Missing Cloudflare deploy credentials file at $credentialsPath."
}

. $credentialsPath

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_ACCOUNT_ID)) {
  throw "CLOUDFLARE_ACCOUNT_ID was not loaded."
}

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN was not loaded."
}

Push-Location $webRoot
try {
  npm run build:cf
  npx opennextjs-cloudflare deploy
} finally {
  Pop-Location
}
