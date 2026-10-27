import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link as MuiLink,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { useNavigate, useParams } from '@tanstack/react-router'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useCases } from '../cases/useCases'
import { getCasePipeline, restartCasePipeline, retryCasePipeline } from '../api/cases'
import { caseworkTools } from '../casework-tools/tools'
import NewCaseDialog from '../cases/NewCaseDialog'

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CaseDetailsPage() {
  const { caseId } = useParams({ strict: false })
  const navigate = useNavigate()
  const {
    cases,
    isCasesLoading,
    caseError,
    clearCaseError,
    deleteCase,
  } = useCases()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isRestartOpen, setIsRestartOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [pipeline, setPipeline] = useState(null)
  const [pipelineError, setPipelineError] = useState('')
  const [isRetryingPipeline, setIsRetryingPipeline] = useState(false)
  const [isRestartingPipeline, setIsRestartingPipeline] = useState(false)
  const [pipelineRefresh, setPipelineRefresh] = useState(0)
  const caseItem = cases.find((item) => item.id === caseId && !item.isDefault)

  useEffect(() => {
    if (!isCasesLoading && !caseItem) navigate({ to: '/cases', replace: true })
  }, [caseItem, isCasesLoading, navigate])

  useEffect(() => {
    if (!caseItem) return undefined
    let isMounted = true
    let timeoutId
    const poll = async () => {
      try {
        const result = await getCasePipeline(caseId)
        if (!isMounted) return
        setPipeline(result)
        setPipelineError('')
        if (['queued', 'processing'].includes(result.status)) {
          timeoutId = window.setTimeout(poll, 2_500)
        }
      } catch (error) {
        if (!isMounted) return
        setPipelineError(error.message)
        timeoutId = window.setTimeout(poll, 5_000)
      }
    }
    poll()
    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [caseId, caseItem, pipelineRefresh])

  if (!caseItem) return null

  async function handleDeleteCase() {
    try {
      await deleteCase(caseItem.id)
      navigate({ to: '/cases', replace: true })
    } catch (error) {
      setDeleteError(error.message)
    }
  }

  async function handleRetryPipeline() {
    setIsRetryingPipeline(true)
    try {
      setPipeline(await retryCasePipeline(caseItem.id))
      setPipelineError('')
      setPipelineRefresh((value) => value + 1)
    } catch (error) {
      setPipelineError(error.message)
    } finally {
      setIsRetryingPipeline(false)
    }
  }

  async function handleRestartPipeline() {
    setIsRestartingPipeline(true)
    try {
      setPipeline(await restartCasePipeline(caseItem.id))
      setPipelineError('')
      setIsRestartOpen(false)
      setPipelineRefresh((value) => value + 1)
    } catch (error) {
      setPipelineError(error.message)
    } finally {
      setIsRestartingPipeline(false)
    }
  }

  function openCaseChat() {
    navigate({
      to: '/cases/$caseId/chat/$chatId',
      params: { caseId: caseItem.id, chatId: caseItem.chatId ?? caseItem.id },
    })
  }

  const userMessageCount = caseItem.messages.filter(
    (message) => message.role === 'user',
  ).length
  const toolStatus = {
    'file-summaries': `${caseItem.documents.length} document${caseItem.documents.length === 1 ? '' : 's'}`,
    deadlines: 'No deadlines tracked',
    'legal-tasks': 'No tasks extracted',
    integrations: 'Not connected',
  }
  const generatedSummary = pipeline ? pipeline.summary : caseItem.generatedSummary
  const findings = pipeline ? pipeline.findings : caseItem.findings ?? []
  const manualSummary = caseItem.manualSummary ?? caseItem.summary
  const pipelineIsActive = ['queued', 'processing'].includes(pipeline?.status)
  const documentPipelineById = new Map(
    (pipeline?.documents ?? []).map((document) => [document.id, document]),
  )
  const pipelineStatusLabel = {
    waiting_for_documents: 'Waiting for documents',
    queued: 'Queued',
    processing: 'Processing documents',
    completed: 'Processing complete',
    partial: 'Partially complete',
    failed: 'Processing failed',
  }[pipeline?.status]

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbfbf9' }}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          flexDirection: 'column',
          px: { xs: 2, sm: 3, lg: 5 },
          pb: 5,
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            minHeight: { xs: 62, md: 73 },
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid #efefeb',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, ml: -0.5, color: '#777f78' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <Button
            onClick={() => navigate({ to: '/cases' })}
            startIcon={<ArrowBackRoundedIcon />}
            sx={{ color: '#777f78', fontSize: 'caption.fontSize' }}
          >
            Your cases
          </Button>
          <Typography sx={{ color: '#b0b5ae', fontSize: 'caption.fontSize' }}>/</Typography>
          <Typography noWrap sx={{ minWidth: 0, color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            {caseItem.title}
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 1120, mx: 'auto', pt: { xs: 3, md: 4 } }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 1.5 }}>
              <Box
                aria-hidden="true"
                sx={{
                  display: 'grid',
                  width: 46,
                  height: 46,
                  flex: 'none',
                  placeItems: 'center',
                  borderRadius: 2.5,
                  color: '#4e7957',
                  bgcolor: '#eaf2e9',
                }}
              >
                <FolderOutlinedIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  component="h1"
                  sx={{
                    color: '#27312b',
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: { xs: 24, md: 30 },
                    fontWeight: 700,
                    letterSpacing: '-1px',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {caseItem.title}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                  <Chip
                    label={caseItem.status}
                    size="small"
                    sx={{ height: 21, color: '#52775b', bgcolor: '#eef4ed', fontSize: 'caption.fontSize' }}
                  />
                  {pipelineStatusLabel && (
                    <Chip
                      label={pipelineStatusLabel}
                      size="small"
                      color={pipeline?.status === 'failed' ? 'error' : 'default'}
                      sx={{ height: 21, fontSize: 'caption.fontSize' }}
                    />
                  )}
                  <Typography sx={{ color: '#858c85', fontSize: 'caption.fontSize' }}>
                    {caseItem.matterType}
                  </Typography>
                  {caseItem.parties && (
                    <Typography sx={{ color: '#a0a59f', fontSize: 'caption.fontSize' }}>
                      · {caseItem.parties}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexShrink: 0,
                justifyContent: 'flex-end',
                gap: 0.75,
                width: { xs: '100%', sm: 'auto' },
                ml: 'auto',
              }}
            >
              {caseItem.documents.length > 0 && (
                <Tooltip title={pipelineIsActive ? 'Stop and restart processing' : 'Reprocess all documents'}>
                  <span>
                    <IconButton
                      aria-label={pipelineIsActive ? 'Stop and restart processing' : 'Reprocess all documents'}
                      disabled={isRestartingPipeline || isRetryingPipeline}
                      onClick={() => setIsRestartOpen(true)}
                      sx={{ width: 38, height: 38, border: '1px solid #e8eae5', borderRadius: 2, color: '#647267' }}
                    >
                      <ReplayRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              <Tooltip title="Edit case">
                <IconButton
                  aria-label="Edit case"
                  onClick={() => setIsEditOpen(true)}
                  sx={{ width: 38, height: 38, border: '1px solid #e8eae5', borderRadius: 2, color: '#647267' }}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open AI chat">
                <IconButton
                  aria-label="Open AI chat"
                  onClick={openCaseChat}
                  sx={{ width: 38, height: 38, border: '1px solid #e8eae5', borderRadius: 2, color: '#52775b' }}
                >
                  <AutoAwesomeOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete case">
                <IconButton
                  aria-label="Delete case"
                  onClick={() => setIsDeleteOpen(true)}
                  sx={{ width: 38, height: 38, border: '1px solid #f0dddd', borderRadius: 2, color: 'error.main' }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {caseError && <Alert severity="error" onClose={clearCaseError} sx={{ mb: 2 }}>{caseError}</Alert>}
          {pipelineError && <Alert severity="error" sx={{ mb: 2 }}>{pipelineError}</Alert>}
          {pipelineIsActive && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography sx={{ mb: 0.75, fontSize: 'body2.fontSize' }}>
                {pipeline?.processedDocuments ?? 0} of {pipeline?.totalDocuments ?? 0} documents processed
                {pipeline?.stage ? ` · ${pipeline.stage.replaceAll('_', ' ')}` : ''}. This runs in the background; you can leave this page.
              </Typography>
              <LinearProgress
                variant={pipeline?.totalDocuments ? 'determinate' : 'indeterminate'}
                value={
                  pipeline?.totalDocuments
                    ? (pipeline.processedDocuments / pipeline.totalDocuments) * 100
                    : 0
                }
              />
            </Alert>
          )}
          {(pipeline?.status === 'failed' || pipeline?.status === 'partial') && (
            <Alert
              severity={pipeline.status === 'failed' ? 'error' : 'warning'}
              action={
                <Button
                  color="inherit"
                  size="small"
                  disabled={isRetryingPipeline || isRestartingPipeline}
                  onClick={handleRetryPipeline}
                >
                  {isRetryingPipeline ? 'Retrying…' : 'Retry processing'}
                </Button>
              }
              sx={{ mb: 2 }}
            >
              {pipeline.stage === 'summary_failed' && pipeline.failedDocuments
                ? `${pipeline.failedDocuments} document${pipeline.failedDocuments === 1 ? '' : 's'} failed, and the case summary and findings could not be generated.`
                : pipeline.stage === 'summary_failed'
                  ? 'The case summary and findings could not be generated.'
                  : `${pipeline.failedDocuments} document${pipeline.failedDocuments === 1 ? '' : 's'} could not be processed.`}
              {pipeline.documents
                .filter((document) => document.status === 'failed')
                .map((document) => (
                  <Typography key={document.id} component="div" sx={{ mt: 0.5, fontSize: 'caption.fontSize' }}>
                    {document.name}: {document.error}
                  </Typography>
                ))}
            </Alert>
          )}
          <Alert severity="warning" icon={false} sx={{ mb: 2, fontSize: 'caption.fontSize' }}>
            Case details and files are stored on the backend. Files use public Supabase links, so anyone with a link can access them. Chat messages remain in browser memory.
          </Alert>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
              mb: 2,
            }}
          >
            {[
              { label: 'Documents', value: caseItem.documents.length, icon: DescriptionOutlinedIcon },
              { label: 'Chat messages', value: userMessageCount, icon: ChatOutlinedIcon },
              { label: 'Last activity', value: formatDate(caseItem.lastActivityAt), icon: CalendarMonthOutlinedIcon },
            ].map(({ label, value, icon: Icon }) => (
              <Paper
                key={label}
                variant="outlined"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderColor: '#e8eae5', borderRadius: 2, boxShadow: 'none' }}
              >
                <Icon sx={{ color: '#78907b', fontSize: 17 }} />
                <Box>
                  <Typography sx={{ color: '#858c85', fontSize: 'caption.fontSize' }}>{label}</Typography>
                  <Typography sx={{ mt: 0.25, color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>{value}</Typography>
                </Box>
              </Paper>
            ))}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(280px, 0.85fr)' },
              alignItems: 'start',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Paper
                component="section"
                variant="outlined"
                sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
              >
                <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                  Case findings
                </Typography>
                <Typography sx={{ mt: 0.5, mb: 1.5, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
                  Automatically drafted from processed case documents. Verify every finding against its cited source before relying on it.
                </Typography>
                {findings.length ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                    {findings.map((finding, index) => (
                      <Box key={`${finding.title}-${index}`} sx={{ p: 1.25, border: '1px solid #e7ebe5', borderRadius: 1.5, bgcolor: '#f8faf7' }}>
                        <Typography sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                          {finding.title}
                        </Typography>
                        <Typography sx={{ mt: 0.4, color: '#69736b', fontSize: 'caption.fontSize', lineHeight: 1.65 }}>
                          {finding.detail}
                        </Typography>
                        {finding.sources?.length > 0 && (
                          <Typography sx={{ mt: 0.5, color: '#858c85', fontSize: 'caption.fontSize' }}>
                            Sources: {finding.sources.join('; ')}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Alert severity="info" icon={false} sx={{ mb: 1.5, border: '1px solid #e7ebe5', bgcolor: '#f8faf7', color: '#758075', fontSize: 'caption.fontSize', lineHeight: 1.65 }}>
                    {pipelineIsActive
                      ? 'Findings will appear after document processing completes.'
                      : 'No findings have been generated yet. Upload supported source documents to start processing.'}
                  </Alert>
                )}
                <Button
                  onClick={openCaseChat}
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ fontSize: 'caption.fontSize' }}
                >
                  Review with AI
                </Button>
              </Paper>

              <Paper
                component="section"
                variant="outlined"
                sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Box>
                    <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                      Case summary
                    </Typography>
                    <Typography sx={{ mt: 0.5, color: '#858c85', fontSize: 'caption.fontSize' }}>
                      {generatedSummary ? 'AI-generated draft from case documents. Verify before relying on it.' : manualSummary ? 'Provided when this case was created.' : 'No summary has been added.'}
                    </Typography>
                  </Box>
                  <Button
                    onClick={openCaseChat}
                    size="small"
                    startIcon={<AutoAwesomeOutlinedIcon />}
                    sx={{ flexShrink: 0, fontSize: 'caption.fontSize' }}
                  >
                    Ask AI
                  </Button>
                </Box>
                <Divider sx={{ my: 1.5, borderColor: '#eff0ec' }} />
                <Typography sx={{ color: generatedSummary || manualSummary ? '#59645b' : '#9aa19a', fontSize: 'body2.fontSize', lineHeight: 1.8 }}>
                  {generatedSummary || manualSummary || (pipelineIsActive ? 'A draft summary will appear after document processing completes.' : 'Upload supported source documents to generate a draft summary.')}
                </Typography>
              </Paper>

              <Paper
                component="section"
                variant="outlined"
                sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
                  <Box>
                    <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                      Related documents
                    </Typography>
                    <Typography sx={{ mt: 0.4, color: '#858c85', fontSize: 'caption.fontSize' }}>
                      Files attached to this case.
                    </Typography>
                  </Box>
                  <Chip label={caseItem.documents.length} size="small" sx={{ height: 21, bgcolor: '#f1f3ef', color: '#69736b', fontSize: 'caption.fontSize' }} />
                </Box>
                {caseItem.documents.length === 0 ? (
                  <Typography sx={{ py: 1.25, color: '#929992', fontSize: 'caption.fontSize' }}>
                    No related documents have been uploaded yet.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {caseItem.documents.map((file, index) => (
                      <Box
                        key={file.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 1,
                          borderTop: index === 0 ? '1px solid #eff0ec' : 'none',
                          borderBottom: '1px solid #eff0ec',
                        }}
                      >
                        <DescriptionOutlinedIcon sx={{ flex: 'none', color: '#78907b', fontSize: 17 }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography noWrap sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 600 }}>
                            {file.name}
                          </Typography>
                          <Typography sx={{ mt: 0.25, color: '#929992', fontSize: 'caption.fontSize' }}>
                            {formatBytes(file.size)}
                            {documentPipelineById.get(file.id)?.status
                              ? ` · ${documentPipelineById.get(file.id).status}`
                              : ''}
                          </Typography>
                        </Box>
                        <Button
                          component="a"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          download={file.name}
                          endIcon={<OpenInNewRoundedIcon />}
                          sx={{ flexShrink: 0, fontSize: 'caption.fontSize' }}
                        >
                          Open
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Paper
                component="section"
                variant="outlined"
                sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <GavelOutlinedIcon sx={{ color: '#78907b', fontSize: 17 }} />
                  <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                    Indian Constitution
                  </Typography>
                </Box>
                <Typography sx={{ mt: 0.75, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
                  No constitutional provisions have been identified for this case. Check applicability against the case documents before relying on any provision.
                </Typography>
                <MuiLink
                  href="https://www.indiacode.nic.in/"
                  target="_blank"
                  rel="noreferrer"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1.25, color: '#4e7957', fontSize: 'body2.fontSize', fontWeight: 600 }}
                >
                  India Code official legislation portal
                  <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                </MuiLink>
                <Button
                  onClick={openCaseChat}
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  sx={{ display: 'flex', mt: 0.75, fontSize: 'caption.fontSize' }}
                >
                  Explore with AI
                </Button>
              </Paper>

              <Paper
                component="section"
                variant="outlined"
                sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
              >
                <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                  Casework tools
                </Typography>
                <Typography sx={{ mt: 0.5, mb: 1.25, color: '#858c85', fontSize: 'caption.fontSize' }}>
                  Case-specific tools and their current data.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {caseworkTools.map(({ id, title, path, icon: ToolIcon }) => (
                    <Paper
                      key={id}
                      variant="outlined"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderColor: '#eff0ec', borderRadius: 1.75, boxShadow: 'none' }}
                    >
                      <Box sx={{ display: 'grid', width: 28, height: 28, flex: 'none', placeItems: 'center', borderRadius: 1.25, color: '#64816a', bgcolor: '#eef4ed' }}>
                        <ToolIcon sx={{ fontSize: 15 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                          {title}
                        </Typography>
                        <Typography sx={{ mt: 0.2, color: '#929992', fontSize: 'caption.fontSize' }}>
                          {toolStatus[id]}
                        </Typography>
                      </Box>
                      <Button
                        onClick={() => navigate({ to: path })}
                        aria-label={`Open ${title}`}
                        sx={{ minWidth: 0, px: 0.5, fontSize: 'caption.fontSize' }}
                      >
                        Open
                      </Button>
                    </Paper>
                  ))}
                </Box>
              </Paper>
            </Box>
          </Box>
        </Box>
      </Box>
      <NewCaseDialog
        key={caseItem.id}
        open={isEditOpen}
        caseItem={caseItem}
        onClose={() => setIsEditOpen(false)}
        onCreated={() => setIsEditOpen(false)}
      />
      <Dialog open={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <DialogTitle>Delete case?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete “{caseItem.title}”? This removes the saved case record. Browser-only documents and chat history for this case will also be removed.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteCase} color="error" variant="contained">Delete case</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={isRestartOpen}
        onClose={() => {
          if (!isRestartingPipeline) setIsRestartOpen(false)
        }}
      >
        <DialogTitle>
          {pipelineIsActive ? 'Stop and restart processing?' : 'Reprocess all documents?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {pipelineIsActive
              ? 'The active case-processing job will be stopped and every document will be queued again.'
              : 'Every document in this case will be queued for processing again.'}
            {' '}The current summary and findings will remain available until new results are saved.
          </Typography>
          {pipelineError && <Alert severity="error" sx={{ mt: 1.5 }}>{pipelineError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={isRestartingPipeline || isRetryingPipeline}
            onClick={() => setIsRestartOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={isRestartingPipeline || isRetryingPipeline}
            onClick={handleRestartPipeline}
            variant="contained"
          >
            {isRestartingPipeline
              ? 'Restarting…'
              : pipelineIsActive
                ? 'Stop and restart'
                : 'Reprocess all'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CaseDetailsPage
