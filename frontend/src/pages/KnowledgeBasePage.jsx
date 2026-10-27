import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Pagination,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useKnowledgeBase, useKbUploader } from '../hooks'
import { useNavigate } from '@tanstack/react-router'
import { DOCUMENTS_PER_PAGE } from '../utils/kbExtraction'
import {
  KbDocumentRow,
  KbEmptyDropZone,
  KbFolderDialog,
  KbMetricCard,
  KbSidebarFolders,
  KbTableHeader,
} from '../components/knowledge-base'

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

  const { uploadFiles } = useKbUploader({
    activeFolder,
    addDocuments,
    updateDocument,
    setNotice,
  })

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
            <KbMetricCard
              icon={<FolderOutlinedIcon />}
              label="FOLDERS"
              value={folders.length}
              detail="Organized collections"
              tone="#64816a"
            />
            <KbMetricCard
              icon={<ArticleOutlinedIcon />}
              label="READY DOCUMENTS"
              value={readyDocuments}
              detail={`${documents.length} total uploaded`}
              tone="#5c7891"
            />
            <KbMetricCard
              icon={<CheckCircleOutlineRoundedIcon />}
              label="TEXT CHUNKS"
              value={totalChunks.toLocaleString()}
              detail={activeTasks > 0 ? `${activeTasks} background task${activeTasks === 1 ? '' : 's'} running` : 'Generated in this browser session'}
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
            <KbSidebarFolders
              folders={folders}
              documents={documents}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(id) => {
                setSelectedFolderId(id)
                setDocumentPage(1)
              }}
              onOpenNewFolderDialog={() => setFolderDialogOpen(true)}
            />

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
              <KbTableHeader
                activeFolderName={activeFolder?.name}
                visibleCount={visibleDocuments.length}
                isFolder={Boolean(activeFolder)}
                search={search}
                onSearchChange={(val) => {
                  setSearch(val)
                  setDocumentPage(1)
                }}
                activeTasks={activeTasks}
              />

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
                <KbEmptyDropZone
                  search={search}
                  activeFolder={activeFolder}
                  isDragging={isDragging}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (event.currentTarget === event.target) setIsDragging(false)
                  }}
                  onDrop={onDrop}
                  onOpenFileInput={() => fileInputRef.current?.click()}
                  onOpenFolderDialog={() => setFolderDialogOpen(true)}
                />
              ) : (
                pagedDocuments.map((document) => {
                  const folderName =
                    folders.find((folder) => folder.id === document.folderId)?.name ??
                    document.folderName ??
                    'Folder'
                  const isExpanded = expandedDocumentIds.includes(document.id)
                  return (
                    <KbDocumentRow
                      key={document.id}
                      document={document}
                      folderName={folderName}
                      isExpanded={isExpanded}
                      rowGrid={rowGrid}
                      onToggleExpanded={toggleExpanded}
                      onRemoveDocument={handleRemoveDocument}
                    />
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

      <KbFolderDialog
        open={folderDialogOpen}
        onClose={() => setFolderDialogOpen(false)}
        onSubmit={createFolder}
        folderName={folderName}
        setFolderName={setFolderName}
        folderError={folderError}
        setFolderError={setFolderError}
      />
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
