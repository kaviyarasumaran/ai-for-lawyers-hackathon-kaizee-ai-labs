import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'

export default function KbFolderDialog({
  open,
  onClose,
  onSubmit,
  folderName,
  setFolderName,
  folderError,
  setFolderError,
}) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose()
        setFolderError?.('')
      }}
      fullWidth
      maxWidth="xs"
    >
      <Box component="form" onSubmit={onSubmit}>
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
              setFolderError?.('')
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
              onClose()
              setFolderError?.('')
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
  )
}
