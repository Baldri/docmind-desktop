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
  DOCUMENTS_INDEX_PATHS: 'documents:indexPaths',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Services
  SERVICES_STATUS: 'services:status',
  SERVICES_RESTART: 'services:restart',

  // Export
  EXPORT_SAVE_FILE: 'export:saveFile',

  // Auto-Update
  UPDATE_CHECK: 'updater:check',
  UPDATE_DOWNLOAD: 'updater:download',
  UPDATE_INSTALL: 'updater:install',

  // License
  LICENSE_ACTIVATE: 'license:activate',
  LICENSE_DEACTIVATE: 'license:deactivate',
  LICENSE_GET_STATUS: 'license:getStatus',

  // Feature Gate
  FEATURE_CHECK: 'feature:check',
  FEATURE_GET_TIER: 'feature:getTier',
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

// ── Auto-Update ─────────────────────────────────────────────────────

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateInfo {
  status: UpdateStatus
  version?: string
  releaseNotes?: string
  downloadPercent?: number
  error?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:7b-instruct-q4_K_M',
  pythonPath: 'python3',
  ragWissenPath: '',
  watchDirectories: [],
  theme: 'dark',
}

// ── Subscription & Feature Gating ──────────────────────────────────────

/**
 * Subscription tiers (ascending order of capability):
 *   free  → Basic local usage (was "community" in early builds)
 *   pro   → Power users, freelancers (CHF 24/Mt.)
 *   team  → Teams & KMU, min. 5 users (CHF 69/User/Mt.)
 *
 * Enterprise is handled off-app (custom contracts, no license key).
 */
export type SubscriptionTier = 'free' | 'pro' | 'team'

/**
 * All gated features.
 * Each feature is unlocked at a specific tier level (see feature-gate-manager).
 */
export type DocmindFeature =
  // Pro features
  | 'folder-import'
  | 'drag-drop-import'
  | 'chat-export'
  | 'unlimited-documents'
  | 'auto-update-install'
  | 'cloud-apis'
  | 'agentic-rag'
  | 'mcp-integration'
  | 'prompt-templates'
  // Team features
  | 'team-workspaces'
  | 'shared-knowledge-base'
  | 'rbac'
  | 'usage-tracking'
  | 'audit-logs'
  | 'sso'

export interface LicenseStatus {
  tier: SubscriptionTier
  isActivated: boolean
  key?: string
  activatedAt?: number
}

export interface FeatureGateResult {
  allowed: boolean
  reason?: string
  requiredTier?: SubscriptionTier
}

/** Document limit for Free tier */
export const FREE_DOCUMENT_LIMIT = 50

/**
 * @deprecated Use FREE_DOCUMENT_LIMIT instead. Kept for backward compatibility.
 */
export const COMMUNITY_DOCUMENT_LIMIT = FREE_DOCUMENT_LIMIT
