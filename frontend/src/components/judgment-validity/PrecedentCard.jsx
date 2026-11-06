import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import { Link } from '@tanstack/react-router'

const STATUS_CONFIG = {
  good_law: {
    label: 'GOOD LAW',
    icon: CheckCircleOutlineRoundedIcon,
    bgcolor: '#eaf4eb',
    color: '#2e6b35',
    borderColor: '#c6e3c8',
    description: 'Current binding precedent; no conflicting larger bench ruling detected.',
  },
  overruled: {
    label: 'OVERRULED',
    icon: CancelOutlinedIcon,
    bgcolor: '#fdeeed',
    color: '#b3261e',
    borderColor: '#f9c5c2',
    description: 'Expressly or impliedly overruled by a larger bench decision.',
  },
  distinguished: {
    label: 'DISTINGUISHED / MODIFIED',
    icon: WarningAmberRoundedIcon,
    bgcolor: '#fef7e7',
    color: '#b06000',
    borderColor: '#fce3a7',
    description: 'Subsequent judgments distinguished on facts or modified part of the ratio.',
  },
  caution: {
    label: 'JUDICIAL CAUTION',
    icon: ErrorOutlineRoundedIcon,
    bgcolor: '#fff4e5',
    color: '#c25e00',
    borderColor: '#fedbb0',
    description: 'Under active reconsideration or subject to conflicting coordinate bench views.',
  },
}

export default function PrecedentCard({
  precedent,
  cases = [],
  onOpenLinkModal,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const statusKey = precedent.status?.toLowerCase() || 'good_law'
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.good_law
  const StatusIcon = config.icon

  const linkedCaseIds = precedent.linkedCaseIds || []
  const linkedCases = cases.filter((c) => linkedCaseIds.includes(c.id))

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 2.5,
        borderColor: statusKey === 'overruled' ? '#fadbd8' : '#e8eae5',
        bgcolor: 'background.paper',
        transition: 'all 0.15s ease',
        '&:hover': {
          borderColor: statusKey === 'overruled' ? '#f5b7b1' : '#c8d4c9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
            <Typography sx={{ color: 'text.primary', fontSize: '15px', fontWeight: 700 }}>
              {precedent.caseName}
            </Typography>
            <Chip
              label={precedent.citation}
              size="small"
              sx={{
                height: 22,
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 600,
                bgcolor: '#f0f3f0',
                color: '#344537',
              }}
            />
          </Box>

          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', mb: 1 }}>
            {precedent.court} • {precedent.year}
          </Typography>
        </Box>

        {/* Status Badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<StatusIcon sx={{ fontSize: '15px !important', color: `${config.color} !important` }} />}
            label={config.label}
            size="small"
            sx={{
              height: 26,
              px: 0.5,
              fontWeight: 700,
              fontSize: '11px',
              bgcolor: config.bgcolor,
              color: config.color,
              border: `1px solid ${config.borderColor}`,
            }}
          />
          {onOpenLinkModal && (
            <Tooltip title="Link this precedent to a case matter">
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddLinkRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => onOpenLinkModal(precedent)}
                sx={{
                  minHeight: 28,
                  px: 1,
                  textTransform: 'none',
                  fontSize: 'caption.fontSize',
                  borderRadius: 1.5,
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              >
                Link case
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Judicial Treatment Banner */}
      <Box
        sx={{
          mt: 1.25,
          p: 1.25,
          borderRadius: 2,
          bgcolor: config.bgcolor,
          border: `1px solid ${config.borderColor}`,
        }}
      >
        <Typography sx={{ color: config.color, fontSize: '12px', fontWeight: 600, lineHeight: 1.5 }}>
          {precedent.treatment || config.description}
        </Typography>
      </Box>

      {/* Linked Cases in workspace */}
      {linkedCases.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 600 }}>
            Cited in workspace cases:
          </Typography>
          {linkedCases.map((c) => (
            <Chip
              key={c.id}
              icon={<FolderOutlinedIcon sx={{ fontSize: '13px !important' }} />}
              label={c.title}
              size="small"
              component={Link}
              to="/cases/$caseId"
              params={{ caseId: c.id }}
              clickable
              sx={{
                height: 22,
                fontSize: '11px',
                bgcolor: 'background.default',
                borderColor: 'divider',
                border: '1px solid',
                textDecoration: 'none',
                '&:hover': { bgcolor: '#eef3ed', borderColor: '#bed4bf' },
              }}
            />
          ))}
        </Box>
      )}

      {/* Expand/Collapse Toggle for Ratio & Detailed Analysis */}
      <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          size="small"
          onClick={() => setIsExpanded((prev) => !prev)}
          endIcon={isExpanded ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
          sx={{
            p: 0,
            color: 'primary.main',
            fontSize: 'caption.fontSize',
            fontWeight: 600,
            textTransform: 'none',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          {isExpanded ? 'Hide Ratio & Subsequent Rulings' : 'View Ratio & Subsequent Rulings'}
        </Button>
      </Box>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Divider sx={{ my: 1.5, borderColor: '#f0f2ef' }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {precedent.ratio && (
            <Box>
              <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Ratio Decidendi / Rule of Law
              </Typography>
              <Typography sx={{ color: 'text.primary', fontSize: '12px', lineHeight: 1.6, mt: 0.25 }}>
                {precedent.ratio}
              </Typography>
            </Box>
          )}

          {precedent.analysis && (
            <Box>
              <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Bench Strength & Judicial Analysis
              </Typography>
              <Typography sx={{ color: 'text.primary', fontSize: '12px', lineHeight: 1.6, mt: 0.25 }}>
                {precedent.analysis}
              </Typography>
            </Box>
          )}

          {precedent.subsequentCitations && precedent.subsequentCitations.length > 0 && (
            <Box>
              <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Subsequent Treatment Judgments
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {precedent.subsequentCitations.map((subCit) => (
                  <Typography key={subCit} sx={{ color: 'text.primary', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    {subCit}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}
