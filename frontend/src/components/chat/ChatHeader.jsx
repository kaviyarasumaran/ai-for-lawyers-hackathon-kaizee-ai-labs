import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import CaseAccessAvatars from './CaseAccessAvatars'

function ChatHeader({
  onMenuClick,
  onHistoryClick,
  onCreateChat,
  onToggleHistoryPanel,
  isHistoryCollapsed,
  attachmentCount,
  onViewFiles,
  onRenameChat,
  caseTitle,
  matterType,
  isCaseChat = false,
  caseAccessMembers = [],
}) {
  const isDark = useTheme().palette.mode === 'dark'
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')

  const handleDialogRename = () => {
    const clean = renameDraft.trim()
    if (clean && onRenameChat) {
      onRenameChat(clean)
    }
    setIsRenameDialogOpen(false)
  }

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: { xs: 62, md: 73 },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IconButton
        aria-label="Open navigation"
        onClick={onMenuClick}
        sx={{
          display: { xs: 'inline-flex', md: 'none' },
          width: 34,
          height: 34,
          ml: -0.625,
          color: 'text.secondary',
        }}
      >
        <MenuRoundedIcon />
      </IconButton>
      {onHistoryClick && (
        <IconButton
          aria-label="Open chat history"
          onClick={onHistoryClick}
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            width: 34,
            height: 34,
            color: 'text.secondary',
          }}
        >
          <AccountTreeOutlinedIcon />
        </IconButton>
      )}
      {onToggleHistoryPanel && (
        <Tooltip title={isHistoryCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}>
          <IconButton
            aria-label={isHistoryCollapsed ? 'Expand chat panel' : 'Collapse chat panel'}
            onClick={onToggleHistoryPanel}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              width: 32,
              height: 32,
              ml: -0.5,
              color: 'text.secondary',
            }}
          >
            {isHistoryCollapsed ? <ChevronRightRoundedIcon /> : <ChevronLeftRoundedIcon />}
          </IconButton>
        </Tooltip>
      )}
      {onCreateChat && !isCaseChat && (
        <>
          <Tooltip title="New chat">
            <IconButton
              aria-label="New chat"
              onClick={onCreateChat}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                width: 34,
                height: 34,
                color: 'primary.main',
              }}
            >
              <AddRoundedIcon />
            </IconButton>
          </Tooltip>
          <Button
            onClick={onCreateChat}
            startIcon={<AddRoundedIcon />}
            sx={{
              display: {
                xs: 'none',
                md: isHistoryCollapsed ? 'inline-flex' : 'none',
              },
              minHeight: 34,
              px: 1.25,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1.75,
              color: 'primary.main',
              bgcolor: 'background.paper',
              fontSize: 'caption.fontSize',
              '& .MuiButton-startIcon': { color: 'primary.main', mr: 0.5 },
              '&:hover': {
                borderColor: isDark ? '#526858' : '#cbd9cb',
                bgcolor: isDark ? '#232f27' : '#f8fbf7',
              },
            }}
          >
            New chat
          </Button>
        </>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mr: 'auto', ml: { xs: 0, md: 0.125 } }}>
        <Typography noWrap sx={{ maxWidth: { xs: 100, sm: 220 }, color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
          {isCaseChat ? caseTitle || 'Case chat' : caseTitle || 'Legal assistant'}
        </Typography>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '1px', height: 13, bgcolor: 'divider' }} />
        <Typography sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', fontSize: 'body2.fontSize' }}>
          {matterType || 'A thoughtful place to start'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
        <CaseAccessAvatars members={caseAccessMembers} />
        <Button
          variant="outlined"
          startIcon={<PlaceOutlinedIcon />}
          endIcon={<Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#d5a75d' }} />}
          sx={{
            minHeight: { xs: 31, md: 34 },
            gap: 0.25,
            px: { xs: 0.875, md: 1.25 },
            borderColor: 'divider',
            borderRadius: 1.75,
            bgcolor: 'background.paper',
            color: 'text.secondary',
            fontSize: { xs: 9, md: 10 },
            '& .MuiButton-startIcon': { color: 'primary.main', mr: 0.5, '& svg': { fontSize: 16 } },
            '& .MuiButton-endIcon': { ml: 0.5 },
            '&:hover': {
              borderColor: isDark ? '#526858' : '#ccd7cc',
              bgcolor: 'background.paper',
            },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Set your location
          </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Location
          </Box>
        </Button>
        {onViewFiles && (
          <Tooltip title="View and filter files in this chat">
            <Button
              variant="outlined"
              onClick={onViewFiles}
              startIcon={<FolderOpenOutlinedIcon />}
              sx={{
                minHeight: { xs: 31, md: 34 },
                gap: 0.6,
                px: { xs: 0.875, md: 1.25 },
                borderColor: 'divider',
                borderRadius: 1.75,
                bgcolor: 'background.paper',
                color: 'text.primary',
                fontSize: { xs: 11, md: 12 },
                fontWeight: 600,
                textTransform: 'none',
                '& .MuiButton-startIcon': { color: 'primary.main', mr: 0.25, '& svg': { fontSize: 16 } },
                '&:hover': {
                  borderColor: isDark ? '#526858' : '#ccd7cc',
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fbf7',
                },
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Files
              </Box>
              <Chip
                label={attachmentCount || 0}
                size="small"
                sx={{
                  height: 18,
                  minWidth: 18,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  bgcolor: isDark ? 'rgba(54,117,77,0.3)' : '#e2ede3',
                  color: 'primary.main',
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            </Button>
          </Tooltip>
        )}
        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: 'none',
          }}
        >
          <IconButton
            aria-label="Chat files menu"
            aria-controls={menuAnchor ? 'chat-files-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={Boolean(menuAnchor)}
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            size="small"
            sx={{ width: 34, height: 34, color: 'text.secondary' }}
          >
            <MoreHorizRoundedIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Paper>
        <Menu
          id="chat-files-menu"
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {onRenameChat && (
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                setRenameDraft(caseTitle || '')
                setIsRenameDialogOpen(true)
              }}
              sx={{ minWidth: 150, fontSize: 'body2.fontSize' }}
            >
              <DriveFileRenameOutlineOutlinedIcon sx={{ mr: 1, fontSize: 17 }} />
              Rename chat
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              setMenuAnchor(null)
              onViewFiles()
            }}
            sx={{ minWidth: 150, fontSize: 'body2.fontSize' }}
          >
            <AttachFileOutlinedIcon sx={{ mr: 1, fontSize: 17 }} />
            View chat files ({attachmentCount})
          </MenuItem>
        </Menu>
      </Box>

      <Dialog
        open={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2.5,
              p: 1,
              bgcolor: 'background.paper',
              backgroundImage: 'none',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>
          Rename chat
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Chat name"
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleDialogRename()
              }
            }}
            inputProps={{ maxLength: 120 }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setIsRenameDialogOpen(false)}
            sx={{ color: 'text.secondary', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDialogRename}
            disabled={!renameDraft.trim()}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ChatHeader
