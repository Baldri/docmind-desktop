import { useState } from 'react'
import { Search, Loader2, FileText, X, Filter } from 'lucide-react'
import { useSearchStore } from '../stores/search-store'
import { RelevanceIndicator } from './RelevanceIndicator'
import type { HybridSearchResult } from '../../shared/types'

const DOMAIN_OPTIONS = ['', 'Business', 'Education', 'Personal'] as const
const LANGUAGE_OPTIONS = ['', 'de', 'en', 'fr', 'it'] as const
const LIMIT_OPTIONS = [5, 10, 20, 50] as const

/**
 * Hybrid search interface — keyword + semantic search across all documents.
 * Results show document excerpts with relevance scores.
 */
export function SearchView() {
  const [input, setInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const { query, results, isSearching, error, filters, setFilter, search, clear } = useSearchStore()

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

  const hasActiveFilters = filters.domain !== '' || filters.language !== '' || filters.limit !== 10

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Suche</h1>
      </header>

      {/* Search Input */}
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
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
                  onClick={() => { setInput(''); clear() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10 items-center gap-1 rounded-lg border px-3 text-sm transition-colors ${
                hasActiveFilters
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              onClick={handleSearch}
              disabled={!input.trim() || isSearching}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Suchen'}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3 rounded-lg border border-border bg-secondary/50 p-3">
              <FilterSelect
                label="Domain"
                value={filters.domain}
                options={DOMAIN_OPTIONS}
                onChange={(v) => setFilter('domain', v)}
              />
              <FilterSelect
                label="Sprache"
                value={filters.language}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => setFilter('language', v)}
              />
              <FilterSelect
                label="Ergebnisse"
                value={String(filters.limit)}
                options={LIMIT_OPTIONS.map(String) as unknown as readonly string[]}
                onChange={(v) => setFilter('limit', Number(v))}
              />
            </div>
          )}
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

// ── Sub-Components ──────────────────────────────────────────────────

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
          {result.document_type && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary/70">
              {result.document_type}
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

      {/* Score breakdown with visual bars */}
      <div className="mt-3 space-y-1">
        <RelevanceIndicator score={result.keyword_score} label="BM25" />
        <RelevanceIndicator score={result.semantic_score} label="Semantic" />
      </div>

      {/* Tags: domain + language */}
      {(result.domain || result.language) && (
        <div className="mt-2 flex gap-2">
          {result.domain && (
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              {result.domain}
            </span>
          )}
          {result.language && (
            <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
              {result.language}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function fmtScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return '—'
  return `${(score * 100).toFixed(0)}%`
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === '' ? 'Alle' : opt}
          </option>
        ))}
      </select>
    </div>
  )
}
