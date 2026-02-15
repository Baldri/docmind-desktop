import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Trash2, BookOpen } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'
import type { ChatMessage, ChatSource } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Main chat interface — send questions, get RAG-augmented answers.
 * Shows source documents for each answer.
 */
export function ChatView() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, isLoading, error, sendMessage, clearMessages, clearError } =
    useChatStore()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Chat</h1>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="no-drag flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Verlauf loeschen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Denke nach...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-2 rounded-md bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
          <button onClick={clearError} className="ml-2 underline">
            Schliessen
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage stellen..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <h2 className="mb-2 text-xl font-semibold text-foreground/80">
          Willkommen bei Docmind
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Stelle Fragen zu deinen Dokumenten. Docmind durchsucht deine
          Wissensdatenbank und gibt dir fundierte Antworten mit Quellenangaben.
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-foreground'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <SourcesList sources={message.sources} />
        )}
      </div>
    </div>
  )
}

function SourcesList({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="mt-3 border-t border-white/10 pt-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Quellen:
      </p>
      <div className="space-y-1">
        {sources.slice(0, 3).map((src, i) => (
          <div
            key={i}
            className="rounded bg-white/5 px-2 py-1 text-xs text-muted-foreground"
          >
            {src.file_name || 'Dokument'}
            {src.score != null && (
              <span className="ml-1 text-emerald-400">
                ({(src.score * 100).toFixed(0)}%)
              </span>
            )}
            {src.domain && (
              <span className="ml-1 text-slate-500">
                · {src.domain}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
