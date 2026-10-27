import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

export default function CaseActionsDialogs({
  caseItem,
  isDeleteOpen,
  onCloseDelete,
  onDeleteCase,
  deleteError,
  isRestartOpen,
  onCloseRestart,
  onRestartPipeline,
  pipelineIsActive,
  pipelineError,
  isRestartingPipeline,
  isRetryingPipeline,
}) {
  return (
    <>
      <Dialog open={isDeleteOpen} onClose={onCloseDelete}>
        <DialogTitle>Delete case?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete “{caseItem?.title}”? This removes the saved case record. Browser-only documents and chat history for this case will also be removed.
          </Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 1.5 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseDelete}>Cancel</Button>
          <Button onClick={onDeleteCase} color="error" variant="contained">
            Delete case
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isRestartOpen}
        onClose={() => {
          if (!isRestartingPipeline) onCloseRestart()
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
            onClick={onCloseRestart}
          >
            Cancel
          </Button>
          <Button
            disabled={isRestartingPipeline || isRetryingPipeline}
            onClick={onRestartPipeline}
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
    </>
  )
}
