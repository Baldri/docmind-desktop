// ── IPC Channel Definitions ──────────────────────────────────────────────
// All communication between Main ↔ Renderer goes through these channels.
// Adding a new feature? Add the channel here first, then implement in
// main/ipc-handlers.ts and preload/index.ts.

export const IPC_CHANNELS = {
  // Search
  SEARCH_HYBRID: 'search:hybrid',
  SEARCH_SEMANTIC: 'search:semantic',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',

  // Documents
  DOCUMENTS_LIST: 'documents:list',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_STATUS: 'documents:status',
  DOCUMENTS_REINDEX: 'documents:reindex',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Services
  SERVICES_STATUS: 'services:status',
  SERVICES_RESTART: 'services:restart',
} as const

// ── Service Status ──────────────────────────────────────────────────────

export type ServiceName = 'qdrant' | 'python' | 'ollama'

export type ServiceStatus = 'starting' | 'healthy' | 'unhealthy' | 'stopped'

export interface ServiceInfo {
  name: ServiceName
  status: ServiceStatus
  url: string
  version?: string
  error?: string
}

// ── Search ──────────────────────────────────────────────────────────────

export interface SearchOptions {
  limit?: number
  keywordWeight?: number
  semanticWeight?: number
}

export interface SearchResult {
  id: string
  content: string
  score: number
  metadata: {
    source: string
    filename: string
    chunkIndex?: number
    [key: string]: unknown
  }
}

// ── Chat ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  sources?: SearchResult[]
}

export interface ChatResponse {
  content: string
  sources: SearchResult[]
}

// ── Documents ───────────────────────────────────────────────────────────

export interface DocumentInfo {
  id: string
  filename: string
  filepath: string
  size: number
  status: 'indexed' | 'pending' | 'error'
  indexedAt?: number
  chunkCount?: number
  error?: string
}

// ── Settings ────────────────────────────────────────────────────────────

export interface AppSettings {
  ollamaUrl: string
  ollamaModel: string
  pythonPath: string
  ragWissenPath: string
  watchDirectories: string[]
  theme: 'dark' | 'light' | 'system'
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b-instruct-q4_K_M',
  pythonPath: 'python3',
  ragWissenPath: '',
  watchDirectories: [],
  theme: 'dark',
}
