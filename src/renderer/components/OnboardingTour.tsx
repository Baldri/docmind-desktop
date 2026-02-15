import { useState } from 'react'
import {
  MessageSquare,
  Search,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react'

interface OnboardingTourProps {
  onComplete: () => void
}

interface TourStep {
  icon: typeof MessageSquare
  title: string
  description: string
  color: string
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    title: 'Willkommen bei Docmind',
    description:
      'Docmind ist dein intelligenter Assistent für Dokumente. Importiere Vorlesungsmaterialien, Papers oder Notizen — und stelle Fragen in natürlicher Sprache.',
    color: 'text-primary',
  },
  {
    icon: FileText,
    title: 'Dokumente importieren',
    description:
      'Klicke auf "Dokumente" in der Seitenleiste und importiere einzelne Dateien oder ganze Ordner. Docmind indexiert PDF, DOCX, Markdown, und viele weitere Formate automatisch.',
    color: 'text-amber-400',
  },
  {
    icon: MessageSquare,
    title: 'Chat mit deinen Dokumenten',
    description:
      'Stelle Fragen zu deinen Dokumenten — Docmind durchsucht deine Wissensdatenbank und gibt dir fundierte Antworten mit Quellenangaben. Klappe die Quellen auf, um den Kontext zu sehen.',
    color: 'text-emerald-400',
  },
  {
    icon: Search,
    title: 'Hybride Suche',
    description:
      'Die Suche kombiniert Keyword-Matching (BM25) mit semantischer Suche. So findest du sowohl exakte Begriffe als auch thematisch verwandte Inhalte.',
    color: 'text-blue-400',
  },
]

/**
 * First-run onboarding tour — 4 steps explaining core features.
 * Shows as a centered modal overlay. Can be skipped at any time.
 * Calls onComplete when finished or skipped.
 */
export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-2xl">
        {/* Skip button */}
        <button
          onClick={onComplete}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          title="Überspringen"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-primary'
                  : i < step
                    ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-muted-foreground/20'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Icon className={`h-8 w-8 ${current.color}`} />
            </div>
          </div>
          <h2 className="mb-3 text-xl font-semibold">{current.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {current.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Zurueck
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Ueberspringen
            </button>
          )}

          <button
            onClick={isLast ? onComplete : () => setStep(step + 1)}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isLast ? 'Los geht\'s!' : 'Weiter'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
