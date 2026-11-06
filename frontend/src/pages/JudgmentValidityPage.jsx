import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined'
import {
  CitationSearchVerifyBar,
  PrecedentCard,
  BatchCitationDialog,
  LinkCaseModal,
  JudgmentValidityReportCard,
} from '../components/judgment-validity'
import {
  fetchJudgmentValidityOverview,
  verifyCitation,
  batchVerifyCitations,
  linkPrecedentToCase,
  analyzeJudgment,
} from '../api/judgmentValidity'
import { useCases } from '../hooks'

export default function JudgmentValidityPage() {
  const { cases } = useCases()
  const [stats, setStats] = useState({
    total: 0,
    goodLaw: 0,
    overruled: 0,
    distinguished: 0,
    casesImpacted: 0,
  })
  const [precedents, setPrecedents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isBatchOpen, setIsBatchOpen] = useState(false)
  const [linkingPrecedent, setLinkingPrecedent] = useState(null)
  const [notification, setNotification] = useState('')
  const [recentVerified, setRecentVerified] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [validityReport, setValidityReport] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const data = await fetchJudgmentValidityOverview({
        status: statusFilter,
        q: searchFilter,
      })
      setStats(data.stats || {})
      setPrecedents(data.precedents || [])
    } catch (err) {
      setErrorMessage(err.message || 'Could not load citator precedents.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, searchFilter])

  useEffect(() => {
    let isMounted = true
    async function fetchData() {
      setIsLoading(true)
      try {
        const data = await fetchJudgmentValidityOverview({
          status: statusFilter,
        })
        if (!isMounted) return
        setStats(data.stats || {})
        setPrecedents(data.precedents || [])
      } catch (err) {
        if (!isMounted) return
        setErrorMessage(err.message || 'Could not load citator precedents.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchData()
    return () => {
      isMounted = false
    }
  }, [statusFilter, refreshKey])

  const handleVerify = async (citation) => {
    setIsVerifying(true)
    setIsAnalyzing(true)
    setErrorMessage('')
    try {
      try {
        const report = await analyzeJudgment({ query: citation })
        if (report?.judgment) {
          setValidityReport(report)
        }
      } catch (analyzeErr) {
        console.debug('Deep analysis notice:', analyzeErr)
      }

      const result = await verifyCitation({ citation })
      setRecentVerified(result)
      setNotification(`Verified '${result.caseName}' (${result.status?.toUpperCase()})`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed.')
    } finally {
      setIsVerifying(false)
      setIsAnalyzing(false)
    }
  }

  const handleBatchVerify = async ({ text, caseId }) => {
    const results = await batchVerifyCitations({ text, caseId })
    setRefreshKey((k) => k + 1)
    setNotification(`Analyzed ${results.length} precedent citations from brief.`)
    return results
  }

  const handleLinkSuccess = async (caseId, precedent) => {
    const res = await linkPrecedentToCase({ caseId, precedent })
    setNotification(`Linked '${precedent.caseName}' to case '${res.caseTitle}'.`)
    setRefreshKey((k) => k + 1)
  }

  const filteredPrecedents = useMemo(() => {
    const query = searchFilter.trim().toLowerCase()
    if (!query) return precedents
    return precedents.filter(
      (p) =>
        p.caseName?.toLowerCase().includes(query) ||
        p.citation?.toLowerCase().includes(query) ||
        p.court?.toLowerCase().includes(query) ||
        p.ratio?.toLowerCase().includes(query) ||
        p.treatment?.toLowerCase().includes(query),
    )
  }, [precedents, searchFilter])

  return (
    <Box sx={{ width: '100%', maxWidth: 1320, mx: 'auto', pt: { xs: 1, md: 2 }, pb: 6 }}>
      {/* Page Header */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              Judgment Validity Tracking
            </Typography>
            <Chip
              label="CITATOR MODULE"
              size="small"
              sx={{
                bgcolor: '#eef3ed',
                color: '#42634b',
                fontWeight: 700,
                fontSize: '10px',
                height: 22,
              }}
            />
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5, lineHeight: 1.6 }}>
            Indian legal citator to Shepardize case citations, assess bench strength, and track overruled precedents across all your matters.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PostAddOutlinedIcon />}
            onClick={() => setIsBatchOpen(true)}
            sx={{ textTransform: 'none', borderRadius: 1.75 }}
          >
            Batch scan brief
          </Button>
          <IconButton onClick={loadData} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshRoundedIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Metrics Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
          mb: 3,
        }}
      >
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2.25, borderColor: '#e8eae5', bgcolor: 'background.paper' }}
        >
          <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 700, letterSpacing: 0.5 }}>
            TOTAL PRECEDENTS
          </Typography>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
            {stats.total || precedents.length}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '11px', mt: 0.25 }}>
            Indexed citations
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2.25, borderColor: '#c6e3c8', bgcolor: '#f4faf5' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16, color: '#2e6b35' }} />
            <Typography sx={{ color: '#2e6b35', fontSize: '11px', fontWeight: 700, letterSpacing: 0.5 }}>
              GOOD LAW
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#2e6b35', mt: 0.5 }}>
            {stats.goodLaw || 0}
          </Typography>
          <Typography sx={{ color: '#42634b', fontSize: '11px', mt: 0.25 }}>
            Binding authorities
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2.25, borderColor: '#fadbd8', bgcolor: '#fef5f5' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CancelOutlinedIcon sx={{ fontSize: 16, color: '#b3261e' }} />
            <Typography sx={{ color: '#b3261e', fontSize: '11px', fontWeight: 700, letterSpacing: 0.5 }}>
              OVERRULED
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#b3261e', mt: 0.5 }}>
            {stats.overruled || 0}
          </Typography>
          <Typography sx={{ color: '#b3261e', fontSize: '11px', mt: 0.25 }}>
            Do not cite in pleadings
          </Typography>
        </Paper>

        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2.25, borderColor: '#fce3a7', bgcolor: '#fefdf7' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <WarningAmberRoundedIcon sx={{ fontSize: 16, color: '#b06000' }} />
            <Typography sx={{ color: '#b06000', fontSize: '11px', fontWeight: 700, letterSpacing: 0.5 }}>
              DISTINGUISHED / CAUTION
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '24px', fontWeight: 700, color: '#b06000', mt: 0.5 }}>
            {stats.distinguished || 0}
          </Typography>
          <Typography sx={{ color: '#b06000', fontSize: '11px', mt: 0.25 }}>
            Check factual parity
          </Typography>
        </Paper>
      </Box>

      {/* Citator Search and Live Verifier Bar */}
      <CitationSearchVerifyBar
        onVerify={handleVerify}
        isVerifying={isVerifying}
        onOpenBatchDialog={() => setIsBatchOpen(true)}
      />

      {isAnalyzing && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, mb: 3 }}>
          <CircularProgress size={22} sx={{ color: '#2e6b35' }} />
          <Typography sx={{ fontSize: 'body2.fontSize', color: 'text.secondary', fontWeight: 600 }}>
            Analyzing judicial treatment against official Supreme Court e-SCR and indexed reports...
          </Typography>
        </Box>
      )}

      {validityReport && !isAnalyzing && (
        <Box sx={{ position: 'relative', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <Button
              size="small"
              onClick={() => setValidityReport(null)}
              sx={{ textTransform: 'none', fontSize: '11px', color: 'text.secondary' }}
            >
              Close Validity Report
            </Button>
          </Box>
          <JudgmentValidityReportCard
            report={validityReport}
            onLinkCase={(j) =>
              setLinkingPrecedent({
                caseName: j.title,
                citation: j.citation || j.neutral_citation,
                court: j.court,
                year: j.year,
                status: validityReport.overall_status?.toLowerCase(),
                ratio: validityReport.treatments[0]?.legal_proposition || j.title,
                treatment: validityReport.treatments[0]?.reason || '',
              })
            }
          />
        </Box>
      )}

      {/* Just Verified Banner */}
      {recentVerified && (
        <Alert
          severity={recentVerified.status === 'overruled' ? 'error' : 'success'}
          onClose={() => setRecentVerified(null)}
          sx={{ mb: 3 }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            Recent Verification: {recentVerified.caseName} ({recentVerified.citation}) — {recentVerified.status?.toUpperCase().replace('_', ' ')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {recentVerified.treatment}
          </Typography>
        </Alert>
      )}

      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage('')} sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      {/* Filter Tabs and Local Search Bar */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2.5,
          borderRadius: 2.5,
          borderColor: '#e8eae5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Tabs
          value={statusFilter}
          onChange={(_, val) => setStatusFilter(val)}
          sx={{
            minHeight: 38,
            '& .MuiTab-root': {
              minHeight: 38,
              py: 0.5,
              px: 1.5,
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 1.5,
            },
          }}
        >
          <Tab value="all" label={`All (${precedents.length})`} />
          <Tab value="good_law" label="Good Law" />
          <Tab value="overruled" label="Overruled" />
          <Tab value="distinguished" label="Distinguished / Modified" />
        </Tabs>

        <TextField
          size="small"
          placeholder="Filter precedents by name or ratio..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
      </Paper>

      {/* Precedent Cards List */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filteredPrecedents.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            py: 6,
            px: 3,
            textAlign: 'center',
            borderRadius: 2.5,
            borderColor: '#e8eae5',
          }}
        >
          <FactCheckOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 'body1.fontSize', color: 'text.primary' }}>
            No precedents found
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', mt: 0.5 }}>
            Try searching for a landmark case above (e.g., 'Asian Resurfacing', 'BALCO', 'NN Global') or verify a new citation.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredPrecedents.map((precedent) => (
            <PrecedentCard
              key={precedent.id || precedent.citation || precedent.caseName}
              precedent={precedent}
              cases={cases}
              onOpenLinkModal={(p) => setLinkingPrecedent(p)}
            />
          ))}
        </Box>
      )}

      {/* Dialogs */}
      <BatchCitationDialog
        open={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        cases={cases}
        onBatchVerify={handleBatchVerify}
      />

      <LinkCaseModal
        open={Boolean(linkingPrecedent)}
        onClose={() => setLinkingPrecedent(null)}
        precedent={linkingPrecedent}
        cases={cases}
        onLinkSuccess={handleLinkSuccess}
      />

      <Snackbar
        open={Boolean(notification)}
        autoHideDuration={4000}
        onClose={() => setNotification('')}
        message={notification}
      />
    </Box>
  )
}
