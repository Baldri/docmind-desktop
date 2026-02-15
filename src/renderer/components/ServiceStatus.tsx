import { useState } from 'react'
import { RotateCcw, Loader2, X } from 'lucide-react'
import { useServicesStore } from '../stores/services-store'
import type { ServiceStatus as ServiceStatusType, ServiceInfo } from '../../shared/types'

const STATUS_COLORS: Record<ServiceStatusType, string> = {
  healthy: 'bg-emerald-500',
  starting: 'bg-amber-500 animate-pulse',
  unhealthy: 'bg-red-500',
  stopped: 'bg-slate-500',
}

const STATUS_LABELS: Record<ServiceStatusType, string> = {
  healthy: 'Verbunden',
  starting: 'Startet...',
  unhealthy: 'Fehler',
  stopped: 'Gestoppt',
}

const SERVICE_LABELS: Record<string, string> = {
  qdrant: 'Qdrant',
  python: 'RAG-API',
  ollama: 'Ollama',
}

/**
 * Compact service status indicator in the sidebar.
 * Shows colored dots for Qdrant, Python (RAG), and Ollama.
 * Click to open detail panel with restart options.
 */
export function ServiceStatus() {
  const services = useServicesStore((s) => s.services)
  const [isOpen, setIsOpen] = useState(false)

  // Aggregate status: any unhealthy → red dot
  const hasIssues = services.some((s) => s.status === 'unhealthy' || s.status === 'stopped')
  const allHealthy = services.every((s) => s.status === 'healthy')
  const aggregateColor = allHealthy
    ? 'bg-emerald-500'
    : hasIssues
      ? 'bg-red-500 animate-pulse'
      : 'bg-amber-500 animate-pulse'

  return (
    <div className="relative">
      {/* Compact dot — click to expand */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-center p-2"
        title={allHealthy ? 'Alle Services verbunden' : 'Service-Status prüfen'}
      >
        <div className={`h-3 w-3 rounded-full ${aggregateColor} transition-colors`} />
      </button>

      {/* Detail Panel */}
      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Services
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {services.map((svc) => (
              <ServiceRow key={svc.name} service={svc} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceRow({ service }: { service: ServiceInfo }) {
  const restartService = useServicesStore((s) => s.restartService)
  const [isRestarting, setIsRestarting] = useState(false)

  const canRestart = service.status === 'unhealthy' || service.status === 'stopped'

  const handleRestart = async () => {
    setIsRestarting(true)
    try {
      await restartService(service.name)
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/50 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[service.status]}`} />
        <div>
          <span className="text-xs font-medium">
            {SERVICE_LABELS[service.name] || service.name}
          </span>
          <p className="text-[10px] text-muted-foreground">
            {STATUS_LABELS[service.status]}
            {service.error && (
              <span className="ml-1 text-red-400" title={service.error}>
                — {service.error.slice(0, 40)}
              </span>
            )}
          </p>
        </div>
      </div>
      {canRestart && (
        <button
          onClick={handleRestart}
          disabled={isRestarting}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          title={`${SERVICE_LABELS[service.name] || service.name} neustarten`}
        >
          {isRestarting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  )
}
