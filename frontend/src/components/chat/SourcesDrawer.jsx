import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Typography,
} from '@mui/material'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { resolveSourceFileUrl } from '../../utils/chatUtils'

export function SourceTriggerButton({ count, onClick, isDark }) {
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={onClick}
      startIcon={<MenuBookOutlinedIcon sx={{ fontSize: 15 }} />}
      endIcon={<ChevronRightRoundedIcon sx={{ fontSize: 18 }} />}
      sx={{
        borderRadius: 999,
        textTransform: 'none',
        fontSize: '0.78rem',
        fontWeight: 600,
        px: 1.5,
        py: 0.35,
        mt: 1.25,
        bgcolor: isDark ? 'rgba(76,175,80,0.08)' : 'rgba(46,125,50,0.05)',
        borderColor: isDark ? 'rgba(76,175,80,0.3)' : 'rgba(46,125,50,0.25)',
        color: isDark ? '#81c784' : '#2e7d32',
        transition: 'all 140ms ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(76,175,80,0.18)' : 'rgba(46,125,50,0.12)',
          borderColor: 'primary.main',
          transform: 'translateX(2px)',
        },
      }}
    >
      Sources ({count})
    </Button>
  )
}

export function SourceDrawerCard({ index, source, caseId, chatId, isDark }) {
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedCitation, setCopiedCitation] = useState(false)

  const fileUrl = resolveSourceFileUrl(source, caseId, chatId)
  const isGlobalKb = source.sourceType === 'global_legal_authority' || Boolean(source.section)
  const typeLabel = isGlobalKb
    ? 'Indian Law Knowledge Base'
    : source.sourceType === 'case_document'
      ? 'Case Document'
      : 'Uploaded Media'

  const snippetText = (source.snippet || source.content || '').trim()

  async function handleCopySnippet() {
    if (!snippetText) return
    try {
      await navigator.clipboard.writeText(snippetText)
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } catch {
      // ignore
    }
  }

  async function handleCopyCitation() {
    const citation = `${source.name}${source.section ? ` (${source.section})` : ''}, Page ${source.pageStart || 1}`
    try {
      await navigator.clipboard.writeText(citation)
      setCopiedCitation(true)
      setTimeout(() => setCopiedCitation(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: isDark ? '#1f2c22' : '#ffffff',
        borderColor: isDark ? '#3a5441' : '#d8e4d8',
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {/* Top Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: isDark ? '#2a3d2e' : '#eaf2ea',
              color: 'primary.main',
              fontSize: '0.75rem',
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {index}
          </Box>
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
            {source.name}
          </Typography>
        </Box>

        <Chip
          size="small"
          label={typeLabel}
          sx={{
            height: 20,
            fontSize: '0.7rem',
            fontWeight: 600,
            bgcolor: isDark ? 'rgba(76,175,80,0.18)' : 'rgba(46,125,50,0.08)',
            color: isDark ? '#81c784' : '#1b5e20',
            border: '1px solid',
            borderColor: isDark ? 'rgba(76,175,80,0.3)' : 'rgba(46,125,50,0.2)',
            flex: 'none',
          }}
        />
      </Box>

      {/* Section & Page row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        {source.section && (
          <Chip
            size="small"
            label={source.section}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              bgcolor: isDark ? 'rgba(33,150,243,0.18)' : 'rgba(25,118,210,0.08)',
              color: isDark ? '#90caf9' : '#0d47a1',
              border: '1px solid',
              borderColor: isDark ? 'rgba(33,150,243,0.3)' : 'rgba(25,118,210,0.2)',
            }}
          />
        )}
        {source.pageStart ? (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 500 }}>
            Page {source.pageStart}
            {source.pageEnd && source.pageEnd !== source.pageStart ? ` - ${source.pageEnd}` : ''}
          </Typography>
        ) : null}
      </Box>

      {/* Snippet / Provision excerpt */}
      {snippetText && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: isDark ? '#141e17' : '#f8faf8',
            border: '1px solid',
            borderColor: isDark ? '#2e4434' : '#e2ece2',
            borderLeft: '3px solid',
            borderLeftColor: 'primary.main',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8rem',
              lineHeight: 1.65,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {snippetText}
          </Typography>
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {snippetText && (
            <Button
              size="small"
              variant="text"
              startIcon={copiedSnippet ? <CheckOutlinedIcon sx={{ fontSize: 14 }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={handleCopySnippet}
              sx={{
                textTransform: 'none',
                fontSize: '0.72rem',
                py: 0.25,
                px: 1,
                color: copiedSnippet ? 'primary.main' : 'text.secondary',
              }}
            >
              {copiedSnippet ? 'Copied' : 'Copy Text'}
            </Button>
          )}

          <Button
            size="small"
            variant="text"
            startIcon={copiedCitation ? <CheckOutlinedIcon sx={{ fontSize: 14 }} /> : <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={handleCopyCitation}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              py: 0.25,
              px: 1,
              color: copiedCitation ? 'primary.main' : 'text.secondary',
            }}
          >
            {copiedCitation ? 'Cited' : 'Cite'}
          </Button>
        </Box>

        {fileUrl && (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              py: 0.25,
              px: 1.25,
              borderRadius: 1.5,
              borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: isDark ? 'rgba(76,175,80,0.08)' : 'rgba(46,125,50,0.05)',
              },
            }}
          >
            Open File
          </Button>
        )}
      </Box>
    </Paper>
  )
}

export default function SourcesDrawer({ open, sources, caseId, chatId, onClose, isDark }) {
  if (!Array.isArray(sources) || sources.length === 0) return null

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            width: { xs: '100vw', sm: 480, md: 540 },
            minWidth: 0,
            maxWidth: '100vw',
            flexDirection: 'column',
            bgcolor: isDark ? '#1a241c' : '#fbfbf9',
            borderLeft: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'divider',
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', minHeight: 68, alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5 }}>
        <Box
          sx={{
            display: 'grid',
            width: 38,
            height: 38,
            placeItems: 'center',
            borderRadius: 2,
            color: 'primary.main',
            bgcolor: isDark ? 'rgba(54,117,77,0.2)' : '#e9f1e9',
          }}
        >
          <MenuBookOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
              Sources & Knowledge Base
            </Typography>
            <Chip
              label={sources.length}
              size="small"
              sx={{
                height: 20,
                fontSize: 'caption.fontSize',
                fontWeight: 700,
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#eef3ee',
                color: 'primary.main',
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Authorities, statutes, and evidence cited in this response
          </Typography>
        </Box>
        <IconButton
          aria-label="Close sources drawer"
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Divider />

      {/* Body: list of source cards */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {sources.map((source, index) => (
          <SourceDrawerCard
            key={source.id || index}
            index={index + 1}
            source={source}
            caseId={caseId}
            chatId={chatId}
            isDark={isDark}
          />
        ))}
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ p: 2, px: 2.5, display: 'flex', justifyContent: 'flex-end', bgcolor: isDark ? '#141d16' : '#f5f7f5' }}>
        <Button
          variant="contained"
          size="small"
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8rem',
            borderRadius: 1.5,
            px: 2.5,
          }}
        >
          Done
        </Button>
      </Box>
    </Drawer>
  )
}
