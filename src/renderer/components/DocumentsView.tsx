import { useState, useEffect, useCallback } from 'react'
import {
  Upload,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Database,
  RotateCcw,
} from 'lucide-react'

interface FileStats {
  total: number
  indexed: number
  processing: number
  failed: number
  pending: number
  by_domain?: Record<string, number>
  by_status?: Record<string, number>
  error?: string
}

interface UploadResult {
  canceled: boolean
  count?: number
  message?: string
  error?: string
}

/**
 * Document management view.
 * Shows indexing statistics, allows file upload (triggers indexing),
 * and provides reindex/retry controls.
 */
export function DocumentsView() {
  const [stats, setStats] = useState<FileStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.documents.list() as FileStats
      setStats(result)
    } catch {
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    // Poll every 5s while documents are being processed
    const interval = setInterval(loadStats, 5_000)
    return () => clearInterval(interval)
  }, [loadStats])

  const handleUpload = async () => {
    setIsUploading(true)
    setMessage(null)
    try {
      const result = await window.electronAPI.documents.upload() as UploadResult
      if (result.canceled) {
        setIsUploading(false)
        return
      }
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({
          type: 'success',
          text: result.message || `${result.count ?? 0} Dateien zur Indexierung hinzugefuegt`,
        })
        // Refresh stats after upload
        await loadStats()
      }
    } catch (error) {
      setMessage({ type: 'error', text: String(error) })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRetryFailed = async () => {
    setIsRetrying(true)
    setMessage(null)
    try {
      const result = await window.electronAPI.documents.reindex() as Record<string, unknown>
      if (result.error) {
        setMessage({ type: 'error', text: String(result.error) })
      } else {
        setMessage({ type: 'success', text: 'Fehlgeschlagene Dateien werden erneut indexiert' })
        await loadStats()
      }
    } catch (error) {
      setMessage({ type: 'error', text: String(error) })
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Dokumente</h1>
        <div className="no-drag flex items-center gap-2">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Dateien hinzufuegen
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Status Message */}
          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Stats Cards */}
          {stats && !stats.error && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={Database}
                label="Total"
                value={stats.total}
                color="text-slate-400"
                bgColor="bg-slate-500/10"
              />
              <StatCard
                icon={CheckCircle2}
                label="Indexiert"
                value={stats.indexed}
                color="text-emerald-400"
                bgColor="bg-emerald-500/10"
              />
              <StatCard
                icon={Clock}
                label="Ausstehend"
                value={(stats.pending ?? 0) + (stats.processing ?? 0)}
                color="text-amber-400"
                bgColor="bg-amber-500/10"
              />
              <StatCard
                icon={AlertTriangle}
                label="Fehler"
                value={stats.failed}
                color="text-red-400"
                bgColor="bg-red-500/10"
              />
            </div>
          )}

          {/* Error State */}
          {stats?.error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
              <p className="font-medium">Verbindung fehlgeschlagen</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats.error}</p>
            </div>
          )}

          {/* Domain Breakdown */}
          {stats?.by_domain && Object.keys(stats.by_domain).length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Nach Bereich
              </h2>
              <div className="space-y-2">
                {Object.entries(stats.by_domain).map(([domain, count]) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-2.5"
                  >
                    <span className="text-sm capitalize">{domain}</span>
                    <span className="text-sm font-mono text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Retry Failed */}
          {stats && (stats.failed ?? 0) > 0 && (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-amber-400">
                    {stats.failed} Dateien fehlgeschlagen
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Diese Dateien konnten nicht indexiert werden. Erneut versuchen?
                  </p>
                </div>
                <button
                  onClick={handleRetryFailed}
                  disabled={isRetrying}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                >
                  {isRetrying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Erneut versuchen
                </button>
              </div>
            </section>
          )}

          {/* Empty State */}
          {stats && stats.total === 0 && !stats.error && (
            <div className="flex h-48 items-center justify-center">
              <div className="text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Noch keine Dokumente indexiert
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Klicke oben auf &quot;Dateien hinzufuegen&quot; um Dokumente zu importieren
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: typeof Database
  label: string
  value: number
  color: string
  bgColor: string
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${bgColor}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
