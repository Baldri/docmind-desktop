import { create } from 'zustand'
import type { ChatMessage, ChatResponse, ChatSource } from '../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sessionId: string | null

  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  clearError: () => void
}

let messageCounter = 0

function createId(): string {
  return `msg_${Date.now()}_${++messageCounter}`
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  sessionId: null,

  sendMessage: async (content: string) => {
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }))

    try {
      // Pass existing sessionId for conversation continuity
      const { sessionId } = get()
      const response = await window.electronAPI.chat.send(content, sessionId ?? undefined) as ChatResponse

      if (response.error) {
        throw new Error(response.error)
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: response.content || '',
        timestamp: Date.now(),
        sources: (response.sources ?? []) as ChatSource[],
        sessionId: response.sessionId,
      }

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        // Persist sessionId for multi-turn conversations
        sessionId: response.sessionId ?? state.sessionId,
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  clearMessages: () => set({ messages: [], error: null, sessionId: null }),
  clearError: () => set({ error: null }),
}))
