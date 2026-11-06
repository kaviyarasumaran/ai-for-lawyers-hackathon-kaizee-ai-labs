import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { fetchPipelineHistory } from '../../api/causeList'

export default function CauseListPipelineBanner({
  pipelineStatus,
  isTriggering,
  onTriggerPipeline,
  onPurgePipeline,
  pipelineHistory = [],
  onRefreshStatus,
}) {
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState(pipelineHistory)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  const handleOpenLogs = async () => {
    setLogsOpen(true)
    setIsLoadingLogs(true)
    try {
      const data = await fetchPipelineHistory(15)
      if (Array.isArray(data)) setLogs(data)
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const lastRun = pipelineStatus?.lastRun
  const nextRunAt = pipelineStatus?.nextRunAt
  const nextPurgeAt = pipelineStatus?.nextPurgeAt
  const scheduleRule = pipelineStatus?.targetSchedule || 'Daily at 01:00 AM IST'

  const formatIsoTime = (isoString) => {
    if (!isoString) return '—'
    try {
      const dt = new Date(isoString)
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return isoString
    }
  }

  const formatIsoDate = (isoString) => {
    if (!isoString) return '—'
    try {
      const dt = new Date(isoString)
      return dt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return isoString
    }
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: 'success.main',
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
            Daily Board: Auto-syncs at 1:00 AM · Cleared at 11:55 PM (Today&apos;s board only)
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            variant="text"
            color="primary"
            startIcon={
              isTriggering ? (
                <CircularProgress size={13} color="inherit" />
              ) : (
                <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />
              )
            }
            onClick={onTriggerPipeline}
            disabled={isTriggering}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 500,
              minHeight: 28,
              px: 1,
            }}
          >
            {isTriggering ? 'Syncing...' : 'Sync Now'}
          </Button>

          <Button
            size="small"
            variant="text"
            startIcon={<HistoryRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={handleOpenLogs}
            sx={{
              textTransform: 'none',
              fontSize: '0.8125rem',
              color: 'text.secondary',
              minHeight: 28,
              px: 1,
            }}
          >
            Logs
          </Button>
        </Box>
      </Box>

      {/* Pipeline Logs Dialog */}
      <Dialog
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryRoundedIcon color="success" />
            <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 600 }}>
              Cause List Pipeline Execution History
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => {
                onRefreshStatus?.()
                handleOpenLogs()
              }}
              title="Refresh Logs"
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setLogsOpen(false)}>
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, bgcolor: 'background.default', p: 1.5, borderRadius: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Daily Sync Schedule</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{scheduleRule}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Daily Auto-Purge</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'warning.main' }}>
                {nextPurgeAt ? `${formatIsoDate(nextPurgeAt)} at ${formatIsoTime(nextPurgeAt)}` : '11:55 PM IST'}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Last Sync Board</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {lastRun?.displayDate ? `${lastRun.displayDate} (${lastRun.itemsCount || 0} cases)` : 'None'}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Next Scheduled Run</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {nextRunAt ? `${formatIsoDate(nextRunAt)} at ${formatIsoTime(nextRunAt)}` : '01:00 AM IST'}
              </Typography>
            </Box>
          </Box>

          {isLoadingLogs ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1 }}>
              <CircularProgress size={20} color="primary" />
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Loading pipeline execution logs...</Typography>
            </Box>
          ) : logs.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No pipeline executions recorded yet. Click <strong>"Run Pipeline Now"</strong> to trigger the initial OCR sync.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f8faf9') }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Timestamp</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Trigger Type</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Board Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Cases Extracted</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((run) => (
                    <TableRow key={run.id} hover>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {formatIsoDate(run.triggeredAt)} {formatIsoTime(run.triggeredAt)}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        <Chip
                          label={run.triggerType || 'SCHEDULED'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        {run.displayDate || run.dateCode}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        <strong>{run.itemsCount || 0} cases</strong> ({run.courtsCount || 0} courts)
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {run.durationMs} ms
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {run.status === 'SUCCESS' ? (
                          <Chip
                            icon={<CheckCircleOutlineRoundedIcon sx={{ fontSize: '13px !important' }} />}
                            label="Success"
                            color="success"
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                          />
                        ) : (
                          <Chip
                            icon={<ErrorOutlineRoundedIcon sx={{ fontSize: '13px !important' }} />}
                            label="Failed"
                            color="error"
                            size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600 }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            color="error"
            onClick={async () => {
              await onPurgePipeline?.()
              setLogsOpen(false)
            }}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Purge Case Lists Now (11:55 PM Rule)
          </Button>
          <Button onClick={() => setLogsOpen(false)} sx={{ textTransform: 'none', borderRadius: 2 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
