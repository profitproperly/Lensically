param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  node .\scripts\run-manifest-mental-planner.mjs
} finally {
  Pop-Location
}
