import { useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Switch,
  Typography,
  useTheme,
} from '@mui/material'
import { Link } from '@tanstack/react-router'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { useThemeStore } from '../../hooks'

export default function SidebarAccountMenu({ onClose }) {
  const isDark = useTheme().palette.mode === 'dark'
  const { mode, setMode } = useThemeStore()
  const [accountMenuAnchor, setAccountMenuAnchor] = useState(null)
  const isAccountMenuOpen = Boolean(accountMenuAnchor)

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          p: 1.5,
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: isDark ? '#202a25' : 'rgba(255,255,255,.56)',
          boxShadow: 'none',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            width: 27,
            height: 27,
            flex: 'none',
            placeItems: 'center',
            borderRadius: 2,
            color: 'primary.main',
            bgcolor: isDark ? '#29372f' : '#e9f1e9',
          }}
        >
          <ShieldOutlinedIcon sx={{ fontSize: 17 }} />
        </Box>
        <Box>
          <Typography sx={{ color: 'text.primary', fontSize: 'caption.fontSize', fontWeight: 600 }}>
            Your privacy matters
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            Conversations stay yours.
          </Typography>
        </Box>
      </Paper>

      <Button
        fullWidth
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={isAccountMenuOpen}
        onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
        sx={{
          minHeight: 48,
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 1.25,
          mt: 1.25,
          px: 0.75,
          py: 0.5,
          borderRadius: 2,
          color: 'text.primary',
          textAlign: 'left',
          '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            flex: 'none',
            bgcolor: isDark ? '#29372f' : '#dfe9df',
            color: 'primary.main',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          K
        </Avatar>
        <Box sx={{ display: 'flex', minWidth: 0, flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
          <Typography noWrap sx={{ maxWidth: '100%', fontSize: 'caption.fontSize', fontWeight: 600 }}>
            Guest account
          </Typography>
          <Typography noWrap sx={{ maxWidth: '100%', color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            Personal workspace
          </Typography>
        </Box>
        {isAccountMenuOpen ? (
          <ExpandLessRoundedIcon sx={{ width: 17, height: 17, flex: 'none', color: 'text.secondary' }} />
        ) : (
          <ExpandMoreRoundedIcon sx={{ width: 17, height: 17, flex: 'none', color: 'text.secondary' }} />
        )}
      </Button>

      <Menu
        anchorEl={accountMenuAnchor}
        open={isAccountMenuOpen}
        onClose={() => setAccountMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 238, mb: 1, borderRadius: 2.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Guest account
          </Typography>
          <Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            Personal workspace
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          component={Link}
          to="/settings"
          activeProps={{ className: 'active' }}
          onClick={() => {
            setAccountMenuAnchor(null)
            onClose?.()
          }}
          sx={{ minHeight: 39, gap: 1, fontSize: 'caption.fontSize' }}
        >
          <SettingsOutlinedIcon sx={{ color: 'text.secondary', fontSize: 17 }} />
          Account settings
        </MenuItem>
        <MenuItem
          disableRipple
          onClick={(event) => event.stopPropagation()}
          sx={{ minHeight: 39, gap: 1, fontSize: 'caption.fontSize', cursor: 'default' }}
        >
          <DarkModeOutlinedIcon sx={{ color: 'text.secondary', fontSize: 17 }} />
          <Typography sx={{ flex: 1, color: 'text.primary', fontSize: 'caption.fontSize' }}>
            Dark theme
          </Typography>
          <Switch
            checked={mode === 'dark'}
            onChange={(event) => setMode(event.target.checked ? 'dark' : 'light')}
            size="small"
            slotProps={{ input: { 'aria-label': 'Toggle dark theme from account menu' } }}
            sx={{ mr: -0.75 }}
          />
        </MenuItem>
      </Menu>
    </>
  )
}
