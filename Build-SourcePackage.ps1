param([string]$OutputDirectory = (Join-Path $PSScriptRoot '.local-work/source-packages'), [string]$Version = '0.4.0')
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskStage = Join-Path $OutputDirectory ('DanserStudio-' + $Version + '-source')
if (Test-Path -LiteralPath $taskStage) { throw 'Source stage already exists. Use a fresh output directory.' }
New-Item -ItemType Directory -Force -Path $taskStage | Out-Null
$taskWebArchive = Join-Path $OutputDirectory 'webui-source.zip'
$taskEngineArchive = Join-Path $OutputDirectory 'engine-source.zip'
& git -C $taskRoot archive --format=zip --output=$taskWebArchive HEAD
if ($LASTEXITCODE -ne 0) { throw 'WebUI source export failed' }
Expand-Archive -LiteralPath $taskWebArchive -DestinationPath $taskStage
& git -C (Join-Path $taskRoot 'danser-go') archive --format=zip --output=$taskEngineArchive HEAD
if ($LASTEXITCODE -ne 0) { throw 'Engine source export failed' }
Expand-Archive -LiteralPath $taskEngineArchive -DestinationPath (Join-Path $taskStage 'danser-go')
$taskGo = Join-Path $taskRoot '.tools/go/bin/go.exe'
$taskPreviousModuleCache = $env:GOMODCACHE
try {
    $env:GOMODCACHE = Join-Path $taskRoot '.tools/go-mod'
    Push-Location (Join-Path $taskStage 'danser-go')
    try {
        & $taskGo mod vendor
        if ($LASTEXITCODE -ne 0) { throw 'Engine corresponding dependency source export failed' }
    } finally { Pop-Location }
} finally {
    if ($null -eq $taskPreviousModuleCache) { Remove-Item Env:GOMODCACHE -ErrorAction SilentlyContinue } else { $env:GOMODCACHE = $taskPreviousModuleCache }
}
$taskMetadata = @{ version=$Version; webCommit=(& git -C $taskRoot rev-parse HEAD); engineCommit=(& git -C (Join-Path $taskRoot 'danser-go') rev-parse HEAD) }
[IO.File]::WriteAllText((Join-Path $taskStage 'SOURCE_VERSION.json'), ($taskMetadata | ConvertTo-Json))
Compress-Archive -Path $taskStage -DestinationPath ($taskStage + '.zip')
Write-Host ('Corresponding source created: ' + $taskStage + '.zip')
