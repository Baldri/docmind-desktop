import { create } from 'zustand'
import type { ChatMessage, SearchResult } from '../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null

  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  clearError: () => void
}

let messageCounter = 0

function createId(): string {
  return `msg_${Date.now()}_${++messageCounter}`
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

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
      const response = await window.electronAPI.chat.send(content)

      if (response.error) {
        throw new Error(response.error)
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: response.content || response.answer || '',
        timestamp: Date.now(),
        sources: response.sources as SearchResult[] | undefined,
      }

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }))
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  clearMessages: () => set({ messages: [], error: null }),
  clearError: () => set({ error: null }),
}))
