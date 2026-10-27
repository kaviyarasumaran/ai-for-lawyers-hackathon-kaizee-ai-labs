const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, options)
  } catch {
    throw new Error('Could not reach the backend. Check that the API is running.')
  }

  if (response.status === 204) return null
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      typeof result?.detail === 'string'
        ? result.detail
        : 'The file request failed. Please try again.',
    )
  }
  return result
}

function createUploadForm(file, fields = {}) {
  const formData = new FormData()
  formData.append('file', file)
  Object.entries(fields).forEach(([name, value]) => formData.append(name, value))
  return formData
}

export function listChatAttachments(chatId) {
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''
  return request(`/api/chat/attachments${query}`)
}

export function uploadChatAttachment(file, source, chatId = 'default-chat') {
  return request('/api/chat/attachments', {
    method: 'POST',
    body: createUploadForm(file, { source, chat_id: chatId }),
  })
}

export function deleteChatAttachment(attachmentId, chatId) {
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''
  return request(`/api/chat/attachments/${encodeURIComponent(attachmentId)}${query}`, {
    method: 'DELETE',
  })
}

export function processChatAttachment(attachmentId, chatId) {
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''
  return request(`/api/chat/attachments/${encodeURIComponent(attachmentId)}/process${query}`, {
    method: 'POST',
  })
}

export function uploadCaseDocument(caseId, file, source) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/documents`, {
    method: 'POST',
    body: createUploadForm(file, { source }),
  })
}

export function deleteCaseDocument(caseId, documentId) {
  return request(
    `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )
}

export function listKnowledgeBaseDocuments() {
  return request('/api/knowledge-base/documents')
}

export function getKnowledgeBaseDocument(documentId) {
  return request(`/api/knowledge-base/documents/${encodeURIComponent(documentId)}`)
}

export function uploadKnowledgeBaseDocument(file, folder) {
  return request(
    '/api/knowledge-base/documents',
    {
      method: 'POST',
      body: createUploadForm(file, {
        folder_id: folder.id,
        folder_name: folder.name,
      }),
    },
  )
}

export function deleteKnowledgeBaseDocument(documentId) {
  return request(`/api/knowledge-base/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  })
}
