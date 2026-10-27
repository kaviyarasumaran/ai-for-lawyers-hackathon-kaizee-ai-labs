import { Box, Button, Paper, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { useNavigate } from '@tanstack/react-router'
import { CaseworkEmptyState } from './CaseworkPageLayout'
import { useCases } from '../../hooks'

function CaseworkToolWorkspace({ tool }) {
  const navigate = useNavigate()
  const { cases } = useCases()
  const activeCases = cases.filter((caseItem) => !caseItem.isDefault)
  const casesWithDocuments = activeCases.filter((caseItem) => caseItem.documents.length > 0)

  function handleEmptyAction() {
    navigate({ to: tool.actionLabel === 'Back to AI Assistant' ? '/' : '/cases' })
  }

  if (tool.id === 'file-summaries' && casesWithDocuments.length > 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {casesWithDocuments.map((caseItem) => (
          <Paper
            key={caseItem.id}
            variant="outlined"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderColor: '#e7ebe5',
              borderRadius: 2,
              boxShadow: 'none',
            }}
          >
            <Box sx={{ display: 'grid', width: 34, height: 34, flex: 'none', placeItems: 'center', borderRadius: 1.5, color: '#64816a', bgcolor: '#eef4ed' }}>
              <FolderOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ color: '#424c44', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                {caseItem.title}
              </Typography>
              <Typography sx={{ mt: 0.25, color: '#8b938b', fontSize: 'caption.fontSize' }}>
                {caseItem.documents.length} document{caseItem.documents.length === 1 ? '' : 's'}
              </Typography>
            </Box>
            <Button
              onClick={() => navigate({ to: '/cases/$caseId', params: { caseId: caseItem.id } })}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ fontSize: 'caption.fontSize' }}
            >
              Open case
            </Button>
          </Paper>
        ))}
      </Box>
    )
  }

  if (
    tool.id === 'file-summaries' &&
    activeCases.length > 0
  ) {
    return (
      <Paper
        variant="outlined"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.75, borderColor: '#e7ebe5', borderRadius: 2, boxShadow: 'none' }}
      >
        <InsertDriveFileOutlinedIcon sx={{ color: '#718472', fontSize: 19 }} />
        <Typography sx={{ color: '#758075', fontSize: 'caption.fontSize' }}>
          Your cases don&apos;t have documents yet. Open a case to add files for review.
        </Typography>
      </Paper>
    )
  }

  return (
    <CaseworkEmptyState
      tool={tool}
      caseCount={activeCases.length}
      onAction={handleEmptyAction}
    />
  )
}

export default CaseworkToolWorkspace
