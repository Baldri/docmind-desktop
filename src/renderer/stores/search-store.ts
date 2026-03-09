import { create } from 'zustand'
import type { HybridSearchResult, PipelineSettings } from '../../shared/types'
import { DEFAULT_PIPELINE_SETTINGS } from '../../shared/types'
import { friendlyError } from '../lib/error-messages'

interface HybridSearchResponse {
  query: string
  total_results: number
  keyword_weight: number
  semantic_weight: number
  results: HybridSearchResult[]
  error?: string
}

interface SearchFilters {
  domain: string    // '' = all
  language: string  // '' = all
  limit: number
}

interface SearchState {
  query: string
  results: HybridSearchResult[]
  isSearching: boolean
  error: string | null
  filters: SearchFilters

  setQuery: (query: string) => void
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void
  search: (query: string) => Promise<void>
  clear: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  error: null,
  filters: { domain: '', language: '', limit: 10 },

  setQuery: (query: string) => set({ query }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  search: async (query: string) => {
    if (!query.trim()) return

    set({ query, isSearching: true, error: null })

    try {
      // Load pipeline settings from persistent store
      const pipeline = await window.electronAPI.settings.get('pipeline') as PipelineSettings | undefined
      const p = { ...DEFAULT_PIPELINE_SETTINGS, ...pipeline }
      const { filters } = get()

      const options: Record<string, unknown> = {
        limit: filters.limit,
        keywordWeight: p.keywordWeight,
        semanticWeight: p.semanticWeight,
        mmrEnabled: p.mmrEnabled,
        mmrLambda: p.mmrLambda,
        intentEnabled: p.intentEnabled,
        rerankingEnabled: p.rerankingEnabled,
      }
      if (filters.domain) options.domain = filters.domain
      if (filters.language) options.language = filters.language

      const response = await window.electronAPI.search.hybrid(query, options) as HybridSearchResponse

      if (response.error) {
        throw new Error(response.error)
      }

      set({
        results: response.results ?? [],
        isSearching: false,
      })
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Suche fehlgeschlagen'
      set({
        isSearching: false,
        error: friendlyError(raw),
      })
    }
  },

  clear: () => set({ query: '', results: [], error: null }),
}))
