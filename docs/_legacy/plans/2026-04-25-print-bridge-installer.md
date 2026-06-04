# Print Bridge Installer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

> **Update 2026-04-25:** This plan now pivots from `cloudflared` to `ngrok` free-domain transport. Any old mention of Cloudflare below should be treated as legacy planning context unless it has been explicitly refreshed.

**Goal:** Build a Windows installer that leaves the Bar print bridge fully installed, auto-starting, and reachable through one `ngrok` HTTPS endpoint with a single operator action.

**Architecture:** Keep the existing `PrintServer` as the local runtime, add an installer-focused orchestration layer under `PrintServer/installer/`, and let the installer discover the active `ngrok` public host after boot. Use Windows Scheduled Tasks for auto-start instead of a first-pass Windows Service, and treat the bundled `ngrok` auth token as an internal runtime asset for one active PC at a time.

**Tech Stack:** Next.js/TypeScript, Node.js `PrintServer`, PowerShell, BAT launchers, Windows Scheduled Tasks, `ngrok`, Jest for targeted unit tests, manual smoke checks for installer/runtime scripts.

---

### Task 0: Lock the Real Fixed Tunnel Inputs

**Files:**
- Modify: `docs/plans/2026-04-25-print-bridge-installer.md`
- Reference: embedded internal tunnel asset bundle used for this business

**Step 1: Replace the placeholder hostname in this plan**

Replace every use of `https://print-bridge-host.example` with the actual fixed hostname that will ship inside the installer.

**Step 2: Record the runtime asset names**

Confirm and note the exact embedded asset names that the implementation will use:

- `cloudflared.exe`
- tunnel credentials JSON filename
- real tunnel ID
- real public hostname

**Step 3: Verify no placeholders remain**

Run:

```powershell
rg -n "print-bridge-host.example|__TUNNEL_ID__|__PUBLIC_HOSTNAME__|__CREDENTIALS_PATH__" "C:\Clientes\Bar\docs\plans\2026-04-25-print-bridge-installer.md"
```

Expected: no unresolved placeholders remain in the implementation plan before coding starts.

### Task 1: Make Fixed Bridge Host Resolution Testable

**Files:**
- Create: `lib/printBridgeConfig.ts`
- Create: `tests/unit/lib/printBridgeConfig.test.ts`
- Modify: `lib/localPrinter.ts`

**Step 1: Write the failing test**

Create `tests/unit/lib/printBridgeConfig.test.ts` covering:

```ts
import {
  DEFAULT_PRINT_BRIDGE_HOST,
  buildPrintBridgeBaseUrl,
} from "@/lib/printBridgeConfig";

describe("buildPrintBridgeBaseUrl", () => {
  it("uses explicit https host as-is", () => {
    expect(buildPrintBridgeBaseUrl({ enabled: true, host: "https://bridge.example", port: 3001 }))
      .toBe("https://bridge.example");
  });

  it("builds http url from raw host and port", () => {
    expect(buildPrintBridgeBaseUrl({ enabled: true, host: "10.0.0.5", port: 3001 }))
      .toBe("http://10.0.0.5:3001");
  });

  it("falls back to fixed business host when local setting host is empty", () => {
    expect(buildPrintBridgeBaseUrl({ enabled: true, host: "", port: 3001 }))
      .toBe(DEFAULT_PRINT_BRIDGE_HOST);
  });

  it("returns null when disabled", () => {
    expect(buildPrintBridgeBaseUrl({ enabled: false, host: "", port: 3001 })).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest tests/unit/lib/printBridgeConfig.test.ts --runInBand
```

Expected: FAIL because `printBridgeConfig.ts` does not exist.

**Step 3: Write minimal implementation**

Create `lib/printBridgeConfig.ts`:

```ts
export const DEFAULT_PRINT_BRIDGE_HOST = "https://print-bridge-host.example";

type PrintBridgeConfigInput = {
  enabled: boolean;
  host?: string | null;
  port?: number | null;
};

export function buildPrintBridgeBaseUrl(input: PrintBridgeConfigInput): string | null {
  if (!input.enabled) return null;

  const rawHost = input.host?.trim() || "";
  const port = input.port || 3001;

  if (/^https?:\/\//i.test(rawHost)) {
    return rawHost.replace(/\/+$/, "");
  }

  if (rawHost) {
    return `http://${rawHost}:${port}`;
  }

  return DEFAULT_PRINT_BRIDGE_HOST;
}
```

Refactor `lib/localPrinter.ts` so `getRemotePrintServerBaseUrl()` delegates to `buildPrintBridgeBaseUrl(...)` instead of inlining host parsing logic.

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest tests/unit/lib/printBridgeConfig.test.ts --runInBand
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/printBridgeConfig.ts tests/unit/lib/printBridgeConfig.test.ts lib/localPrinter.ts
git commit -m "feat(print): add fixed bridge host resolution"
```

### Task 2: Add Installer Runtime Constants and Folder Layout

**Files:**
- Create: `PrintServer/installer/lib/bridge-env.ps1`
- Create: `PrintServer/installer/templates/cloudflared-config.yml`
- Create: `PrintServer/installer/templates/install-manifest.json`
- Create: `PrintServer/installer/README.md`

**Step 1: Write the failing smoke check**

Define a manual check list in the plan for missing files:

```powershell
Test-Path "C:\Clientes\Bar\PrintServer\installer\lib\bridge-env.ps1"
Test-Path "C:\Clientes\Bar\PrintServer\installer\templates\cloudflared-config.yml"
Test-Path "C:\Clientes\Bar\PrintServer\installer\templates\install-manifest.json"
```

Expected before implementation: `False` for all new files.

**Step 2: Create the shared constants file**

Create `PrintServer/installer/lib/bridge-env.ps1` with fixed paths and names:

```powershell
$BridgeInstallRoot = "C:\Program Files\Almendra Print Bridge"
$BridgeRuntimeRoot = Join-Path $BridgeInstallRoot "runtime"
$BridgeLogsRoot = Join-Path $BridgeInstallRoot "logs"
$BridgeConfigRoot = Join-Path $BridgeInstallRoot "config"
$BridgeTaskName = "AlmendraPrintBridge"
$BridgeLocalPort = 3001
$BridgePublicHost = "https://print-bridge-host.example"
$CloudflaredExeName = "cloudflared.exe"
$PrintServerEntry = "print-server.js"
```

**Step 3: Create template files**

Create `cloudflared-config.yml` template with placeholders the installer will fill:

```yaml
tunnel: __TUNNEL_ID__
credentials-file: __CREDENTIALS_PATH__

ingress:
  - hostname: __PUBLIC_HOSTNAME__
    service: http://127.0.0.1:3001
  - service: http_status:404
```

Create `install-manifest.json`:

```json
{
  "productName": "Almendra Print Bridge",
  "fixedPublicHost": "https://print-bridge-host.example",
  "localPort": 3001,
  "singleActivePc": true
}
```

**Step 4: Document folder purpose**

Write `PrintServer/installer/README.md` with:
- install root
- which scripts are entrypoints
- where logs/config live
- reminder that the bundle is internal-only for one business

**Step 5: Run smoke check**

Run:

```powershell
Get-ChildItem "C:\Clientes\Bar\PrintServer\installer" -Recurse
```

Expected: new installer structure visible.

**Step 6: Commit**

```bash
git add PrintServer/installer
git commit -m "feat(print): add installer runtime skeleton"
```

### Task 3: Build Bootstrap and Process Lifecycle Scripts

**Files:**
- Create: `PrintServer/installer/start-bridge.ps1`
- Create: `PrintServer/installer/stop-bridge.ps1`
- Create: `PrintServer/installer/status-bridge.ps1`
- Modify: `PrintServer/run-server.ps1`

**Step 1: Write the failing smoke command**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\status-bridge.ps1"
```

Expected: FAIL because script does not exist yet.

**Step 2: Implement `start-bridge.ps1`**

Core behavior:
- import `bridge-env.ps1`
- create install/log/config directories if missing
- start Node `print-server.js`
- start `cloudflared.exe` with generated config
- write PID/process info to log-friendly output

Starter shape:

```powershell
. "$PSScriptRoot\lib\bridge-env.ps1"

New-Item -ItemType Directory -Force $BridgeInstallRoot, $BridgeRuntimeRoot, $BridgeLogsRoot, $BridgeConfigRoot | Out-Null

Start-Process -FilePath "node.exe" -ArgumentList (Join-Path $BridgeRuntimeRoot $PrintServerEntry) -WindowStyle Hidden
Start-Process -FilePath (Join-Path $BridgeRuntimeRoot $CloudflaredExeName) -ArgumentList @("tunnel", "--config", (Join-Path $BridgeConfigRoot "cloudflared-config.yml"), "run") -WindowStyle Hidden
```

**Step 3: Implement `stop-bridge.ps1`**

Stop both by command line/path match:

```powershell
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -like "*print-server.js*" -or $_.CommandLine -like "*cloudflared*"
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

**Step 4: Implement `status-bridge.ps1`**

Return:
- matching local processes
- `Invoke-WebRequest http://127.0.0.1:3001/status`
- `Invoke-WebRequest https://print-bridge-host.example/status`
- clear human-readable summary

**Step 5: Reuse `run-server.ps1`**

Modify `PrintServer/run-server.ps1` only if needed so the runtime launch path is compatible with the installer layout. Keep it thin or document it as the developer-only launcher.

**Step 6: Run smoke checks**

Run in order:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\start-bridge.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\status-bridge.ps1"
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\stop-bridge.ps1"
```

Expected:
- start: no crash
- status: shows processes and endpoint results
- stop: processes disappear

**Step 7: Commit**

```bash
git add PrintServer/installer PrintServer/run-server.ps1
git commit -m "feat(print): add bridge lifecycle scripts"
```

### Task 4: Add Scheduled Task Registration and Admin Install Entry Point

**Files:**
- Create: `PrintServer/installer/register-bridge-task.ps1`
- Create: `PrintServer/installer/install-bridge.ps1`
- Create: `PrintServer/installer/install-bridge.bat`
- Modify: `PrintServer/instalar.bat`

**Step 1: Write the failing smoke command**

Run:

```powershell
Get-ScheduledTask -TaskName "AlmendraPrintBridge"
```

Expected before implementation: task not found.

**Step 2: Implement scheduled task registration**

Create `register-bridge-task.ps1`:

```powershell
. "$PSScriptRoot\lib\bridge-env.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$BridgeInstallRoot\start-bridge.ps1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $BridgeTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
```

**Step 3: Implement `install-bridge.ps1`**

Responsibilities:
- require admin
- copy packaged runtime into install root
- materialize tunnel config/credentials into config dir
- call `register-bridge-task.ps1`
- call `start-bridge.ps1`
- run local/remote health checks

**Step 4: Implement BAT launcher**

Create `install-bridge.bat` that only escalates into the PowerShell installer:

```bat
@echo off
powershell -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File ""%~dp0install-bridge.ps1""' -Verb RunAs"
```

**Step 5: Repoint legacy installer**

Modify `PrintServer/instalar.bat` so it becomes the friendly entrypoint and either:
- calls the new installer directly, or
- clearly delegates to `installer\install-bridge.bat`

**Step 6: Run smoke checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\install-bridge.ps1"
Get-ScheduledTask -TaskName "AlmendraPrintBridge"
```

Expected:
- install completes without manual edits
- scheduled task exists

**Step 7: Commit**

```bash
git add PrintServer/installer PrintServer/instalar.bat
git commit -m "feat(print): add admin installer and startup task"
```

### Task 5: Bundle Tunnel Config and Verify Fixed Host Reachability

**Files:**
- Create: `PrintServer/installer/write-cloudflared-config.ps1`
- Create: `PrintServer/installer/test-bridge-health.ps1`
- Modify: `PrintServer/installer/install-bridge.ps1`

**Step 1: Write the failing smoke command**

Run:

```powershell
Invoke-WebRequest "https://print-bridge-host.example/status" -UseBasicParsing
```

Expected before config/runtime wiring: FAIL or unresolved host.

**Step 2: Implement config writer**

Create `write-cloudflared-config.ps1` to copy the embedded credential file and render the template:

```powershell
. "$PSScriptRoot\lib\bridge-env.ps1"

$template = Get-Content (Join-Path $PSScriptRoot "templates\cloudflared-config.yml") -Raw
$rendered = $template.Replace("__TUNNEL_ID__", $TunnelId).Replace("__CREDENTIALS_PATH__", $CredentialFilePath).Replace("__PUBLIC_HOSTNAME__", $PublicHostname)
Set-Content -Path (Join-Path $BridgeConfigRoot "cloudflared-config.yml") -Value $rendered -Encoding UTF8
```

**Step 3: Implement health test script**

`test-bridge-health.ps1` should:
- hit local `/status`
- hit fixed host `/status`
- emit non-zero exit code on failure

**Step 4: Integrate into installer**

Have `install-bridge.ps1` call:
- `write-cloudflared-config.ps1`
- `start-bridge.ps1`
- `test-bridge-health.ps1`

**Step 5: Run smoke checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\test-bridge-health.ps1"
```

Expected:
- local endpoint OK
- remote endpoint OK

**Step 6: Commit**

```bash
git add PrintServer/installer
git commit -m "feat(print): add tunnel config writer and health checks"
```

### Task 6: Add Repair and Uninstall Flows

**Files:**
- Create: `PrintServer/installer/repair-bridge.ps1`
- Create: `PrintServer/installer/uninstall-bridge.ps1`
- Create: `PrintServer/installer/restart-bridge.bat`

**Step 1: Write the failing smoke command**

Run:

```powershell
Test-Path "C:\Clientes\Bar\PrintServer\installer\repair-bridge.ps1"
Test-Path "C:\Clientes\Bar\PrintServer\installer\uninstall-bridge.ps1"
```

Expected: `False` before creation.

**Step 2: Implement repair**

`repair-bridge.ps1` should:
- stop processes
- rewrite config
- recreate scheduled task
- restart runtime
- rerun health check

Pseudo-shape:

```powershell
& "$PSScriptRoot\stop-bridge.ps1"
& "$PSScriptRoot\write-cloudflared-config.ps1"
& "$PSScriptRoot\register-bridge-task.ps1"
& "$PSScriptRoot\start-bridge.ps1"
& "$PSScriptRoot\test-bridge-health.ps1"
```

**Step 3: Implement uninstall**

`uninstall-bridge.ps1` should:
- stop processes
- unregister scheduled task
- remove install directory
- leave remote host assumption intact

**Step 4: Add restart BAT**

Create a tiny operator shortcut:

```bat
@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0stop-bridge.ps1"
powershell -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
pause
```

**Step 5: Run smoke checks**

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\repair-bridge.ps1"
```

Expected: bridge returns to healthy state after intentional stop.

**Step 6: Commit**

```bash
git add PrintServer/installer
git commit -m "feat(print): add repair and uninstall flows"
```

### Task 7: Document Operator Flow and Installer Ownership

**Files:**
- Modify: `ARCHITECTURE.md`
- Create: `PrintServer/INSTALLER.md`

**Step 1: Write the failing doc check**

Run:

```powershell
rg -n "fixed Cloudflare tunnel|Scheduled Task|install-bridge|repair-bridge" "C:\Clientes\Bar\ARCHITECTURE.md" "C:\Clientes\Bar\PrintServer\INSTALLER.md"
```

Expected before implementation: missing matches.

**Step 2: Update architecture docs**

Add a focused section in `ARCHITECTURE.md` describing:
- fixed-host print bridge model
- one-PC rule
- installer runtime
- repair/uninstall operations

**Step 3: Write operator doc**

Create `PrintServer/INSTALLER.md` with:
- how to install
- what “healthy” means
- how to repair
- how to replace a PC
- warning that only one PC should remain active

**Step 4: Run doc check**

Run the same `rg` command and verify matches exist.

**Step 5: Commit**

```bash
git add ARCHITECTURE.md PrintServer/INSTALLER.md
git commit -m "docs(print): document fixed bridge installer flow"
```

### Task 8: Final Verification Matrix

**Files:**
- Modify: `PrintServer/installer/test-bridge-health.ps1`
- Optional Create: `PrintServer/installer/verify-end-to-end.ps1`

**Step 1: Add final verification script**

If needed, create `verify-end-to-end.ps1` that:
- runs `status-bridge.ps1`
- confirms scheduled task exists
- checks local `/status`
- checks remote `/status`
- prints a clear PASS/FAIL summary

**Step 2: Run local verification**

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Clientes\Bar\PrintServer\installer\verify-end-to-end.ps1"
```

Expected: PASS on healthy machine.

**Step 3: Reboot verification**

Manual:
- reboot Windows
- rerun `verify-end-to-end.ps1`
- confirm no manual relaunch was required

**Step 4: Replacement-PC verification**

Manual:
- install on second PC
- stop/uninstall first PC
- verify the same fixed remote host still returns `/status`
- perform one real print from the published app

**Step 5: Commit**

```bash
git add PrintServer/installer
git commit -m "test(print): add final bridge verification flow"
```
