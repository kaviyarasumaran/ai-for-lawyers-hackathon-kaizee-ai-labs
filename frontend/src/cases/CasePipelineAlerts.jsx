import { Alert, Button, LinearProgress, Typography } from '@mui/material'

export default function CasePipelineAlerts({
  pipeline,
  pipelineIsActive,
  isRetryingPipeline,
  isRestartingPipeline,
  onRetryPipeline,
}) {
  return (
    <>
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
              onClick={onRetryPipeline}
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
    </>
  )
}
