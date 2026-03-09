import { useSearchStore } from './search-store'
import { DEFAULT_PIPELINE_SETTINGS } from '../../shared/types'

// Access store methods outside React
const store = useSearchStore

function resetStore() {
  store.setState({
    query: '',
    results: [],
    isSearching: false,
    error: null,
    filters: { domain: '', language: '', limit: 10 },
  })
}

describe('search-store', () => {
  beforeEach(() => {
    resetStore()
  })

  it('has correct initial state', () => {
    const state = store.getState()
    expect(state.query).toBe('')
    expect(state.results).toEqual([])
    expect(state.isSearching).toBe(false)
    expect(state.error).toBeNull()
    expect(state.filters).toEqual({ domain: '', language: '', limit: 10 })
  })

  it('setQuery updates query', () => {
    store.getState().setQuery('test query')
    expect(store.getState().query).toBe('test query')
  })

  it('setFilter updates a single filter', () => {
    store.getState().setFilter('domain', 'Education')
    expect(store.getState().filters.domain).toBe('Education')
    // Other filters unchanged
    expect(store.getState().filters.language).toBe('')
    expect(store.getState().filters.limit).toBe(10)
  })

  it('clear resets query, results, and error', () => {
    store.setState({ query: 'test', results: [{ file_name: 'a.pdf', content: 'x', combined_score: 0.5, keyword_score: 0.3, semantic_score: 0.7 }], error: 'oops' })
    store.getState().clear()

    const state = store.getState()
    expect(state.query).toBe('')
    expect(state.results).toEqual([])
    expect(state.error).toBeNull()
  })

  it('search does nothing for empty query', async () => {
    await store.getState().search('   ')
    expect(store.getState().isSearching).toBe(false)
    expect(window.electronAPI.search.hybrid).not.toHaveBeenCalled()
  })

  it('search sends pipeline settings to backend', async () => {
    const mockPipeline = { ...DEFAULT_PIPELINE_SETTINGS, keywordWeight: 0.4, semanticWeight: 0.6 }
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(mockPipeline)
    vi.mocked(window.electronAPI.search.hybrid).mockResolvedValue({
      query: 'test',
      total_results: 0,
      keyword_weight: 0.4,
      semantic_weight: 0.6,
      results: [],
    })

    await store.getState().search('test')

    expect(window.electronAPI.search.hybrid).toHaveBeenCalledWith('test', expect.objectContaining({
      keywordWeight: 0.4,
      semanticWeight: 0.6,
      mmrEnabled: false,
    }))
  })

  it('search includes domain filter when set', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(DEFAULT_PIPELINE_SETTINGS)
    vi.mocked(window.electronAPI.search.hybrid).mockResolvedValue({
      query: 'test',
      total_results: 0,
      keyword_weight: 0.3,
      semantic_weight: 0.7,
      results: [],
    })

    store.getState().setFilter('domain', 'Business')
    await store.getState().search('test')

    expect(window.electronAPI.search.hybrid).toHaveBeenCalledWith('test', expect.objectContaining({
      domain: 'Business',
    }))
  })

  it('search sets error on failure', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(DEFAULT_PIPELINE_SETTINGS)
    vi.mocked(window.electronAPI.search.hybrid).mockRejectedValue(new Error('ECONNREFUSED'))

    await store.getState().search('test')

    expect(store.getState().isSearching).toBe(false)
    expect(store.getState().error).toBeTruthy()
  })

  it('search sets error from response.error', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(DEFAULT_PIPELINE_SETTINGS)
    vi.mocked(window.electronAPI.search.hybrid).mockResolvedValue({
      query: 'test',
      total_results: 0,
      keyword_weight: 0.3,
      semantic_weight: 0.7,
      results: [],
      error: 'Backend error',
    })

    await store.getState().search('test')

    expect(store.getState().isSearching).toBe(false)
    expect(store.getState().error).toBeTruthy()
  })
})
