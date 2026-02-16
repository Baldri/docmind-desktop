/**
 * Feature Gate Manager — gates features by subscription tier.
 *
 * Community (free): Chat + Search unlimited, 50 doc limit, no batch import/export
 * Pro (licensed): Everything unlocked, unlimited documents
 */

import type {
  SubscriptionTier,
  DocmindFeature,
  FeatureGateResult,
} from '../../shared/types'
import { COMMUNITY_DOCUMENT_LIMIT } from '../../shared/types'

// ── Feature → Pro required ─────────────────────────────────────────────

const PRO_FEATURES = new Set<DocmindFeature>([
  'folder-import',
  'drag-drop-import',
  'chat-export',
  'unlimited-documents',
  'auto-update-install',
])

// Human-readable feature names (for upgrade dialog)
const FEATURE_LABELS: Record<DocmindFeature, string> = {
  'folder-import': 'Ordner-Import',
  'drag-drop-import': 'Drag & Drop Import',
  'chat-export': 'Chat Export',
  'unlimited-documents': 'Unbegrenzte Dokumente',
  'auto-update-install': 'Auto-Update Installation',
}

// ── FeatureGateManager ─────────────────────────────────────────────────

export class FeatureGateManager {
  private tier: SubscriptionTier = 'community'

  setTier(tier: SubscriptionTier): void {
    this.tier = tier
  }

  getTier(): SubscriptionTier {
    return this.tier
  }

  /**
   * Check if a feature is available under the current tier.
   */
  checkFeature(feature: DocmindFeature): FeatureGateResult {
    if (!PRO_FEATURES.has(feature)) {
      // Unknown or free feature — allow
      return { allowed: true }
    }

    if (this.tier === 'pro') {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `${FEATURE_LABELS[feature]} erfordert Docmind Pro`,
      requiredTier: 'pro',
    }
  }

  /**
   * Throw if feature is not available. Use as a guard in IPC handlers.
   */
  requireFeature(feature: DocmindFeature): void {
    const result = this.checkFeature(feature)
    if (!result.allowed) {
      throw new Error(result.reason || 'Pro license required')
    }
  }

  /**
   * Document limit for the current tier.
   */
  getDocumentLimit(): number {
    return this.tier === 'pro' ? Infinity : COMMUNITY_DOCUMENT_LIMIT
  }

  /**
   * Check all features and return their status.
   */
  getAllFeatures(): Record<DocmindFeature, FeatureGateResult> {
    const features = [...PRO_FEATURES] as DocmindFeature[]
    const result: Partial<Record<DocmindFeature, FeatureGateResult>> = {}
    for (const feature of features) {
      result[feature] = this.checkFeature(feature)
    }
    return result as Record<DocmindFeature, FeatureGateResult>
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let instance: FeatureGateManager | null = null

export function getFeatureGateManager(): FeatureGateManager {
  if (!instance) {
    instance = new FeatureGateManager()
  }
  return instance
}
