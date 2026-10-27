import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import SortRoundedIcon from '@mui/icons-material/SortRounded'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getMediaType(file) {
  const type = (file?.type || file?.contentType || file?.content_type || '').toLowerCase()
  const name = (file?.name || '').toLowerCase()
  const ext = name.split('.').pop() || ''
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'heic', 'tiff', 'tif'].includes(ext)) {
    return 'images'
  }
  // Audio check: prioritize audio types and filenames (voice recordings, audio notes)
  const isAudio =
    type.startsWith('audio/') ||
    ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'weba'].includes(ext) ||
    (ext === 'webm' && (type.includes('audio') || name.includes('voice') || name.includes('audio') || !name.includes('video')))
  if (isAudio) {
    return 'audio'
  }
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'flv', 'm4v', 'webm'].includes(ext)) {
    return 'videos'
  }
  return 'documents'
}

function getFileIcon(file) {
  const mediaType = getMediaType(file)
  const name = (file?.name || '').toLowerCase()
  if (mediaType === 'images') return <ImageOutlinedIcon sx={{ fontSize: 20 }} />
  if (mediaType === 'videos') return <MovieOutlinedIcon sx={{ fontSize: 20 }} />
  if (mediaType === 'audio') return <GraphicEqRoundedIcon sx={{ fontSize: 20 }} />
  if (name.endsWith('.pdf')) return <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
}

function resolveFileUrl(file) {
  if (file?.url) return file.url
  if (file?.id) return `/api/chat/attachments/${encodeURIComponent(file.id)}/file`
  return '#'
}

function ChatFilesDialog({ open, onClose, files = [], onRemove, onAddFiles }) {
  const isDark = useTheme().palette.mode === 'dark'
  const [category, setCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const counts = useMemo(() => {
    return {
      all: files.length,
      documents: files.filter((f) => getMediaType(f) === 'documents').length,
      images: files.filter((f) => getMediaType(f) === 'images').length,
      videos: files.filter((f) => getMediaType(f) === 'videos').length,
      audio: files.filter((f) => getMediaType(f) === 'audio').length,
    }
  }, [files])

  const filteredAndSortedFiles = useMemo(() => {
    let result = files

    // 1. Filter by category
    if (category !== 'all') {
      result = result.filter((file) => getMediaType(file) === category)
    }

    // 2. Filter by search query
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((file) => {
        const name = (file.name || '').toLowerCase()
        const source = (file.source || '').toLowerCase()
        const type = (file.type || '').toLowerCase()
        return name.includes(q) || source.includes(q) || type.includes(q)
      })
    }

    // 3. Sort files
    result = [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        const timeA = new Date(a.addedAt || a.added_at || 0).getTime()
        const timeB = new Date(b.addedAt || b.added_at || 0).getTime()
        return timeB - timeA
      }
      if (sortBy === 'oldest') {
        const timeA = new Date(a.addedAt || a.added_at || 0).getTime()
        const timeB = new Date(b.addedAt || b.added_at || 0).getTime()
        return timeA - timeB
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '')
      }
      if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '')
      }
      if (sortBy === 'size') {
        return (b.size || 0) - (a.size || 0)
      }
      return 0
    })

    return result
  }, [files, category, searchQuery, sortBy])

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open={open}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            width: { xs: '100vw', sm: 460, md: 520 },
            minWidth: 0,
            maxWidth: '100vw',
            flexDirection: 'column',
            bgcolor: isDark ? '#1a241c' : '#fbfbf9',
            borderLeft: '1px solid',
            borderColor: 'divider',
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
          <FolderOpenOutlinedIcon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
              Files in this chat
            </Typography>
            <Chip
              label={files.length}
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
          <Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
            Instant OCR, document search & media access
          </Typography>
        </Box>
        <IconButton aria-label="Close chat files" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Filter and Search Bar */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <TextField
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter files by name or extension..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
              fontSize: 'body2.fontSize',
            },
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontSize: 'caption.fontSize', color: 'text.secondary', fontWeight: 600 }}>
            Showing {filteredAndSortedFiles.length} of {files.length} file{files.length === 1 ? '' : 's'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <SortRoundedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
            <Select
              size="small"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              variant="standard"
              disableUnderline
              sx={{
                fontSize: 'caption.fontSize',
                fontWeight: 600,
                color: 'text.secondary',
                '& .MuiSelect-select': { py: 0.25, pr: '20px !important' },
              }}
            >
              <MenuItem value="newest" sx={{ fontSize: 'caption.fontSize' }}>Newest</MenuItem>
              <MenuItem value="oldest" sx={{ fontSize: 'caption.fontSize' }}>Oldest</MenuItem>
              <MenuItem value="name-asc" sx={{ fontSize: 'caption.fontSize' }}>Name (A → Z)</MenuItem>
              <MenuItem value="name-desc" sx={{ fontSize: 'caption.fontSize' }}>Name (Z → A)</MenuItem>
              <MenuItem value="size" sx={{ fontSize: 'caption.fontSize' }}>Largest size</MenuItem>
            </Select>
          </Box>
        </Box>
      </Box>

      {/* Category Tabs */}
      <Tabs
        aria-label="Chat files categories"
        onChange={(_, value) => setCategory(value)}
        scrollButtons="auto"
        value={category}
        variant="scrollable"
        sx={{
          px: 1.5,
          minHeight: 44,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': {
            minHeight: 44,
            minWidth: 'auto',
            px: 1.5,
            fontSize: 'caption.fontSize',
            fontWeight: 600,
            textTransform: 'none',
          },
          '& .MuiTabs-indicator': { height: 2, borderRadius: 2 },
        }}
      >
        {[
          ['all', 'All'],
          ['documents', 'Documents'],
          ['images', 'Images'],
          ['videos', 'Videos'],
          ['audio', 'Audio'],
        ].map(([val, label]) => (
          <Tab
            key={val}
            value={val}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {label}
                <Chip
                  label={counts[val]}
                  size="small"
                  sx={{
                    height: 18,
                    minWidth: 18,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    bgcolor: category === val
                      ? (isDark ? 'primary.main' : '#e2ede3')
                      : (isDark ? 'rgba(255,255,255,0.06)' : '#edeeea'),
                    color: category === val && isDark ? '#fff' : 'inherit',
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* Files List */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
        {filteredAndSortedFiles.length === 0 ? (
          <Box sx={{ display: 'flex', minHeight: 240, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', p: 3 }}>
            <AttachFileOutlinedIcon sx={{ mb: 1, color: 'text.secondary', fontSize: 36, opacity: 0.6 }} />
            <Typography sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 600 }}>
              {files.length === 0
                ? 'No files in this conversation yet'
                : searchQuery
                  ? `No files matching "${searchQuery}"`
                  : `No ${category} files in this chat`}
            </Typography>
            <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize', maxWidth: 300 }}>
              Upload case documents, mock drafts, evidence photos, audio recordings, or videos to analyze them with AI.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {filteredAndSortedFiles.map((file) => {
              const mediaType = getMediaType(file)
              const fileUrl = resolveFileUrl(file)
              const isPdf = (file.name || '').toLowerCase().endsWith('.pdf')
              const status = file.pipeline_status || file.pipelineStatus || 'staged'
              const pageCount = file.page_count ?? file.pageCount

              return (
                <Paper
                  key={file.id || file.name}
                  variant="outlined"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    p: 1.5,
                    borderRadius: 2.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e7e2',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    boxShadow: 'none',
                    transition: 'border-color 140ms ease, box-shadow 140ms ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.25)' : '0 2px 10px rgba(50,80,50,0.05)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* Media Thumbnail or Icon */}
                    {mediaType === 'images' ? (
                      <Box
                        component="img"
                        src={fileUrl}
                        alt={file.name}
                        onError={(e) => {
                          if (file.id && !e.target.dataset.fallback) {
                            e.target.dataset.fallback = 'true'
                            e.target.src = `/api/chat/attachments/${encodeURIComponent(file.id)}/file`
                          }
                        }}
                        sx={{
                          width: 54,
                          height: 54,
                          flex: 'none',
                          borderRadius: 2,
                          objectFit: 'cover',
                          bgcolor: isDark ? '#111813' : '#f0f2ed',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: 'grid',
                          width: 50,
                          height: 50,
                          flex: 'none',
                          placeItems: 'center',
                          borderRadius: 2,
                          color: isPdf ? '#d32f2f' : 'primary.main',
                          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#eef4ee',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {getFileIcon(file)}
                      </Box>
                    )}

                    {/* File Information */}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography noWrap sx={{ fontSize: 'body2.fontSize', fontWeight: 600, color: 'text.primary' }}>
                          {file.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          {formatBytes(file.size)}
                        </Typography>
                        {pageCount ? (
                          <Chip
                            label={`${pageCount} page${pageCount > 1 ? 's' : ''}`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.68rem', bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#eef2ee' }}
                          />
                        ) : null}
                        <Chip
                          icon={
                            status === 'completed'
                              ? <CheckCircleOutlineRoundedIcon sx={{ fontSize: '12px !important' }} />
                              : <HourglassEmptyRoundedIcon sx={{ fontSize: '12px !important' }} />
                          }
                          label={
                            status === 'completed'
                              ? 'Ready / Indexed'
                              : status === 'staged'
                                ? 'Staged'
                                : status === 'processing'
                                  ? 'Processing...'
                                  : 'Uploaded'
                          }
                          size="small"
                          color={status === 'completed' ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.68rem', '& .MuiChip-label': { px: 0.5 } }}
                        />
                      </Box>
                    </Box>

                    {/* Action Buttons */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={`Open or download ${file.name}`}>
                        <IconButton
                          component="a"
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${file.name}`}
                          size="small"
                          sx={{ color: 'primary.main', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f2f6f2' }}
                        >
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {onRemove && (
                        <Tooltip title={`Delete ${file.name}`}>
                          <IconButton
                            aria-label={`Remove ${file.name}`}
                            onClick={() => onRemove(file.id || file.name)}
                            size="small"
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Inline Audio Player if Audio */}
                  {mediaType === 'audio' && (
                    <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box
                        component="audio"
                        src={fileUrl}
                        controls
                        onError={(e) => {
                          if (file.id && !e.target.dataset.fallback) {
                            e.target.dataset.fallback = 'true'
                            e.target.src = `/api/chat/attachments/${encodeURIComponent(file.id)}/file`
                          }
                        }}
                        sx={{ display: 'block', width: '100%', height: 32 }}
                      />
                    </Box>
                  )}

                  {/* Inline Video Player if Video */}
                  {mediaType === 'videos' && (
                    <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box
                        component="video"
                        src={fileUrl}
                        controls
                        preload="metadata"
                        onError={(e) => {
                          if (file.id && !e.target.dataset.fallback) {
                            e.target.dataset.fallback = 'true'
                            e.target.src = `/api/chat/attachments/${encodeURIComponent(file.id)}/file`
                          }
                        }}
                        sx={{ width: '100%', maxHeight: 180, borderRadius: 1.5, bgcolor: '#000', display: 'block' }}
                      />
                    </Box>
                  )}
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>

      <Divider />

      {/* Footer */}
      <Box sx={{ display: 'flex', minHeight: 60, alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2.5, py: 1.5 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
          Attachments are automatically scanned & indexed for AI analysis.
        </Typography>
        <Button
          onClick={onAddFiles}
          startIcon={<AttachFileOutlinedIcon />}
          variant="contained"
          size="small"
          sx={{ flex: 'none', borderRadius: 2, fontSize: 'caption.fontSize', textTransform: 'none' }}
        >
          Add files
        </Button>
      </Box>
    </Drawer>
  )
}

export default ChatFilesDialog
