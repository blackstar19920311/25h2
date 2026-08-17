# Windows 11 25H2 · Autounattend Generátor

Profi, React-alapú webalkalmazás, amely egy validált, hibamentes **`autounattend.xml`** fájlt generál Windows 11 **25H2** teljesen automatikus telepítéséhez.

> Minden a böngészőben történik. Semmilyen adat (jelszó, Wi-Fi kulcs, domain credential) nem hagyja el a gépet.

## Mit tud

- **Bypass-ok:** TPM, SecureBoot, RAM, CPU, DiskCheck ellenőrzés kikerülése + `BypassNRO` (hálózat nélküli OOBE).
- **Diskpart particionálás:** `auto` (csak C:) és `autocd` (C: rendszer + D: adatok) mód, pontosan méretezett EFI és külön **WinRE** partícióval a lemez végén, a Microsoft ajánlásai szerint.
- **Wi-Fi:** SSID + jelszó beégetése (ékezetes SSID hexadecimális kódolással), így a gép magától felmegy a netre.
- **Helyi fiók:** rendszergazda fiók, automatikus bejelentkezés, jelszó lejárat kikapcsolva.
- **Start menü / tálca takarítás:** GPO házirendek + `LayoutModification.json`, rejtett tálca ikonok megjelenítése háttérfeladattal.
- **Bloatware mentesítés:** a gyári appok listából, a `specialize` fázisban, még telepítés előtt kirepülnek.
- **Tweak-ek:** UAC ki, telemetria le, egérgyorsítás ki, Edge első indítás ki, Ultimate Performance energiaséma, Copilot/Recall tiltás és még sok más.
- **"Karmester" szkriptek:** Winget appok (hálózat-ellenőrzéssel és időkorláttal), Office ODT külön `SetupComplete` fázisban, Domain Join és Windows Update grafikus visszaszámlálóval, offline védelemmel.

## Használat

1. Nyisd meg a generátort: **https://blackstar19920311.github.io/25h2/**
2. Állítsd be a szekciókat (Rendszer, Particionálás, Fiók, Felület, Tweak-ek, Bloatware, Szkriptek).
3. Kattints az **XML generálása** gombra → letöltődik az `autounattend.xml`.
4. Másold a fájlt a Windows 11 25H2 telepítő USB **gyökerébe** (vagy az ISO gyökerébe).
5. Boot, és kész. A telepítő nem kérdez semmit.

## GitHub Pages bekapcsolása

A deploy már be van kötve GitHub Actions-re. Egyszeri lépés:

**Settings → Pages → Build and deployment → Source: `GitHub Actions`**

Ettől kezdve minden `main`-re pusholt commit automatikusan legyártja és kiteszi az oldalt (`.github/workflows/deploy.yml`). Kézzel is indítható az Actions fülön (`Run workflow`).

## Fejlesztés

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

**Stack:** Vite + React 18 + lucide-react, saját CSS (nulla UI framework), nulla backend.

## Figyelmeztetés

Az `auto` és `autocd` particionálási mód **`clean all` nélküli `clean` műveletet** futtat a kiválasztott lemezen: a lemez teljes tartalma elveszik. Ellenőrizd a lemez sorszámát (`diskId`) telepítés előtt.
