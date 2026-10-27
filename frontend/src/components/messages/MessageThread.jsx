import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  IconButton,
  InputBase,
  List,
  ListItem,
  Paper,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'

function getInitials(email) {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function MessageThread({ member, messages, onBack, onSend }) {
  const [draft, setDraft] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    onSend(content)
    setDraft('')
  }

  return (
    <>
      <Box sx={{ display: 'flex', minHeight: 66, alignItems: 'center', gap: 1.25, px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton aria-label="Back to conversations" onClick={onBack} sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.light', color: 'primary.dark', fontSize: 'body2.fontSize', fontWeight: 700 }}>
          {getInitials(member.email)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 600 }}>
            {member.email}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            {member.role} · {member.status}
          </Typography>
        </Box>
      </Box>
      <List
        aria-label="Conversation messages"
        sx={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          gap: 1.5,
          overflowY: 'auto',
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
        }}
      >
        {messages.length === 0 ? (
          <ListItem sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
                Start a conversation
              </Typography>
              <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 'body2.fontSize' }}>
                Send a message to {member.email}.
              </Typography>
            </Box>
          </ListItem>
        ) : (
          messages.map((message) => (
            <ListItem key={message.id} disableGutters sx={{ justifyContent: 'flex-end' }}>
              <Box sx={{ maxWidth: '85%' }}>
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: '14px 4px 14px 14px',
                    bgcolor: 'primary.light',
                    color: 'text.primary',
                  }}
                >
                  <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'body2.fontSize', lineHeight: 1.6 }}>
                    {message.content}
                  </Typography>
                </Paper>
                <Typography sx={{ mt: 0.4, color: 'text.secondary', fontSize: 'caption.fontSize', textAlign: 'right' }}>
                  {new Date(message.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Typography>
              </Box>
            </ListItem>
          ))
        )}
      </List>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            p: 0.75,
            pl: 1.5,
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: 'none',
          }}
        >
          <InputBase
            multiline
            maxRows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message..."
            inputProps={{ 'aria-label': 'Write a message' }}
            sx={{ flex: 1, py: 0.5, fontSize: 'body2.fontSize' }}
          />
          <Button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            variant="contained"
            sx={{ minWidth: 36, width: 36, height: 36, p: 0, borderRadius: 1.5 }}
          >
            <ArrowUpwardRoundedIcon sx={{ fontSize: 19 }} />
          </Button>
        </Paper>
      </Box>
    </>
  )
}

export default MessageThread
