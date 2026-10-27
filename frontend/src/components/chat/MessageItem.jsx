import { memo, useMemo } from 'react'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import MarkdownView from './MarkdownView'
import MessageAttachmentCard from './MessageAttachmentCard'
import { SourceTriggerButton } from './SourcesDrawer'
import { stripSourceCitationBlocks } from '../../utils/chatUtils'

function AssistantMessageContent({
  message,
  originalIndex,
  isCopied,
  onCopy,
  onBranch,
  onOpenSources,
  isDark,
}) {
  const displayContent = useMemo(
    () => stripSourceCitationBlocks(message.content),
    [message.content],
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
      <MarkdownView content={displayContent} />

      {message.sources && message.sources.length > 0 && (
        <SourceTriggerButton
          count={message.sources.length}
          onClick={() => onOpenSources?.(message.sources)}
          isDark={isDark}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
        <Tooltip title={isCopied ? 'Copied to clipboard' : 'Copy response'}>
          <IconButton
            aria-label="Copy assistant response"
            onClick={() => onCopy?.(message.id, displayContent)}
            size="small"
            sx={{
              color: isCopied ? 'primary.main' : 'text.secondary',
              p: 0.6,
              '&:hover': { color: 'text.primary' },
            }}
          >
            {isCopied ? (
              <CheckOutlinedIcon sx={{ fontSize: 16 }} />
            ) : (
              <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>

        {onBranch && (
          <Tooltip title="Branch chat from this message">
            <IconButton
              aria-label={`Branch chat from message ${originalIndex + 1}`}
              onClick={() => onBranch(originalIndex)}
              size="small"
              sx={{
                color: 'text.secondary',
                p: 0.6,
                '&:hover': { color: 'text.primary' },
              }}
            >
              <CallSplitOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}

function UserMessageContent({ message, originalIndex, onBranch, chatId, isDark }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '100%' }}>
      <Box
        sx={{
          p: '12px 16px',
          border: '1px solid',
          borderColor: isDark ? '#3a5441' : '#e3ede3',
          borderRadius: '14px 3px 14px 14px',
          color: isDark ? '#d1e5d4' : '#355342',
          bgcolor: isDark ? '#24372a' : '#edf4ed',
          maxWidth: '100%',
        }}
      >
        {message.attachments && message.attachments.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: message.content ? 1.25 : 0 }}>
            {message.attachments.map((att, attIdx) => (
              <MessageAttachmentCard
                key={att.id || attIdx}
                attachment={att}
                isDark={isDark}
                chatId={chatId}
              />
            ))}
          </Box>
        )}
        {message.content && (
          <Typography
            sx={{
              fontSize: 'body2.fontSize',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {message.content}
          </Typography>
        )}
      </Box>

      {onBranch && (
        <Tooltip title="Branch chat from this message">
          <IconButton
            aria-label={`Branch chat from message ${originalIndex + 1}`}
            onClick={() => onBranch(originalIndex)}
            size="small"
            sx={{ mt: 0.25, color: 'text.secondary' }}
          >
            <CallSplitOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}

function MessageItem({
  message,
  originalIndex,
  isCopied,
  onCopy,
  onBranch,
  onOpenSources,
  chatId,
  isDark,
}) {
  const isAssistant = message.role === 'assistant'

  return (
    <Box
      component="article"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: isAssistant ? 'flex-start' : 'flex-end',
        gap: 1.5,
        width: '100%',
      }}
    >
      {isAssistant && (
        <Box
          aria-hidden="true"
          sx={{
            display: 'grid',
            width: 32,
            height: 32,
            flex: 'none',
            placeItems: 'center',
            borderRadius: 2,
            color: 'primary.main',
            bgcolor: isDark ? '#29372f' : '#e9f1e9',
            mt: 0.25,
          }}
        >
          <GavelOutlinedIcon sx={{ fontSize: 19 }} />
        </Box>
      )}

      <Box
        sx={{
          maxWidth: isAssistant ? 'min(92%, 820px)' : 'min(85%, 680px)',
          width: isAssistant ? '100%' : 'auto',
        }}
      >
        <Typography
          sx={{
            mb: 0.75,
            color: 'text.secondary',
            textAlign: isAssistant ? 'left' : 'right',
            fontSize: 'caption.fontSize',
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          {isAssistant ? 'Counsel assistant' : 'You'}
        </Typography>

        {isAssistant ? (
          <AssistantMessageContent
            message={message}
            originalIndex={originalIndex}
            isCopied={isCopied}
            onCopy={onCopy}
            onBranch={onBranch}
            onOpenSources={onOpenSources}
            isDark={isDark}
          />
        ) : (
          <UserMessageContent
            message={message}
            originalIndex={originalIndex}
            onBranch={onBranch}
            chatId={chatId}
            isDark={isDark}
          />
        )}
      </Box>
    </Box>
  )
}

export default memo(MessageItem)
