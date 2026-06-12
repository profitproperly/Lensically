$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $repoRoot "logs"
$aiRoot = "C:\AI"
$llamaRoot = Join-Path $aiRoot "llama.cpp"
$llamaServer = Join-Path $llamaRoot "build\bin\Release\llama-server.exe"
$modelRef = "lm-kit/qwen-3-4b-instruct-gguf:Q4_K_M"
$serverUrl = "http://127.0.0.1:8080/health"

New-Item -ItemType Directory -Force -Path $logDir, $aiRoot | Out-Null

function Test-LlamaServer {
  try {
    $response = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-Path $llamaServer)) {
  if (-not (Test-Path $llamaRoot)) {
    git clone https://github.com/ggerganov/llama.cpp.git $llamaRoot
  }
  Push-Location $llamaRoot
  try {
    cmake -B build -DGGML_NATIVE=ON
    cmake --build build --config Release --target llama-server -j
  } finally {
    Pop-Location
  }
}

if (-not (Test-LlamaServer)) {
  $serverLog = Join-Path $logDir "vectrix-llama-server.log"
  Start-Process -FilePath $llamaServer -WindowStyle Hidden -WorkingDirectory $llamaRoot -ArgumentList @(
    "-hf", $modelRef,
    "--host", "127.0.0.1",
    "--port", "8080",
    "--ctx-size", "8192",
    "--threads", ([Environment]::ProcessorCount).ToString()
  ) -RedirectStandardOutput $serverLog -RedirectStandardError $serverLog

  $deadline = (Get-Date).AddMinutes(12)
  while ((Get-Date) -lt $deadline) {
    if (Test-LlamaServer) { break }
    Start-Sleep -Seconds 5
  }
}

Start-Sleep -Seconds 3
node (Join-Path $repoRoot "scripts\vectrix-qwen-worker.mjs")
