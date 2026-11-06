import { Box, Typography } from '@mui/material'
import MessagesInbox from '../components/messages/MessagesInbox'

function MessagesPage() {
  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: '1.35rem', sm: '1.625rem' },
            fontWeight: 700,
            fontFamily: 'Manrope, sans-serif',
            color: 'text.primary',
            letterSpacing: '-0.5px',
          }}
        >
          Messages
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5, lineHeight: 1.6 }}>
          Conversations with counsel, clerks, and team members in your workspace.
        </Typography>
      </Box>
      <MessagesInbox />
    </Box>
  )
}

export default MessagesPage
