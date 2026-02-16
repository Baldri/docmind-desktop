import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { registerIPCHandlers } from './ipc-handlers'
import { QdrantSidecar } from './services/qdrant-sidecar'
import { PythonSidecar } from './services/python-sidecar'
import { OllamaChecker } from './services/ollama-checker'
import { AutoUpdaterService } from './services/auto-updater'
import { getLicenseService } from './services/license-activation'

let mainWindow: BrowserWindow | null = null

// Service singletons — initialized on app.ready, cleaned up on before-quit
const qdrant = new QdrantSidecar()
const python = new PythonSidecar()
const ollama = new OllamaChecker()

// Auto-updater — only active in packaged builds
const updater = app.isPackaged ? new AutoUpdaterService() : null

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Docmind',
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 16 } }
      : { titleBarStyle: 'default' }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    backgroundColor: '#0f172a', // Dark theme default (slate-900)
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Prevent DevTools in production
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }

  // Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = ['http://localhost:5173', 'file://']
    if (!allowedOrigins.some((origin) => url.startsWith(origin))) {
      event.preventDefault()
      console.warn(`[Security] Blocked navigation to: ${url}`)
    }
  })

  // Block new window creation
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Security] Blocked window.open to: ${url}`)
    return { action: 'deny' }
  })

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── App Lifecycle ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.setName('Docmind')
  }

  // Register IPC handlers (must happen before window creation)
  registerIPCHandlers({ qdrant, python, ollama, updater: updater ?? undefined })

  // Set Content Security Policy
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  const connectSrc = isDev
    ? "'self' http://localhost:* http://127.0.0.1:* ws://localhost:*"
    : "'self' http://localhost:* http://127.0.0.1:*"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src ${connectSrc}; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
        ],
      },
    })
  })

  // Start services in parallel
  console.log('[Docmind] Starting services...')
  const serviceResults = await Promise.allSettled([
    qdrant.start(),
    python.start(),
    ollama.check(),
  ])

  serviceResults.forEach((result, i) => {
    const names = ['Qdrant', 'Python', 'Ollama']
    if (result.status === 'fulfilled') {
      console.log(`[Docmind] ${names[i]}: ${result.value ? 'ready' : 'not available'}`)
    } else {
      console.error(`[Docmind] ${names[i]} failed:`, result.reason)
    }
  })

  createWindow()

  // Start auto-updater after window is created (packaged builds only)
  // Sync updater tier with license status for silent/manual update behaviour
  if (updater) {
    const license = getLicenseService()
    updater.setTier(license.getCurrentTier())
    updater.start()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Guard against async quit: Electron does NOT await async callbacks in
// before-quit. We must preventDefault(), run cleanup, then re-trigger quit.
let isQuitting = false

app.on('before-quit', (event) => {
  if (isQuitting) return // Already cleaning up — let it through

  event.preventDefault()
  isQuitting = true

  console.log('[Docmind] Shutting down services...')
  updater?.stop()
  Promise.allSettled([qdrant.stop(), python.stop()])
    .then((results) => {
      results.forEach((r, i) => {
        const names = ['Qdrant', 'Python']
        if (r.status === 'rejected') {
          console.error(`[Docmind] ${names[i]} shutdown error:`, r.reason)
        }
      })
    })
    .finally(() => {
      app.quit()
    })
})

// ── Error Handling ───────────────────────────────────────────────────────
// In production, uncaught exceptions would silently crash — the user sees
// only a frozen or blank window. Show a native error dialog before exiting
// so they at least know what happened.

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)

  if (app.isPackaged) {
    const { dialog: errorDialog } = require('electron')
    errorDialog.showErrorBox(
      'Docmind — Unerwarteter Fehler',
      `Ein unerwarteter Fehler ist aufgetreten:\n\n${error.message}\n\nDocmind wird beendet. Bitte starte die App neu.`,
    )
    app.exit(1)
  }
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
