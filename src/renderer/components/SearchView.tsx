import { useState } from 'react'
import { Search, Loader2, FileText, X } from 'lucide-react'
import { useSearchStore } from '../stores/search-store'
import type { HybridSearchResult } from '../../shared/types'

/**
 * Hybrid search interface — keyword + semantic search across all documents.
 * Results show document excerpts with relevance scores.
 */
export function SearchView() {
  const [input, setInput] = useState('')
  const { query, results, isSearching, error, search, clear } = useSearchStore()

  const handleSearch = () => {
    const trimmed = input.trim()
    if (!trimmed || isSearching) return
    search(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Suche</h1>
      </header>

      {/* Search Input */}
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              data-shortcut="search-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Dokumente durchsuchen... (⌘K)"
              className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {input && (
              <button
                onClick={() => {
                  setInput('')
                  clear()
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!input.trim() || isSearching}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Suchen'
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {query && !isSearching && results.length === 0 && !error && (
            <p className="text-center text-sm text-muted-foreground">
              Keine Ergebnisse fuer &quot;{query}&quot;
            </p>
          )}

          {results.length > 0 && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {results.length} Ergebnisse fuer &quot;{query}&quot;
              </p>
              <div className="space-y-3">
                {results.map((result, i) => (
                  <ResultCard key={`${result.file_name}-${i}`} result={result} />
                ))}
              </div>
            </>
          )}

          {!query && !isSearching && results.length === 0 && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Durchsuche deine Wissensdatenbank mit Hybrid-Suche
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Kombiniert Keyword-Matching (BM25) mit semantischer Suche
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Single search result card with score breakdown.
 */
/** Format a score safely — returns "—" if the value is nullish or NaN */
function fmtScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '—'
  return `${(score * 100).toFixed(0)}%`
}

function ResultCard({ result }: { result: HybridSearchResult }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4 transition-colors hover:bg-secondary">
      {/* Header: filename + combined score */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">
            {result.file_name || 'Dokument'}
          </span>
          {result.domain && (
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              {result.domain}
            </span>
          )}
        </div>
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          {fmtScore(result.combined_score)}
        </span>
      </div>

      {/* Content preview */}
      <p className="line-clamp-4 text-sm text-muted-foreground">
        {result.content}
      </p>

      {/* Score breakdown: keyword vs semantic */}
      <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground/60">
        <span>
          BM25: {fmtScore(result.keyword_score)}
        </span>
        <span>
          Semantic: {fmtScore(result.semantic_score)}
        </span>
      </div>
    </div>
  )
}
