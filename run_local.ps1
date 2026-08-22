# ClaimPilot AI - Windows PowerShell Local Launcher
# Starts all services locally and launches the web interface

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ClaimPilot AI - Autonomous Claims Adjudication Suite   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$VENV_PYTHON = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VENV_PYTHON)) {
    $VENV_PYTHON = "python"
}

Write-Host "`n[1/3] Starting Document Verification Agent on port 8001..." -ForegroundColor Green
$docProcess = Start-Process -FilePath $VENV_PYTHON -ArgumentList "-m uvicorn document_agent.main:app --host 127.0.0.1 --port 8001" -PassThru -NoNewWindow

Write-Host "[2/3] Starting Vehicle Image Damage Agent on port 8002..." -ForegroundColor Green
$imgProcess = Start-Process -FilePath $VENV_PYTHON -ArgumentList "-m uvicorn image_agent.main:app --host 127.0.0.1 --port 8002" -PassThru -NoNewWindow

Start-Sleep -Seconds 2

Write-Host "[3/3] Starting Orchestrator & Frontend on port 8000..." -ForegroundColor Green
Write-Host "`n>> Web App URL: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host ">> Press Ctrl+C in this terminal to stop all services.`n" -ForegroundColor DarkGray

# Open browser to local app
Start-Process "http://127.0.0.1:8000"

try {
    # Run orchestrator in foreground
    & $VENV_PYTHON -m uvicorn orchestrator.main:app --host 127.0.0.1 --port 8000
}
finally {
    Write-Host "`nStopping background agents..." -ForegroundColor Yellow
    if ($docProcess -and -not $docProcess.HasExited) { Stop-Process -Id $docProcess.Id -Force }
    if ($imgProcess -and -not $imgProcess.HasExited) { Stop-Process -Id $imgProcess.Id -Force }
    Write-Host "All ClaimPilot services stopped.`n" -ForegroundColor Green
}
