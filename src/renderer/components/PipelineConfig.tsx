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
    if (!window.electronAPI?.settings?.get) {
      setLoaded(true)
      return
    }
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
    window.electronAPI?.settings?.set('pipeline', updated)
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
