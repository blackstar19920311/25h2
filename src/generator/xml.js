// ============================================================================
//  autounattend.xml motor – Windows 11 25H2 (amd64)
//
//  Fázisok:
//    windowsPE   – nyelv, hardver bypass-ok, diskpart particionálás, image
//    specialize  – gépnév, időzóna, szkriptek kihelyezése + futtatása
//    oobeSystem  – helyi fiók, automatikus bejelentkezés, OOBE átugrása
//                  és az első bejelentkezés utáni karmester
// ============================================================================

import { buildFileSet, SCRIPT_DIR, inScripts } from './scripts.js'
import { LOCALES } from '../data/catalog.js'

const PK = 'publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"'
const CHUNK = 600

export const xe = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function utf8Bytes(text, bom) {
  const body = new TextEncoder().encode(text)
  if (!bom) return body
  const out = new Uint8Array(body.length + 3)
  out[0] = 0xef
  out[1] = 0xbb
  out[2] = 0xbf
  out.set(body, 3)
  return out
}

function toBase64(bytes) {
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step))
  }
  return btoa(bin)
}

function slice(str, size) {
  const out = []
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------------------
//  Egy fájl kiírása a célrendszerre: base64 darabok -> certutil -decode
// ---------------------------------------------------------------------------
function fileWriteCommands(file) {
  const name = file.path.split('\\').pop()
  const tmp = file.path + '.b64'
  const parts = slice(toBase64(utf8Bytes(file.content, file.bom)), CHUNK)
  const cmds = [[`cmd.exe /c if exist "${tmp}" del /q "${tmp}"`, `${name} · előkészítés`]]
  parts.forEach((part, i) => {
    cmds.push([`cmd.exe /c >>"${tmp}" echo ${part}`, `${name} · ${i + 1}/${parts.length}`])
  })
  cmds.push([`cmd.exe /c certutil.exe -f -decode "${tmp}" "${file.path}" >nul`, `${name} · dekódolás`])
  cmds.push([`cmd.exe /c del /q "${tmp}"`, `${name} · takarítás`])
  return cmds
}

function runSynchronous(cmds, pad) {
  const i = ' '.repeat(pad)
  const body = cmds
    .map(([path, desc], idx) => {
      return `${i}  <RunSynchronousCommand wcm:action="add">
${i}    <Order>${idx + 1}</Order>
${i}    <Path>${xe(path)}</Path>
${i}    <Description>${xe(desc)}</Description>
${i}    <WillReboot>Never</WillReboot>
${i}  </RunSynchronousCommand>`
    })
    .join('\n')
  return `${i}<RunSynchronous>
${body}
${i}</RunSynchronous>`
}

// ---------------------------------------------------------------------------
//  Diskpart szkript
// ---------------------------------------------------------------------------
export function diskpartLines(d) {
  const L = []
  L.push(`select disk ${Number(d.diskId)}`)
  L.push(d.cleanAll ? 'clean all' : 'clean')
  L.push('convert gpt')
  L.push(`create partition efi size=${Number(d.efiMB)}`)
  L.push('format quick fs=fat32 label="System"')
  L.push('assign letter=S')
  L.push('create partition msr size=16')
  if (d.mode === 'autocd') {
    L.push(`create partition primary size=${Math.round(Number(d.systemSizeGB) * 1024)}`)
    L.push('format quick fs=ntfs label="Windows"')
    L.push('assign letter=W')
    L.push('create partition primary')
    L.push(`shrink minimum=${Number(d.recoveryMB)}`)
    L.push(`format quick fs=ntfs label="${d.dataLabel}"`)
    L.push('assign letter=D')
  } else {
    L.push('create partition primary')
    L.push(`shrink minimum=${Number(d.recoveryMB)}`)
    L.push('format quick fs=ntfs label="Windows"')
    L.push('assign letter=W')
  }
  L.push('create partition primary')
  L.push('format quick fs=ntfs label="Recovery"')
  L.push('set id="de94bba4-06d1-4d40-a16a-bfd50179d6ac"')
  L.push('gpt attributes=0x8000000000000001')
  L.push('exit')
  return L
}

export function windowsPartitionId(mode) {
  return 3 // 1: EFI, 2: MSR, 3: Windows, (4: Adatok), utolsó: WinRE
}

// ---------------------------------------------------------------------------
//  Fő generátor
// ---------------------------------------------------------------------------
export function buildUnattend(cfg) {
  const loc = LOCALES.find((l) => l.id === cfg.locale) || LOCALES[0]
  const files = buildFileSet(cfg)

  // ---------------- windowsPE ----------------
  const peCmds = []
  const lab = 'reg.exe add HKLM\\SYSTEM\\Setup\\LabConfig /v'
  const b = cfg.bypass
  if (b.tpm) peCmds.push([`${lab} BypassTPMCheck /t REG_DWORD /d 1 /f`, 'Bypass: TPM'])
  if (b.secureBoot) peCmds.push([`${lab} BypassSecureBootCheck /t REG_DWORD /d 1 /f`, 'Bypass: Secure Boot'])
  if (b.ram) peCmds.push([`${lab} BypassRAMCheck /t REG_DWORD /d 1 /f`, 'Bypass: RAM'])
  if (b.cpu) peCmds.push([`${lab} BypassCPUCheck /t REG_DWORD /d 1 /f`, 'Bypass: CPU'])
  if (b.storage) {
    peCmds.push([`${lab} BypassStorageCheck /t REG_DWORD /d 1 /f`, 'Bypass: tárhely'])
    peCmds.push([`${lab} BypassDiskCheck /t REG_DWORD /d 1 /f`, 'Bypass: DiskCheck'])
  }
  if (b.tpm || b.cpu) {
    peCmds.push([
      'reg.exe add HKLM\\SYSTEM\\Setup\\MoSetup /v AllowUpgradesWithUnsupportedTPMOrCPU /t REG_DWORD /d 1 /f',
      'Bypass: frissítés nem támogatott TPM/CPU esetén',
    ])
  }

  const auto = cfg.disk.mode !== 'manual'
  if (auto) {
    const lines = diskpartLines(cfg.disk)
    lines.forEach((line, i) => {
      const op = i === 0 ? '>' : '>>'
      peCmds.push([`cmd.exe /c ${op}X:\\diskpart.txt echo ${line}`, `Diskpart szkript ${i + 1}/${lines.length}`])
    })
    peCmds.push(['cmd.exe /c diskpart.exe /s X:\\diskpart.txt >X:\\diskpart.log', 'Lemez particionálása (diskpart)'])
  }

  const edition = cfg.edition
  const imageInstall = auto
    ? `      <ImageInstall>
        <OSImage>
          <InstallFrom>
            <MetaData wcm:action="add">
              <Key>/IMAGE/NAME</Key>
              <Value>${xe(edition.image)}</Value>
            </MetaData>
          </InstallFrom>
          <InstallTo>
            <DiskID>${Number(cfg.disk.diskId)}</DiskID>
            <PartitionID>${windowsPartitionId(cfg.disk.mode)}</PartitionID>
          </InstallTo>
          <WillShowUI>OnError</WillShowUI>
          <InstallToAvailablePartition>false</InstallToAvailablePartition>
        </OSImage>
      </ImageInstall>
`
    : ''

  const productKey = cfg.productKey
    ? `        <ProductKey>
          <Key>${xe(cfg.productKey)}</Key>
          <WillShowUI>Never</WillShowUI>
        </ProductKey>
`
    : ''

  const windowsPE = `  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" ${PK}>
      <SetupUILanguage>
        <UILanguage>${loc.id}</UILanguage>
        <WillShowUI>Never</WillShowUI>
      </SetupUILanguage>
      <InputLocale>${loc.input}</InputLocale>
      <SystemLocale>${loc.id}</SystemLocale>
      <UILanguage>${loc.id}</UILanguage>
      <UILanguageFallback>en-US</UILanguageFallback>
      <UserLocale>${loc.id}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" ${PK}>
${runSynchronous(peCmds, 6)}
${imageInstall}      <UserData>
${productKey}        <AcceptEula>true</AcceptEula>
        <FullName>${xe(cfg.account.displayName || cfg.account.name)}</FullName>
        <Organization />
      </UserData>
      <EnableFirewall>true</EnableFirewall>
      <Diagnostics>
        <OptIn>false</OptIn>
      </Diagnostics>
      <DynamicUpdate>
        <Enable>false</Enable>
        <WillShowUI>Never</WillShowUI>
      </DynamicUpdate>
    </component>
  </settings>`

  // ---------------- specialize ----------------
  const spCmds = [[`cmd.exe /c if not exist "${SCRIPT_DIR}" md "${SCRIPT_DIR}"`, 'Szkript mappa létrehozása']]
  if (cfg.bypass.nro) {
    spCmds.push([
      'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE" /v BypassNRO /t REG_DWORD /d 1 /f',
      'BypassNRO: OOBE hálózat nélkül',
    ])
    spCmds.push([
      'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE" /v BypassNRODevices /t REG_DWORD /d 1 /f',
      'BypassNRO (eszköz szint)',
    ])
  }
  files.forEach((f) => fileWriteCommands(f).forEach((c) => spCmds.push(c)))

  const psRun = (file) => `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${file}"`
  spCmds.push([psRun(inScripts('Specialize-Tweaks.ps1')), 'Tweak-ek és házirendek'])
  spCmds.push([psRun(inScripts('Specialize-StartMenu.ps1')), 'Start menü és tálca takarítás'])
  if (files.some((f) => f.path.endsWith('Specialize-Bloatware.ps1'))) {
    spCmds.push([psRun(inScripts('Specialize-Bloatware.ps1')), 'Bloatware mentesítés'])
  }
  if (files.some((f) => f.path.endsWith('Specialize-WiFi.ps1'))) {
    spCmds.push([psRun(inScripts('Specialize-WiFi.ps1')), 'Wi-Fi profil importálása'])
  }

  const specialize = `  <settings pass="specialize">
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" ${PK}>
      <ComputerName>${xe(cfg.computerName)}</ComputerName>
      <TimeZone>${xe(cfg.timezone)}</TimeZone>
      <ShowWindowsLive>false</ShowWindowsLive>
      <RegisteredOwner>${xe(cfg.account.displayName || cfg.account.name)}</RegisteredOwner>
      <RegisteredOrganization />
    </component>
    <component name="Microsoft-Windows-Security-SPP-UX" processorArchitecture="amd64" ${PK}>
      <SkipAutoActivation>true</SkipAutoActivation>
    </component>
    <component name="Microsoft-Windows-SQMApi" processorArchitecture="amd64" ${PK}>
      <CEIPEnabled>0</CEIPEnabled>
    </component>
    <component name="Microsoft-Windows-Deployment" processorArchitecture="amd64" ${PK}>
${runSynchronous(spCmds, 6)}
    </component>
  </settings>`

  // ---------------- oobeSystem ----------------
  const a = cfg.account
  const pwd = a.password
    ? `            <Password>
              <Value>${xe(a.password)}</Value>
              <PlainText>true</PlainText>
            </Password>
`
    : ''
  const autoLogon = a.autoLogon
    ? `      <AutoLogon>
        <Enabled>true</Enabled>
        <LogonCount>${Number(cfg.autoLogonCount)}</LogonCount>
        <Username>${xe(a.name)}</Username>
        <Password>
          <Value>${xe(a.password)}</Value>
          <PlainText>true</PlainText>
        </Password>
      </AutoLogon>
`
    : ''

  const flc = [[psRun(inScripts('First-Logon.ps1')), 'Karmester: első bejelentkezés utáni konfiguráció']]
  const firstLogon = `      <FirstLogonCommands>
${flc
    .map(
      ([cmd, desc], i) => `        <SynchronousCommand wcm:action="add">
          <Order>${i + 1}</Order>
          <CommandLine>${xe(cmd)}</CommandLine>
          <Description>${xe(desc)}</Description>
          <RequiresUserInput>false</RequiresUserInput>
        </SynchronousCommand>`
    )
    .join('\n')}
      </FirstLogonCommands>
`

  const oobeSystem = `  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" ${PK}>
      <InputLocale>${loc.input}</InputLocale>
      <SystemLocale>${loc.id}</SystemLocale>
      <UILanguage>${loc.id}</UILanguage>
      <UILanguageFallback>en-US</UILanguageFallback>
      <UserLocale>${loc.id}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" ${PK}>
      <UserAccounts>
        <LocalAccounts>
          <LocalAccount wcm:action="add">
            <Name>${xe(a.name)}</Name>
            <DisplayName>${xe(a.displayName || a.name)}</DisplayName>
            <Group>Administrators</Group>
${pwd}          </LocalAccount>
        </LocalAccounts>
      </UserAccounts>
${autoLogon}      <OOBE>
        <HideEULAPage>true</HideEULAPage>
        <HideOEMRegistrationScreen>true</HideOEMRegistrationScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>
        <HideLocalAccountScreen>true</HideLocalAccountScreen>
        <HideWirelessSetupInOOBE>${cfg.wifi.enabled ? 'true' : 'false'}</HideWirelessSetupInOOBE>
        <ProtectYourPC>3</ProtectYourPC>
        <NetworkLocation>${cfg.domain.enabled ? 'Work' : 'Home'}</NetworkLocation>
        <SkipMachineOOBE>true</SkipMachineOOBE>
        <SkipUserOOBE>true</SkipUserOOBE>
      </OOBE>
      <TimeZone>${xe(cfg.timezone)}</TimeZone>
${firstLogon}    </component>
  </settings>`

  const summary = [
    `Kiállítás: ${edition.image}`,
    `Nyelv: ${loc.id} (${loc.input})`,
    `Particionálás: ${cfg.disk.mode}`,
    `Fiók: ${cfg.account.name}${cfg.account.autoLogon ? ' (auto login)' : ''}`,
    `Bloatware célok: ${cfg.bloatware.length}`,
    `Kihelyezett szkriptek: ${files.length}`,
  ]

  return `<?xml version="1.0" encoding="utf-8"?>
<!--
  autounattend.xml · Windows 11 25H2 (amd64)
  Generálva: ${new Date().toISOString()}
  Generátor: Windows 11 25H2 Autounattend Generátor

${summary.map((s) => '  ' + s).join('\n')}

  Használat: másold ezt a fájlt a telepítő USB / ISO gyökerébe.
-->
<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${windowsPE}
${specialize}
${oobeSystem}
</unattend>
`
}
