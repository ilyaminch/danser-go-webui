$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskEngineSource = Join-Path $taskRoot 'danser-go'
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
$taskRuntime = Join-Path $taskRoot 'runtime'
Copy-Item -LiteralPath (Join-Path $compilerDir 'libwinpthread-1.dll') -Destination $taskRuntime -Force
$env:PATH = "$taskRuntime;$compilerDir;$env:PATH"
$env:CGO_ENABLED = '1'
$env:CC = 'gcc'
$env:CXX = 'g++'
$env:CGO_LDFLAGS = '-static-libstdc++ -static-libgcc'
$taskLinkFlags = '-X github.com/wieku/danser-go/build.Stream=Release -X github.com/wieku/danser-go/build.VERSION=0.12.0-studio -extldflags=-specs=' + $taskSpecsPath.Replace('\', '/')
$env:GOCACHE = Join-Path $taskRoot '.tools/go-cache'
$env:GOMODCACHE = Join-Path $taskRoot '.tools/go-mod'
Push-Location $taskEngineSource
try {
    & $goExe build -ldflags $taskLinkFlags -o (Join-Path $taskRoot 'runtime/danser-studio.exe') ./tools/studio-cli
    if ($LASTEXITCODE -ne 0) { throw 'Сборка движка завершилась с ошибкой.' }
    & $goExe test -ldflags $taskLinkFlags ./app/settings ./app/dance ./app/states ./framework/files ./framework/graphics/texture
    if ($LASTEXITCODE -ne 0) { throw 'Проверки движка завершились с ошибкой.' }
    Push-Location (Join-Path $taskEngineSource 'third_party/rplpa')
    try {
        & $goExe test ./...
        if ($LASTEXITCODE -ne 0) { throw 'Проверки декодера реплеев завершились с ошибкой.' }
    } finally { Pop-Location }
} finally { Pop-Location }
