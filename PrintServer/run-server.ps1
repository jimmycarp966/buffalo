# Script para ejecutar el servidor de impresion con un Node valido
$scriptPath = Join-Path $PSScriptRoot "print-server.js"

$candidateNodePaths = @()
$resolvedCommand = Get-Command node -ErrorAction SilentlyContinue
if ($resolvedCommand) {
  $candidateNodePaths += $resolvedCommand.Source
}

$candidateNodePaths += @(
  (Join-Path $env:ProgramFiles "nodejs\node.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
) | Where-Object { $_ }

$nodeExe = $candidateNodePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $nodeExe) {
  throw "No se encontro node.exe. Ejecuta instalar.bat para instalar el bridge completo."
}

Write-Host "Iniciando servidor de impresion Buffalo..." -ForegroundColor Green
Write-Host "Usando Node.js en: $nodeExe" -ForegroundColor Yellow

& $nodeExe $scriptPath
