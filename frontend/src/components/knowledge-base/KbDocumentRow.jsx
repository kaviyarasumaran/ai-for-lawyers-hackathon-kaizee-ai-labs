import { Box, IconButton, Paper, Typography } from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DocumentStatusChip from './DocumentStatusChip'
import { formatBytes } from '../../utils/formatters'

export default function KbDocumentRow({
  document,
  folderName = 'Folder',
  isExpanded = false,
  rowGrid,
  onToggleExpanded,
  onRemoveDocument,
}) {
  const FileIcon =
    document.extension === 'pdf'
      ? PictureAsPdfOutlinedIcon
      : InsertDriveFileOutlinedIcon

  return (
    <Box>
      <Box
        sx={{
          ...rowGrid,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #f0f1ed',
          '&:hover': { bgcolor: '#fcfdfa' },
        }}
      >
        <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              display: 'grid',
              width: 33,
              height: 33,
              flex: 'none',
              placeItems: 'center',
              borderRadius: 1.75,
              color: document.extension === 'pdf' ? '#b5685d' : '#64816a',
              bgcolor: document.extension === 'pdf' ? '#fbefed' : '#eef4ed',
            }}
          >
            <FileIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ color: '#3d463f', fontSize: 'caption.fontSize', fontWeight: 600 }}>
              {document.name}
            </Typography>
            <Typography sx={{ mt: 0.25, color: '#a0a59f', fontSize: 'caption.fontSize' }}>
              {formatBytes(document.size)} · {
                ['ready', 'completed', 'stored'].includes(document.status)
                  ? `${document.chunks?.length ?? document.chunkCount ?? 0} chunks`
                  : ['failed', 'error'].includes(document.status)
                    ? 'Extraction failed'
                    : (document.chunkCount || document.chunks?.length)
                      ? `Indexing ${document.chunkCount || document.chunks?.length} chunks`
                      : 'Preparing chunks'
              }
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#737b74', fontSize: 'caption.fontSize' }}>
          {folderName}
        </Typography>
        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#858c85', fontSize: 'caption.fontSize' }}>
          {formatBytes(document.size)}
        </Typography>
        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#64816a', fontSize: 'caption.fontSize', fontWeight: 600 }}>
          {['ready', 'completed', 'stored'].includes(document.status)
            ? (document.chunks?.length ?? document.chunkCount ?? 0)
            : (document.chunkCount || document.chunks?.length
                ? `${document.chunkCount || document.chunks?.length} (indexing)`
                : '—')}
        </Typography>
        <DocumentStatusChip
          status={document.status}
          progress={document.progress}
          error={document.error}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {document.url && (
            <IconButton
              component="a"
              href={document.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${document.name}`}
              size="small"
              sx={{ color: '#6c8170' }}
            >
              <OpenInNewRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          )}
          {['ready', 'completed', 'stored'].includes(document.status) && (document.chunks?.length ?? 0) > 0 && (
            <IconButton
              aria-label={`${isExpanded ? 'Hide' : 'Show'} chunks for ${document.name}`}
              onClick={() => onToggleExpanded(document.id)}
              size="small"
              sx={{ color: '#7f897f' }}
            >
              <ExpandMoreRoundedIcon
                sx={{
                  fontSize: 19,
                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms ease',
                }}
              />
            </IconButton>
          )}
          <IconButton
            aria-label={`Remove ${document.name}`}
            onClick={() => onRemoveDocument(document.id)}
            size="small"
            sx={{ color: '#a2a7a1' }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </Box>
      {isExpanded && (document.chunks?.length ?? 0) > 0 && (
        <Box sx={{ px: { xs: 2, md: 6 }, py: 1.5, bgcolor: '#fafbf9', borderBottom: '1px solid #eff0ec' }}>
          <Typography sx={{ mb: 1, color: '#6d786f', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 0.5 }}>
            {document.chunks.length} TEXT CHUNKS
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {document.chunks.map((chunk) => (
              <Paper
                key={chunk.id}
                variant="outlined"
                sx={{ p: 1.25, borderColor: '#eaede7', borderRadius: 1.75, boxShadow: 'none' }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ color: '#4f6955', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                    Chunk {chunk.index}
                  </Typography>
                  <Typography sx={{ color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                    {chunk.characters.toLocaleString()} characters
                  </Typography>
                </Box>
                <Typography sx={{ color: '#737b74', fontSize: 'caption.fontSize', lineHeight: 1.65, overflowWrap: 'anywhere' }}>
                  {chunk.content.slice(0, 320)}
                  {chunk.content.length > 320 ? '…' : ''}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
