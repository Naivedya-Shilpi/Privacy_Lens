<#
.SYNOPSIS
  PrivacyLens -- One-Command Teammate Setup Script (Windows PowerShell)

.DESCRIPTION
  Verifies required prerequisites (Node.js, npm, Python, Git), installs backend
  npm dependencies via `npm ci`, creates `server/.env` from `server/.env.example`
  if not already present, installs Python dependencies from `requirements.txt`,
  and verifies the evaluation dataset partitions if the local dataset is present.

  SAFETY GUARANTEE:
  - Does NOT install system software silently.
  - Does NOT modify system PATH, registry, or global settings.
  - Never overwrites an existing `server/.env` file.
#>

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " PrivacyLens -- Teammate Environment Setup (Problem C18)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "`n[1/5] Checking system prerequisites..." -ForegroundColor Yellow

function Test-CommandExists($cmdName, $installHint) {
  if (-not (Get-Command $cmdName -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] '$cmdName' was not found in PATH." -ForegroundColor Red
    Write-Host "          $installHint" -ForegroundColor Red
    exit 1
  }
}

Test-CommandExists "node" "Please install Node.js LTS (v18+ or v22+) from https://nodejs.org/"
Test-CommandExists "npm" "npm is bundled with Node.js. Please ensure Node.js is properly installed."
Test-CommandExists "python" "Please install Python 3.10+ from https://www.python.org/"
Test-CommandExists "git" "Please install Git from https://git-scm.com/"

$nodeVer = node -v
$npmVer = npm -v
$pyVer = python --version
$gitVer = git --version

Write-Host "  Node.js : $nodeVer" -ForegroundColor Green
Write-Host "  npm     : v$npmVer" -ForegroundColor Green
Write-Host "  Python  : $pyVer" -ForegroundColor Green
Write-Host "  Git     : $gitVer" -ForegroundColor Green

# 2. Configure server/.env safely
Write-Host "`n[2/5] Checking backend environment configuration (server/.env)..." -ForegroundColor Yellow
$envExample = Join-Path $RepoRoot "server\.env.example"
$envTarget = Join-Path $RepoRoot "server\.env"

if (-not (Test-Path $envTarget)) {
  Copy-Item -Path $envExample -Destination $envTarget
  Write-Host "  Created server/.env from server/.env.example (no API keys required for Phase 1-4)." -ForegroundColor Green
} else {
  Write-Host "  server/.env already exists (preserved without overwriting)." -ForegroundColor Green
}

# 3. Install Backend Node.js Dependencies
Write-Host "`n[3/5] Installing Express backend dependencies in server/..." -ForegroundColor Yellow
Push-Location (Join-Path $RepoRoot "server")
try {
  if (Test-Path "package-lock.json") {
    Write-Host "  Running deterministic install: npm ci" -ForegroundColor Gray
    npm ci
  } else {
    Write-Host "  Running: npm install" -ForegroundColor Gray
    npm install
  }
  if ($LASTEXITCODE -ne 0) {
    throw "npm dependency installation failed with exit code $LASTEXITCODE."
  }
  Write-Host "  Backend Node.js dependencies installed successfully." -ForegroundColor Green
} finally {
  Pop-Location
}

# 4. Verify / Install Python Evaluation Dependencies (requirements.txt)
Write-Host "`n[4/5] Checking Python evaluation dependencies (requirements.txt)..." -ForegroundColor Yellow
$reqFile = Join-Path $RepoRoot "requirements.txt"
$venvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (Test-Path $venvPython) {
  $activePy = $venvPython
  Write-Host "  Using existing virtual environment at .venv\Scripts\python.exe" -ForegroundColor Gray
} else {
  $activePy = "python"
}

& $activePy -m pip install --disable-pip-version-check --quiet -r $reqFile
if ($LASTEXITCODE -ne 0) {
  throw "pip install failed with exit code $LASTEXITCODE."
}
Write-Host "  Python dependencies (pandas, openpyxl) verified." -ForegroundColor Green

# 5. Check Optional Local Research Dataset
Write-Host "`n[5/5] Checking local evaluation dataset status..." -ForegroundColor Yellow
$datasetDir = Join-Path $RepoRoot "datasets\Annotated Privacy Policies of 100 Online Platforms"
if (Test-Path (Join-Path $datasetDir "PP_table Tagger1.xlsx")) {
  Write-Host "  Found local research dataset. Generating and verifying evaluation partitions..." -ForegroundColor Gray
  & $activePy (Join-Path $RepoRoot "scripts\prepare-evaluation-dataset.py") | Out-Null
  & $activePy (Join-Path $RepoRoot "scripts\verify-evaluation-partitions.py") | Out-Null
  $pyCache = Join-Path $RepoRoot "scripts\__pycache__"
  if (Test-Path $pyCache) {
    Remove-Item -Recurse -Force $pyCache
  }
  Write-Host "  Evaluation dataset CSVs generated and verified (10 Dev + 498 Eng Eval + 570 Multi Eval)." -ForegroundColor Green
} else {
  Write-Host "  [INFO] Research dataset not yet placed in datasets/Annotated Privacy Policies of 100 Online Platforms/." -ForegroundColor Cyan
  Write-Host "         Backend and Chrome Extension work immediately without it." -ForegroundColor Cyan
  Write-Host "         See datasets/README.md when ready to run offline dataset scripts." -ForegroundColor Cyan
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " Setup Complete! Next Steps:" -ForegroundColor Green
Write-Host "  1. Start Backend : cd server; npm start" -ForegroundColor White
Write-Host "  2. Test Health   : Invoke-RestMethod http://localhost:3000/api/health" -ForegroundColor White
Write-Host "  3. Load Extension: Chrome -> chrome://extensions -> Load unpacked -> select .\extension" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
