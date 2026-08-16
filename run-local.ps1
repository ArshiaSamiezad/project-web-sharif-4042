param(
    [switch]$SetupOnly
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$venvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$backendDirectory = Join-Path $PSScriptRoot 'backend'

function Assert-Command {
    param([string]$Name, [string]$InstallMessage)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $InstallMessage"
    }
}

Write-Host 'Sepatify local Windows launcher' -ForegroundColor Cyan
Assert-Command 'python.exe' 'Install Python 3 and enable Add Python to PATH.'
Assert-Command 'node.exe' 'Install Node.js LTS.'
Assert-Command 'npm.cmd' 'Install Node.js LTS.'

if (-not (Test-Path -LiteralPath $venvPython)) {
    Write-Host '[1/5] Creating Python virtual environment...'
    & python.exe -m venv '.venv'
}
else {
    Write-Host '[1/5] Python virtual environment already exists.'
}

Write-Host '[2/5] Checking backend dependencies...'
$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& $venvPython -c 'import django, rest_framework, corsheaders, rest_framework_simplejwt' *> $null
$dependenciesAvailable = $LASTEXITCODE -eq 0
$ErrorActionPreference = $previousErrorPreference
if (-not $dependenciesAvailable) {
    Write-Host 'Installing backend dependencies...'
    & $venvPython -m pip install -r 'backend\requirements-local.txt'
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
}

Write-Host '[3/5] Preparing SQLite database...'
Push-Location $backendDirectory
try {
    & $venvPython manage.py migrate --noinput
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
}
finally {
    Pop-Location
}

Write-Host '[4/5] Checking frontend dependencies...'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\.bin\vite.cmd'))) {
    Write-Host 'Installing frontend dependencies...'
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
}

if ($SetupOnly) {
    Write-Host 'Local Windows setup completed successfully.' -ForegroundColor Green
    exit 0
}

Write-Host '[5/5] Starting Django and Vite...' -ForegroundColor Green
Write-Host 'Application: http://127.0.0.1:5173'
Write-Host 'API health:  http://127.0.0.1:8000/api/health/'
Write-Host 'Press Ctrl+C to stop both servers.' -ForegroundColor Yellow

$backendProcess = $null
try {
    $backendProcess = Start-Process `
        -FilePath $venvPython `
        -ArgumentList @('manage.py', 'runserver', '127.0.0.1:8000', '--noreload') `
        -WorkingDirectory $backendDirectory `
        -NoNewWindow `
        -PassThru

    & npm.cmd run dev -- --host 127.0.0.1
}
finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
    }
    Write-Host 'Sepatify servers stopped.' -ForegroundColor Cyan
}
