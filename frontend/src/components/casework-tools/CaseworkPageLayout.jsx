import { useState } from 'react'
import { Box, Button, Paper, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { Link } from '@tanstack/react-router'
import ChatSidebar from '../chat/ChatSidebar'

function CaseworkPageLayout({ tool, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const ToolIcon = tool?.icon

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbfbf9' }}>
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
          pb: 4,
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
          <Button
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              minWidth: 32,
              width: 32,
              height: 32,
              p: 0,
              color: '#777f78',
            }}
          >
            <MenuRoundedIcon />
          </Button>
          <Button
            component={Link}
            to="/casework-tools"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{ minWidth: 0, color: '#777f78', fontSize: 'caption.fontSize' }}
          >
            Casework tools
          </Button>
          <Typography sx={{ color: '#b0b5ae', fontSize: 'caption.fontSize' }}>/</Typography>
          <Typography noWrap sx={{ color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            {tool?.title ?? 'Overview'}
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 1050, mx: 'auto', pt: { xs: 3, md: 5 } }}>
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
                    color: '#4e7957',
                    bgcolor: '#eaf2e9',
                    '& svg': { fontSize: 23 },
                  }}
                >
                  <ToolIcon />
                </Box>
                <Box>
                  <Typography
                    component="h1"
                    sx={{
                      color: '#27312b',
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: { xs: 23, md: 29 },
                      fontWeight: 700,
                      letterSpacing: '-.8px',
                    }}
                  >
                    {tool.title}
                  </Typography>
                  <Typography sx={{ mt: 0.75, color: '#7f8880', fontSize: 'body2.fontSize', lineHeight: 1.7 }}>
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
                  borderColor: '#e3eae1',
                  borderRadius: 2.5,
                  bgcolor: '#f8fbf6',
                  boxShadow: 'none',
                }}
              >
                <AutoAwesomeOutlinedIcon sx={{ mt: 0.125, color: '#64816a', fontSize: 18 }} />
                <Typography sx={{ color: '#59665b', fontSize: 'body2.fontSize', lineHeight: 1.7 }}>
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
                  color: '#27312b',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: { xs: 25, md: 31 },
                  fontWeight: 700,
                  letterSpacing: '-1px',
                }}
              >
                Casework tools
              </Typography>
              <Typography sx={{ mt: 0.75, mb: 3, color: '#858c85', fontSize: 'body2.fontSize' }}>
                Organize the work around your case files, dates, tasks, and existing systems.
              </Typography>
              {children}
            </Box>
          )}
        </Box>
      </Box>
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
