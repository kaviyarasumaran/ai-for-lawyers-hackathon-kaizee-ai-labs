import { Box, Chip, LinearProgress, Typography } from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'

export default function DocumentStatusChip({ status, progress, error }) {
  const statusLabels = {
    queued: 'Queued',
    processing: 'Processing',
    extracting: 'Extracting / OCR',
    chunking: 'Chunking & Embedding',
    embedding: 'Chunking & Embedding',
    ready: 'Ready',
    completed: 'Ready',
    stored: 'Indexed',
    error: 'Failed',
    failed: 'Failed',
  }
  const statusColors = {
    queued: 'default',
    processing: 'info',
    extracting: 'info',
    chunking: 'warning',
    embedding: 'warning',
    ready: 'success',
    completed: 'success',
    stored: 'success',
    error: 'error',
    failed: 'error',
  }

  const isComplete = ['ready', 'completed', 'stored'].includes(status)
  const isFailed = ['error', 'failed'].includes(status)
  const isRunning = ['queued', 'processing', 'extracting', 'chunking', 'embedding'].includes(status)

  const progressPercent = typeof progress === 'number' ? Math.round(progress) : 0
  const displayLabel = statusLabels[status] || (status ? status.toUpperCase() : 'Processing')
  const chipLabel = isRunning && progressPercent > 0 ? `${displayLabel} (${progressPercent}%)` : displayLabel

  return (
    <Box sx={{ minWidth: 120 }}>
      <Chip
        icon={isComplete ? <CheckCircleOutlineRoundedIcon /> : undefined}
        label={chipLabel}
        size="small"
        color={statusColors[status] || 'default'}
        variant={isComplete ? 'outlined' : 'filled'}
        sx={{
          height: 25,
          fontSize: 'caption.fontSize',
          fontWeight: 600,
          '& .MuiChip-icon': { fontSize: 14 },
        }}
      />
      {isRunning && (
        <LinearProgress
          aria-label={`${displayLabel} progress`}
          variant={progressPercent > 0 ? 'determinate' : 'indeterminate'}
          value={progressPercent}
          sx={{ mt: 0.75, height: 4, borderRadius: 5 }}
        />
      )}
      {isFailed && error && (
        <Typography
          title={error}
          noWrap
          sx={{ mt: 0.5, maxWidth: 140, color: 'error.main', fontSize: 'caption.fontSize' }}
        >
          {error}
        </Typography>
      )}
    </Box>
  )
}
