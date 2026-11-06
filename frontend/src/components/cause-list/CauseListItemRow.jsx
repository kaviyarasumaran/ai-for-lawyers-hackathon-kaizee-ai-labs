import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'

export default function CauseListItemRow({ item, isHighlighted = false }) {
  const [copiedCase, setCopiedCase] = useState(false)
  const [copiedListing, setCopiedListing] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  const handleCopyCase = async () => {
    try {
      await navigator.clipboard.writeText(item.caseNumber)
      setCopiedCase(true)
      setTimeout(() => setCopiedCase(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleCopyListing = async () => {
    const text = `${item.courtNumber} | Item No. ${item.itemNumber} | ${item.caseNumber}\n${item.parties}\nCounsel: ${item.counsels}\nStage: ${item.category} (${item.session})`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedListing(true)
      setTimeout(() => setCopiedListing(false), 2000)
    } catch {
      // ignore
    }
  }

  const getCategoryColor = (cat = '') => {
    const lower = cat.toLowerCase()
    if (lower.includes('motion') || lower.includes('admission')) return 'success'
    if (lower.includes('order')) return 'secondary'
    if (lower.includes('final')) return 'error'
    if (lower.includes('special')) return 'warning'
    return 'default'
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: isHighlighted
          ? (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.15)' : '#f2f8f3'
          : 'background.paper',
        borderColor: isHighlighted
          ? 'primary.main'
          : 'divider',
        transition: 'all 140ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`Item ${item.itemNumber}`}
            size="small"
            color="primary"
            sx={{ fontWeight: 700, fontSize: '0.75rem', height: 24 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <GavelOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' }}>
              {item.courtNumber}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}>
              — {item.judge}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Chip
            label={item.category}
            size="small"
            color={getCategoryColor(item.category)}
            variant="outlined"
            sx={{ fontSize: '0.72rem', height: 22 }}
          />
          <Chip
            label={item.session}
            size="small"
            sx={{
              fontSize: '0.72rem',
              height: 22,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#f4f6f4',
            }}
          />
        </Box>
      </Box>

      {/* Case Number & Copy */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: 'primary.main',
          }}
        >
          {item.caseNumber}
        </Typography>
        <Tooltip title={copiedCase ? 'Copied case number' : 'Copy case number'}>
          <IconButton size="small" onClick={handleCopyCase} sx={{ p: 0.25 }}>
            {copiedCase ? <CheckRoundedIcon sx={{ fontSize: 15, color: 'success.main' }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
        {item.status && (
          <Chip
            label={item.status}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: '0.68rem', ml: 0.5 }}
          />
        )}
      </Box>

      {/* Parties */}
      <Typography sx={{ fontSize: '0.875rem', color: 'text.primary', mb: 0.75, lineHeight: 1.5 }}>
        {item.parties}
      </Typography>

      {/* Counsels */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
          <strong>Counsel:</strong> {item.counsels}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            size="small"
            startIcon={isPinned ? <CheckRoundedIcon /> : <PushPinOutlinedIcon />}
            onClick={() => setIsPinned(!isPinned)}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              py: 0.25,
              color: isPinned ? 'primary.main' : 'text.secondary',
            }}
          >
            {isPinned ? 'Pinned to Matter' : 'Track Listing'}
          </Button>

          <Button
            size="small"
            startIcon={copiedListing ? <CheckRoundedIcon /> : <ContentCopyOutlinedIcon />}
            onClick={handleCopyListing}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              py: 0.25,
              color: 'text.secondary',
            }}
          >
            {copiedListing ? 'Copied' : 'Copy Details'}
          </Button>
        </Box>
      </Box>

      {item.notes && (
        <Box sx={{ mt: 1, p: 1, borderRadius: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fbfdfb', border: '1px solid', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            ℹ️ {item.notes}
          </Typography>
        </Box>
      )}
    </Paper>
  )
}
