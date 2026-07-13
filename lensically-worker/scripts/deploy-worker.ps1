param()

$ErrorActionPreference = "Stop"

$workerRoot = Split-Path -Parent $PSScriptRoot
$credentialsPath = Join-Path $workerRoot ".cloudflare.deploy.ps1"

if (-not (Test-Path $credentialsPath)) {
  throw "Missing Cloudflare deploy credentials file at $credentialsPath. Run npm run cf:setup first."
}

. $credentialsPath

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_ACCOUNT_ID)) {
  throw "CLOUDFLARE_ACCOUNT_ID was not loaded."
}

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_API_TOKEN)) {
  throw "CLOUDFLARE_API_TOKEN was not loaded."
}

Push-Location $workerRoot
try {
  $commitSha = (git rev-parse HEAD).Trim()
  npx wrangler deploy --var "LENSICALLY_COMMIT_SHA:$commitSha"
} finally {
  Pop-Location
}
