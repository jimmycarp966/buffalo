@echo off
title Bridge de Impresion Buffalo
color 0A
echo Iniciando bridge de impresion...
cd /d "%~dp0"
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\start-bridge.ps1"
echo.
echo Bridge iniciado correctamente.
echo Revisa el estado a continuacion:
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\status-bridge.ps1"
pause
