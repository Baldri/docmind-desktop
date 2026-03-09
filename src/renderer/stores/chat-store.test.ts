import { useChatStore } from './chat-store'

const store = useChatStore

function resetStore() {
  store.setState({
    messages: [],
    isStreaming: false,
    error: null,
    sessionId: null,
  })
}

describe('chat-store', () => {
  beforeEach(() => {
    resetStore()
  })

  it('has correct initial state', () => {
    const state = store.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()
    expect(state.sessionId).toBeNull()
  })

  it('sendMessage adds user + assistant messages', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(undefined)
    vi.mocked(window.electronAPI.chat.send).mockResolvedValue(undefined)

    await store.getState().sendMessage('Hello')

    const messages = store.getState().messages
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Hello')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('')
  })

  it('sendMessage loads pipeline settings', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue({
      maxContextChunks: 10,
      mmrEnabled: true,
      mmrLambda: 0.6,
    })
    vi.mocked(window.electronAPI.chat.send).mockResolvedValue(undefined)

    await store.getState().sendMessage('test')

    expect(window.electronAPI.chat.send).toHaveBeenCalledWith(
      'test',
      undefined,
      expect.objectContaining({
        maxContextChunks: 10,
        mmrEnabled: true,
        mmrLambda: 0.6,
      }),
    )
  })

  it('sendMessage sets error on IPC failure', async () => {
    vi.mocked(window.electronAPI.settings.get).mockResolvedValue(undefined)
    vi.mocked(window.electronAPI.chat.send).mockRejectedValue(new Error('ECONNREFUSED'))

    await store.getState().sendMessage('test')

    expect(store.getState().isStreaming).toBe(false)
    expect(store.getState().error).toBeTruthy()
  })

  it('clearMessages resets everything', async () => {
    store.setState({
      messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: 1 }],
      isStreaming: false,
      error: 'old error',
      sessionId: 'sess_1',
    })

    store.getState().clearMessages()

    const state = store.getState()
    expect(state.messages).toEqual([])
    expect(state.error).toBeNull()
    expect(state.sessionId).toBeNull()
    expect(state.isStreaming).toBe(false)
  })

  it('clearError only clears error', () => {
    store.setState({ error: 'some error', sessionId: 'sess_1' })
    store.getState().clearError()

    expect(store.getState().error).toBeNull()
    expect(store.getState().sessionId).toBe('sess_1')
  })

  it('setFeedback toggles feedback on message', () => {
    store.setState({
      messages: [
        { id: 'msg_1', role: 'assistant', content: 'Answer', timestamp: 1, feedback: null },
      ],
    })

    store.getState().setFeedback('msg_1', 'positive')
    expect(store.getState().messages[0].feedback).toBe('positive')

    // Toggle off
    store.getState().setFeedback('msg_1', 'positive')
    expect(store.getState().messages[0].feedback).toBeNull()

    // Set negative
    store.getState().setFeedback('msg_1', 'negative')
    expect(store.getState().messages[0].feedback).toBe('negative')
  })
})
