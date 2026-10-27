import { Box, Button, Typography } from '@mui/material'
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

export default function KbEmptyDropZone({
  search,
  activeFolder,
  isDragging,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenFileInput,
  onOpenFolderDialog,
}) {
  return (
    <Box
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
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
      <Box
        sx={{
          display: 'grid',
          width: 48,
          height: 48,
          placeItems: 'center',
          mb: 1.5,
          borderRadius: 3,
          color: '#64816a',
          bgcolor: '#eef4ed',
        }}
      >
        {activeFolder ? <UploadFileOutlinedIcon /> : <FolderOutlinedIcon />}
      </Box>
      <Typography sx={{ color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>
        {search
          ? 'No matching documents'
          : activeFolder
            ? 'Your folder is ready'
            : 'Your knowledge base starts here'}
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
          onClick={onOpenFileInput}
          startIcon={<UploadFileOutlinedIcon />}
          variant="contained"
          sx={{ mt: 2, fontSize: 'caption.fontSize' }}
        >
          Choose files
        </Button>
      ) : (
        <Button
          onClick={onOpenFolderDialog}
          startIcon={<CreateNewFolderOutlinedIcon />}
          variant="outlined"
          sx={{ mt: 2, borderColor: '#dfe6df', color: '#426c56', fontSize: 'caption.fontSize' }}
        >
          Create your first folder
        </Button>
      )}
    </Box>
  )
}
