$PreferredNodeVersion = "20.20.2"
$MinimumNodeMajor = 18
$PreferredNodeMajor = 20

function Get-NodeExecutable {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidatePaths = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  ) | Where-Object { $_ }

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Get-NodeVersionInfo {
  param(
    [string]$NodeExePath
  )

  if (-not $NodeExePath) {
    return $null
  }

  try {
    $rawVersion = & $NodeExePath --version
    if (-not $rawVersion) {
      return $null
    }

    $normalized = $rawVersion.Trim().TrimStart("v")
    $parts = $normalized.Split(".")
    return [pscustomobject]@{
      raw = $rawVersion.Trim()
      normalized = $normalized
      major = [int]$parts[0]
      path = $NodeExePath
    }
  } catch {
    return $null
  }
}

function Get-PreferredNodeMsiUrl {
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()

  switch ($arch) {
    "arm64" { return "https://nodejs.org/download/release/latest-v20.x/node-v20.20.2-arm64.msi" }
    "x86" { return "https://nodejs.org/download/release/latest-v20.x/node-v20.20.2-x86.msi" }
    default { return "https://nodejs.org/download/release/latest-v20.x/node-v20.20.2-x64.msi" }
  }
}

$nodeExePath = Get-NodeExecutable
$nodeVersion = Get-NodeVersionInfo -NodeExePath $nodeExePath

if ($nodeVersion -and $nodeVersion.major -ge $MinimumNodeMajor) {
  [pscustomobject]@{
    installed = $true
    changed = $false
    version = $nodeVersion.normalized
    path = $nodeVersion.path
    message = if ($nodeVersion.major -eq $PreferredNodeMajor) {
      "Node.js ya esta listo."
    } else {
      "Node.js ya existe y se reutiliza para no tocar otra instalacion."
    }
  } | ConvertTo-Json -Depth 4
  exit 0
}

$downloadUrl = Get-PreferredNodeMsiUrl
$tempMsiPath = Join-Path $env:TEMP "buffalo-node-$PreferredNodeVersion.msi"

Invoke-WebRequest -Uri $downloadUrl -OutFile $tempMsiPath

$msiArgs = @(
  "/i",
  "`"$tempMsiPath`"",
  "/qn",
  "/norestart",
  "ADDLOCAL=ALL"
)

$installProcess = Start-Process -FilePath "msiexec.exe" -ArgumentList $msiArgs -Wait -PassThru
if ($installProcess.ExitCode -ne 0) {
  throw "Fallo la instalacion de Node.js. Codigo MSI: $($installProcess.ExitCode)"
}

$postInstallNodeExe = Get-NodeExecutable
$postInstallVersion = Get-NodeVersionInfo -NodeExePath $postInstallNodeExe
if (-not $postInstallVersion -or $postInstallVersion.major -lt $MinimumNodeMajor) {
  throw "Node.js no quedo disponible despues de instalarlo."
}

[pscustomobject]@{
  installed = $true
  changed = $true
  version = $postInstallVersion.normalized
  path = $postInstallVersion.path
  source = $downloadUrl
} | ConvertTo-Json -Depth 4
