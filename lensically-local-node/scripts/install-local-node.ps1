param(
  [Parameter(Mandatory=$true)][string]$NodeId,
  [Parameter(Mandatory=$true)][string]$LensicallyOrigin,
  [string]$InstallRoot = "$env:ProgramData\Lensically\LocalExecutionNode"
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this installer from an elevated PowerShell session."
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js is required before installing the Lensically Local Execution Node." }

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallRoot\workers\active" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallRoot\workers\previous" | Out-Null

$secretBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RNGCryptoServiceProvider]::new()
try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
$deviceSecret = [Convert]::ToBase64String($secretBytes).TrimEnd("=")

@{
  node_id = $NodeId
  lensically_origin = $LensicallyOrigin.TrimEnd("/")
  device_secret = $deviceSecret
  repository_path = (Resolve-Path "$PSScriptRoot\..\..").Path
} | ConvertTo-Json | Set-Content -Encoding UTF8 -Path "$InstallRoot\config.json"

@{
  active_slot = "active"
  previous_slot = "previous"
  worker_version = "local-worker-v1"
} | ConvertTo-Json | Set-Content -Encoding UTF8 -Path "$InstallRoot\state.json"

Copy-Item -Recurse -Force "$PSScriptRoot\..\worker\src\worker.mjs" "$InstallRoot\workers\active\worker.mjs"
Copy-Item -Recurse -Force "$PSScriptRoot\..\worker\src\worker.mjs" "$InstallRoot\workers\previous\worker.mjs"
Copy-Item -Recurse -Force "$PSScriptRoot\..\bootstrap\src\service.mjs" "$InstallRoot\service.mjs"

$serviceName = "LensicallyLocalExecutionNode"
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Service -Name $serviceName -ErrorAction SilentlyContinue
  sc.exe delete $serviceName | Out-Null
}

$nodePath = $node.Source
$bin = "`"$nodePath`" `"$InstallRoot\service.mjs`""
New-Service -Name $serviceName -DisplayName "Lensically Local Execution Node" -BinaryPathName $bin -StartupType Automatic | Out-Null
Start-Service -Name $serviceName

Write-Host "Installed Lensically Local Execution Node."
Write-Host "Node ID: $NodeId"
Write-Host "Origin: $LensicallyOrigin"
Write-Host "Service: $serviceName"
Write-Host "Pairing secret was written only to $InstallRoot\config.json. Register this device in Lensically before jobs will be issued."
