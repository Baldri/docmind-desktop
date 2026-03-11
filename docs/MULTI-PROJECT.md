# Multi-Projekt-Verwaltung — DocMind Desktop

## Ueberblick

DocMind Desktop unterstuetzt ab v0.6.0 das Umschalten zwischen mehreren RAG-Wissen Projekten. Jedes Projekt hat seine eigene Wissensbasis (Qdrant Collection). Der Projekt-Switcher in der Sidebar erlaubt nahtlosen Wechsel.

## Architektur

```
┌──────────────────────────────────────────┐
│  Renderer (React)                         │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │ ProjectSwitcher│  │ project-store.ts │  │
│  │ (Sidebar)     │  │ (Zustand)        │  │
│  └──────┬───────┘  └────────┬─────────┘  │
│         │ IPC                │             │
└─────────┼────────────────────┼────────────┘
          ▼                    ▼
┌──────────────────────────────────────────┐
│  Main Process                             │
│  - ipc-handlers.ts (projects:* Channels)  │
│  - settings-store (activeProjectId)       │
│  - X-Project-Id Header auf alle API-Calls │
└──────────────────────────────────────────┘
          │
          ▼ HTTP + X-Project-Id
┌──────────────────────────────────────────┐
│  RAG-Wissen Backend                       │
└──────────────────────────────────────────┘
```

## Funktionsweise

1. **ProjectSwitcher** in der Sidebar zeigt alle Projekte aus RAG-Wissen
2. Beim Wechsel wird `activeProjectId` in den Settings gespeichert
3. Alle API-Calls bekommen automatisch den `X-Project-Id` Header
4. Search, Chat, Graph, Documents zeigen nur Daten des aktiven Projekts

## IPC-Channels

| Channel | Beschreibung |
|---------|-------------|
| `projects:list` | Alle Projekte laden |
| `projects:create` | Neues Projekt erstellen |
| `projects:delete` | Projekt loeschen |
| `projects:setActive` | Aktives Projekt wechseln |

## Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/renderer/components/ProjectSwitcher.tsx` | NEU: UI-Komponente |
| `src/renderer/stores/project-store.ts` | NEU: Zustand Store |
| `src/main/ipc-handlers.ts` | Neue Channels + X-Project-Id |
| `src/shared/types.ts` | Neue IPC-Channel-Definitionen |
| `src/preload/index.ts` | Preload-API Erweiterung |
