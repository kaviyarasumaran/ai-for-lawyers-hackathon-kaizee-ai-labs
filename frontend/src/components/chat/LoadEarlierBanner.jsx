import { memo } from 'react'
import { Box, Button } from '@mui/material'
import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined'

function LoadEarlierBanner({ remainingCount, onLoadEarlier, isDark }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 1, flex: 'none' }}>
      <Button
        variant="outlined"
        size="small"
        onClick={onLoadEarlier}
        startIcon={<KeyboardArrowUpOutlinedIcon sx={{ fontSize: 18 }} />}
        sx={{
          borderRadius: 999,
          textTransform: 'none',
          fontSize: '0.8rem',
          fontWeight: 500,
          px: 2,
          py: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
          color: 'text.secondary',
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          backdropFilter: 'blur(8px)',
          '&:hover': {
            borderColor: 'primary.main',
            color: 'text.primary',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          },
        }}
      >
        Load earlier messages ({remainingCount} remaining)
      </Button>
    </Box>
  )
}

export default memo(LoadEarlierBanner)
