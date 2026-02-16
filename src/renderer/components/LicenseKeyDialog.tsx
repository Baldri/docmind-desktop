import { useState } from 'react'
import { X, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useSubscriptionStore } from '../stores/subscription-store'

interface LicenseKeyDialogProps {
  onClose: () => void
}

/**
 * Dialog for entering and managing a license key.
 * Used from UpgradeDialog and from SettingsView.
 */
export function LicenseKeyDialog({ onClose }: LicenseKeyDialogProps) {
  const [keyInput, setKeyInput] = useState('')
  const activateKey = useSubscriptionStore((s) => s.activateKey)
  const deactivate = useSubscriptionStore((s) => s.deactivate)
  const activating = useSubscriptionStore((s) => s.activating)
  const isActivated = useSubscriptionStore((s) => s.isActivated)
  const maskedKey = useSubscriptionStore((s) => s.maskedKey)
  const error = useSubscriptionStore((s) => s.error)
  const [success, setSuccess] = useState(false)

  const handleActivate = async () => {
    if (!keyInput.trim()) return
    setSuccess(false)
    const result = await activateKey(keyInput.trim())
    if (result.success) {
      setSuccess(true)
      setKeyInput('')
    }
  }

  const handleDeactivate = async () => {
    await deactivate()
    setSuccess(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Lizenzschluessel</h2>
        </div>

        {/* Current license info */}
        {isActivated && maskedKey && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span>Pro-Lizenz aktiv</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{maskedKey}</p>
            <button
              onClick={handleDeactivate}
              className="mt-2 text-xs text-red-400 hover:text-red-300"
            >
              Lizenz deaktivieren
            </button>
          </div>
        )}

        {/* Key input */}
        {!isActivated && (
          <>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-muted-foreground">
                Gib deinen Lizenzschluessel ein:
              </label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                placeholder="DOCMIND-PRO-XXXXXX-XXXXXXXX"
                className="w-full rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                disabled={activating}
                autoFocus
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="mb-3 flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Pro-Lizenz erfolgreich aktiviert!</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleActivate}
              disabled={activating || !keyInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {activating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              {activating ? 'Wird aktiviert...' : 'Aktivieren'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
