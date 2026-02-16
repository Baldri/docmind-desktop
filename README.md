# Docmind Desktop

**Intelligente Dokumentensuche & Chat — lokal, privat, offline-faehig.**

Docmind ist eine Desktop-Applikation fuer Bildung und Wissensarbeit. Sie indexiert lokale Dokumente (PDF, DOCX, TXT, MD, PPTX, XLSX, CSV, HTML) in einer Vektordatenbank und ermoeglicht semantische Suche sowie KI-gestuetzte Frage-Antwort-Gespraeche — komplett lokal auf deinem Rechner.

## Features & Preise

| Feature | Free (CHF 0) | Pro (CHF 24/Mt.) | Team (CHF 69/User/Mt.) |
|---------|:---:|:---:|:---:|
| Dokumentenindexierung | bis 50 | unbegrenzt | unbegrenzt |
| Einzeldatei-Upload | ✓ | ✓ | ✓ |
| Ordner-Import (Batch) | — | ✓ | ✓ |
| Drag & Drop Import | — | ✓ | ✓ |
| Hybride Suche (BM25 + Semantic) | ✓ | ✓ | ✓ |
| KI-Chat mit Quellenangaben | ✓ | ✓ | ✓ |
| Chat-Export (Markdown) | — | ✓ | ✓ |
| Cloud APIs (Claude, GPT, Gemini) | — | ✓ | ✓ |
| Agentic RAG | — | ✓ | ✓ |
| MCP Integration | — | ✓ | ✓ |
| Prompt Templates | — | ✓ | ✓ |
| Auto-Updates | manuell | silent | silent |
| Team Workspaces | — | — | ✓ |
| Shared Knowledge Base | — | — | ✓ |
| Rollen & Berechtigungen (RBAC) | — | — | ✓ |
| Usage Tracking | — | — | ✓ |
| Audit Logs | — | — | ✓ |
| SSO (OAuth/SAML) | — | — | ✓ |
| Dark/Light/System Theme | ✓ | ✓ | ✓ |

> **Enterprise** (auf Anfrage) — On-Premise, LDAP/AD, Compliance Dashboard, SLA, Custom Integrations, White-Label.

## Voraussetzungen

- **macOS** 12+ (Apple Silicon oder Intel) / **Windows** 10+ / **Linux** (Ubuntu 22.04+)
- **Ollama** — lokales LLM fuer Chat und Embeddings
- ~4 GB RAM (8 GB empfohlen fuer groessere Dokumentensammlungen)

Qdrant (Vektordatenbank) und der Python-RAG-Server werden automatisch als Sidecars gestartet — keine manuelle Installation noetig.

## Schnellstart

### 1. Ollama installieren

```bash
# macOS
brew install ollama

# Oder: https://ollama.ai/download
```

### 2. Modell herunterladen

```bash
ollama pull qwen2.5:7b-instruct-q4_K_M
```

### 3. Docmind starten

Lade die neueste Version von der [Releases-Seite](https://github.com/Baldri/docmind-desktop/releases) herunter:

- **macOS:** `Docmind-x.x.x-arm64.dmg` (Apple Silicon) oder `Docmind-x.x.x-x64.dmg` (Intel)
- **Windows:** `Docmind-x.x.x-Setup.exe`
- **Linux:** `Docmind-x.x.x.AppImage`

### 4. Dokumente indexieren

1. Klicke auf "Dokumente" in der Seitenleiste
2. Klicke "Dateien" um einzelne Dateien hochzuladen
3. (Pro) Nutze "Ordner" fuer Batch-Import oder Drag & Drop

### 5. Fragen stellen

Wechsle zum "Chat" und stelle Fragen zu deinen Dokumenten. Docmind durchsucht die Wissensdatenbank und gibt fundierte Antworten mit Quellenangaben.

## Entwicklung

### Voraussetzungen

- Node.js 20+
- npm
- Python 3.12+ (fuer den RAG-Server Sidecar)
- Ollama (muss laufen)

### Setup

```bash
# Repository klonen
git clone https://github.com/Baldri/docmind-desktop.git
cd docmind-desktop

# Abhaengigkeiten installieren
npm install

# Qdrant Binary herunterladen (macOS/Linux)
./scripts/download-qdrant.sh

# Entwicklungsserver starten
npm run dev
```

### Build

```bash
# TypeScript kompilieren + Vite build
npm run build

# Distributable erstellen (DMG/EXE/AppImage)
npm run dist
```

### Projektstruktur

```
src/
  main/           # Electron Main Process
    services/     # Qdrant Sidecar, Python Sidecar, Ollama Checker,
                  # License Activation, Feature Gate, Auto-Updater
    ipc-handlers.ts
    index.ts
  preload/        # Context Bridge (contextIsolation)
  renderer/       # React UI (Vite)
    components/   # Views: Chat, Search, Documents, Settings
    stores/       # Zustand State Management
    hooks/        # Custom React Hooks
  shared/         # Shared Types zwischen Main/Renderer
scripts/          # Build-Helfer (Secret Injection, Notarize)
```

### Architektur

```
[Renderer (React)]  ←contextBridge→  [Main Process (Node)]
                                          │
                              ┌───────────┼───────────┐
                              │           │           │
                         [Qdrant]    [Python RAG]  [Ollama]
                         Sidecar      Sidecar      extern
```

- **Qdrant** — Vektordatenbank, als Sidecar Binary gebuendelt
- **Python RAG** — FastAPI Server fuer Indexierung, Suche, Chat (SSE Streaming)
- **Ollama** — Lokales LLM, muss vom User separat installiert werden

## Lizenzierung

Docmind verwendet ein **Free / Pro / Team Tier-Modell**:

- **Free** (kostenlos) — Lokale Modelle (Ollama), bis 50 Dokumente, Basic Search
- **Pro** (CHF 24/Mt.) — Cloud APIs, unbegrenzte Dokumente, Agentic RAG, MCP, Templates, Auto-Updates
- **Team** (CHF 69/User/Mt., min. 5 User) — Workspaces, Shared KB, RBAC, Audit Logs, SSO

Lizenzen sind ueber [Stripe Checkout](https://docmind.ch/#pricing) erhaeltlich. Nach dem Kauf erhaeltst du einen Lizenzschluessel per E-Mail (`DOCMIND-PRO-...` oder `DOCMIND-TEAM-...`), den du unter Einstellungen → Lizenz aktivierst.

## Auto-Updates

Docmind prueft automatisch auf neue Versionen via GitHub Releases:

- **Pro / Team:** Updates werden im Hintergrund heruntergeladen und beim naechsten App-Neustart installiert
- **Free:** Ein Banner zeigt an wenn ein Update verfuegbar ist — Download und Installation muessen manuell angestossen werden

> **Hinweis:** Auto-Updates auf macOS erfordern Code Signing. Ohne Signatur koennen Updates erkannt, aber nicht automatisch installiert werden. In diesem Fall kann das Update manuell von der Releases-Seite heruntergeladen werden.

## Tastaturkuerzel

| Kuerzel | Aktion |
|---------|--------|
| `Cmd+1` bis `Cmd+4` | Ansicht wechseln |
| `Cmd+K` | Suche oeffnen |
| `Cmd+N` | Neuer Chat |
| `Cmd+Shift+Backspace` | Chat loeschen |
| `Esc` | Streaming stoppen |

## Technologie-Stack

- **Electron** 27 — Desktop-Framework
- **React** 18 + **TypeScript** — UI
- **Tailwind CSS** 3 — Styling
- **Zustand** — State Management
- **Vite** 5 — Build Tool
- **Qdrant** — Vektordatenbank (embedded Sidecar)
- **FastAPI** (Python) — RAG Pipeline
- **Ollama** — Lokales LLM
- **electron-updater** — Auto-Updates via GitHub Releases

## Lizenz

[MIT](LICENSE) — Copyright 2026 digital nalu GmbH
