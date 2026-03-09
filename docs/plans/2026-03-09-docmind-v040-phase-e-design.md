# DocMind Desktop v0.4.0 — Phase E Design

> Stand: 2026-03-09 | Ansatz B: Frontend-First mit Graceful Degradation

## Kontext

### Ausgangslage
- DocMind Desktop v0.3.4 (Electron 27, React 18, Zustand 5, Tailwind 3.4)
- RAG-Wissen v1.1.0 Backend (Audit komplett, 21 Commits, 397 Tests)
- Phase A (Pipeline Features) **noch nicht aktiviert** im Backend (.env Flags)
- Phase B (Monitoring) noch nicht umgesetzt
- Phase D (Indexer v2 / NER) noch nicht umgesetzt

### Gewaehlter Ansatz
**Frontend-First mit Graceful Degradation:** DocMind UI wird gebaut, Pipeline-Parameter werden an das Backend gesendet. Wenn das Backend die Features noch nicht unterstuetzt (Phase A nicht aktiv), werden die Parameter ignoriert — die UI funktioniert trotzdem, zeigt aber einen Hinweis.

### Scope
| In Scope | Out of Scope |
|----------|-------------|
| E.1: Pipeline-Konfig UI | Graph RAG (E.4) — Phase D fehlt |
| E.2: Chat-Qualitaet + Quellen | Electron-Update (27→33) — eigenes Projekt |
| E.3: Relevanz-Anzeige Suche | Phase A Backend-Aktivierung |
| Settings-Persistenz (electron-store) | Phase B Monitoring |
| | Phase D Indexer v2 / NER |

### Abhaengigkeiten zur Pipeline
```
Phase A (holger)          Phase E (dieses Update)
─────────────────         ──────────────────────────
.env Flags setzen    ──→  UI-Toggles senden Parameter
  MMR_ENABLED              mmr_enabled, mmr_lambda
  LLM_INTENT_ENABLED       intent_enabled
  ITERATIVE_REFINEMENT     refinement_enabled

Ohne Phase A:             UI funktioniert, Features
Flags = false             werden backend-seitig ignoriert
                          UI zeigt "Feature inaktiv" Hinweis
```

---

## Ist-Stand (vor Update)

### API-Endpoints aktuell genutzt

| Endpoint | Methode | Genutzt von | Parameter |
|----------|---------|-------------|-----------|
| `/api/v1/search/hybrid` | POST | SearchView | `{ query, limit: 10 }` — KEINE Filter |
| `/api/v1/chat/stream` | POST | ChatView (SSE) | `{ message, session_id, include_sources: true, max_context_chunks: 5 }` |
| `/api/v1/files/stats` | GET | DocumentsView | — |
| `/health` | GET | PythonSidecar | Health Check |
| `/stats` | GET | DocumentsView | Collection Stats |

### UI-Stand

| Komponente | Status | Details |
|------------|--------|---------|
| Score Badges (Suche) | ✅ Vorhanden | Combined (Emerald), BM25 + Semantic (Grau-Text) |
| Source Citations (Chat) | ✅ Vorhanden | Expandable, max 5, Score + Domain |
| Search Filter UI | ❌ Fehlt | Nur `limit: 10` hardcoded |
| Pipeline Config UI | ❌ Fehlt | Keine Toggles/Slider |
| Settings Persistenz | ❌ In-Memory | Geht bei Neustart verloren |
| Pipeline-Hinweis | ❌ Fehlt | Kein Feedback ob Backend-Feature aktiv |

### Dateien die geaendert werden

```
src/
├── main/
│   ├── settings-store.ts          NEU — electron-store Wrapper
│   └── ipc-handlers.ts            AENDERUNG — Settings delegieren
├── renderer/
│   ├── components/
│   │   ├── SearchView.tsx          AENDERUNG — Filter-Panel, verbesserte Scores
│   │   ├── ChatView.tsx            AENDERUNG — Relevanz-Indikatoren, Quellen-UX
│   │   ├── SettingsView.tsx        AENDERUNG — Pipeline-Konfig Sektion
│   │   ├── PipelineConfig.tsx      NEU — Pipeline-Toggles/Slider Komponente
│   │   └── RelevanceIndicator.tsx  NEU — Wiederverwendbarer Score-Indikator
│   └── stores/
│       ├── search-store.ts         AENDERUNG — Filter-Parameter durchreichen
│       ├── chat-store.ts           AENDERUNG — Pipeline-Settings mitsenden
│       └── settings-store.ts       AENDERUNG — Pipeline-Settings aus Main laden
└── shared/
    └── types.ts                    AENDERUNG — Pipeline-Types, erweiterte SearchOptions
```

---

## Design: Settings-Persistenz (Grundlage)

### Problem
Alle Settings sind in-memory in `ipc-handlers.ts` (Zeile ~Allowlist). Bei App-Neustart gehen Theme, Ollama-URL und kuenftig Pipeline-Slider-Werte verloren.

### Loesung
`electron-store` als leichtgewichtiger JSON-Store im `userData`-Verzeichnis.

**Neue Datei: `src/main/settings-store.ts`**
```typescript
import Store from 'electron-store'

interface DocmindSettings {
  // Bestehend (aus in-memory migriert)
  theme: 'light' | 'dark' | 'system'
  ollamaUrl: string
  ollamaModel: string
  pythonPath: string
  ragWissenPath: string
  watchDirectories: string[]

  // NEU: Pipeline-Konfig
  pipeline: {
    mmrEnabled: boolean
    mmrLambda: number          // 0.0 - 1.0
    intentEnabled: boolean
    rerankingEnabled: boolean
    maxContextChunks: number   // 1 - 20
    keywordWeight: number      // 0.0 - 1.0
    semanticWeight: number     // 0.0 - 1.0
  }
}

const defaults: DocmindSettings = {
  theme: 'system',
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen2.5:7b-instruct-q4_K_M',
  pythonPath: 'python3',
  ragWissenPath: '',
  watchDirectories: [],
  pipeline: {
    mmrEnabled: false,
    mmrLambda: 0.5,
    intentEnabled: false,
    rerankingEnabled: false,
    maxContextChunks: 5,
    keywordWeight: 0.3,
    semanticWeight: 0.7,
  },
}
```

**Aenderung: `src/main/ipc-handlers.ts`**
- `SETTINGS_GET` / `SETTINGS_SET` delegieren an `settings-store.ts` statt in-memory Objekt
- Migration: Beim ersten Start werden Defaults geschrieben, keine Datenverluste

**Dependency:** `npm install electron-store` (einzige neue Dependency)

---

## Design: E.1 — Pipeline-Konfig UI

### Konzept
Neue Sektion in SettingsView: "RAG-Pipeline" mit Toggles und Slidern. Werte werden persistent gespeichert und bei jeder Search/Chat-Anfrage als Parameter mitgesendet.

### Neue Komponente: `PipelineConfig.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ RAG-Pipeline Konfiguration                      │
│                                                 │
│ ┌─ Retrieval ─────────────────────────────────┐ │
│ │ Keyword-Gewichtung     [====------] 0.30    │ │
│ │ Semantic-Gewichtung    [======----] 0.70    │ │
│ │ Max. Kontext-Chunks    [===-------] 5       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ Erweiterte Features ───────────────────────┐ │
│ │ MMR Diversity Reranking    [○ Aus]  ⓘ       │ │
│ │ MMR Lambda                 [====--] 0.50    │ │
│ │ Intent Classification      [○ Aus]  ⓘ       │ │
│ │ Iterative Refinement       [○ Aus]  ⓘ       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ⓘ Features erfordern Backend-Aktivierung       │
│   (Phase A: .env Flags)                         │
└─────────────────────────────────────────────────┘
```

**Verhalten:**
- Slider fuer `keywordWeight` / `semanticWeight` — gekoppelt: Aenderung eines Werts passt den anderen an (Summe = 1.0)
- Toggle fuer `mmrEnabled` — wenn aktiviert, wird `mmrLambda` Slider sichtbar
- Toggle fuer `intentEnabled` und `rerankingEnabled` — einfache An/Aus-Schalter
- Info-Icons (ⓘ) mit Tooltip-Erklaerung was das Feature tut
- Hinweis-Banner am Ende: "Erweiterte Features muessen im Backend aktiviert werden"

**Graceful Degradation:**
- Parameter werden IMMER an das Backend gesendet (als Teil des Request-Body)
- Backend ignoriert unbekannte/inaktive Parameter → kein Fehler
- Kein Backend-Roundtrip noetig um den Aktivierungsstatus zu pruefen
- Spaeter (optional): Backend-Endpoint `/pipeline/status` der aktive Features meldet

### Aenderungen an bestehenden Dateien

**`src/shared/types.ts`** — Erweiterte SearchOptions:
```typescript
export interface SearchOptions {
  limit?: number
  keywordWeight?: number
  semanticWeight?: number
  domain?: string
  language?: string
  // NEU: Pipeline-Parameter
  mmrEnabled?: boolean
  mmrLambda?: number
  intentEnabled?: boolean
  rerankingEnabled?: boolean
}

export interface ChatOptions {
  sessionId?: string
  includeSources?: boolean
  maxContextChunks?: number
  // NEU: Pipeline-Parameter
  mmrEnabled?: boolean
  mmrLambda?: number
  intentEnabled?: boolean
  rerankingEnabled?: boolean
}
```

**`src/renderer/stores/search-store.ts`** — Pipeline-Settings laden und mitsenden:
```typescript
// Vorher:
const response = await window.electronAPI.search.hybrid(query, { limit: 10 })

// Nachher:
const pipeline = await window.electronAPI.settings.get('pipeline')
const response = await window.electronAPI.search.hybrid(query, {
  limit: 10,
  keywordWeight: pipeline.keywordWeight,
  semanticWeight: pipeline.semanticWeight,
  mmrEnabled: pipeline.mmrEnabled,
  mmrLambda: pipeline.mmrLambda,
})
```

**`src/renderer/stores/chat-store.ts`** — Pipeline-Settings bei Chat mitsenden:
```typescript
// Pipeline-Settings als zusaetzliche Parameter an /api/v1/chat/stream senden
// Backend nutzt sie fuer den Retrieval-Schritt innerhalb des Chat
```

**`src/main/ipc-handlers.ts`** — Erweiterte Parameter an Backend weiterleiten:
```typescript
// SEARCH_HYBRID: Alle SearchOptions an /api/v1/search/hybrid durchreichen
// CHAT_SEND: Pipeline-Settings als Query-Parameter oder Request-Body mitsenden
```

---

## Design: E.2 — Chat-Qualitaet & Quellen-Verbesserung

### Ist-Stand
- Chat nutzt `/api/v1/chat/stream` (SSE) mit `include_sources: true`
- Quellen werden nach Streaming als expandable Liste gezeigt (max 5)
- Score wird als Prozent-Badge gezeigt
- Kein Relevanz-Indikator fuer die Gesamtantwort

### Verbesserungen

#### 2a. Relevanz-Indikator fuer Chat-Antworten

**Neue Komponente: `RelevanceIndicator.tsx`**

Wiederverwendbarer Score-Indikator, der einen Relevanz-Wert (0-1) als visuelles Element darstellt:

```
Hoch (>0.75):   ████████░░  82% — Emerald
Mittel (0.5-0.75): █████░░░░░  58% — Amber
Niedrig (<0.5):  ██░░░░░░░░  23% — Rot/Grau
```

**Platzierung im Chat:**
- Nach dem Streaming-Ende, vor der Quellen-Liste
- Zeigt den Durchschnittsscore aller Quellen als "Konfidenz"-Wert
- Label: "Antwort basiert auf X Quellen (Konfidenz: Y%)"

#### 2b. Verbesserte Quellen-Anzeige

**Aenderungen an ChatView.tsx (SourcesList):**

| Vorher | Nachher |
|--------|---------|
| Max 5 Quellen | Max 5, aber "X weitere" Link wenn mehr vorhanden |
| Score nur als Zahl | `RelevanceIndicator` Komponente mit Farbcodierung |
| Nur file_name | file_name + document_type Badge (wenn vorhanden) |
| Kein Sorting | Nach Score sortiert (hoechster zuerst) |
| Nur Content-Preview | Content-Preview + Highlight des relevanten Abschnitts (fett) |

#### 2c. Max Context Chunks steuerbar

- `maxContextChunks` Slider in PipelineConfig (1-20, Default: 5)
- Wird als Parameter an `/api/v1/chat/stream` gesendet
- Mehr Chunks = laengere aber gruendlichere Antworten

---

## Design: E.3 — Relevanz-Anzeige Suche

### Ist-Stand
- Combined Score als Emerald-Badge (Prozent)
- BM25 + Semantic als kleine graue Text-Labels
- Keine visuelle Score-Aufschluesselung
- Keine Filter (Domain, Sprache, Gewichtung)

### Verbesserungen

#### 3a. Erweiterte Score-Visualisierung

**Aenderungen an SearchView.tsx (ResultCard):**

```
┌─────────────────────────────────────────────┐
│ 📄 dokument.pdf                    [82%]    │
│ ┌─── Score-Breakdown ──────────────────┐    │
│ │ BM25:     ██████░░░░  62%           │    │
│ │ Semantic: █████████░  91%           │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ "Lorem ipsum dolor sit amet, consectetur    │
│  adipiscing elit, sed do eiusmod tempor..." │
│                                             │
│ 🏷 Education  🌐 de                         │
└─────────────────────────────────────────────┘
```

- `RelevanceIndicator` Komponente fuer BM25 und Semantic Score (Farbbalken statt nur Text)
- Domain und Language als Tags unterhalb des Contents
- Combined Score bleibt als prominenter Badge oben rechts

#### 3b. Such-Filter Panel

**Neues Element in SearchView.tsx:**

```
┌─ Filter ──────────────────────────────────┐
│ Domain:  [Alle ▾]   Sprache: [Alle ▾]    │
│ Ergebnisse: [10 ▾]                        │
└───────────────────────────────────────────┘
```

- Dropdown fuer Domain-Filter (Alle, Business, Education, Personal)
- Dropdown fuer Sprache-Filter (Alle, de, en, fr, etc.)
- Dropdown fuer Ergebnis-Limit (5, 10, 20, 50)
- Filter-Werte werden an `/api/v1/search/hybrid` als Parameter gesendet
- Filter werden NICHT persistiert (session-only, da suchspezifisch)

---

## Architektur-Entscheidungen

### 1. Kein Backend-Roundtrip fuer Feature-Status
**Entscheidung:** UI sendet Pipeline-Parameter blind, Backend ignoriert inaktive.
**Begruendung:** Kein neuer API-Endpoint noetig. Konsistent mit Graceful Degradation. Spaeter optional `/pipeline/status` Endpoint.

### 2. electron-store statt SQLite
**Entscheidung:** `electron-store` (JSON-File) statt `sql.js` oder `better-sqlite3`.
**Begruendung:** Settings sind Key-Value, keine relationalen Daten. JSON reicht. Keine native Dependency (kein Rebuild bei Electron-Updates).

### 3. Gekoppelte Keyword/Semantic Slider
**Entscheidung:** `keywordWeight + semanticWeight = 1.0` — Aenderung eines Werts passt den anderen automatisch an.
**Begruendung:** Backend erwartet Gewichtungen die sich zu 1.0 ergaenzen. Freie Eingabe wuerde zu ungueltigen Kombinationen fuehren.

### 4. RelevanceIndicator als wiederverwendbare Komponente
**Entscheidung:** Eigene Komponente statt inline Styling.
**Begruendung:** Wird in SearchView (Score-Breakdown), ChatView (Quellen-Score) und ChatView (Konfidenz-Indikator) verwendet — 3 Stellen.

### 5. Kein Electron-Update
**Entscheidung:** Electron 27 bleibt. Kein Update auf 33.
**Begruendung:** 6 Major Versions = eigenes Migrations-Projekt. Risiko von Breaking Changes zu hoch fuer ein Feature-Update.

---

## Neue Dependencies

| Package | Version | Zweck |
|---------|---------|-------|
| `electron-store` | ^8.x | Persistente Settings |

Keine weiteren neuen Dependencies.

---

## Testing-Strategie

| Was | Wie | Prioritaet |
|-----|-----|------------|
| Settings-Persistenz | Unit Test: Schreiben, Lesen, Defaults | Hoch |
| PipelineConfig Rendering | Vitest + React Testing Library | Hoch |
| Slider-Kopplung (Weights) | Unit Test: keywordWeight + semanticWeight = 1.0 | Hoch |
| Search mit Filtern | IPC Mock: Parameter korrekt durchgereicht | Mittel |
| Chat mit Pipeline-Params | IPC Mock: Parameter im Request-Body | Mittel |
| RelevanceIndicator | Snapshot Test: Farbcodierung korrekt | Niedrig |
| TypeCheck | `npm run typecheck` muss bestehen | Hoch |

---

## Abhaengigkeiten & Timing in der Pipeline

```
Roadmap-Phase    Status        Abhaengigkeit fuer DocMind v0.4.0
──────────────   ──────────    ──────────────────────────────────
Phase A          ❌ Offen      Pipeline-Toggles wirken erst NACH Phase A
Phase B          ❌ Offen      Keine direkte Abhaengigkeit
Phase C          ❌ Offen      Keine direkte Abhaengigkeit
Phase D          ❌ Offen      Graph RAG (E.4) braucht Phase D → ausgelassen
Phase E (dies)   📋 Design     Kann JETZT gestartet werden (Graceful Degradation)
```

### Empfohlene Reihenfolge

1. **Jetzt:** DocMind v0.4.0 bauen (E.1 + E.2 + E.3 + Settings-Persistenz)
2. **Danach:** Phase A im Backend aktivieren (.env Flags) → Pipeline-Features wirken sofort in DocMind
3. **Parallel (claude):** Phase B (Monitoring) + Phase C (Tests) im Backend
4. **Spaeter:** Phase D (Indexer v2) → dann E.4 (Graph RAG) als separates Release

### Warum jetzt starten sinnvoll ist
- DocMind UI ist **nicht blockiert** durch Phase A — Graceful Degradation
- Settings-Persistenz ist ein Grundlagen-Fix der unabhaengig von der Pipeline noetig ist
- Quellen-Verbesserung und Relevanz-Anzeige funktionieren **sofort** (brauchen kein Phase A)
- Wenn Phase A spaeter aktiviert wird, funktionieren die Toggles automatisch

---

## Zusammenfassung der Aenderungen

### Neue Dateien (4)
| Datei | LOC (geschaetzt) | Zweck |
|-------|-------------------|-------|
| `src/main/settings-store.ts` | ~60 | electron-store Wrapper + Schema |
| `src/renderer/components/PipelineConfig.tsx` | ~180 | Toggles, Slider, Info-Tooltips |
| `src/renderer/components/RelevanceIndicator.tsx` | ~40 | Wiederverwendbarer Score-Balken |
| `src/renderer/components/SearchFilters.tsx` | ~80 | Domain/Sprache/Limit Dropdowns |

### Geaenderte Dateien (7)
| Datei | Aenderung |
|-------|-----------|
| `src/main/ipc-handlers.ts` | Settings → electron-store, Pipeline-Params durchreichen |
| `src/shared/types.ts` | Pipeline-Types, erweiterte SearchOptions, ChatOptions |
| `src/renderer/components/SettingsView.tsx` | Neue "RAG-Pipeline" Sektion mit PipelineConfig |
| `src/renderer/components/SearchView.tsx` | SearchFilters, RelevanceIndicator, Score-Breakdown |
| `src/renderer/components/ChatView.tsx` | Konfidenz-Indikator, verbesserte Quellen |
| `src/renderer/stores/search-store.ts` | Pipeline-Settings laden + mitsenden |
| `src/renderer/stores/chat-store.ts` | Pipeline-Settings bei Chat mitsenden |

### Nicht geaendert
| Datei | Grund |
|-------|-------|
| `src/main/services/*` | Keine Sidecar-Aenderungen |
| `src/preload/index.ts` | Bestehende IPC-Channels reichen (settings.get/set) |
| `package.json` | Nur `electron-store` hinzufuegen |
| Electron Version | Bleibt bei 27 |
