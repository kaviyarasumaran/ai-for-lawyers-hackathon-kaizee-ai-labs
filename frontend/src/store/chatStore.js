/**
 * Storage and state persistence utilities for chats and case message history.
 */

export const CHATS_STORAGE_KEY = 'ai_lawyer_chats'
export const ACTIVE_CHAT_KEY = 'ai_lawyer_active_chat_id'
export const CASE_MESSAGES_KEY = 'ai_lawyer_case_messages'

export const defaultCase = {
  id: 'default-chat',
  title: 'General legal chat',
  matterType: 'General question',
  parties: '',
  summary: '',
  status: 'Open',
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  documents: [],
  messages: [],
  isDefault: true,
}

export function createChat({ id = null, parentId = null, title = 'New chat', messages = [] } = {}) {
  const now = new Date().toISOString()
  return {
    id: id || crypto.randomUUID(),
    title,
    messages,
    parentId,
    pinned: false,
    createdAt: now,
    lastActivityAt: now,
  }
}

export function loadSavedChats() {
  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return [createChat()]
}

export function saveChats(chats) {
  try {
    window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats))
  } catch (error) {
    console.warn('Failed to persist chats to localStorage', error)
  }
}

export function loadSavedActiveChatId(defaultId) {
  try {
    const saved = window.localStorage.getItem(ACTIVE_CHAT_KEY)
    if (saved) return saved
  } catch {
    // Ignore storage errors
  }
  return defaultId
}

export function saveActiveChatId(activeChatId) {
  if (!activeChatId) return
  try {
    window.localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId)
  } catch {
    // ignore
  }
}

export function loadSavedCaseMessages() {
  try {
    const raw = window.localStorage.getItem(CASE_MESSAGES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return {}
}

export function saveCaseMessages(messagesMap) {
  try {
    window.localStorage.setItem(CASE_MESSAGES_KEY, JSON.stringify(messagesMap))
  } catch (error) {
    console.warn('Failed to persist case messages to localStorage', error)
  }
}

export function mapBackendMessageToChat(m) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    sources: Array.isArray(m.citations) && m.citations.length > 0
      ? m.citations.map((c) => ({
          id: c.source_id || c.id,
          document_id: c.document_id,
          name: c.document_title || c.name || 'Legal Document',
          section: c.section || '',
          pageStart: c.pageStart ?? c.page ?? 1,
          pageEnd: c.pageEnd ?? c.page ?? 1,
          sourceType: c.source_type,
          url: c.url,
          snippet: c.quote || c.snippet || '',
        }))
      : (Array.isArray(m.sources) ? m.sources : []),
    createdAt: m.created_at,
  }
}
