import { Box, Chip, Typography } from '@mui/material'

function CaseHearingHistoryList({ hearings }) {
  if (!hearings || hearings.length === 0) return null

  return (
    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 700, color: 'text.secondary' }}>
        Date-Wise Hearing History
      </Typography>
      {hearings.map((h, idx) => (
        <Box
          key={h.id || idx}
          sx={{
            p: 1.25,
            borderRadius: 1.5,
            bgcolor: '#f7f9f6',
            border: '1px solid #e5ebe4',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 700, color: '#39463c' }}>
              {h.date} · {h.courtNumber}
            </Typography>
            <Chip label={h.stage || 'Hearing'} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
          </Box>
          {h.arguments && (
            <Typography sx={{ fontSize: 'caption.fontSize', color: '#48524a' }}>
              <strong>Arguments:</strong> {h.arguments}
            </Typography>
          )}
          {h.outcome && (
            <Typography sx={{ fontSize: 'caption.fontSize', color: '#2e6b3b', fontWeight: 600 }}>
              <strong>Outcome:</strong> {h.outcome}
            </Typography>
          )}
          {h.nextDate && (
            <Typography sx={{ fontSize: 'caption.fontSize', color: '#68736a' }}>
              Next Listing: {h.nextDate}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.65rem', color: '#889189', mt: 0.25 }}>
            ✓ Ingested in Case AI Knowledge Base
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

export default CaseHearingHistoryList
