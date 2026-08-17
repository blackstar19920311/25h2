// ============================================================================
//  Szkript gyár
//  Minden fájl, ami a C:\Windows\Setup\Scripts mappába kerül. A fájlokat az
//  autounattend.xml írja ki (base64 + certutil), majd fázisonként futtatja.
// ============================================================================

const R = String.raw

export const SCRIPT_DIR = R`C:\Windows\Setup\Scripts`
export const LOG_DIR = R`C:\Windows\Setup\Scripts\Logs`
const DU = R`Registry::HKEY_USERS\DefUser`

export const inScripts = (name) => SCRIPT_DIR + '\\' + name

const xe = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// PowerShell egyszeres idézőjel escape
const q = (s) => String(s == null ? '' : s).replace(/'/g, "''")

const head = (title, log) => `# ============================================================
#  ${title}
#  Windows 11 25H2 Autounattend Generator
# ============================================================
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
New-Item -Path '${LOG_DIR}' -ItemType Directory -Force | Out-Null
Start-Transcript -Path (Join-Path '${LOG_DIR}' '${log}') -Append | Out-Null

function Log {
  param([string]$Message)
  Write-Host ('[' + (Get-Date -Format 'HH:mm:ss') + '] ' + $Message)
}

function Set-RegValue {
  param([string]$Path, [string]$Name, [string]$Type, $Value)
  try {
    if (-not (Test-Path -LiteralPath $Path)) { New-Item -Path $Path -Force | Out-Null }
    New-ItemProperty -LiteralPath $Path -Name $Name -PropertyType $Type -Value $Value -Force | Out-Null
  } catch {
    Log ('REG HIBA: ' + $Path + ' :: ' + $Name + ' -> ' + $_.Exception.Message)
  }
}
`

const foot = `
Log 'Befejezve.'
Stop-Transcript | Out-Null
exit 0
`

const reg = (path, name, type, value) =>
  `Set-RegValue -Path '${path}' -Name '${name}' -Type ${type} -Value ` +
  (typeof value === 'number' ? String(value) : `'${q(value)}'`)

// ---------------------------------------------------------------------------
//  1. Tweak-ek és házirendek (specialize)
// ---------------------------------------------------------------------------
export function tweaksScript(cfg) {
  const t = cfg.tweaks
  const H = [] // HKLM
  const D = [] // Default user hive
  const T = [] // egyéb parancsok

  if (t.disableUAC) {
    const k = R`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`
    H.push(reg(k, 'EnableLUA', 'DWord', 0))
    H.push(reg(k, 'ConsentPromptBehaviorAdmin', 'DWord', 0))
    H.push(reg(k, 'ConsentPromptBehaviorUser', 'DWord', 0))
    H.push(reg(k, 'PromptOnSecureDesktop', 'DWord', 0))
    H.push(reg(k, 'FilterAdministratorToken', 'DWord', 0))
    H.push(reg(k, 'EnableInstallerDetection', 'DWord', 0))
    H.push(reg(k, 'EnableVirtualization', 'DWord', 0))
  }

  if (t.disableTelemetry) {
    const dc = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection`
    H.push(reg(dc, 'AllowTelemetry', 'DWord', 0))
    H.push(reg(dc, 'AllowCommercialDataPipeline', 'DWord', 0))
    H.push(reg(dc, 'AllowDeviceNameInTelemetry', 'DWord', 0))
    H.push(reg(dc, 'DoNotShowFeedbackNotifications', 'DWord', 1))
    H.push(reg(dc, 'LimitDiagnosticLogCollection', 'DWord', 1))
    H.push(reg(R`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection`, 'AllowTelemetry', 'DWord', 0))
    H.push(reg(R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\AdvertisingInfo`, 'DisabledByGroupPolicy', 'DWord', 1))
    const cc = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent`
    H.push(reg(cc, 'DisableWindowsConsumerFeatures', 'DWord', 1))
    H.push(reg(cc, 'DisableCloudOptimizedContent', 'DWord', 1))
    H.push(reg(cc, 'DisableConsumerAccountStateContent', 'DWord', 1))
    H.push(reg(cc, 'DisableSoftLanding', 'DWord', 1))
    H.push(reg(R`HKLM:\SYSTEM\CurrentControlSet\Services\DiagTrack`, 'Start', 'DWord', 4))
    H.push(reg(R`HKLM:\SYSTEM\CurrentControlSet\Services\dmwappushservice`, 'Start', 'DWord', 4))
    T.push(`Log 'Telemetria ütemezett feladatok tiltása.'
$telemetryTasks = @(
  '\\Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser',
  '\\Microsoft\\Windows\\Application Experience\\ProgramDataUpdater',
  '\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator',
  '\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip',
  '\\Microsoft\\Windows\\Feedback\\Siuf\\DmClient'
)
foreach ($tp in $telemetryTasks) {
  try {
    Disable-ScheduledTask -TaskPath (Split-Path -Path $tp -Parent) -TaskName (Split-Path -Path $tp -Leaf) -ErrorAction Stop | Out-Null
  } catch { }
}`)
  }

  if (t.disableBingSearch) {
    H.push(reg(R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer`, 'DisableSearchBoxSuggestions', 'DWord', 1))
    const ws = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search`
    H.push(reg(ws, 'DisableWebSearch', 'DWord', 1))
    H.push(reg(ws, 'ConnectedSearchUseWeb', 'DWord', 0))
    H.push(reg(ws, 'AllowCortana', 'DWord', 0))
    H.push(reg(ws, 'EnableDynamicContentInWSB', 'DWord', 0))
  }

  if (t.disableCopilot) {
    H.push(reg(R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot`, 'TurnOffWindowsCopilot', 'DWord', 1))
    D.push(reg(DU + R`\Software\Policies\Microsoft\Windows\WindowsCopilot`, 'TurnOffWindowsCopilot', 'DWord', 1))
    D.push(reg(DU + R`\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, 'ShowCopilotButton', 'DWord', 0))
  }

  if (t.disableRecall) {
    const ai = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI`
    H.push(reg(ai, 'DisableAIDataAnalysis', 'DWord', 1))
    H.push(reg(ai, 'AllowRecallEnablement', 'DWord', 0))
    H.push(reg(ai, 'DisableClickToDo', 'DWord', 1))
  }

  if (t.disableEdgeFRE) {
    const e = R`HKLM:\SOFTWARE\Policies\Microsoft\Edge`
    H.push(reg(e, 'HideFirstRunExperience', 'DWord', 1))
    H.push(reg(e, 'PersonalizationReportingEnabled', 'DWord', 0))
    H.push(reg(e, 'StartupBoostEnabled', 'DWord', 0))
    H.push(reg(e, 'ShowRecommendationsEnabled', 'DWord', 0))
    H.push(reg(e, 'PromotionalTabsEnabled', 'DWord', 0))
    H.push(reg(e, 'EdgeShoppingAssistantEnabled', 'DWord', 0))
    H.push(reg(e, 'CreateDesktopShortcutDefault', 'DWord', 0))
  }

  if (t.longPaths) {
    H.push(reg(R`HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem`, 'LongPathsEnabled', 'DWord', 1))
  }

  if (t.disableFastStartup) {
    H.push(reg(R`HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power`, 'HiberbootEnabled', 'DWord', 0))
  }

  if (t.disableDefender) {
    const d = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender`
    H.push(reg(d, 'DisableAntiSpyware', 'DWord', 1))
    H.push(reg(d, 'DisableRoutinelyTakingAction', 'DWord', 1))
    H.push(reg(d + R`\Real-Time Protection`, 'DisableRealtimeMonitoring', 'DWord', 1))
    H.push(reg(d + R`\Real-Time Protection`, 'DisableBehaviorMonitoring', 'DWord', 1))
  }

  if (t.disableMouseAccel) {
    const m = DU + R`\Control Panel\Mouse`
    D.push(reg(m, 'MouseSpeed', 'String', '0'))
    D.push(reg(m, 'MouseThreshold1', 'String', '0'))
    D.push(reg(m, 'MouseThreshold2', 'String', '0'))
  }

  if (t.ultimatePerformance) {
    T.push(`Log 'Ultimate Performance energiaséma bekapcsolása.'
$ultimate = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
powercfg.exe -duplicatescheme $ultimate 2>$null | Out-Null
powercfg.exe -setactive $ultimate 2>$null | Out-Null`)
  }

  if (t.neverSleep) {
    T.push(`Log 'Alvás és monitor időtúllépés kikapcsolása (hálózati áram).'
powercfg.exe -change standby-timeout-ac 0 | Out-Null
powercfg.exe -change monitor-timeout-ac 0 | Out-Null
powercfg.exe -change hibernate-timeout-ac 0 | Out-Null`)
  }

  if (t.disableHibernation) {
    T.push(`Log 'Hibernálás kikapcsolása (hiberfil.sys törlése).'
powercfg.exe /hibernate off | Out-Null`)
  }

  const body = [
    head('Specialize · Tweak-ek, házirendek, teljesítmény', 'specialize-tweaks.log'),
    `Log 'Rendszerszintű beállítások írása...'`,
    ...H,
  ]

  if (D.length) {
    body.push(`
Log 'Default felhasználói hive betöltése (új profilok alapértelmezései).'
reg.exe load 'HKU\\DefUser' 'C:\\Users\\Default\\NTUSER.DAT' | Out-Null`)
    body.push(...D)
    body.push(`
[GC]::Collect()
Start-Sleep -Seconds 2
reg.exe unload 'HKU\\DefUser' | Out-Null`)
  }

  if (T.length) body.push('', ...T)
  body.push(foot)
  return body.join('\n')
}

// ---------------------------------------------------------------------------
//  2. Start menü / tálca / Explorer (specialize)
// ---------------------------------------------------------------------------
export function startMenuScript(cfg) {
  const u = cfg.ui
  const H = []
  const D = []
  const T = []
  const adv = DU + R`\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`

  if (u.startClean) {
    const ex = R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer`
    H.push(reg(ex, 'HideRecommendedSection', 'DWord', 1))
    H.push(reg(ex, 'HideRecommendedPersonalizedSites', 'DWord', 1))
    H.push(reg(ex, 'ConfigureStartPins', 'String', '{"pinnedList":[]}'))
    H.push(reg(ex, 'ConfigureStartPins_ProviderSet', 'DWord', 1))
    H.push(reg(ex, 'LockedStartLayout', 'DWord', 0))
    const pm = R`HKLM:\SOFTWARE\Microsoft\PolicyManager\current\device\Start`
    H.push(reg(pm, 'HideRecommendedSection', 'DWord', 1))
    H.push(reg(pm, 'ConfigureStartPins', 'String', '{"pinnedList":[]}'))
    H.push(reg(pm, 'HideRecommendedSection_ProviderSet', 'DWord', 1))
    H.push(reg(pm, 'ConfigureStartPins_ProviderSet', 'DWord', 1))
    H.push(reg(R`HKLM:\SOFTWARE\Microsoft\PolicyManager\current\device\Education`, 'IsEducationEnvironment', 'DWord', 0))

    const cdm = DU + R`\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager`
    const cdmOff = [
      'ContentDeliveryAllowed', 'FeatureManagementEnabled', 'OemPreInstalledAppsEnabled',
      'PreInstalledAppsEnabled', 'PreInstalledAppsEverEnabled', 'RemediationRequired',
      'RotatingLockScreenEnabled', 'RotatingLockScreenOverlayEnabled', 'SilentInstalledAppsEnabled',
      'SoftLandingEnabled', 'SubscribedContentEnabled', 'SystemPaneSuggestionsEnabled',
      'SubscribedContent-310093Enabled', 'SubscribedContent-338387Enabled',
      'SubscribedContent-338388Enabled', 'SubscribedContent-338389Enabled',
      'SubscribedContent-338393Enabled', 'SubscribedContent-353694Enabled',
      'SubscribedContent-353696Enabled', 'SubscribedContent-88000326Enabled',
    ]
    cdmOff.forEach((n) => D.push(reg(cdm, n, 'DWord', 0)))

    T.push(`Log 'LayoutModification.json kihelyezése a Default profilba.'
$shellDir = 'C:\\Users\\Default\\AppData\\Local\\Microsoft\\Windows\\Shell'
New-Item -Path $shellDir -ItemType Directory -Force | Out-Null
Copy-Item -Path '${inScripts('LayoutModification.json')}' -Destination (Join-Path $shellDir 'LayoutModification.json') -Force`)
  }

  if (u.hideWidgets) {
    H.push(reg(R`HKLM:\SOFTWARE\Policies\Microsoft\Dsh`, 'AllowNewsAndInterests', 'DWord', 0))
    D.push(reg(adv, 'TaskbarDa', 'DWord', 0))
  }
  if (u.hideChat) {
    H.push(reg(R`HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Chat`, 'ChatIcon', 'DWord', 3))
    D.push(reg(adv, 'TaskbarMn', 'DWord', 0))
  }
  if (u.hideTaskView) D.push(reg(adv, 'ShowTaskViewButton', 'DWord', 0))
  if (u.taskbarLeft) D.push(reg(adv, 'TaskbarAl', 'DWord', 0))
  if (u.showFileExt) D.push(reg(adv, 'HideFileExt', 'DWord', 0))
  if (u.showHidden) D.push(reg(adv, 'Hidden', 'DWord', 1))
  if (u.explorerThisPC) D.push(reg(adv, 'LaunchTo', 'DWord', 1))
  if (u.endTask) D.push(reg(adv + R`\TaskbarDeveloperSettings`, 'TaskbarEndTask', 'DWord', 1))
  D.push(reg(DU + R`\Software\Microsoft\Windows\CurrentVersion\Search`, 'SearchboxTaskbarMode', 'DWord', Number(u.searchBox)))

  if (u.darkMode) {
    const th = DU + R`\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`
    D.push(reg(th, 'AppsUseLightTheme', 'DWord', 0))
    D.push(reg(th, 'SystemUsesLightTheme', 'DWord', 0))
  }

  if (u.classicContextMenu) {
    D.push(`New-Item -Path '${DU}\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force -Value '' | Out-Null`)
  }

  const body = [head('Specialize · Start menü, tálca és Explorer', 'specialize-startmenu.log'), `Log 'Start menü és tálca házirendek...'`, ...H]
  if (D.length) {
    body.push(`
Log 'Default felhasználói hive betöltése.'
reg.exe load 'HKU\\DefUser' 'C:\\Users\\Default\\NTUSER.DAT' | Out-Null`)
    body.push(...D)
    body.push(`
[GC]::Collect()
Start-Sleep -Seconds 2
reg.exe unload 'HKU\\DefUser' | Out-Null`)
  }
  if (T.length) body.push('', ...T)
  body.push(foot)
  return body.join('\n')
}

// ---------------------------------------------------------------------------
//  3. Bloatware (specialize) – listából, nem végtelen ciklusból
// ---------------------------------------------------------------------------
export function bloatwareScript(cfg) {
  const list = cfg.bloatware.map((id) => `  '${q(id)}'`).join(',\n')
  const onedrive = cfg.removeOneDrive
    ? `
Log 'OneDrive telepítő eltávolítása.'
foreach ($od in @('C:\\Windows\\System32\\OneDriveSetup.exe', 'C:\\Windows\\SysWOW64\\OneDriveSetup.exe')) {
  if (Test-Path -LiteralPath $od) {
    try { Start-Process -FilePath $od -ArgumentList '/uninstall' -Wait -ErrorAction Stop } catch { }
    Remove-Item -LiteralPath $od -Force -ErrorAction SilentlyContinue
  }
}
reg.exe load 'HKU\\DefUser' 'C:\\Users\\Default\\NTUSER.DAT' | Out-Null
Remove-ItemProperty -LiteralPath '${DU}\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'OneDriveSetup' -Force -ErrorAction SilentlyContinue
[GC]::Collect()
Start-Sleep -Seconds 2
reg.exe unload 'HKU\\DefUser' | Out-Null`
    : ''

  return `${head('Specialize · Bloatware mentesítés', 'specialize-bloatware.log')}
$targets = @(
${list}
)
Log ('Célzott csomagok: ' + $targets.Count)
$provisioned = @(Get-AppxProvisionedPackage -Online | Where-Object { $targets -contains $_.DisplayName })
Log ('Találat a lemezképben: ' + $provisioned.Count)
foreach ($pkg in $provisioned) {
  try {
    Remove-AppxProvisionedPackage -Online -PackageName $pkg.PackageName -ErrorAction Stop | Out-Null
    Log ('Eltávolítva: ' + $pkg.DisplayName)
  } catch {
    Log ('Nem sikerult: ' + $pkg.DisplayName + ' -> ' + $_.Exception.Message)
  }
}
${onedrive}
${foot}`
}

// ---------------------------------------------------------------------------
//  4. Wi-Fi (specialize)
// ---------------------------------------------------------------------------
function hexSsid(ssid) {
  return Array.from(new TextEncoder().encode(ssid))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

export function wifiProfileXml(w) {
  const security =
    w.auth === 'open'
      ? `      <authEncryption>
        <authentication>open</authentication>
        <encryption>none</encryption>
        <useOneX>false</useOneX>
      </authEncryption>`
      : `      <authEncryption>
        <authentication>${w.auth}</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${xe(w.password)}</keyMaterial>
      </sharedKey>`
  return `<?xml version="1.0" encoding="utf-8"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${xe(w.ssid)}</name>
  <SSIDConfig>
    <SSID>
      <hex>${hexSsid(w.ssid)}</hex>
      <name>${xe(w.ssid)}</name>
    </SSID>
    <nonBroadcast>${w.hidden ? 'true' : 'false'}</nonBroadcast>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
${security}
    </security>
  </MSM>
  <MacRandomization xmlns="http://www.microsoft.com/networking/WLAN/profile/v3">
    <enableRandomization>false</enableRandomization>
  </MacRandomization>
</WLANProfile>
`
}

export function wifiScript(cfg) {
  const w = cfg.wifi
  return `${head('Specialize · Wi-Fi profil importálása', 'specialize-wifi.log')}
$profile = '${inScripts('WiFi-Profile.xml')}'
try {
  Set-Service -Name WlanSvc -StartupType Automatic -ErrorAction Stop
  Start-Service -Name WlanSvc -ErrorAction Stop
  Start-Sleep -Seconds 3
} catch {
  Log ('WlanSvc: ' + $_.Exception.Message)
}
$out = netsh.exe wlan add profile filename="$profile" user=all 2>&1
Log ($out -join ' ')
try { netsh.exe wlan connect name='${q(w.ssid)}' 2>&1 | Out-Null } catch { }
${foot}`
}

// ---------------------------------------------------------------------------
//  5. Rejtett tálca ikonok (háttérfeladat, Schneegans-módszer)
// ---------------------------------------------------------------------------
export function trayIconsScript() {
  return `${head('Tálca · minden rejtett ikon megjelenítése', 'tray-icons.log')}
$root = 'HKCU:\\Control Panel\\NotifyIconSettings'
if (Test-Path -LiteralPath $root) {
  foreach ($item in Get-ChildItem -LiteralPath $root) {
    New-ItemProperty -LiteralPath $item.PSPath -Name 'IsPromoted' -PropertyType DWord -Value 1 -Force | Out-Null
  }
  Log 'IsPromoted beállítva minden értesítési ikonra.'
}
${foot}`
}

// ---------------------------------------------------------------------------
//  6. Winget appok (első bejelentkezés)
// ---------------------------------------------------------------------------
export function wingetScript(cfg) {
  const apps = cfg.winget.apps
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `  '${q(s)}'`)
    .join(',\n')
  return `${head('Első bejelentkezés · Winget alkalmazások', 'winget-apps.log')}
$apps = @(
${apps}
)
$perAppTimeout = ${Math.max(1, Number(cfg.winget.timeoutMin)) * 60}
$networkTimeout = 600

Log 'Várakozás a hálózatra...'
$deadline = (Get-Date).AddSeconds($networkTimeout)
$online = $false
while ((Get-Date) -lt $deadline) {
  if (Test-Connection -ComputerName '1.1.1.1' -Count 1 -Quiet -ErrorAction SilentlyContinue) { $online = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $online) { Log 'Nincs hálózat, a winget telepítés kihagyva.'; Stop-Transcript | Out-Null; exit 0 }
Log 'Hálózat OK.'

Log 'Várakozás a winget-re (App Installer regisztráció)...'
$wingetPath = $null
$deadline = (Get-Date).AddMinutes(10)
while ((Get-Date) -lt $deadline) {
  $cmd = Get-Command -Name winget.exe -ErrorAction SilentlyContinue
  if ($cmd) { $wingetPath = $cmd.Source; break }
  $candidate = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Microsoft\\WindowsApps') -Filter 'winget.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($candidate) { $wingetPath = $candidate.FullName; break }
  Start-Sleep -Seconds 10
}
if (-not $wingetPath) { Log 'A winget nem érhető el, kihagyva.'; Stop-Transcript | Out-Null; exit 0 }
Log ('winget: ' + $wingetPath)

& $wingetPath source update --disable-interactivity 2>&1 | Out-Null

foreach ($app in $apps) {
  Log ('Telepítés: ' + $app)
  $args = @('install', '--id', $app, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity', '--source', 'winget')
  try {
    $proc = Start-Process -FilePath $wingetPath -ArgumentList $args -PassThru -WindowStyle Hidden -ErrorAction Stop
    if (-not $proc.WaitForExit($perAppTimeout * 1000)) {
      Log ('Időtúllépés, megszakítva: ' + $app)
      try { $proc.Kill() } catch { }
    } else {
      Log ($app + ' -> kilépési kód: ' + $proc.ExitCode)
    }
  } catch {
    Log ('HIBA: ' + $app + ' -> ' + $_.Exception.Message)
  }
}
${foot}`
}

// ---------------------------------------------------------------------------
//  7. Office ODT (SetupComplete fázis)
// ---------------------------------------------------------------------------
export function officeConfigXml(o) {
  const excludes = o.excluded.map((a) => `      <ExcludeApp ID="${a}" />`).join('\n')
  return `<Configuration>
  <Add OfficeClientEdition="${o.arch}" Channel="${o.channel}" MigrateArch="TRUE">
    <Product ID="${o.product}">
      <Language ID="${o.language}" />
${excludes}
    </Product>
  </Add>
  <Property Name="SharedComputerLicensing" Value="0" />
  <Property Name="PinIconsToTaskbar" Value="FALSE" />
  <Property Name="SCLCacheOverride" Value="0" />
  <Property Name="AUTOACTIVATE" Value="1" />
  <Property Name="FORCEAPPSHUTDOWN" Value="TRUE" />
  <Property Name="DeviceBasedLicensing" Value="0" />
  <Updates Enabled="TRUE" />
  <RemoveMSI />
  <Display Level="None" AcceptEULA="TRUE" />
</Configuration>
`
}

export function officeScript() {
  return `${head('SetupComplete · Office telepítés (ODT)', 'office-install.log')}
$dir = '${inScripts('ODT')}'
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$setup = Join-Path $dir 'setup.exe'
$config = '${inScripts('Office-Configuration.xml')}'

Log 'Várakozás a hálózatra...'
$deadline = (Get-Date).AddMinutes(10)
$online = $false
while ((Get-Date) -lt $deadline) {
  if (Test-Connection -ComputerName '1.1.1.1' -Count 1 -Quiet -ErrorAction SilentlyContinue) { $online = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $online) { Log 'Nincs hálózat, Office kihagyva.'; Stop-Transcript | Out-Null; exit 0 }

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri 'https://officecdn.microsoft.com/pr/wsus/setup.exe' -OutFile $setup -UseBasicParsing -ErrorAction Stop
  Log 'Office Deployment Tool letöltve.'
} catch {
  Log ('Letöltési hiba: ' + $_.Exception.Message)
  Stop-Transcript | Out-Null
  exit 0
}

Log 'Csendes Office telepítés indul (ez sokáig tarthat).'
try {
  $proc = Start-Process -FilePath $setup -ArgumentList @('/configure', $config) -PassThru -WindowStyle Hidden -ErrorAction Stop
  if (-not $proc.WaitForExit(90 * 60 * 1000)) {
    Log 'Office telepítés időtúllépés.'
    try { $proc.Kill() } catch { }
  } else {
    Log ('Office kilépési kód: ' + $proc.ExitCode)
  }
} catch {
  Log ('Office HIBA: ' + $_.Exception.Message)
}
${foot}`
}

// ---------------------------------------------------------------------------
//  8. Domain join (első bejelentkezés)
// ---------------------------------------------------------------------------
export function domainScript(cfg) {
  const d = cfg.domain
  const ou = d.ou ? `
$ouPath = '${q(d.ou)}'` : `
$ouPath = $null`
  return `${head('Első bejelentkezés · Tartományhoz csatlakozás', 'domain-join.log')}
$domain = '${q(d.domain)}'
$user = '${q(d.user)}'
$secret = '${q(d.password)}'${ou}

Log ('Tartomány elérhetőségének ellenőrzése: ' + $domain)
$reachable = $false
for ($i = 0; $i -lt 12; $i++) {
  if (Test-Connection -ComputerName $domain -Count 1 -Quiet -ErrorAction SilentlyContinue) { $reachable = $true; break }
  Start-Sleep -Seconds 10
}
if (-not $reachable) {
  Log 'A tartomány nem érhető el (offline védelem) – csatlakozás kihagyva.'
  Stop-Transcript | Out-Null
  exit 0
}

$cred = New-Object System.Management.Automation.PSCredential($user, (ConvertTo-SecureString $secret -AsPlainText -Force))
$secret = $null
[GC]::Collect()

try {
  if ($ouPath) {
    Add-Computer -DomainName $domain -Credential $cred -OUPath $ouPath -Force -ErrorAction Stop
  } else {
    Add-Computer -DomainName $domain -Credential $cred -Force -ErrorAction Stop
  }
  Log 'Sikeres tartományi csatlakozás.'
} catch {
  Log ('Csatlakozás HIBA: ' + $_.Exception.Message)
  Stop-Transcript | Out-Null
  exit 0
}
${d.restart ? `
$seconds = 30
for ($s = $seconds; $s -ge 0; $s--) {
  Write-Progress -Activity 'Tartományi csatlakozás kész' -Status ('Újraindítás ' + $s + ' másodperc múlva...') -PercentComplete ((($seconds - $s) / $seconds) * 100)
  Start-Sleep -Seconds 1
}
Stop-Transcript | Out-Null
Restart-Computer -Force
exit 0` : foot}`
}

// ---------------------------------------------------------------------------
//  9. Windows Update (első bejelentkezés)
// ---------------------------------------------------------------------------
export function windowsUpdateScript(cfg) {
  return `${head('Első bejelentkezés · Windows Update', 'windows-update.log')}
Log 'Hálózat ellenőrzése...'
if (-not (Test-Connection -ComputerName '1.1.1.1' -Count 2 -Quiet -ErrorAction SilentlyContinue)) {
  Log 'Nincs hálózat, frissítés kihagyva.'
  Stop-Transcript | Out-Null
  exit 0
}

$done = $false
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Install-PackageProvider -Name NuGet -Force -Scope AllUsers -ErrorAction Stop | Out-Null
  Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
  Install-Module -Name PSWindowsUpdate -Force -Scope AllUsers -AllowClobber -ErrorAction Stop
  Import-Module PSWindowsUpdate -ErrorAction Stop
  Log 'PSWindowsUpdate betöltve, frissítések keresése...'
  Get-WindowsUpdate -AcceptAll -Install -IgnoreReboot -ErrorAction Stop | Out-String | Write-Host
  $done = $true
} catch {
  Log ('PSWindowsUpdate nem használható: ' + $_.Exception.Message)
}

if (-not $done) {
  Log 'Tartalék útvonal: UsoClient.'
  Start-Process -FilePath 'UsoClient.exe' -ArgumentList 'StartInteractiveScan' -WindowStyle Hidden -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 60
  Start-Process -FilePath 'UsoClient.exe' -ArgumentList 'StartDownload' -WindowStyle Hidden -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 60
  Start-Process -FilePath 'UsoClient.exe' -ArgumentList 'StartInstall' -WindowStyle Hidden -ErrorAction SilentlyContinue
}
${cfg.winUpdate.restart ? `
$seconds = 60
for ($s = $seconds; $s -ge 0; $s--) {
  Write-Progress -Activity 'Windows Update kész' -Status ('Újraindítás ' + $s + ' másodperc múlva...') -PercentComplete ((($seconds - $s) / $seconds) * 100)
  Start-Sleep -Seconds 1
}
Stop-Transcript | Out-Null
Restart-Computer -Force
exit 0` : foot}`
}

// ---------------------------------------------------------------------------
//  10. Karmester: első bejelentkezés
// ---------------------------------------------------------------------------
export function firstLogonScript(cfg) {
  const steps = []

  if (cfg.account.passwordNeverExpires) {
    steps.push(`Log 'Jelszó lejárat kikapcsolása.'
try {
  Set-LocalUser -Name '${q(cfg.account.name)}' -PasswordNeverExpires $true -ErrorAction Stop
  net.exe accounts /maxpwage:unlimited | Out-Null
  Log 'A jelszó soha nem jár le.'
} catch {
  Log ('Jelszó lejárat HIBA: ' + $_.Exception.Message)
}`)
  }

  if (cfg.ui.showAllTrayIcons) {
    steps.push(`Log 'Rejtett tálca ikonok háttérfeladat regisztrálása.'
try {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "${inScripts('Show-TrayIcons.ps1')}"'
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  Register-ScheduledTask -TaskName 'ShowAllTrayIcons' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Minden értesítési ikon megjelenítése a tálcán' -Force | Out-Null
  Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', '${inScripts('Show-TrayIcons.ps1')}') -WindowStyle Hidden
} catch {
  Log ('Tálca feladat HIBA: ' + $_.Exception.Message)
}`)
  }

  if (cfg.wifi.enabled) {
    steps.push(`Log 'Wi-Fi profil ellenőrzése (tartalék import).'
if (-not (netsh.exe wlan show profiles | Select-String -SimpleMatch '${q(cfg.wifi.ssid)}' -Quiet)) {
  netsh.exe wlan add profile filename="${inScripts('WiFi-Profile.xml')}" user=all 2>&1 | Out-Null
  netsh.exe wlan connect name='${q(cfg.wifi.ssid)}' 2>&1 | Out-Null
}`)
  }

  const run = (file, label) => `Log '${label}'
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '${file}') -Wait -WindowStyle Normal`

  if (cfg.winget.enabled) steps.push(run(inScripts('Winget-Apps.ps1'), 'Winget alkalmazások telepítése...'))
  if (cfg.winUpdate.enabled) steps.push(run(inScripts('Windows-Update.ps1'), 'Windows Update futtatása...'))
  if (cfg.domain.enabled) steps.push(run(inScripts('Domain-Join.ps1'), 'Tartományhoz csatlakozás...'))

  return `${head('Karmester · első bejelentkezés', 'first-logon.log')}
Log 'Első bejelentkezés utáni konfiguráció indul.'

${steps.join('\n\n')}

Log 'Explorer újraindítása a felület beállítások érvényesítéséhez.'
try { Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue } catch { }
${foot}`
}

// ---------------------------------------------------------------------------
//  11. SetupComplete.cmd
// ---------------------------------------------------------------------------
export function setupCompleteCmd(cfg) {
  const lines = [
    '@echo off',
    'setlocal',
    'set SD=' + SCRIPT_DIR,
    'echo [SetupComplete] %DATE% %TIME% >> "%SD%\\Logs\\setupcomplete.log"',
  ]
  if (cfg.office.enabled) {
    lines.push('if exist "%SD%\\Office-Install.ps1" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SD%\\Office-Install.ps1"')
  }
  lines.push('exit /b 0')
  return lines.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
//  Fájl készlet
// ---------------------------------------------------------------------------
export function buildFileSet(cfg) {
  const files = []
  const add = (name, content, bom = true) => files.push({ path: inScripts(name), content, bom })

  add('Specialize-Tweaks.ps1', tweaksScript(cfg))
  add('Specialize-StartMenu.ps1', startMenuScript(cfg))
  if (cfg.ui.startClean) add('LayoutModification.json', JSON.stringify({ pinnedList: [] }, null, 2) + '\n', false)
  if (cfg.bloatware.length || cfg.removeOneDrive) add('Specialize-Bloatware.ps1', bloatwareScript(cfg))
  if (cfg.wifi.enabled && cfg.wifi.ssid) {
    add('WiFi-Profile.xml', wifiProfileXml(cfg.wifi), false)
    add('Specialize-WiFi.ps1', wifiScript(cfg))
  }
  if (cfg.ui.showAllTrayIcons) add('Show-TrayIcons.ps1', trayIconsScript())
  if (cfg.winget.enabled) add('Winget-Apps.ps1', wingetScript(cfg))
  if (cfg.office.enabled) {
    add('Office-Configuration.xml', officeConfigXml(cfg.office), false)
    add('Office-Install.ps1', officeScript())
    add('SetupComplete.cmd', setupCompleteCmd(cfg), false)
  }
  if (cfg.domain.enabled) add('Domain-Join.ps1', domainScript(cfg))
  if (cfg.winUpdate.enabled) add('Windows-Update.ps1', windowsUpdateScript(cfg))
  add('First-Logon.ps1', firstLogonScript(cfg))

  return files
}
