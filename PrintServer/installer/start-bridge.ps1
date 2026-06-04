. "$PSScriptRoot\lib\bridge-env.ps1"

Ensure-BridgeWritablePaths

$manifest = Get-BridgeEffectiveManifest
$ngrokAuthtoken = [string]$manifest.ngrokAuthtoken

if (Test-PlaceholderValue $ngrokAuthtoken) {
  throw "Falta configurar ngrokAuthtoken en el manifest del bridge."
}

$ngrokExePath = Resolve-NgrokExecutablePath
if (-not $ngrokExePath) {
  throw "No se encontro ngrok.exe ni en el runtime instalado ni en el PATH."
}

$runServerScriptPath = Resolve-RunServerScriptPath
if (-not (Test-Path $runServerScriptPath)) {
  throw "No se encontro run-server.ps1 para iniciar PrintServer."
}

$ngrokConfigTemplate = Get-Content (Get-BridgeTemplateNgrokPath) -Raw
$ngrokConfigRendered = $ngrokConfigTemplate.Replace("__NGROK_AUTHTOKEN__", $ngrokAuthtoken)
$ngrokConfigPath = Join-Path $BridgeConfigRoot $NgrokConfigName
$ngrokConfigRendered | Set-Content -Path $ngrokConfigPath -Encoding UTF8

$existingProcesses = Get-BridgeProcessSnapshot
if ($existingProcesses) {
  Write-Host "El bridge ya tiene procesos activos. Se detendran antes de reiniciar." -ForegroundColor Yellow
  & "$PSScriptRoot\stop-bridge.ps1" | Out-Null
}

$printServerRoot = Resolve-PrintServerRoot
$printServerStdoutLogPath = Get-BridgeLogPath "print-server.stdout.log"
$printServerStderrLogPath = Get-BridgeLogPath "print-server.stderr.log"
$ngrokStdoutLogPath = Get-BridgeLogPath "ngrok.stdout.log"
$ngrokStderrLogPath = Get-BridgeLogPath "ngrok.stderr.log"

@(
  $printServerStdoutLogPath,
  $printServerStderrLogPath,
  $ngrokStdoutLogPath,
  $ngrokStderrLogPath
) | ForEach-Object {
  Set-Content -Path $_ -Value $null -Encoding UTF8
}

$printServerProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$runServerScriptPath`"" -WorkingDirectory $printServerRoot -WindowStyle Hidden -RedirectStandardOutput $printServerStdoutLogPath -RedirectStandardError $printServerStderrLogPath -PassThru

$ngrokProcess = Start-Process -FilePath $ngrokExePath -ArgumentList "start print-bridge --config `"$ngrokConfigPath`"" -WorkingDirectory (Split-Path -Parent $ngrokExePath) -WindowStyle Hidden -RedirectStandardOutput $ngrokStdoutLogPath -RedirectStandardError $ngrokStderrLogPath -PassThru

$publicHost = Get-BridgePublicHost
$localStatusOk = $false

foreach ($attempt in 1..20) {
  Start-Sleep -Seconds 1

  $printServerAlive = $printServerProcess -and $null -ne (Get-Process -Id $printServerProcess.Id -ErrorAction SilentlyContinue)
  $ngrokAlive = $ngrokProcess -and $null -ne (Get-Process -Id $ngrokProcess.Id -ErrorAction SilentlyContinue)

  if (-not $printServerAlive -or -not $ngrokAlive) {
    break
  }

  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$BridgeLocalPort/status" -Method Get -ErrorAction Stop
    $localStatusOk = $true
  } catch {
  }

  try {
    $tunnelsResponse = Invoke-RestMethod -Uri "$NgrokApiBaseUrl/tunnels" -Method Get -ErrorAction Stop
    $detectedPublicHost = $tunnelsResponse.tunnels |
      Where-Object { $_.public_url -like "https://*" } |
      Select-Object -ExpandProperty public_url -First 1

    if ($detectedPublicHost) {
      $publicHost = $detectedPublicHost.TrimEnd("/")
    }
  } catch {
  }

  if ($localStatusOk -and $publicHost) {
    break
  }
}

if ($publicHost) {
  $manifest.publicHost = $publicHost.TrimEnd("/")
  Save-BridgeManifest -Manifest $manifest
}

$printServerStopped = -not $printServerProcess -or $null -eq (Get-Process -Id $printServerProcess.Id -ErrorAction SilentlyContinue)
$ngrokStopped = -not $ngrokProcess -or $null -eq (Get-Process -Id $ngrokProcess.Id -ErrorAction SilentlyContinue)
$printServerExitCode = $null
$ngrokExitCode = $null

if ($printServerStopped) {
  try {
    $printServerExitCode = $printServerProcess.ExitCode
  } catch {
  }
}

if ($ngrokStopped) {
  try {
    $ngrokExitCode = $ngrokProcess.ExitCode
  } catch {
  }
}

if (-not $localStatusOk -or $printServerStopped -or $ngrokStopped) {
  [pscustomobject]@{
    success = $false
    printServerExited = $printServerStopped
    printServerExitCode = $printServerExitCode
    ngrokExited = $ngrokStopped
    ngrokExitCode = $ngrokExitCode
    localStatusOk = $localStatusOk
    publicHost = $publicHost
    manifestPath = Get-BridgeActiveManifestPath
    printServerStdoutTail = @(Get-BridgeTail -Path $printServerStdoutLogPath)
    printServerStderrTail = @(Get-BridgeTail -Path $printServerStderrLogPath)
    ngrokStdoutTail = @(Get-BridgeTail -Path $ngrokStdoutLogPath)
    ngrokStderrTail = @(Get-BridgeTail -Path $ngrokStderrLogPath)
  } | ConvertTo-Json -Depth 6

  exit 1
}

[pscustomobject]@{
  success = $true
  printServerPid = $printServerProcess.Id
  ngrokPid = $ngrokProcess.Id
  publicHost = $publicHost
  manifestPath = Get-BridgeActiveManifestPath
  printServerLog = $printServerStdoutLogPath
  ngrokLog = $ngrokStdoutLogPath
} | ConvertTo-Json -Depth 4
