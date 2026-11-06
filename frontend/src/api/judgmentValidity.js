const API_BASE_URL = import.meta.env.VITE_API_URL || ''

async function handleResponse(response, fallbackMessage) {
  if (!response.ok) {
    let errorDetail = fallbackMessage
    try {
      const errorJson = await response.json()
      errorDetail = errorJson.detail || errorDetail
    } catch {
      // Ignore JSON parse error and use fallback
    }
    throw new Error(errorDetail)
  }
  return response.json()
}

export async function fetchJudgmentValidityOverview({ status, q } = {}) {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (q && q.trim()) params.set('q', q.trim())

  const queryString = params.toString() ? `?${params.toString()}` : ''
  const response = await fetch(`${API_BASE_URL}/api/judgment-validity${queryString}`)
  return handleResponse(response, 'Could not load judgment validity library.')
}

export async function verifyCitation({ citation, caseId } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/judgment-validity/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ citation, caseId: caseId || undefined }),
  })
  return handleResponse(response, 'Could not verify citation validity.')
}

export async function batchVerifyCitations({ text, citations, caseId } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/judgment-validity/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, citations, caseId: caseId || undefined }),
  })
  return handleResponse(response, 'Could not batch verify citations.')
}

export async function linkPrecedentToCase({ caseId, precedent }) {
  const response = await fetch(`${API_BASE_URL}/api/judgment-validity/link-case`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, precedent }),
  })
  return handleResponse(response, 'Could not link precedent to case.')
}

export async function searchJudgments({ query, court, year, limit = 15 } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/judgment/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      court: court || undefined,
      year: year ? Number(year) : undefined,
      limit,
    }),
  })
  return handleResponse(response, 'Failed to search judgment records.')
}

export async function analyzeJudgment({ judgment_id, query, court, year } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/v1/judgment/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      judgment_id: judgment_id || undefined,
      query: query || undefined,
      court: court || undefined,
      year: year ? Number(year) : undefined,
    }),
  })
  return handleResponse(response, 'Failed to analyze judgment validity.')
}

export async function getJudgmentDetails(judgmentId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/judgment/${encodeURIComponent(judgmentId)}`)
  return handleResponse(response, 'Could not retrieve judgment details.')
}

export async function getJudgmentTreatmentHistory(judgmentId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/judgment/${encodeURIComponent(judgmentId)}/treatment-history`)
  return handleResponse(response, 'Could not retrieve treatment history.')
}
