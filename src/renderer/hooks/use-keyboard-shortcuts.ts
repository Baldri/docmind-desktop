import { useEffect, useCallback } from 'react'

/**
 * Keyboard shortcut definitions for Docmind Desktop.
 *
 * All shortcuts use Cmd (macOS) / Ctrl (Win/Linux) as modifier.
 * Registered as a single global keydown listener — no electron
 * globalShortcut needed since these only apply when the window
 * is focused.
 *
 * Shortcuts:
 *   Cmd+1..4        Switch view (Chat, Search, Documents, Settings)
 *   Cmd+K           Focus search input
 *   Cmd+N           New chat (clear messages)
 *   Cmd+Shift+Del   Clear chat history
 *   Escape          Abort streaming / close modals
 */

type View = 'chat' | 'search' | 'documents' | 'settings'

interface ShortcutActions {
  setActiveView: (view: View) => void
  clearChat: () => void
  abortStream: () => void
  isStreaming: boolean
}

const VIEW_MAP: Record<string, View> = {
  '1': 'chat',
  '2': 'search',
  '3': 'documents',
  '4': 'settings',
}

export function useKeyboardShortcuts(actions: ShortcutActions): void {
  const { setActiveView, clearChat, abortStream, isStreaming } = actions

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Use metaKey on macOS, ctrlKey on Windows/Linux
      const mod = e.metaKey || e.ctrlKey

      // ── Cmd+1..4: Switch views ──────────────────────────────────────
      if (mod && !e.shiftKey && VIEW_MAP[e.key]) {
        e.preventDefault()
        setActiveView(VIEW_MAP[e.key])
        return
      }

      // ── Cmd+K: Focus search (switch to search view) ─────────────────
      if (mod && !e.shiftKey && e.key === 'k') {
        e.preventDefault()
        setActiveView('search')
        // Focus search input after view switch (next tick)
        requestAnimationFrame(() => {
          const searchInput = document.querySelector<HTMLInputElement>(
            '[data-shortcut="search-input"]',
          )
          searchInput?.focus()
        })
        return
      }

      // ── Cmd+N: New chat ─────────────────────────────────────────────
      if (mod && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        clearChat()
        setActiveView('chat')
        // Focus chat input
        requestAnimationFrame(() => {
          const chatInput = document.querySelector<HTMLTextAreaElement>(
            '[data-shortcut="chat-input"]',
          )
          chatInput?.focus()
        })
        return
      }

      // ── Cmd+Shift+Backspace: Clear chat ─────────────────────────────
      if (mod && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault()
        clearChat()
        return
      }

      // ── Escape: Abort streaming ─────────────────────────────────────
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault()
        abortStream()
        return
      }
    },
    [setActiveView, clearChat, abortStream, isStreaming],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
