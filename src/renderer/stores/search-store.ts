import { create } from 'zustand'
import type { SearchResult } from '../../shared/types'

interface SearchState {
  query: string
  results: SearchResult[]
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
      const response = await window.electronAPI.search.hybrid(query, { limit: 10 })

      if (response.error) {
        throw new Error(response.error)
      }

      set({
        results: response.results ?? response ?? [],
        isSearching: false,
      })
    } catch (error) {
      set({
        isSearching: false,
        error: error instanceof Error ? error.message : 'Search failed',
      })
    }
  },

  clear: () => set({ query: '', results: [], error: null }),
}))
