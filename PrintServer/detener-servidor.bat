@echo off
title Detener Bridge de Impresion
color 0C
cd /d "%~dp0"
echo Deteniendo bridge de impresion...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\stop-bridge.ps1"
echo.
echo Bridge detenido.
pause
