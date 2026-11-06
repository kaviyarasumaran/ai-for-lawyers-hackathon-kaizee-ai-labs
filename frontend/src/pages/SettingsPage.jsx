import { Box, FormControlLabel, Paper, Switch, Typography } from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useThemeStore } from '../hooks'

function SettingsPage() {
  const { mode, setMode } = useThemeStore()

  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 6 }}>
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
        Settings
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 3, color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
        Manage your workspace preferences.
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderColor: 'divider',
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
  )
}

export default SettingsPage
