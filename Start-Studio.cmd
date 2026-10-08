@echo off
powershell.exe -NoProfile -File "%~dp0Start-Studio.ps1"
if errorlevel 1 pause
