import { useCallback, useState } from 'react'

/**
 * Custom hook to handle copying message text to clipboard with timeout confirmation.
 */
export function useMessageCopy(timeoutMs = 2000) {
  const [copiedId, setCopiedId] = useState(null)

  const handleCopy = useCallback(
    async (messageId, text) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedId(messageId)
        setTimeout(() => setCopiedId(null), timeoutMs)
      } catch {
        // Ignore clipboard write failures
      }
    },
    [timeoutMs],
  )

  return { copiedId, handleCopy }
}
