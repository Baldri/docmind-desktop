import { DEFAULT_PIPELINE_SETTINGS, DEFAULT_SETTINGS } from './types'

describe('DEFAULT_PIPELINE_SETTINGS', () => {
  it('has keyword + semantic weights summing to 1', () => {
    expect(DEFAULT_PIPELINE_SETTINGS.keywordWeight + DEFAULT_PIPELINE_SETTINGS.semanticWeight).toBe(1)
  })

  it('has sensible defaults', () => {
    expect(DEFAULT_PIPELINE_SETTINGS.mmrEnabled).toBe(false)
    expect(DEFAULT_PIPELINE_SETTINGS.intentEnabled).toBe(false)
    expect(DEFAULT_PIPELINE_SETTINGS.rerankingEnabled).toBe(false)
    expect(DEFAULT_PIPELINE_SETTINGS.maxContextChunks).toBe(5)
    expect(DEFAULT_PIPELINE_SETTINGS.mmrLambda).toBe(0.5)
  })
})

describe('DEFAULT_SETTINGS', () => {
  it('embeds pipeline defaults', () => {
    expect(DEFAULT_SETTINGS.pipeline).toEqual(DEFAULT_PIPELINE_SETTINGS)
  })

  it('uses dark theme by default', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark')
  })
})
