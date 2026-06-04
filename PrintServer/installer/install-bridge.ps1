. "$PSScriptRoot\lib\bridge-env.ps1"

& "$PSScriptRoot\ensure-node.ps1" | Out-Null

$sourcePrintServerRoot = Get-BridgeRepoRoot
$sourceInstallerRoot = Join-Path $sourcePrintServerRoot "installer"

if (-not (Test-Path $sourcePrintServerRoot)) {
  throw "No se encontro la carpeta fuente de PrintServer."
}

Ensure-BridgeWritablePaths
$installedInstallerRoot = Join-Path $BridgeInstallRoot "installer"

Get-ChildItem -LiteralPath $sourcePrintServerRoot -Force | Where-Object {
  $_.Name -notin @("installer", ".bridge-runtime", "ngrok-v3-stable-windows-amd64.zip", ".ngrok.exe.old")
} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $BridgeRuntimeRoot -Recurse -Force
}

Copy-Item -LiteralPath $sourceInstallerRoot -Destination $installedInstallerRoot -Recurse -Force

$manifestPath = Get-BridgeManifestPath
if (-not (Test-Path $manifestPath)) {
  Copy-Item -LiteralPath (Get-BridgeTemplateManifestPath) -Destination $manifestPath -Force
}

$taskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$installedInstallerRoot\start-bridge.ps1`""
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable
$task = New-ScheduledTask -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings

Register-ScheduledTask -TaskName $BridgeTaskName -InputObject $task -Force | Out-Null

$startResult = & "$installedInstallerRoot\start-bridge.ps1"
$startExitCode = $LASTEXITCODE

if ($startResult) {
  $startResult | Write-Output
}

if ($startExitCode -ne 0) {
  throw "El bridge no paso el healthcheck inicial."
}
