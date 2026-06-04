@echo off
echo ========================================
echo   TEST ESC/POS SIMPLE
echo   Servidor: http://localhost:3001
echo ========================================
echo.

REM Verificar que el servidor esté corriendo
echo Verificando servidor...
powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:3001/status' -Method GET -TimeoutSec 2 -UseBasicParsing } catch { $null }; if ($response -and $response.StatusCode -eq 200) { Write-Host '✅ Servidor disponible' -ForegroundColor Green } else { Write-Host '❌ Servidor NO disponible. Asegurate de que esté corriendo.' -ForegroundColor Red; exit 1 }"

echo.
echo Enviando comando ESC/POS simple...
echo.

REM Obtener el nombre de la impresora desde el argumento o usar una por defecto
set PRINTER_NAME=%1
if "%PRINTER_NAME%"=="" (
    set PRINTER_NAME=\\\\BUFFALO\\Cocina
    echo Usando impresora por defecto: %PRINTER_NAME%
) else (
    echo Usando impresora: %PRINTER_NAME%
)

echo.

REM Crear contenido con comandos ESC/POS básicos
powershell -Command "$escInit = [char]0x1B + [char]0x40; $lf = [char]0x0D + [char]0x0A; $content = $escInit + 'TEST ESC/POS' + $lf + '============' + $lf + 'Linea 1' + $lf + 'Linea 2' + $lf + '============' + $lf + $lf + $lf; $body = @{ content = $content; printerName = '%PRINTER_NAME%'; type = 'kitchen'; width = 48 } | ConvertTo-Json -Compress; $response = Invoke-WebRequest -Uri 'http://localhost:3001/print' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing; Write-Host $response.Content"

echo.
echo ========================================
echo   Test completado
echo ========================================
pause

