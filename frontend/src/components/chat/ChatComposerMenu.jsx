import { Box, Menu, MenuItem } from '@mui/material'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded'

export default function ChatComposerMenu({
  menuAnchor,
  onClose,
  onViewFiles,
  attachmentCount,
  onStartTranscription,
  onOpenCamera,
  onFilesSelected,
}) {
  const openFilePicker = (inputId) => {
    onClose()
    const input = document.getElementById(inputId)
    if (input) {
      input.value = ''
      input.click()
    }
  }

  return (
    <>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={onClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {onViewFiles && (
          <MenuItem
            onClick={() => {
              onClose()
              onViewFiles()
            }}
            sx={{ gap: 1, fontSize: 'body2.fontSize', borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <FolderOpenOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
            Files in this chat ({attachmentCount || 0})
          </MenuItem>
        )}
        <MenuItem onClick={() => openFilePicker('chat-document-input')} sx={{ gap: 1, fontSize: 'body2.fontSize' }}>
          <AttachFileOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
          Upload files
        </MenuItem>
        <MenuItem onClick={() => openFilePicker('chat-media-input')} sx={{ gap: 1, fontSize: 'body2.fontSize' }}>
          <ImageOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
          Add photos, videos, or audio
        </MenuItem>
        <MenuItem
          onClick={() => {
            onClose()
            void onStartTranscription()
          }}
          sx={{ gap: 1, fontSize: 'body2.fontSize' }}
        >
          <MicNoneRoundedIcon sx={{ color: '#64816a', fontSize: 18 }} />
          Live audio transcript
        </MenuItem>
        <MenuItem
          onClick={() => {
            onClose()
            onOpenCamera()
          }}
          sx={{ gap: 1, fontSize: 'body2.fontSize' }}
        >
          <CameraAltOutlinedIcon sx={{ color: '#64816a', fontSize: 18 }} />
          Take photo or video
        </MenuItem>
      </Menu>
      <Box
        component="input"
        id="chat-document-input"
        type="file"
        multiple
        onChange={onFilesSelected}
        sx={{ display: 'none' }}
      />
      <Box
        component="input"
        id="chat-media-input"
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={onFilesSelected}
        sx={{ display: 'none' }}
      />
    </>
  )
}
