import { friendlyError, isRetryableError } from './error-messages'

describe('friendlyError', () => {
  it('maps ECONNREFUSED to service unreachable', () => {
    expect(friendlyError('fetch failed: ECONNREFUSED')).toContain('RAG-Service')
  })

  it('maps network errors', () => {
    expect(friendlyError('ENETUNREACH')).toContain('Netzwerkfehler')
  })

  it('maps HTTP 404', () => {
    expect(friendlyError('HTTP 404 Not Found')).toContain('nicht gefunden')
  })

  it('maps HTTP 500', () => {
    expect(friendlyError('HTTP 500 Internal Server Error')).toContain('Serverfehler')
  })

  it('maps HTTP 503', () => {
    expect(friendlyError('HTTP 503')).toContain('voruebergehend')
  })

  it('maps timeout errors', () => {
    expect(friendlyError('HTTP 408 timeout')).toContain('Zeitueberschreitung')
  })

  it('maps Ollama errors', () => {
    expect(friendlyError('ollama connection refused')).toContain('Ollama')
  })

  it('maps Qdrant errors', () => {
    expect(friendlyError('qdrant collection not found')).toContain('Qdrant')
  })

  it('maps AbortError', () => {
    expect(friendlyError('AbortError')).toContain('abgebrochen')
  })

  it('returns short messages as-is', () => {
    expect(friendlyError('Something broke')).toBe('Something broke')
  })

  it('truncates very long messages', () => {
    const longMsg = 'x'.repeat(200)
    const result = friendlyError(longMsg)
    expect(result.length).toBeLessThanOrEqual(101) // 100 + ellipsis
  })
})

describe('isRetryableError', () => {
  it('returns true for fetch failed', () => {
    expect(isRetryableError('fetch failed')).toBe(true)
  })

  it('returns true for ECONNREFUSED', () => {
    expect(isRetryableError('ECONNREFUSED')).toBe(true)
  })

  it('returns true for HTTP 503', () => {
    expect(isRetryableError('HTTP 503')).toBe(true)
  })

  it('returns true for timeout', () => {
    expect(isRetryableError('timeout')).toBe(true)
  })

  it('returns false for HTTP 404', () => {
    expect(isRetryableError('HTTP 404')).toBe(false)
  })

  it('returns false for generic errors', () => {
    expect(isRetryableError('Something went wrong')).toBe(false)
  })
})
