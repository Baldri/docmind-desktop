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
 *   - List of available models
 *   - Recommended model info for the Setup Wizard
 *
 * Recommended model: qwen2.5:7b-instruct-q4_K_M
 * (good quality/speed balance for education use cases)
 */
export class OllamaChecker {
  private healthy = false
  private models: OllamaModel[] = []
  private ollamaUrl = OLLAMA_DEFAULT_URL

  configure(opts: { ollamaUrl?: string }): void {
    if (opts.ollamaUrl) this.ollamaUrl = opts.ollamaUrl
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
        m.name.startsWith('llama3')
    )
  }
}
