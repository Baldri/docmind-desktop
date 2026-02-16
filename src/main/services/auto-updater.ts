import { BrowserWindow, app } from 'electron'
import { autoUpdater, type UpdateInfo as ElectronUpdateInfo } from 'electron-updater'
import type { UpdateInfo, SubscriptionTier } from '../../shared/types'

/**
 * Manages automatic application updates via GitHub Releases.
 *
 * Uses electron-updater with the publish config from electron-builder.yml.
 * Update behaviour depends on the subscription tier:
 *
 * **Pro / Team users** — Silent updates:
 *   1. App starts → checkForUpdates()
 *   2. Update available → auto-download in background
 *   3. Download completes → installs silently on next app quit
 *
 * **Free users** — Manual updates:
 *   1. App starts → checkForUpdates()
 *   2. Update available → notify renderer via 'updater:status' event
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
  private tier: SubscriptionTier = 'free'

  constructor() {
    // Default: Free mode — no auto-download
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = false

    this.setupEventListeners()
  }

  /**
   * Update the subscription tier — controls auto-download behaviour.
   * Called by main process when license status changes.
   */
  setTier(tier: SubscriptionTier): void {
    this.tier = tier
    // Pro and Team tiers get auto-download + auto-install
    const isPaid = tier === 'pro' || tier === 'team'
    autoUpdater.autoDownload = isPaid
    autoUpdater.autoInstallOnAppQuit = isPaid
    console.log(`[Updater] Tier set to ${tier} — autoDownload=${isPaid}`)
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
   * Only needed for Free tier — Pro/Team auto-downloads.
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
      console.log(`[Updater] Update available: v${info.version} (tier=${this.tier})`)
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined,
      })
      // Pro/Team users: autoDownload=true handles this automatically.
      // Free users: renderer shows banner, user must click "Download".
    })

    autoUpdater.on('update-not-available', (info: ElectronUpdateInfo) => {
      console.log(`[Updater] Up to date (v${info.version})`)
      this.updateStatus({ status: 'not-available', version: info.version })
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      // Only log every 10% for paid tiers (silent) to avoid spamming
      if (this.tier === 'free' || percent % 10 === 0) {
        console.log(`[Updater] Downloading: ${percent}%`)
      }
      this.updateStatus({
        status: 'downloading',
        downloadPercent: percent,
      })
    })

    autoUpdater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      console.log(`[Updater] Update downloaded: v${info.version} (tier=${this.tier})`)
      this.updateStatus({
        status: 'downloaded',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : undefined,
      })
      // Pro/Team users: autoInstallOnAppQuit=true → installs on next quit.
      // Free users: renderer shows "Install & Restart" button.
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
