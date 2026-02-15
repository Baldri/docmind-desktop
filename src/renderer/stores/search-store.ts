import { create } from 'zustand'
import type { HybridSearchResult } from '../../shared/types'
import { friendlyError } from '../lib/error-messages'

interface HybridSearchResponse {
  query: string
  total_results: number
  keyword_weight: number
  semantic_weight: number
  results: HybridSearchResult[]
  error?: string
}

interface SearchState {
  query: string
  results: HybridSearchResult[]
  isSearching: boolean
  error: string | null

  setQuery: (query: string) => void
  search: (query: string) => Promise<void>
  clear: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  results: [],
  isSearching: false,
  error: null,

  setQuery: (query: string) => set({ query }),

  search: async (query: string) => {
    if (!query.trim()) return

    set({ query, isSearching: true, error: null })

    try {
      const response = await window.electronAPI.search.hybrid(query, { limit: 10 }) as HybridSearchResponse

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
