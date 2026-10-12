param([string]$CacheDirectory)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$taskAppRoot = $PSScriptRoot
$taskRuntimeRoot = Join-Path $taskAppRoot 'runtime'
$taskManifest = Get-Content -LiteralPath (Join-Path $taskAppRoot 'packaging/runtime-dependencies.json') -Raw | ConvertFrom-Json
if (!$CacheDirectory) { $CacheDirectory = Join-Path $taskAppRoot '.setup-cache' }
New-Item -ItemType Directory -Force -Path $CacheDirectory,$taskRuntimeRoot | Out-Null

function Get-VerifiedArchive($taskName, $taskDependency) {
    $taskArchive = Join-Path $CacheDirectory ($taskName + '.zip')
    if (!(Test-Path -LiteralPath $taskArchive) -or (Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash -ne $taskDependency.sha256) {
        Write-Host "Downloading $taskName from its original distributor..."
        Invoke-WebRequest -UseBasicParsing -Uri $taskDependency.url -OutFile $taskArchive
    }
    if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash -ne $taskDependency.sha256) { throw "Checksum mismatch for $taskName. The downloaded archive was not installed." }
    return $taskArchive
}

function Install-ArchiveFiles($taskArchive, $taskNames, $taskDestination) {
    $taskWorkBase = [IO.Path]::GetFullPath((Join-Path $taskAppRoot '.setup-work'))
    $taskWork = [IO.Path]::GetFullPath((Join-Path $taskWorkBase ([Guid]::NewGuid().ToString('N'))))
    if (!$taskWork.StartsWith($taskWorkBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe setup directory' }
    try {
        Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskWork
        New-Item -ItemType Directory -Force -Path $taskDestination | Out-Null
        foreach ($taskName in $taskNames) {
            $taskMatches = @(Get-ChildItem -LiteralPath $taskWork -Recurse -File | Where-Object { $_.Name -ieq $taskName })
            if ($taskMatches.Count -ne 1) { throw "Expected one $taskName in the verified archive" }
            Copy-Item -LiteralPath $taskMatches[0].FullName -Destination (Join-Path $taskDestination $taskName) -Force
        }
    } finally {
        if (Test-Path -LiteralPath $taskWork) { Remove-Item -LiteralPath $taskWork -Recurse -Force }
    }
}

$taskAssets = @('assets.dpak','bass.dll','bass_fx.dll','bassmix.dll','SDL3.dll','libyuv.dll')
if (@($taskAssets | Where-Object { !(Test-Path -LiteralPath (Join-Path $taskRuntimeRoot $_)) }).Count) {
    Install-ArchiveFiles (Get-VerifiedArchive 'upstream' $taskManifest.upstream) $taskAssets $taskRuntimeRoot
}
$taskFFmpegRoot = Join-Path $taskRuntimeRoot 'ffmpeg'
if (!(Test-Path -LiteralPath (Join-Path $taskFFmpegRoot 'ffmpeg.exe')) -or !(Test-Path -LiteralPath (Join-Path $taskFFmpegRoot 'ffprobe.exe'))) {
    Install-ArchiveFiles (Get-VerifiedArchive 'ffmpeg' $taskManifest.ffmpeg) @('ffmpeg.exe','ffprobe.exe','LICENSE','README.txt') $taskFFmpegRoot
}
Write-Host 'Runtime dependencies are ready.'
