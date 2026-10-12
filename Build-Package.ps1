param(
    [string]$EngineDirectory = (Join-Path $PSScriptRoot '.local-work/release-runtime'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '.local-work/packages'),
    [string]$Version = '0.4.0'
)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskStage = Join-Path $OutputDirectory ('DanserStudio-' + $Version + '-windows-x64')
if (Test-Path -LiteralPath $taskStage) { throw 'Package stage already exists. Use a fresh output directory to avoid overwriting user data.' }
if (!(Test-Path -LiteralPath (Join-Path $EngineDirectory 'danser-studio.exe'))) { throw 'Build and test the Studio engine before packaging.' }
$taskEngineBuild = Get-Content -LiteralPath (Join-Path $EngineDirectory 'engine-build.json') -Raw | ConvertFrom-Json
$taskEngineCommit = if (Test-Path -LiteralPath (Join-Path $taskRoot 'danser-go/.git')) { (& git -C (Join-Path $taskRoot 'danser-go') rev-parse HEAD).Trim() } else { (Get-Content -LiteralPath (Join-Path $taskRoot 'SOURCE_VERSION.json') -Raw | ConvertFrom-Json).engineCommit }
$taskEngineVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'danser-go/STUDIO_VERSION') -Raw).Trim()
if ($taskEngineBuild.commit -ne $taskEngineCommit -or $taskEngineBuild.version -ne $taskEngineVersion -or $taskEngineBuild.sha256 -ne (Get-FileHash -LiteralPath (Join-Path $EngineDirectory 'danser-studio.exe') -Algorithm SHA256).Hash) { throw 'Engine build does not match the pinned source/version/hash. Rebuild the engine before packaging.' }
New-Item -ItemType Directory -Force -Path $taskStage,(Join-Path $taskStage 'web'),(Join-Path $taskStage 'runtime'),(Join-Path $taskStage '.runtime/node'),(Join-Path $taskStage 'packaging/licenses') | Out-Null
$taskDependencies = Get-Content -LiteralPath (Join-Path $taskRoot 'packaging/runtime-dependencies.json') -Raw | ConvertFrom-Json
$taskDownloads = Join-Path $taskRoot '.local-work/downloads'
New-Item -ItemType Directory -Force -Path $taskDownloads | Out-Null
$taskNodeZip = Join-Path $taskDownloads 'node.zip'
if (!(Test-Path -LiteralPath $taskNodeZip)) { Invoke-WebRequest -UseBasicParsing -Uri $taskDependencies.node.url -OutFile $taskNodeZip }
if ((Get-FileHash -LiteralPath $taskNodeZip -Algorithm SHA256).Hash -ne $taskDependencies.node.sha256) { throw 'Node archive checksum mismatch' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [IO.Compression.ZipFile]::OpenRead($taskNodeZip)
try {
    foreach ($taskName in @('node.exe','LICENSE')) {
        $taskEntry = @($taskArchive.Entries | Where-Object { $_.FullName -eq ('node-v24.18.0-win-x64/' + $taskName) })
        if ($taskEntry.Count -ne 1) { throw 'Unexpected Node archive layout' }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry[0], (Join-Path $taskStage ".runtime/node/$taskName"))
    }
} finally { $taskArchive.Dispose() }
foreach ($taskName in @('Start-Studio.cmd','Start-Studio.ps1','Stop-Studio.cmd','Stop-Studio.ps1','Initialize-Runtime.ps1','LICENSE','README.md','THIRD_PARTY_NOTICES.md','SOURCE.md','CHANGELOG.md')) {
    Copy-Item -LiteralPath (Join-Path $taskRoot $taskName) -Destination $taskStage
}
Copy-Item -LiteralPath (Join-Path $taskRoot 'packaging/runtime-dependencies.json') -Destination (Join-Path $taskStage 'packaging')
Copy-Item -Path (Join-Path $taskRoot 'packaging/licenses/*') -Destination (Join-Path $taskStage 'packaging/licenses')
foreach ($taskName in @('server','shared','dist')) { Copy-Item -LiteralPath (Join-Path $taskRoot "web/$taskName") -Destination (Join-Path $taskStage 'web') -Recurse }
foreach ($taskName in @('package.json','package-lock.json')) { Copy-Item -LiteralPath (Join-Path $taskRoot "web/$taskName") -Destination (Join-Path $taskStage 'web') }
foreach ($taskName in @('danser-studio.exe','libwinpthread-1.dll','engine-build.json')) { Copy-Item -LiteralPath (Join-Path $EngineDirectory $taskName) -Destination (Join-Path $taskStage 'runtime') }
Copy-Item -LiteralPath (Join-Path $taskRoot 'danser-go/CREDITS.md') -Destination (Join-Path $taskStage 'runtime')
Copy-Item -LiteralPath (Join-Path $EngineDirectory 'lazer-index') -Destination (Join-Path $taskStage 'runtime') -Recurse
& (Join-Path $taskStage '.runtime/node/node.exe') (Join-Path $taskRoot 'packaging/write-schema.mjs') (Join-Path $taskStage 'web/server/schema.json')
if ($LASTEXITCODE -ne 0) { throw 'Settings schema generation failed' }
New-Item -ItemType Directory -Force -Path (Join-Path $taskStage 'docs/screenshots') | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'docs/screenshots/workspace.png') -Destination (Join-Path $taskStage 'docs/screenshots')
New-Item -ItemType Directory -Force -Path (Join-Path $taskStage 'web/public') | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'web/public/ASSETS.md') -Destination (Join-Path $taskStage 'web/public')
Push-Location (Join-Path $taskStage 'web')
try {
    & npm.cmd ci --omit=dev --ignore-scripts --offline --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Production dependency installation failed' }
} finally { Pop-Location }
$taskMetadata = @{ version=$Version; engineCommit=$taskEngineCommit; engineVersion=$taskEngineVersion; sourceUrl=('https://github.com/ilyaminch/danser-go-webui/releases/download/v' + $Version + '/DanserStudio-' + $Version + '-source.zip') }
[IO.File]::WriteAllText((Join-Path $taskStage 'release.json'), ($taskMetadata | ConvertTo-Json))
$taskPackage = $taskStage + '.zip'
Compress-Archive -Path $taskStage -DestinationPath $taskPackage
Write-Host "Package created: $taskPackage"
