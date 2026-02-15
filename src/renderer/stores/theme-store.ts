import { create } from 'zustand'

type Theme = 'dark' | 'light' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

/**
 * Resolves the effective theme: 'dark' or 'light'.
 * When 'system' is selected, uses the OS media query.
 */
function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

/** Apply the resolved theme to the document root element */
function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

// Load persisted theme preference
const stored = localStorage.getItem('docmind:theme') as Theme | null
const initial: Theme = stored ?? 'dark'

// Apply immediately on module load (prevents flash of wrong theme)
applyTheme(initial)

// Listen for OS theme changes when 'system' is selected
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', () => {
  const { theme } = useThemeStore.getState()
  if (theme === 'system') applyTheme(theme)
})

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,

  setTheme: (theme: Theme) => {
    localStorage.setItem('docmind:theme', theme)
    applyTheme(theme)
    set({ theme })
  },
}))
