@echo off
title Estado del Bridge de Impresion
color 0E
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\status-bridge.ps1"
pause
