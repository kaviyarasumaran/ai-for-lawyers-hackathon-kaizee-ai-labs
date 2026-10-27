import { useContext } from 'react'
import { KnowledgeBaseContext } from '../context/KnowledgeBaseContext'

export function useKnowledgeBase() {
  const context = useContext(KnowledgeBaseContext)

  if (!context) {
    throw new Error('useKnowledgeBase must be used inside KnowledgeBaseProvider')
  }

  return context
}
