import { useState, useEffect } from 'react'
import { MessageSquare, Search, Settings } from 'lucide-react'
import { ChatView } from './components/ChatView'
import { SearchView } from './components/SearchView'
import { SettingsView } from './components/SettingsView'
import { ServiceStatus } from './components/ServiceStatus'
import { useServicesStore } from './stores/services-store'

type View = 'chat' | 'search' | 'settings'

const NAV_ITEMS: { id: View; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'search', label: 'Suche', icon: Search },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
]

export function App() {
  const [activeView, setActiveView] = useState<View>('chat')
  const checkStatus = useServicesStore((s) => s.checkStatus)

  // Poll service status every 10 seconds
  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10_000)
    return () => clearInterval(interval)
  }, [checkStatus])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r border-border bg-slate-950 py-4">
        {/* macOS drag region */}
        <div className="drag-region mb-6 h-4 w-full" />

        {/* Navigation */}
        <nav className="no-drag flex flex-1 flex-col gap-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`group flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                activeView === id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              title={label}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </nav>

        {/* Service Status (bottom) */}
        <div className="no-drag mt-auto">
          <ServiceStatus />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {activeView === 'chat' && <ChatView />}
        {activeView === 'search' && <SearchView />}
        {activeView === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
