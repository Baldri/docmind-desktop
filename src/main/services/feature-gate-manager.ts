/**
 * Feature Gate Manager — gates features by subscription tier.
 *
 * Tier hierarchy (ascending):
 *   free  → Basic local usage (Ollama, basic search, 50 doc limit, 1 data source)
 *   pro   → All free + cloud APIs, unlimited search, agentic RAG, MCP, templates, auto-update
 *   team  → All pro + workspaces, shared KB, RBAC, usage tracking, audit logs, SSO
 *
 * A higher tier always includes all features of lower tiers.
 */

import type {
  SubscriptionTier,
  DocmindFeature,
  FeatureGateResult,
} from '../../shared/types'
import { FREE_DOCUMENT_LIMIT } from '../../shared/types'

// ── Tier Hierarchy ────────────────────────────────────────────────────

/** Numeric tier levels for comparison (higher = more features) */
const TIER_LEVEL: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
}

// ── Feature → Minimum Required Tier ──────────────────────────────────

/**
 * Maps each gated feature to the minimum tier required.
 * Features not in this map are available to all tiers.
 */
const FEATURE_MIN_TIER: Record<DocmindFeature, SubscriptionTier> = {
  // Pro features (tier >= pro)
  'folder-import': 'pro',
  'drag-drop-import': 'pro',
  'chat-export': 'pro',
  'unlimited-documents': 'pro',
  'auto-update-install': 'pro',
  'cloud-apis': 'pro',
  'agentic-rag': 'pro',
  'mcp-integration': 'pro',
  'prompt-templates': 'pro',
  // Team features (tier >= team)
  'team-workspaces': 'team',
  'shared-knowledge-base': 'team',
  'rbac': 'team',
  'usage-tracking': 'team',
  'audit-logs': 'team',
  'sso': 'team',
}

// Human-readable feature names (for upgrade dialog)
const FEATURE_LABELS: Record<DocmindFeature, string> = {
  'folder-import': 'Ordner-Import',
  'drag-drop-import': 'Drag & Drop Import',
  'chat-export': 'Chat Export',
  'unlimited-documents': 'Unbegrenzte Dokumente',
  'auto-update-install': 'Auto-Update Installation',
  'cloud-apis': 'Cloud APIs (Claude, GPT, Gemini)',
  'agentic-rag': 'Agentic RAG',
  'mcp-integration': 'MCP Integration',
  'prompt-templates': 'Prompt Templates',
  'team-workspaces': 'Team Workspaces',
  'shared-knowledge-base': 'Shared Knowledge Base',
  'rbac': 'Rollen & Berechtigungen',
  'usage-tracking': 'Usage Tracking',
  'audit-logs': 'Audit Logs',
  'sso': 'SSO (OAuth/SAML)',
}

/** Human-readable tier names */
const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
}

// ── FeatureGateManager ─────────────────────────────────────────────────

export class FeatureGateManager {
  private tier: SubscriptionTier = 'free'

  setTier(tier: SubscriptionTier): void {
    this.tier = tier
  }

  getTier(): SubscriptionTier {
    return this.tier
  }

  /**
   * Check if a feature is available under the current tier.
   * Uses tier hierarchy — a higher tier always includes lower-tier features.
   */
  checkFeature(feature: DocmindFeature): FeatureGateResult {
    const requiredTier = FEATURE_MIN_TIER[feature]
    if (!requiredTier) {
      // Unknown feature — allow by default
      return { allowed: true }
    }

    const currentLevel = TIER_LEVEL[this.tier]
    const requiredLevel = TIER_LEVEL[requiredTier]

    if (currentLevel >= requiredLevel) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: `${FEATURE_LABELS[feature]} erfordert Docmind ${TIER_LABELS[requiredTier]}`,
      requiredTier,
    }
  }

  /**
   * Throw if feature is not available. Use as a guard in IPC handlers.
   */
  requireFeature(feature: DocmindFeature): void {
    const result = this.checkFeature(feature)
    if (!result.allowed) {
      throw new Error(result.reason || `${TIER_LABELS[FEATURE_MIN_TIER[feature]]} license required`)
    }
  }

  /**
   * Document limit for the current tier.
   */
  getDocumentLimit(): number {
    return TIER_LEVEL[this.tier] >= TIER_LEVEL.pro ? Infinity : FREE_DOCUMENT_LIMIT
  }

  /**
   * Check all features and return their status.
   */
  getAllFeatures(): Record<DocmindFeature, FeatureGateResult> {
    const features = Object.keys(FEATURE_MIN_TIER) as DocmindFeature[]
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
