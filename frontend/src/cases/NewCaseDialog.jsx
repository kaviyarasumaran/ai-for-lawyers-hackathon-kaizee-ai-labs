import { useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import { useCases } from '../hooks'
import { formatBytes } from '../utils/formatters'

const matterTypes = [
  'Contract review',
  'Family law',
  'Employment',
  'Housing',
  'Business',
  'Dispute',
  'General question',
  'Other',
]

function NewCaseDialog({ open, onClose, onCreated, caseItem = null }) {
  const { createCase, updateCase } = useCases()
  const fileInputRef = useRef(null)
  const [title, setTitle] = useState(caseItem?.title ?? '')
  const [matterType, setMatterType] = useState(caseItem?.matterType ?? 'Contract review')
  const [parties, setParties] = useState(caseItem?.parties ?? '')
  const [summary, setSummary] = useState(caseItem?.manualSummary ?? caseItem?.summary ?? '')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')

  function resetForm() {
    setTitle(caseItem?.title ?? '')
    setMatterType(caseItem?.matterType ?? 'Contract review')
    setParties(caseItem?.parties ?? '')
    setSummary(caseItem?.manualSummary ?? caseItem?.summary ?? '')
    setFiles([])
    setError('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleFiles(event) {
    const selectedFiles = Array.from(event.target.files ?? [])
    const tooLarge = selectedFiles.filter((file) => file.size > 25 * 1024 * 1024)
    if (tooLarge.length > 0) {
      setError(`${tooLarge.map((file) => file.name).join(', ')} exceed the 25 MB per-file limit.`)
    } else {
      setError('')
      setFiles((currentFiles) => [
        ...currentFiles,
        ...selectedFiles.filter(
          (file) =>
            !currentFiles.some(
              (existing) =>
                existing.name === file.name && existing.size === file.size,
            ),
        ),
      ])
    }
    event.target.value = ''
  }

  async function submitCase(event) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Enter a case name to continue.')
      return
    }

    try {
      const savedCase = caseItem
        ? await updateCase(caseItem.id, {
            title,
            matterType,
            parties,
            summary,
          })
        : await createCase({
            title,
            matterType,
            parties,
            summary,
            files,
          })
      resetForm()
      onCreated(savedCase)
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={submitCase}>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            pr: 7,
            pb: 1,
            color: '#303832',
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              width: 36,
              height: 36,
              placeItems: 'center',
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: '#e9f1e9',
            }}
          >
            <FolderOutlinedIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box>
            {caseItem ? 'Edit case' : 'New case'}
            <Typography sx={{ mt: 0.25, color: '#949b94', fontSize: 'caption.fontSize', fontWeight: 400 }}>
                {caseItem ? 'Update this case’s details.' : 'Start a private chat with its own files and notes.'}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close new case"
            onClick={handleClose}
            sx={{ position: 'absolute', top: 12, right: 12, color: '#858c85' }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: '12px !important' }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')} sx={{ fontSize: 'body2.fontSize' }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            required
            fullWidth
            label="Case name"
            placeholder="e.g. Acme lease review"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            size="small"
          />
          <TextField
            select
            fullWidth
            label="Matter type"
            value={matterType}
            onChange={(event) => setMatterType(event.target.value)}
            size="small"
          >
            {matterTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="People or organizations"
            placeholder="Names of clients, counterparties, or other parties"
            value={parties}
            onChange={(event) => setParties(event.target.value)}
            size="small"
          />
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Brief summary"
            placeholder="What would you like help with in this case?"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            size="small"
          />
          {!caseItem && <Box>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.html,.htm"
              onChange={handleFiles}
              style={{ display: 'none' }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              startIcon={<AttachFileOutlinedIcon />}
              variant="outlined"
              sx={{ borderColor: '#dfe6df', color: '#426c56', fontSize: 'body2.fontSize' }}
            >
              Add case documents
            </Button>
            <Typography sx={{ mt: 0.75, color: '#9ba19b', fontSize: 'caption.fontSize' }}>
              Files are stored in a public Supabase bucket. Anyone with a file link can access them.
            </Typography>
            <Typography sx={{ mt: 0.5, color: '#9ba19b', fontSize: 'caption.fontSize' }}>
              Supported: PDF, TXT, Markdown, CSV, and HTML. Scanned PDFs are processed with OCR.
            </Typography>
          </Box>}
          {!caseItem && files.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {files.map((file, index) => (
                <Box
                  key={`${file.name}-${file.size}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.75,
                    border: '1px solid #e8eae5',
                    borderRadius: 1.5,
                  }}
                >
                  <AttachFileOutlinedIcon sx={{ color: '#69806d', fontSize: 17 }} />
                  <Typography noWrap sx={{ minWidth: 0, flex: 1, color: '#59625b', fontSize: 'caption.fontSize' }}>
                    {file.name}
                  </Typography>
                  <Chip label={formatBytes(file.size)} size="small" sx={{ height: 20, fontSize: 'caption.fontSize' }} />
                  <IconButton
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index))}
                    size="small"
                    sx={{ color: '#a0a59f' }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0.5 }}>
          <Button onClick={handleClose} sx={{ color: '#727a73', fontSize: 'body2.fontSize' }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" sx={{ minWidth: 132, fontSize: 'body2.fontSize' }}>
            {caseItem ? 'Save changes' : 'Create case & open chat'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

export default NewCaseDialog
