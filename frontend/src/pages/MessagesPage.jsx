import { useState } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import ChatSidebar from '../components/chat/ChatSidebar'
import MessagesInbox from '../components/messages/MessagesInbox'

function MessagesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', height: '100dvh', minHeight: 600, bgcolor: 'background.default' }}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
          minHeight: 0,
          flex: 1,
          flexDirection: 'column',
          px: { xs: 2, sm: 3, lg: 5 },
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            minHeight: { xs: 72, md: 80 },
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <ForumOutlinedIcon sx={{ color: 'primary.main', fontSize: 19 }} />
          <Box>
            <Typography component="h1" variant="subtitle1" sx={{ color: 'text.primary' }}>
              Messages
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              Conversations with people in your workspace.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', width: '100%', minHeight: 0, flex: 1, flexDirection: 'column', pt: { xs: 2, md: 3 }, pb: 2 }}>
          <MessagesInbox />
        </Box>
      </Box>
    </Box>
  )
}

export default MessagesPage
