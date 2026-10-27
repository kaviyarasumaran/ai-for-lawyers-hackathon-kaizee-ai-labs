import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Alert,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useNavigate } from '@tanstack/react-router'
import ChatSidebar from '../components/chat/ChatSidebar'
import NewCaseDialog from '../cases/NewCaseDialog'
import { useCases } from '../cases/useCases'

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function CasesPage() {
  const isDark = useTheme().palette.mode === 'dark'
  const navigate = useNavigate()
  const { cases, isCasesLoading, caseError, clearCaseError } = useCases()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false)
  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')

  const activeCases = cases
    .filter((caseItem) => !caseItem.isDefault)
    .sort((first, second) => second.lastActivityAt.localeCompare(first.lastActivityAt))

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activeCases
    return activeCases.filter((caseItem) =>
      [
        caseItem.title,
        caseItem.matterType,
        caseItem.parties,
        caseItem.summary,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [activeCases, search])

  function openCase(caseItem) {
    navigate({ to: '/cases/$caseId', params: { caseId: caseItem.id } })
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbfbf9' }}>
      <ChatSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
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
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, ml: -0.75, color: 'text.secondary' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Typography sx={{ color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            All cases
          </Typography>
          <Chip
            label={activeCases.length}
            size="small"
            sx={{ height: 22, bgcolor: '#eef3ed', color: '#64816a', fontSize: 'caption.fontSize' }}
          />
        </Box>

        <Box sx={{ width: '100%', maxWidth: 1240, mx: 'auto', pt: { xs: 3, md: 4 } }}>
          {caseError && (
            <Alert severity="error" onClose={clearCaseError} sx={{ mb: 2 }}>
              {caseError}
            </Alert>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              mb: 3,
            }}
          >
            <Box>
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
                Your cases
              </Typography>
              <Typography sx={{ mt: 0.75, color: '#858c85', fontSize: 'body2.fontSize' }}>
                Keep every matter and its documents in a separate private chat.
              </Typography>
            </Box>
            <Button
              onClick={() => setIsNewCaseOpen(true)}
              startIcon={<AddRoundedIcon />}
              variant="contained"
              sx={{ minHeight: 39, px: 1.75, fontSize: 'body2.fontSize' }}
            >
              New case
            </Button>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              flexDirection: { xs: 'column', sm: 'row' },
              mb: 2,
            }}
          >
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cases"
              size="small"
              sx={{
                width: { xs: '100%', sm: 300 },
                '& .MuiInputBase-root': {
                  height: 38,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  fontSize: 'body2.fontSize',
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: isDark ? '#526858' : '#b9cdbf',
                },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <ToggleButtonGroup
              exclusive
              value={view}
              onChange={(_, nextView) => {
                if (nextView) setView(nextView)
              }}
              size="small"
              aria-label="Case view"
              sx={{
                alignSelf: { xs: 'flex-end', sm: 'auto' },
                '& .MuiToggleButton-root': {
                  width: 38,
                  height: 34,
                  borderColor: '#e6e9e3',
                  color: '#879087',
                },
                '& .Mui-selected': { color: '#286852 !important', bgcolor: '#eaf2e9 !important' },
              }}
            >
              <ToggleButton value="grid" aria-label="Grid view">
                <AppsOutlinedIcon sx={{ fontSize: 18 }} />
              </ToggleButton>
              <ToggleButton value="list" aria-label="List view">
                <ListAltOutlinedIcon sx={{ fontSize: 18 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {isCasesLoading ? (
            <Paper
              variant="outlined"
              sx={{ display: 'grid', minHeight: 180, placeItems: 'center', borderColor: 'divider', borderRadius: 2.5 }}
            >
              <Typography color="text.secondary">Loading cases…</Typography>
            </Paper>
          ) : filteredCases.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                display: 'flex',
                minHeight: 310,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                borderColor: '#e8eae5',
                borderRadius: 2.5,
                boxShadow: 'none',
                textAlign: 'center',
              }}
            >
              <Box sx={{ display: 'grid', width: 50, height: 50, placeItems: 'center', mb: 1.5, borderRadius: 3, color: '#64816a', bgcolor: '#eef4ed' }}>
                <FolderOutlinedIcon />
              </Box>
              <Typography sx={{ color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                {search ? 'No matching cases' : 'No cases yet'}
              </Typography>
              <Typography sx={{ mt: 0.75, color: '#929992', fontSize: 'caption.fontSize' }}>
                {search
                  ? 'Try a different search term.'
                  : 'Create a case to start a chat and keep its documents together.'}
              </Typography>
              {!search && (
                <Button
                  onClick={() => setIsNewCaseOpen(true)}
                  startIcon={<AddRoundedIcon />}
                  variant="contained"
                  sx={{ mt: 2, fontSize: 'caption.fontSize' }}
                >
                  Create your first case
                </Button>
              )}
            </Paper>
          ) : (
            <Box
              sx={{
                display: view === 'grid' ? 'grid' : 'flex',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1.5,
              }}
            >
              {filteredCases.map((caseItem) => {
                const documentCount = caseItem.documents.length
                const messageCount = caseItem.messages.filter(
                  (message) => message.role === 'user',
                ).length
                return (
                  <Paper
                    component="button"
                    key={caseItem.id}
                    onClick={() => openCase(caseItem)}
                    variant="outlined"
                    sx={{
                      display: 'flex',
                      width: '100%',
                      minWidth: 0,
                      minHeight: view === 'grid' ? 190 : 96,
                      alignItems: 'stretch',
                      flexDirection: view === 'grid' ? 'column' : 'row',
                      gap: 1.5,
                      p: 2,
                      borderColor: '#e8eae5',
                      borderRadius: 2.5,
                      bgcolor: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: '#cbdacb',
                        boxShadow: '0 8px 22px rgba(47,76,53,.07)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 1.25 }}>
                      <Box sx={{ display: 'grid', width: 38, height: 38, flex: 'none', placeItems: 'center', borderRadius: 2, color: '#4e7a5e', bgcolor: '#edf3eb' }}>
                        <FolderOutlinedIcon sx={{ fontSize: 20 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ color: '#303832', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                          {caseItem.title}
                        </Typography>
                        <Typography noWrap sx={{ mt: 0.375, color: '#8b938b', fontSize: 'caption.fontSize' }}>
                          {caseItem.matterType}
                          {caseItem.parties ? ` · ${caseItem.parties}` : ''}
                        </Typography>
                      </Box>
                      <Chip label={caseItem.status} size="small" sx={{ height: 22, color: '#52775b', bgcolor: '#eef4ed', fontSize: 'caption.fontSize' }} />
                    </Box>

                    {caseItem.summary ? (
                      <Typography
                        sx={{
                          display: '-webkit-box',
                          overflow: 'hidden',
                          color: '#7c857d',
                          fontSize: 'caption.fontSize',
                          lineHeight: 1.65,
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: view === 'grid' ? 2 : 1,
                        }}
                      >
                        {caseItem.summary}
                      </Typography>
                    ) : (
                      <Typography sx={{ color: '#b0b5af', fontSize: 'caption.fontSize' }}>
                        No case summary added.
                      </Typography>
                    )}

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.75,
                        mt: view === 'grid' ? 'auto' : 'auto',
                      }}
                    >
                      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#899189', fontSize: 'caption.fontSize' }}>
                        <DescriptionOutlinedIcon sx={{ fontSize: 14 }} />
                        {documentCount} document{documentCount === 1 ? '' : 's'}
                      </Typography>
                      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#899189', fontSize: 'caption.fontSize' }}>
                        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                        {messageCount} message{messageCount === 1 ? '' : 's'}
                      </Typography>
                      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 13 }} />
                        {formatDate(caseItem.lastActivityAt)}
                      </Typography>
                    </Box>
                  </Paper>
                )
              })}
            </Box>
          )}
        </Box>
      </Box>
      <NewCaseDialog
        open={isNewCaseOpen}
        onClose={() => setIsNewCaseOpen(false)}
        onCreated={(caseItem) => {
          setIsNewCaseOpen(false)
          openCase(caseItem)
        }}
      />
    </Box>
  )
}

export default CasesPage
