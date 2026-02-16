import { useState } from 'react'
import { X, Crown, ExternalLink, Key, Users } from 'lucide-react'
import { LicenseKeyDialog } from './LicenseKeyDialog'
import type { SubscriptionTier } from '../../shared/types'

/** Feature lists per tier — shown in the upgrade dialog */
const PRO_FEATURES = [
  'Unbegrenzte Dokumente',
  'Ordner-Import (Batch)',
  'Drag & Drop Import',
  'Chat Export (Markdown)',
  'Cloud APIs (Claude, GPT, Gemini)',
  'Agentic RAG',
  'MCP Integration',
  'Prompt Templates',
  'Auto-Update Installation',
]

const TEAM_FEATURES = [
  'Alles aus Pro, plus:',
  'Team Workspaces',
  'Shared Knowledge Base',
  'Rollen & Berechtigungen (RBAC)',
  'Usage Tracking',
  'Audit Logs',
  'SSO (OAuth/SAML)',
]

/** Stripe checkout URLs per tier */
const CHECKOUT_URLS: Record<string, string> = {
  pro: 'https://buy.stripe.com/docmind-pro',
  team: 'https://buy.stripe.com/docmind-team',
}

interface UpgradeDialogProps {
  feature: string
  /** The minimum tier required for this feature (default: 'pro') */
  requiredTier?: SubscriptionTier
  onClose: () => void
}

/**
 * Modal that appears when a Free user tries to use a gated feature.
 * Dynamically shows Pro or Team info based on requiredTier.
 * Offers two paths: purchase via Stripe or enter an existing license key.
 */
export function UpgradeDialog({ feature, requiredTier = 'pro', onClose }: UpgradeDialogProps) {
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

  const isTeam = requiredTier === 'team'
  const tierLabel = isTeam ? 'Team' : 'Pro'
  const features = isTeam ? TEAM_FEATURES : PRO_FEATURES
  const checkoutUrl = CHECKOUT_URLS[requiredTier] ?? CHECKOUT_URLS.pro
  const TierIcon = isTeam ? Users : Crown
  const iconBg = isTeam ? 'bg-blue-500/20' : 'bg-amber-500/20'
  const iconColor = isTeam ? 'text-blue-500' : 'text-amber-500'
  const btnBg = isTeam ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600'

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
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg}`}>
            <TierIcon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Docmind {tierLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {feature} erfordert Docmind {tierLabel}
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="mb-6 space-y-2 text-sm">
          <p className="font-medium text-foreground">{tierLabel} beinhaltet:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-emerald-500">&#10003;</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => {
              window.open(checkoutUrl, '_blank')
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${btnBg}`}
          >
            <ExternalLink className="h-4 w-4" />
            {tierLabel} kaufen
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
