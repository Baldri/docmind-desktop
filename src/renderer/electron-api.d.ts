import type { ElectronAPI } from '../preload/index' // only loaded by renderer tsconfig

/**
 * Augment the global Window interface so the renderer can use
 * `window.electronAPI` with full type safety.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
