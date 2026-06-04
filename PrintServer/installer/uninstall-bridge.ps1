. "$PSScriptRoot\lib\bridge-env.ps1"

$task = Get-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $BridgeTaskName -Confirm:$false
}

& "$PSScriptRoot\stop-bridge.ps1" | Out-Null

if (Test-Path $BridgeInstallRoot) {
  $normalizedInstallRoot = [System.IO.Path]::GetFullPath($BridgeInstallRoot)
  $normalizedProgramFiles = [System.IO.Path]::GetFullPath($env:ProgramFiles)

  if ($normalizedInstallRoot.StartsWith($normalizedProgramFiles) -and $normalizedInstallRoot.EndsWith($BridgeProductName)) {
    Remove-Item -LiteralPath $BridgeInstallRoot -Recurse -Force
  } else {
    throw "La ruta de instalacion no paso la validacion de seguridad: $normalizedInstallRoot"
  }
}

[pscustomobject]@{
  taskRemoved = $null -eq (Get-ScheduledTask -TaskName $BridgeTaskName -ErrorAction SilentlyContinue)
  installRootRemoved = -not (Test-Path $BridgeInstallRoot)
} | ConvertTo-Json -Depth 3
