import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_PIPELINE_SETTINGS } from '../shared/types'
import type { AppSettings, PipelineSettings } from '../shared/types'

// In-memory mock for electron-store
let mockData: Record<string, unknown> = {}

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private defaults: Record<string, unknown>

      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.defaults = opts?.defaults ?? {}
        mockData = { ...this.defaults }
      }

      get(key: string) {
        return key in mockData ? mockData[key] : (this.defaults as Record<string, unknown>)[key]
      }

      set(key: string, value: unknown) {
        mockData[key] = value
      }

      get store() {
        return { ...this.defaults, ...mockData } as AppSettings
      }
    },
  }
})

// Import AFTER mock is registered
const { getSetting, setSetting, getAllSettings, getPipelineSettings, setPipelineSetting } =
  await import('./settings-store')

describe('settings-store', () => {
  beforeEach(() => {
    // Reset mock data to defaults
    mockData = { ...DEFAULT_SETTINGS }
  })

  it('getSetting returns default values', () => {
    expect(getSetting('theme')).toBe('dark')
    expect(getSetting('ollamaModel')).toBe('qwen2.5:7b-instruct-q4_K_M')
  })

  it('setSetting persists value', () => {
    setSetting('theme', 'light')
    expect(getSetting('theme')).toBe('light')
  })

  it('getAllSettings returns full config', () => {
    const all = getAllSettings()
    expect(all).toHaveProperty('theme')
    expect(all).toHaveProperty('pipeline')
    expect(all).toHaveProperty('ollamaUrl')
  })

  it('getPipelineSettings returns defaults', () => {
    const pipeline = getPipelineSettings()
    expect(pipeline).toEqual(DEFAULT_PIPELINE_SETTINGS)
  })

  it('setPipelineSetting updates single field', () => {
    setPipelineSetting('mmrEnabled', true)
    const pipeline = getPipelineSettings()
    expect(pipeline.mmrEnabled).toBe(true)
    // Other fields unchanged
    expect(pipeline.keywordWeight).toBe(0.3)
    expect(pipeline.semanticWeight).toBe(0.7)
  })

  it('setPipelineSetting preserves other fields', () => {
    setPipelineSetting('maxContextChunks', 15)
    setPipelineSetting('mmrLambda', 0.8)

    const pipeline = getPipelineSettings()
    expect(pipeline.maxContextChunks).toBe(15)
    expect(pipeline.mmrLambda).toBe(0.8)
    expect(pipeline.intentEnabled).toBe(false)
  })

  it('pipeline keyword + semantic weights default to 1.0', () => {
    const pipeline = getPipelineSettings()
    expect(pipeline.keywordWeight + pipeline.semanticWeight).toBe(1)
  })
})
