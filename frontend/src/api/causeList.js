/**
 * API client for Madras High Court Cause List, 1:00 AM Daily Pipeline, and AI Agent.
 */

export async function fetchCauseList(params = '') {
  let query = ''
  if (typeof params === 'string') {
    query = params ? `?date=${encodeURIComponent(params)}` : ''
  } else if (params && typeof params === 'object') {
    const qp = new URLSearchParams()
    if (params.date) qp.set('date', params.date)
    if (params.page != null) qp.set('page', String(params.page))
    if (params.pageSize != null) qp.set('pageSize', String(params.pageSize))
    if (params.search) qp.set('search', params.search)
    if (params.court && params.court !== 'all') qp.set('court', params.court)
    if (params.category && params.category !== 'all') qp.set('category', params.category)
    if (params.session && params.session !== 'all') qp.set('session', params.session)
    const qs = qp.toString()
    query = qs ? `?${qs}` : ''
  }

  const response = await fetch(`/api/cause-list${query}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to fetch cause list (HTTP ${response.status})`)
  }

  return response.json()
}

export function getCauseListPdfDownloadUrl(dateStr = '') {
  return `/api/cause-list/download${dateStr ? `?date=${encodeURIComponent(dateStr)}` : ''}`
}

export async function uploadCauseListPdf(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/cause-list/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to parse cause list PDF (HTTP ${response.status})`)
  }

  return response.json()
}

export async function queryCauseListAi({ query, date = '', items = [] }) {
  const response = await fetch('/api/cause-list/ai-query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, date, items }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `AI query failed (HTTP ${response.status})`)
  }

  return response.json()
}

export async function fetchPipelineStatus() {
  const response = await fetch('/api/cause-list/pipeline/status', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to fetch pipeline status (HTTP ${response.status})`)
  }
  return response.json()
}

export async function triggerPipelineRun(date = '') {
  const response = await fetch('/api/cause-list/pipeline/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ date }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Pipeline trigger failed (HTTP ${response.status})`)
  }
  return response.json()
}

export async function fetchPipelineHistory(limit = 15) {
  const response = await fetch(`/api/cause-list/pipeline/history?limit=${limit}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to fetch pipeline history (HTTP ${response.status})`)
  }
  return response.json()
}

export async function purgeCauseLists() {
  const response = await fetch('/api/cause-list/pipeline/purge', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to purge cause lists (HTTP ${response.status})`)
  }
  return response.json()
}
