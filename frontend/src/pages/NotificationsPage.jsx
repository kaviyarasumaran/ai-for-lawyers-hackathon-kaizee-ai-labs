import { Box, Typography } from '@mui/material'
import NotificationCenter from '../components/notifications/NotificationCenter'

function NotificationsPage() {
  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 6 }}>
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
          Notifications
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5, lineHeight: 1.6 }}>
          Updates about your cases, cause lists, tasks, and workspace activity.
        </Typography>
      </Box>
      <NotificationCenter />
    </Box>
  )
}

export default NotificationsPage
