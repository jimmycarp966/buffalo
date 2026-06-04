. "$PSScriptRoot\lib\bridge-env.ps1"

$stopped = @()
$processes = Get-BridgeProcessSnapshot

foreach ($process in $processes) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    $stopped += [pscustomobject]@{
      processId = $process.ProcessId
      name = $process.Name
    }
  } catch {
  }
}

$portOwnerPids = Get-BridgePortOwnerPids
foreach ($ownerPid in $portOwnerPids) {
  if ($stopped.processId -contains $ownerPid) {
    continue
  }

  try {
    $ownerProcess = Get-Process -Id $ownerPid -ErrorAction Stop
    if ($ownerProcess.ProcessName -in @("node", "powershell", "pwsh")) {
      Stop-Process -Id $ownerPid -Force -ErrorAction Stop
      $stopped += [pscustomobject]@{
        processId = $ownerPid
        name = $ownerProcess.ProcessName
      }
    }
  } catch {
  }
}

$stopped | ConvertTo-Json -Depth 4
