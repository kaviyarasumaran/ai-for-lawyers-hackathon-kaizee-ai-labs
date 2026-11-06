import { useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  Paper,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import MarkdownView from '../chat/MarkdownView'
import { queryCauseListAi } from '../../api/causeList'

export default function CauseListAiDrawer({
  open,
  onClose,
  dateCode,
  items = [],
  onHighlightItems,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your **Court List AI Assistant**. Ask me anything about today’s Madras High Court cause list in natural language — court hall numbers, item numbers, judges, counsel appearances, or hearing stages.',
      matchingIds: [],
    },
  ])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef(null)

  const quickPrompts = [
    'What is the status of the 1:00 AM pipeline?',
    'Which court is item number 1 listed in?',
    'Is Senior Counsel Sundaram appearing today?',
    'Show all cases listed for Admission',
    'What matters are before the Chief Justice?',
  ]

  const handleSend = async (queryText) => {
    const text = (queryText || draft).trim()
    if (!text || isLoading) return

    setDraft('')
    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    try {
      const response = await queryCauseListAi({
        query: text,
        date: dateCode,
        items,
      })

      const assistantMsg = {
        role: 'assistant',
        content: response.answer,
        matchingIds: response.matchingItemIds || [],
        suggestedFollowUps: response.suggestedFollowUps || [],
      }

      setMessages((prev) => [...prev, assistantMsg])

      if (response.matchingItemIds && response.matchingItemIds.length > 0) {
        onHighlightItems?.(response.matchingItemIds)
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ Sorry, I could not query the cause list: ${error.message}`,
        },
      ])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100vw', sm: 440 },
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderLeft: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {/* Drawer Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.2)' : '#eaf2e9',
              color: 'primary.main',
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'text.primary' }}>
              Court List Assistant
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              Dedicated RAG pipeline for Madras High Court
            </Typography>
          </Box>
        </Box>

        <IconButton size="small" onClick={onClose} aria-label="Close AI Agent drawer">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Suggested Quick Prompts */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafbfa' }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, mb: 0.75, letterSpacing: 0.5 }}>
          SUGGESTED QUESTIONS
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {quickPrompts.map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              size="small"
              clickable
              onClick={() => handleSend(prompt)}
              sx={{
                fontSize: '0.72rem',
                height: 24,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#eef2ee',
                '&:hover': { bgcolor: 'primary.main', color: '#fff' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Messages Stream */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          return (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mb: 0.5 }}>
                {isUser ? 'You' : 'Court List Assistant'}
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  maxWidth: '92%',
                  borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  bgcolor: isUser
                    ? (theme) => theme.palette.mode === 'dark' ? '#24372a' : '#edf4ed'
                    : 'background.paper',
                  borderColor: isUser ? 'primary.main' : 'divider',
                }}
              >
                {isUser ? (
                  <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </Typography>
                ) : (
                  <MarkdownView content={msg.content} />
                )}

                {msg.matchingIds && msg.matchingIds.length > 0 && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<GavelOutlinedIcon sx={{ fontSize: 14 }} />}
                      onClick={() => onHighlightItems?.(msg.matchingIds)}
                      sx={{ fontSize: '0.72rem', py: 0.25, textTransform: 'none' }}
                    >
                      Highlight {msg.matchingIds.length} Case{msg.matchingIds.length > 1 ? 's' : ''} on Board
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
          )
        })}

        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', py: 1 }}>
            <CircularProgress size={16} color="inherit" />
            <Typography sx={{ fontSize: '0.8125rem' }}>Analyzing cause list...</Typography>
          </Box>
        )}
      </Box>

      {/* Input Composer */}
      <Divider />
      <Box sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: '6px 12px',
            borderRadius: 2.5,
            borderColor: 'divider',
            '&:focus-within': { borderColor: 'primary.main' },
          }}
        >
          <InputBase
            inputRef={inputRef}
            fullWidth
            placeholder="Ask about court, item number, counsel, or case..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            sx={{ fontSize: '0.875rem' }}
          />
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleSend()}
            disabled={!draft.trim() || isLoading}
            sx={{ p: 0.5 }}
          >
            <SendRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Paper>
      </Box>
    </Drawer>
  )
}
