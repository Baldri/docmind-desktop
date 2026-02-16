import { useState } from 'react'
import { useServicesStore } from '../stores/services-store'
import { useThemeStore } from '../stores/theme-store'
import { useSubscriptionStore } from '../stores/subscription-store'
import { LicenseKeyDialog } from './LicenseKeyDialog'
import { RefreshCw, Sun, Moon, Monitor, Key, Crown, CheckCircle } from 'lucide-react'
import type { ServiceStatus } from '../../shared/types'

const STATUS_COLORS: Record<ServiceStatus, string> = {
  healthy: 'text-emerald-400',
  starting: 'text-amber-400',
  unhealthy: 'text-red-400',
  stopped: 'text-slate-400',
}

const STATUS_BG: Record<ServiceStatus, string> = {
  healthy: 'bg-emerald-500/10',
  starting: 'bg-amber-500/10',
  unhealthy: 'bg-red-500/10',
  stopped: 'bg-slate-500/10',
}

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Hell', icon: Sun },
  { value: 'dark' as const, label: 'Dunkel', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
]

/**
 * Settings view — theme selection, service status, and app info.
 */
export function SettingsView() {
  const { services, isChecking, checkStatus, restartService } = useServicesStore()
  const { theme, setTheme } = useThemeStore()
  const tier = useSubscriptionStore((s) => s.tier)
  const isActivated = useSubscriptionStore((s) => s.isActivated)
  const maskedKey = useSubscriptionStore((s) => s.maskedKey)
  const [showLicenseDialog, setShowLicenseDialog] = useState(false)

  const tierLabel = tier === 'team' ? 'Team' : tier === 'pro' ? 'Pro' : 'Free'

  return (
    <div className="flex h-full flex-col">
      {/* License Key Dialog */}
      {showLicenseDialog && (
        <LicenseKeyDialog onClose={() => setShowLicenseDialog(false)} />
      )}

      {/* Header */}
      <header className="drag-region flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Einstellungen</h1>
        <button
          onClick={checkStatus}
          disabled={isChecking}
          className="no-drag flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          Status pruefen
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* License Section */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Lizenz
            </h2>
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    isActivated ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                  }`}>
                    {isActivated ? (
                      <Crown className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Key className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Docmind {tierLabel}
                    </p>
                    {isActivated && maskedKey ? (
                      <p className="text-xs font-mono text-muted-foreground">{maskedKey}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Kostenlos — 50 Dokumente, kein Batch-Import
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowLicenseDialog(true)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Key className="h-3.5 w-3.5" />
                  {isActivated ? 'Verwalten' : 'Aktivieren'}
                </button>
              </div>
              {isActivated && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Alle {tierLabel}-Features freigeschaltet
                </div>
              )}
            </div>
          </section>

          {/* Theme Section */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Erscheinungsbild
            </h2>
            <div className="flex gap-3">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Services Section */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Dienste
            </h2>
            <div className="space-y-3">
              {services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${STATUS_BG[svc.status]}`}
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          svc.status === 'healthy'
                            ? 'bg-emerald-500'
                            : svc.status === 'starting'
                            ? 'bg-amber-500 animate-pulse'
                            : svc.status === 'unhealthy'
                            ? 'bg-red-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium capitalize">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${STATUS_COLORS[svc.status]}`}>
                      {svc.status === 'healthy'
                        ? 'Verbunden'
                        : svc.status === 'starting'
                        ? 'Startet...'
                        : svc.status === 'unhealthy'
                        ? 'Fehler'
                        : 'Gestoppt'}
                    </span>
                    {svc.status !== 'starting' && (
                      <button
                        onClick={() => restartService(svc.name)}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Neu starten"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tastaturkuerzel
            </h2>
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="space-y-2 text-sm">
                {[
                  ['⌘1 – ⌘4', 'Ansicht wechseln'],
                  ['⌘K', 'Suche oeffnen'],
                  ['⌘N', 'Neuer Chat'],
                  ['⌘⇧⌫', 'Chat loeschen'],
                  ['Esc', 'Streaming stoppen'],
                ].map(([keys, desc]) => (
                  <div key={keys} className="flex justify-between">
                    <span className="text-muted-foreground">{desc}</span>
                    <kbd className="rounded bg-background px-2 py-0.5 font-mono text-xs">{keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Info Section */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Info
            </h2>
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">0.2.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plattform</span>
                  <span className="font-mono">
                    {window.electronAPI?.platform ?? 'unknown'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Ollama Setup Hint */}
          {services.find((s) => s.name === 'ollama')?.status === 'stopped' && (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="mb-2 text-sm font-semibold text-amber-400">
                Ollama nicht gefunden
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Docmind benoetigt Ollama fuer die KI-gesteuerte Beantwortung.
                Installiere Ollama und lade ein Modell:
              </p>
              <div className="space-y-1 rounded bg-slate-100 dark:bg-black/30 p-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                <p># 1. Ollama installieren</p>
                <p>brew install ollama</p>
                <p># 2. Modell laden</p>
                <p>ollama pull qwen2.5:7b-instruct-q4_K_M</p>
                <p># 3. Ollama starten</p>
                <p>ollama serve</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
