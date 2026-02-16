/**
 * License Activation Service — validates and activates HMAC-signed license keys.
 *
 * Offline validation via HMAC-SHA256. No external server required.
 * Users purchase a license via Stripe Checkout, receive a key by email,
 * and enter it in the app's Settings view.
 *
 * Key formats:
 *   DOCMIND-PRO-{PAYLOAD}-{SIGNATURE}   → Pro license
 *   DOCMIND-TEAM-{PAYLOAD}-{SIGNATURE}  → Team license
 *
 * The SIGNATURE is the first 8 hex chars of HMAC-SHA256("DOCMIND-{TIER}-{PAYLOAD}", secret).
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { LICENSE_HMAC_SECRET } from './_license-secret'
import type { SubscriptionTier, LicenseStatus } from '../../shared/types'

// ── Types ──────────────────────────────────────────────────────────────

export interface LicenseValidationResult {
  valid: boolean
  tier?: SubscriptionTier
  error?: string
}

interface LicenseStore {
  key: string
  tier: SubscriptionTier
  activatedAt: number
}

/** Valid tier segments in license keys (maps key segment → SubscriptionTier) */
const KEY_TIER_MAP: Record<string, SubscriptionTier> = {
  PRO: 'pro',
  TEAM: 'team',
}

// ── Stripe Checkout URLs ──────────────────────────────────────────────

const STRIPE_CHECKOUT_URLS: Record<SubscriptionTier, string> = {
  free: '',
  pro: 'https://buy.stripe.com/docmind-pro',
  team: 'https://buy.stripe.com/docmind-team',
}

// ── LicenseActivationService ───────────────────────────────────────────

export class LicenseActivationService {
  private storePath: string
  private store: LicenseStore | null

  constructor(configDir?: string) {
    const dir = configDir || this.resolveConfigDir()
    this.storePath = path.join(dir, 'license.json')
    this.store = this.load()
  }

  private resolveConfigDir(): string {
    try {
      return app.getPath('userData')
    } catch {
      return path.join(process.cwd(), 'data')
    }
  }

  // ── Persistence ────────────────────────────────────────────────────

  private load(): LicenseStore | null {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8')) as LicenseStore
        // Migrate legacy "community" tier to "free"
        if ((data.tier as string) === 'community') {
          data.tier = 'free'
          this.store = data
          this.save()
        }
        return data
      }
    } catch {
      // Corrupted file → fresh start
    }
    return null
  }

  private save(): void {
    try {
      const dir = path.dirname(this.storePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2))
    } catch {
      // Silently ignore
    }
  }

  // ── Public API ─────────────────────────────────────────────────────

  getStatus(): LicenseStatus {
    if (!this.store) {
      return { tier: 'free', isActivated: false }
    }
    return {
      tier: this.store.tier,
      isActivated: true,
      key: this.maskKey(this.store.key),
      activatedAt: this.store.activatedAt,
    }
  }

  getCurrentTier(): SubscriptionTier {
    return this.store?.tier ?? 'free'
  }

  getCheckoutUrl(tier: SubscriptionTier = 'pro'): string {
    return STRIPE_CHECKOUT_URLS[tier] || STRIPE_CHECKOUT_URLS.pro
  }

  /**
   * Activate a license key. Validates format and HMAC signature.
   * Supports both DOCMIND-PRO-... and DOCMIND-TEAM-... keys.
   */
  activate(key: string): LicenseValidationResult {
    const normalized = key.trim().toUpperCase()

    const formatCheck = this.validateFormat(normalized)
    if (!formatCheck.valid) return formatCheck

    const signatureCheck = this.validateSignature(normalized)
    if (!signatureCheck.valid) {
      return { valid: false, error: 'Ungueltiger Lizenzschluessel' }
    }

    const tier = signatureCheck.tier ?? 'pro'

    this.store = {
      key: normalized,
      tier,
      activatedAt: Date.now(),
    }
    this.save()

    return { valid: true, tier }
  }

  /**
   * Deactivate current license and revert to free tier.
   */
  deactivate(): void {
    this.store = null
    try {
      if (fs.existsSync(this.storePath)) {
        fs.unlinkSync(this.storePath)
      }
    } catch {
      // Ignore
    }
  }

  // ── Validation ─────────────────────────────────────────────────────

  /**
   * Format check: DOCMIND-{PRO|TEAM}-{6+ chars}-{8 hex chars}
   */
  private validateFormat(key: string): LicenseValidationResult {
    const parts = key.split('-')
    if (parts.length < 4 || parts[0] !== 'DOCMIND') {
      return { valid: false, error: 'Format: DOCMIND-PRO-XXXXXX-XXXXXXXX' }
    }
    const tierSegment = parts[1]
    if (!KEY_TIER_MAP[tierSegment]) {
      return { valid: false, error: `Unbekannter Tier: ${tierSegment}. Erwartet: PRO oder TEAM` }
    }
    if (parts[2].length < 6) {
      return { valid: false, error: 'Schluessel-Segment zu kurz' }
    }
    return { valid: true }
  }

  /**
   * HMAC-SHA256 signature validation.
   * Message = everything before last segment, signature = last segment.
   */
  private validateSignature(key: string): LicenseValidationResult {
    const parts = key.split('-')
    const signature = parts[parts.length - 1].toLowerCase()
    const message = parts.slice(0, -1).join('-')

    const expected = crypto
      .createHmac('sha256', LICENSE_HMAC_SECRET)
      .update(message)
      .digest('hex')
      .slice(0, signature.length)

    if (signature !== expected) {
      return { valid: false }
    }

    // Extract tier from key segment
    const tierSegment = parts[1]
    const tier = KEY_TIER_MAP[tierSegment] ?? 'pro'

    return { valid: true, tier }
  }

  /**
   * Mask key for display: DOCMIND-PRO-A1B2...F6-**** or DOCMIND-TEAM-A1B2...F6-****
   */
  private maskKey(key: string): string {
    const parts = key.split('-')
    if (parts.length < 4) return '****'
    const tierSegment = parts[1] // PRO or TEAM
    const payload = parts[2]
    const masked = payload.slice(0, 4) + '...' + payload.slice(-2)
    return `DOCMIND-${tierSegment}-${masked}-****`
  }

  // ── Key Generation (for admin CLI / testing) ───────────────────────

  /**
   * Generate a license key for a given tier.
   * @param tier - 'pro' or 'team'
   * @param payload - Custom payload string (random if omitted)
   */
  static generateKey(tier: 'pro' | 'team' = 'pro', payload?: string): string {
    const tierSegment = tier.toUpperCase()
    const randomPayload = payload || crypto.randomBytes(6).toString('hex').toUpperCase()
    const message = `DOCMIND-${tierSegment}-${randomPayload}`
    const signature = crypto
      .createHmac('sha256', LICENSE_HMAC_SECRET)
      .update(message)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase()

    return `${message}-${signature}`
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let instance: LicenseActivationService | null = null

export function getLicenseService(): LicenseActivationService {
  if (!instance) {
    instance = new LicenseActivationService()
  }
  return instance
}
