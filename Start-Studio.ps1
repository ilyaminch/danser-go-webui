$ErrorActionPreference = 'Stop'
$taskWebDir = Join-Path $PSScriptRoot 'web'
$taskDataDir = Join-Path $taskWebDir 'data'
New-Item -ItemType Directory -Force $taskDataDir | Out-Null
try {
    $taskExisting = Invoke-RestMethod 'http://127.0.0.1:3000/api/state' -TimeoutSec 2
    if ($null -ne $taskExisting.replays -and $null -ne $taskExisting.config) {
        Start-Process 'http://127.0.0.1:3000'
        exit
    }
} catch {}
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
if (!(Test-Path -LiteralPath (Join-Path $taskWebDir 'node_modules'))) { throw 'Установите зависимости: откройте терминал в web и выполните npm ci.' }
if (!(Test-Path -LiteralPath (Join-Path $taskWebDir 'dist/index.html'))) {
    Push-Location $taskWebDir
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать интерфейс.' } } finally { Pop-Location }
}
$taskServer = Start-Process -FilePath $taskNode -ArgumentList 'server/index.mjs' -WorkingDirectory $taskWebDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDataDir 'server.stdout.log') -RedirectStandardError (Join-Path $taskDataDir 'server.stderr.log')
[System.IO.File]::WriteAllText((Join-Path $taskDataDir 'server.pid'), [string]$taskServer.Id)
for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
    try {
        $taskStarted = Invoke-RestMethod 'http://127.0.0.1:3000/api/state' -TimeoutSec 1
        if ($null -ne $taskStarted.replays) { Start-Process 'http://127.0.0.1:3000'; exit }
    } catch {}
    if ($taskServer.HasExited) { throw 'Сервис остановился. Смотрите web/data/server.stderr.log.' }
    Start-Sleep -Milliseconds 250
}
throw 'Сервис не ответил за 10 секунд. Смотрите журналы в web/data.'
