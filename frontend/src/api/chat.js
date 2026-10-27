const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

export async function requestChatReply(
  messages,
  { chatId, caseId, attachment_ids, onDelta, onSources } = {},
) {
  const isStreaming = typeof onDelta === 'function'
  let response

  try {
    response = await fetch(`${apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: isStreaming ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({
        messages,
        ...(chatId ? { chatId } : {}),
        ...(caseId ? { caseId } : {}),
        ...(attachment_ids && attachment_ids.length > 0 ? { attachment_ids } : {}),
        stream: isStreaming,
      }),
    })
  } catch {
    throw new Error('Could not reach the chat backend. Check that the backend is running.')
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    throw new Error(
      typeof errorJson?.detail === 'string'
        ? errorJson.detail
        : 'The chat request failed. Please try again.',
    )
  }

  if (!isStreaming) {
    const result = await response.json().catch(() => null)
    if (typeof result?.reply !== 'string' || !result.reply.trim()) {
      throw new Error('The chat backend returned an empty response.')
    }
    if (chatId && result.chatId !== chatId) {
      throw new Error('The chat backend returned a response for a different conversation.')
    }
    const sources = Array.isArray(result.sources) ? result.sources : []
    onSources?.(sources)
    return {
      reply: result.reply.trim(),
      sources,
    }
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported by browser.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulatedReply = ''
  let accumulatedSources = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const rawData = trimmed.slice(5).trim()
      if (rawData === '[DONE]') break
      try {
        const payload = JSON.parse(rawData)
        if (payload.type === 'sources' && Array.isArray(payload.sources)) {
          accumulatedSources = payload.sources
          onSources?.(accumulatedSources)
        } else if (payload.type === 'delta' && payload.delta) {
          accumulatedReply += payload.delta
          onDelta(accumulatedReply)
        } else if (payload.type === 'done' && payload.reply) {
          accumulatedReply = payload.reply
          if (Array.isArray(payload.sources)) {
            accumulatedSources = payload.sources
            onSources?.(accumulatedSources)
          }
          onDelta(accumulatedReply)
        } else if (payload.type === 'error') {
          throw new Error(payload.detail || 'Streaming failed')
        }
      } catch (err) {
        if (err.message && !err.message.includes('JSON')) {
          throw err
        }
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith('data:')) {
      const rawData = trimmed.slice(5).trim()
      if (rawData !== '[DONE]') {
        try {
          const payload = JSON.parse(rawData)
          if (payload.type === 'sources' && Array.isArray(payload.sources)) {
            accumulatedSources = payload.sources
            onSources?.(accumulatedSources)
          } else if (payload.type === 'delta' && payload.delta) {
            accumulatedReply += payload.delta
            onDelta(accumulatedReply)
          } else if (payload.type === 'done' && payload.reply) {
            accumulatedReply = payload.reply
            if (Array.isArray(payload.sources)) {
              accumulatedSources = payload.sources
              onSources?.(accumulatedSources)
            }
            onDelta(accumulatedReply)
          }
        } catch {
          // ignore trailing buffer parse errors
        }
      }
    }
  }

  if (!accumulatedReply.trim()) {
    throw new Error('The chat backend returned an empty response.')
  }

  return {
    reply: accumulatedReply.trim(),
    sources: accumulatedSources,
  }
}

export async function fetchBackendConversations() {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/conversations`)
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Backend conversation endpoint offline or unavailable
  }
  return null
}

export async function fetchBackendConversationMessages(conversationId) {
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    )
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Backend conversation endpoint offline or unavailable
  }
  return null
}

export async function renameChatConversation(chatId, newTitle) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/chat/conversations/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: newTitle }),
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Backend conversation endpoint offline or unavailable
  }
  return null
}
