import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useServicesStore } from '../stores/services-store'

/**
 * Thin banner that appears when critical services are unreachable.
 * Shows which service(s) are down and offers a refresh button.
 *
 * Only visible when Qdrant or Python are unhealthy — Ollama issues
 * are non-blocking (search still works without LLM).
 */
export function ConnectionBanner() {
  const services = useServicesStore((s) => s.services)
  const checkStatus = useServicesStore((s) => s.checkStatus)
  const isChecking = useServicesStore((s) => s.isChecking)

  // Only show for critical services (qdrant + python)
  const criticalDown = services.filter(
    (s) =>
      (s.name === 'qdrant' || s.name === 'python') &&
      (s.status === 'unhealthy' || s.status === 'stopped'),
  )

  if (criticalDown.length === 0) return null

  const names = criticalDown
    .map((s) => (s.name === 'python' ? 'RAG-API' : 'Qdrant'))
    .join(' & ')

  return (
    <div className="flex items-center justify-between bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {names} nicht erreichbar — Suche und Chat funktionieren möglicherweise
          nicht.
        </span>
      </div>
      <button
        onClick={checkStatus}
        disabled={isChecking}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-amber-500/10"
      >
        <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
        Prüfen
      </button>
    </div>
  )
}
