import { useEffect, useRef, useState } from 'react'
import {
  Box,
  IconButton,
  InputBase,
  ListItemButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'

export default function ChatHistoryRow({
  chat,
  activeChatId,
  onSelectChat,
  onTogglePinned,
  onRenameChat,
  onDeleteChat,
  onClose,
  showActions = true,
}) {
  const isActive = chat.id === activeChatId
  const isDark = useTheme().palette.mode === 'dark'
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(chat.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleSave = () => {
    const clean = titleDraft.trim()
    if (clean && clean !== chat.title && onRenameChat) {
      onRenameChat(chat.id, clean)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setTitleDraft(chat.title)
    setIsEditing(false)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSave()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      handleCancel()
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: isActive
          ? isDark ? '#42634d' : '#c9dccb'
          : chat.pinned ? isDark ? '#394d3f' : '#dce8dc' : 'transparent',
        bgcolor: isActive
          ? isDark ? '#293a2f' : '#e3eee4'
          : chat.pinned ? isDark ? '#232f27' : '#f0f5ef' : 'transparent',
        transition: 'background-color 140ms ease, border-color 140ms ease',
        '&:hover, &:focus-within': {
          bgcolor: isActive
            ? isDark ? '#304536' : '#e0ecdf'
            : isDark ? '#26332b' : '#edf3ec',
          borderColor: isDark ? '#405344' : '#d4e2d4',
        },
        '&:hover .chat-row-actions, &:focus-within .chat-row-actions': {
          opacity: 1,
        },
      }}
    >
      {isEditing ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 36,
            width: '100%',
            px: 0.75,
            py: 0.25,
            gap: 0.5,
          }}
        >
          <InputBase
            inputRef={inputRef}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 'caption.fontSize',
              fontWeight: 600,
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: isDark ? '#1a241e' : '#ffffff',
              border: '1px solid',
              borderColor: isDark ? '#42634d' : '#8da593',
              color: 'text.primary',
            }}
            inputProps={{
              'aria-label': `Rename ${chat.title}`,
              maxLength: 120,
            }}
          />
          <Tooltip title="Save title">
            <IconButton
              size="small"
              aria-label="Save title"
              onClick={handleSave}
              sx={{
                width: 24,
                height: 24,
                color: 'primary.main',
                '&:hover': { bgcolor: isDark ? '#29372f' : '#e0ebe0' },
              }}
            >
              <CheckRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cancel">
            <IconButton
              size="small"
              aria-label="Cancel rename"
              onClick={handleCancel}
              sx={{
                width: 24,
                height: 24,
                color: 'text.secondary',
                '&:hover': { bgcolor: isDark ? '#29372f' : '#e0ebe0' },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <>
          <ListItemButton
            selected={isActive}
            onClick={() => {
              onSelectChat(chat.id)
              onClose()
            }}
            sx={{
              minHeight: 36,
              minWidth: 0,
              flex: 1,
              gap: 0.75,
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              '&.Mui-selected': { bgcolor: 'transparent', color: isDark ? '#a9d0b2' : '#265f4b' },
              '&.Mui-selected:hover': { bgcolor: 'transparent' },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 5,
                height: 5,
                flex: 'none',
                ml: 0.625,
                borderRadius: '50%',
                bgcolor: isActive ? '#4e7957' : '#a2aaa1',
              }}
            />
            <Typography
              noWrap
              title={chat.title}
              sx={{ minWidth: 0, flex: 1, color: 'text.primary', fontSize: 'caption.fontSize', fontWeight: 600 }}
            >
              {chat.title}
            </Typography>
          </ListItemButton>
          {showActions && (
            <Box
              className="chat-row-actions"
              sx={{
                display: 'flex',
                flex: 'none',
                alignItems: 'center',
                pr: 0.25,
                opacity: chat.pinned || isActive ? 1 : 0,
                transition: 'opacity 120ms ease',
              }}
            >
              {onRenameChat && (
                <Tooltip title="Rename chat">
                  <IconButton
                    aria-label={`Rename ${chat.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setTitleDraft(chat.title)
                      setIsEditing(true)
                    }}
                    size="small"
                    sx={{
                      width: 25,
                      height: 25,
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main', bgcolor: isDark ? '#29372f' : '#e0ebe0' },
                    }}
                  >
                    <DriveFileRenameOutlineOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={chat.pinned ? 'Unpin chat' : 'Pin chat'}>
                <IconButton
                  aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePinned(chat.id)
                  }}
                  size="small"
                  sx={{
                    width: 25,
                    height: 25,
                    color: chat.pinned ? 'primary.main' : 'text.secondary',
                    '&:hover': { bgcolor: isDark ? '#29372f' : '#e0ebe0' },
                  }}
                >
                  <PushPinOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete chat and branches">
                <IconButton
                  aria-label={`Delete ${chat.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteChat(chat.id)
                  }}
                  size="small"
                  sx={{
                    width: 25,
                    height: 25,
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main', bgcolor: isDark ? '#3b2323' : '#fbe9e7' },
                  }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
