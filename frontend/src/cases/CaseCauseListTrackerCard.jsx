import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import { useNavigate } from '@tanstack/react-router'
import { matchCaseCauseList, recordCaseHearing } from '../api/cases'
import { useCases } from '../hooks'
import CaseHearingFeedbackForm from './CaseHearingFeedbackForm'
import CaseHearingHistoryList from './CaseHearingHistoryList'

function CaseCauseListTrackerCard({ caseItem, onCaseUpdated }) {
  const navigate = useNavigate()
  const { setCaseCauseList, refreshCases } = useCases()

  const initialCaseNum = useMemo(() => {
    if (caseItem?.causeList?.caseNumber) return caseItem.causeList.caseNumber
    if (caseItem?.title && /^(?:WP|WA|CONTP|CRL|OS|AS|SA|CRP|CMP)\b/i.test(caseItem.title)) {
      return caseItem.title
    }
    return ''
  }, [caseItem?.causeList?.caseNumber, caseItem?.title])

  const [caseNumber, setCaseNumber] = useState(initialCaseNum)
  const [isEditingNum, setIsEditingNum] = useState(!initialCaseNum)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncError, setSyncError] = useState('')

  // Form & History State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')

  // Sync state if initial case number changes from parent
  useEffect(() => {
    if (initialCaseNum && !caseNumber) {
      setCaseNumber(initialCaseNum)
      setIsEditingNum(false)
    }
  }, [initialCaseNum, caseNumber])

  // Active cause list resolution prioritizing syncResult
  const activeCauseList = useMemo(() => {
    const fromCase = caseItem?.causeList ?? {}
    if (syncResult?.causeList) {
      return { ...fromCase, ...syncResult.causeList }
    }
    return fromCase
  }, [caseItem?.causeList, syncResult])

  const activeItem = syncResult?.item || {}
  const isListed = syncResult !== null
    ? Boolean(syncResult.isListed)
    : Boolean(activeCauseList.isListed)

  const courtNumber = activeCauseList.courtNumber || activeItem.courtNumber || ''
  const itemNumber = activeCauseList.itemNumber || (activeItem.itemNumber != null ? String(activeItem.itemNumber) : '')
  const judge = activeCauseList.judge || activeItem.judge || ''
  const stage = activeCauseList.stage || activeItem.category || ''
  const session = activeCauseList.session || activeItem.session || ''
  const listingDate = activeCauseList.listingDate || activeItem.date || syncResult?.listingDate || ''
  const alertText = activeCauseList.alert || syncResult?.causeList?.alert || ''
  const hearings = activeCauseList.hearings || []

  // Auto-trigger match on mount if not matched yet and caseNumber is present
  useEffect(() => {
    if (!caseItem?.id || activeCauseList.isListed !== undefined || !initialCaseNum) return
    handleMatchCauseList(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseItem?.id, initialCaseNum])

  async function handleMatchCauseList(isManual = true) {
    if (!caseItem?.id) return
    const targetNum = caseNumber.trim()
    if (!targetNum) {
      setSyncError('Please enter a case number to match against the cause list.')
      return
    }
    setIsSyncing(true)
    setSyncError('')
    if (isManual) setSyncResult(null)
    try {
      const res = await matchCaseCauseList(caseItem.id, targetNum, caseItem.parties)
      setSyncResult(res)
      if (setCaseCauseList && res.causeList) {
        setCaseCauseList(caseItem.id, res.causeList)
      }
      if (res.isListed && res.causeList) {
        const notif = {
          id: `cl-match-${caseItem.id}-${Date.now()}`,
          title: `Court Listing: ${caseItem.title}`,
          description: `Case ${res.causeList.caseNumber || caseItem.title} is listed as Item #${res.causeList.itemNumber} in ${res.causeList.courtNumber} before ${res.causeList.judge} on ${res.causeList.listingDate}.`,
          time: 'Just now',
          status: 'Listed',
          caseId: caseItem.id,
        }
        try {
          const existing = JSON.parse(localStorage.getItem('kaizee_listing_notifications') || '[]')
          localStorage.setItem('kaizee_listing_notifications', JSON.stringify([notif, ...existing.slice(0, 19)]))
          window.dispatchEvent(new CustomEvent('kaizee-notification', { detail: notif }))
        } catch {
          // ignore localStorage issues
        }
      }
      setIsEditingNum(false)
      if (onCaseUpdated) onCaseUpdated()
    } catch (err) {
      setSyncError(err.message || 'Failed to match case against Daily Court Cause List.')
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleSaveHearing(formData) {
    setIsSubmitting(true)
    setSubmitError('')
    setSubmitSuccess('')
    try {
      const res = await recordCaseHearing(caseItem.id, formData)
      if (setCaseCauseList && res.causeList) {
        setCaseCauseList(caseItem.id, res.causeList)
      }
      setSubmitSuccess('Hearing notes saved and successfully ingested into Case AI Knowledge Base!')
      setIsFormOpen(false)
      if (refreshCases) refreshCases()
      if (onCaseUpdated) onCaseUpdated()
    } catch (err) {
      setSubmitError(err.message || 'Could not record hearing.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: isListed ? '#b7d5be' : '#e8eae5',
        borderRadius: 2.5,
        boxShadow: 'none',
        bgcolor: isListed ? '#fbfdfb' : 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'grid',
              width: 32,
              height: 32,
              placeItems: 'center',
              borderRadius: 1.5,
              color: isListed ? '#2e6b3b' : '#647267',
              bgcolor: isListed ? '#e8f3e9' : '#f0f2ee',
            }}
          >
            <EventAvailableOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 'body2.fontSize', fontWeight: 700, color: 'text.primary' }}>
              Daily Court Cause List
            </Typography>
            <Typography sx={{ fontSize: 'caption.fontSize', color: 'text.secondary' }}>
              Madras High Court board tracking & hearing history
            </Typography>
          </Box>
        </Box>

        <Tooltip title="Check Today's Board">
          <span>
            <IconButton
              size="small"
              onClick={() => handleMatchCauseList(true)}
              disabled={isSyncing}
              sx={{ color: '#4e7957' }}
            >
              {isSyncing ? <CircularProgress size={18} /> : <SyncRoundedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Case Number Input / Search Bar */}
      <Box sx={{ mb: 1.5 }}>
        {isEditingNum || !caseNumber ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleMatchCauseList(true)
                }
              }}
              placeholder="Enter case number (e.g. WP/43747/2026)"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 18, color: '#88928a' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& input': { py: 0.75, fontSize: 'body2.fontSize' },
                '& .MuiOutlinedInput-root': { borderRadius: 1.75 },
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => handleMatchCauseList(true)}
              disabled={isSyncing || !caseNumber.trim()}
              sx={{
                whiteSpace: 'nowrap',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 'caption.fontSize',
                py: 0.85,
                px: 1.75,
                borderRadius: 1.75,
                bgcolor: '#34663e',
                '&:hover': { bgcolor: '#2a5232' },
              }}
            >
              {isSyncing ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : 'Search Board'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 'body2.fontSize', fontWeight: 600, color: '#333e35' }}>
                Case No: <strong>{caseNumber}</strong>
              </Typography>
              <Tooltip title="Edit Case Number">
                <IconButton size="small" onClick={() => setIsEditingNum(true)} sx={{ p: 0.5, color: '#68736a' }}>
                  <EditOutlinedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>

            <Chip
              icon={isListed ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '14px !important' }} /> : <InfoOutlinedIcon sx={{ fontSize: '14px !important' }} />}
              label={isListed ? 'Listed on Today’s Board' : 'Unlisted on Today’s Board'}
              size="small"
              sx={{
                height: 24,
                fontSize: 'caption.fontSize',
                fontWeight: 600,
                color: isListed ? '#266133' : '#6f7871',
                bgcolor: isListed ? '#e3f2e4' : '#f0f2ee',
              }}
            />
          </Box>
        )}
      </Box>

      {syncError && <Alert severity="error" sx={{ mb: 1.5, fontSize: 'caption.fontSize' }}>{syncError}</Alert>}
      {submitSuccess && <Alert severity="success" sx={{ mb: 1.5, fontSize: 'caption.fontSize' }}>{submitSuccess}</Alert>}

      {/* Listed Details Box */}
      {isListed && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: 2,
            bgcolor: '#f2f8f2',
            border: '1px solid #d4e7d6',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={courtNumber || 'Court Hall'}
                size="small"
                sx={{ fontWeight: 700, bgcolor: '#ffffff', color: '#2e6b3b', border: '1px solid #c8decb' }}
              />
              <Typography sx={{ fontSize: 'body2.fontSize', fontWeight: 700, color: '#266133' }}>
                Item No. {itemNumber || '-'}
              </Typography>
            </Box>
            <Button
              size="small"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
              onClick={() => navigate({ to: '/cause-list' })}
              sx={{ fontSize: 'caption.fontSize', textTransform: 'none', py: 0.25, color: '#2e6b3b', fontWeight: 600 }}
            >
              View Board
            </Button>
          </Box>

          <Typography sx={{ fontSize: 'caption.fontSize', color: '#3b473d' }}>
            <strong>Coram:</strong> {judge || 'Hon’ble Presiding Judge'}
          </Typography>
          <Typography sx={{ fontSize: 'caption.fontSize', color: '#3b473d' }}>
            <strong>Stage & Session:</strong> {stage || 'Regular List'} {session ? `(${session})` : ''}
          </Typography>
          {listingDate && (
            <Typography sx={{ fontSize: 'caption.fontSize', color: '#5f6c61' }}>
              <strong>Listed Date:</strong> {listingDate}
            </Typography>
          )}
        </Box>
      )}

      {/* Unlisted Explanation Box */}
      {!isListed && (syncResult !== null || activeCauseList.alert) && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: 2,
            bgcolor: '#f7f8f6',
            border: '1px solid #e2e5e0',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <InfoOutlinedIcon sx={{ fontSize: 16, color: '#7a857c' }} />
            <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 600, color: '#4a534c' }}>
              {alertText || `Not listed on official cause list (${listingDate || 'today'}).`}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '11px', color: '#7e8780', pl: 3 }}>
            Searched against the active Madras High Court daily publication. Tap &ldquo;Check Today&rsquo;s Board&rdquo; anytime to re-verify.
          </Typography>
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AutoAwesomeOutlinedIcon />}
          onClick={() => setIsFormOpen((prev) => !prev)}
          sx={{
            flex: 1,
            textTransform: 'none',
            fontSize: 'caption.fontSize',
            fontWeight: 600,
            borderColor: '#cfe2d2',
            color: '#34663e',
            '&:hover': { bgcolor: '#f4f8f4', borderColor: '#b2d5b8' },
          }}
        >
          {isFormOpen ? 'Close Feedback' : 'Log Hearing Feedback'}
        </Button>

        {hearings.length > 0 && (
          <Button
            size="small"
            startIcon={<HistoryOutlinedIcon />}
            endIcon={isHistoryOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            sx={{ textTransform: 'none', fontSize: 'caption.fontSize', color: '#647267' }}
          >
            History ({hearings.length})
          </Button>
        )}
      </Box>

      {/* Hearing Feedback Form */}
      <Collapse in={isFormOpen}>
        <CaseHearingFeedbackForm
          defaultDate={listingDate}
          defaultStage={stage}
          courtNumber={courtNumber}
          judge={judge}
          onSubmitHearing={handleSaveHearing}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </Collapse>

      {/* Hearing Records History */}
      <Collapse in={isHistoryOpen && hearings.length > 0}>
        <CaseHearingHistoryList hearings={hearings} />
      </Collapse>
    </Paper>
  )
}

export default CaseCauseListTrackerCard
