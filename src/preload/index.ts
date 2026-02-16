import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  SearchOptions,
  ServiceInfo,
  UpdateInfo,
  LicenseStatus,
  FeatureGateResult,
  DocmindFeature,
  SubscriptionTier,
} from '../shared/types'

/**
 * Preload script — runs in a sandboxed context with access to Electron APIs.
 *
 * Exposes a minimal, type-safe `electronAPI` object to the renderer process
 * via contextBridge. The renderer NEVER gets direct access to Node.js or
 * Electron internals.
 *
 * Pattern: Each domain (search, chat, documents, settings, services) gets
 * its own namespace. Methods map 1:1 to IPC channel handlers in ipc-handlers.ts.
 */
const api = {
  // ── Search ──────────────────────────────────────────────────────────
  search: {
    hybrid: (query: string, options?: SearchOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_HYBRID, query, options),

    semantic: (query: string, options?: SearchOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_SEMANTIC, query, options),
  },

  // ── Chat ────────────────────────────────────────────────────────────
  chat: {
    send: (message: string, sessionId?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, message, sessionId),

    abort: () =>
      ipcRenderer.invoke(IPC_CHANNELS.CHAT_ABORT),

    onChunk: (callback: (chunk: string) => void) => {
      const listener = (_event: unknown, chunk: string) => callback(chunk)
      ipcRenderer.on('chat:chunk', listener)
      return () => ipcRenderer.removeListener('chat:chunk', listener)
    },

    onSources: (callback: (sources: unknown[]) => void) => {
      const listener = (_event: unknown, sources: unknown[]) => callback(sources)
      ipcRenderer.on('chat:sources', listener)
      return () => ipcRenderer.removeListener('chat:sources', listener)
    },

    onComplete: (callback: (sessionId?: string) => void) => {
      const listener = (_event: unknown, sessionId?: string) => callback(sessionId)
      ipcRenderer.on('chat:complete', listener)
      return () => ipcRenderer.removeListener('chat:complete', listener)
    },

    onError: (callback: (error: string) => void) => {
      const listener = (_event: unknown, error: string) => callback(error)
      ipcRenderer.on('chat:error', listener)
      return () => ipcRenderer.removeListener('chat:error', listener)
    },
  },

  // ── Documents ───────────────────────────────────────────────────────
  documents: {
    list: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_LIST),

    // Opens native file dialog and triggers indexing — no paths needed from renderer
    upload: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPLOAD),

    // Opens native directory dialog, recursively scans for indexable files
    uploadFolder: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPLOAD_FOLDER),

    getStatus: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_STATUS),

    reindex: (fileId?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_REINDEX, fileId),

    // Index files by direct paths (used by drag & drop)
    indexPaths: (paths: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_INDEX_PATHS, paths),
  },

  // ── Settings ────────────────────────────────────────────────────────
  settings: {
    get: (key?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),

    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  },

  // ── Services ────────────────────────────────────────────────────────
  services: {
    getStatus: (): Promise<ServiceInfo[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVICES_STATUS),

    restart: (serviceName: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SERVICES_RESTART, serviceName),

    /** Fires when a sidecar process crashes unexpectedly */
    onServiceCrashed: (callback: (name: string, exitCode: number | null) => void) => {
      const listener = (_event: unknown, name: string, exitCode: number | null) => callback(name, exitCode)
      ipcRenderer.on('service:crashed', listener)
      return () => ipcRenderer.removeListener('service:crashed', listener)
    },
  },

  // ── Export ─────────────────────────────────────────────────────────
  export: {
    saveFile: (content: string, defaultFilename: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SAVE_FILE, content, defaultFilename),
  },

  // ── Auto-Update ────────────────────────────────────────────────────
  updater: {
    check: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),

    download: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD),

    install: () =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INSTALL),

    /** Fires when update status changes (checking, available, downloading, etc.) */
    onStatus: (callback: (info: UpdateInfo) => void) => {
      const listener = (_event: unknown, info: UpdateInfo) => callback(info)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    },
  },

  // ── License ─────────────────────────────────────────────────────────
  license: {
    activate: (key: string): Promise<{ valid: boolean; tier?: SubscriptionTier; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LICENSE_ACTIVATE, key),

    deactivate: (): Promise<{ tier: SubscriptionTier }> =>
      ipcRenderer.invoke(IPC_CHANNELS.LICENSE_DEACTIVATE),

    getStatus: (): Promise<LicenseStatus> =>
      ipcRenderer.invoke(IPC_CHANNELS.LICENSE_GET_STATUS),
  },

  // ── Feature Gate ───────────────────────────────────────────────────
  featureGate: {
    check: (feature: DocmindFeature): Promise<FeatureGateResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEATURE_CHECK, feature),

    getTier: (): Promise<SubscriptionTier> =>
      ipcRenderer.invoke(IPC_CHANNELS.FEATURE_GET_TIER),
  },

  // ── Platform Info ───────────────────────────────────────────────────
  platform: process.platform as 'darwin' | 'win32' | 'linux',
}

// Expose to renderer via contextBridge
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // Fallback for non-isolated contexts (should not happen in production)
  (window as unknown as Record<string, unknown>).electronAPI = api
}

export type ElectronAPI = typeof api
