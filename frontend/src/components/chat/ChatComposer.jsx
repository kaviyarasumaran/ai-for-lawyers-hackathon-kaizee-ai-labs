import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'

const WAVE_BAR_COUNT = 28

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getMediaType(item) {
  const type = (item?.type || '').toLowerCase()
  const name = (item?.name || '').toLowerCase()
  const ext = name.split('.').pop() || ''
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'heic', 'tiff', 'tif'].includes(ext)) {
    return 'image'
  }
  // Audio check: prioritize audio types and filenames (voice recordings, audio notes)
  const isAudio =
    type.startsWith('audio/') ||
    ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'weba'].includes(ext) ||
    (ext === 'webm' && (type.includes('audio') || name.includes('voice') || name.includes('audio') || !name.includes('video')))
  if (isAudio) {
    return 'audio'
  }
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'flv', 'm4v', 'webm'].includes(ext)) {
    return 'video'
  }
  return 'document'
}

function ChatComposer({
  onSend,
  onFilesAdded,
  onOpenCamera,
  onAudioError,
  disabled = false,
  stagedFiles = [],
  onRemoveStagedFile,
  attachmentCount = 0,
  onViewFiles,
}) {
  const isDark = useTheme().palette.mode === 'dark'
  const [draft, setDraft] = useState('')
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [waveform, setWaveform] = useState(() => Array(WAVE_BAR_COUNT).fill(4))

  const draftRef = useRef('')
  const recognitionRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const animationFrameRef = useRef(null)
  const transcriptPrefixRef = useRef('')
  const isMountedRef = useRef(false)
  const isListeningRef = useRef(false)
  const shouldRestartRef = useRef(false)
  const accumulatedTranscriptRef = useRef('')
  const hasTranscribedTextRef = useRef(false)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      isListeningRef.current = false
      shouldRestartRef.current = false
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      try {
        recognitionRef.current?.abort()
      } catch {
        // ignore
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      } catch {
        // ignore
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          void audioContextRef.current.close()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  function updateDraft(value) {
    draftRef.current = value
    setDraft(value)
  }

  function stopWaveform() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      clearInterval(animationFrameRef.current)
      animationFrameRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close()
      } catch {
        // ignore
      }
    }
    audioContextRef.current = null
    setWaveform(Array(WAVE_BAR_COUNT).fill(4))
  }

  function stopTranscription() {
    isListeningRef.current = false
    shouldRestartRef.current = false
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
    recognitionRef.current = null

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    } catch {
      // ignore
    }

    stopWaveform()
    setIsListening(false)
  }

  async function startTranscription() {
    if (isListeningRef.current) {
      stopTranscription()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onAudioError('Microphone access is not supported in this browser. Please use Google Chrome, Edge, or an HTTPS connection.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      isListeningRef.current = true
      shouldRestartRef.current = true
      hasTranscribedTextRef.current = false
      accumulatedTranscriptRef.current = ''
      transcriptPrefixRef.current = draftRef.current.trim() ? `${draftRef.current.trim()} ` : ''

      setRecordingSeconds(0)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1)
      }, 1000)

      if (animationFrameRef.current) clearInterval(animationFrameRef.current)
      animationFrameRef.current = setInterval(() => {
        if (!isListeningRef.current) return
        setWaveform(
          Array.from({ length: WAVE_BAR_COUNT }, () => Math.floor(Math.random() * 22) + 5),
        )
      }, 75)

      // 1. Audio recording capture via MediaRecorder (always creates an audio attachment on stop)
      recordedChunksRef.current = []
      if (typeof MediaRecorder !== 'undefined') {
        let mimeType = 'audio/webm'
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        }

        const recorder = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data)
          }
        }

        recorder.onstop = () => {
          if (recordedChunksRef.current.length > 0) {
            const actualMime = recorder.mimeType || mimeType
            const ext = actualMime.includes('mp4') ? 'mp4' : 'weba'
            const audioBlob = new Blob(recordedChunksRef.current, { type: actualMime })
            const voiceFile = new File([audioBlob], `voice_recording_${Date.now()}.${ext}`, { type: actualMime })
            onFilesAdded([voiceFile])
            if (!draftRef.current.trim()) {
              updateDraft('Please analyze this voice recording.')
            }
          }
          recordedChunksRef.current = []
        }

        recorder.start(250)
      }

      // 2. Parallel real-time text transcription (if Web Speech is supported)
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (Recognition) {
        try {
          const recognition = new Recognition()
          recognitionRef.current = recognition
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = navigator.language || 'en-US'

          recognition.onresult = (event) => {
            if (!isMountedRef.current || !isListeningRef.current) return
            let currentSessionFinal = ''
            let currentSessionInterim = ''

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
              const res = event.results[i]
              const transcript = res[0]?.transcript || ''
              if (res.isFinal) {
                currentSessionFinal += transcript + ' '
              } else {
                currentSessionInterim += transcript
              }
            }

            if (currentSessionFinal) {
              accumulatedTranscriptRef.current += currentSessionFinal
            }

            const combined = (
              transcriptPrefixRef.current +
              accumulatedTranscriptRef.current +
              currentSessionInterim
            ).replace(/\s+/g, ' ').trim()

            if (combined) {
              hasTranscribedTextRef.current = true
              updateDraft(combined)
            }
          }

          recognition.onerror = (event) => {
            console.debug('Speech recognition event:', event.error)
          }

          recognition.onend = () => {
            if (isMountedRef.current && isListeningRef.current && shouldRestartRef.current) {
              try {
                recognition.start()
              } catch {
                // ignore
              }
            }
          }

          recognition.start()
        } catch (recogErr) {
          console.debug('Speech recognition parallel start skipped:', recogErr)
        }
      }

      setIsListening(true)
    } catch (error) {
      stopWaveform()
      isListeningRef.current = false
      shouldRestartRef.current = false
      setIsListening(false)
      onAudioError(
        error?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow access in your browser settings and try again.'
          : 'Could not access the microphone. Check your device and browser permissions.',
      )
    }
  }

  function openFilePicker(inputId) {
    setMenuAnchor(null)
    document.getElementById(inputId)?.click()
  }

  function handleFileSelection(event) {
    onFilesAdded(event.target.files)
    event.target.value = ''
  }

  function sendDraft() {
    const message = draft.trim()
    if (!message && (!stagedFiles || stagedFiles.length === 0)) return

    const promptText = message || (stagedFiles.length > 0 ? `Please review the attached ${stagedFiles.map((f) => f.name).join(', ')}.` : '')
    onSend(promptText, stagedFiles)
    updateDraft('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendDraft()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendDraft()
    }
  }

  return (
    <Box sx={{ width: 'min(100%, 900px)', pb: { xs: 1.625, md: 2.625 } }}>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        variant="outlined"
        sx={{
          p: '11px 12px 9px 15px',
          borderColor: 'divider',
          borderRadius: 3,
          boxShadow: isDark ? '0 6px 24px rgba(0,0,0,.18)' : '0 6px 24px rgba(43,60,44,.045)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          '&:focus-within': {
            borderColor: isDark ? '#54745d' : '#b9cfbd',
            boxShadow: isDark
              ? '0 0 0 3px rgba(139,185,155,.12), 0 6px 24px rgba(0,0,0,.18)'
              : '0 0 0 3px rgba(54,117,77,.06), 0 6px 24px rgba(43,60,44,.045)',
          },
        }}
      >
        {stagedFiles && stagedFiles.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mb: 1.25,
              pt: 0.25,
            }}
          >
            {stagedFiles.map((file) => {
              const mediaType = getMediaType(file)
              return (
                <Box
                  key={file.id || file.name}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: '4px 8px',
                    borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#eef4ee',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#d5e2d5',
                    maxWidth: 240,
                  }}
                >
                  {file.isUploading ? (
                    <CircularProgress size={16} sx={{ color: 'primary.main', flex: 'none' }} />
                  ) : mediaType === 'image' && file.url ? (
                    <Box
                      component="img"
                      src={file.url}
                      alt={file.name}
                      sx={{ width: 28, height: 28, borderRadius: 1, objectFit: 'cover' }}
                    />
                  ) : mediaType === 'audio' ? (
                    <GraphicEqRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  ) : mediaType === 'video' ? (
                    <VideocamOutlinedIcon sx={{ fontSize: 18, color: '#3874cb' }} />
                  ) : file.name?.toLowerCase().endsWith('.pdf') ? (
                    <PictureAsPdfOutlinedIcon sx={{ fontSize: 18, color: '#b5685d' }} />
                  ) : (
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.primary' }}>
                      {file.name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                      {file.isUploading ? 'Uploading...' : formatBytes(file.size)}
                    </Typography>
                  </Box>
                  {onRemoveStagedFile && (
                    <IconButton
                      size="small"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => onRemoveStagedFile(file.id)}
                      sx={{ width: 20, height: 20, p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                    >
                      <CloseRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          disabled={disabled}
          placeholder="Ask a question or tell us what’s on your mind..."
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          value={draft}
          variant="standard"
          slotProps={{
            htmlInput: { 'aria-label': 'Ask a legal question' },
            input: {
              disableUnderline: true,
              sx: {
                color: 'text.primary',
                fontSize: 'body2.fontSize',
                lineHeight: 1.6,
                '& textarea::placeholder': { color: isDark ? '#87948a' : '#abb0aa', opacity: 1 },
                '& textarea:focus-visible': { outline: 'none' },
              },
            },
          }}
        />
        {isListening && (
          <Box
            aria-label="Live microphone waveform while transcribing"
            role="status"
            sx={{
              display: 'flex',
              minHeight: 38,
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              mb: 0.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isDark ? 'rgba(94, 152, 112, 0.35)' : 'rgba(94, 152, 112, 0.25)',
              bgcolor: isDark ? 'rgba(36, 50, 41, 0.85)' : '#f3f8f3',
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#e53935',
                boxShadow: '0 0 0 0 rgba(229, 57, 53, 0.7)',
                animation: 'pulseDot 1.5s infinite ease-in-out',
                '@keyframes pulseDot': {
                  '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(229, 57, 53, 0.7)' },
                  '70%': { transform: 'scale(1)', boxShadow: '0 0 0 6px rgba(229, 57, 53, 0)' },
                  '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(229, 57, 53, 0)' },
                },
                flex: 'none',
              }}
            />
            <Typography
              sx={{
                flex: 'none',
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: isDark ? '#b2d3ba' : '#336142',
              }}
            >
              {formatTimer(recordingSeconds)}
            </Typography>
            <Typography
              sx={{
                flex: 'none',
                display: { xs: 'none', sm: 'inline' },
                fontSize: 'caption.fontSize',
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
              · Listening...
            </Typography>
            <Box sx={{ display: 'flex', height: 26, flex: 1, alignItems: 'center', justifyContent: 'center', gap: '2px', overflow: 'hidden', px: 1 }}>
              {waveform.map((height, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 3,
                    height: `${height}px`,
                    flex: 'none',
                    borderRadius: 2,
                    bgcolor: '#5e9870',
                    opacity: 0.55 + Math.min(height / 50, 0.45),
                    transition: 'height 70ms ease',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', minHeight: 31, alignItems: 'center', justifyContent: 'space-between', gap: 1.25 }}>
          <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
            <ShieldOutlinedIcon sx={{ flex: 'none', color: 'primary.main', fontSize: 14 }} />
            <IconButton
              aria-label="Add files to this chat"
              aria-haspopup="menu"
              aria-expanded={Boolean(menuAnchor)}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
              sx={{
                width: 31,
                height: 31,
                mr: 0.5,
                border: '1px solid',
                borderColor: 'divider',
                color: 'primary.main',
                bgcolor: 'background.default',
                '&:hover': { bgcolor: isDark ? '#29372f' : '#eef4ed' },
              }}
            >
              <AddRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            {attachmentCount > 0 && onViewFiles && (
              <Tooltip title="View files in this chat">
                <Chip
                  icon={<FolderOpenOutlinedIcon sx={{ fontSize: '15px !important', color: 'primary.main' }} />}
                  label={`${attachmentCount} file${attachmentCount > 1 ? 's' : ''}`}
                  onClick={onViewFiles}
                  size="small"
                  variant="outlined"
                  sx={{
                    mr: 0.75,
                    height: 28,
                    fontSize: 'caption.fontSize',
                    fontWeight: 600,
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#d5e2d5',
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f4f8f4',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#eaf2ea',
                    },
                  }}
                />
              </Tooltip>
            )}
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              {onViewFiles && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null)
                    onViewFiles()
                  }}
                  sx={{ gap: 1, fontSize: 'body2.fontSize', borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <FolderOpenOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
                  Files in this chat ({attachmentCount || 0})
                </MenuItem>
              )}
              <MenuItem onClick={() => openFilePicker('chat-document-input')} sx={{ gap: 1, fontSize: 'body2.fontSize' }}>
                <AttachFileOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
                Upload files
              </MenuItem>
              <MenuItem onClick={() => openFilePicker('chat-media-input')} sx={{ gap: 1, fontSize: 'body2.fontSize' }}>
                <ImageOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
                Add photos, videos, or audio
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  void startTranscription()
                }}
                sx={{ gap: 1, fontSize: 'body2.fontSize' }}
              >
                <MicNoneRoundedIcon sx={{ color: '#64816a', fontSize: 18 }} />
                Live audio transcript
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null)
                  onOpenCamera()
                }}
                sx={{ gap: 1, fontSize: 'body2.fontSize' }}
              >
                <CameraAltOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
                Take photo or video
              </MenuItem>
            </Menu>
            <Box
              component="input"
              id="chat-document-input"
              type="file"
              multiple
              onChange={handleFileSelection}
              sx={{ display: 'none' }}
            />
            <Box
              component="input"
              id="chat-media-input"
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              onChange={handleFileSelection}
              sx={{ display: 'none' }}
            />
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 'caption.fontSize' }}>
              File links are public; avoid confidential documents
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
            <Tooltip title={isListening ? 'Stop voice input' : 'Voice typing'}>
              <IconButton
                aria-label={isListening ? 'Stop voice input' : 'Voice typing'}
                disabled={disabled}
                onClick={isListening ? stopTranscription : () => void startTranscription()}
                sx={{
                  width: 31,
                  height: 31,
                  borderRadius: 2,
                  color: isListening ? '#fff' : 'text.secondary',
                  bgcolor: isListening ? '#d32f2f' : 'transparent',
                  border: isListening ? 'none' : '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'divider',
                  '&:hover': {
                    bgcolor: isListening ? '#b71c1c' : (isDark ? 'rgba(255,255,255,0.08)' : '#eef4ed'),
                    color: isListening ? '#fff' : 'primary.main',
                  },
                }}
              >
                {isListening ? (
                  <StopRoundedIcon sx={{ fontSize: 18 }} />
                ) : (
                  <MicNoneRoundedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>
            <IconButton
              aria-label="Send message"
              disabled={(!draft.trim() && (!stagedFiles || stagedFiles.length === 0)) || disabled}
              type="submit"
              sx={{
                width: 31,
                height: 31,
                borderRadius: 2,
                color: '#fff',
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { color: '#fff', bgcolor: 'primary.main', opacity: 0.42 },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>
        </Box>
      </Paper>
      <Typography
        sx={{
          mt: 1.25,
          color: 'text.secondary',
          textAlign: 'center',
          fontSize: 'caption.fontSize',
          lineHeight: 1.5,
        }}
      >
        Counsel can help you get oriented, but it isn’t a substitute for advice
        from a qualified lawyer.
      </Typography>
    </Box>
  )
}

export default ChatComposer
