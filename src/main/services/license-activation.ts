/**
 * License Activation Service — validates and activates HMAC-signed license keys.
 *
 * Offline validation via HMAC-SHA256. No external server required.
 * Users purchase a license via Stripe Checkout, receive a key by email,
 * and enter it in the app's Settings view.
 *
 * Key format: DOCMIND-PRO-{PAYLOAD}-{SIGNATURE}
 *   e.g. DOCMIND-PRO-A1B2C3D4E5F6-8a3f7b2e
 *
 * The SIGNATURE is the first 8 hex chars of HMAC-SHA256("DOCMIND-PRO-{PAYLOAD}", secret).
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

// ── Stripe Checkout URL ────────────────────────────────────────────────

const STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/docmind-pro'

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
        return JSON.parse(fs.readFileSync(this.storePath, 'utf-8'))
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
      return { tier: 'community', isActivated: false }
    }
    return {
      tier: this.store.tier,
      isActivated: true,
      key: this.maskKey(this.store.key),
      activatedAt: this.store.activatedAt,
    }
  }

  getCurrentTier(): SubscriptionTier {
    return this.store?.tier ?? 'community'
  }

  getCheckoutUrl(): string {
    return STRIPE_CHECKOUT_URL
  }

  /**
   * Activate a license key. Validates format and HMAC signature.
   */
  activate(key: string): LicenseValidationResult {
    const normalized = key.trim().toUpperCase()

    const formatCheck = this.validateFormat(normalized)
    if (!formatCheck.valid) return formatCheck

    const signatureCheck = this.validateSignature(normalized)
    if (!signatureCheck.valid) {
      return { valid: false, error: 'Ungueltiger Lizenzschluessel' }
    }

    this.store = {
      key: normalized,
      tier: 'pro',
      activatedAt: Date.now(),
    }
    this.save()

    return { valid: true, tier: 'pro' }
  }

  /**
   * Deactivate current license and revert to community tier.
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
   * Format check: DOCMIND-PRO-{6+ chars}-{8 hex chars}
   */
  private validateFormat(key: string): LicenseValidationResult {
    const parts = key.split('-')
    if (parts.length < 4 || parts[0] !== 'DOCMIND') {
      return { valid: false, error: 'Format: DOCMIND-PRO-XXXXXX-XXXXXXXX' }
    }
    if (parts[1] !== 'PRO') {
      return { valid: false, error: 'Unbekannter Tier: ' + parts[1] }
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
    return { valid: true, tier: 'pro' }
  }

  /**
   * Mask key for display: DOCMIND-PRO-A1B2...F6-****
   */
  private maskKey(key: string): string {
    const parts = key.split('-')
    if (parts.length < 4) return '****'
    const payload = parts[2]
    const masked = payload.slice(0, 4) + '...' + payload.slice(-2)
    return `DOCMIND-PRO-${masked}-****`
  }

  // ── Key Generation (for admin CLI / testing) ───────────────────────

  static generateKey(payload?: string): string {
    const randomPayload = payload || crypto.randomBytes(6).toString('hex').toUpperCase()
    const message = `DOCMIND-PRO-${randomPayload}`
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
