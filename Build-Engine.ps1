$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
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
Push-Location (Join-Path $taskRoot 'danser-go')
try {
    & (Join-Path $taskRoot '.tools/go/bin/gofmt.exe') -w app/settings/studio.go app/settings/studio_test.go app/dance/rcontroller.go app/dance/studio_test.go app/states/player.go app/app.go framework/platform/ffmpeg.go tools/studio-cli/main.go
    & $goExe build -ldflags $taskLinkFlags -o (Join-Path $taskRoot 'runtime/danser-studio.exe') ./tools/studio-cli
    if ($LASTEXITCODE -ne 0) { throw 'Сборка движка завершилась с ошибкой.' }
    & $goExe test -ldflags $taskLinkFlags ./app/settings ./app/dance ./app/states
    if ($LASTEXITCODE -ne 0) { throw 'Проверки движка завершились с ошибкой.' }
} finally { Pop-Location }
