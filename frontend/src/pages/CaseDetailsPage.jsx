import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import { useNavigate, useParams } from '@tanstack/react-router'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useCases } from '../hooks'
import { getCasePipeline, restartCasePipeline, retryCasePipeline } from '../api/cases'
import { caseworkTools } from '../casework-tools/tools'
import NewCaseDialog from '../cases/NewCaseDialog'
import CaseActionsDialogs from '../cases/CaseActionsDialogs'
import CasePipelineAlerts from '../cases/CasePipelineAlerts'
import CaseDocumentsList from '../cases/CaseDocumentsList'
import CaseFindingsCard from '../cases/CaseFindingsCard'
import CaseSummaryCard from '../cases/CaseSummaryCard'
import CaseConstitutionCard from '../cases/CaseConstitutionCard'
import { formatDate } from '../utils/formatters'

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
          <CasePipelineAlerts
            pipeline={pipeline}
            pipelineIsActive={pipelineIsActive}
            isRetryingPipeline={isRetryingPipeline}
            isRestartingPipeline={isRestartingPipeline}
            onRetryPipeline={handleRetryPipeline}
          />
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
              <CaseFindingsCard
                findings={findings}
                pipelineIsActive={pipelineIsActive}
                onOpenCaseChat={openCaseChat}
              />

              <CaseSummaryCard
                generatedSummary={generatedSummary}
                manualSummary={manualSummary}
                pipelineIsActive={pipelineIsActive}
                onOpenCaseChat={openCaseChat}
              />

              <CaseDocumentsList
                documents={caseItem.documents}
                documentPipelineById={documentPipelineById}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <CaseConstitutionCard onOpenCaseChat={openCaseChat} />

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
      <CaseActionsDialogs
        caseItem={caseItem}
        isDeleteOpen={isDeleteOpen}
        onCloseDelete={() => setIsDeleteOpen(false)}
        onDeleteCase={handleDeleteCase}
        deleteError={deleteError}
        isRestartOpen={isRestartOpen}
        onCloseRestart={() => setIsRestartOpen(false)}
        onRestartPipeline={handleRestartPipeline}
        pipelineIsActive={pipelineIsActive}
        pipelineError={pipelineError}
        isRestartingPipeline={isRestartingPipeline}
        isRetryingPipeline={isRetryingPipeline}
      />
    </Box>
  )
}

export default CaseDetailsPage
