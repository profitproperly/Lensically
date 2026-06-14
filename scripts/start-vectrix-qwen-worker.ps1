$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $repoRoot "logs"
$aiRoot = "C:\AI"
$llamaRoot = Join-Path $aiRoot "llama.cpp-bin"
$llamaServer = Join-Path $llamaRoot "llama-server.exe"
$modelRef = "lm-kit/qwen-3-4b-instruct-gguf:Q4_K_M"
$serverUrl = "http://127.0.0.1:8080/health"

New-Item -ItemType Directory -Force -Path $logDir, $aiRoot | Out-Null
$startupLog = Join-Path $logDir "vectrix-startup-task.log"
$nodeOutLog = Join-Path $logDir "vectrix-qwen-worker.out.log"
$nodeErrLog = Join-Path $logDir "vectrix-qwen-worker.err.log"

function Write-StartupLog {
  param([string]$Message)
  $timestamp = (Get-Date).ToString("o")
  Add-Content -LiteralPath $startupLog -Value "$timestamp $Message"
}

function Test-LlamaServer {
  try {
    $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

try {
  Write-StartupLog "starting"

  if (-not (Test-Path $llamaServer)) {
    throw "Missing llama-server.exe at $llamaServer. Install the llama.cpp Windows release into $llamaRoot."
  }

  if (-not (Test-LlamaServer)) {
    $serverOutLog = Join-Path $logDir "vectrix-llama-server.out.log"
    $serverErrLog = Join-Path $logDir "vectrix-llama-server.err.log"
    Write-StartupLog "starting llama-server"
    Start-Process -FilePath $llamaServer -WindowStyle Hidden -WorkingDirectory $llamaRoot -ArgumentList @(
      "-hf", $modelRef,
      "--host", "127.0.0.1",
      "--port", "8080",
      "--ctx-size", "8192",
      "--threads", ([Environment]::ProcessorCount).ToString()
    ) -RedirectStandardOutput $serverOutLog -RedirectStandardError $serverErrLog

    $deadline = (Get-Date).AddMinutes(12)
    while ((Get-Date) -lt $deadline) {
      if (Test-LlamaServer) { break }
      Start-Sleep -Seconds 5
    }
  }

  if (-not (Test-LlamaServer)) {
    throw "llama-server did not become healthy at $serverUrl."
  }

  Start-Sleep -Seconds 3
  Write-StartupLog "starting node worker"
  $nodeScript = Join-Path $repoRoot "scripts\vectrix-qwen-worker.mjs"
  Push-Location $repoRoot
  try {
    & node.exe $nodeScript 1> $nodeOutLog 2> $nodeErrLog
    $nodeExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($nodeExitCode -ne 0) {
    throw "node worker failed with exit code $nodeExitCode. See $nodeErrLog."
  }
  Write-StartupLog "finished"
} catch {
  Write-StartupLog "failed: $($_.Exception.Message)"
  throw
}
