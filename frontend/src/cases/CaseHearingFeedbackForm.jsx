import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'

function CaseHearingFeedbackForm({
  defaultDate,
  defaultStage,
  courtNumber,
  judge,
  onSubmitHearing,
  isSubmitting,
  submitError,
}) {
  const [hearingDate, setHearingDate] = useState(defaultDate || '')
  const [stage, setStage] = useState(defaultStage || '')
  const [argumentsText, setArgumentsText] = useState('')
  const [observations, setObservations] = useState('')
  const [outcome, setOutcome] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [localError, setLocalError] = useState('')

  function toggleVoiceRecording() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      setLocalError('Speech recognition is not supported in this browser. Please type argument notes.')
      return
    }

    if (isRecording) {
      setIsRecording(false)
      return
    }

    try {
      const recognition = new SpeechRec()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-IN'

      recognition.onstart = () => setIsRecording(true)
      recognition.onerror = () => setIsRecording(false)
      recognition.onend = () => setIsRecording(false)

      recognition.onresult = (event) => {
        let currentTranscript = ''
        for (let i = 0; i < event.results.length; i += 1) {
          currentTranscript += event.results[i][0].transcript
        }
        setArgumentsText((prev) => {
          const base = prev.trim()
          return base ? `${base} ${currentTranscript.trim()}` : currentTranscript.trim()
        })
      }

      recognition.start()
    } catch {
      setIsRecording(false)
      setLocalError('Could not start microphone recording.')
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!hearingDate.trim() || !argumentsText.trim()) {
      setLocalError('Hearing date and argument feedback notes are required.')
      return
    }
    setLocalError('')
    onSubmitHearing({
      date: hearingDate.trim(),
      courtNumber: courtNumber || '',
      judge: judge || '',
      stage: stage.trim(),
      arguments: argumentsText.trim(),
      observations: observations.trim(),
      outcome: outcome.trim(),
      nextDate: nextDate.trim(),
      audioTranscribed: Boolean(isRecording || argumentsText),
    })
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 1.5,
        mt: 1,
        mb: 1.5,
        borderRadius: 2,
        bgcolor: '#f8faf7',
        border: '1px solid #e2e8e0',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 700, color: '#3e4941' }}>
        Log Courtroom Arguments & Feedback
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        <TextField
          label="Hearing Date"
          size="small"
          value={hearingDate}
          onChange={(e) => setHearingDate(e.target.value)}
          placeholder="DD-MM-YYYY"
          required
          sx={{ '& input': { fontSize: 'caption.fontSize' } }}
        />
        <TextField
          label="Listing Stage"
          size="small"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          placeholder="e.g. For Admission"
          sx={{ '& input': { fontSize: 'caption.fontSize' } }}
        />
      </Box>

      {/* Argument Notes with Voice Button */}
      <Box sx={{ position: 'relative' }}>
        <TextField
          label="Arguments Submitted & Oral Points"
          size="small"
          multiline
          rows={3}
          fullWidth
          value={argumentsText}
          onChange={(e) => setArgumentsText(e.target.value)}
          placeholder="Type or click the microphone to dictate argument points, citations submitted, and bench questions..."
          required
          sx={{ '& textarea': { fontSize: 'caption.fontSize', pr: 4 } }}
        />
        <Tooltip title={isRecording ? 'Stop Recording' : 'Voice Record Arguments'}>
          <IconButton
            size="small"
            onClick={toggleVoiceRecording}
            sx={{
              position: 'absolute',
              right: 6,
              bottom: 6,
              color: isRecording ? 'error.main' : '#4e7957',
              bgcolor: isRecording ? '#fdeeee' : '#eaf2e9',
            }}
          >
            {isRecording ? <MicRoundedIcon fontSize="small" /> : <MicNoneRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <TextField
        label="Court Directions & Bench Observations"
        size="small"
        multiline
        rows={2}
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        placeholder="e.g. Counter directed to be filed within 2 weeks; private notice permitted..."
        sx={{ '& textarea': { fontSize: 'caption.fontSize' } }}
      />

      <TextField
        label="Orders Passed & Outcome"
        size="small"
        multiline
        rows={2}
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        placeholder="e.g. Interim stay extended; notice of motion ordered returnable..."
        sx={{ '& textarea': { fontSize: 'caption.fontSize' } }}
      />

      <TextField
        label="Next Hearing Date"
        size="small"
        value={nextDate}
        onChange={(e) => setNextDate(e.target.value)}
        placeholder="DD-MM-YYYY or Notice Returnable"
        sx={{ '& input': { fontSize: 'caption.fontSize' } }}
      />

      {(localError || submitError) && (
        <Alert severity="error" sx={{ fontSize: 'caption.fontSize' }}>
          {localError || submitError}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        disabled={isSubmitting}
        startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineRoundedIcon />}
        sx={{
          textTransform: 'none',
          fontSize: 'caption.fontSize',
          fontWeight: 600,
          bgcolor: '#4e7957',
          '&:hover': { bgcolor: '#3e6446' },
        }}
      >
        {isSubmitting ? 'Ingesting to Case KB...' : 'Save & Update Case AI KB'}
      </Button>
    </Box>
  )
}

export default CaseHearingFeedbackForm
