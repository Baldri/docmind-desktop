import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Generic React Error Boundary.
 *
 * Catches render errors in child components and shows
 * a recovery UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive opacity-60" />
          <h3 className="text-sm font-semibold text-destructive">
            {this.props.fallbackTitle ?? 'Etwas ist schiefgelaufen'}
          </h3>
          <p className="max-w-md text-xs text-muted-foreground">
            {this.state.error?.message ?? 'Unbekannter Fehler'}
          </p>
          <button
            onClick={this.handleRetry}
            className="mt-2 flex items-center gap-1.5 rounded-md bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Erneut versuchen
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
