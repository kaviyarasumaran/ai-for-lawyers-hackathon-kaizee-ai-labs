import { Box, Button, Paper, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { Link } from '@tanstack/react-router'

function CaseworkPageLayout({ tool, children }) {
  const ToolIcon = tool?.icon

  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 6 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2.5,
        }}
      >
        <Button
          component={Link}
          to="/casework-tools"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ minWidth: 0, color: 'text.secondary', fontSize: 'caption.fontSize', textTransform: 'none' }}
        >
          Casework tools
        </Button>
        <Typography sx={{ color: 'text.disabled', fontSize: 'caption.fontSize' }}>/</Typography>
        <Typography noWrap sx={{ color: 'text.primary', fontSize: 'caption.fontSize', fontWeight: 600 }}>
          {tool?.title ?? 'Overview'}
        </Typography>
      </Box>

      {tool ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 3 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    display: 'grid',
                    width: 46,
                    height: 46,
                    flex: 'none',
                    placeItems: 'center',
                    borderRadius: 2.5,
                    color: 'primary.main',
                    bgcolor: 'action.hover',
                    '& svg': { fontSize: 23 },
                  }}
                >
                  <ToolIcon />
                </Box>
                <Box>
                  <Typography
                    component="h1"
                    sx={{
                      color: 'text.primary',
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: { xs: '1.35rem', sm: '1.625rem' },
                      fontWeight: 700,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {tool.title}
                  </Typography>
                  <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {tool.description}
                  </Typography>
                </Box>
              </Box>
              <Paper
                variant="outlined"
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  p: 2,
                  mb: 2.5,
                  borderRadius: 2.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.1)' : '#f8fbf6',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.25)' : '#e3eae1',
                  boxShadow: 'none',
                }}
              >
                <AutoAwesomeOutlinedIcon sx={{ mt: 0.125, color: 'primary.main', fontSize: 18 }} />
                <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {tool.detail}
                </Typography>
              </Paper>
              {children}
            </>
          ) : (
            <Box>
              <Typography
                component="h1"
                sx={{
                  color: 'text.primary',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: { xs: '1.35rem', sm: '1.625rem' },
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                }}
              >
                Casework tools
              </Typography>
              <Typography sx={{ mt: 0.5, mb: 3, color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Organize the work around your case files, dates, tasks, and existing systems.
              </Typography>
              {children}
            </Box>
          )}
    </Box>
  )
}

export function CaseworkEmptyState({ tool, caseCount, onAction }) {
  const Icon = tool.icon
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        minHeight: 270,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        px: 3,
        py: 4,
        borderColor: '#e8eae5',
        borderRadius: 2.5,
        textAlign: 'center',
        boxShadow: 'none',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'grid',
          width: 48,
          height: 48,
          placeItems: 'center',
          mb: 1.5,
          borderRadius: 2.5,
          color: '#64816a',
          bgcolor: '#eef4ed',
          '& svg': { fontSize: 22 },
        }}
      >
        <Icon />
      </Box>
      <Typography sx={{ color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>
        {caseCount === 0 && tool.actionLabel === 'View cases'
          ? 'Create a case to get started'
          : tool.emptyTitle}
      </Typography>
      <Typography sx={{ maxWidth: 430, mt: 0.75, color: '#929992', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
        {caseCount === 0 && tool.actionLabel === 'View cases'
          ? 'Casework tools are organized around separate cases and their documents.'
          : tool.emptyDescription}
      </Typography>
      <Button
        onClick={onAction}
        endIcon={<ArrowForwardRoundedIcon />}
        variant="outlined"
        sx={{ mt: 2, borderColor: '#dfe6df', color: '#42634b', fontSize: 'caption.fontSize' }}
      >
        {caseCount === 0 && tool.actionLabel === 'View cases'
          ? 'View cases'
          : tool.actionLabel}
      </Button>
    </Paper>
  )
}

export default CaseworkPageLayout
