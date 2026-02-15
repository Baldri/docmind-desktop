import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type { QdrantSidecar } from './services/qdrant-sidecar'
import type { PythonSidecar } from './services/python-sidecar'
import type { OllamaChecker } from './services/ollama-checker'

const RAG_API = 'http://127.0.0.1:8001'

// Dashboard API uses /api/v1 prefix (hybrid search, chat with sessions)
const DASHBOARD_API = `${RAG_API}/api/v1`

interface ServiceDeps {
  qdrant: QdrantSidecar
  python: PythonSidecar
  ollama: OllamaChecker
}

/**
 * Helper to make JSON POST requests to the RAG-Wissen API.
 * Handles auth bypass (AUTH_REQUIRED=false is set by PythonSidecar).
 */
async function postJSON(url: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}: ${text}`)
  }
  return response.json()
}

async function getJSON(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

/**
 * Registers all IPC handlers.
 *
 * Endpoint mapping (RAG-Wissen API):
 *   POST /api/v1/search/hybrid  → Hybrid search (BM25 + semantic)
 *   POST /search                → Semantic-only search
 *   POST /api/v1/chat/message   → Chat with RAG context + sources
 *   GET  /stats                 → Collection stats
 *   GET  /health                → Health check
 *   GET  /api/v1/files          → Document list
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

  // ── Search (Hybrid) ────────────────────────────────────────────────
  // POST /api/v1/search/hybrid
  // Body: { query, limit, keyword_weight, semantic_weight, domain?, language?, document_type? }
  // Returns: { query, total_results, keyword_weight, semantic_weight, results: [...] }
  ipcMain.handle(IPC_CHANNELS.SEARCH_HYBRID, async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const body: Record<string, unknown> = {
        query,
        limit: options?.limit ?? 10,
        keyword_weight: options?.keywordWeight ?? 0.3,
        semantic_weight: options?.semanticWeight ?? 0.7,
      }
      if (options?.domain) body.domain = options.domain
      if (options?.language) body.language = options.language

      const result = await postJSON(`${DASHBOARD_API}/search/hybrid`, body)
      return result
    } catch (error) {
      console.error('[IPC] Hybrid search error:', error)
      return { results: [], total_results: 0, error: String(error) }
    }
  })

  // ── Search (Semantic) ──────────────────────────────────────────────
  // POST /search (base API, semantic-only)
  // Body: { query, limit, file_types? }
  // Returns: { query, results: [...], total_results, search_time_ms }
  ipcMain.handle(IPC_CHANNELS.SEARCH_SEMANTIC, async (_event, query: string, options?: Record<string, unknown>) => {
    try {
      const body: Record<string, unknown> = {
        query,
        limit: options?.limit ?? 10,
      }
      const result = await postJSON(`${RAG_API}/search`, body)
      return result
    } catch (error) {
      console.error('[IPC] Semantic search error:', error)
      return { results: [], total_results: 0, error: String(error) }
    }
  })

  // ── Chat ───────────────────────────────────────────────────────────
  // POST /api/v1/chat/message
  // Body: { message, session_id?, include_sources, max_context_chunks }
  // Returns: { session_id, message: { role, content, timestamp, sources }, history_length }
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, message: string, sessionId?: string) => {
    try {
      const body: Record<string, unknown> = {
        message,
        include_sources: true,
        max_context_chunks: 5,
      }
      if (sessionId) body.session_id = sessionId

      const result = await postJSON(`${DASHBOARD_API}/chat/message`, body) as Record<string, unknown>

      // Normalize response for the renderer:
      // API returns { session_id, message: { role, content, sources }, history_length }
      // Renderer expects { content, sources, session_id }
      const msg = result.message as Record<string, unknown> | undefined
      return {
        content: msg?.content ?? '',
        sources: msg?.sources ?? [],
        sessionId: result.session_id,
        historyLength: result.history_length,
      }
    } catch (error) {
      console.error('[IPC] Chat error:', error)
      return { content: '', sources: [], error: String(error) }
    }
  })

  // ── Documents ──────────────────────────────────────────────────────

  // File stats: GET /api/v1/files/stats
  // Returns: { total, indexed, processing, failed, pending, by_domain, by_status }
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_LIST, async () => {
    try {
      const result = await getJSON(`${DASHBOARD_API}/files/stats`)
      return result
    } catch (error) {
      console.error('[IPC] Documents stats error:', error)
      return { total: 0, indexed: 0, pending: 0, failed: 0, error: String(error) }
    }
  })

  // Upload: opens native file dialog, then triggers indexing via POST /admin/index
  // RAG-Wissen is pull-based — files must exist on disk, then we trigger indexing.
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_UPLOAD, async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No focused window')

      const result = await dialog.showOpenDialog(win, {
        title: 'Dokumente hinzufuegen',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Dokumente',
            extensions: [
              'pdf', 'docx', 'doc', 'txt', 'md',
              'pptx', 'ppt', 'xlsx', 'xls', 'csv',
              'html', 'htm',
            ],
          },
          { name: 'Alle Dateien', extensions: ['*'] },
        ],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, count: 0 }
      }

      // Trigger indexing via Admin API
      const indexResult = await postJSON(`${RAG_API}/admin/index`, {
        file_paths: result.filePaths,
        priority: 5,
      })

      return { canceled: false, ...(indexResult as Record<string, unknown>) }
    } catch (error) {
      console.error('[IPC] Upload/index error:', error)
      return { canceled: false, count: 0, error: String(error) }
    }
  })

  // Index stats: GET /stats (Base API — Qdrant collection stats)
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_STATUS, async () => {
    try {
      const result = await getJSON(`${RAG_API}/stats`)
      return result
    } catch (error) {
      console.error('[IPC] Stats error:', error)
      return { error: String(error) }
    }
  })

  // Reindex: POST /api/v1/documents/{fileId}/reindex
  // Deletes vectors and resets file to pending status
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_REINDEX, async (_event, fileId?: number) => {
    try {
      if (fileId) {
        // Reindex single file
        const result = await postJSON(`${DASHBOARD_API}/documents/${fileId}/reindex`, {})
        return result
      }
      // Retry all failed files
      const result = await postJSON(`${DASHBOARD_API}/files/retry-bulk`, {
        status: 'failed',
      })
      return result
    } catch (error) {
      console.error('[IPC] Reindex error:', error)
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
