@echo off
echo ========================================
echo   TEST SIMPLE DE IMPRESION
echo   Servidor: http://localhost:3001
echo ========================================
echo.

REM Verificar que el servidor esté corriendo
echo Verificando servidor...
powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:3001/status' -Method GET -TimeoutSec 2 -UseBasicParsing } catch { $null }; if ($response -and $response.StatusCode -eq 200) { Write-Host '✅ Servidor disponible' -ForegroundColor Green } else { Write-Host '❌ Servidor NO disponible. Asegurate de que esté corriendo.' -ForegroundColor Red; exit 1 }"

echo.
echo Enviando texto simple a la impresora...
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

REM Crear contenido simple de prueba
powershell -Command "$content = 'TEST SIMPLE\n================\nHola Mundo\n123456\n================\n'; $body = @{ content = $content; printerName = '%PRINTER_NAME%'; type = 'kitchen'; width = 48 } | ConvertTo-Json; $response = Invoke-WebRequest -Uri 'http://localhost:3001/print' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing; Write-Host $response.Content"

echo.
echo ========================================
echo   Test completado
echo ========================================
pause

