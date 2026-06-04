# Script de prueba simple para impresión
# Uso: .\test-simple-print.ps1 [nombre-impresora]

param(
    [string]$PrinterName = "\\\\BUFFALO\\Cocina"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST SIMPLE DE IMPRESION" -ForegroundColor Cyan
Write-Host "  Servidor: http://localhost:3001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
Write-Host "Verificando servidor..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-WebRequest -Uri "http://localhost:3001/status" -Method GET -TimeoutSec 2 -UseBasicParsing
    if ($statusResponse.StatusCode -eq 200) {
        Write-Host "✅ Servidor disponible" -ForegroundColor Green
        $statusData = $statusResponse.Content | ConvertFrom-Json
        Write-Host "   Estado: $($statusData.status)" -ForegroundColor Gray
        Write-Host "   Puerto: $($statusData.port)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Servidor NO disponible. Asegurate de que esté corriendo." -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Impresora: $PrinterName" -ForegroundColor Yellow
Write-Host ""

# Contenido simple de prueba (sin comandos ESC/POS complejos)
$simpleContent = @"
TEST SIMPLE
================
Hola Mundo
123456
ABC
================
"@

Write-Host "Enviando texto simple..." -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{
        content = $simpleContent
        printerName = $PrinterName
        type = "kitchen"
        width = 48
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3001/print" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    Write-Host "✅ Respuesta del servidor:" -ForegroundColor Green
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   Success: $($result.success)" -ForegroundColor Gray
    if ($result.message) {
        Write-Host "   Mensaje: $($result.message)" -ForegroundColor Gray
    }
    if ($result.error) {
        Write-Host "   Error: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error al enviar impresión:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Respuesta: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test completado" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

