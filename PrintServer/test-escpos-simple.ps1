# Script de prueba simple con comandos ESC/POS básicos
# Uso: .\test-escpos-simple.ps1 [nombre-impresora]

param(
    [string]$PrinterName = "\\\\BUFFALO\\Cocina"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST ESC/POS SIMPLE" -ForegroundColor Cyan
Write-Host "  Servidor: http://localhost:3001" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
Write-Host "Verificando servidor..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-WebRequest -Uri "http://localhost:3001/status" -Method GET -TimeoutSec 2 -UseBasicParsing
    if ($statusResponse.StatusCode -eq 200) {
        Write-Host "✅ Servidor disponible" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Servidor NO disponible. Asegurate de que esté corriendo." -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Impresora: $PrinterName" -ForegroundColor Yellow
Write-Host ""

# Crear contenido con comandos ESC/POS básicos
# ESC @ = Inicializar impresora
# \r\n = CRLF para saltos de línea
$escInit = [char]0x1B + [char]0x40  # ESC @
$lf = [char]0x0D + [char]0x0A       # \r\n

$content = $escInit + "TEST ESC/POS" + $lf
$content += "============" + $lf
$content += "Linea 1" + $lf
$content += "Linea 2" + $lf
$content += "123456" + $lf
$content += "============" + $lf
$content += $lf + $lf + $lf  # Espacios para cortar

Write-Host "Contenido a imprimir:" -ForegroundColor Yellow
Write-Host "  - Inicialización ESC/POS: ESC @ (0x1B 0x40)" -ForegroundColor Gray
Write-Host "  - Saltos de línea: CRLF (\r\n)" -ForegroundColor Gray
Write-Host "  - Longitud: $($content.Length) caracteres" -ForegroundColor Gray
Write-Host ""

# Mostrar primeros bytes en hex
$firstBytes = [System.Text.Encoding]::UTF8.GetBytes($content.Substring(0, [Math]::Min(20, $content.Length)))
$hexString = ($firstBytes | ForEach-Object { "0x{0:X2}" -f $_ }) -join " "
Write-Host "  Primeros bytes (hex): $hexString" -ForegroundColor Gray
Write-Host ""

Write-Host "Enviando a impresora..." -ForegroundColor Yellow
Write-Host ""

try {
    $body = @{
        content = $content
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
    if ($result.method) {
        Write-Host "   Método usado: $($result.method)" -ForegroundColor Gray
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

