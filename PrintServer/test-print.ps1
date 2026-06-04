# Script de prueba para imprimir ticket de caja directamente
# Este script prueba la impresión con comandos ESC/POS

$printerName = "Caja"  # Cambiar por el nombre de tu impresora

Write-Host "=== PRUEBA DE IMPRESIÓN ===" -ForegroundColor Cyan
Write-Host "Impresora: $printerName" -ForegroundColor Yellow
Write-Host ""

# Verificar que la impresora existe
$printerExists = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $printerExists) {
    Write-Host "❌ ERROR: Impresora '$printerName' no encontrada" -ForegroundColor Red
    Write-Host "Impresoras disponibles:" -ForegroundColor Yellow
    Get-Printer | Select-Object Name | Format-Table
    exit 1
}

Write-Host "✅ Impresora encontrada: $printerName" -ForegroundColor Green
Write-Host ""

# Crear contenido de prueba con comandos ESC/POS
# Usando bytes directamente para evitar problemas de codificación
$bytes = New-Object System.Collections.ArrayList

# ESC @ (Inicializar impresora)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x40) | Out-Null

# GS W 0x30 0x01 (Configurar ancho) - INTENTO CON VALOR DIFERENTE
$bytes.Add([byte]0x1D) | Out-Null
$bytes.Add([byte]0x57) | Out-Null
$bytes.Add([byte]0x30) | Out-Null
$bytes.Add([byte]0x01) | Out-Null

# GS ! 0x00 (Tamaño normal)
$bytes.Add([byte]0x1D) | Out-Null
$bytes.Add([byte]0x21) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# ESC E 0x00 (Negrita OFF)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x45) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# ESC M 0x00 (Fuente normal)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x4D) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# Línea de separación (48 caracteres)
$line = "=" * 48
$lineBytes = [System.Text.Encoding]::Default.GetBytes($line)
$bytes.AddRange($lineBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Encabezado centrado
# ESC a 0x01 (Centrar)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x61) | Out-Null
$bytes.Add([byte]0x01) | Out-Null

# GS ! 0x01 (Tamaño doble ancho)
$bytes.Add([byte]0x1D) | Out-Null
$bytes.Add([byte]0x21) | Out-Null
$bytes.Add([byte]0x01) | Out-Null

# Texto del encabezado
$header = 'Buffalo&CAFETERIA'
$headerBytes = [System.Text.Encoding]::Default.GetBytes($header)
$bytes.AddRange($headerBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# GS ! 0x00 (Tamaño normal)
$bytes.Add([byte]0x1D) | Out-Null
$bytes.Add([byte]0x21) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# ESC a 0x00 (Alinear izquierda)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x61) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# Línea de separación
$bytes.AddRange($lineBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Información del negocio
$address = "Leandro Araoz 95"
$addressBytes = [System.Text.Encoding]::Default.GetBytes($address)
$bytes.AddRange($addressBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Fecha
$date = "Fecha: 01/01/2025 12:00:00"
$dateBytes = [System.Text.Encoding]::Default.GetBytes($date)
$bytes.AddRange($dateBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Mesa
$table = "Mesa: 1"
$tableBytes = [System.Text.Encoding]::Default.GetBytes($table)
$bytes.AddRange($tableBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Línea de separación
$dashLine = "-" * 48
$dashLineBytes = [System.Text.Encoding]::Default.GetBytes($dashLine)
$bytes.AddRange($dashLineBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Item de prueba
$item = '1x Producto de Prueba                    $100.00'
$itemBytes = [System.Text.Encoding]::Default.GetBytes($item)
$bytes.AddRange($itemBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Línea de separación
$bytes.AddRange($dashLineBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Total
$total = 'TOTAL:                                  $100.00'
$totalBytes = [System.Text.Encoding]::Default.GetBytes($total)
$bytes.AddRange($totalBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Información de contacto (centrado)
# ESC a 0x01 (Centrar)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x61) | Out-Null
$bytes.Add([byte]0x01) | Out-Null

$alias = "ALIAS: buffalo.bar.22"
$aliasBytes = [System.Text.Encoding]::Default.GetBytes($alias)
$bytes.AddRange($aliasBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

$cel = "Cel:3815524255"
$celBytes = [System.Text.Encoding]::Default.GetBytes($cel)
$bytes.AddRange($celBytes) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# ESC a 0x00 (Alinear izquierda)
$bytes.Add([byte]0x1B) | Out-Null
$bytes.Add([byte]0x61) | Out-Null
$bytes.Add([byte]0x00) | Out-Null

# Espacios para cortar
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null
$bytes.Add([byte]0x0D) | Out-Null
$bytes.Add([byte]0x0A) | Out-Null

# Convertir a array de bytes
$byteArray = $bytes.ToArray()

Write-Host "Longitud del contenido: $($byteArray.Length) bytes" -ForegroundColor Yellow
Write-Host "Primeros 50 bytes (hex):" -ForegroundColor Yellow
$firstBytes = $byteArray[0..49]
$hexString = ($firstBytes | ForEach-Object { "0x{0:X2}" -f $_ }) -join " "
Write-Host $hexString -ForegroundColor Gray
Write-Host ""

# Crear archivo temporal
$tempFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllBytes($tempFile, $byteArray)
Write-Host "📄 Archivo temporal creado: $tempFile" -ForegroundColor Cyan
Write-Host ""

# Definir clase helper para enviar bytes RAW
$rawPrinterHelper = @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [DllImport("winspool.drv", EntryPoint="OpenPrinterA", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  
  [DllImport("winspool.drv", EntryPoint="ClosePrinter", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  
  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  
  [DllImport("winspool.drv", EntryPoint="WritePrinter", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr GlobalAlloc(int uFlags, int dwBytes);
  
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr GlobalLock(IntPtr hMem);
  
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool GlobalUnlock(IntPtr hMem);
  
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr GlobalFree(IntPtr hMem);
  
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
}
'@

try {
    Add-Type -TypeDefinition $rawPrinterHelper -ErrorAction SilentlyContinue
} catch {
    # Tipo ya existe, continuar
}

# Bloque principal de impresión
try {
    Write-Host "🖨️ Enviando contenido a la impresora..." -ForegroundColor Cyan
    
    # Leer bytes del archivo
    $fileBytes = [System.IO.File]::ReadAllBytes($tempFile)
    Write-Host "✅ Archivo leído: $($fileBytes.Length) bytes" -ForegroundColor Green
    
    # Abrir impresora
    $hPrinter = [IntPtr]::Zero
    $opened = [RawPrinterHelper]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)
    
    if (-not $opened) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "No se pudo abrir la impresora. Error: $errorCode"
    }
    
    Write-Host "✅ Impresora abierta" -ForegroundColor Green
    
    # Iniciar documento
    $docInfo = New-Object RawPrinterHelper+DOCINFOA
    $docInfo.pDocName = "Ticket de Prueba"
    $docInfo.pOutputFile = $null
    $docInfo.pDataType = "RAW"
    
    $docStarted = [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $docInfo)
    if (-not $docStarted) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
        throw "No se pudo iniciar el documento. Error: $errorCode"
    }
    
    Write-Host "✅ Documento iniciado" -ForegroundColor Green
    
    # Iniciar página
    $pageStarted = [RawPrinterHelper]::StartPagePrinter($hPrinter)
    if (-not $pageStarted) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
        throw "No se pudo iniciar la página. Error: $errorCode"
    }
    
    Write-Host "✅ Página iniciada" -ForegroundColor Green
    
    # Escribir bytes
    $hMem = [RawPrinterHelper]::GlobalAlloc(0x0002, $fileBytes.Length)
    if ($hMem -eq [IntPtr]::Zero) {
        [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
        throw "No se pudo asignar memoria"
    }
    
    $pBytes = [RawPrinterHelper]::GlobalLock($hMem)
    if ($pBytes -eq [IntPtr]::Zero) {
        [RawPrinterHelper]::GlobalFree($hMem) | Out-Null
        [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
        throw "No se pudo bloquear memoria"
    }
    
    [System.Runtime.InteropServices.Marshal]::Copy($fileBytes, 0, $pBytes, $fileBytes.Length)
    
    $written = 0
    $writtenSuccess = [RawPrinterHelper]::WritePrinter($hPrinter, $pBytes, $fileBytes.Length, [ref]$written)
    
    if (-not $writtenSuccess) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        [RawPrinterHelper]::GlobalUnlock($hMem) | Out-Null
        [RawPrinterHelper]::GlobalFree($hMem) | Out-Null
        [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
        [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
        throw "No se pudo escribir en la impresora. Error: $errorCode"
    }
    
    Write-Host "✅ Bytes escritos: $written de $($fileBytes.Length)" -ForegroundColor Green
    
    [RawPrinterHelper]::GlobalUnlock($hMem) | Out-Null
    [RawPrinterHelper]::GlobalFree($hMem) | Out-Null
    
    [RawPrinterHelper]::EndPagePrinter($hPrinter) | Out-Null
    Write-Host "✅ Página finalizada" -ForegroundColor Green
    
    [RawPrinterHelper]::EndDocPrinter($hPrinter) | Out-Null
    Write-Host "✅ Documento finalizado" -ForegroundColor Green
    
    [RawPrinterHelper]::ClosePrinter($hPrinter) | Out-Null
    Write-Host "✅ Impresora cerrada" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ IMPRESIÓN EXITOSA" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
} finally {
    # Limpiar archivo temporal
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
        Write-Host "🗑️ Archivo temporal eliminado" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
