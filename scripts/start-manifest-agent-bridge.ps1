param(
  [int]$Port = 4127
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  $env:MANIFEST_AGENT_PORT = "$Port"
  node .\scripts\manifest-agent-bridge.mjs
} finally {
  Pop-Location
}
