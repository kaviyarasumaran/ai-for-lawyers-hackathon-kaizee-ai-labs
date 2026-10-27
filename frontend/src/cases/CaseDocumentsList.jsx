import { Box, Button, Chip, Paper, Typography } from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { formatBytes } from '../utils/formatters'

export default function CaseDocumentsList({ documents = [], documentPipelineById = new Map() }) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
        <Box>
          <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Related documents
          </Typography>
          <Typography sx={{ mt: 0.4, color: '#858c85', fontSize: 'caption.fontSize' }}>
            Files attached to this case.
          </Typography>
        </Box>
        <Chip
          label={documents.length}
          size="small"
          sx={{ height: 21, bgcolor: '#f1f3ef', color: '#69736b', fontSize: 'caption.fontSize' }}
        />
      </Box>
      {documents.length === 0 ? (
        <Typography sx={{ py: 1.25, color: '#929992', fontSize: 'caption.fontSize' }}>
          No related documents have been uploaded yet.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {documents.map((file, index) => (
            <Box
              key={file.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                py: 1,
                borderTop: index === 0 ? '1px solid #eff0ec' : 'none',
                borderBottom: '1px solid #eff0ec',
              }}
            >
              <DescriptionOutlinedIcon sx={{ flex: 'none', color: '#78907b', fontSize: 17 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 600 }}>
                  {file.name}
                </Typography>
                <Typography sx={{ mt: 0.25, color: '#929992', fontSize: 'caption.fontSize' }}>
                  {formatBytes(file.size)}
                  {documentPipelineById.get(file.id)?.status
                    ? ` · ${documentPipelineById.get(file.id).status}`
                    : ''}
                </Typography>
              </Box>
              <Button
                component="a"
                href={file.url}
                target="_blank"
                rel="noreferrer"
                download={file.name}
                endIcon={<OpenInNewRoundedIcon />}
                sx={{ flexShrink: 0, fontSize: 'caption.fontSize' }}
              >
                Open
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
