@echo off
powershell.exe -NoProfile -File "%~dp0Stop-Studio.ps1"
if errorlevel 1 pause
