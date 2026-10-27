import { useEffect, useRef, useState } from 'react'

export const WAVE_BAR_COUNT = 28

export function useAudioRecorder({ onFilesAdded, onAudioError, draftRef, updateDraft }) {
  const [isListening, setIsListening] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [waveform, setWaveform] = useState(() => Array(WAVE_BAR_COUNT).fill(4))

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

      // 2. Speech-to-text recognition via Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
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

  return {
    isListening,
    recordingSeconds,
    waveform,
    startTranscription,
    stopTranscription,
  }
}
