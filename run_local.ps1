# ClaimPilot AI - Windows PowerShell Local Launcher
# Starts all microservices locally and launches the web interface

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ClaimPilot AI - Autonomous Claims Adjudication Suite   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$VENV_PYTHON = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VENV_PYTHON)) {
    $VENV_PYTHON = "python"
}

Write-Host "`n[1/4] Document Verification Agent (Port 8001)..." -ForegroundColor Green
$docProcess = Start-Process -FilePath $VENV_PYTHON -ArgumentList "-m uvicorn document_agent.main:app --host 127.0.0.1 --port 8001" -PassThru -NoNewWindow

Write-Host "[2/4] Vehicle Image Damage Agent (Port 8002)..." -ForegroundColor Green
$imgProcess = Start-Process -FilePath $VENV_PYTHON -ArgumentList "-m uvicorn image_agent.main:app --host 127.0.0.1 --port 8002" -PassThru -NoNewWindow

# Check if compiled Spring Boot Cost Agent JAR exists
$costJar = Get-ChildItem -Path (Join-Path $PSScriptRoot "cost-agent-spring-ai") -Filter "*.jar" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
$costProcess = $null

if ($costJar) {
    Write-Host "[3/4] Java Spring Boot Cost Agent (Port 8082)..." -ForegroundColor Green
    $costProcess = Start-Process -FilePath "java" -ArgumentList "-jar `"$($costJar.FullName)`" --server.port=8082" -PassThru -NoNewWindow
} else {
    Write-Host "[3/4] Cost Agent (Port 8082): Python Deterministic IRDAI Engine Active (Local zero-dependency mode)." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

Write-Host "[4/4] Orchestrator & Web Gateway (Port 8000)..." -ForegroundColor Green
Write-Host "`n>> Web Application: http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host ">> Press Ctrl+C to stop all services.`n" -ForegroundColor DarkGray

# Launch browser
Start-Process "http://127.0.0.1:8000"

try {
    # Run orchestrator in foreground
    & $VENV_PYTHON -m uvicorn orchestrator.main:app --host 127.0.0.1 --port 8000
}
finally {
    Write-Host "`nStopping background agents..." -ForegroundColor Yellow
    if ($docProcess -and -not $docProcess.HasExited) { Stop-Process -Id $docProcess.Id -Force }
    if ($imgProcess -and -not $imgProcess.HasExited) { Stop-Process -Id $imgProcess.Id -Force }
    if ($costProcess -and -not $costProcess.HasExited) { Stop-Process -Id $costProcess.Id -Force }
    Write-Host "All ClaimPilot microservices stopped.`n" -ForegroundColor Green
}
