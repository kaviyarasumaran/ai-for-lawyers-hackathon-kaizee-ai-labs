/**
 * Utility functions for chat messages, media detection, citation stripping, and URL resolution.
 */
import { formatBytes } from './formatters'

export { formatBytes }

export function getMediaType(item) {
  const type = (item?.type || '').toLowerCase()
  const name = (item?.name || '').toLowerCase()
  const ext = name.split('.').pop() || ''
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'heic', 'tiff', 'tif'].includes(ext)
  ) {
    return 'image'
  }
  // Audio check: prioritize audio types and filenames (voice recordings, audio notes)
  const isAudio =
    type.startsWith('audio/') ||
    ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'weba'].includes(ext) ||
    (ext === 'webm' && (type.includes('audio') || name.includes('voice') || name.includes('audio') || !name.includes('video')))
  if (isAudio) {
    return 'audio'
  }
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'flv', 'm4v', 'webm'].includes(ext)) {
    return 'video'
  }
  return 'document'
}

export function getMediaCategory(item) {
  const t = getMediaType(item)
  if (t === 'image') return 'images'
  if (t === 'video') return 'videos'
  if (t === 'audio') return 'audio'
  return 'documents'
}

export function stripSourceCitationBlocks(text) {
  if (!text || typeof text !== 'string') return ''
  // 1. Remove explicit Source Citation: / Sources: trailing block
  const p1 = /(?:\n|\r\n)*(?:---\s*(?:\n|\r\n)*)?(?:#{1,6}\s*|\*{1,2}\s*)?(?:Source\s+Citations?|Sources?|Source\s+Reference|References?)(?::\*{1,2}|\*{1,2}:?|:)?\s*(?:\n|\r\n)+[\s\S]*?(?:Document|Section|Page|Act|Article|Doc)[\s\S]*$/i
  let cleaned = text.replace(p1, '').trim()
  // 2. Also remove naked trailing Document: ... Section: ... Page(s): ... blocks
  const p2 = /(?:\n|\r\n)*(?:---\s*(?:\n|\r\n)*)?Document\s*:\s*[^\n]+\n+Section\s*:\s*[^\n]+[\s\S]*$/i
  cleaned = cleaned.replace(p2, '').trim()
  return cleaned
}

export function resolveSourceFileUrl(source, caseId, chatId) {
  if (source?.url && (source.url.startsWith('http') || source.url.startsWith('/'))) {
    return source.url
  }
  const docId = source?.document_id || source?.id
  if (!docId) return null

  if (source?.sourceType === 'global_legal_authority') {
    return `/api/knowledge-base/documents/${encodeURIComponent(docId)}/file`
  }
  if (source?.sourceType === 'case_document' && caseId) {
    return `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/file`
  }
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''
  return `/api/chat/attachments/${encodeURIComponent(docId)}/file${query}`
}
