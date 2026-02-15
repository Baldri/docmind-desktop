# Code Signing & Notarization — Setup Guide

## Übersicht

Code Signing ist erforderlich damit:
- **macOS:** Gatekeeper die App nicht blockiert + Auto-Updates funktionieren
- **Windows:** SmartScreen keine Warnung zeigt

Ohne Signing funktioniert die App trotzdem — User muessen sie manuell freigeben.

## macOS Setup

### 1. Apple Developer Program beitreten
- https://developer.apple.com/programs/ (99 USD/Jahr)
- Account: digital nalu GmbH

### 2. Zertifikat erstellen
1. Xcode → Preferences → Accounts → Manage Certificates
2. "Developer ID Application" Zertifikat erstellen
3. Keychain Access → Zertifikat exportieren als `.p12`
4. Base64 encodieren:
   ```bash
   base64 -i DeveloperIDApplication.p12 | pbcopy
   ```

### 3. App-spezifisches Passwort
1. https://appleid.apple.com/account/manage
2. "App-Specific Passwords" → Generieren
3. Label: `docmind-notarize`

### 4. GitHub Secrets hinzufuegen

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Wert | Beschreibung |
|--------|------|-------------|
| `CSC_LINK` | Base64 .p12 | Code Signing Certificate |
| `CSC_KEY_PASSWORD` | Passwort | .p12 Export-Passwort |
| `APPLE_ID` | Email | Apple Developer Email |
| `APPLE_APP_SPECIFIC_PASSWORD` | Passwort | App-spezifisches Passwort |
| `APPLE_TEAM_ID` | 10 Zeichen | Team ID (developer.apple.com → Membership) |

### 5. identity: null entfernen
Sobald Secrets konfiguriert sind, in `electron-builder.yml`:
```yaml
mac:
  # identity: null   ← diese Zeile entfernen/kommentieren
```

## Windows Setup

### 1. Code Signing Certificate kaufen
Empfohlen: DigiCert, Sectigo, oder GlobalSign
- Standard Certificate: ~200 USD/Jahr (SmartScreen baut Reputation auf)
- EV Certificate: ~400 USD/Jahr (sofort vertrauenswuerdig, Hardware-Token noetig)

### 2. GitHub Secrets hinzufuegen

| Secret | Wert | Beschreibung |
|--------|------|-------------|
| `WIN_CSC_LINK` | Base64 .pfx | Windows Code Signing Certificate |
| `WIN_CSC_KEY_PASSWORD` | Passwort | .pfx Export-Passwort |

## Testen

### Lokaler Test (macOS)
```bash
# Signing pruefen
codesign --verify --deep --strict release/mac-arm64/Docmind.app
codesign -dv --verbose=4 release/mac-arm64/Docmind.app

# Notarization pruefen
spctl --assess --type exec release/mac-arm64/Docmind.app
```

### CI Test
Push zu master → GitHub Actions → Check "Package & publish" Step Logs

## Aktueller Status
- [x] electron-builder.yml mit Signing-Konfiguration
- [x] macOS Entitlements (build/entitlements.mac.plist)
- [x] Notarize Script (scripts/notarize.js)
- [x] CI Workflow mit Signing Secrets
- [ ] Apple Developer Zertifikat erstellen
- [ ] GitHub Secrets konfigurieren
- [ ] `identity: null` entfernen nach Zertifikat-Setup
- [ ] Windows Certificate kaufen (optional fuer MVP)
