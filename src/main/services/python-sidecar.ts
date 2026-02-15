import { BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import type { ServiceInfo } from '../../shared/types'

const PYTHON_PORT = 8001
const PYTHON_HEALTH_URL = `http://127.0.0.1:${PYTHON_PORT}/health`
const HEALTH_RETRIES = 30
const HEALTH_INTERVAL_MS = 1000

/**
 * Manages the RAG-Wissen Python API server as a sidecar process.
 *
 * For the MVP, this spawns `python3 -m uvicorn` pointing to the existing
 * RAG-Wissen codebase. Later: bundled Python via PyInstaller.
 *
 * The Python sidecar talks to:
 *   - Qdrant (localhost:6333) for vector search
 *   - Ollama (localhost:11434) for LLM generation
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

  configure(opts: { ragWissenPath?: string; pythonPath?: string }): void {
    if (opts.ragWissenPath) this.ragWissenPath = opts.ragWissenPath
    if (opts.pythonPath) this.pythonPath = opts.pythonPath
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

    console.log(`[Python] Starting uvicorn from: ${this.ragWissenPath}`)

    this.process = spawn(
      this.pythonPath,
      ['-m', 'uvicorn', 'src.api_server:app', '--host', '127.0.0.1', '--port', String(PYTHON_PORT)],
      {
        cwd: this.ragWissenPath,
        env: {
          ...process.env,
          QDRANT_HOST: '127.0.0.1',
          QDRANT_PORT: '6333',
          AUTH_REQUIRED: 'false',
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
}
