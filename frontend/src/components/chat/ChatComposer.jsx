import { useRef, useState } from 'react'
import {
  Box,
  Chip,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import ChatComposerAttachments from './ChatComposerAttachments'
import ChatComposerRecordingBanner from './ChatComposerRecordingBanner'
import ChatComposerMenu from './ChatComposerMenu'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'

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
  const draftRef = useRef('')

  function updateDraft(value) {
    draftRef.current = value
    setDraft(value)
  }

  const {
    isListening,
    recordingSeconds,
    waveform,
    startTranscription,
    stopTranscription,
  } = useAudioRecorder({
    onFilesAdded,
    onAudioError,
    draftRef,
    updateDraft,
  })

  function handleFileSelection(event) {
    onFilesAdded(event.target.files)
    event.target.value = ''
  }

  function sendDraft() {
    const message = draft.trim()
    if (!message && (!stagedFiles || stagedFiles.length === 0)) return
    if (isListening) {
      stopTranscription()
    }
    updateDraft('')
    onSend(message)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendDraft()
    }
  }

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault()
        sendDraft()
      }}
      sx={{
        display: 'flex',
        width: 'min(100%, 820px)',
        flexDirection: 'column',
        alignItems: 'center',
        mt: 'auto',
        pt: 1.5,
        pb: 1.5,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          p: '14px 18px 12px',
          bgcolor: isDark ? '#1a241c' : '#ffffff',
          borderRadius: 3,
          border: '1px solid',
          borderColor: isDark ? '#364d3c' : '#d2dfd4',
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
        <ChatComposerAttachments
          stagedFiles={stagedFiles}
          onRemoveStagedFile={onRemoveStagedFile}
          isDark={isDark}
        />
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
          <ChatComposerRecordingBanner
            recordingSeconds={recordingSeconds}
            waveform={waveform}
            isDark={isDark}
          />
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
            <ChatComposerMenu
              menuAnchor={menuAnchor}
              onClose={() => setMenuAnchor(null)}
              onViewFiles={onViewFiles}
              attachmentCount={attachmentCount}
              onStartTranscription={startTranscription}
              onOpenCamera={onOpenCamera}
              onFilesSelected={handleFileSelection}
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
