import { useState, useEffect, useCallback } from 'react'
import { ArrowDownToLine, RefreshCw, X, Sparkles } from 'lucide-react'
import type { UpdateInfo } from '../../shared/types'

/**
 * Non-blocking banner that appears when an app update is available.
 *
 * States:
 *   - available:   "Version X.X.X verfuegbar" + Download button
 *   - downloading: Progress bar with percentage
 *   - downloaded:  "Bereit zum Installieren" + Install & Restart button
 *   - error:       Brief error message, dismissible
 *
 * The banner can be dismissed (hidden until next update check).
 * Does not show for 'idle', 'checking', or 'not-available' states.
 */
export function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanup = window.electronAPI.updater.onStatus((info) => {
      setUpdateInfo(info)
      // Show banner again when a new update becomes available
      if (info.status === 'available') {
        setDismissed(false)
      }
    })
    return cleanup
  }, [])

  const handleDownload = useCallback(() => {
    window.electronAPI.updater.download()
  }, [])

  const handleInstall = useCallback(() => {
    window.electronAPI.updater.install()
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  // Nothing to show
  if (!updateInfo || dismissed) return null

  const { status, version, downloadPercent, error } = updateInfo

  // Only show for actionable states
  if (status === 'idle' || status === 'checking' || status === 'not-available') {
    return null
  }

  return (
    <div className="flex items-center justify-between bg-primary/10 px-4 py-2 text-sm text-primary">
      <div className="flex items-center gap-2">
        {status === 'available' && (
          <>
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Neue Version <strong>v{version}</strong> verfuegbar
            </span>
            <button
              onClick={handleDownload}
              className="ml-2 flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-xs font-medium hover:bg-primary/30 transition-colors"
            >
              <ArrowDownToLine className="h-3 w-3" />
              Herunterladen
            </button>
          </>
        )}

        {status === 'downloading' && (
          <>
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            <span>Update wird heruntergeladen...</span>
            <div className="ml-2 h-1.5 w-32 overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${downloadPercent ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{downloadPercent ?? 0}%</span>
          </>
        )}

        {status === 'downloaded' && (
          <>
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Update <strong>v{version}</strong> bereit
            </span>
            <button
              onClick={handleInstall}
              className="ml-2 flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-xs font-medium hover:bg-primary/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Installieren &amp; Neustarten
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="text-amber-400">Update-Fehler: {error ?? 'Unbekannt'}</span>
          </>
        )}
      </div>

      {/* Dismiss button — allows user to hide the banner */}
      <button
        onClick={handleDismiss}
        className="ml-2 rounded p-0.5 hover:bg-primary/10 transition-colors"
        title="Ausblenden"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
