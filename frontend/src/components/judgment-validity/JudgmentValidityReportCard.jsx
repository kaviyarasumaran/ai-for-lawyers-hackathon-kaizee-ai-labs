import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'

const STATUS_CONFIGS = {
  OVERRULED: {
    label: 'OVERRULED',
    color: '#b3261e',
    bgcolor: '#fdeeed',
    borderColor: '#f9c5c2',
    icon: CancelOutlinedIcon,
    summary: 'Precedent has been expressly or substantially overruled by a subsequent larger or coordinate bench.',
  },
  REVERSED: {
    label: 'REVERSED',
    color: '#b3261e',
    bgcolor: '#fdeeed',
    borderColor: '#f9c5c2',
    icon: CancelOutlinedIcon,
    summary: 'The specific decision of the lower court was reversed on appellate review.',
  },
  DOUBTED: {
    label: 'DOUBTED / CONFLICTING',
    color: '#b06000',
    bgcolor: '#fef7e7',
    borderColor: '#fce3a7',
    icon: WarningAmberRoundedIcon,
    summary: 'Subsequent judgments have doubted this ruling, noted conflicting views, or referred it to a larger bench.',
  },
  DISTINGUISHED: {
    label: 'DISTINGUISHED / MODIFIED',
    color: '#b06000',
    bgcolor: '#fef7e7',
    borderColor: '#fce3a7',
    icon: WarningAmberRoundedIcon,
    summary: 'Subsequent courts distinguished this judgment on factual or statutory grounds, limiting its ratio.',
  },
  MODIFIED: {
    label: 'MODIFIED',
    color: '#b06000',
    bgcolor: '#fef7e7',
    borderColor: '#fce3a7',
    icon: WarningAmberRoundedIcon,
    summary: 'Directions or operative scope were modified by a higher court without altering core legal principles.',
  },
  FOLLOWED: {
    label: 'FOLLOWED / NO ADVERSE TREATMENT FOUND',
    color: '#2e6b35',
    bgcolor: '#eaf4eb',
    borderColor: '#c6e3c8',
    icon: CheckCircleOutlineRoundedIcon,
    summary: 'Adopted and applied by subsequent courts; no adverse treatment identified in searched records.',
    disclaimer: 'Notice: Indicates no adverse treatment was found in indexed public records up to the checked date. Never taken as absolute proof of current validity.',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'INSUFFICIENT EVIDENCE',
    color: '#5f6861',
    bgcolor: '#f0f2ef',
    borderColor: '#dcdfd9',
    icon: HelpOutlineRoundedIcon,
    summary: 'Insufficient citing records located in official repositories to definitively assess subsequent treatment.',
  },
}

export default function JudgmentValidityReportCard({
  report,
  onLinkCase,
}) {
  const [copied, setCopied] = useState(false)
  const [expandedTreatments, setExpandedTreatments] = useState({})

  if (!report || !report.judgment) return null

  const { judgment, overall_status, treatments = [], limitations = [], last_checked } = report
  const statusConfig = STATUS_CONFIGS[overall_status] || STATUS_CONFIGS.INSUFFICIENT_EVIDENCE
  const StatusIcon = statusConfig.icon

  const toggleExpand = (idx) => {
    setExpandedTreatments((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const handleCopySummary = () => {
    const lines = [
      `JUDGMENT VALIDITY REPORT: ${judgment.title}`,
      `Court: ${judgment.court} | Year: ${judgment.year || 'N/A'} | Citation: ${judgment.citation || judgment.neutral_citation || 'N/A'}`,
      `Overall Status: ${overall_status} (${statusConfig.label})`,
      `Last Verified: ${last_checked || new Date().toISOString()}`,
      `Subsequent Treatments (${treatments.length}):`,
      ...treatments.map((t) => ` - [${t.type}] ${t.later_judgment} (${t.year}): ${t.reason || t.legal_proposition}`),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 3,
        borderRadius: 2.5,
        borderColor: statusConfig.borderColor,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography sx={{ color: 'text.primary', fontSize: '17px', fontWeight: 700 }}>
              {judgment.title}
            </Typography>
            {judgment.citation && (
              <Chip
                label={judgment.citation}
                size="small"
                sx={{ height: 22, fontFamily: 'monospace', fontWeight: 600, bgcolor: '#f0f3f0' }}
              />
            )}
            {judgment.neutral_citation && (
              <Chip
                label={judgment.neutral_citation}
                size="small"
                sx={{ height: 22, fontWeight: 700, bgcolor: '#e8f0fe', color: '#1a73e8' }}
              />
            )}
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            {judgment.court} • {judgment.year || 'Year N/A'} • Bench Strength: {judgment.bench_strength || 2} Judges
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {judgment.source_url && (
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '13px !important' }} />}
              href={judgment.source_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', borderRadius: 1.75, fontSize: 'caption.fontSize' }}
            >
              Official e-SCR / Source
            </Button>
          )}
          <Tooltip title={copied ? 'Copied!' : 'Copy Validity Report'}>
            <IconButton size="small" onClick={handleCopySummary} sx={{ border: '1px solid #e0e4dd' }}>
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onLinkCase && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddLinkRoundedIcon />}
              onClick={() => onLinkCase(judgment)}
              sx={{ textTransform: 'none', borderRadius: 1.75, fontSize: 'caption.fontSize' }}
            >
              Link to Case
            </Button>
          )}
        </Box>
      </Box>

      {/* Overall Status Banner */}
      <Box
        sx={{
          p: 1.75,
          mb: 2.5,
          borderRadius: 2,
          bgcolor: statusConfig.bgcolor,
          border: `1px solid ${statusConfig.borderColor}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <StatusIcon sx={{ color: statusConfig.color, mt: 0.25, fontSize: 24 }} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ color: statusConfig.color, fontWeight: 800, fontSize: '14px', letterSpacing: 0.5 }}>
              {statusConfig.label}
            </Typography>
            <Chip
              label={`Verified: ${last_checked ? last_checked.slice(0, 10) : 'Recent'}`}
              size="small"
              sx={{ height: 20, fontSize: '10px', bgcolor: 'rgba(255,255,255,0.7)', fontWeight: 600 }}
            />
          </Box>
          <Typography sx={{ color: '#2d332f', fontSize: 'body2.fontSize', mt: 0.5, fontWeight: 500 }}>
            {statusConfig.summary}
          </Typography>
          {statusConfig.disclaimer && (
            <Typography sx={{ color: '#556157', fontSize: '11px', mt: 0.75, fontStyle: 'italic' }}>
              ⚠️ {statusConfig.disclaimer}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Subsequent Treatments Section */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: 'body2.fontSize', fontWeight: 700, color: 'text.primary' }}>
            Subsequent Judicial Treatments ({treatments.length})
          </Typography>
          <Typography sx={{ fontSize: 'caption.fontSize', color: 'text.secondary' }}>
            Chronological citing judgments & paragraph references
          </Typography>
        </Box>

        {treatments.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2, fontSize: 'caption.fontSize' }}>
            No subsequent citing decisions found in indexed Supreme Court e-SCR and public repositories.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {treatments.map((item, idx) => {
              const itemConfig = STATUS_CONFIGS[item.type] || STATUS_CONFIGS.INSUFFICIENT_EVIDENCE
              const isExpanded = Boolean(expandedTreatments[idx])

              return (
                <Box
                  key={`${item.later_judgment}-${idx}`}
                  sx={{
                    p: 1.75,
                    borderRadius: 2,
                    border: '1px solid #e5e9e3',
                    bgcolor: '#fafbf9',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 240 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Chip
                          label={item.type}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '11px',
                            color: itemConfig.color,
                            bgcolor: itemConfig.bgcolor,
                            border: `1px solid ${itemConfig.borderColor}`,
                          }}
                        />
                        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: 'text.primary' }}>
                          {item.later_judgment}
                        </Typography>
                        {item.year && (
                          <Chip label={item.year} size="small" sx={{ height: 20, fontSize: '11px' }} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 'caption.fontSize', color: 'text.secondary' }}>
                        {item.court} • Bench: {item.bench_strength} Judges
                        {item.bench_strength && judgment.bench_strength && (
                          <strong> (vs {judgment.bench_strength}-Judge earlier bench)</strong>
                        )}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        icon={<VerifiedUserOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                        label={item.verification_status === 'VERIFIED' ? 'Verified Source' : 'Review Required'}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '10px',
                          fontWeight: 600,
                          bgcolor: item.verification_status === 'VERIFIED' ? '#eaf4eb' : '#fff4e5',
                          color: item.verification_status === 'VERIFIED' ? '#2e6b35' : '#b06000',
                        }}
                      />
                      <IconButton size="small" onClick={() => toggleExpand(idx)}>
                        {isExpanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Legal Proposition & Rationale */}
                  <Typography sx={{ fontSize: 'caption.fontSize', color: '#2d332f', mt: 1 }}>
                    <strong>Legal Proposition:</strong> {item.legal_proposition}
                  </Typography>
                  {item.reason && (
                    <Typography sx={{ fontSize: 'caption.fontSize', color: '#4a544c', mt: 0.5 }}>
                      <strong>Judicial Reason:</strong> {item.reason}
                    </Typography>
                  )}

                  {/* Supporting Paragraphs & Excerpt (Collapsible) */}
                  <Collapse in={isExpanded || item.type === 'OVERRULED'}>
                    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: '#ffffff', border: '1px solid #e0e4dd' }}>
                      {item.supporting_paragraphs?.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                          <GavelRoundedIcon sx={{ fontSize: 15, color: '#556858' }} />
                          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#38483b' }}>
                            Paragraph References: {item.supporting_paragraphs.join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {item.supporting_text && (
                        <Typography sx={{ fontSize: 'caption.fontSize', fontStyle: 'italic', color: '#3d4740', lineHeight: 1.5 }}>
                          &ldquo;{item.supporting_text}&rdquo;
                        </Typography>
                      )}
                      {item.source_url && (
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '12px !important' }} />}
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: '11px', textTransform: 'none', py: 0.25 }}
                          >
                            View citing judgment record
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>

      {/* Limitations & Verification Disclaimer */}
      {limitations.length > 0 && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #edf0ea' }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#68736a', mb: 0.5 }}>
            Research Boundaries & Sources Checked:
          </Typography>
          {limitations.map((lim, i) => (
            <Typography key={i} sx={{ fontSize: '11px', color: '#7a857c', lineHeight: 1.4 }}>
              • {lim}
            </Typography>
          ))}
        </Box>
      )}
    </Paper>
  )
}
