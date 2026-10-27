import { Box, Button, Divider, Paper, Typography } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

export default function CaseSummaryCard({
  generatedSummary,
  manualSummary,
  pipelineIsActive = false,
  onOpenCaseChat,
}) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Case summary
          </Typography>
          <Typography sx={{ mt: 0.5, color: '#858c85', fontSize: 'caption.fontSize' }}>
            {generatedSummary
              ? 'AI-generated draft from case documents. Verify before relying on it.'
              : manualSummary
                ? 'Provided when this case was created.'
                : 'No summary has been added.'}
          </Typography>
        </Box>
        <Button
          onClick={onOpenCaseChat}
          size="small"
          startIcon={<AutoAwesomeOutlinedIcon />}
          sx={{ flexShrink: 0, fontSize: 'caption.fontSize' }}
        >
          Ask AI
        </Button>
      </Box>
      <Divider sx={{ my: 1.5, borderColor: '#eff0ec' }} />
      <Typography
        sx={{
          color: generatedSummary || manualSummary ? '#59645b' : '#9aa19a',
          fontSize: 'body2.fontSize',
          lineHeight: 1.8,
        }}
      >
        {generatedSummary ||
          manualSummary ||
          (pipelineIsActive
            ? 'A draft summary will appear after document processing completes.'
            : 'Upload supported source documents to generate a draft summary.')}
      </Typography>
    </Paper>
  )
}
