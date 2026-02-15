import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { registerIPCHandlers } from './ipc-handlers'
import { QdrantSidecar } from './services/qdrant-sidecar'
import { PythonSidecar } from './services/python-sidecar'
import { OllamaChecker } from './services/ollama-checker'

let mainWindow: BrowserWindow | null = null

// Service singletons — initialized on app.ready, cleaned up on before-quit
const qdrant = new QdrantSidecar()
const python = new PythonSidecar()
const ollama = new OllamaChecker()

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
      sandbox: true,
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
  registerIPCHandlers({ qdrant, python, ollama })

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

app.on('before-quit', async () => {
  console.log('[Docmind] Shutting down services...')
  await Promise.allSettled([qdrant.stop(), python.stop()])
})

// ── Error Handling ───────────────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
