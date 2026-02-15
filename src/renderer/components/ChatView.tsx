import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Trash2, BookOpen, ThumbsUp, ThumbsDown, ChevronDown, FileText, Download } from 'lucide-react'
import { useChatStore } from '../stores/chat-store'
import type { ChatMessage, ChatSource } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Main chat interface with SSE streaming support.
 *
 * Streaming flow:
 * 1. User sends message → store creates empty assistant bubble
 * 2. Tokens arrive via SSE → assistant bubble grows in real-time
 * 3. Blinking cursor (▊) shows active streaming
 * 4. Stop button aborts the stream mid-generation
 */
export function ChatView() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    abortStream,
    clearMessages,
    clearError,
  } = useChatStore()

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-resize textarea based on content
  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setInput('')
    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  /**
   * Export chat as Markdown file via native Save dialog.
   * Converts all messages to a readable Markdown document with
   * sources and timestamps.
   */
  const handleExport = async () => {
    if (messages.length === 0) return

    const date = new Date().toISOString().slice(0, 10)
    const lines: string[] = [
      `# Docmind Chat — ${date}`,
      '',
    ]

    for (const msg of messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString('de-CH', {
        hour: '2-digit',
        minute: '2-digit',
      })
      if (msg.role === 'user') {
        lines.push(`## Frage (${time})`, '', msg.content, '')
      } else if (msg.role === 'assistant') {
        lines.push(`## Antwort (${time})`, '', msg.content, '')
        if (msg.sources && msg.sources.length > 0) {
          lines.push('### Quellen', '')
          for (const src of msg.sources) {
            const score = src.score != null ? ` (${(src.score * 100).toFixed(0)}%)` : ''
            lines.push(`- **${src.file_name || 'Dokument'}**${score}`)
          }
          lines.push('')
        }
      }
    }

    lines.push('---', `*Exportiert am ${new Date().toLocaleString('de-CH')} mit Docmind Desktop*`)

    const filename = `docmind-chat-${date}.md`
    await window.electronAPI.export.saveFile(lines.join('\n'), filename)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="drag-region flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="no-drag text-lg font-semibold">Chat</h1>
        <div className="no-drag flex items-center gap-2">
          {isStreaming && (
            <button
              onClick={abortStream}
              className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              title="Antwort stoppen"
            >
              <Square className="h-3 w-3" />
              Stopp
            </button>
          )}
          {messages.length > 0 && (
            <>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Chat exportieren (Markdown)"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clearMessages}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Verlauf loeschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={
                  isStreaming &&
                  msg.role === 'assistant' &&
                  msg.id === messages[messages.length - 1]?.id
                }
              />
            ))}
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
            data-shortcut="chat-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResize()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Frage stellen... (⌘N fuer neuen Chat)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />
          {isStreaming ? (
            <button
              onClick={abortStream}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/80 text-white transition-colors hover:bg-red-500"
              title="Stopp"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
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

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage
  isStreaming?: boolean
}) {
  const setFeedback = useChatStore((s) => s.setFeedback)
  const isUser = message.role === 'user'
  const showCursor = isStreaming && !isUser
  const showFeedback = !isUser && !isStreaming && message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-foreground'
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {showCursor && (
                <span className="inline-block h-4 w-1.5 animate-pulse bg-primary align-text-bottom" />
              )}
            </div>
          ) : showCursor ? (
            // Empty content + streaming → show blinking cursor only
            <div className="flex items-center gap-1.5 py-1">
              <span className="inline-block h-4 w-1.5 animate-pulse bg-primary" />
            </div>
          ) : null}

          {/* Sources — shown once streaming completes */}
          {!isStreaming && message.sources && message.sources.length > 0 && (
            <SourcesList sources={message.sources} />
          )}
        </div>

        {/* Feedback buttons — below assistant bubble */}
        {showFeedback && (
          <div className="mt-1 flex items-center gap-1 px-1">
            <button
              onClick={() => setFeedback(message.id, 'positive')}
              className={`rounded p-1 transition-colors ${
                message.feedback === 'positive'
                  ? 'text-emerald-400'
                  : 'text-muted-foreground/40 hover:text-muted-foreground'
              }`}
              title="Hilfreiche Antwort"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFeedback(message.id, 'negative')}
              className={`rounded p-1 transition-colors ${
                message.feedback === 'negative'
                  ? 'text-red-400'
                  : 'text-muted-foreground/40 hover:text-muted-foreground'
              }`}
              title="Nicht hilfreich"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Expandable source list — click a source to see the context chunk.
 * Shows up to 5 sources with file name, score, and domain.
 */
function SourcesList({ sources }: { sources: ChatSource[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="mt-3 border-t border-border pt-2">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {sources.length} Quelle{sources.length !== 1 ? 'n' : ''}
      </p>
      <div className="space-y-1">
        {sources.slice(0, 5).map((src, i) => (
          <div key={i}>
            {/* Source header — clickable */}
            <button
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className="flex w-full items-center gap-2 rounded bg-black/5 dark:bg-white/5 px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-black/10 dark:hover:bg-white/10"
            >
              <FileText className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="flex-1 truncate">
                {src.file_name || 'Dokument'}
              </span>
              {src.score != null && (
                <span className="shrink-0 text-emerald-400">
                  {(src.score * 100).toFixed(0)}%
                </span>
              )}
              {src.domain && (
                <span className="shrink-0 text-slate-500 text-[10px]">
                  {src.domain}
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform ${
                  expandedIndex === i ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Expanded content preview */}
            {expandedIndex === i && src.content && (
              <div className="mt-1 rounded border border-border bg-background/50 px-3 py-2">
                <p className="line-clamp-6 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/80">
                  {src.content}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
