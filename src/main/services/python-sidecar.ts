import { BrowserWindow, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import type { ServiceInfo } from '../../shared/types'

const PYTHON_PORT = 8001
const PYTHON_HEALTH_URL = `http://127.0.0.1:${PYTHON_PORT}/health`
const HEALTH_RETRIES = 30
const HEALTH_INTERVAL_MS = 1000

/**
 * Manages the RAG-Wissen Python API server as a sidecar process.
 *
 * Supports two modes:
 *   1. Dev mode: spawns `python3 -m uvicorn` from the RAG-Wissen source tree
 *   2. Production: uses a bundled thin Python venv (no torch/transformers)
 *      with EMBEDDING_PROVIDER=ollama for lightweight embedding via Ollama HTTP
 *
 * The Python sidecar talks to:
 *   - Qdrant (localhost:6333) for vector search
 *   - Ollama (localhost:11434) for LLM generation + embeddings
 *
 * Lifecycle:
 *   app.ready  → start() → waitForHealthy()
 *   before-quit → stop()
 */
export class PythonSidecar {
  private process: ChildProcess | null = null
  private healthy = false
  private ragWissenPath = ''
  private pythonPath = 'python3'
  private ollamaEmbeddingModel = 'mxbai-embed-large'

  configure(opts: {
    ragWissenPath?: string
    pythonPath?: string
    ollamaEmbeddingModel?: string
  }): void {
    if (opts.ragWissenPath) this.ragWissenPath = opts.ragWissenPath
    if (opts.pythonPath) this.pythonPath = opts.pythonPath
    if (opts.ollamaEmbeddingModel) this.ollamaEmbeddingModel = opts.ollamaEmbeddingModel
  }

  async start(): Promise<boolean> {
    // Check if already running externally
    if (await this.checkHealth()) {
      this.healthy = true
      console.log('[Python] Already running externally')
      return true
    }

    if (!this.ragWissenPath) {
      // Default: try common locations
      const candidates = [
        process.env.RAG_WISSEN_PATH,
        `${process.env.HOME}/projects/rag-wissen`,
      ].filter(Boolean) as string[]

      for (const candidate of candidates) {
        try {
          const { existsSync } = await import('fs')
          if (existsSync(`${candidate}/src/api_server.py`)) {
            this.ragWissenPath = candidate
            break
          }
        } catch {
          // continue
        }
      }
    }

    if (!this.ragWissenPath) {
      console.warn('[Python] RAG-Wissen path not configured and not found')
      return false
    }

    // Resolve Python binary: prefer bundled venv, fall back to system python
    const pythonBin = this.resolvePythonBinary()
    console.log(`[Python] Starting uvicorn from: ${this.ragWissenPath} (python: ${pythonBin})`)

    this.process = spawn(
      pythonBin,
      ['-m', 'uvicorn', 'src.api_server:app', '--host', '127.0.0.1', '--port', String(PYTHON_PORT)],
      {
        cwd: this.ragWissenPath,
        env: {
          ...process.env,
          QDRANT_HOST: '127.0.0.1',
          QDRANT_PORT: '6333',
          AUTH_REQUIRED: 'false',
          EMBEDDING_PROVIDER: 'ollama',
          OLLAMA_EMBEDDING_MODEL: this.ollamaEmbeddingModel,
          PYTHONUNBUFFERED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    this.process.stdout?.on('data', (data: Buffer) => {
      console.log(`[Python] ${data.toString().trim()}`)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      // uvicorn logs to stderr by default
      console.log(`[Python] ${data.toString().trim()}`)
    })

    this.process.on('exit', (code) => {
      console.log(`[Python] Process exited with code ${code}`)
      const wasCrash = code !== 0 && code !== null
      this.healthy = false
      this.process = null

      // Notify renderer immediately when sidecar crashes
      if (wasCrash) {
        console.error(`[Python] Unexpected exit (code ${code}) — notifying renderer`)
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('service:crashed', 'python', code)
        }
      }
    })

    this.healthy = await this.waitForHealthy()
    return this.healthy
  }

  async stop(): Promise<void> {
    if (!this.process) return

    console.log('[Python] Stopping sidecar...')
    this.process.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          console.warn('[Python] Force killing...')
          this.process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      this.process?.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    this.process = null
    this.healthy = false
  }

  getStatus(): ServiceInfo {
    return {
      name: 'python',
      status: this.healthy ? 'healthy' : this.process ? 'starting' : 'stopped',
      url: `http://127.0.0.1:${PYTHON_PORT}`,
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(PYTHON_HEALTH_URL)
      return response.ok
    } catch {
      return false
    }
  }

  private async waitForHealthy(): Promise<boolean> {
    for (let i = 0; i < HEALTH_RETRIES; i++) {
      if (await this.checkHealth()) {
        console.log(`[Python] Healthy after ${i + 1} checks`)
        return true
      }
      await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
    }
    console.error(`[Python] Not healthy after ${HEALTH_RETRIES} retries`)
    return false
  }

  /**
   * Resolve which Python binary to use.
   *
   * Priority:
   *   1. Bundled thin venv (production builds, extraResources/python-venv/)
   *   2. User-configured pythonPath
   *   3. System python3
   */
  private resolvePythonBinary(): string {
    // Check for bundled venv in production builds
    const resourcesPath = app.isPackaged
      ? process.resourcesPath
      : path.join(app.getAppPath(), '..')

    const bundledVenvPython = path.join(resourcesPath, 'python-venv', 'bin', 'python3')
    if (existsSync(bundledVenvPython)) {
      console.log(`[Python] Using bundled venv: ${bundledVenvPython}`)
      return bundledVenvPython
    }

    return this.pythonPath
  }
}
