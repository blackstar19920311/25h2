import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Building2, Check, Copy, Download, Eye, EyeOff, FileCode2, Gauge,
  HardDrive, LayoutDashboard, Monitor, Package, RefreshCw, RotateCcw, ShieldOff,
  Sparkles, Terminal, Trash2, UserCog, Wifi,
} from 'lucide-react'
import {
  BLOATWARE, EDITIONS, LOCALES, OFFICE_APPS, OFFICE_CHANNELS, OFFICE_PRODUCTS,
  TIMEZONES, WINGET_SUGGESTIONS,
} from './data/catalog.js'
import { buildUnattend } from './generator/xml.js'
import { buildFileSet } from './generator/scripts.js'

const STORE_KEY = 'autounattend-25h2'

const DEFAULTS = {
  edition: EDITIONS[0],
  productKey: EDITIONS[0].key,
  locale: 'hu-HU',
  timezone: 'Central European Standard Time',
  computerName: 'WIN11-25H2',
  autoLogonCount: 999,
  bypass: { tpm: true, secureBoot: true, ram: true, cpu: true, storage: true, nro: true },
  disk: { mode: 'auto', diskId: 0, diskSizeGB: 512, systemSizeGB: 150, efiMB: 300, recoveryMB: 1000, dataLabel: 'Adatok', cleanAll: false },
  account: { name: 'Rendszergazda', displayName: '', password: '', autoLogon: true, passwordNeverExpires: true },
  wifi: { enabled: false, ssid: '', password: '', hidden: false, auth: 'WPA2PSK' },
  ui: {
    startClean: true, hideWidgets: true, hideChat: true, hideTaskView: false, taskbarLeft: true,
    showAllTrayIcons: true, darkMode: true, showFileExt: true, showHidden: false,
    explorerThisPC: true, endTask: true, classicContextMenu: false, searchBox: 1,
  },
  tweaks: {
    disableUAC: true, disableTelemetry: true, disableBingSearch: true, disableCopilot: true,
    disableRecall: true, disableEdgeFRE: true, disableMouseAccel: true, ultimatePerformance: true,
    neverSleep: true, longPaths: true, disableFastStartup: false, disableHibernation: false,
    disableDefender: false,
  },
  bloatware: BLOATWARE.filter((b) => b.on).map((b) => b.id),
  removeOneDrive: true,
  winget: { enabled: false, apps: 'Mozilla.Firefox\n7zip.7zip\nNotepad++.Notepad++', timeoutMin: 10 },
  office: {
    enabled: false, product: 'O365ProPlusRetail', channel: 'Current', arch: '64',
    language: 'hu-hu', excluded: ['Access', 'Publisher', 'Groove', 'Lync', 'OneDrive', 'Bing'],
  },
  domain: { enabled: false, domain: '', ou: '', user: '', password: '', restart: true },
  winUpdate: { enabled: false, restart: true },
}

function loadCfg() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw)
    const out = { ...DEFAULTS, ...saved }
    for (const k of Object.keys(DEFAULTS)) {
      const d = DEFAULTS[k]
      if (d && typeof d === 'object' && !Array.isArray(d)) out[k] = { ...d, ...(saved[k] || {}) }
    }
    return out
  } catch {
    return DEFAULTS
  }
}

/* ------------------------------------------------------------------ atoms */
const Card = ({ id, icon, title, desc, children }) => (
  <section className="card" id={id}>
    <div className="card-head">
      <div className="card-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
    </div>
    {children}
  </section>
)

const Field = ({ label, hint, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint ? <span className="hint">{hint}</span> : null}
  </div>
)

const Toggle = ({ label, desc, on, onChange, danger }) => (
  <div
    className={'toggle' + (on ? ' on' : '') + (danger ? ' danger' : '')}
    role="switch"
    aria-checked={on}
    tabIndex={0}
    onClick={() => onChange(!on)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onChange(!on)
      }
    }}
  >
    <div className="sw" />
    <div>
      <b>{label}</b>
      {desc ? <small>{desc}</small> : null}
    </div>
  </div>
)

const Secret = ({ value, onChange, placeholder }) => {
  const [shown, setShown] = useState(true)
  return (
    <div className="pw-wrap">
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" title={shown ? 'Elrejtés' : 'Megjelenítés'} onClick={() => setShown(!shown)}>
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

const Seg = ({ value, options, onChange }) => (
  <div className="seg">
    {options.map((o) => (
      <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
)

/* --------------------------------------------------------- disk preview */
function DiskPreview({ disk }) {
  const total = Math.max(64, Number(disk.diskSizeGB) || 512)
  const efi = (Number(disk.efiMB) || 300) / 1024
  const msr = 16 / 1024
  const re = (Number(disk.recoveryMB) || 1000) / 1024
  const rest = Math.max(1, total - efi - msr - re)
  const win = disk.mode === 'autocd' ? Math.min(rest - 1, Math.max(40, Number(disk.systemSizeGB) || 150)) : rest
  const data = disk.mode === 'autocd' ? Math.max(0, rest - win) : 0
  const fmt = (gb) => (gb < 1 ? Math.round(gb * 1024) + ' MB' : gb.toFixed(gb < 10 ? 1 : 0) + ' GB')
  const parts = [
    { cls: 'p-efi', name: 'System (EFI)', size: efi, grow: Math.max(0.06, efi / total) },
    { cls: 'p-msr', name: 'MSR', size: msr, grow: 0.04 },
    { cls: 'p-win', name: 'Windows · C:', size: win, grow: win / total },
    ...(data > 0 ? [{ cls: 'p-data', name: (disk.dataLabel || 'Adatok') + ' · D:', size: data, grow: data / total }] : []),
    { cls: 'p-re', name: 'WinRE', size: re, grow: Math.max(0.07, re / total) },
  ]
  return (
    <>
      <div className="disk">
        {parts.map((p) => (
          <div key={p.name} className={'part ' + p.cls} style={{ flexGrow: p.grow, flexBasis: 0 }}>
            <b>{p.name}</b>
            <small>{fmt(p.size)}</small>
          </div>
        ))}
      </div>
      <div className="disk-legend">
        <span>Lemez {disk.diskId} · {total} GB</span>
        <span>GPT / UEFI</span>
        <span>WinRE a lemez végén (0x8000000000000001)</span>
        <span>Windows partíció ID: 3</span>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------- app */
export default function App() {
  const [cfg, setCfg] = useState(loadCfg)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(cfg))
    } catch { /* ignore */ }
  }, [cfg])

  const patch = (section, obj) => setCfg((c) => ({ ...c, [section]: { ...c[section], ...obj } }))
  const top = (obj) => setCfg((c) => ({ ...c, ...obj }))

  const xml = useMemo(() => {
    try {
      return buildUnattend(cfg)
    } catch (e) {
      return '<!-- Generálási hiba: ' + e.message + ' -->'
    }
  }, [cfg])

  const files = useMemo(() => {
    try {
      return buildFileSet(cfg)
    } catch {
      return []
    }
  }, [cfg])

  const lines = xml.split('\n').length
  const kb = (new TextEncoder().encode(xml).length / 1024).toFixed(1)

  const warnings = []
  if (!cfg.account.name.trim()) warnings.push('A helyi fiók neve nem lehet üres.')
  if (cfg.account.autoLogon && !cfg.account.password) warnings.push('Automatikus bejelentkezés jelszó nélkül: működik, de bárki hozzáfér a géphez.')
  if (cfg.account.name.trim().toLowerCase() === 'administrator') warnings.push('Az "Administrator" fenntartott név, a fiók létrehozása el fog bukni. Válassz mást.')
  if (cfg.wifi.enabled && !cfg.wifi.ssid.trim()) warnings.push('Wi-Fi be van kapcsolva, de nincs SSID megadva.')
  if (cfg.wifi.enabled && cfg.wifi.auth !== 'open' && cfg.wifi.password.length < 8) warnings.push('A WPA2/WPA3 jelszó legalább 8 karakter legyen.')
  if (cfg.winget.enabled && cfg.bloatware.includes('Microsoft.DesktopAppInstaller')) warnings.push('Az App Installer eltávolítása mellett a winget telepítés nem fog működni.')
  if (cfg.domain.enabled && (!cfg.domain.domain.trim() || !cfg.domain.user.trim())) warnings.push('A tartományi csatlakozáshoz tartománynév és felhasználó is kell.')
  if (cfg.disk.mode === 'autocd' && Number(cfg.disk.systemSizeGB) + 40 > Number(cfg.disk.diskSizeGB)) warnings.push('A rendszerpartíció túl nagy a megadott lemezmérethez.')
  if (!/^[A-Za-z0-9-]{1,15}$/.test(cfg.computerName)) warnings.push('A gépnév max 15 karakter lehet, csak betű, szám és kötőjel.')

  const download = () => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'autounattend.xml'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(xml)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  const toggleBloat = (id) =>
    setCfg((c) => ({
      ...c,
      bloatware: c.bloatware.includes(id) ? c.bloatware.filter((x) => x !== id) : [...c.bloatware, id],
    }))

  const nav = [
    ['sys', 'Rendszer', <Monitor size={15} key="i" />],
    ['bypass', 'Bypass-ok', <ShieldOff size={15} key="i" />],
    ['disk', 'Particionálás', <HardDrive size={15} key="i" />],
    ['account', 'Fiók és Wi-Fi', <UserCog size={15} key="i" />],
    ['shell', 'Start és tálca', <LayoutDashboard size={15} key="i" />],
    ['tweaks', 'Teljesítmény', <Gauge size={15} key="i" />],
    ['bloat', 'Bloatware', <Trash2 size={15} key="i" />],
    ['scripts', 'Szkriptek', <Terminal size={15} key="i" />],
    ['out', 'Kimenet', <FileCode2 size={15} key="i" />],
  ]

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div className="brand-text">
            <b>Autounattend</b>
            <span>Windows 11 · 25H2</span>
          </div>
        </div>
        <nav className="nav">
          {nav.map(([id, label, icon]) => (
            <a key={id} href={'#' + id}>{icon}{label}</a>
          ))}
        </nav>
        <div className="side-foot">
          Minden a böngészőben fut. Semmilyen jelszó nem hagyja el a gépet.
        </div>
      </aside>

      <main className="main">
        <header className="hero">
          <h1>Windows 11 <span>25H2</span> Autounattend Generátor</h1>
          <p>
            Rendszergazdai svájcibicska: hardver bypass-ok, diskpart particionálás külön WinRE
            partícióval, Wi-Fi beégetés, bloatware mentesítés a specialize fázisban, és egy komplett
            szkript-karmester az első bejelentkezésre. Egy gomb, egy fájl, nulla kérdés a telepítőben.
          </p>
          <div className="pills">
            <span className="pill">amd64</span>
            <span className="pill">GPT / UEFI</span>
            <span className="pill">windowsPE → specialize → oobeSystem</span>
            <span className="pill">{files.length} kihelyezett szkript</span>
            <span className="pill">nulla backend</span>
          </div>
        </header>

        <Card id="sys" icon={<Monitor size={17} />} title="Rendszer" desc="Kiállítás, kulcs, nyelv és gépnév.">
          <div className="grid g2">
            <Field label="Kiállítás" hint="A /IMAGE/NAME értékének egyeznie kell az ISO index nevével.">
              <select
                value={cfg.edition.image}
                onChange={(e) => {
                  const ed = EDITIONS.find((x) => x.image === e.target.value)
                  top({ edition: ed, productKey: ed.key })
                }}
              >
                {EDITIONS.map((ed) => <option key={ed.image} value={ed.image}>{ed.image}</option>)}
              </select>
            </Field>
            <Field label="Termékkulcs" hint="Üresen hagyva a telepítő kérdez. Alapértelmezés: generíkus telepítőkulcs.">
              <input type="text" value={cfg.productKey} onChange={(e) => top({ productKey: e.target.value.toUpperCase() })} spellCheck={false} />
            </Field>
            <Field label="Nyelv és kiosztás">
              <select value={cfg.locale} onChange={(e) => top({ locale: e.target.value })}>
                {LOCALES.map((l) => <option key={l.id} value={l.id}>{l.label} – {l.id}</option>)}
              </select>
            </Field>
            <Field label="Időzóna">
              <select value={cfg.timezone} onChange={(e) => top({ timezone: e.target.value })}>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Gépnév" hint="Max 15 karakter.">
              <input type="text" value={cfg.computerName} onChange={(e) => top({ computerName: e.target.value })} spellCheck={false} />
            </Field>
            <Field label="Automatikus bejelentkezések száma" hint="999 = gyakorlatilag korlátlan.">
              <input type="number" min={1} max={999} value={cfg.autoLogonCount} onChange={(e) => top({ autoLogonCount: Number(e.target.value) })} />
            </Field>
          </div>
        </Card>

        <Card id="bypass" icon={<ShieldOff size={17} />} title="Hardver és OOBE bypass-ok" desc="A LabConfig kulcsok a telepítő legelső pillanatában, még a kompatibilitás-ellenőrzés előtt kerülnek be.">
          <div className="grid g3">
            <Toggle label="TPM ellenőrzés" desc="BypassTPMCheck" on={cfg.bypass.tpm} onChange={(v) => patch('bypass', { tpm: v })} />
            <Toggle label="Secure Boot" desc="BypassSecureBootCheck" on={cfg.bypass.secureBoot} onChange={(v) => patch('bypass', { secureBoot: v })} />
            <Toggle label="RAM ellenőrzés" desc="BypassRAMCheck" on={cfg.bypass.ram} onChange={(v) => patch('bypass', { ram: v })} />
            <Toggle label="CPU ellenőrzés" desc="BypassCPUCheck + MoSetup" on={cfg.bypass.cpu} onChange={(v) => patch('bypass', { cpu: v })} />
            <Toggle label="Tárhely ellenőrzés" desc="BypassStorageCheck + BypassDiskCheck" on={cfg.bypass.storage} onChange={(v) => patch('bypass', { storage: v })} />
            <Toggle label="Online fiók kényszer" desc="BypassNRO – hálózat nélkül is átengedi az OOBE-t" on={cfg.bypass.nro} onChange={(v) => patch('bypass', { nro: v })} />
          </div>
        </Card>

        <Card id="disk" icon={<HardDrive size={17} />} title="Particionálás" desc="Diskpart szkript: EFI, MSR, Windows, opcionális adatpartíció, és WinRE a lemez végén.">
          <div className="grid g2" style={{ alignItems: 'end' }}>
            <Field label="Mód">
              <Seg
                value={cfg.disk.mode}
                onChange={(v) => patch('disk', { mode: v })}
                options={[
                  { value: 'auto', label: 'auto · csak C:' },
                  { value: 'autocd', label: 'autocd · C: + D:' },
                  { value: 'manual', label: 'kézi' },
                ]}
              />
            </Field>
            <Field label="Lemez sorszám (diskId)" hint="Az első fizikai lemez a 0.">
              <input type="number" min={0} max={16} value={cfg.disk.diskId} onChange={(e) => patch('disk', { diskId: Number(e.target.value) })} />
            </Field>
          </div>

          {cfg.disk.mode === 'manual' ? (
            <div className="note" style={{ marginTop: 14 }}>
              <AlertTriangle size={15} />
              Kézi mód: a telepítő megjeleníti a partíciós felületet, a lemezhez semmi nem nyúl. Minden más automatizáció (fiók, tweak, szkriptek) változatlanul fut.
            </div>
          ) : (
            <>
              <div className="grid g4" style={{ marginTop: 14 }}>
                <Field label="Lemez mérete (GB)" hint="Csak az előnézethez.">
                  <input type="number" min={64} value={cfg.disk.diskSizeGB} onChange={(e) => patch('disk', { diskSizeGB: Number(e.target.value) })} />
                </Field>
                <Field label="EFI partíció (MB)">
                  <input type="number" min={100} max={1024} value={cfg.disk.efiMB} onChange={(e) => patch('disk', { efiMB: Number(e.target.value) })} />
                </Field>
                <Field label="WinRE partíció (MB)" hint="Microsoft ajánlás: legalább 990 MB.">
                  <input type="number" min={500} max={4096} value={cfg.disk.recoveryMB} onChange={(e) => patch('disk', { recoveryMB: Number(e.target.value) })} />
                </Field>
                {cfg.disk.mode === 'autocd' ? (
                  <Field label="Rendszerpartíció (GB)">
                    <input type="number" min={40} value={cfg.disk.systemSizeGB} onChange={(e) => patch('disk', { systemSizeGB: Number(e.target.value) })} />
                  </Field>
                ) : (
                  <Field label="Windows partíció" hint="A maradék teljes hely.">
                    <input type="text" value="minden szabad hely" disabled />
                  </Field>
                )}
              </div>
              {cfg.disk.mode === 'autocd' && (
                <div className="grid g2" style={{ marginTop: 14 }}>
                  <Field label="Adatpartíció címkéje">
                    <input type="text" value={cfg.disk.dataLabel} onChange={(e) => patch('disk', { dataLabel: e.target.value })} />
                  </Field>
                </div>
              )}
              <div style={{ marginTop: 18 }}>
                <DiskPreview disk={cfg.disk} />
              </div>
              <div className="grid" style={{ marginTop: 16 }}>
                <Toggle
                  danger
                  label="clean all a clean helyett"
                  desc="Minden szektort nulláz. Egy 1 TB-os HDD-n órákig tart."
                  on={cfg.disk.cleanAll}
                  onChange={(v) => patch('disk', { cleanAll: v })}
                />
              </div>
            </>
          )}
        </Card>

        <Card id="account" icon={<UserCog size={17} />} title="Helyi fiók és Wi-Fi" desc="Rendszergazda fiók automatikus bejelentkezéssel, és hálózat már az első indításkor.">
          <div className="grid g2">
            <Field label="Fiók neve">
              <input type="text" value={cfg.account.name} onChange={(e) => patch('account', { name: e.target.value })} spellCheck={false} />
            </Field>
            <Field label="Megjelenített név" hint="Üresen a fiók nevét használja.">
              <input type="text" value={cfg.account.displayName} onChange={(e) => patch('account', { displayName: e.target.value })} />
            </Field>
            <Field label="Jelszó" hint="Láthatóan tároljuk az XML-ben (PlainText). Az elgépépelés itt telepítési katasztrófa, ezért alapértelmezésben látszik.">
              <Secret value={cfg.account.password} onChange={(v) => patch('account', { password: v })} placeholder="jelszó (üres = nincs jelszó)" />
            </Field>
            <div className="grid">
              <Toggle label="Automatikus bejelentkezés" desc="AutoLogon" on={cfg.account.autoLogon} onChange={(v) => patch('account', { autoLogon: v })} />
              <Toggle label="A jelszó soha nem jár le" desc="Set-LocalUser + net accounts" on={cfg.account.passwordNeverExpires} onChange={(v) => patch('account', { passwordNeverExpires: v })} />
            </div>
          </div>

          <div style={{ marginTop: 18 }} className="grid">
            <Toggle label="Wi-Fi beégetése" desc="WLAN profil importálás a specialize fázisban, hex SSID-vel (ékezetes név is működik)." on={cfg.wifi.enabled} onChange={(v) => patch('wifi', { enabled: v })} />
          </div>
          {cfg.wifi.enabled && (
            <div className="grid g2" style={{ marginTop: 14 }}>
              <Field label="SSID">
                <input type="text" value={cfg.wifi.ssid} onChange={(e) => patch('wifi', { ssid: e.target.value })} spellCheck={false} />
              </Field>
              <Field label="Biztonság">
                <select value={cfg.wifi.auth} onChange={(e) => patch('wifi', { auth: e.target.value })}>
                  <option value="WPA2PSK">WPA2-Personal (AES)</option>
                  <option value="WPA3SAE">WPA3-Personal (SAE)</option>
                  <option value="open">Nyílt hálózat</option>
                </select>
              </Field>
              {cfg.wifi.auth !== 'open' && (
                <Field label="Wi-Fi jelszó">
                  <Secret value={cfg.wifi.password} onChange={(v) => patch('wifi', { password: v })} placeholder="legalább 8 karakter" />
                </Field>
              )}
              <div className="grid">
                <Toggle label="Rejtett hálózat" desc="nonBroadcast" on={cfg.wifi.hidden} onChange={(v) => patch('wifi', { hidden: v })} />
              </div>
            </div>
          )}
        </Card>

        <Card id="shell" icon={<LayoutDashboard size={17} />} title="Start menü, tálca, Explorer" desc="GPO házirendek + LayoutModification.json, és minden beállítás a Default profilba kerül, tehát minden új felhasználó megkapja.">
          <div className="grid g3">
            <Toggle label="Start menü kipucolása" desc="Üres pinnedList, ajánlások és reklámok tiltása" on={cfg.ui.startClean} onChange={(v) => patch('ui', { startClean: v })} />
            <Toggle label="Widgets elrejtése" desc="AllowNewsAndInterests = 0" on={cfg.ui.hideWidgets} onChange={(v) => patch('ui', { hideWidgets: v })} />
            <Toggle label="Chat ikon elrejtése" desc="TaskbarMn = 0" on={cfg.ui.hideChat} onChange={(v) => patch('ui', { hideChat: v })} />
            <Toggle label="Feladatnézet elrejtése" desc="ShowTaskViewButton = 0" on={cfg.ui.hideTaskView} onChange={(v) => patch('ui', { hideTaskView: v })} />
            <Toggle label="Tálca ikonok balra" desc="TaskbarAl = 0" on={cfg.ui.taskbarLeft} onChange={(v) => patch('ui', { taskbarLeft: v })} />
            <Toggle label="Minden rejtett tálca ikon" desc="IsPromoted háttérfeladattal, bejelentkezéskor" on={cfg.ui.showAllTrayIcons} onChange={(v) => patch('ui', { showAllTrayIcons: v })} />
            <Toggle label="Dark mode" desc="AppsUseLightTheme = 0" on={cfg.ui.darkMode} onChange={(v) => patch('ui', { darkMode: v })} />
            <Toggle label="Fájlkiterjesztések" desc="HideFileExt = 0" on={cfg.ui.showFileExt} onChange={(v) => patch('ui', { showFileExt: v })} />
            <Toggle label="Rejtett fájlok" desc="Hidden = 1" on={cfg.ui.showHidden} onChange={(v) => patch('ui', { showHidden: v })} />
            <Toggle label="Explorer: Ez a gép" desc="LaunchTo = 1" on={cfg.ui.explorerThisPC} onChange={(v) => patch('ui', { explorerThisPC: v })} />
            <Toggle label="Feladat bezárása a tálcáról" desc="TaskbarEndTask = 1" on={cfg.ui.endTask} onChange={(v) => patch('ui', { endTask: v })} />
            <Toggle label="Klasszikus jobb klikk menü" desc="Windows 10 stílusú context menü" on={cfg.ui.classicContextMenu} onChange={(v) => patch('ui', { classicContextMenu: v })} />
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Kereső a tálcán">
              <Seg
                value={cfg.ui.searchBox}
                onChange={(v) => patch('ui', { searchBox: v })}
                options={[
                  { value: 0, label: 'elrejtve' },
                  { value: 1, label: 'csak ikon' },
                  { value: 2, label: 'ikon + címke' },
                  { value: 3, label: 'teljes keresőmező' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card id="tweaks" icon={<Gauge size={17} />} title="Teljesítmény és adatvédelem" desc="A klasszikus rendszergazda-csomag: UAC, telemetria, egérgyorsítás, energiaséma.">
          <div className="grid g3">
            <Toggle label="UAC kikapcsolása" desc="EnableLUA = 0 (legmélyebb szint)" on={cfg.tweaks.disableUAC} onChange={(v) => patch('tweaks', { disableUAC: v })} />
            <Toggle label="Telemetria tiltása" desc="DataCollection házirend + DiagTrack leállítva" on={cfg.tweaks.disableTelemetry} onChange={(v) => patch('tweaks', { disableTelemetry: v })} />
            <Toggle label="Bing a keresőben" desc="Web és Cortana javaslatok tiltása" on={cfg.tweaks.disableBingSearch} onChange={(v) => patch('tweaks', { disableBingSearch: v })} />
            <Toggle label="Copilot tiltása" desc="TurnOffWindowsCopilot = 1" on={cfg.tweaks.disableCopilot} onChange={(v) => patch('tweaks', { disableCopilot: v })} />
            <Toggle label="Recall / Click to Do tiltása" desc="DisableAIDataAnalysis = 1" on={cfg.tweaks.disableRecall} onChange={(v) => patch('tweaks', { disableRecall: v })} />
            <Toggle label="Edge üdvözlőképernyő ki" desc="HideFirstRunExperience = 1" on={cfg.tweaks.disableEdgeFRE} onChange={(v) => patch('tweaks', { disableEdgeFRE: v })} />
            <Toggle label="Egérgyorsítás ki" desc="MouseSpeed = 0" on={cfg.tweaks.disableMouseAccel} onChange={(v) => patch('tweaks', { disableMouseAccel: v })} />
            <Toggle label="Ultimate Performance" desc="Maximális teljesítmény energiaséma aktiválása" on={cfg.tweaks.ultimatePerformance} onChange={(v) => patch('tweaks', { ultimatePerformance: v })} />
            <Toggle label="Soha ne aludjon el" desc="standby / monitor timeout = 0" on={cfg.tweaks.neverSleep} onChange={(v) => patch('tweaks', { neverSleep: v })} />
            <Toggle label="Hosszú útvonalak" desc="LongPathsEnabled = 1" on={cfg.tweaks.longPaths} onChange={(v) => patch('tweaks', { longPaths: v })} />
            <Toggle label="Gyors indulás ki" desc="HiberbootEnabled = 0" on={cfg.tweaks.disableFastStartup} onChange={(v) => patch('tweaks', { disableFastStartup: v })} />
            <Toggle label="Hibernálás ki" desc="powercfg /hibernate off" on={cfg.tweaks.disableHibernation} onChange={(v) => patch('tweaks', { disableHibernation: v })} />
            <Toggle danger label="Defender házirend tiltás" desc="A Tamper Protection ezt jellemzően visszaírja. Csak labor gépre." on={cfg.tweaks.disableDefender} onChange={(v) => patch('tweaks', { disableDefender: v })} />
          </div>
        </Card>

        <Card id="bloat" icon={<Trash2 size={17} />} title="Bloatware mentesítés" desc="A specialize fázisban a lemezképből esnek ki, tehát soha nem is települnek. Egy lekérés, egy listás szűrés: pillanatok alatt lefut.">
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn ghost" onClick={() => top({ bloatware: BLOATWARE.map((b) => b.id) })}>Mind</button>
            <button className="btn ghost" onClick={() => top({ bloatware: [] })}>Egyik sem</button>
            <button className="btn ghost" onClick={() => top({ bloatware: BLOATWARE.filter((b) => b.on).map((b) => b.id) })}>
              <RotateCcw size={14} /> Ajánlott
            </button>
            <span className="hint" style={{ marginLeft: 'auto' }}>{cfg.bloatware.length} / {BLOATWARE.length} kijelölve</span>
          </div>
          <div className="chips">
            {BLOATWARE.map((b) => {
              const on = cfg.bloatware.includes(b.id)
              return (
                <div key={b.id} className={'chip' + (on ? ' on' : '')} onClick={() => toggleBloat(b.id)} title={b.id}>
                  <div className="box">{on ? <Check size={11} strokeWidth={3.5} /> : null}</div>
                  <span>{b.label}</span>
                </div>
              )
            })}
          </div>
          <div className="grid" style={{ marginTop: 16 }}>
            <Toggle label="OneDrive telepítő eltávolítása" desc="OneDriveSetup.exe + Run bejegyzés a Default profilból" on={cfg.removeOneDrive} onChange={(v) => top({ removeOneDrive: v })} />
          </div>
        </Card>

        <Card id="scripts" icon={<Terminal size={17} />} title="Egyedi szkriptek · a karmester" desc="Minden szkript a C:\Windows\Setup\Scripts mappába kerül, transcript naplóval a Logs alkönyvtárban.">
          <div className="grid">
            <Toggle label="Winget alkalmazások" desc="Első bejelentkezéskor, ping alapú hálózat-várással és appokénti időkorláttal" on={cfg.winget.enabled} onChange={(v) => patch('winget', { enabled: v })} />
          </div>
          {cfg.winget.enabled && (
            <div className="grid g2" style={{ marginTop: 14 }}>
              <Field label="Winget azonosítók (egy per sor)">
                <textarea value={cfg.winget.apps} onChange={(e) => patch('winget', { apps: e.target.value })} spellCheck={false} />
              </Field>
              <div>
                <Field label="Időkorlát alkalmazásonként (perc)">
                  <input type="number" min={1} max={90} value={cfg.winget.timeoutMin} onChange={(e) => patch('winget', { timeoutMin: Number(e.target.value) })} />
                </Field>
                <div className="hint" style={{ marginTop: 12, marginBottom: 6 }}>Gyors hozzáadás:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {WINGET_SUGGESTIONS.map((s) => (
                    <span
                      key={s}
                      className="pill"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const cur = cfg.winget.apps.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
                        if (!cur.includes(s)) patch('winget', { apps: [...cur, s].join('\n') })
                      }}
                    >
                      + {s.split('.').pop()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid" style={{ marginTop: 18 }}>
            <Toggle label="Office telepítés (ODT)" desc="Külön SetupComplete fázisban, csendben – így nem akasztja ki a Start menüt" on={cfg.office.enabled} onChange={(v) => patch('office', { enabled: v })} />
          </div>
          {cfg.office.enabled && (
            <>
              <div className="grid g4" style={{ marginTop: 14 }}>
                <Field label="Termék">
                  <select value={cfg.office.product} onChange={(e) => patch('office', { product: e.target.value })}>
                    {OFFICE_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label="Csatorna">
                  <select value={cfg.office.channel} onChange={(e) => patch('office', { channel: e.target.value })}>
                    {OFFICE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Architektúra">
                  <select value={cfg.office.arch} onChange={(e) => patch('office', { arch: e.target.value })}>
                    <option value="64">64 bit</option>
                    <option value="32">32 bit</option>
                  </select>
                </Field>
                <Field label="Nyelv">
                  <input type="text" value={cfg.office.language} onChange={(e) => patch('office', { language: e.target.value })} spellCheck={false} />
                </Field>
              </div>
              <div className="hint" style={{ margin: '14px 0 6px' }}>Kihagyott alkalmazások:</div>
              <div className="chips">
                {OFFICE_APPS.map((a) => {
                  const on = cfg.office.excluded.includes(a)
                  return (
                    <div
                      key={a}
                      className={'chip' + (on ? ' on' : '')}
                      onClick={() =>
                        patch('office', {
                          excluded: on ? cfg.office.excluded.filter((x) => x !== a) : [...cfg.office.excluded, a],
                        })
                      }
                    >
                      <div className="box">{on ? <Check size={11} strokeWidth={3.5} /> : null}</div>
                      <span>{a}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="grid g2" style={{ marginTop: 18 }}>
            <Toggle label="Tartományhoz csatlakozás" desc="Offline védelem, majd grafikus visszaszámlálós újraindítás" on={cfg.domain.enabled} onChange={(v) => patch('domain', { enabled: v })} />
            <Toggle label="Windows Update futtatása" desc="PSWindowsUpdate, UsoClient tartalékkal" on={cfg.winUpdate.enabled} onChange={(v) => patch('winUpdate', { enabled: v })} />
          </div>
          {cfg.domain.enabled && (
            <div className="grid g2" style={{ marginTop: 14 }}>
              <Field label="Tartomány (FQDN)">
                <input type="text" value={cfg.domain.domain} onChange={(e) => patch('domain', { domain: e.target.value })} placeholder="ceg.local" spellCheck={false} />
              </Field>
              <Field label="OU útvonal" hint="Opcionális, pl. OU=PCs,DC=ceg,DC=local">
                <input type="text" value={cfg.domain.ou} onChange={(e) => patch('domain', { ou: e.target.value })} spellCheck={false} />
              </Field>
              <Field label="Csatlakoztató felhasználó">
                <input type="text" value={cfg.domain.user} onChange={(e) => patch('domain', { user: e.target.value })} placeholder="CEG\\joiner" spellCheck={false} />
              </Field>
              <Field label="Jelszó">
                <Secret value={cfg.domain.password} onChange={(v) => patch('domain', { password: v })} placeholder="tartományi jelszó" />
              </Field>
              <div className="grid">
                <Toggle label="Újraindítás csatlakozás után" desc="30 másodperces visszaszámláló" on={cfg.domain.restart} onChange={(v) => patch('domain', { restart: v })} />
              </div>
            </div>
          )}
          {cfg.winUpdate.enabled && (
            <div className="grid" style={{ marginTop: 14 }}>
              <Toggle label="Újraindítás a frissítések után" desc="60 másodperces visszaszámláló" on={cfg.winUpdate.restart} onChange={(v) => patch('winUpdate', { restart: v })} />
            </div>
          )}
        </Card>

        <Card id="out" icon={<FileCode2 size={17} />} title="Kimenet" desc="Ez kerül a telepítő USB gyökerébe autounattend.xml néven.">
          {warnings.length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {warnings.map((w) => (
                <div className="note warn" key={w}>
                  <AlertTriangle size={15} />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="hint" style={{ marginBottom: 8 }}>Kihelyezett fájlok a célgépen:</div>
          <div className="file-list">
            {files.map((f) => (
              <div key={f.path}>
                <Package size={13} /> {f.path.split('\\').pop()}
              </div>
            ))}
          </div>

          <details className="preview" style={{ marginTop: 18 }}>
            <summary>XML előnézet ({lines} sor)</summary>
            <pre className="xml">{xml}</pre>
          </details>
        </Card>
      </main>

      <div className="dock">
        <div className="dock-in">
          <div className="stats">
            <div><b>{lines}</b>sor</div>
            <div><b>{kb}</b>KB</div>
            <div><b>{files.length}</b>szkript</div>
            <div><b>{cfg.bloatware.length}</b>bloat cél</div>
            <div><b>{cfg.disk.mode}</b>lemez mód</div>
          </div>
          <div className="dock-actions">
            <button className="btn ghost" onClick={() => setCfg(DEFAULTS)} title="Alapértelmezések visszaállítása">
              <RefreshCw size={15} /> Alaphelyzet
            </button>
            <button className="btn" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Vágólapon' : 'Másolás'}
            </button>
            <button className="btn primary" onClick={download} disabled={warnings.length > 0 && !cfg.account.name.trim()}>
              <Download size={16} /> XML generálása
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
