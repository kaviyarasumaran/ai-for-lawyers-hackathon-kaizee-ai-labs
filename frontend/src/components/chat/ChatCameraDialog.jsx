import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'

function cameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Camera or microphone permission was denied. Allow access in your browser settings, then try again.'
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera or microphone was found on this device.'
  }
  if (error?.name === 'NotReadableError') {
    return 'The camera is already in use by another application.'
  }
  return 'Could not open the camera. Check browser permissions and try again.'
}

function ChatCameraDialog({ open, onClose, onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const recordingChunksRef = useRef([])
  const [cameraError, setCameraError] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    let isCurrent = true

    async function openCamera() {
      if (!open) return

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access requires a supported browser on HTTPS or localhost.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: true,
        })
        if (!isCurrent) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (error) {
        if (isCurrent) setCameraError(cameraErrorMessage(error))
      }
    }

    if (open) void openCamera()

    return () => {
      isCurrent = false
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [open])

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('The camera is not ready yet. Try again in a moment.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('Could not capture an image from the camera.')
        return
      }
      onCapture(
        new File([blob], `chat-photo-${new Date().toISOString().replaceAll(':', '-')}.jpg`, {
          type: 'image/jpeg',
        }),
      )
    }, 'image/jpeg', 0.9)
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream || !window.MediaRecorder) {
      setCameraError('Video recording is not supported by this browser.')
      return
    }

    try {
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(
        (type) => MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/webm'
        const extension = type.includes('mp4') ? 'mp4' : 'webm'
        const blob = new Blob(recordingChunksRef.current, { type })
        if (blob.size > 0) {
          onCapture(
            new File([blob], `chat-video-${new Date().toISOString().replaceAll(':', '-')}.${extension}`, {
              type,
            }),
          )
        }
        recordingChunksRef.current = []
        setIsRecording(false)
      }
      recorderRef.current = recorder
      recorder.start(500)
      setCameraError('')
      setIsRecording(true)
    } catch {
      setCameraError('Could not start recording on this device.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function handleClose() {
    if (recorderRef.current?.state === 'recording') stopRecording()
    setCameraError('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6, color: '#303832', fontSize: 16, fontWeight: 700 }}>
        <CameraAltOutlinedIcon sx={{ color: 'primary.main', fontSize: 19 }} />
        Capture for this chat
        <IconButton
          aria-label="Close camera"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 12, top: 12, color: '#858c85' }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {cameraError ? (
          <Alert severity="warning" sx={{ my: 1, fontSize: 'body2.fontSize' }}>
            {cameraError}
          </Alert>
        ) : (
          <>
            <Box
              component="video"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              sx={{
                display: 'block',
                width: '100%',
                maxHeight: '55vh',
                minHeight: 240,
                borderRadius: 2,
                bgcolor: '#1f2420',
                objectFit: 'contain',
              }}
            />
            <Typography sx={{ mt: 1, color: '#939a94', fontSize: 'caption.fontSize' }}>
              Camera access is requested only while this dialog is open. Images and videos stay in this chat.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          disabled={Boolean(cameraError) || isRecording}
          onClick={capturePhoto}
          startIcon={<CameraAltOutlinedIcon />}
          variant="outlined"
          sx={{ borderColor: '#dfe6df', color: '#426c56', fontSize: 'body2.fontSize' }}
        >
          Take photo
        </Button>
        {isRecording ? (
          <Button onClick={stopRecording} startIcon={<StopRoundedIcon />} color="error" variant="contained" sx={{ fontSize: 'body2.fontSize' }}>
            Stop video
          </Button>
        ) : (
          <Button
            disabled={Boolean(cameraError)}
            onClick={startRecording}
            startIcon={<VideocamOutlinedIcon />}
            variant="contained"
            sx={{ fontSize: 'body2.fontSize' }}
          >
            Record video
          </Button>
        )}
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#b44843' }}>
            <FiberManualRecordRoundedIcon sx={{ fontSize: 11 }} />
            <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 700 }}>Recording</Typography>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ChatCameraDialog
