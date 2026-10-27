import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Pagination,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useKnowledgeBase } from '../knowledge-base/useKnowledgeBase'
import { useNavigate } from '@tanstack/react-router'
import { getKnowledgeBaseDocument, uploadKnowledgeBaseDocument } from '../api/files'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 150
const DOCUMENTS_PER_PAGE = 5
const SUPPORTED_TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'html'])
const SUPPORTED_DOC_EXTENSIONS = new Set(['pdf', 'doc', 'docx'])
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'bmp', 'heic'])
const SUPPORTED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'webm', 'weba'])
const SUPPORTED_EXTENSIONS = new Set([
  ...SUPPORTED_TEXT_EXTENSIONS,
  ...SUPPORTED_DOC_EXTENSIONS,
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
])

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function splitIntoChunks(text) {
  const cleanedText = text.trim()
  if (!cleanedText) return []

  const chunks = []
  let start = 0

  while (start < cleanedText.length) {
    let end = Math.min(start + CHUNK_SIZE, cleanedText.length)
    if (end < cleanedText.length) {
      const boundary = cleanedText.lastIndexOf(' ', end)
      if (boundary > start + CHUNK_SIZE * 0.6) end = boundary
    }

    const content = cleanedText.slice(start, end).trim()
    if (content) chunks.push(content)
    if (end >= cleanedText.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks
}

async function extractPdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
    onProgress(Math.round((pageNumber / pdf.numPages) * 35))
  }

  return pages.join('\n\n')
}

async function extractText(file, onProgress) {
  if (getExtension(file.name) === 'pdf') {
    return extractPdfText(file, onProgress)
  }

  onProgress(20)
  return file.text()
}

function DocumentStatus({ status, progress, error }) {
  const statusLabels = {
    queued: 'Queued',
    processing: 'Processing',
    extracting: 'Extracting / OCR',
    chunking: 'Chunking & Embedding',
    embedding: 'Chunking & Embedding',
    ready: 'Ready',
    completed: 'Ready',
    stored: 'Indexed',
    error: 'Failed',
    failed: 'Failed',
  }
  const statusColors = {
    queued: 'default',
    processing: 'info',
    extracting: 'info',
    chunking: 'warning',
    embedding: 'warning',
    ready: 'success',
    completed: 'success',
    stored: 'success',
    error: 'error',
    failed: 'error',
  }

  const isComplete = ['ready', 'completed', 'stored'].includes(status)
  const isFailed = ['error', 'failed'].includes(status)
  const isRunning = ['queued', 'processing', 'extracting', 'chunking', 'embedding'].includes(status)

  const progressPercent = typeof progress === 'number' ? Math.round(progress) : 0
  const displayLabel = statusLabels[status] || (status ? status.toUpperCase() : 'Processing')
  const chipLabel = isRunning && progressPercent > 0 ? `${displayLabel} (${progressPercent}%)` : displayLabel

  return (
    <Box sx={{ minWidth: 120 }}>
      <Chip
        icon={isComplete ? <CheckCircleOutlineRoundedIcon /> : undefined}
        label={chipLabel}
        size="small"
        color={statusColors[status] || 'default'}
        variant={isComplete ? 'outlined' : 'filled'}
        sx={{
          height: 25,
          fontSize: 'caption.fontSize',
          fontWeight: 600,
          '& .MuiChip-icon': { fontSize: 14 },
        }}
      />
      {isRunning && (
        <LinearProgress
          aria-label={`${displayLabel} progress`}
          variant={progressPercent > 0 ? 'determinate' : 'indeterminate'}
          value={progressPercent}
          sx={{ mt: 0.75, height: 4, borderRadius: 5 }}
        />
      )}
      {isFailed && error && (
        <Typography
          title={error}
          noWrap
          sx={{ mt: 0.5, maxWidth: 140, color: 'error.main', fontSize: 'caption.fontSize' }}
        >
          {error}
        </Typography>
      )}
    </Box>
  )
}

function MetricCard({ icon, label, value, detail, tone }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        minWidth: 0,
        alignItems: 'center',
        gap: 1.5,
        p: { xs: 1.75, sm: 2.25 },
        borderColor: '#e8eae5',
        borderRadius: 2.5,
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          width: 40,
          height: 40,
          flex: 'none',
          placeItems: 'center',
          borderRadius: 2.25,
          color: tone,
          bgcolor: `${tone}14`,
          '& .MuiSvgIcon-root': { fontSize: 21 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: '#929992', fontSize: 'caption.fontSize', fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography sx={{ mt: 0.125, color: '#2f3831', fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography noWrap sx={{ mt: 0.25, color: '#a0a59f', fontSize: 'caption.fontSize' }}>
          {detail}
        </Typography>
      </Box>
    </Paper>
  )
}

function KnowledgeBasePage() {
  const navigate = useNavigate()
  const {
    folders,
    documents,
    storageError,
    clearStorageError,
    refreshDocuments,
    addFolder,
    addDocuments,
    updateDocument,
    removeDocument,
  } = useKnowledgeBase()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderError, setFolderError] = useState('')
  const [search, setSearch] = useState('')
  const [documentPage, setDocumentPage] = useState(1)
  const [expandedDocumentIds, setExpandedDocumentIds] = useState([])
  const [notice, setNotice] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const activeFolder = folders.find((folder) => folder.id === selectedFolderId)

  const hasActiveTasks = documents.some((doc) =>
    ['queued', 'processing', 'extracting', 'chunking', 'embedding'].includes(doc.status),
  )

  useEffect(() => {
    if (!hasActiveTasks) return

    const interval = setInterval(() => {
      refreshDocuments()
    }, 1500)

    return () => clearInterval(interval)
  }, [hasActiveTasks, refreshDocuments])

  const visibleDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return documents.filter((document) => {
      const matchesFolder =
        selectedFolderId === null || document.folderId === selectedFolderId
      const matchesSearch =
        normalizedSearch.length === 0 ||
        document.name.toLowerCase().includes(normalizedSearch)
      return matchesFolder && matchesSearch
    })
  }, [documents, search, selectedFolderId])
  const pageCount = Math.max(1, Math.ceil(visibleDocuments.length / DOCUMENTS_PER_PAGE))
  const currentDocumentPage = Math.min(documentPage, pageCount)
  const pagedDocuments = visibleDocuments.slice(
    (currentDocumentPage - 1) * DOCUMENTS_PER_PAGE,
    currentDocumentPage * DOCUMENTS_PER_PAGE,
  )

  const activeTasks = documents.filter((document) =>
    ['queued', 'processing', 'extracting', 'chunking', 'embedding'].includes(document.status),
  ).length
  const readyDocuments = documents.filter(
    (document) => ['ready', 'completed', 'stored'].includes(document.status),
  ).length
  const totalChunks = documents.reduce(
    (total, document) => total + (document.chunks?.length ?? document.chunkCount ?? 0),
    0,
  )

  function createFolder(event) {
    event.preventDefault()
    const trimmedName = folderName.trim()

    if (!trimmedName) {
      setFolderError('Enter a name for the folder.')
      return
    }

    if (folders.some((folder) => folder.name.toLowerCase() === trimmedName.toLowerCase())) {
      setFolderError('A folder with this name already exists.')
      return
    }

    const folder = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
    }
    addFolder(folder)
    setSelectedFolderId(folder.id)
    setFolderName('')
    setFolderError('')
    setFolderDialogOpen(false)
  }

  async function processDocument(documentId, file, storageId) {
    const ext = getExtension(file.name)
    const isImageOrAudio =
      SUPPORTED_IMAGE_EXTENSIONS.has(ext) ||
      SUPPORTED_AUDIO_EXTENSIONS.has(ext) ||
      ext === 'docx' ||
      ext === 'doc'

    // Fast client-side text preview for non-binary formats
    if (!isImageOrAudio) {
      try {
        updateDocument(documentId, { status: 'extracting', progress: 15 })
        const text = await extractText(file, (progress) => {
          updateDocument(documentId, {
            status: 'extracting',
            progress: Math.min(40, progress),
          })
        })
        if (text && text.trim()) {
          const previewChunks = splitIntoChunks(text.trim())
          if (previewChunks.length > 0) {
            updateDocument(documentId, {
              status: 'chunking',
              progress: 55,
              chunkCount: previewChunks.length,
              chunks: previewChunks.map((content, index) => ({
                id: `${documentId}-${index + 1}`,
                index: index + 1,
                content,
                characters: content.length,
              })),
            })
          }
        }
      } catch {
        // Continue to server polling
      }
    }

    // Poll backend OCR, chunking & pgvector extraction pipeline
    const targetId = storageId || documentId
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      try {
        const doc = await getKnowledgeBaseDocument(targetId)
        if (doc) {
          if (doc.status === 'ready' || (Array.isArray(doc.chunks) && doc.chunks.length > 0 && doc.status !== 'chunking' && doc.status !== 'extracting')) {
            updateDocument(documentId, {
              status: 'ready',
              progress: 100,
              chunks: Array.isArray(doc.chunks) ? doc.chunks : [],
              chunkCount: doc.chunkCount ?? (Array.isArray(doc.chunks) ? doc.chunks.length : 0),
              error: '',
            })
            break
          } else if (doc.status === 'error' || doc.status === 'failed') {
            updateDocument(documentId, {
              status: 'error',
              progress: 0,
              error: doc.error || 'Extraction failed.',
            })
            break
          } else if (doc.status) {
            // Real-time live poll status update displayed in table
            updateDocument(documentId, {
              status: doc.status,
              progress: doc.progress ?? 0,
              chunkCount: doc.chunkCount ?? 0,
              pageCount: doc.pageCount ?? 0,
              error: '',
            })
          }
        }
      } catch {
        // Continue polling
      }
    }
  }

  function uploadFiles(fileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    if (!activeFolder) {
      setNotice('Choose a folder before uploading documents.')
      return
    }

    const accepted = []
    const rejected = []

    for (const file of files) {
      const extension = getExtension(file.name)
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push(`${file.name}: unsupported file type`)
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: file is larger than 20 MB`)
      } else {
        accepted.push(file)
      }
    }

    if (rejected.length > 0) {
      setNotice(
        `${rejected.join('; ')}. Supported formats: PDF, DOCX, Images, Audio, TXT, MD, CSV, JSON, HTML.`,
      )
    }

    const newDocuments = accepted.map((file) => {
      const docId = crypto.randomUUID()
      return {
        id: docId,
        storageId: docId,
        name: file.name,
        extension: getExtension(file.name),
        size: file.size,
        folderId: activeFolder.id,
        status: 'queued',
        progress: 0,
        chunks: [],
        chunkCount: 0,
        uploadedAt: new Date().toISOString(),
        error: '',
      }
    })

    if (newDocuments.length > 0) {
      addDocuments(newDocuments)
      newDocuments.forEach(async (document, index) => {
        const file = accepted[index]
        try {
          const storedDocument = await uploadKnowledgeBaseDocument(file, activeFolder)
          updateDocument(document.id, {
            ...storedDocument,
            id: storedDocument.id,
            storageId: storedDocument.id,
            extension: document.extension,
            status: storedDocument.status || 'queued',
            progress: storedDocument.status === 'ready' ? 100 : (storedDocument.progress || 0),
            chunks: Array.isArray(storedDocument.chunks) ? storedDocument.chunks : [],
            chunkCount: storedDocument.chunkCount || 0,
            error: '',
          })
          await processDocument(storedDocument.id, file, storedDocument.id)
        } catch (error) {
          updateDocument(document.id, {
            status: 'error',
            progress: 0,
            error: error.message,
          })
          setNotice(`${file.name}: ${error.message}`)
        }
      })
    }
  }

  async function handleRemoveDocument(documentId) {
    try {
      await removeDocument(documentId)
    } catch (error) {
      setNotice(error.message)
    }
  }

  function onFilesSelected(event) {
    uploadFiles(event.target.files)
    event.target.value = ''
  }

  function onDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    uploadFiles(event.dataTransfer.files)
  }

  function toggleExpanded(documentId) {
    setExpandedDocumentIds((currentIds) =>
      currentIds.includes(documentId)
        ? currentIds.filter((id) => id !== documentId)
        : [...currentIds, documentId],
    )
  }

  const rowGrid = {
    display: 'grid',
    gridTemplateColumns: {
      xs: 'minmax(0, 1fr) auto auto',
      md: 'minmax(190px, 2fr) minmax(90px, 1fr) minmax(65px, .7fr) minmax(62px, .55fr) minmax(118px, 1fr) 72px',
    },
    alignItems: 'center',
    gap: { xs: 1, md: 2 },
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbfbf9' }}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={() => {
          setIsSidebarOpen(false)
          navigate({ to: '/' })
        }}
      />
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          flexDirection: 'column',
          px: { xs: 2, sm: 3, lg: 5 },
          pb: 4,
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            minHeight: { xs: 62, md: 73 },
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid #efefeb',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, ml: -0.75, color: '#777f78' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>Knowledge Base</Typography>
            <ChevronRightRoundedIcon sx={{ color: '#bbc0b9', fontSize: 16 }} />
            <Typography sx={{ color: '#919891', fontSize: 'body2.fontSize' }}>
              {activeFolder?.name ?? 'All documents'}
            </Typography>
          </Box>
          <Chip
            icon={<CheckCircleOutlineRoundedIcon />}
            label="Public file links"
            size="small"
            variant="outlined"
            sx={{
              height: 27,
              ml: 'auto',
              borderColor: '#e4eae2',
              color: '#64816a',
              fontSize: 'caption.fontSize',
              '& .MuiChip-icon': { fontSize: 14, color: 'inherit' },
            }}
          />
        </Box>

        <Box sx={{ width: '100%', maxWidth: 1240, mx: 'auto', pt: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              mb: 3,
            }}
          >
            <Box>
              <Typography component="h1" sx={{ color: '#27312b', fontFamily: 'Manrope, sans-serif', fontSize: { xs: 25, md: 30 }, fontWeight: 700, letterSpacing: '-1px' }}>
                Knowledge Base
              </Typography>
              <Typography sx={{ mt: 0.75, color: '#858c85', fontSize: 'body2.fontSize' }}>
                Organize documents and extract content via OCR, vector embeddings, and full-text indexing for AI search.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Button
                onClick={() => setFolderDialogOpen(true)}
                startIcon={<CreateNewFolderOutlinedIcon />}
                variant="outlined"
                sx={{ minHeight: 39, borderColor: '#dfe6df', color: '#426c56', fontSize: 'body2.fontSize' }}
              >
                New folder
              </Button>
              <Button
                onClick={() => refreshDocuments()}
                startIcon={<RefreshRoundedIcon />}
                variant="outlined"
                sx={{ minHeight: 39, borderColor: '#dfe6df', color: '#526255', fontSize: 'body2.fontSize' }}
              >
                Refresh
              </Button>
              <Button
                disabled={!activeFolder}
                onClick={() => fileInputRef.current?.click()}
                startIcon={<UploadFileOutlinedIcon />}
                variant="contained"
                sx={{ minHeight: 39, px: 1.75, fontSize: 'body2.fontSize' }}
              >
                Upload documents
              </Button>
              <Box
                component="input"
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.json,.html,.doc,.docx,.png,.jpg,.jpeg,.webp,.tiff,.tif,.bmp,.heic,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,.weba"
                onChange={onFilesSelected}
                sx={{ display: 'none' }}
              />
            </Box>
          </Box>

          {storageError && (
            <Alert severity="error" onClose={clearStorageError} sx={{ mb: 2 }}>
              Could not load stored documents: {storageError}
            </Alert>
          )}
          <Alert severity="warning" sx={{ mb: 2, fontSize: 'caption.fontSize' }}>
            Files use a public Supabase bucket. Anyone with a file link can access it; do not upload confidential material.
          </Alert>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
              mb: 3,
            }}
          >
            <MetricCard
              icon={<FolderOutlinedIcon />}
              label="FOLDERS"
              value={folders.length}
              detail="Organized collections"
              tone="#64816a"
            />
            <MetricCard
              icon={<ArticleOutlinedIcon />}
              label="READY DOCUMENTS"
              value={readyDocuments}
              detail={`${documents.length} total uploaded`}
              tone="#5c7891"
            />
            <MetricCard
              icon={<CheckCircleOutlineRoundedIcon />}
              label="TEXT CHUNKS"
              value={totalChunks.toLocaleString()}
              detail={activeTasks > 0 ? `${activeTasks} background task${activeTasks === 1 ? '' : 's'} running`               : 'Generated in this browser session'}
              tone={activeTasks > 0 ? '#b18a48' : '#8572a0'}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '224px minmax(0, 1fr)' },
              alignItems: 'stretch',
              minHeight: { xs: 420, md: 560 },
              gap: 2,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ display: 'flex', height: '100%', minHeight: 0, boxSizing: 'border-box', flexDirection: 'column', p: 1.5, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
            >
              <Typography sx={{ px: 1, py: 0.75, color: '#989e98', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 1 }}>
                LIBRARY
              </Typography>
              <Button
                fullWidth
                onClick={() => {
                  setSelectedFolderId(null)
                  setDocumentPage(1)
                }}
                startIcon={<ArticleOutlinedIcon />}
                sx={{
                  minHeight: 38,
                  justifyContent: 'flex-start',
                  px: 1.25,
                  borderRadius: 1.75,
                  color: selectedFolderId === null ? '#265f4b' : '#717871',
                  bgcolor: selectedFolderId === null ? '#e9f0e9' : 'transparent',
                  fontSize: 'body2.fontSize',
                  '&:hover': { bgcolor: '#f1f4ef' },
                  '& .MuiButton-startIcon': { mr: 1 },
                }}
              >
                All documents
                <Typography component="span" sx={{ ml: 'auto', color: '#969e96', fontSize: 'caption.fontSize' }}>
                  {documents.length}
                </Typography>
              </Button>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5 }}>
                <Typography sx={{ color: '#989e98', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 1 }}>
                  FOLDERS
                </Typography>
                <IconButton
                  aria-label="Create folder"
                  onClick={() => setFolderDialogOpen(true)}
                  size="small"
                  sx={{ width: 25, height: 25, color: '#64816a' }}
                >
                  <AddRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Box>
              <Box sx={{ minHeight: 0, flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                {folders.length === 0 ? (
                  <Typography sx={{ px: 1, py: 1, color: '#9ba09b', fontSize: 'caption.fontSize', lineHeight: 1.6 }}>
                    Create a folder to organize your documents.
                  </Typography>
                ) : (
                  folders.map((folder) => {
                  const folderDocumentCount = documents.filter(
                    (document) => document.folderId === folder.id,
                  ).length
                  return (
                    <Button
                      key={folder.id}
                      fullWidth
                      onClick={() => {
                        setSelectedFolderId(folder.id)
                        setDocumentPage(1)
                      }}
                      startIcon={<FolderOutlinedIcon />}
                      sx={{
                        minHeight: 38,
                        justifyContent: 'flex-start',
                        px: 1.25,
                        borderRadius: 1.75,
                        color: selectedFolderId === folder.id ? '#265f4b' : '#717871',
                        bgcolor: selectedFolderId === folder.id ? '#e9f0e9' : 'transparent',
                        fontSize: 'body2.fontSize',
                        '&:hover': { bgcolor: '#f1f4ef' },
                        '& .MuiButton-startIcon': { mr: 1 },
                      }}
                    >
                      <Typography noWrap component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {folder.name}
                      </Typography>
                      <Typography component="span" sx={{ ml: 'auto', color: '#969e96', fontSize: 'caption.fontSize' }}>
                        {folderDocumentCount}
                      </Typography>
                    </Button>
                  )
                  })
                )}
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                display: 'flex',
                height: '100%',
                boxSizing: 'border-box',
                flexDirection: 'column',
                minWidth: 0,
                borderColor: '#e8eae5',
                borderRadius: 2.5,
                boxShadow: 'none',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 1.5,
                  flexDirection: { xs: 'column', sm: 'row' },
                  p: 2,
                  borderBottom: '1px solid #eff0ec',
                }}
              >
                <Box>
                  <Typography sx={{ color: '#303832', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                    {activeFolder?.name ?? 'All documents'}
                  </Typography>
                  <Typography sx={{ mt: 0.25, color: '#969d96', fontSize: 'caption.fontSize' }}>
                    {visibleDocuments.length} document{visibleDocuments.length === 1 ? '' : 's'}
                    {activeFolder ? ' in this folder' : ' across your library'}
                  </Typography>
                </Box>
                <TextField
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setDocumentPage(1)
                  }}
                  placeholder="Search documents"
                  size="small"
                  sx={{
                    width: { xs: '100%', sm: 210 },
                    '& .MuiInputBase-root': { height: 35, fontSize: 'body2.fontSize', bgcolor: '#fff' },
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon sx={{ color: '#9ba19b', fontSize: 17 }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>

              {activeTasks > 0 && (
                <Alert
                  icon={<UploadFileOutlinedIcon sx={{ fontSize: 17 }} />}
                  severity="info"
                  sx={{
                    mx: 2,
                    mt: 1.5,
                    py: 0,
                    border: '1px solid #e0eaf1',
                    bgcolor: '#f5f9fb',
                    color: '#536d7c',
                    '& .MuiAlert-message': { fontSize: 'caption.fontSize' },
                  }}
                >
                  {activeTasks} document{activeTasks === 1 ? '' : 's'} being processed in the background. You can keep working.
                </Alert>
              )}

              <Box
                sx={{
                  display: { xs: 'none', md: 'grid' },
                  ...rowGrid,
                  px: 2,
                  py: 1.25,
                  bgcolor: '#fafbf9',
                  borderBottom: '1px solid #eff0ec',
                }}
              >
                {['DOCUMENT', 'FOLDER', 'SIZE', 'CHUNKS', 'STATUS', ''].map((heading) => (
                  <Typography key={heading} sx={{ color: '#a0a59f', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 0.8 }}>
                    {heading}
                  </Typography>
                ))}
              </Box>

              {visibleDocuments.length === 0 ? (
                <Box
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (event.currentTarget === event.target) setIsDragging(false)
                  }}
                  onDrop={onDrop}
                  sx={{
                    display: 'flex',
                    minHeight: 260,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    px: 2,
                    py: 4,
                    textAlign: 'center',
                    bgcolor: isDragging ? '#f2f7f2' : 'transparent',
                    outline: isDragging ? '2px dashed #83a38a' : 'none',
                    outlineOffset: -10,
                  }}
                >
                  <Box sx={{ display: 'grid', width: 48, height: 48, placeItems: 'center', mb: 1.5, borderRadius: 3, color: '#64816a', bgcolor: '#eef4ed' }}>
                    {activeFolder ? <UploadFileOutlinedIcon /> : <FolderOutlinedIcon />}
                  </Box>
                  <Typography sx={{ color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                    {search ? 'No matching documents' : activeFolder ? 'Your folder is ready' : 'Your knowledge base starts here'}
                  </Typography>
                  <Typography sx={{ maxWidth: 390, mt: 0.75, color: '#929992', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
                    {search
                      ? 'Try a different search or clear the search field.'
                      : activeFolder
                        ? 'Drop files here or upload PDF, TXT, Markdown, CSV, JSON, and HTML documents. Files are extracted and chunked in this browser session.'
                        : 'Create or select a folder to store legal documents in Supabase. Text extraction runs in this browser.'}
                  </Typography>
                  {activeFolder ? (
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      startIcon={<UploadFileOutlinedIcon />}
                      variant="contained"
                      sx={{ mt: 2, fontSize: 'caption.fontSize' }}
                    >
                      Choose files
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setFolderDialogOpen(true)}
                      startIcon={<CreateNewFolderOutlinedIcon />}
                      variant="outlined"
                      sx={{ mt: 2, borderColor: '#dfe6df', color: '#426c56', fontSize: 'caption.fontSize' }}
                    >
                      Create your first folder
                    </Button>
                  )}
                </Box>
              ) : (
                pagedDocuments.map((document) => {
                  const folderName =
                    folders.find((folder) => folder.id === document.folderId)?.name ??
                    document.folderName ??
                    'Folder'
                  const isExpanded = expandedDocumentIds.includes(document.id)
                  const FileIcon =
                    document.extension === 'pdf'
                      ? PictureAsPdfOutlinedIcon
                      : InsertDriveFileOutlinedIcon
                  return (
                    <Box key={document.id}>
                      <Box
                        sx={{
                          ...rowGrid,
                          px: 2,
                          py: 1.5,
                          borderBottom: '1px solid #f0f1ed',
                          '&:hover': { bgcolor: '#fcfdfa' },
                        }}
                      >
                        <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'grid', width: 33, height: 33, flex: 'none', placeItems: 'center', borderRadius: 1.75, color: document.extension === 'pdf' ? '#b5685d' : '#64816a', bgcolor: document.extension === 'pdf' ? '#fbefed' : '#eef4ed' }}>
                            <FileIcon sx={{ fontSize: 18 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ color: '#3d463f', fontSize: 'caption.fontSize', fontWeight: 600 }}>
                              {document.name}
                            </Typography>
                            <Typography sx={{ mt: 0.25, color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                              {formatBytes(document.size)} · {
                                ['ready', 'completed', 'stored'].includes(document.status)
                                  ? `${document.chunks?.length ?? document.chunkCount ?? 0} chunks`
                                  : ['failed', 'error'].includes(document.status)
                                    ? 'Extraction failed'
                                    : (document.chunkCount || document.chunks?.length)
                                      ? `Indexing ${document.chunkCount || document.chunks?.length} chunks`
                                      : 'Preparing chunks'
                              }
                            </Typography>
                          </Box>
                        </Box>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#737b74', fontSize: 'caption.fontSize' }}>
                          {folderName}
                        </Typography>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#858c85', fontSize: 'caption.fontSize' }}>
                          {formatBytes(document.size)}
                        </Typography>
                        <Typography sx={{ display: { xs: 'none', md: 'block' }, color: '#64816a', fontSize: 'caption.fontSize', fontWeight: 600 }}>
                          {['ready', 'completed', 'stored'].includes(document.status)
                            ? (document.chunks?.length ?? document.chunkCount ?? 0)
                            : (document.chunkCount || document.chunks?.length
                                ? `${document.chunkCount || document.chunks?.length} (indexing)`
                                : '—')}
                        </Typography>
                        <DocumentStatus
                          status={document.status}
                          progress={document.progress}
                          error={document.error}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {document.url && (
                            <IconButton
                              component="a"
                              href={document.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${document.name}`}
                              size="small"
                              sx={{ color: '#6c8170' }}
                            >
                              <OpenInNewRoundedIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          )}
                          {['ready', 'completed', 'stored'].includes(document.status) && document.chunks.length > 0 && (
                            <IconButton
                              aria-label={`${isExpanded ? 'Hide' : 'Show'} chunks for ${document.name}`}
                              onClick={() => toggleExpanded(document.id)}
                              size="small"
                              sx={{ color: '#7f897f' }}
                            >
                              <ExpandMoreRoundedIcon
                                sx={{
                                  fontSize: 19,
                                  transform: isExpanded ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 150ms ease',
                                }}
                              />
                            </IconButton>
                          )}
                          <IconButton
                            aria-label={`Remove ${document.name}`}
                            onClick={() => handleRemoveDocument(document.id)}
                            size="small"
                            sx={{ color: '#a2a7a1' }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Box>
                      </Box>
                      {isExpanded && document.chunks.length > 0 && (
                        <Box sx={{ px: { xs: 2, md: 6 }, py: 1.5, bgcolor: '#fafbf9', borderBottom: '1px solid #eff0ec' }}>
                          <Typography sx={{ mb: 1, color: '#6d786f', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 0.5 }}>
                            {document.chunks.length} TEXT CHUNKS
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
                            {document.chunks.map((chunk) => (
                              <Paper
                                key={chunk.id}
                                variant="outlined"
                                sx={{ p: 1.25, borderColor: '#eaede7', borderRadius: 1.75, boxShadow: 'none' }}
                              >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                                  <Typography sx={{ color: '#4f6955', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                                    Chunk {chunk.index}
                                  </Typography>
                                  <Typography sx={{ color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                                    {chunk.characters.toLocaleString()} characters
                                  </Typography>
                                </Box>
                                <Typography sx={{ color: '#737b74', fontSize: 'caption.fontSize', lineHeight: 1.65, overflowWrap: 'anywhere' }}>
                                  {chunk.content.slice(0, 320)}
                                  {chunk.content.length > 320 ? '…' : ''}
                                </Typography>
                              </Paper>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )
                })
              )}

              {visibleDocuments.length > DOCUMENTS_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Pagination
                    aria-label="Document pages"
                    color="primary"
                    count={pageCount}
                    onChange={(_, nextPage) => setDocumentPage(nextPage)}
                    page={currentDocumentPage}
                    size="small"
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 'auto', px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                  File originals are stored in Supabase. Extracted text chunks are browser-only and clear when you reload.
                </Typography>
                <Typography sx={{ color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                  {visibleDocuments.length} item{visibleDocuments.length === 1 ? '' : 's'}
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={folderDialogOpen}
        onClose={() => {
          setFolderDialogOpen(false)
          setFolderError('')
        }}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={createFolder}>
          <DialogTitle sx={{ pb: 0.75, color: '#303832', fontSize: 16, fontWeight: 700 }}>
            Create a folder
          </DialogTitle>
          <DialogContent>
            <Typography sx={{ mb: 2, color: '#858c85', fontSize: 'body2.fontSize' }}>
              Give this collection a name, such as “Client matters” or “Case law”.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              label="Folder name"
              onChange={(event) => {
                setFolderName(event.target.value)
                setFolderError('')
              }}
              value={folderName}
              error={Boolean(folderError)}
              helperText={folderError}
              size="small"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={() => {
                setFolderDialogOpen(false)
                setFolderError('')
              }}
              sx={{ color: '#727a73', fontSize: 'body2.fontSize' }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ fontSize: 'body2.fontSize' }}>
              Create folder
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={7000}
        onClose={() => setNotice('')}
        message={notice}
        action={
          <IconButton aria-label="Close notification" color="inherit" size="small" onClick={() => setNotice('')}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        }
      />
    </Box>
  )
}

export default KnowledgeBasePage
