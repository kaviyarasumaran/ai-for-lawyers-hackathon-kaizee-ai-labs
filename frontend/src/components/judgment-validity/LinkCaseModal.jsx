import { useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded'

export default function LinkCaseModal({
  open,
  onClose,
  precedent,
  cases = [],
  onLinkSuccess,
}) {
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const activeCases = cases.filter((c) => !c.isDefault)

  const handleLinkSubmit = async () => {
    if (!selectedCaseId || !precedent) return
    setIsLinking(true)
    setErrorMsg('')
    try {
      await onLinkSuccess(selectedCaseId, precedent)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to link precedent.')
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <AddLinkRoundedIcon sx={{ color: 'primary.main' }} />
        Link Precedent to Case Matter
      </DialogTitle>
      <DialogContent dividers>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}
        <Typography sx={{ fontSize: 'body2.fontSize', color: 'text.secondary', mb: 2 }}>
          Attach <strong>{precedent?.caseName}</strong> ({precedent?.citation}) to an active matter so it shows on the case details dashboard and remains monitored.
        </Typography>

        <FormControl fullWidth size="small">
          <InputLabel id="case-select-label">Select case matter</InputLabel>
          <Select
            labelId="case-select-label"
            value={selectedCaseId}
            label="Select case matter"
            onChange={(e) => setSelectedCaseId(e.target.value)}
            disabled={isLinking}
          >
            {activeCases.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.title} — {c.matterType}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLinking}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleLinkSubmit}
          disabled={!selectedCaseId || isLinking}
          startIcon={isLinking ? <CircularProgress size={16} color="inherit" /> : <AddLinkRoundedIcon />}
        >
          {isLinking ? 'Linking...' : 'Link to case'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
