param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'runtime/lazer-index'))
$ErrorActionPreference = 'Stop'
$taskDotnet = Join-Path $PSScriptRoot '.tools/dotnet/dotnet.exe'
if (!(Test-Path -LiteralPath $taskDotnet)) { $taskDotnet = (Get-Command dotnet.exe -ErrorAction Stop).Source }
Push-Location $PSScriptRoot
try {
    & $taskDotnet publish tools/LazerIndex/LazerIndex.csproj -c Release -r win-x64 --self-contained true -o $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Lazer helper build failed. Install .NET SDK 10 or newer.' }
} finally { Pop-Location }
