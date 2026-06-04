@echo off
setlocal
title Instalacion - Bridge de Impresion Buffalo
color 0B
set "PSFLAGS=-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass"

cd /d "%~dp0"

set "LOGDIR=%USERPROFILE%\Desktop"
if not exist "%LOGDIR%\" set "LOGDIR=%TEMP%"
if not exist "%LOGDIR%\" set "LOGDIR=%~dp0"
if not exist "%LOGDIR%\" mkdir "%LOGDIR%" >nul 2>&1
set "LOGFILE=%LOGDIR%\buffalo-bridge-install.log"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Solicitando permisos de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

break > "%LOGFILE%"

echo ========================================
echo   INSTALACION DEL BRIDGE DE IMPRESION
echo ========================================
echo.
echo Guardando detalle en: "%LOGFILE%"
echo.
echo 1. Verificando e instalando Node.js si hace falta...
powershell %PSFLAGS% -File "%~dp0installer\ensure-node.ps1" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :error

echo.
echo 2. Instalando bridge, ngrok y auto-inicio...
powershell %PSFLAGS% -File "%~dp0installer\install-bridge.ps1" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :error

echo.
echo 3. Verificando estado final...
powershell %PSFLAGS% -File "%~dp0installer\status-bridge.ps1" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :error

echo.
echo ========================================
echo   INSTALACION COMPLETADA
echo ========================================
echo.
echo Ya podes usar esta PC como puente de impresion.
echo Si queres ver el detalle tecnico, esta en:
echo %LOGFILE%
pause
exit /b 0

:error
echo.
echo ========================================
echo   ERROR EN LA INSTALACION
echo ========================================
echo.
echo La instalacion no termino correctamente.
echo El detalle esta guardado en:
echo %LOGFILE%
echo.
echo Ultimas lineas del error:
powershell -NoLogo -NoProfile -NonInteractive -Command "if (Test-Path '%LOGFILE%') { Get-Content -Path '%LOGFILE%' -Tail 25 }"
pause
exit /b 1
