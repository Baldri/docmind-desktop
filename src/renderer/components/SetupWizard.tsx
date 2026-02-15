import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Cpu,
  Brain,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useServicesStore } from '../stores/services-store'
import type { ServiceInfo, ServiceName } from '../../shared/types'

type SetupStep = 'checking' | 'ready' | 'needs-setup'

interface StepConfig {
  name: ServiceName
  label: string
  description: string
  icon: typeof Database
  installSteps: InstallStep[]
}

interface InstallStep {
  label?: string
  command?: string
  note?: string
}

const STEPS: StepConfig[] = [
  {
    name: 'qdrant',
    label: 'Qdrant (Vektordatenbank)',
    description: 'Speichert und durchsucht Dokument-Embeddings',
    icon: Database,
    installSteps: [
      { label: 'Qdrant wird als Sidecar mitgeliefert und automatisch gestartet.' },
      { label: 'Falls externe Instanz gewuenscht:', command: 'docker run -p 6333:6333 qdrant/qdrant' },
    ],
  },
  {
    name: 'python',
    label: 'RAG-Wissen (Python API)',
    description: 'Indexiert Dokumente und beantwortet Fragen',
    icon: Cpu,
    installSteps: [
      { label: 'Python 3.11+ installieren:', command: 'brew install python@3.13' },
      {
        label: 'RAG-Wissen Repository klonen:',
        command: 'git clone https://github.com/digital-nalu/rag-wissen ~/projects/rag-wissen',
      },
      { label: 'Dependencies installieren:', command: 'cd ~/projects/rag-wissen && pip install -r requirements.txt' },
    ],
  },
  {
    name: 'ollama',
    label: 'Ollama (KI-Modell)',
    description: 'Lokales Sprachmodell fuer die Beantwortung',
    icon: Brain,
    installSteps: [
      { label: 'Ollama installieren:', command: 'brew install ollama' },
      { label: 'Empfohlenes Modell laden:', command: 'ollama pull qwen2.5:7b-instruct-q4_K_M' },
      { label: 'Ollama starten:', command: 'ollama serve' },
      { note: 'Alternativ: ollama.com fuer macOS App Download' },
    ],
  },
]

interface SetupWizardProps {
  onReady: () => void
}

/**
 * First-run setup wizard.
 * Checks each service sequentially and guides the user through installation.
 * Auto-dismisses when all services are healthy.
 */
export function SetupWizard({ onReady }: SetupWizardProps) {
  const { services, isChecking, checkStatus } = useServicesStore()
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false)

  // Initial status check
  useEffect(() => {
    const check = async () => {
      await checkStatus()
      setHasCheckedOnce(true)
    }
    check()
  }, [checkStatus])

  // Auto-poll every 5s while wizard is open
  useEffect(() => {
    const interval = setInterval(checkStatus, 5_000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // Auto-dismiss when all services are healthy
  const allHealthy = services.every((s) => s.status === 'healthy')

  useEffect(() => {
    if (allHealthy && hasCheckedOnce) {
      // Small delay so the user sees the green checkmarks
      const timeout = setTimeout(onReady, 1200)
      return () => clearTimeout(timeout)
    }
  }, [allHealthy, hasCheckedOnce, onReady])

  const getStepStatus = useCallback(
    (name: ServiceName): SetupStep => {
      if (!hasCheckedOnce) return 'checking'
      const svc = services.find((s) => s.name === name)
      if (!svc) return 'checking'
      if (svc.status === 'healthy') return 'ready'
      if (svc.status === 'starting') return 'checking'
      return 'needs-setup'
    },
    [services, hasCheckedOnce],
  )

  const serviceForStep = useCallback(
    (name: ServiceName): ServiceInfo | undefined => {
      return services.find((s) => s.name === name)
    },
    [services],
  )

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="mx-auto w-full max-w-lg px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Docmind einrichten
          </h1>
          <p className="text-sm text-muted-foreground">
            Docmind prueft die benoetigten Dienste. Fehlende Dienste kannst du
            unten installieren.
          </p>
        </div>

        {/* Service Checks */}
        <div className="space-y-4">
          {STEPS.map((step) => {
            const status = getStepStatus(step.name)
            const svc = serviceForStep(step.name)

            return (
              <ServiceCheckCard
                key={step.name}
                step={step}
                status={status}
                service={svc}
              />
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={checkStatus}
            disabled={isChecking}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            Erneut pruefen
          </button>

          {allHealthy ? (
            <button
              onClick={onReady}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Docmind starten
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onReady}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Trotzdem starten
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ServiceCheckCard({
  step,
  status,
  service,
}: {
  step: StepConfig
  status: SetupStep
  service: ServiceInfo | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = step.icon

  // Auto-expand if setup needed
  useEffect(() => {
    if (status === 'needs-setup') {
      setExpanded(true)
    }
  }, [status])

  return (
    <div
      className={`rounded-lg border transition-colors ${
        status === 'ready'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : status === 'needs-setup'
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-border bg-secondary/50'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4"
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            status === 'ready'
              ? 'bg-emerald-500/20'
              : status === 'needs-setup'
              ? 'bg-red-500/20'
              : 'bg-slate-500/20'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 text-left">
          <p className="text-sm font-medium">{step.label}</p>
          <p className="text-xs text-muted-foreground">{step.description}</p>
        </div>

        <StatusIcon status={status} />
      </button>

      {/* Install Instructions (expanded) */}
      {expanded && status === 'needs-setup' && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          {service?.error && (
            <p className="mb-2 text-xs text-red-400">{service.error}</p>
          )}
          <div className="space-y-2">
            {step.installSteps.map((inst, i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground">{inst.label}</p>
                {inst.command && (
                  <code className="mt-1 block rounded bg-black/40 px-3 py-1.5 font-mono text-xs text-slate-300">
                    {inst.command}
                  </code>
                )}
                {inst.note && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/60">
                    <ExternalLink className="h-3 w-3" />
                    {inst.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: SetupStep }) {
  if (status === 'checking') {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  }
  if (status === 'ready') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  }
  return <XCircle className="h-5 w-5 text-red-500" />
}
