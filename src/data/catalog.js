// ============================================================================
//  Katalógus: kiállítások, nyelvek, időzónák, bloatware, Office
// ============================================================================

export const EDITIONS = [
  { image: 'Windows 11 Pro', key: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' },
  { image: 'Windows 11 Home', key: 'YTMG3-N6DKC-DKB77-7M9GH-8HVX7' },
  { image: 'Windows 11 Home Single Language', key: 'BT79Q-G7N6G-PGBYW-4YWX6-6F4BT' },
  { image: 'Windows 11 Pro N', key: 'MH37W-N47XK-V7XM9-C7227-GCQG9' },
  { image: 'Windows 11 Pro for Workstations', key: 'DXG7C-N36C4-C4HTG-X4T3X-2YV77' },
  { image: 'Windows 11 Pro Education', key: '6TP4R-GNPTD-KYYHQ-7B7DP-J447Y' },
  { image: 'Windows 11 Education', key: 'NW6C2-QMPVW-D7KKK-3GKT6-VCFB2' },
  { image: 'Windows 11 Enterprise', key: 'NPPR9-FWDCX-D2C8J-H872K-2YT43' },
]

export const LOCALES = [
  { id: 'hu-HU', label: 'Magyar (Magyarország)', input: '040e:0000040e' },
  { id: 'en-US', label: 'English (United States)', input: '0409:00000409' },
  { id: 'en-GB', label: 'English (United Kingdom)', input: '0809:00000809' },
  { id: 'de-DE', label: 'Deutsch (Deutschland)', input: '0407:00000407' },
  { id: 'de-AT', label: 'Deutsch (Österreich)', input: '0c07:00000407' },
  { id: 'sk-SK', label: 'Slovenčina', input: '041b:0000041b' },
  { id: 'ro-RO', label: 'Română', input: '0418:00000418' },
  { id: 'hr-HR', label: 'Hrvatski', input: '041a:0000041a' },
  { id: 'sr-Latn-RS', label: 'Srpski (latinica)', input: '241a:0000081a' },
  { id: 'pl-PL', label: 'Polski', input: '0415:00000415' },
  { id: 'cs-CZ', label: 'Čeština', input: '0405:00000405' },
]

export const TIMEZONES = [
  'Central European Standard Time',
  'Central Europe Standard Time',
  'W. Europe Standard Time',
  'Romance Standard Time',
  'GTB Standard Time',
  'E. Europe Standard Time',
  'GMT Standard Time',
  'UTC',
  'Eastern Standard Time',
  'Central Standard Time',
  'Pacific Standard Time',
]

// DisplayName-ek a Get-AppxProvisionedPackage kimenetéből (Windows 11 25H2)
export const BLOATWARE = [
  { id: 'Microsoft.BingNews', label: 'Hírek (Bing News)', on: true },
  { id: 'Microsoft.BingWeather', label: 'Időjárás (Bing Weather)', on: true },
  { id: 'Microsoft.BingSearch', label: 'Web Search (Bing)', on: true },
  { id: 'Microsoft.Copilot', label: 'Copilot', on: true },
  { id: 'Microsoft.549981C3F5F10', label: 'Cortana', on: true },
  { id: 'Clipchamp.Clipchamp', label: 'Clipchamp', on: true },
  { id: 'Microsoft.GamingApp', label: 'Xbox alkalmazás', on: true },
  { id: 'Microsoft.Xbox.TCUI', label: 'Xbox TCUI', on: true },
  { id: 'Microsoft.XboxGameOverlay', label: 'Xbox Game Overlay', on: true },
  { id: 'Microsoft.XboxGamingOverlay', label: 'Xbox Game Bar', on: true },
  { id: 'Microsoft.XboxIdentityProvider', label: 'Xbox Identity Provider', on: true },
  { id: 'Microsoft.XboxSpeechToTextOverlay', label: 'Xbox Speech To Text', on: true },
  { id: 'Microsoft.MicrosoftSolitaireCollection', label: 'Solitaire Collection', on: true },
  { id: 'Microsoft.MicrosoftOfficeHub', label: 'Office Hub', on: true },
  { id: 'Microsoft.OutlookForWindows', label: 'Outlook (új)', on: true },
  { id: 'MicrosoftTeams', label: 'Teams (személyes)', on: true },
  { id: 'MSTeams', label: 'Teams (MSTeams)', on: true },
  { id: 'Microsoft.SkypeApp', label: 'Skype', on: true },
  { id: 'Microsoft.YourPhone', label: 'Telefon összekapcsolása', on: true },
  { id: 'Microsoft.WindowsFeedbackHub', label: 'Visszajelzési központ', on: true },
  { id: 'Microsoft.GetHelp', label: 'Súgó kérése', on: true },
  { id: 'Microsoft.Getstarted', label: 'Tippek / Kezdés', on: true },
  { id: 'Microsoft.WindowsMaps', label: 'Térképek', on: true },
  { id: 'Microsoft.People', label: 'Kapcsolatok', on: true },
  { id: 'Microsoft.Todos', label: 'To Do', on: true },
  { id: 'Microsoft.PowerAutomateDesktop', label: 'Power Automate', on: true },
  { id: 'Microsoft.Windows.DevHome', label: 'Dev Home', on: true },
  { id: 'Microsoft.MicrosoftJournal', label: 'Journal', on: true },
  { id: 'Microsoft.Whiteboard', label: 'Whiteboard', on: true },
  { id: 'MicrosoftCorporationII.QuickAssist', label: 'Quick Assist', on: true },
  { id: 'Microsoft.MixedReality.Portal', label: 'Mixed Reality Portal', on: true },
  { id: 'Microsoft.ZuneVideo', label: 'Filmek és TV', on: true },
  { id: 'Microsoft.LinkedIn', label: 'LinkedIn', on: true },
  { id: 'Microsoft.Wallet', label: 'Wallet', on: true },
  { id: 'Microsoft.ZuneMusic', label: 'Media Player', on: false },
  { id: 'Microsoft.Windows.Photos', label: 'Fényképek', on: false },
  { id: 'Microsoft.WindowsCalculator', label: 'Számológép', on: false },
  { id: 'Microsoft.WindowsCamera', label: 'Kamera', on: false },
  { id: 'Microsoft.WindowsNotepad', label: 'Jegyzettömb', on: false },
  { id: 'Microsoft.Paint', label: 'Paint', on: false },
  { id: 'Microsoft.ScreenSketch', label: 'Képmetsző', on: false },
  { id: 'Microsoft.WindowsTerminal', label: 'Terminal', on: false },
  { id: 'Microsoft.MicrosoftStickyNotes', label: 'Ragadós cédulák', on: false },
  { id: 'Microsoft.WindowsSoundRecorder', label: 'Hangrögzítő', on: false },
  { id: 'Microsoft.WindowsAlarms', label: 'Óra', on: false },
  { id: 'microsoft.windowscommunicationsapps', label: 'Mail és Naptár', on: false },
  { id: 'Microsoft.WindowsStore', label: 'Microsoft Store (óvatosan!)', on: false },
  { id: 'Microsoft.DesktopAppInstaller', label: 'App Installer / winget (kell a wingethez!)', on: false },
]

export const OFFICE_PRODUCTS = [
  { id: 'O365ProPlusRetail', label: 'Microsoft 365 Apps for enterprise' },
  { id: 'O365BusinessRetail', label: 'Microsoft 365 Apps for business' },
  { id: 'ProPlus2024Volume', label: 'Office LTSC Professional Plus 2024' },
  { id: 'Standard2024Volume', label: 'Office LTSC Standard 2024' },
  { id: 'ProPlus2021Volume', label: 'Office LTSC Professional Plus 2021' },
  { id: 'HomeBusiness2024Retail', label: 'Office Home & Business 2024' },
]

export const OFFICE_CHANNELS = ['Current', 'MonthlyEnterprise', 'SemiAnnual', 'PerpetualVL2024', 'PerpetualVL2021']

export const OFFICE_APPS = ['Access', 'Excel', 'Groove', 'Lync', 'OneDrive', 'OneNote', 'Outlook', 'PowerPoint', 'Publisher', 'Teams', 'Word', 'Bing']

export const WINGET_SUGGESTIONS = [
  'Mozilla.Firefox',
  'Google.Chrome',
  '7zip.7zip',
  'Notepad++.Notepad++',
  'VideoLAN.VLC',
  'Adobe.Acrobat.Reader.64-bit',
  'Microsoft.VisualStudioCode',
  'Microsoft.PowerToys',
  'Git.Git',
  'TeamViewer.TeamViewer',
  'AnyDeskSoftwareGmbH.AnyDesk',
  'Valve.Steam',
  'Discord.Discord',
  'Spotify.Spotify',
  'WinDirStat.WinDirStat',
  'CrystalDewWorld.CrystalDiskInfo',
  'REALiX.HWiNFO',
  'Rufus.Rufus',
]
