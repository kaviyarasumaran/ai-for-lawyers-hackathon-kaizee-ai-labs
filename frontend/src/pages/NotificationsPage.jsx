import { useState } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import ChatSidebar from '../components/chat/ChatSidebar'
import NotificationCenter from '../components/notifications/NotificationCenter'

function NotificationsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
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
          <NotificationsNoneOutlinedIcon sx={{ color: 'primary.main', fontSize: 19 }} />
          <Box>
            <Typography component="h1" variant="subtitle1" sx={{ color: 'text.primary' }}>
              Notifications
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              Updates about your cases and workspace activity.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto', pt: { xs: 2, md: 3 } }}>
          <NotificationCenter />
        </Box>
      </Box>
    </Box>
  )
}

export default NotificationsPage
