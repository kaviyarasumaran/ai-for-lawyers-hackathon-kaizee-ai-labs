import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

export default function BatchCitationDialog({
  open,
  onClose,
  cases = [],
  onBatchVerify,
}) {
  const [briefText, setBriefText] = useState('')
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [batchResults, setBatchResults] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleRunBatch = async () => {
    const cleanText = briefText.trim()
    if (!cleanText) return
    setIsLoading(true)
    setErrorMessage('')
    try {
      const results = await onBatchVerify({
        text: cleanText,
        caseId: selectedCaseId || undefined,
      })
      setBatchResults(results)
    } catch (err) {
      setErrorMessage(err.message || 'Batch citation check failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setBatchResults(null)
    setBriefText('')
    setErrorMessage('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <PostAddOutlinedIcon sx={{ color: 'primary.main' }} />
        Batch Precedent & Citation Verification
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', mb: 2 }}>
          Paste legal arguments, an SLP petition excerpt, or a list of citations. Antigravity will extract all Supreme Court and High Court precedents and report their validity status.
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <TextField
          multiline
          rows={6}
          fullWidth
          label="Legal brief text or citations list"
          placeholder="e.g. 'The petitioner relies upon Asian Resurfacing (2018) 16 SCC 299 for stay expiry, and NN Global (2023) 7 SCC 1 regarding stamping. In response, Kesavananda Bharati (1973) 4 SCC 225 was cited.'"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 2 }}
        />

        {cases.length > 0 && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel id="batch-case-label">Optional: Associate extracted precedents to a case</InputLabel>
            <Select
              labelId="batch-case-label"
              value={selectedCaseId}
              label="Optional: Associate extracted precedents to a case"
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={isLoading}
            >
              <MenuItem value="">
                <em>None (Verify only in Citator library)</em>
              </MenuItem>
              {cases
                .filter((c) => !c.isDefault)
                .map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.title} ({c.matterType})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}

        {/* Batch Results Display */}
        {batchResults && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 'body2.fontSize', mb: 1 }}>
              Verification Findings ({batchResults.length} precedent{batchResults.length === 1 ? '' : 's'} identified):
            </Typography>
            {batchResults.length === 0 ? (
              <Alert severity="info">
                No citations found in the text. Try including full case names or citations (e.g., '(2018) 16 SCC 299').
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {batchResults.map((item, idx) => {
                  const isOverruled = item.status === 'overruled'
                  const isGood = item.status === 'good_law'
                  return (
                    <Box
                      key={`${item.caseName}-${idx}`}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: isOverruled ? '#fadbd8' : isGood ? '#c6e3c8' : '#fce3a7',
                        bgcolor: isOverruled ? '#fdeeed' : isGood ? '#eaf4eb' : '#fef7e7',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '13px' }}>
                          {item.caseName} ({item.citation})
                        </Typography>
                        <Chip
                          icon={
                            isOverruled ? (
                              <CancelOutlinedIcon sx={{ fontSize: '14px !important' }} />
                            ) : isGood ? (
                              <CheckCircleOutlineRoundedIcon sx={{ fontSize: '14px !important' }} />
                            ) : (
                              <WarningAmberRoundedIcon sx={{ fontSize: '14px !important' }} />
                            )
                          }
                          label={item.status?.toUpperCase().replace('_', ' ')}
                          size="small"
                          sx={{
                            height: 22,
                            fontWeight: 700,
                            fontSize: '10px',
                            color: isOverruled ? '#b3261e' : isGood ? '#2e6b35' : '#b06000',
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: '12px', mt: 0.5 }}>
                        {item.treatment}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          {batchResults ? 'Done' : 'Cancel'}
        </Button>
        <Button
          variant="contained"
          onClick={handleRunBatch}
          disabled={!briefText.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <PostAddOutlinedIcon />}
        >
          {isLoading ? 'Scanning citations...' : 'Analyze brief citations'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
