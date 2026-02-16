import { useState } from 'react'
import { X, Crown, ExternalLink, Key } from 'lucide-react'
import { LicenseKeyDialog } from './LicenseKeyDialog'

interface UpgradeDialogProps {
  feature: string
  onClose: () => void
}

/**
 * Modal that appears when a Community user tries to use a Pro feature.
 * Offers two paths: purchase via Stripe or enter an existing license key.
 */
export function UpgradeDialog({ feature, onClose }: UpgradeDialogProps) {
  const [showKeyDialog, setShowKeyDialog] = useState(false)

  if (showKeyDialog) {
    return (
      <LicenseKeyDialog
        onClose={() => {
          setShowKeyDialog(false)
          onClose()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Docmind Pro</h2>
            <p className="text-sm text-muted-foreground">
              {feature} erfordert ein Pro-Upgrade
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="mb-6 space-y-2 text-sm">
          <p className="font-medium text-foreground">Pro beinhaltet:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Unbegrenzte Dokumente
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Ordner-Import (Batch)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Drag & Drop Import
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Chat Export (Markdown)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-500">&#10003;</span> Auto-Update Installation
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              window.open('https://buy.stripe.com/docmind-pro', '_blank')
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            <ExternalLink className="h-4 w-4" />
            Pro kaufen
          </button>

          <button
            onClick={() => setShowKeyDialog(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Key className="h-4 w-4" />
            Lizenzschluessel eingeben
          </button>
        </div>
      </div>
    </div>
  )
}
