import { memo, useCallback, useState } from 'react'
import { Box, useTheme } from '@mui/material'
import MessageItem from './MessageItem'
import TypingIndicator from './TypingIndicator'
import SourcesDrawer from './SourcesDrawer'
import LoadEarlierBanner from './LoadEarlierBanner'
import { useChatScroll } from '../../hooks/useChatScroll'
import { useMessageCopy } from '../../hooks/useMessageCopy'

function ChatMessages({ messages = [], caseId, chatId, isAssistantTyping = false, onBranch }) {
  const isDark = useTheme().palette.mode === 'dark'
  const [drawerSources, setDrawerSources] = useState(null)

  const {
    containerRef,
    endOfMessagesRef,
    visibleMessages,
    startIndex,
    hasEarlier,
    handleLoadEarlier,
    handleScroll,
  } = useChatScroll({ messages, isAssistantTyping })

  const { copiedId, handleCopy } = useMessageCopy()

  const handleOpenSources = useCallback((sources) => {
    setDrawerSources(sources)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerSources(null)
  }, [])

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      component="section"
      aria-label="Conversation"
      sx={{
        display: 'flex',
        width: 'min(100%, 900px)',
        flex: 1,
        flexDirection: 'column',
        gap: 3,
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        py: { xs: 3, md: 4.5 },
      }}
    >
      {hasEarlier && (
        <LoadEarlierBanner
          remainingCount={startIndex}
          onLoadEarlier={handleLoadEarlier}
          isDark={isDark}
        />
      )}

      {visibleMessages.map((message, index) => {
        const originalIndex = startIndex + index
        return (
          <MessageItem
            key={message.id || originalIndex}
            message={message}
            originalIndex={originalIndex}
            isCopied={copiedId === message.id}
            onCopy={handleCopy}
            onBranch={onBranch}
            onOpenSources={handleOpenSources}
            chatId={chatId}
            isDark={isDark}
          />
        )
      })}

      {isAssistantTyping && <TypingIndicator isDark={isDark} />}

      <Box ref={endOfMessagesRef} aria-hidden="true" sx={{ flex: 'none' }} />

      <SourcesDrawer
        open={Boolean(drawerSources && drawerSources.length > 0)}
        sources={drawerSources || []}
        caseId={caseId}
        chatId={chatId}
        onClose={handleCloseDrawer}
        isDark={isDark}
      />
    </Box>
  )
}

export default memo(ChatMessages)
