import { create } from 'zustand'
import type { ChatMessage, ChatSource, FeedbackRating } from '../../shared/types'
import { friendlyError } from '../lib/error-messages'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  sessionId: string | null

  sendMessage: (content: string) => Promise<void>
  abortStream: () => void
  setFeedback: (messageId: string, rating: FeedbackRating) => void
  clearMessages: () => void
  clearError: () => void
}

let messageCounter = 0

function createId(): string {
  return `msg_${Date.now()}_${++messageCounter}`
}

/**
 * Chat store with SSE streaming support.
 *
 * Flow:
 * 1. User sends message → store adds user msg + empty assistant msg
 * 2. IPC handler opens SSE stream to /api/v1/chat/stream
 * 3. Main process forwards events: chat:chunk, chat:sources, chat:complete, chat:error
 * 4. Store updates the assistant message in-place as tokens arrive
 * 5. On complete: mark done, persist sessionId
 */
export const useChatStore = create<ChatState>((set, get) => {
  // Track active listener cleanup functions
  let cleanupListeners: (() => void) | null = null

  function setupStreamListeners(assistantMsgId: string) {
    // Remove previous listeners
    if (cleanupListeners) {
      cleanupListeners()
      cleanupListeners = null
    }

    const api = window.electronAPI.chat

    // Token chunk — append to assistant message content
    const offChunk = api.onChunk((chunk: string) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: m.content + chunk }
            : m,
        ),
      }))
    })

    // Sources — attach to assistant message
    const offSources = api.onSources((sources: unknown[]) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgId
            ? { ...m, sources: sources as ChatSource[] }
            : m,
        ),
      }))
    })

    // Stream complete — save sessionId, mark done
    const offComplete = api.onComplete((sessionId?: string) => {
      set((state) => ({
        isStreaming: false,
        sessionId: sessionId ?? state.sessionId,
      }))
      cleanup()
    })

    // Error — show user-friendly error, mark done
    const offError = api.onError((error: string) => {
      set({ isStreaming: false, error: friendlyError(error) })
      cleanup()
    })

    function cleanup() {
      offChunk()
      offSources()
      offComplete()
      offError()
      cleanupListeners = null
    }

    cleanupListeners = cleanup
  }

  return {
    messages: [],
    isStreaming: false,
    error: null,
    sessionId: null,

    sendMessage: async (content: string) => {
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }

      // Create empty assistant message that will be filled by streaming tokens
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      set((state) => ({
        messages: [...state.messages, userMessage, assistantMessage],
        isStreaming: true,
        error: null,
      }))

      // Wire up SSE event listeners before triggering the stream
      setupStreamListeners(assistantMessage.id)

      try {
        const { sessionId } = get()
        await window.electronAPI.chat.send(content, sessionId ?? undefined)
      } catch (error) {
        // Clean up listeners on IPC-level errors (e.g. main process unreachable)
        if (cleanupListeners) {
          cleanupListeners()
          cleanupListeners = null
        }
        const raw = error instanceof Error ? error.message : 'Unknown error'
        set({
          isStreaming: false,
          error: friendlyError(raw),
        })
      }
    },

    abortStream: () => {
      window.electronAPI.chat.abort()
      if (cleanupListeners) {
        cleanupListeners()
        cleanupListeners = null
      }
      set({ isStreaming: false })
    },

    setFeedback: (messageId: string, rating: FeedbackRating) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId
            ? { ...m, feedback: m.feedback === rating ? null : rating }
            : m,
        ),
      }))
    },

    clearMessages: () => {
      if (cleanupListeners) {
        cleanupListeners()
        cleanupListeners = null
      }
      set({ messages: [], error: null, sessionId: null, isStreaming: false })
    },

    clearError: () => set({ error: null }),
  }
})
