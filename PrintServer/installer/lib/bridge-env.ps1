$BridgeProductName = "Buffalo Print Bridge"
$BridgeTaskName = "BuffaloPrintBridge"
$BridgeInstallBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } elseif ($env:TEMP) { $env:TEMP } else { Join-Path $env:SystemDrive "Temp" }
$BridgeInstallRoot = Join-Path $BridgeInstallBase "BuffaloPrintBridge"
$BridgeRuntimeRoot = Join-Path $BridgeInstallRoot "runtime"
$BridgeLogsRoot = Join-Path $BridgeInstallRoot "logs"
$BridgeConfigRoot = Join-Path $BridgeInstallRoot "config"
$BridgeWorkspaceRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) ".bridge-runtime"
$BridgeLocalPort = 3001
$BridgeManifestName = "install-manifest.json"
$NgrokConfigName = "ngrok.yml"
$NgrokExeName = "ngrok.exe"
$NgrokApiBaseUrl = "http://127.0.0.1:4040/api"
$PrintServerEntry = "print-server.js"
$RunServerScriptName = "run-server.ps1"

function Test-PlaceholderValue {
  param(
    [string]$Value
  )

  return [string]::IsNullOrWhiteSpace($Value) -or $Value -like "__*__"
}

function Get-BridgeRepoRoot {
  return Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

function Get-BridgeManifestPath {
  return Join-Path $BridgeConfigRoot $BridgeManifestName
}

function Get-BridgeWorkspaceManifestPath {
  return Join-Path (Join-Path $BridgeWorkspaceRoot "config") $BridgeManifestName
}

function Get-BridgeTemplateManifestPath {
  return Join-Path $PSScriptRoot "..\templates\$BridgeManifestName"
}

function Get-BridgeTemplateNgrokPath {
  return Join-Path $PSScriptRoot "..\templates\$NgrokConfigName"
}

function Get-BridgeEffectiveManifest {
  $manifestPath = Get-BridgeManifestPath
  $workspaceManifestPath = Get-BridgeWorkspaceManifestPath
  $templatePath = Get-BridgeTemplateManifestPath

  if (Test-Path $manifestPath) {
    return Get-Content $manifestPath -Raw | ConvertFrom-Json
  }

  if (Test-Path $workspaceManifestPath) {
    return Get-Content $workspaceManifestPath -Raw | ConvertFrom-Json
  }

  if (Test-Path $templatePath) {
    return Get-Content $templatePath -Raw | ConvertFrom-Json
  }

  return [pscustomobject]@{
    productName = $BridgeProductName
    transport = "ngrok-free"
    localPort = $BridgeLocalPort
    singleActivePc = $true
    ngrokAuthtoken = "__NGROK_AUTHTOKEN__"
    publicHost = ""
  }
}

function Save-BridgeManifest {
  param(
    [Parameter(Mandatory = $true)]
    [psobject]$Manifest
  )

  New-Item -ItemType Directory -Force -Path $BridgeConfigRoot | Out-Null
  $Manifest | ConvertTo-Json -Depth 6 | Set-Content -Path (Get-BridgeManifestPath) -Encoding UTF8
}

function Use-WorkspaceBridgePaths {
  $script:BridgeInstallRoot = $BridgeWorkspaceRoot
  $script:BridgeRuntimeRoot = Join-Path $BridgeInstallRoot "runtime"
  $script:BridgeLogsRoot = Join-Path $BridgeInstallRoot "logs"
  $script:BridgeConfigRoot = Join-Path $BridgeInstallRoot "config"
}

function Test-BridgeDirectoryWritable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  try {
    if (-not (Test-Path $Path)) {
      New-Item -ItemType Directory -Force -Path $Path -ErrorAction Stop | Out-Null
    }

    $tempFile = Join-Path $Path ([System.IO.Path]::GetRandomFileName())
    Set-Content -Path $tempFile -Value "ok" -Encoding UTF8 -ErrorAction Stop
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Ensure-BridgeWritablePaths {
  try {
    New-Item -ItemType Directory -Force -Path $BridgeInstallRoot, $BridgeRuntimeRoot, $BridgeLogsRoot, $BridgeConfigRoot -ErrorAction Stop | Out-Null
  } catch {
    Use-WorkspaceBridgePaths
    New-Item -ItemType Directory -Force -Path $BridgeInstallRoot, $BridgeRuntimeRoot, $BridgeLogsRoot, $BridgeConfigRoot -ErrorAction Stop | Out-Null
    return
  }

  if (
    -not (Test-BridgeDirectoryWritable -Path $BridgeConfigRoot) -or
    -not (Test-BridgeDirectoryWritable -Path $BridgeLogsRoot)
  ) {
    Use-WorkspaceBridgePaths
    New-Item -ItemType Directory -Force -Path $BridgeInstallRoot, $BridgeRuntimeRoot, $BridgeLogsRoot, $BridgeConfigRoot -ErrorAction Stop | Out-Null
  }
}

function Get-BridgeLogPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  return Join-Path $BridgeLogsRoot $Name
}

function Get-BridgeTail {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$Lines = 25
  )

  if (-not (Test-Path $Path)) {
    return @()
  }

  return @(Get-Content -Path $Path -Tail $Lines | ForEach-Object { $_.ToString() })
}

function Get-BridgeActiveManifestPath {
  $manifestPath = Get-BridgeManifestPath
  if (Test-Path $manifestPath) {
    return $manifestPath
  }

  $workspaceManifestPath = Get-BridgeWorkspaceManifestPath
  if (Test-Path $workspaceManifestPath) {
    return $workspaceManifestPath
  }

  return $manifestPath
}

function Get-BridgePublicHost {
  $manifest = Get-BridgeEffectiveManifest
  $publicHost = [string]$manifest.publicHost

  if (Test-PlaceholderValue $publicHost) {
    return $null
  }

  return $publicHost.Trim().TrimEnd("/")
}

function Resolve-PrintServerRoot {
  $installedRoot = $BridgeRuntimeRoot
  $installedEntry = Join-Path $installedRoot $PrintServerEntry

  if (Test-Path $installedEntry) {
    return $installedRoot
  }

  return Get-BridgeRepoRoot
}

function Resolve-RunServerScriptPath {
  $installedScript = Join-Path $BridgeRuntimeRoot $RunServerScriptName
  if (Test-Path $installedScript) {
    return $installedScript
  }

  return Join-Path (Get-BridgeRepoRoot) $RunServerScriptName
}

function Resolve-NgrokExecutablePath {
  $fromInstall = Join-Path $BridgeRuntimeRoot $NgrokExeName
  if (Test-Path $fromInstall) {
    return $fromInstall
  }

  $fromRepo = Join-Path (Get-BridgeRepoRoot) $NgrokExeName
  if (Test-Path $fromRepo) {
    return $fromRepo
  }

  $command = Get-Command $NgrokExeName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

function Get-BridgeProcessSnapshot {
  $ngrokConfigPath = Join-Path $BridgeConfigRoot $NgrokConfigName
  $workspaceNgrokConfigPath = Join-Path (Join-Path $BridgeWorkspaceRoot "config") $NgrokConfigName

  return Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq "node.exe" -and $_.CommandLine -like "*$PrintServerEntry*") -or
    ($_.Name -like "ngrok*" -and (
      $_.CommandLine -like "*$ngrokConfigPath*" -or
      $_.CommandLine -like "*$workspaceNgrokConfigPath*" -or
      $_.CommandLine -like "* start --all*"
    ))
  }
}

function Get-BridgePortOwnerPids {
  $connections = @(Get-NetTCPConnection -LocalPort $BridgeLocalPort -State Listen -ErrorAction SilentlyContinue)
  if (-not $connections) {
    return @()
  }

  return @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
}
