param([switch]$NoBrowser, [ValidateRange(1024,65535)][int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$taskWebDir = Join-Path $PSScriptRoot 'web'
$taskDataDir = Join-Path $taskWebDir 'data'
$taskUrl = 'http://127.0.0.1:' + $Port
New-Item -ItemType Directory -Force -Path $taskDataDir | Out-Null
try {
    $taskExisting = Invoke-RestMethod ($taskUrl + '/api/state?compact=1') -TimeoutSec 2
} catch { $taskExisting = $null }
if ($null -ne $taskExisting -and $null -ne $taskExisting.config) {
    $taskVersion = (Get-Content -LiteralPath (Join-Path $taskWebDir 'package.json') -Raw | ConvertFrom-Json).version
    if ($taskExisting.version -ne $taskVersion) { throw 'Another Studio version is running on this port. Stop it before starting this version, or use -Port with a different port.' }
    if (!$NoBrowser) { Start-Process $taskUrl }
    exit
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'release.json')) { & (Join-Path $PSScriptRoot 'Initialize-Runtime.ps1') }
$taskBundledNode = Join-Path $PSScriptRoot '.runtime/node/node.exe'
$taskNode = if (Test-Path -LiteralPath $taskBundledNode) { $taskBundledNode } else { (Get-Command node.exe -ErrorAction Stop).Source }
if (!(Test-Path -LiteralPath (Join-Path $taskWebDir 'node_modules'))) { throw 'Dependencies are missing. Download the complete Windows package, or run npm ci in web for a source checkout.' }
if (!(Test-Path -LiteralPath (Join-Path $taskWebDir 'dist/index.html'))) {
    Push-Location $taskWebDir
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
}
$taskScript = [IO.Path]::GetFullPath((Join-Path $taskWebDir 'server/index.mjs'))
$taskPreviousPort = $env:PORT
try {
    $env:PORT = [string]$Port
    $taskServer = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskScript + '"') -WorkingDirectory $taskWebDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDataDir 'server.stdout.log') -RedirectStandardError (Join-Path $taskDataDir 'server.stderr.log')
} finally {
    if ($null -eq $taskPreviousPort) { Remove-Item Env:PORT -ErrorAction SilentlyContinue } else { $env:PORT = $taskPreviousPort }
}
[IO.File]::WriteAllText((Join-Path $taskDataDir 'server.pid'), [string]$taskServer.Id)
[IO.File]::WriteAllText((Join-Path $taskDataDir 'server.json'), (@{ pid=$taskServer.Id; node=[IO.Path]::GetFullPath($taskNode); script=$taskScript; port=$Port } | ConvertTo-Json))
for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
    try {
        $taskStarted = Invoke-RestMethod ($taskUrl + '/api/state?compact=1') -TimeoutSec 1
        if ($null -ne $taskStarted.replays) { if (!$NoBrowser) { Start-Process $taskUrl }; Write-Host "Studio is ready at $taskUrl"; exit }
    } catch {}
    if ($taskServer.HasExited) { throw 'Server stopped. See web/data/server.stderr.log.' }
    Start-Sleep -Milliseconds 250
}
throw 'Server did not respond. See web/data/server.stderr.log.'
