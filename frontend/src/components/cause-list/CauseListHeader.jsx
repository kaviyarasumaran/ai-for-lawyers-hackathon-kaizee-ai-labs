import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { getCauseListPdfDownloadUrl } from '../../api/causeList'
import CauseListPipelineBanner from './CauseListPipelineBanner'

function dateCodeToIso(code) {
  if (code && code.length === 8) {
    const d = code.slice(0, 2)
    const m = code.slice(2, 4)
    const y = code.slice(4)
    return `${y}-${m}-${d}`
  }
  return ''
}

export default function CauseListHeader({
  dateCode,
  onDateChange,
  isLoading,
  onRefresh,
  isAiDrawerOpen,
  onToggleAiDrawer,
  pipelineStatus,
  isTriggeringPipeline,
  onTriggerPipeline,
  onPurgePipeline,
  pipelineHistory,
  onRefreshPipelineStatus,
}) {

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: { xs: '1.35rem', sm: '1.625rem' },
                fontWeight: 700,
                color: 'text.primary',
                letterSpacing: '-0.5px',
              }}
            >
              Daily Court Cause List
            </Typography>
            <Chip
              label="Madras High Court"
              size="small"
              sx={{
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.2)' : '#eaf2e9',
                color: 'primary.main',
                fontSize: '0.72rem',
                fontWeight: 600,
                height: 22,
              }}
            />
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.5, lineHeight: 1.6 }}>
            Track daily court boards, benches, item numbers, and listing stages with automated OCR extraction.
          </Typography>
        </Box>

     
      </Box>

      {/* Date Selector Bar */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          p: 1.5,
          mt: 2,
          borderRadius: 2.5,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fdfdfc',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventNoteOutlinedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <TextField
              type="date"
              size="small"
              value={dateCodeToIso(dateCode)}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-')
                  onDateChange(`${d}${m}${y}`)
                }
              }}
              slotProps={{
                input: {
                  sx: {
                    fontSize: '0.8125rem',
                    height: 32,
                    borderRadius: 1.5,
                  },
                },
              }}
            />
          </Box>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ height: 20, my: 'auto', display: { xs: 'none', sm: 'block' } }}
          />

          <CauseListPipelineBanner
            pipelineStatus={pipelineStatus}
            isTriggering={isTriggeringPipeline}
            onTriggerPipeline={onTriggerPipeline}
            onPurgePipeline={onPurgePipeline}
            pipelineHistory={pipelineHistory}
            onRefreshStatus={onRefreshPipelineStatus}
          />
        </Box>
           <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Button
            variant={isAiDrawerOpen ? 'contained' : 'outlined'}
            color="primary"
            startIcon={<AutoAwesomeOutlinedIcon />}
            onClick={onToggleAiDrawer}
            sx={{
              minHeight: 38,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            AI Cause List Agent
          </Button>

          <Button
            component="a"
            href={getCauseListPdfDownloadUrl(dateCode)}
            target="_blank"
            rel="noreferrer"
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            sx={{
              minHeight: 38,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.primary',
            }}
          >
            Download PDF
          </Button>

          <Tooltip title="Refresh cause list">
            <IconButton
              onClick={onRefresh}
              disabled={isLoading}
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Box>
  )
}
