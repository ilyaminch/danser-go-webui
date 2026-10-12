param([string]$OutputDirectory, [string]$EngineVersion)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskEngineSource = Join-Path $taskRoot 'danser-go'
if (!$EngineVersion) { $EngineVersion = (Get-Content -LiteralPath (Join-Path $taskEngineSource 'STUDIO_VERSION') -Raw).Trim() }
if (!(Test-Path -LiteralPath (Join-Path $taskEngineSource 'tools/studio-cli/main.go'))) {
    throw 'Исходники форка движка не загружены. Выполните git submodule update --init --recursive в папке WebUI.'
}
$goExe = Join-Path $taskRoot '.tools/go/bin/go.exe'
$compilerDir = Join-Path $taskRoot '.tools/mingw64/bin'
if (!(Test-Path -LiteralPath $goExe)) { throw 'Go не найден: нужен .tools/go или настройте путь в этом сценарии.' }
if (!(Test-Path -LiteralPath (Join-Path $compilerDir 'gcc.exe'))) { throw 'WinLibs не найден: нужен .tools/mingw64.' }
$taskFileSystem = New-Object -ComObject Scripting.FileSystemObject
$compilerDir = $taskFileSystem.GetFolder($compilerDir).ShortPath
# WinLibs 16 emits an unquoted default-manifest.o path when installed under a
# directory with spaces. Use a project-local specs copy, leaving all CRT entries intact.
$taskSpecsPath = Join-Path ($taskFileSystem.GetFolder((Join-Path $taskRoot '.tools')).ShortPath) 'studio.specs'
$taskSpecs = (& (Join-Path $compilerDir 'g++.exe') -dumpspecs) -join "`n"
$taskSpecs = $taskSpecs.Replace('%{!shared:%:if-exists(default-manifest.o%s)}', '')
[System.IO.File]::WriteAllText($taskSpecsPath, $taskSpecs, [System.Text.UTF8Encoding]::new($false))
$taskRuntime = if ($OutputDirectory) { [System.IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $taskRoot 'runtime' }
New-Item -ItemType Directory -Force -Path $taskRuntime | Out-Null
Copy-Item -LiteralPath (Join-Path $compilerDir 'libwinpthread-1.dll') -Destination $taskRuntime -Force
$env:PATH = "$taskRuntime;$compilerDir;$env:PATH"
$env:CGO_ENABLED = '1'
$env:CC = 'gcc'
$env:CXX = 'g++'
$env:CGO_LDFLAGS = '-static-libstdc++ -static-libgcc'
$taskLinkFlags = '-X github.com/wieku/danser-go/build.Stream=Release -X github.com/wieku/danser-go/build.VERSION=' + $EngineVersion + ' -extldflags=-specs=' + $taskSpecsPath.Replace('\', '/')
$env:GOCACHE = Join-Path $taskRoot '.tools/go-cache'
$env:GOMODCACHE = Join-Path $taskRoot '.tools/go-mod'
Push-Location $taskEngineSource
try {
    & $goExe build -buildvcs=false -ldflags $taskLinkFlags -o (Join-Path $taskRuntime 'danser-studio.exe') ./tools/studio-cli
    if ($LASTEXITCODE -ne 0) { throw 'Сборка движка завершилась с ошибкой.' }
    & $goExe test -ldflags $taskLinkFlags ./app/settings ./app/dance ./app/states ./framework/files ./framework/graphics/texture
    if ($LASTEXITCODE -ne 0) { throw 'Проверки движка завершились с ошибкой.' }
    Push-Location (Join-Path $taskEngineSource 'third_party/rplpa')
    try {
        & $goExe test ./...
        if ($LASTEXITCODE -ne 0) { throw 'Проверки декодера реплеев завершились с ошибкой.' }
    } finally { Pop-Location }
} finally { Pop-Location }
$taskSourceCommit = if (Test-Path -LiteralPath (Join-Path $taskEngineSource '.git')) {
    (& git -C $taskEngineSource rev-parse HEAD).Trim()
} else {
    (Get-Content -LiteralPath (Join-Path $taskRoot 'SOURCE_VERSION.json') -Raw | ConvertFrom-Json).engineCommit
}
$taskBuildInfo = @{ version=$EngineVersion; commit=$taskSourceCommit; sha256=(Get-FileHash -LiteralPath (Join-Path $taskRuntime 'danser-studio.exe') -Algorithm SHA256).Hash.ToLowerInvariant() }
[IO.File]::WriteAllText((Join-Path $taskRuntime 'engine-build.json'), ($taskBuildInfo | ConvertTo-Json))
