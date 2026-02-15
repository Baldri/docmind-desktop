# Docmind Desktop

## Projekt-Uebersicht
Docmind ist eine Electron Desktop-App fuer intelligente Dokumentensuche und KI-Chat im Bildungsbereich. Sie baut auf dem RAG-Wissen Python-Backend auf und bietet eine native Desktop-Erfahrung ohne Docker-Abhaengigkeit.

## Architektur

### Prozesse
```
┌────────────────────────────────────────────┐
│ Renderer (React + Zustand + Tailwind)      │
│   ChatView, SearchView, SettingsView       │
├──────── contextBridge (IPC) ───────────────┤
│ Main Process (Electron)                     │
│   ├─ QdrantSidecar (spawn Rust binary)     │
│   ├─ PythonSidecar (spawn uvicorn)         │
│   ├─ OllamaChecker (health + models)       │
│   └─ IPC Handlers (proxy → Python API)     │
└────────────────────────────────────────────┘
```

### Key Design Decisions
- **Kein Docker**: Qdrant als Rust Binary (Sidecar), Python via uvicorn subprocess. Hochschul-IT blockiert Docker.
- **Graceful Degradation**: Jeder Service prueft erst ob er extern laeuft, bevor er selbst startet.
- **Minimal API Surface**: 5 IPC-Namespaces (search, chat, documents, settings, services) — nicht 20+ wie Mingly.
- **electron-api.d.ts lebt im Renderer-Scope**: Sonst zieht tsconfig.main.json den Preload transitiv rein.

## Tech Stack
- **Frontend**: React 18, Zustand 5, Tailwind 3.4, Lucide Icons
- **Backend**: Electron 27, TypeScript 5 (strict)
- **RAG**: Python (RAG-Wissen), Qdrant (Vector DB), Ollama (LLM)
- **Build**: Vite 5 (Renderer), tsc (Main), esbuild (Preload), electron-builder

## Verzeichnisstruktur
```
src/
├── main/              # Electron Main Process (CommonJS via tsc)
│   ├── index.ts       # App Lifecycle, CSP, Window
│   ├── ipc-handlers.ts # IPC → Python API Proxy
│   └── services/      # Sidecar Manager
│       ├── qdrant-sidecar.ts
│       ├── python-sidecar.ts
│       └── ollama-checker.ts
├── preload/           # Context Bridge (esbuild Bundle)
│   └── index.ts
├── renderer/          # React UI (Vite/ESM)
│   ├── App.tsx
│   ├── main.tsx
│   ├── electron-api.d.ts  # Window.electronAPI type augmentation
│   ├── components/
│   ├── stores/
│   └── styles/
└── shared/            # Types shared between Main + Renderer
    └── types.ts       # IPC_CHANNELS, Domain Types
```

## Commands
```bash
npm run dev          # Vite + Electron (concurrent)
npm run build        # Full Build (main + preload + renderer)
npm run build:main   # tsc → dist/main/
npm run build:preload # esbuild → dist/preload/index.js
npm run build:renderer # vite build → dist/renderer/
npm run typecheck    # TypeScript check (beide configs)
npm run test         # vitest
npm run dist:mac     # electron-builder macOS
```

## TypeScript Configs
- **tsconfig.json**: Renderer + Shared (ESNext, noEmit, JSX, bundler)
- **tsconfig.main.json**: Main + Shared (CommonJS, outDir: dist). Preload excluded!
- **tsconfig.node.json**: Vite config only

## Konventionen
- IPC Channels: in `src/shared/types.ts` als `IPC_CHANNELS` const definieren
- Neue Services: `src/main/services/` mit `start()`, `stop()`, `getStatus()` Pattern
- Stores: Zustand mit Interface-First Design in `src/renderer/stores/`
- Components: Funktionale Components mit Props-Interface
- Alle Strings: CH-DE (kein Eszett), Code-Kommentare auf Englisch

## Ports
| Service | Port | Beschreibung |
|---------|------|-------------|
| Vite Dev | 5173 | Renderer Dev Server |
| Qdrant | 6333 | Vector Database |
| Python API | 8001 | RAG-Wissen FastAPI |
| Ollama | 11434 | Local LLM |

## Abhaengigkeiten zu anderen Projekten
- **RAG-Wissen** (`~/projects/rag-wissen`): Python Backend fuer Search, Chat, Indexing
- **Mingly** (`~/mingly`): Referenz-Patterns (Electron, IPC, Zustand, Tailwind)
