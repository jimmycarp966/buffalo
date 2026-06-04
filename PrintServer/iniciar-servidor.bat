@echo off
title Bridge de Impresion Buffalo
color 0A
set "PSFLAGS=-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass"
cd /d "%~dp0"
set "LOGDIR=%USERPROFILE%\Desktop"
if not exist "%LOGDIR%\" set "LOGDIR=%TEMP%"
if not exist "%LOGDIR%\" set "LOGDIR=%~dp0"
if not exist "%LOGDIR%\" mkdir "%LOGDIR%" >nul 2>&1
set "LOGFILE=%LOGDIR%\buffalo-bridge-start.log"
echo ========================================
echo   INICIAR BRIDGE DE IMPRESION
echo ========================================
echo.
break > "%LOGFILE%"
powershell %PSFLAGS% -File "%~dp0installer\start-bridge.ps1" >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :error
echo.
powershell %PSFLAGS% -File "%~dp0installer\status-bridge.ps1" >> "%LOGFILE%" 2>&1
echo El detalle tecnico quedo en:
echo %LOGFILE%
pause
exit /b 0

:error
echo.
echo El bridge no pudo iniciarse.
echo El detalle esta en:
echo %LOGFILE%
echo.
echo Ultimas lineas del error:
powershell -NoLogo -NoProfile -NonInteractive -Command "if (Test-Path '%LOGFILE%') { Get-Content -Path '%LOGFILE%' -Tail 25 }"
pause
