import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Search, FileText, Settings, Network } from 'lucide-react'
import { ChatView } from './components/ChatView'
import { SearchView } from './components/SearchView'
import { DocumentsView } from './components/DocumentsView'
import { SettingsView } from './components/SettingsView'
import { GraphView } from './components/GraphView'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SetupWizard } from './components/SetupWizard'
import { ServiceStatus } from './components/ServiceStatus'
import { ProjectSwitcher } from './components/ProjectSwitcher'
import { ConnectionBanner } from './components/ConnectionBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { OnboardingTour } from './components/OnboardingTour'
import { useServicesStore } from './stores/services-store'
import { useChatStore } from './stores/chat-store'
import { useSubscriptionStore } from './stores/subscription-store'
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'

type View = 'chat' | 'search' | 'documents' | 'graph' | 'settings'

const NAV_ITEMS: { id: View; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Suche', icon: Search },
  { id: 'documents', label: 'Dokumente', icon: FileText },
  { id: 'graph', label: 'Wissens-Graph', icon: Network },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
]

/**
 * Root component.
 *
 * On first launch (or when critical services are missing), shows the SetupWizard.
 * Once dismissed, shows the main app layout with sidebar navigation.
 * The wizard can also be bypassed via "Trotzdem starten".
 */
/** Check if this is the first launch by looking at localStorage */
function isFirstLaunch(): boolean {
  return localStorage.getItem('docmind:onboarding-done') !== 'true'
}

export function App() {
  const [activeView, setActiveView] = useState<View>('chat')
  const [showWizard, setShowWizard] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const checkStatus = useServicesStore((s) => s.checkStatus)
  const services = useServicesStore((s) => s.services)
  const clearChat = useChatStore((s) => s.clearMessages)
  const abortStream = useChatStore((s) => s.abortStream)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const loadLicenseStatus = useSubscriptionStore((s) => s.loadStatus)

  // Global keyboard shortcuts (Cmd+1..4, Cmd+K, Cmd+N, Escape)
  useKeyboardShortcuts({ setActiveView, clearChat, abortStream, isStreaming })

  // Initial check to decide if wizard is needed + load license
  useEffect(() => {
    checkStatus()
    loadLicenseStatus()
  }, [checkStatus, loadLicenseStatus])

  // Auto-skip wizard if all services are already healthy
  useEffect(() => {
    const allHealthy = services.every((s) => s.status === 'healthy')
    if (allHealthy) {
      setShowWizard(false)
    }
  }, [services])

  // Poll service status every 10 seconds (main app only)
  useEffect(() => {
    if (showWizard) return // wizard has its own polling
    const interval = setInterval(checkStatus, 10_000)
    return () => clearInterval(interval)
  }, [checkStatus, showWizard])

  const handleWizardReady = useCallback(() => {
    setShowWizard(false)
    // Show onboarding tour on first launch after wizard
    if (isFirstLaunch()) {
      setShowOnboarding(true)
    }
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('docmind:onboarding-done', 'true')
  }, [])

  // Show wizard on first launch or when services need setup
  if (showWizard) {
    return <SetupWizard onReady={handleWizardReady} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Onboarding Tour Overlay */}
      {showOnboarding && <OnboardingTour onComplete={handleOnboardingComplete} />}

      {/* Sidebar — icon-only on small screens, icons+labels on lg+ */}
      <aside className="flex w-16 lg:w-48 flex-col border-r border-border bg-slate-100 dark:bg-slate-950 py-4">
        {/* macOS drag region */}
        <div className="drag-region mb-4 h-4 w-full" />

        {/* Project Switcher */}
        <ProjectSwitcher />

        {/* Navigation */}
        <nav className="no-drag flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`group flex h-10 items-center justify-center lg:justify-start rounded-lg transition-colors lg:px-3 lg:gap-2 ${
                activeView === id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              title={`${label} (⌘${NAV_ITEMS.findIndex((n) => n.id === id) + 1})`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:inline text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        {/* Service Status (bottom) */}
        <div className="no-drag mt-auto flex justify-center lg:px-2">
          <ServiceStatus />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <UpdateBanner />
        <ConnectionBanner />
        {activeView === 'chat' && <ChatView />}
        {activeView === 'search' && <SearchView />}
        {activeView === 'documents' && <DocumentsView />}
        {activeView === 'graph' && (
          <ErrorBoundary fallbackTitle="Wissens-Graph konnte nicht geladen werden">
            <GraphView />
          </ErrorBoundary>
        )}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
