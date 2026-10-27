import { Box, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { formatBytes, getMediaType, resolveSourceFileUrl } from '../../utils/chatUtils'

function getFileIcon(file) {
  const mediaType = getMediaType(file)
  const name = (file?.name || '').toLowerCase()
  if (mediaType === 'image') return <ImageOutlinedIcon sx={{ fontSize: 20 }} />
  if (mediaType === 'video') return <MovieOutlinedIcon sx={{ fontSize: 20 }} />
  if (mediaType === 'audio') return <GraphicEqRoundedIcon sx={{ fontSize: 20 }} />
  if (name.endsWith('.pdf')) return <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />
  return <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
}

export default function ChatFileRow({ file, chatId, onRemove, isDark }) {
  const mediaType = getMediaType(file)
  const fileUrl = file?.url || resolveSourceFileUrl(file, null, chatId) || '#'
  const isPdf = (file.name || '').toLowerCase().endsWith('.pdf')
  const status = file.pipeline_status || file.pipelineStatus || 'staged'
  const pageCount = file.page_count ?? file.pageCount

  return (
    <Paper
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
        {mediaType === 'image' ? (
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
      {mediaType === 'video' && (
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
}
