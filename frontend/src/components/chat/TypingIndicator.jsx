import { Box, Typography } from '@mui/material'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

export default function TypingIndicator({ isDark }) {
  return (
    <Box
      component="article"
      aria-label="Assistant is preparing a response"
      aria-live="polite"
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'grid',
          width: 32,
          height: 32,
          flex: 'none',
          placeItems: 'center',
          borderRadius: 2,
          color: 'primary.main',
          bgcolor: isDark ? '#29372f' : '#e9f1e9',
          mt: 0.25,
        }}
      >
        <GavelOutlinedIcon sx={{ fontSize: 19 }} />
      </Box>
      <Box>
        <Typography sx={{ mb: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize', fontWeight: 600 }}>
          Counsel assistant
        </Typography>
        <Box
          role="status"
          sx={{
            display: 'flex',
            minHeight: 38,
            alignItems: 'center',
            gap: 0.65,
            px: 1.5,
            py: 0.5,
          }}
        >
          {[0, 1, 2].map((dot) => (
            <Box
              key={dot}
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                opacity: 0.45,
                animation: 'assistantTyping 1.1s ease-in-out infinite',
                animationDelay: `${dot * 160}ms`,
                '@keyframes assistantTyping': {
                  '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
                  '30%': { transform: 'translateY(-4px)', opacity: 1 },
                },
              }}
            />
          ))}
          <Typography sx={{ ml: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            Analyzing documents and preparing response...
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
