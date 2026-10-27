import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

export default function CaseFindingsCard({
  findings = [],
  pipelineIsActive = false,
  onOpenCaseChat,
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
    >
      <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
        Case findings
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 1.5, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
        Automatically drafted from processed case documents. Verify every finding against its cited source before relying on it.
      </Typography>
      {findings.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
          {findings.map((finding, index) => (
            <Box
              key={`${finding.title}-${index}`}
              sx={{ p: 1.25, border: '1px solid #e7ebe5', borderRadius: 1.5, bgcolor: '#f8faf7' }}
            >
              <Typography sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                {finding.title}
              </Typography>
              <Typography sx={{ mt: 0.4, color: '#69736b', fontSize: 'caption.fontSize', lineHeight: 1.65 }}>
                {finding.detail}
              </Typography>
              {finding.sources?.length > 0 && (
                <Typography sx={{ mt: 0.5, color: '#858c85', fontSize: 'caption.fontSize' }}>
                  Sources: {finding.sources.join('; ')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Alert
          severity="info"
          icon={false}
          sx={{
            mb: 1.5,
            border: '1px solid #e7ebe5',
            bgcolor: '#f8faf7',
            color: '#758075',
            fontSize: 'caption.fontSize',
            lineHeight: 1.65,
          }}
        >
          {pipelineIsActive
            ? 'Findings will appear after document processing completes.'
            : 'No findings have been generated yet. Upload supported source documents to start processing.'}
        </Alert>
      )}
      <Button
        onClick={onOpenCaseChat}
        startIcon={<AutoAwesomeOutlinedIcon />}
        endIcon={<ArrowForwardRoundedIcon />}
        sx={{ fontSize: 'caption.fontSize' }}
      >
        Review with AI
      </Button>
    </Paper>
  )
}
