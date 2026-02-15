import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { QdrantSidecar } from './services/qdrant-sidecar'
import type { PythonSidecar } from './services/python-sidecar'
import type { OllamaChecker } from './services/ollama-checker'

const RAG_API = 'http://127.0.0.1:8001'

interface ServiceDeps {
  qdrant: QdrantSidecar
  python: PythonSidecar
  ollama: OllamaChecker
}

/**
 * Registers all IPC handlers.
 *
 * Each handler bridges the Renderer (React) to the Main process services.
 * The Python RAG-Wissen API does the heavy lifting — most IPC handlers
 * simply proxy HTTP requests to it.
 */
export function registerIPCHandlers(deps: ServiceDeps): void {
  const { qdrant, python, ollama } = deps

  // ── Services Status ────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SERVICES_STATUS, () => {
    return [qdrant.getStatus(), python.getStatus(), ollama.getStatus()]
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_RESTART, async (_event, serviceName: string) => {
    if (serviceName === 'qdrant') {
      await qdrant.stop()
      return qdrant.start()
    }
    if (serviceName === 'python') {
      await python.stop()
      return python.start()
    }
    if (serviceName === 'ollama') {
      return ollama.check()
    }
    return false
  })

  // ── Search ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SEARCH_HYBRID, async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const params = new URLSearchParams({ query })
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.keywordWeight) params.set('keyword_weight', String(options.keywordWeight))
      if (options?.semanticWeight) params.set('semantic_weight', String(options.semanticWeight))

      const response = await fetch(`${RAG_API}/api/search/hybrid?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('[IPC] Search error:', error)
      return { results: [], error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_SEMANTIC, async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const params = new URLSearchParams({ query })
      if (options?.limit) params.set('limit', String(options.limit))

      const response = await fetch(`${RAG_API}/api/search/semantic?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('[IPC] Semantic search error:', error)
      return { results: [], error: String(error) }
    }
  })

  // ── Chat ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, message: string) => {
    try {
      const response = await fetch(`${RAG_API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          include_sources: true,
          max_context_chunks: 5,
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('[IPC] Chat error:', error)
      return { content: '', error: String(error) }
    }
  })

  // ── Documents ──────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_LIST, async () => {
    try {
      const response = await fetch(`${RAG_API}/api/documents`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('[IPC] Documents list error:', error)
      return { documents: [], error: String(error) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_STATUS, async () => {
    try {
      const response = await fetch(`${RAG_API}/api/status`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      console.error('[IPC] Status error:', error)
      return { error: String(error) }
    }
  })

  // ── Settings ───────────────────────────────────────────────────────
  // MVP: Settings are stored in memory. Later: electron-store or sql.js.
  let settings: Record<string, unknown> = {}

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key?: string) => {
    if (key) return settings[key]
    return settings
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) => {
    settings[key] = value
    return true
  })
}
