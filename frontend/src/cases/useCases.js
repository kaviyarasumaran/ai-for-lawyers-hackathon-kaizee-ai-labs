import { useContext } from 'react'
import { CaseContext } from './CaseContext.js'

export function useCases() {
  const context = useContext(CaseContext)

  if (!context) {
    throw new Error('useCases must be used inside CaseProvider')
  }

  return context
}
