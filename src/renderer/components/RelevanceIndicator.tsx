interface RelevanceIndicatorProps {
  score: number | null | undefined
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
}

function getScoreColor(score: number): string {
  if (score >= 0.75) return 'bg-emerald-500'
  if (score >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 0.75) return 'text-emerald-400'
  if (score >= 0.5) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Visual score indicator with colored bar and optional percent label.
 * Used in SearchView (score breakdown) and ChatView (confidence + sources).
 */
export function RelevanceIndicator({ score, label, showPercent = true, size = 'sm' }: RelevanceIndicatorProps) {
  if (score == null || Number.isNaN(score)) return null

  const pct = Math.round(score * 100)
  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2'
  const fontSize = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className={`${fontSize} text-muted-foreground/60 w-16 shrink-0`}>{label}</span>
      )}
      <div className={`flex-1 rounded-full bg-muted/30 ${barHeight}`}>
        <div
          className={`${barHeight} rounded-full transition-all ${getScoreColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPercent && (
        <span className={`${fontSize} font-medium ${getScoreTextColor(score)} w-8 text-right`}>
          {pct}%
        </span>
      )}
    </div>
  )
}

/**
 * Confidence summary for chat responses — shows average source score.
 */
export function ConfidenceIndicator({ sources }: { sources: Array<{ score?: number | null }> }) {
  if (!sources || sources.length === 0) return null

  const validScores = sources
    .map((s) => s.score)
    .filter((s): s is number => s != null && !Number.isNaN(s))

  if (validScores.length === 0) return null

  const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length

  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">
        Basiert auf {sources.length} Quelle{sources.length !== 1 ? 'n' : ''}
      </span>
      <RelevanceIndicator score={avgScore} label="Konfidenz" size="sm" />
    </div>
  )
}
