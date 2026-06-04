@echo off
setlocal
title Desinstalar Bridge de Impresion
color 0C

cd /d "%~dp0"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Solicitando permisos de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\uninstall-bridge.ps1"
pause
