import { create } from 'zustand'
import type { ServiceInfo } from '../../shared/types'

interface ServicesState {
  services: ServiceInfo[]
  isChecking: boolean

  checkStatus: () => Promise<void>
  restartService: (name: string) => Promise<void>
}

export const useServicesStore = create<ServicesState>((set) => ({
  services: [
    { name: 'qdrant', status: 'starting', url: 'http://127.0.0.1:6333' },
    { name: 'python', status: 'starting', url: 'http://127.0.0.1:8001' },
    { name: 'ollama', status: 'starting', url: 'http://localhost:11434' },
  ],
  isChecking: false,

  checkStatus: async () => {
    set({ isChecking: true })
    try {
      const statuses = await window.electronAPI.services.getStatus()
      set({ services: statuses, isChecking: false })
    } catch {
      set({ isChecking: false })
    }
  },

  restartService: async (name: string) => {
    await window.electronAPI.services.restart(name)
    // Re-check after restart
    const statuses = await window.electronAPI.services.getStatus()
    set({ services: statuses })
  },
}))
