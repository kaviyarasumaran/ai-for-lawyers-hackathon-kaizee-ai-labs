import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Snackbar,
  Typography,
} from '@mui/material'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import {
  CauseListAiDrawer,
  CauseListFilters,
  CauseListHeader,
  CauseListItemRow,
  CauseListStats,
} from '../components/cause-list'
import {
  fetchCauseList,
  fetchPipelineStatus,
  purgeCauseLists,
  triggerPipelineRun,
} from '../api/causeList'

function getDefaultTodayDateCode() {
  const now = new Date()
  const istFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    weekday: 'short',
  })
  const parts = istFormatter.formatToParts(now)
  const partMap = {}
  parts.forEach((p) => {
    partMap[p.type] = p.value
  })
  const weekday = partMap.weekday

  // On Saturdays & Sundays (court recess), default to the active Friday sitting
  if (weekday === 'Sat' || weekday === 'Sun') {
    const offset = weekday === 'Sat' ? 1 : 2
    const friday = new Date(now.getTime() - offset * 86400000)
    const friParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(friday).split('/')
    return `${friParts[0]}${friParts[1]}${friParts[2]}`
  }

  return `${partMap.day}${partMap.month}${partMap.year}`
}

export default function CauseListPage() {
  const [dateCode, setDateCode] = useState(getDefaultTodayDateCode())
  const [causeData, setCauseData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCourt, setSelectedCourt] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSession, setSelectedSession] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    if (searchQuery === debouncedSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery, debouncedSearch])

  // AI Assistant Drawer
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false)
  const [highlightedItemIds, setHighlightedItemIds] = useState([])

  // 1:00 AM Automated Pipeline State
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [isTriggeringPipeline, setIsTriggeringPipeline] = useState(false)

  const loadPipelineInfo = useCallback(async () => {
    try {
      const status = await fetchPipelineStatus().catch(() => null)
      if (status) setPipelineStatus(status)
    } catch {
      // ignore
    }
  }, [])

  const loadCauseList = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchCauseList({
        date: dateCode,
        page,
        pageSize,
        search: debouncedSearch,
        court: selectedCourt,
        category: selectedCategory,
        session: selectedSession,
      })
      setCauseData(data)
    } catch (err) {
      setError(err.message || 'Failed to load cause list data')
    } finally {
      setIsLoading(false)
    }
  }, [dateCode, page, pageSize, debouncedSearch, selectedCourt, selectedCategory, selectedSession])

  useEffect(() => {
    let ignore = false
    const fetchData = async () => {
      try {
        const data = await fetchCauseList({
          date: dateCode,
          page,
          pageSize,
          search: debouncedSearch,
          court: selectedCourt,
          category: selectedCategory,
          session: selectedSession,
        })
        if (!ignore) {
          setCauseData(data)
          setIsLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Failed to load cause list data')
          setIsLoading(false)
        }
      }
    }
    fetchData()
    return () => {
      ignore = true
    }
  }, [dateCode, page, pageSize, debouncedSearch, selectedCourt, selectedCategory, selectedSession])

  useEffect(() => {
    let ignore = false
    const poll = async () => {
      try {
        const status = await fetchPipelineStatus().catch(() => null)
        if (!ignore && status) {
          setPipelineStatus((prev) => {
            if (prev?.isExecuting && !status.isExecuting) {
              loadCauseList()
            } else if (status.lastRun?.id && prev?.lastRun?.id && status.lastRun.id !== prev.lastRun.id) {
              loadCauseList()
            }
            return status
          })
        }
      } catch {
        // ignore
      }
    }
    poll()
    const timer = setInterval(poll, 15000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [loadCauseList])

  const handleTriggerPipeline = async () => {
    setIsTriggeringPipeline(true)
    setError('')
    try {
      const res = await triggerPipelineRun(dateCode)
      if (res.run?.isWeekend) {
        setSuccessMessage(res.run.errorMessage || 'Weekend recess: Madras High Court does not sit on weekends.')
      } else if (res.success && res.data) {
        setSuccessMessage(`1:00 AM Pipeline executed: ${res.run?.itemsCount || 0} cases extracted via PyMuPDF OCR`)
      } else if (!res.success) {
        setError(res.run?.errorMessage || 'Official cause list is not yet published on MHC portal.')
      }
      await loadCauseList()
      await loadPipelineInfo()
    } catch (err) {
      setError(err.message || 'Failed to trigger cause list pipeline')
    } finally {
      setIsTriggeringPipeline(false)
    }
  }

  const handlePurgePipeline = async () => {
    setIsLoading(true)
    setError('')
    try {
      await purgeCauseLists()
      setCauseData((prev) => ({
        ...(prev || {}),
        items: [],
        totalItems: 0,
        courts: [],
      }))
      setSuccessMessage('11:55 PM Purge rule executed: Deleted all stored case lists.')
      await loadPipelineInfo()
    } catch (err) {
      setError(err.message || 'Failed to purge cause lists')
    } finally {
      setIsLoading(false)
    }
  }

  const items = useMemo(() => causeData?.items || [], [causeData?.items])
  const courts = useMemo(() => causeData?.courts || [], [causeData?.courts])
  const totalItems = causeData?.totalItems ?? items.length
  const totalFiltered = causeData?.totalFiltered ?? items.length
  const totalPages = Math.max(1, causeData?.totalPages ?? Math.ceil(totalFiltered / pageSize))

  const handleHighlightItems = (ids) => {
    setHighlightedItemIds(ids)
    setTimeout(() => {
      const firstId = ids?.[0]
      if (firstId) {
        const el = document.getElementById(firstId)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 6 }}>
      {/* Header with Title, Combined Date & Pipeline Actions */}
      <CauseListHeader
        dateCode={dateCode}
        onDateChange={(newDate) => {
          setDateCode(newDate)
          setPage(1)
        }}
        isLoading={isLoading}
        onRefresh={() => loadCauseList()}
        isAiDrawerOpen={isAiDrawerOpen}
        onToggleAiDrawer={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
        pipelineStatus={pipelineStatus}
        isTriggeringPipeline={isTriggeringPipeline}
        onTriggerPipeline={handleTriggerPipeline}
        onPurgePipeline={handlePurgePipeline}
        onRefreshPipelineStatus={loadPipelineInfo}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {causeData?.isWeekend && (
        <Alert
          severity="info"
          action={
            causeData.latestSittingDate ? (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setDateCode(causeData.latestSittingDate)
                  setPage(1)
                }}
              >
                View {causeData.latestSittingFormatted || 'Friday'} Board
              </Button>
            ) : null
          }
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          {causeData.message || 'Madras High Court is on weekend recess. No court sittings on Saturdays and Sundays.'}
        </Alert>
      )}

      {/* Stats Summary */}
      <CauseListStats items={items} courts={courts} stats={causeData?.stats} />

      {/* Search & Filter Controls */}
      <CauseListFilters
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val)
          setPage(1)
        }}
        selectedCourt={selectedCourt}
        onCourtChange={(val) => {
          setSelectedCourt(val)
          setPage(1)
        }}
        selectedCategory={selectedCategory}
        onCategoryChange={(val) => {
          setSelectedCategory(val)
          setPage(1)
        }}
        selectedSession={selectedSession}
        onSessionChange={(val) => {
          setSelectedSession(val)
          setPage(1)
        }}
        courts={courts}
        totalFiltered={totalFiltered}
        totalItems={totalItems}
      />

      {/* Cause List Content */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 280, gap: 1.5 }}>
          <CircularProgress color="primary" />
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            Fetching Madras High Court cause list and processing OCR...
          </Typography>
        </Box>
      ) : totalItems === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 2.5,
            bgcolor: 'background.paper',
            borderColor: 'divider',
          }}
        >
          <EventNoteOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary', mb: 1.5, opacity: 0.6 }} />
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: 'text.primary' }}>
            No Cause List Data for {causeData?.dateFormatted || dateCode}
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.75, maxWidth: 480, mx: 'auto', lineHeight: 1.6 }}>
            The Madras High Court cause list for this date has not been downloaded or indexed yet. Click <strong>Run Pipeline Now</strong> to trigger the automated 1:00 AM download & OCR pipeline.
          </Typography>
          <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleTriggerPipeline}
              disabled={isTriggeringPipeline}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}
            >
              Run Pipeline Now
            </Button>
          </Box>
        </Paper>
      ) : totalFiltered === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2.5,
            bgcolor: 'background.paper',
            borderColor: 'divider',
          }}
        >
          <EventNoteOutlinedIcon sx={{ fontSize: 42, color: 'text.secondary', mb: 1, opacity: 0.6 }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: 'text.primary' }}>
            No listed cases found matching your filters
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mt: 0.5, maxWidth: 440, mx: 'auto' }}>
            Try resetting your court selection, category tabs, or search terms to see all listed matters for this date.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setSearchQuery('')
              setSelectedCourt('all')
              setSelectedCategory('all')
              setSelectedSession('all')
              setPage(1)
            }}
            sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
          >
            Reset Filters
          </Button>
        </Paper>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {items.map((item) => (
              <Box key={item.id} id={item.id}>
                <CauseListItemRow
                  item={item}
                  isHighlighted={highlightedItemIds.includes(item.id)}
                />
              </Box>
            ))}
          </Box>

          {/* Pagination Controls */}
          {totalFiltered > 0 && (
            <Paper
              variant="outlined"
              sx={{
                mt: 3,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2.5,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                bgcolor: 'background.paper',
              }}
            >
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                Showing <strong>{Math.min((page - 1) * pageSize + 1, totalFiltered)}</strong>–<strong>{Math.min(page * pageSize, totalFiltered)}</strong> of <strong>{totalFiltered}</strong> listed cases
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Per page:</Typography>
                  <Select
                    size="small"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    sx={{ height: 32, fontSize: '0.8125rem', borderRadius: 1.5 }}
                  >
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={20}>20</MenuItem>
                    <MenuItem value={30}>30</MenuItem>
                    <MenuItem value={40}>40</MenuItem>
                  </Select>
                </Box>

                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => {
                    setPage(newPage)
                    window.scrollTo({ top: 320, behavior: 'smooth' })
                  }}
                  color="primary"
                  size="small"
                  showFirstButton
                  showLastButton
                />
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* Dedicated AI Agent Drawer */}
      <CauseListAiDrawer
        open={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        dateCode={dateCode}
        items={items}
        onHighlightItems={handleHighlightItems}
      />

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
  )
}
