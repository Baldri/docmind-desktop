import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { ServiceInfo } from '../../shared/types'

const QDRANT_PORT = 6333
const QDRANT_HEALTH_URL = `http://127.0.0.1:${QDRANT_PORT}/healthz`
const HEALTH_RETRIES = 20
const HEALTH_INTERVAL_MS = 500

/**
 * Manages the Qdrant vector database as a sidecar process.
 *
 * For the MVP, Qdrant runs as a bundled Rust binary (no Docker required).
 * Binary is expected in `extraResources/bin/qdrant` (macOS arm64 for now).
 *
 * Lifecycle:
 *   app.ready  → start() → waitForHealthy()
 *   before-quit → stop()
 *
 * Storage lives in `userData/qdrant_storage/` so it persists across updates.
 */
export class QdrantSidecar {
  private process: ChildProcess | null = null
  private healthy = false

  /** Absolute path to the qdrant storage directory */
  private get storagePath(): string {
    const dir = join(app.getPath('userData'), 'qdrant_storage')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /** Resolve binary path — bundled (packaged) or dev fallback */
  private get binaryPath(): string {
    if (app.isPackaged) {
      // electron-builder extraResources → process.resourcesPath/bin/qdrant
      return join(process.resourcesPath, 'bin', 'qdrant')
    }
    // Dev mode: try local bin directory or system-installed qdrant
    const localBin = join(app.getAppPath(), 'bin', process.platform, process.arch, 'qdrant')
    if (existsSync(localBin)) {
      return localBin
    }
    // Fallback: assume qdrant is running externally (e.g. via Docker in dev)
    return ''
  }

  async start(): Promise<boolean> {
    // If already running externally, just check health
    if (await this.checkHealth()) {
      this.healthy = true
      console.log('[Qdrant] Already running externally')
      return true
    }

    const binary = this.binaryPath
    if (!binary) {
      console.warn('[Qdrant] No binary found — assuming external Qdrant instance')
      return false
    }

    if (!existsSync(binary)) {
      console.error(`[Qdrant] Binary not found at: ${binary}`)
      return false
    }

    console.log(`[Qdrant] Starting sidecar: ${binary}`)
    console.log(`[Qdrant] Storage: ${this.storagePath}`)

    this.process = spawn(binary, [], {
      env: {
        ...process.env,
        QDRANT__STORAGE__STORAGE_PATH: this.storagePath,
        QDRANT__SERVICE__HTTP_PORT: String(QDRANT_PORT),
        QDRANT__SERVICE__GRPC_PORT: '6334',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      console.log(`[Qdrant] ${data.toString().trim()}`)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error(`[Qdrant] ${data.toString().trim()}`)
    })

    this.process.on('exit', (code) => {
      console.log(`[Qdrant] Process exited with code ${code}`)
      this.healthy = false
      this.process = null
    })

    // Wait for health check to pass
    this.healthy = await this.waitForHealthy()
    return this.healthy
  }

  async stop(): Promise<void> {
    if (!this.process) return

    console.log('[Qdrant] Stopping sidecar...')
    this.process.kill('SIGTERM')

    // Give it 5 seconds to shut down gracefully
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          console.warn('[Qdrant] Force killing...')
          this.process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      this.process?.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
    })

    this.process = null
    this.healthy = false
  }

  getStatus(): ServiceInfo {
    return {
      name: 'qdrant',
      status: this.healthy ? 'healthy' : this.process ? 'starting' : 'stopped',
      url: `http://127.0.0.1:${QDRANT_PORT}`,
    }
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(QDRANT_HEALTH_URL)
      return response.ok
    } catch {
      return false
    }
  }

  private async waitForHealthy(): Promise<boolean> {
    for (let i = 0; i < HEALTH_RETRIES; i++) {
      if (await this.checkHealth()) {
        console.log(`[Qdrant] Healthy after ${i + 1} checks`)
        return true
      }
      await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
    }
    console.error(`[Qdrant] Not healthy after ${HEALTH_RETRIES} retries`)
    return false
  }
}
