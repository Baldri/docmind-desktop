import { BrowserWindow, app } from 'electron'
import { autoUpdater, type UpdateInfo as ElectronUpdateInfo } from 'electron-updater'
import type { UpdateInfo } from '../../shared/types'

/**
 * Manages automatic application updates via GitHub Releases.
 *
 * Uses electron-updater with the publish config from electron-builder.yml.
 * Updates are NOT auto-downloaded — the user must explicitly confirm.
 *
 * Flow:
 *   1. App starts → checkForUpdates() after a short delay
 *   2. If update available → notify renderer via 'updater:status' event
 *   3. User clicks "Download" → downloadUpdate()
 *   4. Download completes → user clicks "Install & Restart" → installUpdate()
 *
 * macOS note: Auto-updates on macOS require code signing. Without it,
 * the app will detect updates but cannot apply them automatically.
 * Users can still download manually from GitHub Releases.
 */
export class AutoUpdaterService {
  private currentStatus: UpdateInfo = { status: 'idle' }
  private checkIntervalMs = 4 * 60 * 60 * 1000 // 4 hours
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Disable auto-download — let the user decide
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // Allow prerelease updates if running a prerelease version
    autoUpdater.allowPrerelease = false

    this.setupEventListeners()
  }

  /**
   * Start the update checker. Call once after app.ready.
   * Checks immediately (with a short delay), then periodically.
   */
  start(): void {
    // First check after 10 seconds (let the app settle)
    setTimeout(() => {
      this.checkForUpdates()
    }, 10_000)

    // Periodic checks
    this.intervalId = setInterval(() => {
      this.checkForUpdates()
    }, this.checkIntervalMs)

    console.log('[Updater] Auto-update service started')
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Check for updates. Safe to call multiple times.
   */
  async checkForUpdates(): Promise<void> {
    try {
      this.updateStatus({ status: 'checking' })
      await autoUpdater.checkForUpdates()
    } catch (error) {
      console.error('[Updater] Check failed:', error)
      this.updateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Start downloading the available update.
   * Only call after receiving 'available' status.
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('[Updater] Download failed:', error)
      this.updateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Install the downloaded update and restart the app.
   * Only call after receiving 'downloaded' status.
   */
  installUpdate(): void {
    console.log('[Updater] Installing update and restarting...')
    autoUpdater.quitAndInstall(false, true)
  }

  getStatus(): UpdateInfo {
    return this.currentStatus
  }

  // ── Event Listeners ─────────────────────────────────────────────────

  private setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[Updater] Checking for update...')
      this.updateStatus({ status: 'checking' })
    })

    autoUpdater.on('update-available', (info: ElectronUpdateInfo) => {
      console.log(`[Updater] Update available: v${info.version}`)
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined,
      })
    })

    autoUpdater.on('update-not-available', (info: ElectronUpdateInfo) => {
      console.log(`[Updater] Up to date (v${info.version})`)
      this.updateStatus({ status: 'not-available', version: info.version })
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      console.log(`[Updater] Downloading: ${percent}%`)
      this.updateStatus({
        status: 'downloading',
        downloadPercent: percent,
      })
    })

    autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      console.log(`[Updater] Update downloaded: v${info.version}`)
      this.updateStatus({
        status: 'downloaded',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined,
      })
    })

    autoUpdater.on('error', (error) => {
      console.error('[Updater] Error:', error.message)
      this.updateStatus({
        status: 'error',
        error: error.message,
      })
    })
  }

  /**
   * Update internal state and broadcast to all renderer windows.
   */
  private updateStatus(info: UpdateInfo): void {
    this.currentStatus = info
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('updater:status', info)
    }
  }
}
