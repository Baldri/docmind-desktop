# DocMind Desktop v0.4.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** DocMind Desktop von v0.3.4 auf v0.4.0 updaten — Settings-Persistenz, Pipeline-Konfig UI, verbesserte Chat-Quellen und Such-Relevanz-Anzeige.

**Architecture:** Frontend-First mit Graceful Degradation. Pipeline-Parameter werden an das RAG-Wissen Backend gesendet, unabhaengig davon ob Phase A (Backend-Flags) aktiviert ist. electron-store fuer persistente Settings. Wiederverwendbare RelevanceIndicator-Komponente fuer Scores in Chat und Suche.

**Tech Stack:** Electron 27, React 18, Zustand 5, TypeScript strict, Tailwind 3.4, electron-store, Vitest

**Design-Doc:** `docs/plans/2026-03-09-docmind-v040-phase-e-design.md`

---

## Task 1: electron-store installieren und Settings-Store erstellen

**Files:**
- Modify: `package.json` (Dependency hinzufuegen)
- Create: `src/main/settings-store.ts`
- Modify: `src/shared/types.ts:156-163` (AppSettings erweitern)

**Step 1: electron-store installieren**

Run: `cd ~/docmind-desktop && npm install electron-store`
Expected: package.json + package-lock.json updated

**Step 2: PipelineSettings Type in shared/types.ts hinzufuegen**

In `src/shared/types.ts` nach Zeile 163 (nach `AppSettings` Interface) einfuegen:

```typescript
export interface PipelineSettings {
  mmrEnabled: boolean
  mmrLambda: number
  intentEnabled: boolean
  rerankingEnabled: boolean
  maxContextChunks: number
  keywordWeight: number
  semanticWeight: number
}

export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  mmrEnabled: false,
  mmrLambda: 0.5,
  intentEnabled: false,
  rerankingEnabled: false,
  maxContextChunks: 5,
  keywordWeight: 0.3,
  semanticWeight: 0.7,
}
```

`AppSettings` erweitern (Zeile 156-163):

```typescript
export interface AppSettings {
  ollamaUrl: string
  ollamaModel: string
  pythonPath: string
  ragWissenPath: string
  watchDirectories: string[]
  theme: 'dark' | 'light' | 'system'
  pipeline: PipelineSettings  // NEU
}
```

`DEFAULT_SETTINGS` (Zeile 184-191) erweitern:

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b-instruct-q4_K_M',
  pythonPath: 'python3',
  ragWissenPath: '',
  watchDirectories: [],
  theme: 'dark',
  pipeline: DEFAULT_PIPELINE_SETTINGS,  // NEU
}
```

**Step 3: settings-store.ts erstellen**

Create `src/main/settings-store.ts`:

```typescript
import Store from 'electron-store'
import type { AppSettings, PipelineSettings } from '../shared/types'
import { DEFAULT_SETTINGS, DEFAULT_PIPELINE_SETTINGS } from '../shared/types'

const store = new Store<AppSettings>({
  name: 'docmind-settings',
  defaults: DEFAULT_SETTINGS,
})

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value)
}

export function getAllSettings(): AppSettings {
  return store.store
}

export function getPipelineSettings(): PipelineSettings {
  return store.get('pipeline') ?? DEFAULT_PIPELINE_SETTINGS
}

export function setPipelineSetting<K extends keyof PipelineSettings>(
  key: K,
  value: PipelineSettings[K],
): void {
  const current = getPipelineSettings()
  store.set('pipeline', { ...current, [key]: value })
}
```

**Step 4: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add package.json package-lock.json src/main/settings-store.ts src/shared/types.ts
git commit -m "feat: add electron-store for persistent settings with pipeline config types"
```

---

## Task 2: IPC-Handlers auf electron-store migrieren

**Files:**
- Modify: `src/main/ipc-handlers.ts:502-529` (Settings-Handlers ersetzen)

**Step 1: Import settings-store in ipc-handlers.ts**

In `src/main/ipc-handlers.ts` Zeile 4 nach den bestehenden Imports hinzufuegen:

```typescript
import { getSetting, setSetting, getAllSettings } from './settings-store'
```

**Step 2: In-Memory Settings durch electron-store ersetzen**

Den gesamten Settings-Block (Zeilen 502-529) ersetzen:

```typescript
  // ── Settings ───────────────────────────────────────────────────────
  // Persistent via electron-store (JSON in userData).
  // Allowlist prevents renderer exploits from writing arbitrary keys.
  const ALLOWED_SETTINGS = new Set<string>([
    'ollamaUrl',
    'ollamaModel',
    'pythonPath',
    'ragWissenPath',
    'watchDirectories',
    'theme',
    'pipeline',
  ])

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key?: string) => {
    if (key) return getSetting(key as keyof import('../shared/types').AppSettings)
    return getAllSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) => {
    if (!ALLOWED_SETTINGS.has(key)) {
      console.warn(`[Settings] Rejected write to unknown key: ${key}`)
      return false
    }
    setSetting(key as keyof import('../shared/types').AppSettings, value as never)
    return true
  })
```

**Step 3: Pipeline-Parameter an Search weiterleiten**

Den Search-Handler (Zeile 164-181) erweitern — Pipeline-Params aus options durchreichen:

```typescript
  ipcMain.handle(IPC_CHANNELS.SEARCH_HYBRID, async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const body: Record<string, unknown> = {
        query,
        limit: options?.limit ?? 10,
        keyword_weight: options?.keywordWeight ?? 0.3,
        semantic_weight: options?.semanticWeight ?? 0.7,
      }
      if (options?.domain) body.domain = options.domain
      if (options?.language) body.language = options.language
      // Pipeline params — backend ignores if Phase A not active (graceful degradation)
      if (options?.mmrEnabled != null) body.mmr_enabled = options.mmrEnabled
      if (options?.mmrLambda != null) body.mmr_lambda = options.mmrLambda
      if (options?.intentEnabled != null) body.intent_enabled = options.intentEnabled
      if (options?.rerankingEnabled != null) body.reranking_enabled = options.rerankingEnabled

      const result = await postJSON(`${DASHBOARD_API}/search/hybrid`, body)
      return result
    } catch (error) {
      console.error('[IPC] Hybrid search error:', error)
      return { results: [], total_results: 0, error: String(error) }
    }
  })
```

**Step 4: Pipeline-Parameter an Chat weiterleiten**

Im Chat-Handler (Zeile 230-234) den body erweitern:

```typescript
      const body: Record<string, unknown> = {
        message,
        include_sources: true,
        max_context_chunks: options?.maxContextChunks ?? 5,
      }
      if (sessionId) body.session_id = sessionId
      // Pipeline params for retrieval step inside chat
      if (options?.mmrEnabled != null) body.mmr_enabled = options.mmrEnabled
      if (options?.mmrLambda != null) body.mmr_lambda = options.mmrLambda
      if (options?.intentEnabled != null) body.intent_enabled = options.intentEnabled
      if (options?.rerankingEnabled != null) body.reranking_enabled = options.rerankingEnabled
```

Dafuer muss die Signatur des CHAT_SEND Handlers erweitert werden (Zeile 216):

```typescript
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (event, message: string, sessionId?: string, options?: Record<string, unknown>) => {
```

**Step 5: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat: migrate settings to electron-store, forward pipeline params to backend"
```

---

## Task 3: SearchOptions und Preload erweitern

**Files:**
- Modify: `src/shared/types.ts:65-71` (SearchOptions erweitern)
- Modify: `src/preload/index.ts` (chat.send Signatur erweitern)

**Step 1: SearchOptions in types.ts erweitern**

`SearchOptions` (Zeile 65-71) ersetzen:

```typescript
export interface SearchOptions {
  limit?: number
  keywordWeight?: number
  semanticWeight?: number
  domain?: string
  language?: string
  // Pipeline params — sent to backend, ignored if Phase A not active
  mmrEnabled?: boolean
  mmrLambda?: number
  intentEnabled?: boolean
  rerankingEnabled?: boolean
}
```

**Step 2: Preload — chat.send um options erweitern**

In `src/preload/index.ts` die `chat.send` Methode finden und die Signatur erweitern, sodass ein optionales drittes Argument `options` an den IPC-Handler weitergegeben wird:

```typescript
send: (message: string, sessionId?: string, options?: Record<string, unknown>) =>
  ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, message, sessionId, options),
```

**Step 3: electron-api.d.ts aktualisieren**

In `src/renderer/electron-api.d.ts` die `chat.send` Type-Definition anpassen:

```typescript
send: (message: string, sessionId?: string, options?: Record<string, unknown>) => Promise<unknown>
```

**Step 4: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/shared/types.ts src/preload/index.ts src/renderer/electron-api.d.ts
git commit -m "feat: extend SearchOptions with pipeline params, update preload chat signature"
```

---

## Task 4: RelevanceIndicator Komponente erstellen

**Files:**
- Create: `src/renderer/components/RelevanceIndicator.tsx`

**Step 1: Komponente schreiben**

Create `src/renderer/components/RelevanceIndicator.tsx`:

```typescript
interface RelevanceIndicatorProps {
  score: number | null | undefined
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
}

function getScoreColor(score: number): string {
  if (score >= 0.75) return 'bg-emerald-500'
  if (score >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 0.75) return 'text-emerald-400'
  if (score >= 0.5) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Visual score indicator with colored bar and optional percent label.
 * Used in SearchView (score breakdown) and ChatView (confidence + sources).
 */
export function RelevanceIndicator({ score, label, showPercent = true, size = 'sm' }: RelevanceIndicatorProps) {
  if (score == null || Number.isNaN(score)) return null

  const pct = Math.round(score * 100)
  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2'
  const fontSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className={`${fontSize} text-muted-foreground/60 w-16 shrink-0`}>{label}</span>
      )}
      <div className={`flex-1 rounded-full bg-muted/30 ${barHeight}`}>
        <div
          className={`${barHeight} rounded-full transition-all ${getScoreColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && (
        <span className={`${fontSize} font-medium ${getScoreTextColor(score)} w-8 text-right`}>
          {pct}%
        </span>
      )}
    </div>
  )
}

/**
 * Confidence summary for chat responses — shows average source score.
 */
export function ConfidenceIndicator({ sources }: { sources: Array<{ score?: number | null }> }) {
  if (!sources || sources.length === 0) return null

  const validScores = sources
    .map((s) => s.score)
    .filter((s): s is number => s != null && !Number.isNaN(s))

  if (validScores.length === 0) return null

  const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length

  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">
        Basiert auf {sources.length} Quelle{sources.length !== 1 ? 'n' : ''}
      </span>
      <RelevanceIndicator score={avgScore} label="Konfidenz" size="sm" />
    </div>
  )
}
```

**Step 2: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/RelevanceIndicator.tsx
git commit -m "feat: add RelevanceIndicator and ConfidenceIndicator components"
```

---

## Task 5: PipelineConfig Komponente erstellen

**Files:**
- Create: `src/renderer/components/PipelineConfig.tsx`

**Step 1: Komponente schreiben**

Create `src/renderer/components/PipelineConfig.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Info, Sliders } from 'lucide-react'
import type { PipelineSettings } from '../../shared/types'
import { DEFAULT_PIPELINE_SETTINGS } from '../../shared/types'

/**
 * Pipeline configuration panel for SettingsView.
 * Toggles and sliders for RAG pipeline features.
 * Values are persisted via electron-store.
 */
export function PipelineConfig() {
  const [settings, setSettings] = useState<PipelineSettings>(DEFAULT_PIPELINE_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  // Load pipeline settings from main process on mount
  useEffect(() => {
    window.electronAPI.settings.get('pipeline').then((val: unknown) => {
      if (val && typeof val === 'object') {
        setSettings({ ...DEFAULT_PIPELINE_SETTINGS, ...(val as Partial<PipelineSettings>) })
      }
      setLoaded(true)
    })
  }, [])

  // Persist a setting change
  const updateSetting = <K extends keyof PipelineSettings>(key: K, value: PipelineSettings[K]) => {
    const updated = { ...settings, [key]: value }

    // Coupled sliders: keyword + semantic = 1.0
    if (key === 'keywordWeight') {
      updated.semanticWeight = Math.round((1 - (value as number)) * 100) / 100
    } else if (key === 'semanticWeight') {
      updated.keywordWeight = Math.round((1 - (value as number)) * 100) / 100
    }

    setSettings(updated)
    window.electronAPI.settings.set('pipeline', updated)
  }

  if (!loaded) return null

  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Sliders className="h-4 w-4" />
        RAG-Pipeline
      </h2>

      <div className="space-y-4">
        {/* Retrieval Settings */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Retrieval
          </h3>
          <div className="space-y-4">
            <SliderSetting
              label="Keyword-Gewichtung (BM25)"
              value={settings.keywordWeight}
              min={0} max={1} step={0.05}
              onChange={(v) => updateSetting('keywordWeight', v)}
            />
            <SliderSetting
              label="Semantic-Gewichtung"
              value={settings.semanticWeight}
              min={0} max={1} step={0.05}
              onChange={(v) => updateSetting('semanticWeight', v)}
            />
            <SliderSetting
              label="Max. Kontext-Chunks"
              value={settings.maxContextChunks}
              min={1} max={20} step={1}
              onChange={(v) => updateSetting('maxContextChunks', v)}
              formatValue={(v) => String(Math.round(v))}
            />
          </div>
        </div>

        {/* Advanced Features */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Erweiterte Features
          </h3>
          <div className="space-y-3">
            <ToggleSetting
              label="MMR Diversity Reranking"
              tooltip="Reduziert redundante Ergebnisse durch Maximal Marginal Relevance. Erfordert Backend-Aktivierung (MMR_ENABLED=true)."
              checked={settings.mmrEnabled}
              onChange={(v) => updateSetting('mmrEnabled', v)}
            />
            {settings.mmrEnabled && (
              <div className="ml-6">
                <SliderSetting
                  label="MMR Lambda (Diversitaet vs. Relevanz)"
                  value={settings.mmrLambda}
                  min={0} max={1} step={0.05}
                  onChange={(v) => updateSetting('mmrLambda', v)}
                />
              </div>
            )}
            <ToggleSetting
              label="Intent Classification"
              tooltip="Erkennt die Absicht der Suchanfrage (Frage, Vergleich, Zusammenfassung). Erfordert Backend-Aktivierung (LLM_INTENT_ENABLED=true)."
              checked={settings.intentEnabled}
              onChange={(v) => updateSetting('intentEnabled', v)}
            />
            <ToggleSetting
              label="Iterative Refinement"
              tooltip="Verfeinert die Suchanfrage automatisch fuer bessere Ergebnisse. Erfordert Backend-Aktivierung (ITERATIVE_REFINEMENT_ENABLED=true)."
              checked={settings.rerankingEnabled}
              onChange={(v) => updateSetting('rerankingEnabled', v)}
            />
          </div>
        </div>

        {/* Backend hint */}
        <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-muted-foreground">
            Erweiterte Features muessen zusaetzlich im RAG-Wissen Backend aktiviert werden (.env Flags).
            Ohne Backend-Aktivierung werden die Parameter ignoriert.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Sub-Components ──────────────────────────────────────────────────

interface SliderSettingProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

function SliderSetting({ label, value, min, max, step, onChange, formatValue }: SliderSettingProps) {
  const display = formatValue ? formatValue(value) : value.toFixed(2)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="font-mono text-xs text-foreground">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

interface ToggleSettingProps {
  label: string
  tooltip: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleSetting({ label, tooltip, checked, onChange }: ToggleSettingProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm">{label}</span>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-muted-foreground/40 hover:text-muted-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-md bg-popover border border-border px-3 py-2 text-xs text-popover-foreground shadow-md">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  )
}
```

**Step 2: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/PipelineConfig.tsx
git commit -m "feat: add PipelineConfig component with coupled sliders and toggles"
```

---

## Task 6: PipelineConfig in SettingsView integrieren

**Files:**
- Modify: `src/renderer/components/SettingsView.tsx:1-7, 190-191`

**Step 1: Import hinzufuegen**

In `src/renderer/components/SettingsView.tsx` Zeile 6 (nach LicenseKeyDialog Import):

```typescript
import { PipelineConfig } from './PipelineConfig'
```

**Step 2: PipelineConfig Sektion einfuegen**

Nach der Services-Section (Zeile 190, nach `</section>`) und vor der Keyboard Shortcuts Section (Zeile 192):

```typescript
          {/* Pipeline Config */}
          <PipelineConfig />
```

**Step 3: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/renderer/components/SettingsView.tsx
git commit -m "feat: integrate PipelineConfig section in SettingsView"
```

---

## Task 7: Search-Store mit Pipeline-Settings erweitern

**Files:**
- Modify: `src/renderer/stores/search-store.ts:14-59`

**Step 1: SearchState um Filter erweitern und Pipeline-Params senden**

`src/renderer/stores/search-store.ts` komplett ersetzen:

```typescript
import { create } from 'zustand'
import type { HybridSearchResult, PipelineSettings } from '../../shared/types'
import { DEFAULT_PIPELINE_SETTINGS } from '../../shared/types'
import { friendlyError } from '../lib/error-messages'

interface HybridSearchResponse {
  query: string
  total_results: number
  keyword_weight: number
  semantic_weight: number
  results: HybridSearchResult[]
  error?: string
}

interface SearchFilters {
  domain: string    // '' = all
  language: string  // '' = all
  limit: number
}

interface SearchState {
  query: string
  results: HybridSearchResult[]
  isSearching: boolean
  error: string | null
  filters: SearchFilters

  setQuery: (query: string) => void
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void
  search: (query: string) => Promise<void>
  clear: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  error: null,
  filters: { domain: '', language: '', limit: 10 },

  setQuery: (query: string) => set({ query }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  search: async (query: string) => {
    if (!query.trim()) return

    set({ query, isSearching: true, error: null })

    try {
      // Load pipeline settings from persistent store
      const pipeline = await window.electronAPI.settings.get('pipeline') as PipelineSettings | undefined
      const p = { ...DEFAULT_PIPELINE_SETTINGS, ...pipeline }
      const { filters } = get()

      const options: Record<string, unknown> = {
        limit: filters.limit,
        keywordWeight: p.keywordWeight,
        semanticWeight: p.semanticWeight,
        mmrEnabled: p.mmrEnabled,
        mmrLambda: p.mmrLambda,
        intentEnabled: p.intentEnabled,
        rerankingEnabled: p.rerankingEnabled,
      }
      if (filters.domain) options.domain = filters.domain
      if (filters.language) options.language = filters.language

      const response = await window.electronAPI.search.hybrid(query, options) as HybridSearchResponse

      if (response.error) {
        throw new Error(response.error)
      }

      set({
        results: response.results ?? [],
        isSearching: false,
      })
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Suche fehlgeschlagen'
      set({
        isSearching: false,
        error: friendlyError(raw),
      })
    }
  },

  clear: () => set({ query: '', results: [], error: null }),
}))
```

**Step 2: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/stores/search-store.ts
git commit -m "feat: search store sends pipeline params and supports filters"
```

---

## Task 8: SearchView mit Filtern und Score-Balken erweitern

**Files:**
- Modify: `src/renderer/components/SearchView.tsx`

**Step 1: SearchFilters und RelevanceIndicator integrieren**

`src/renderer/components/SearchView.tsx` komplett ersetzen:

```typescript
import { useState } from 'react'
import { Search, Loader2, FileText, X, Filter } from 'lucide-react'
import { useSearchStore } from '../stores/search-store'
import { RelevanceIndicator } from './RelevanceIndicator'
import type { HybridSearchResult } from '../../shared/types'

const DOMAIN_OPTIONS = ['', 'Business', 'Education', 'Personal'] as const
const LANGUAGE_OPTIONS = ['', 'de', 'en', 'fr', 'it'] as const
const LIMIT_OPTIONS = [5, 10, 20, 50] as const

/**
 * Hybrid search interface — keyword + semantic search across all documents.
 * Results show document excerpts with relevance scores.
 */
export function SearchView() {
  const [input, setInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { query, results, isSearching, error, filters, setFilter, search, clear } = useSearchStore()

  const handleSearch = () => {
    const trimmed = input.trim()
    if (!trimmed || isSearching) return
    search(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const hasActiveFilters = filters.domain !== '' || filters.language !== '' || filters.limit !== 10

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Suche</h1>
      </header>

      {/* Search Input */}
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                data-shortcut="search-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Dokumente durchsuchen... (⌘K)"
                className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {input && (
                <button
                  onClick={() => { setInput(''); clear() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10 items-center gap-1 rounded-lg border px-3 text-sm transition-colors ${
                hasActiveFilters
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={handleSearch}
              disabled={!input.trim() || isSearching}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suchen'}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-border bg-secondary/50 p-3">
              <FilterSelect
                label="Domain"
                value={filters.domain}
                options={DOMAIN_OPTIONS}
                onChange={(v) => setFilter('domain', v)}
              />
              <FilterSelect
                label="Sprache"
                value={filters.language}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => setFilter('language', v)}
              />
              <FilterSelect
                label="Ergebnisse"
                value={String(filters.limit)}
                options={LIMIT_OPTIONS.map(String) as unknown as readonly string[]}
                onChange={(v) => setFilter('limit', Number(v))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {query && !isSearching && results.length === 0 && !error && (
            <p className="text-center text-sm text-muted-foreground">
              Keine Ergebnisse fuer &quot;{query}&quot;
            </p>
          )}

          {results.length > 0 && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {results.length} Ergebnisse fuer &quot;{query}&quot;
              </p>
              <div className="space-y-3">
                {results.map((result, i) => (
                  <ResultCard key={`${result.file_name}-${i}`} result={result} />
                ))}
              </div>
            </>
          )}

          {!query && !isSearching && results.length === 0 && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Durchsuche deine Wissensdatenbank mit Hybrid-Suche
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Kombiniert Keyword-Matching (BM25) mit semantischer Suche
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-Components ──────────────────────────────────────────────────

function ResultCard({ result }: { result: HybridSearchResult }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4 transition-colors hover:bg-secondary">
      {/* Header: filename + combined score */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">
            {result.file_name || 'Dokument'}
          </span>
          {result.document_type && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary/70">
              {result.document_type}
            </span>
          )}
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          {fmtScore(result.combined_score)}
        </span>
      </div>

      {/* Content preview */}
      <p className="line-clamp-4 text-sm text-muted-foreground">
        {result.content}
      </p>

      {/* Score breakdown with visual bars */}
      <div className="mt-3 space-y-1">
        <RelevanceIndicator score={result.keyword_score} label="BM25" />
        <RelevanceIndicator score={result.semantic_score} label="Semantic" />
      </div>

      {/* Tags: domain + language */}
      {(result.domain || result.language) && (
        <div className="mt-2 flex gap-2">
          {result.domain && (
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              {result.domain}
            </span>
          )}
          {result.language && (
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              {result.language}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function fmtScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '—'
  return `${(score * 100).toFixed(0)}%`
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === '' ? 'Alle' : opt}
          </option>
        ))}
      </select>
    </div>
  )
}
```

**Step 2: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/SearchView.tsx
git commit -m "feat: SearchView with filter panel, score bars, domain/language tags"
```

---

## Task 9: Chat-Store um Pipeline-Parameter erweitern

**Files:**
- Modify: `src/renderer/stores/chat-store.ts:126-128`

**Step 1: Pipeline-Settings bei Chat-Send mitsenden**

In `src/renderer/stores/chat-store.ts` den `sendMessage` Block (Zeilen 126-128) erweitern:

```typescript
      try {
        const { sessionId } = get()
        // Load pipeline settings for retrieval step
        const pipeline = await window.electronAPI.settings.get('pipeline') as Record<string, unknown> | undefined
        await window.electronAPI.chat.send(content, sessionId ?? undefined, {
          maxContextChunks: pipeline?.maxContextChunks ?? 5,
          mmrEnabled: pipeline?.mmrEnabled,
          mmrLambda: pipeline?.mmrLambda,
          intentEnabled: pipeline?.intentEnabled,
          rerankingEnabled: pipeline?.rerankingEnabled,
        })
      } catch (error) {
```

**Step 2: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/stores/chat-store.ts
git commit -m "feat: chat store sends pipeline params with each message"
```

---

## Task 10: ChatView — Konfidenz-Indikator und verbesserte Quellen

**Files:**
- Modify: `src/renderer/components/ChatView.tsx`

**Step 1: Imports hinzufuegen**

Am Anfang der ChatView.tsx Datei die Imports erweitern:

```typescript
import { ConfidenceIndicator, RelevanceIndicator } from './RelevanceIndicator'
```

**Step 2: ConfidenceIndicator vor der Quellen-Liste einfuegen**

In der ChatView die Stelle finden wo `SourcesList` gerendert wird (nach `!isStreaming && message.sources && message.sources.length > 0`). Vor der SourcesList den ConfidenceIndicator einfuegen:

```typescript
{!isStreaming && message.sources && message.sources.length > 0 && (
  <>
    <ConfidenceIndicator sources={message.sources} />
    <SourcesList sources={message.sources} />
  </>
)}
```

**Step 3: SourcesList verbessern**

In der SourcesList-Komponente innerhalb ChatView.tsx:

1. Quellen nach Score sortieren (hoechster zuerst):
```typescript
const sortedSources = [...sources].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
```

2. "X weitere" Link wenn mehr als 5 Quellen:
```typescript
const displayed = sortedSources.slice(0, 5)
const remaining = sortedSources.length - 5
```

3. Score-Anzeige durch `RelevanceIndicator` ersetzen statt nur Zahl

4. `document_type` Badge neben Dateinamen hinzufuegen (wenn vorhanden)

**Step 4: TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/renderer/components/ChatView.tsx
git commit -m "feat: ChatView with confidence indicator, sorted sources, score bars"
```

---

## Task 11: Version bump und TypeCheck

**Files:**
- Modify: `package.json:3` (Version)
- Modify: `src/renderer/components/SettingsView.tsx:224` (Version-Anzeige)

**Step 1: Version in package.json auf 0.4.0 setzen**

In `package.json` Zeile 3:
```json
"version": "0.4.0",
```

**Step 2: Version in SettingsView aktualisieren**

In `src/renderer/components/SettingsView.tsx` Zeile 224:
```typescript
<span className="font-mono">0.4.0</span>
```

**Step 3: Vollstaendiger TypeCheck**

Run: `cd ~/docmind-desktop && npm run typecheck`
Expected: No errors

**Step 4: Tests ausfuehren**

Run: `cd ~/docmind-desktop && npm run test`
Expected: All tests pass

**Step 5: Build testen**

Run: `cd ~/docmind-desktop && npm run build`
Expected: Successful build in dist/

**Step 6: Commit**

```bash
git add package.json src/renderer/components/SettingsView.tsx
git commit -m "chore: bump version to 0.4.0"
```

---

## Task 12: Manueller Smoke Test

**Files:** Keine Aenderungen — nur Verifikation

**Step 1: Dev-Server starten**

Run: `cd ~/docmind-desktop && npm run dev`
Expected: Vite + Electron starten ohne Fehler

**Step 2: Settings pruefen**

1. Navigiere zu Einstellungen (⌘4)
2. Pruefe: "RAG-Pipeline" Sektion ist sichtbar
3. Schiebe Keyword/Semantic Slider — Werte muessen sich gegenseitig ergaenzen (Summe = 1.0)
4. Aktiviere MMR Toggle — Lambda-Slider wird sichtbar
5. App schliessen und neu starten — Settings muessen erhalten bleiben

**Step 3: Suche pruefen**

1. Navigiere zu Suche (⌘2)
2. Filter-Button klicken — Panel mit Domain/Sprache/Limit erscheint
3. Suche ausfuehren — Score-Balken statt nur Text-Prozente
4. Domain/Language Tags bei Ergebnissen (wenn vorhanden)

**Step 4: Chat pruefen**

1. Navigiere zu Chat (⌘1)
2. Frage stellen — nach Streaming: Konfidenz-Indikator + verbesserte Quellen
3. Quellen muessen nach Score sortiert sein

**Step 5: Commit (final tag)**

```bash
git add -A
git commit -m "chore: v0.4.0 release — pipeline config, search filters, chat confidence"
git tag v0.4.0
```

---

## Zusammenfassung

| Task | Was | Geschaetzte Zeit |
|------|-----|-----------------|
| 1 | electron-store + Types | 15 min |
| 2 | IPC-Handlers migrieren | 20 min |
| 3 | SearchOptions + Preload erweitern | 10 min |
| 4 | RelevanceIndicator Komponente | 15 min |
| 5 | PipelineConfig Komponente | 25 min |
| 6 | PipelineConfig in SettingsView | 5 min |
| 7 | Search-Store erweitern | 15 min |
| 8 | SearchView mit Filtern + Scores | 20 min |
| 9 | Chat-Store erweitern | 10 min |
| 10 | ChatView Konfidenz + Quellen | 20 min |
| 11 | Version bump + Build | 10 min |
| 12 | Smoke Test | 15 min |
| **Total** | | **~3h** |

## Nach v0.4.0 — Naechste Schritte

1. **Phase A aktivieren:** `.env` Flags im RAG-Wissen Backend setzen → Pipeline-Toggles wirken
2. **Phase B (Monitoring):** Structured Logging, Health-Checks im Backend (claude)
3. **Phase C (Tests):** Coverage 80%, Integration Tests (claude)
4. **v0.5.0 planen:** Graph RAG (E.4) nach Phase D (Indexer v2)
