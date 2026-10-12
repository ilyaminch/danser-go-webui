$ErrorActionPreference = 'Stop'
$taskMetadataPath = Join-Path $PSScriptRoot 'web/data/server.json'
if (!(Test-Path -LiteralPath $taskMetadataPath)) { Write-Host 'No instance started by this launcher was found.'; exit }
$taskServer = Get-Content -LiteralPath $taskMetadataPath -Raw | ConvertFrom-Json
$taskProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$taskServer.pid)
$taskExpectedScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'web/server/index.mjs'))
if (!$taskProcess) { Write-Host 'Studio is already stopped.'; exit }
if ($taskServer.script -ne $taskExpectedScript -or $taskProcess.CommandLine -notmatch [regex]::Escape($taskExpectedScript) -or $taskProcess.ExecutablePath -ne $taskServer.node) { throw 'Process identity changed. Refusing to stop an unrelated process.' }
try {
    $taskState = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $taskServer.port + '/api/state?compact=1') -TimeoutSec 3
    foreach ($taskJob in @($taskState.jobs | Where-Object { $_.status -in @('running','queued') })) {
        Invoke-RestMethod -Method Post -Uri ('http://127.0.0.1:' + $taskServer.port + '/api/jobs/' + $taskJob.id + '/cancel') -Headers @{ 'X-Studio-Client'='1' } -TimeoutSec 5 | Out-Null
    }
    # Native cancellation is asynchronous. Let the server persist its final
    # status before terminating it, and refuse to abandon a running job.
    for ($taskAttempt = 0; $taskAttempt -lt 60; $taskAttempt++) {
        $taskState = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $taskServer.port + '/api/state?compact=1') -TimeoutSec 3
        if (!@($taskState.jobs | Where-Object { $_.status -in @('running','queued') }).Count) { break }
        if ($taskAttempt -eq 59) { throw 'Cancellation is still completing. Retry Stop-Studio after it finishes.' }
        Start-Sleep -Milliseconds 250
    }
} catch { throw 'Could not cancel active jobs safely. Stop the jobs in the UI before retrying.' }
Stop-Process -Id $taskProcess.ProcessId
Write-Host 'Studio stopped. Your files and settings were kept.'
