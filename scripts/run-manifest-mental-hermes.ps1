param(
  [ValidateSet("draft", "schedule", "auto")]
  [string]$Mode = "draft",
  [ValidateSet("", "openrouter", "openai", "openai-codex", "anthropic", "nous")]
  [string]$Provider = "",
  [string]$Model = "",
  [switch]$Yolo
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$vaultPath = Join-Path $root "manifest-mental-vault"
$windowsRoot = (Resolve-Path $root).Path
$windowsVault = (Resolve-Path $vaultPath).Path

function Convert-ToWslPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $portablePath = $Path -replace "\\", "/"
  $converted = wsl wslpath -a "$portablePath"
  if ($LASTEXITCODE -ne 0 -or -not $converted) {
    throw "Could not convert path to WSL path: $Path"
  }
  return $converted.Trim()
}

$hermesPath = wsl bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; command -v hermes || true"
$resolvedHermesPath = if ($null -eq $hermesPath) { "" } else { $hermesPath.Trim() }
if (-not $resolvedHermesPath) {
  throw "Hermes is not installed in WSL. Run npm run hermes:install first."
}

$wslRoot = Convert-ToWslPath $windowsRoot
$wslVault = Convert-ToWslPath $windowsVault
$dateEt = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Eastern Standard Time").ToString("yyyy-MM-dd HH:mm:ss")

$modeRules = switch ($Mode) {
  "draft" {
    "Create the 17-post slate and full decision report only. Do not schedule posts."
  }
  "schedule" {
    "Create the 17-post slate, then schedule only if every post clears the rubric. Use the existing Lensically scheduling APIs or scripts. Stop and report if required credentials or API access are missing."
  }
  "auto" {
    "Run the full growth cycle, schedule the 17 winners if the slate clears the rubric, write the report, update memory, and exit. Stop only for missing credentials, API failure, or account-risk concerns."
  }
}

$prompt = @"
You are the Manifest Mental Growth Agent running locally through Hermes.

Current local time ET: $dateEt
Run mode: $Mode
Mode rule: $modeRules

Workspace:
- Repo: $wslRoot
- Obsidian vault memory: $wslVault
- Existing Lensically manual planner script: $wslRoot/scripts/run-manifest-mental-planner.mjs
- Existing npm script: planner:manifestmental

Mission:
Get @manifestmental to 1,000,000 followers by winning the 17 posts per day. Your job is to create a rising floor for follows and average likes while avoiding audience fatigue.

Required operating loop:
1. Read the vault files first, especially 00-Operating-Rules.md, 01-Brand-Voice.md, 02-Growth-Targets.md, 03-Fatigue-Ledger.md, and 04-Post-Rubric.md.
2. Inspect the existing planner and available Lensically scripts/API routes before changing behavior.
3. Pull current account state from allowed first-party Lensically endpoints or local scripts only. Do not scrape Threads. Do not automate logged-in browser activity on Threads.
4. Build a 17-post campaign slate for tomorrow from 07:00 through 23:00 ET.
5. Generate more candidates than needed, reject weak candidates, and choose one winner per slot.
6. Each final post needs a slot, objective, bet type, topic, fatigue check, and expected win condition.
7. Update the vault with a daily report under Reports/ and a compact learning note under Daily/.
8. In draft mode, do not schedule. In schedule or auto mode, schedule only through the existing Lensically scheduling path.
9. Exit after the run is complete. This is not an always-on agent.

Output:
- Print a concise run summary.
- Include any blocked steps and exact missing configuration.
- Include the report path written in the Obsidian vault.
"@

$modelArg = if ($Model.Trim()) { "--model `"$Model`"" } else { "" }
$providerArg = if ($Provider.Trim()) { "--provider `"$Provider`"" } else { "" }
$yoloArg = if ($Yolo) { "--yolo" } else { "" }
$promptPath = Join-Path $env:TEMP "manifest-mental-hermes-prompt.txt"
[IO.File]::WriteAllText($promptPath, $prompt, [Text.UTF8Encoding]::new($false))
$wslPromptPath = Convert-ToWslPath $promptPath
$scriptPath = Join-Path $env:TEMP "manifest-mental-hermes-run.sh"

$script = @"
#!/usr/bin/env bash
set -euo pipefail
cd '$wslRoot'
source ~/.bashrc >/dev/null 2>&1 || true
export PATH="`$HOME/.local/bin:`$PATH"
PROMPT=`$(python3 - <<'PY'
from pathlib import Path
print(Path("$wslPromptPath").read_text(encoding="utf-8-sig"))
PY
)
hermes $yoloArg chat --toolsets "terminal,web,skills" $providerArg $modelArg -q "`$PROMPT"
"@

[IO.File]::WriteAllText($scriptPath, $script, [Text.UTF8Encoding]::new($false))
$wslScriptPath = Convert-ToWslPath $scriptPath
wsl bash "$wslScriptPath"
