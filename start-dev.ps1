# One-command dev startup for CICSC project
# Usage: .\start-dev.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "insurance-backend-main\backend"
$Frontend = Join-Path $Root "mega-frontend-main"

Write-Host "Starting backend + frontend..." -ForegroundColor Cyan

# Backend: create venv if missing, install deps, migrate, runserver
$venvPython = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..." -ForegroundColor Yellow
    Set-Location $Backend
    py -m venv .venv
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r requirements.txt
}

Write-Host "Running migrations..." -ForegroundColor Yellow
& $venvPython (Join-Path $Backend "manage.py") migrate

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; .\.venv\Scripts\Activate.ps1; Write-Host 'Backend: http://127.0.0.1:8000' -ForegroundColor Green; python manage.py runserver"
)

# Frontend: install deps if missing, then dev server
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies (first time only)..." -ForegroundColor Yellow
    Set-Location $Frontend
    npm install
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Frontend'; Write-Host 'Frontend: http://localhost:3000' -ForegroundColor Green; npm run dev"
)

Write-Host ""
Write-Host "Done. Two terminal windows should open:" -ForegroundColor Green
Write-Host "  Backend  -> http://127.0.0.1:8000"
Write-Host "  Frontend -> http://localhost:3000"
Write-Host ""
Write-Host "Tip: If frontend is slow or crashes, pause OneDrive sync for this folder."
