import { useServicesStore } from '../stores/services-store'
import { RefreshCw } from 'lucide-react'
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

/**
 * Settings view — service status overview and configuration.
 * MVP: shows service health. Later: model selection, watch directories, theme.
 */
export function SettingsView() {
  const { services, isChecking, checkStatus, restartService } = useServicesStore()

  return (
    <div className="flex h-full flex-col">
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

          {/* Info Section */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Info
            </h2>
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">0.1.0</span>
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
              <div className="space-y-1 rounded bg-black/30 p-3 font-mono text-xs text-slate-300">
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
