. "$PSScriptRoot\lib\bridge-env.ps1"

$processes = Get-BridgeProcessSnapshot
$manifest = Get-BridgeEffectiveManifest
$publicHost = Get-BridgePublicHost

$localStatus = $null
try {
  $localStatus = Invoke-RestMethod -Uri "http://127.0.0.1:$BridgeLocalPort/status" -Method Get -ErrorAction Stop
} catch {
}

$ngrokApiStatus = $null
try {
  $ngrokApiStatus = Invoke-RestMethod -Uri "$NgrokApiBaseUrl/tunnels" -Method Get -ErrorAction Stop
} catch {
}

[pscustomobject]@{
  configured = -not (Test-PlaceholderValue ([string]$manifest.ngrokAuthtoken))
  publicHost = $publicHost
  printServerRunning = [bool]($processes | Where-Object { $_.Name -eq "node.exe" })
  ngrokRunning = [bool]($processes | Where-Object { $_.Name -like "ngrok*" })
  localStatusOk = $null -ne $localStatus
  localPrinterMode = $localStatus.printerModule
  detectedTunnelUrls = @(
    if ($ngrokApiStatus -and $ngrokApiStatus.tunnels) {
      $ngrokApiStatus.tunnels | ForEach-Object { $_.public_url }
    }
  )
  manifestPath = Get-BridgeActiveManifestPath
  printServerLog = Get-BridgeLogPath "print-server.stdout.log"
  ngrokLog = Get-BridgeLogPath "ngrok.stdout.log"
} | ConvertTo-Json -Depth 6
