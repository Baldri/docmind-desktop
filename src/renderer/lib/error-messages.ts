/**
 * User-friendly error message mapping.
 *
 * Translates raw error strings from IPC handlers into messages
 * that non-technical users can understand and act on.
 */

const ERROR_PATTERNS: [RegExp, string][] = [
  // Connection failures
  [/fetch failed|ECONNREFUSED|ENOTFOUND/i, 'Der RAG-Service ist nicht erreichbar. Pruefe ob alle Services laufen.'],
  [/network|ENETUNREACH/i, 'Netzwerkfehler — keine Verbindung zum lokalen Service.'],

  // HTTP errors
  [/HTTP 404/i, 'Endpunkt nicht gefunden — die RAG-API Version stimmt moeglicherweise nicht.'],
  [/HTTP 500/i, 'Interner Serverfehler. Starte den Python-Service neu.'],
  [/HTTP 502|HTTP 503/i, 'Service voruebergehend nicht verfuegbar. Versuche es in ein paar Sekunden erneut.'],
  [/HTTP 408|timeout/i, 'Zeitueberschreitung — die Anfrage hat zu lange gedauert.'],
  [/HTTP 422/i, 'Ungueltige Anfrage — die Parameter werden nicht akzeptiert.'],

  // Ollama specific
  [/ollama/i, 'Ollama ist nicht erreichbar. Ist Ollama gestartet?'],
  [/model.*not found|pull.*model/i, 'Das KI-Modell wurde nicht gefunden. Installiere es mit "ollama pull".'],

  // Qdrant specific
  [/qdrant|collection.*not found/i, 'Die Qdrant-Datenbank ist nicht erreichbar oder die Collection fehlt.'],

  // Stream errors
  [/AbortError/i, 'Antwort wurde abgebrochen.'],
  [/No response body/i, 'Keine Antwort vom Server erhalten.'],
  [/No window/i, 'Kein aktives Fenster — bitte Docmind neu starten.'],
]

/**
 * Maps raw error strings to user-friendly messages in German.
 * Falls back to the original message if no pattern matches.
 */
export function friendlyError(raw: string): string {
  for (const [pattern, friendly] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return friendly
  }
  // If it's already short and readable, return as-is
  if (raw.length < 100) return raw
  // Truncate very long error messages
  return raw.slice(0, 100) + '…'
}

/**
 * Check if an error is a connection/network error that could resolve with retry.
 */
export function isRetryableError(error: string): boolean {
  return /fetch failed|ECONNREFUSED|ENETUNREACH|HTTP 502|HTTP 503|timeout/i.test(error)
}
