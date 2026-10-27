import { Box, Typography } from '@mui/material'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'

export default function ChatEmptyState({ currentCase, isDark }) {
  return (
    <Box
      sx={{
        my: 'auto',
        px: 2,
        py: { xs: 3, md: 2 },
        textAlign: 'center',
        '@media (max-height:900px) and (min-width:601px)': { py: 1.5 },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: { xs: 58, md: 54 },
          height: { xs: 58, md: 54 },
          display: 'grid',
          placeItems: 'center',
          mx: 'auto',
          mb: { xs: 2, md: 1.5 },
          border: '1px solid',
          borderColor: isDark ? '#34483a' : '#dce9dd',
          borderRadius: '18px',
          color: 'primary.main',
          bgcolor: isDark ? '#243229' : '#eaf2e9',
          boxShadow: isDark ? '0 6px 18px rgba(0,0,0,.16)' : '0 6px 18px rgba(49,94,65,.06)',
        }}
      >
        <GavelOutlinedIcon sx={{ fontSize: 31 }} />
      </Box>
      {currentCase && !currentCase.isDefault && (
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 0.75,
            mb: 1.5,
          }}
        >
          <Typography sx={{ color: 'primary.main', fontSize: 'caption.fontSize', fontWeight: 700 }}>
            {currentCase.matterType}
          </Typography>
          {currentCase.parties && (
            <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              · {currentCase.parties}
            </Typography>
          )}
        </Box>
      )}
      <Typography
        sx={{
          mb: 1.75,
          color: '#62836c',
          fontSize: 'caption.fontSize',
          fontWeight: 700,
          letterSpacing: 1.65,
          '@media (max-height:900px) and (min-width:601px)': { mb: 1.5 },
        }}
      >
        YOUR LEGAL ASSISTANT
      </Typography>
      <Typography
        component="h1"
        id="welcome-title"
        sx={{
          color: 'text.primary',
          fontFamily: 'Manrope, "DM Sans", sans-serif',
          fontSize: { xs: 'clamp(27px, 8vw, 34px)', md: 'clamp(28px, 3.2vw, 39px)' },
          fontWeight: 600,
          letterSpacing: '-1.7px',
          lineHeight: 1.2,
        }}
      >
        A clearer path
        <br />
        <Box component="span" sx={{ color: isDark ? '#aac3af' : '#728578' }}>
          through legal questions.
        </Box>
      </Typography>
      <Typography
        sx={{
          maxWidth: 450,
          mx: 'auto',
          mt: { xs: 1.5, md: 1 },
          mb: { xs: 2.875, md: 2.25 },
          color: 'text.secondary',
          fontSize: 'body2.fontSize',
          lineHeight: 1.7,
          '@media (max-height:900px) and (min-width:601px)': {
            mt: 1,
            mb: 2.25,
          },
        }}
      >
        {currentCase && !currentCase.isDefault && currentCase.summary
          ? currentCase.summary
          : 'Ask anything, explore legal frameworks, or open a case to work with specific documents.'}
      </Typography>
    </Box>
  )
}
