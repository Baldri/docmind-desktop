import type { ServiceInfo } from '../../shared/types'

const OLLAMA_DEFAULT_URL = 'http://localhost:11434'
const OLLAMA_TAGS_URL = `${OLLAMA_DEFAULT_URL}/api/tags`

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
}

/**
 * Checks if Ollama is installed and running.
 *
 * Unlike Qdrant and Python, we don't manage Ollama's lifecycle —
 * the user must install it themselves. This checker provides:
 *   - Health status (running or not)
 *   - List of available models (LLM + embedding)
 *   - Recommended model info for the Setup Wizard
 *   - Embedding model availability check (required for search)
 *
 * Recommended LLM model: qwen2.5:7b-instruct-q4_K_M
 * Recommended embedding model: nomic-embed-text (768d) or mxbai-embed-large (1024d)
 */
export class OllamaChecker {
  private healthy = false
  private models: OllamaModel[] = []
  private ollamaUrl = OLLAMA_DEFAULT_URL
  private embeddingModel = 'mxbai-embed-large'

  configure(opts: { ollamaUrl?: string; embeddingModel?: string }): void {
    if (opts.ollamaUrl) this.ollamaUrl = opts.ollamaUrl
    if (opts.embeddingModel) this.embeddingModel = opts.embeddingModel
  }

  async check(): Promise<boolean> {
    try {
      const tagsUrl = `${this.ollamaUrl}/api/tags`
      const response = await fetch(tagsUrl)
      if (!response.ok) {
        this.healthy = false
        return false
      }

      const data = (await response.json()) as { models?: OllamaModel[] }
      this.models = data.models ?? []
      this.healthy = true

      console.log(`[Ollama] Found ${this.models.length} models:`)
      this.models.forEach((m) => {
        const sizeMB = Math.round(m.size / 1024 / 1024)
        console.log(`  - ${m.name} (${sizeMB} MB)`)
      })

      return true
    } catch {
      console.warn('[Ollama] Not reachable — user needs to install Ollama')
      this.healthy = false
      return false
    }
  }

  getStatus(): ServiceInfo {
    return {
      name: 'ollama',
      status: this.healthy ? 'healthy' : 'stopped',
      url: this.ollamaUrl,
    }
  }

  getModels(): OllamaModel[] {
    return this.models
  }

  hasRecommendedModel(): boolean {
    return this.models.some(
      (m) =>
        m.name.startsWith('qwen2.5:7b') ||
        m.name.startsWith('qwen2.5:14b') ||
        m.name.startsWith('llama3'),
    )
  }

  /**
   * Check if the configured embedding model is available in Ollama.
   * Required for search functionality (EMBEDDING_PROVIDER=ollama).
   */
  hasEmbeddingModel(): boolean {
    return this.models.some((m) => m.name.startsWith(this.embeddingModel))
  }

  /**
   * Get the configured embedding model name.
   */
  getEmbeddingModel(): string {
    return this.embeddingModel
  }

  /**
   * Get list of available embedding-capable models.
   * Embedding models are typically smaller and have "embed" in their name.
   */
  getEmbeddingModels(): OllamaModel[] {
    return this.models.filter(
      (m) =>
        m.name.includes('embed') ||
        m.name.includes('nomic') ||
        m.name.includes('mxbai') ||
        m.name.includes('minilm'),
    )
  }
}
