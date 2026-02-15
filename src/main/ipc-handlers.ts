import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readdir, stat, writeFile } from 'fs/promises'
import { join, extname } from 'path'
import { IPC_CHANNELS } from '../shared/types'
import type { QdrantSidecar } from './services/qdrant-sidecar'
import type { PythonSidecar } from './services/python-sidecar'
import type { OllamaChecker } from './services/ollama-checker'

/** Supported file extensions for document indexing */
const INDEXABLE_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.txt', '.md',
  '.pptx', '.ppt', '.xlsx', '.xls', '.csv',
  '.html', '.htm',
])

/**
 * Recursively collect all indexable files from a directory.
 * Skips hidden directories (dot-prefixed) and non-indexable files.
 */
async function collectIndexableFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      // Skip hidden directories/files
      if (entry.name.startsWith('.')) continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (INDEXABLE_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  await walk(dirPath)
  return files
}

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

  // ── Chat (Streaming via SSE) ──────────────────────────────────────
  // POST /api/v1/chat/stream (SSE endpoint)
  // Body: { message, session_id?, include_sources, max_context_chunks }
  // SSE events:
  //   {"type": "token", "content": "..."} — incremental tokens
  //   {"type": "sources", "sources": [...]} — source citations
  //   {"type": "done", "session_id": "..."} — stream complete
  //   {"type": "error", "content": "..."} — error
  //
  // Main process reads SSE stream and forwards events to renderer via
  // webContents.send(). This keeps the renderer sandboxed while enabling
  // real-time token streaming.

  let activeAbortController: AbortController | null = null

  ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (event, message: string, sessionId?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { error: 'No window' }

    // Abort any previous stream
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }

    const controller = new AbortController()
    activeAbortController = controller

    try {
      const body: Record<string, unknown> = {
        message,
        include_sources: true,
        max_context_chunks: 5,
      }
      if (sessionId) body.session_id = sessionId

      const response = await fetch(`${DASHBOARD_API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      if (!response.body) {
        throw new Error('No response body for SSE stream')
      }

      // Read SSE stream and forward events to renderer
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines: each event is "data: {...}\n\n"
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const jsonStr = trimmed.slice(6) // remove "data: " prefix
          try {
            const event_data = JSON.parse(jsonStr) as Record<string, unknown>

            if (event_data.type === 'token') {
              win.webContents.send('chat:chunk', event_data.content)
            } else if (event_data.type === 'sources') {
              win.webContents.send('chat:sources', event_data.sources)
            } else if (event_data.type === 'done') {
              win.webContents.send('chat:complete', event_data.session_id)
            } else if (event_data.type === 'error') {
              win.webContents.send('chat:error', event_data.content)
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      return { streaming: true }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { aborted: true }
      }
      console.error('[IPC] Chat stream error:', error)
      win.webContents.send('chat:error', String(error))
      return { error: String(error) }
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.CHAT_ABORT, () => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    return true
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

  // Upload Folder: opens native directory dialog, recursively collects
  // indexable files, then triggers indexing via POST /admin/index.
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_UPLOAD_FOLDER, async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No focused window')

      const result = await dialog.showOpenDialog(win, {
        title: 'Ordner importieren',
        properties: ['openDirectory'],
        message: 'Waehle einen Ordner — alle unterstuetzten Dokumente werden indexiert.',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true, count: 0 }
      }

      const dirPath = result.filePaths[0]
      console.log(`[IPC] Scanning directory: ${dirPath}`)

      const filePaths = await collectIndexableFiles(dirPath)
      console.log(`[IPC] Found ${filePaths.length} indexable files`)

      if (filePaths.length === 0) {
        return { canceled: false, count: 0, message: 'Keine unterstuetzten Dateien im Ordner gefunden.' }
      }

      // Trigger indexing via Admin API
      const indexResult = await postJSON(`${RAG_API}/admin/index`, {
        file_paths: filePaths,
        priority: 5,
      })

      return {
        canceled: false,
        count: filePaths.length,
        directory: dirPath,
        ...(indexResult as Record<string, unknown>),
      }
    } catch (error) {
      console.error('[IPC] Folder upload/index error:', error)
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

  // Index by paths: accepts file paths directly (used by drag & drop)
  // Validates extensions before sending to the API.
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_INDEX_PATHS, async (_event, paths: string[]) => {
    try {
      if (!Array.isArray(paths) || paths.length === 0) {
        return { count: 0, error: 'Keine Pfade angegeben' }
      }

      // Filter to only indexable extensions
      const validPaths = paths.filter((p) => {
        const ext = extname(p).toLowerCase()
        return INDEXABLE_EXTENSIONS.has(ext)
      })

      if (validPaths.length === 0) {
        return { count: 0, message: 'Keine unterstuetzten Dateitypen in der Auswahl.' }
      }

      const result = await postJSON(`${RAG_API}/admin/index`, {
        file_paths: validPaths,
        priority: 5,
      })

      return { count: validPaths.length, ...(result as Record<string, unknown>) }
    } catch (error) {
      console.error('[IPC] Index paths error:', error)
      return { count: 0, error: String(error) }
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

  // ── Export ──────────────────────────────────────────────────────────
  // Save file dialog + write content to disk.
  // Used by Chat Export (Markdown) — renderer sends the formatted content,
  // main process handles the native Save dialog and fs write.
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_SAVE_FILE,
    async (_event, content: string, defaultFilename: string, filters?: Electron.FileFilter[]) => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        if (!win) throw new Error('No focused window')

        const result = await dialog.showSaveDialog(win, {
          title: 'Exportieren',
          defaultPath: defaultFilename,
          filters: filters ?? [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'Text', extensions: ['txt'] },
            { name: 'Alle Dateien', extensions: ['*'] },
          ],
        })

        if (result.canceled || !result.filePath) {
          return { canceled: true }
        }

        await writeFile(result.filePath, content, 'utf-8')
        return { canceled: false, filePath: result.filePath }
      } catch (error) {
        console.error('[IPC] Export save error:', error)
        return { canceled: false, error: String(error) }
      }
    },
  )
}
