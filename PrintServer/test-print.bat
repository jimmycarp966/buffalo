@echo off
echo ============================================
echo PRUEBA DE IMPRESION DE TICKET
echo ============================================
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0test-print.ps1"
pause

