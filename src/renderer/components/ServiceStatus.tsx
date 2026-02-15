import { useServicesStore } from '../stores/services-store'
import type { ServiceStatus as ServiceStatusType } from '../../shared/types'

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

/**
 * Compact service status indicator in the sidebar.
 * Shows colored dots for Qdrant, Python (RAG), and Ollama.
 */
export function ServiceStatus() {
  const services = useServicesStore((s) => s.services)

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {services.map((svc) => (
        <div
          key={svc.name}
          className="group relative flex items-center"
          title={`${svc.name}: ${STATUS_LABELS[svc.status]}`}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[svc.status]}`}
          />
          {/* Tooltip on hover */}
          <div className="pointer-events-none absolute left-6 z-50 hidden whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block">
            {svc.name}: {STATUS_LABELS[svc.status]}
          </div>
        </div>
      ))}
    </div>
  )
}
