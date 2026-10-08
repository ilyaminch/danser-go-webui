$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    & dotnet publish tools/LazerIndex/LazerIndex.csproj -c Release -r win-x64 --self-contained true -o runtime/lazer-index
    if ($LASTEXITCODE -ne 0) { throw 'Не удалось собрать модуль чтения lazer.' }
} finally { Pop-Location }
