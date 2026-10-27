import { Box, Typography } from '@mui/material'

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function ChatComposerRecordingBanner({ recordingSeconds, waveform, isDark }) {
  return (
    <Box
      aria-label="Live microphone waveform while transcribing"
      role="status"
      sx={{
        display: 'flex',
        minHeight: 38,
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        mb: 0.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: isDark ? 'rgba(94, 152, 112, 0.35)' : 'rgba(94, 152, 112, 0.25)',
        bgcolor: isDark ? 'rgba(36, 50, 41, 0.85)' : '#f3f8f3',
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: '#e53935',
          boxShadow: '0 0 0 0 rgba(229, 57, 53, 0.7)',
          animation: 'pulseDot 1.5s infinite ease-in-out',
          '@keyframes pulseDot': {
            '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(229, 57, 53, 0.7)' },
            '70%': { transform: 'scale(1)', boxShadow: '0 0 0 6px rgba(229, 57, 53, 0)' },
            '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(229, 57, 53, 0)' },
          },
          flex: 'none',
        }}
      />
      <Typography
        sx={{
          flex: 'none',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: isDark ? '#b2d3ba' : '#336142',
        }}
      >
        {formatTimer(recordingSeconds)}
      </Typography>
      <Typography
        sx={{
          flex: 'none',
          display: { xs: 'none', sm: 'inline' },
          fontSize: 'caption.fontSize',
          fontWeight: 600,
          color: 'text.secondary',
        }}
      >
        · Listening...
      </Typography>
      <Box sx={{ display: 'flex', height: 26, flex: 1, alignItems: 'center', justifyContent: 'center', gap: '2px', overflow: 'hidden', px: 1 }}>
        {waveform.map((height, index) => (
          <Box
            key={index}
            sx={{
              width: 3,
              height: `${height}px`,
              flex: 'none',
              borderRadius: 2,
              bgcolor: '#5e9870',
              opacity: 0.55 + Math.min(height / 50, 0.45),
              transition: 'height 70ms ease',
            }}
          />
        ))}
      </Box>
    </Box>
  )
}
