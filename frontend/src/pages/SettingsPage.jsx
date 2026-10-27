import { useState } from 'react'
import { Box, FormControlLabel, IconButton, Paper, Switch, Typography } from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useThemeStore } from '../theme/ThemeStoreContext'

function SettingsPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { mode, setMode } = useThemeStore()

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
            minHeight: { xs: 62, md: 73 },
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid #efefeb',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#777f78' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <SettingsOutlinedIcon sx={{ color: '#63836f', fontSize: 19 }} />
          <Typography sx={{ color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Settings
          </Typography>
        </Box>
        <Box sx={{ width: '100%', maxWidth: 900, mx: 'auto', pt: { xs: 3, md: 5 } }}>
          <Typography
            component="h1"
            sx={{
              color: '#27312b',
              fontFamily: 'Manrope, sans-serif',
              fontSize: { xs: 25, md: 30 },
              fontWeight: 700,
              letterSpacing: '-1px',
            }}
          >
            Settings
          </Typography>
          <Typography sx={{ mt: 0.75, mb: 2.5, color: '#858c85', fontSize: 'body2.fontSize' }}>
            Manage your workspace preferences.
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderColor: '#e8eae5',
              borderRadius: 2.5,
              boxShadow: 'none',
            }}
          >
            <Typography sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 700 }}>
              Appearance
            </Typography>
            <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
              Choose the theme used throughout your workspace.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DarkModeOutlinedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                <Box>
                  <Typography sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 600 }}>
                    Dark theme
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
                    {mode === 'dark' ? 'Dark appearance is enabled.' : 'Use a darker appearance across the app.'}
                  </Typography>
                </Box>
              </Box>
              <FormControlLabel
                label={mode === 'dark' ? 'On' : 'Off'}
                labelPlacement="start"
                control={
                  <Switch
                    checked={mode === 'dark'}
                    onChange={(event) => setMode(event.target.checked ? 'dark' : 'light')}
                    slotProps={{ input: { 'aria-label': 'Enable dark theme' } }}
                    size="small"
                  />
                }
                sx={{ m: 0, gap: 1, '& .MuiFormControlLabel-label': { color: 'text.secondary', fontSize: 'body2.fontSize' } }}
              />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}

export default SettingsPage
