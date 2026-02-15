import { create } from 'zustand'
import type { ServiceInfo } from '../../shared/types'

interface ServicesState {
  services: ServiceInfo[]
  isChecking: boolean
  lastCheck: number | null
  connectionError: string | null

  checkStatus: () => Promise<void>
  restartService: (name: string) => Promise<void>
}

/**
 * Services store — tracks the health of Qdrant, Python API, and Ollama.
 *
 * Error resilience:
 * - If checkStatus IPC call fails entirely (e.g. main process unresponsive),
 *   all services fall back to 'unhealthy' with an error message.
 * - restartService catches errors and triggers a re-check.
 */
export const useServicesStore = create<ServicesState>((set, get) => ({
  services: [
    { name: 'qdrant', status: 'starting', url: 'http://127.0.0.1:6333' },
    { name: 'python', status: 'starting', url: 'http://127.0.0.1:8001' },
    { name: 'ollama', status: 'starting', url: 'http://localhost:11434' },
  ],
  isChecking: false,
  lastCheck: null,
  connectionError: null,

  checkStatus: async () => {
    // Debounce: don't check more than once per second
    const { lastCheck, isChecking } = get()
    if (isChecking) return
    if (lastCheck && Date.now() - lastCheck < 1000) return

    set({ isChecking: true })
    try {
      const statuses = await window.electronAPI.services.getStatus()
      set({
        services: statuses,
        isChecking: false,
        lastCheck: Date.now(),
        connectionError: null,
      })
    } catch (error) {
      // IPC call failed entirely — main process might be unresponsive
      const msg = error instanceof Error ? error.message : 'IPC-Verbindung verloren'
      set((state) => ({
        isChecking: false,
        lastCheck: Date.now(),
        connectionError: msg,
        services: state.services.map((s) => ({
          ...s,
          status: 'unhealthy' as const,
          error: msg,
        })),
      }))
    }
  },

  restartService: async (name: string) => {
    try {
      await window.electronAPI.services.restart(name)
    } catch (error) {
      console.error(`[Services] Failed to restart ${name}:`, error)
    }
    // Always re-check after restart attempt
    // Small delay to let the service start up
    setTimeout(() => {
      get().checkStatus()
    }, 2000)
  },
}))
