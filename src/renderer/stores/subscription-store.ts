import { create } from 'zustand'
import type { SubscriptionTier, DocmindFeature, LicenseStatus } from '../../shared/types'

interface SubscriptionState {
  tier: SubscriptionTier
  isActivated: boolean
  maskedKey: string | null
  activating: boolean
  error: string | null

  loadStatus: () => Promise<void>
  activateKey: (key: string) => Promise<{ success: boolean; error?: string }>
  deactivate: () => Promise<void>
  checkFeature: (feature: DocmindFeature) => Promise<boolean>
}

/**
 * Subscription store — tracks the current license tier and provides
 * feature-checking utilities for the renderer.
 *
 * The actual enforcement happens in the main process (IPC handlers).
 * This store provides the UI state for showing/hiding Pro badges
 * and the UpgradeDialog.
 */
export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  isActivated: false,
  maskedKey: null,
  activating: false,
  error: null,

  loadStatus: async () => {
    try {
      if (!window.electronAPI?.license) return
      const status: LicenseStatus = await window.electronAPI.license.getStatus()
      set({
        tier: status.tier,
        isActivated: status.isActivated,
        maskedKey: status.key ?? null,
        error: null,
      })
    } catch {
      // Preload not available — stay on free tier
    }
  },

  activateKey: async (key: string) => {
    set({ activating: true, error: null })
    try {
      if (!window.electronAPI?.license) {
        set({ activating: false })
        return { success: false, error: 'API nicht verfuegbar' }
      }
      const result = await window.electronAPI.license.activate(key)
      if (result.valid && result.tier) {
        set({
          tier: result.tier,
          isActivated: true,
          activating: false,
          error: null,
        })
        // Reload status to get masked key
        await get().loadStatus()
        return { success: true }
      }
      const error = result.error || 'Ungueltiger Schluessel'
      set({ activating: false, error })
      return { success: false, error }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Aktivierung fehlgeschlagen'
      set({ activating: false, error })
      return { success: false, error }
    }
  },

  deactivate: async () => {
    try {
      if (!window.electronAPI?.license) return
      await window.electronAPI.license.deactivate()
      set({
        tier: 'free',
        isActivated: false,
        maskedKey: null,
        error: null,
      })
    } catch {
      // Ignore
    }
  },

  checkFeature: async (feature: DocmindFeature) => {
    try {
      if (!window.electronAPI?.featureGate) return false
      const result = await window.electronAPI.featureGate.check(feature)
      return result.allowed
    } catch {
      return false
    }
  },
}))
