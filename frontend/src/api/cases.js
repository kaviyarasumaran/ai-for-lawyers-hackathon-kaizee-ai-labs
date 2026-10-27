const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? ''

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, options)
  } catch {
    throw new Error('Could not reach the backend. Check that the API and database are running.')
  }

  if (response.status === 204) return null
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      typeof result?.detail === 'string'
        ? result.detail
        : 'The case request failed. Please try again.',
    )
  }
  return result
}

export function listCases() {
  return request('/api/cases')
}

export function createCaseRecord(caseData) {
  return request('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData),
  })
}

export function updateCaseRecord(caseId, caseData) {
  return request(`/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData),
  })
}

export function deleteCaseRecord(caseId) {
  return request(`/api/cases/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
  })
}

export function getCasePipeline(caseId) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/pipeline`)
}

export function retryCasePipeline(caseId) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/pipeline/retry`, {
    method: 'POST',
  })
}

export function restartCasePipeline(caseId) {
  return request(`/api/cases/${encodeURIComponent(caseId)}/pipeline/restart`, {
    method: 'POST',
  })
}
