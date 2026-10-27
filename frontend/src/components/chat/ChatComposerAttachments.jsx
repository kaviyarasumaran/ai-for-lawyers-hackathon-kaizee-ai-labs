import { Box, CircularProgress, IconButton, Typography } from '@mui/material'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import { formatBytes, getMediaType } from '../../utils/chatUtils'

export default function ChatComposerAttachments({ stagedFiles = [], onRemoveStagedFile, isDark }) {
  if (!stagedFiles || stagedFiles.length === 0) return null

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
      {stagedFiles.map((file) => {
        const mediaType = getMediaType(file)
        return (
          <Box
            key={file.id || file.name}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: '4px 8px',
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#eef4ee',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d5e2d5',
              maxWidth: 240,
            }}
          >
            {file.isUploading ? (
              <CircularProgress size={16} sx={{ color: 'primary.main', flex: 'none' }} />
            ) : mediaType === 'image' && file.url ? (
              <Box
                component="img"
                src={file.url}
                alt={file.name}
                sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'cover' }}
              />
            ) : mediaType === 'audio' ? (
              <GraphicEqRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            ) : mediaType === 'video' ? (
              <VideocamOutlinedIcon sx={{ fontSize: 18, color: '#3874cb' }} />
            ) : file.name?.toLowerCase().endsWith('.pdf') ? (
              <PictureAsPdfOutlinedIcon sx={{ fontSize: 18, color: '#b5685d' }} />
            ) : (
              <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                {file.name}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                {file.isUploading ? 'Uploading...' : formatBytes(file.size)}
              </Typography>
            </Box>
            {onRemoveStagedFile && (
              <IconButton
                size="small"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveStagedFile(file.id)}
                sx={{ width: 20, height: 20, p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
