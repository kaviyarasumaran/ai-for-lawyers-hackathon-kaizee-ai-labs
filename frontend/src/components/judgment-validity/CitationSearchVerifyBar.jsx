import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined'

const QUICK_CITATIONS = [
  { label: 'ADM Jabalpur (Emergency / Overruled)', query: 'ADM Jabalpur v Shivkant Shukla' },
  { label: 'Puttaswamy (Privacy 9-Judge)', query: 'Puttaswamy' },
  { label: 'Asian Resurfacing (Stay Auto-Expiry)', query: 'Asian Resurfacing of Road Agency' },
  { label: 'Vidya Drolia (Arbitrability)', query: 'Vidya Drolia v. Durga Trading' },
  { label: 'NN Global (Stamp Duty)', query: 'NN Global Mercantile' },
  { label: 'In Re Interplay (7-Judge Stamping)', query: 'In Re Interplay' },
  { label: 'BALCO (Territoriality)', query: 'BALCO v. Kaiser' },
  { label: 'Kesavananda (Basic Structure)', query: 'Kesavananda Bharati' },
]

export default function CitationSearchVerifyBar({
  onVerify,
  isVerifying,
  onOpenBatchDialog,
}) {
  const [citationInput, setCitationInput] = useState('')

  const handleVerifySubmit = (event) => {
    if (event) event.preventDefault()
    const clean = citationInput.trim()
    if (!clean || isVerifying) return
    onVerify(clean)
  }

  const handleSelectQuick = (query) => {
    setCitationInput(query)
    onVerify(query)
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 3,
        borderRadius: 2.5,
        borderColor: '#e8eae5',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography sx={{ color: 'text.primary', fontSize: 'body1.fontSize', fontWeight: 700 }}>
            Indian Legal Citator & Precedent Verifier
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', mt: 0.25 }}>
            Check whether any Supreme Court or High Court judgment remains Good Law, or has been Overruled or Distinguished.
          </Typography>
        </Box>
        {onOpenBatchDialog && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<PostAddOutlinedIcon />}
            onClick={onOpenBatchDialog}
            sx={{ textTransform: 'none', borderRadius: 1.75, fontSize: 'caption.fontSize' }}
          >
            Batch check from brief
          </Button>
        )}
      </Box>

      <Box
        component="form"
        onSubmit={handleVerifySubmit}
        sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Enter citation (e.g., '(2018) 16 SCC 299', '2024 INSC 150', or case name)"
          value={citationInput}
          onChange={(event) => setCitationInput(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: 'text.secondary', fontSize: 19 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.default',
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!citationInput.trim() || isVerifying}
          startIcon={
            isVerifying ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <FactCheckOutlinedIcon sx={{ fontSize: 18 }} />
            )
          }
          sx={{
            minWidth: 150,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 2,
            px: 2.5,
          }}
        >
          {isVerifying ? 'Checking...' : 'Verify validity'}
        </Button>
      </Box>

      {/* Quick Landmark suggestions */}
      <Box sx={{ mt: 1.75, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: '11px', fontWeight: 600, mr: 0.5 }}>
          Quick benchmarks:
        </Typography>
        {QUICK_CITATIONS.map((item) => (
          <Chip
            key={item.label}
            label={item.label}
            size="small"
            clickable
            onClick={() => handleSelectQuick(item.query)}
            sx={{
              height: 24,
              fontSize: '11px',
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: '#eef3ed', borderColor: '#bed4bf' },
            }}
          />
        ))}
      </Box>
    </Paper>
  )
}
