import '@testing-library/jest-dom/vitest'

// Mock window.electronAPI for renderer tests
const noopPromise = () => Promise.resolve(undefined)

const mockElectronAPI = {
  search: {
    hybrid: vi.fn(noopPromise),
    semantic: vi.fn(noopPromise),
  },
  chat: {
    send: vi.fn(noopPromise),
    abort: vi.fn(noopPromise),
    onChunk: vi.fn(() => vi.fn()),
    onSources: vi.fn(() => vi.fn()),
    onComplete: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
  },
  documents: {
    list: vi.fn(noopPromise),
    upload: vi.fn(noopPromise),
    uploadFolder: vi.fn(noopPromise),
    getStatus: vi.fn(noopPromise),
    reindex: vi.fn(noopPromise),
    indexPaths: vi.fn(noopPromise),
  },
  settings: {
    get: vi.fn(noopPromise),
    set: vi.fn(noopPromise),
  },
  services: {
    getStatus: vi.fn(() => Promise.resolve([])),
    restart: vi.fn(noopPromise),
    onServiceCrashed: vi.fn(() => vi.fn()),
  },
  export: {
    saveFile: vi.fn(noopPromise),
  },
  updater: {
    check: vi.fn(noopPromise),
    download: vi.fn(noopPromise),
    install: vi.fn(noopPromise),
    onStatus: vi.fn(() => vi.fn()),
  },
  license: {
    activate: vi.fn(() => Promise.resolve({ valid: false })),
    deactivate: vi.fn(() => Promise.resolve({ tier: 'free' as const })),
    getStatus: vi.fn(() => Promise.resolve({ tier: 'free' as const, isActivated: false })),
  },
  featureGate: {
    check: vi.fn(() => Promise.resolve({ allowed: true })),
    getTier: vi.fn(() => Promise.resolve('free' as const)),
  },
  platform: 'darwin' as const,
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
