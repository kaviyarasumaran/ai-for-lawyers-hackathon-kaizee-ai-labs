import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const INITIAL_PAGE_SIZE = 25
const BATCH_SIZE = 20

/**
 * Custom hook encapsulating message pagination, infinite scroll,
 * and smart auto-scrolling for chat conversations.
 */
export function useChatScroll({ messages = [], isAssistantTyping = false }) {
  const containerRef = useRef(null)
  const endOfMessagesRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE)

  const isPrependingRef = useRef(false)
  const prevScrollHeightRef = useRef(0)
  const prevMessagesLengthRef = useRef(messages.length)
  const isInitialRenderRef = useRef(true)

  const firstMessageId = messages[0]?.id
  const prevFirstMessageIdRef = useRef(firstMessageId)

  // Reset pagination if user switches to a different chat
  useEffect(() => {
    if (firstMessageId !== prevFirstMessageIdRef.current) {
      prevFirstMessageIdRef.current = firstMessageId
      setVisibleCount(INITIAL_PAGE_SIZE)
      isInitialRenderRef.current = true
    }
  }, [firstMessageId])

  // Automatically expand visible count when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const addedCount = messages.length - prevMessagesLengthRef.current
      setVisibleCount((prev) => prev + addedCount)
    }
  }, [messages.length])

  // Maintain scroll position when earlier messages are loaded, or scroll to bottom on new message
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (isPrependingRef.current) {
      const scrollDiff = el.scrollHeight - prevScrollHeightRef.current
      el.scrollTop += scrollDiff
      isPrependingRef.current = false
    } else if (isInitialRenderRef.current) {
      el.scrollTop = el.scrollHeight
      isInitialRenderRef.current = false
    } else if (messages.length > prevMessagesLengthRef.current || isAssistantTyping) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages, visibleCount, isAssistantTyping])

  function handleLoadEarlier() {
    if (visibleCount >= messages.length) return
    isPrependingRef.current = true
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight
    }
    setVisibleCount((prev) => Math.min(messages.length, prev + BATCH_SIZE))
  }

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    if (el.scrollTop < 40 && visibleCount < messages.length && !isPrependingRef.current) {
      handleLoadEarlier()
    }
  }

  const startIndex = Math.max(0, messages.length - visibleCount)
  const visibleMessages = messages.slice(startIndex)
  const hasEarlier = startIndex > 0

  return {
    containerRef,
    endOfMessagesRef,
    visibleMessages,
    startIndex,
    hasEarlier,
    handleLoadEarlier,
    handleScroll,
  }
}
