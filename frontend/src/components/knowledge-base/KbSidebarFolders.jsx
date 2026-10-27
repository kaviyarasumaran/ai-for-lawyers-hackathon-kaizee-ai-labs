import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'

export default function KbSidebarFolders({
  folders = [],
  documents = [],
  selectedFolderId = null,
  onSelectFolder,
  onOpenNewFolderDialog,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        flexDirection: 'column',
        p: 1.5,
        borderColor: '#e8eae5',
        borderRadius: 2.5,
        boxShadow: 'none',
      }}
    >
      <Typography
        sx={{
          px: 1,
          py: 0.75,
          color: '#989e98',
          fontSize: 'caption.fontSize',
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        LIBRARY
      </Typography>
      <Button
        fullWidth
        onClick={() => onSelectFolder(null)}
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
          onClick={onOpenNewFolderDialog}
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
                onClick={() => onSelectFolder(folder.id)}
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
  )
}
