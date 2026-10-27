import { Box, Paper, Typography } from '@mui/material'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { formatBytes, getMediaType } from '../../utils/chatUtils'

export default function MessageAttachmentCard({ attachment, isDark, chatId }) {
  const mediaType = getMediaType(attachment)
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''
  const fileUrl =
    attachment?.url ||
    (attachment?.id ? `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file${query}` : '#')

  if (mediaType === 'image') {
    return (
      <Box
        component="a"
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          bgcolor: isDark ? '#1a271e' : '#fff',
          maxWidth: 340,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'transform 140ms ease, box-shadow 140ms ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          },
        }}
      >
        <Box
          component="img"
          src={fileUrl}
          alt={attachment.name || 'Attached image'}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = 'true'
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`
            }
          }}
          sx={{
            display: 'block',
            width: '100%',
            maxHeight: 220,
            objectFit: 'cover',
            bgcolor: isDark ? '#111813' : '#f0f0f0',
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
          <Typography noWrap sx={{ fontSize: 'caption.fontSize', fontWeight: 600 }}>
            {attachment.name}
          </Typography>
          <OpenInNewRoundedIcon sx={{ fontSize: 15, opacity: 0.7, ml: 1 }} />
        </Box>
      </Box>
    )
  }

  if (mediaType === 'audio') {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 2,
          bgcolor: isDark ? '#1e2b21' : '#fff',
          borderColor: isDark ? '#3a5441' : '#d2e3d3',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.75,
          minWidth: 260,
          maxWidth: 360,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GraphicEqRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography noWrap sx={{ fontSize: 'caption.fontSize', fontWeight: 600, flex: 1 }}>
            {attachment.name}
          </Typography>
          {attachment.size ? (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {formatBytes(attachment.size)}
            </Typography>
          ) : null}
        </Box>
        <Box
          component="audio"
          controls
          src={fileUrl}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = 'true'
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`
            }
          }}
          sx={{ width: '100%', height: 36 }}
        />
      </Paper>
    )
  }

  if (mediaType === 'video') {
    return (
      <Paper
        variant="outlined"
        sx={{
          overflow: 'hidden',
          borderRadius: 2,
          bgcolor: isDark ? '#1e2b21' : '#fff',
          borderColor: isDark ? '#3a5441' : '#d2e3d3',
          maxWidth: 360,
        }}
      >
        <Box
          component="video"
          controls
          src={fileUrl}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = 'true'
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`
            }
          }}
          sx={{ width: '100%', maxHeight: 220, display: 'block', bgcolor: '#000' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1 }}>
          <Typography noWrap sx={{ fontSize: 'caption.fontSize', fontWeight: 600, flex: 1 }}>
            {attachment.name}
          </Typography>
          {attachment.size ? (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 1 }}>
              {formatBytes(attachment.size)}
            </Typography>
          ) : null}
        </Box>
      </Paper>
    )
  }

  const isPdf = attachment.name?.toLowerCase().endsWith('.pdf')
  return (
    <Paper
      component="a"
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        p: '8px 12px',
        borderRadius: 2,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: isDark ? '#1e2b21' : '#fff',
        borderColor: isDark ? '#3a5441' : '#d2e3d3',
        minWidth: 220,
        maxWidth: 360,
        transition: 'background-color 140ms ease, border-color 140ms ease',
        '&:hover': {
          bgcolor: isDark ? '#26372a' : '#f4f8f4',
          borderColor: 'primary.main',
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          width: 34,
          height: 34,
          flex: 'none',
          placeItems: 'center',
          borderRadius: 1.5,
          bgcolor: isDark ? '#283b2e' : '#eef4ee',
          color: isPdf ? '#b5685d' : 'primary.main',
        }}
      >
        {isPdf ? (
          <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />
        ) : (
          <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: 'caption.fontSize', fontWeight: 600, color: 'text.primary' }}>
          {attachment.name}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
          {attachment.size ? formatBytes(attachment.size) : 'Document'} · Click to view
        </Typography>
      </Box>
      <OpenInNewRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flex: 'none' }} />
    </Paper>
  )
}
