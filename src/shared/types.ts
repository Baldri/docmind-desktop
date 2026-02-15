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
  DOCUMENTS_UPLOAD_FOLDER: 'documents:uploadFolder',
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
  domain?: string
  language?: string
}

/**
 * Hybrid search result from POST /api/v1/search/hybrid.
 * Fields match the RAG-Wissen HybridSearchResult schema.
 */
export interface HybridSearchResult {
  file_name: string
  content: string
  combined_score: number
  keyword_score: number
  semantic_score: number
  domain?: string
  language?: string
  document_type?: string
  keywords?: string[]
}

/**
 * Semantic search result from POST /search.
 * Fields match the RAG-Wissen SearchResponse schema.
 */
export interface SemanticSearchResult {
  content: string
  score: number
  file_name: string
  file_type?: string
  domain?: string
  language?: string
  keywords?: string[]
}

// ── Chat ────────────────────────────────────────────────────────────────

/**
 * Source document returned with a chat answer.
 * From POST /api/v1/chat/message → message.sources[].
 */
export interface ChatSource {
  file_name: string
  content: string
  score: number
  domain?: string
  language?: string
  document_type?: string
}

export type FeedbackRating = 'positive' | 'negative' | null

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  sources?: ChatSource[]
  sessionId?: string
  feedback?: FeedbackRating
}

/**
 * Normalized chat response from IPC handler.
 */
export interface ChatResponse {
  content: string
  sources: ChatSource[]
  sessionId?: string
  historyLength?: number
  error?: string
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
