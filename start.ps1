# Builds the React frontend then starts the backend (which serves everything)
$root = $PSScriptRoot

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if (-not $?) { Write-Host "Frontend build failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Starting backend..." -ForegroundColor Cyan
Set-Location "$root\backend"
dotnet run
