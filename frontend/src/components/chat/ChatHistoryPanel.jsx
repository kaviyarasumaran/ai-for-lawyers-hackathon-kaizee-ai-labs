import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemIcon,
  ListItemButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import { Link } from '@tanstack/react-router'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { caseworkTools } from '../../casework-tools/tools'

const panelWidth = 256

function ChatRow({
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
                  aria-label={`Delete ${chat.title} and its branches`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDeleteChat(chat.id)
                  }}
                  size="small"
                  sx={{
                    width: 25,
                    height: 25,
                    color: isDark ? '#d49a91' : '#9a7772',
                    '&:hover': { color: isDark ? '#f0a59b' : '#a4423c', bgcolor: isDark ? '#472e2c' : '#f8e9e7' },
                  }}
                >
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}

function ChatHistoryContent({
  chats,
  activeChatId,
  onCreateChat,
  onSelectChat,
  onTogglePinned,
  onRenameChat,
  onDeleteChat,
  chatListTitle,
  emptyMessage,
  showChatActions,
  isCollapsed,
  onClose,
}) {
  const isDark = useTheme().palette.mode === 'dark'
  const sortedChats = chats
    .slice()
    .sort((first, second) => second.lastActivityAt.localeCompare(first.lastActivityAt))
  const chatIds = new Set(sortedChats.map((chat) => chat.id))
  const childrenByParent = new Map()

  sortedChats.forEach((chat) => {
    if (!chat.parentId || !chatIds.has(chat.parentId)) return
    const children = childrenByParent.get(chat.parentId) ?? []
    children.push(chat)
    childrenByParent.set(chat.parentId, children)
  })

  function renderTree(chat) {
    const children = childrenByParent.get(chat.id) ?? []
    return (
      <Box key={chat.id}>
        <ChatRow
          chat={chat}
          activeChatId={activeChatId}
          onSelectChat={onSelectChat}
          onTogglePinned={onTogglePinned}
          onRenameChat={onRenameChat}
          onDeleteChat={onDeleteChat}
          onClose={onClose}
          showActions={showChatActions}
        />
        {children.length > 0 && (
          <Box sx={{ ml: 1.5, pl: 0.75, borderLeft: `1px solid ${isDark ? '#303a34' : '#e3e8e1'}` }}>
            {children.map((child) => renderTree(child))}
          </Box>
        )}
      </Box>
    )
  }

  const pinnedChats = sortedChats.filter((chat) => chat.pinned)
  const roots = sortedChats.filter(
    (chat) => !chat.parentId || !chatIds.has(chat.parentId),
  )

  return (
    <Box
      sx={{
        display: 'flex',
        width: isCollapsed ? 0 : panelWidth,
        height: '100%',
        flexDirection: 'column',
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'width 180ms ease',
        overflow: 'hidden',
      }}
    >
      {!isCollapsed && (
        <Box sx={{ flex: 'none', p: 1.5, pb: 0.75 }}>
          {onCreateChat && (
            <Button
              fullWidth
              onClick={() => {
                onCreateChat()
                onClose()
              }}
              startIcon={<AddRoundedIcon />}
              sx={{
                minHeight: 38,
                justifyContent: 'flex-start',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.75,
                bgcolor: 'background.default',
                color: 'text.primary',
                fontSize: 'body2.fontSize',
                '& .MuiButton-startIcon': { color: 'primary.main' },
                '&:hover': { borderColor: isDark ? '#526858' : '#b9cdbf', bgcolor: isDark ? '#232f27' : '#fbfdfb' },
              }}
            >
              New chat
            </Button>
          )}
        </Box>
      )}
      {!isCollapsed && (
        <Box sx={{ minHeight: 0, flex: 1, overflowY: 'auto', px: 1.25, pb: 1.5 }}>
        <Box sx={{ py: 1.25 }}>
          <Typography
            component={Link}
            to="/casework-tools"
            onClick={onClose}
            sx={{
              display: 'block',
              px: 0.75,
              py: 0.75,
              color: 'text.secondary',
              fontSize: 'caption.fontSize',
              fontWeight: 700,
              letterSpacing: 0.9,
              textDecoration: 'none',
              '&:hover': { color: 'primary.main' },
            }}
          >
            CASEWORK TOOLS
          </Typography>
          <List disablePadding>
            {caseworkTools.map((feature) => {
              const FeatureIcon = feature.icon
              return (
                <ListItemButton
                  key={feature.id}
                  component={Link}
                  to={feature.path}
                  onClick={onClose}
                  sx={{
                    minHeight: 34,
                    gap: 1,
                    px: 0.875,
                    py: 0.5,
                    borderRadius: 1.5,
                    color: '#566359',
                    '&.active': {
                      color: isDark ? '#a9d0b2' : '#315c43',
                      bgcolor: isDark ? '#293a2f' : '#e9f0e9',
                    },
                    '&:hover': {
                      bgcolor: isDark ? '#26332b' : '#edf3ec',
                      color: isDark ? '#a9d0b2' : '#315c43',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 20,
                      color: 'inherit',
                      '& .MuiSvgIcon-root': { fontSize: 16 },
                    }}
                  >
                    <FeatureIcon />
                  </ListItemIcon>
                  <Typography sx={{ fontSize: 'caption.fontSize', fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                </ListItemButton>
              )
            })}
          </List>
        </Box>
        {pinnedChats.length > 0 && (
          <>
            <Divider sx={{ borderColor: 'divider' }} />
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ px: 0.75, py: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 0.9 }}>
                PINNED
              </Typography>
              <List disablePadding>
                {pinnedChats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    activeChatId={activeChatId}
                    onSelectChat={onSelectChat}
                    onTogglePinned={onTogglePinned}
                    onDeleteChat={onDeleteChat}
                    onClose={onClose}
                    showActions={showChatActions}
                  />
                ))}
              </List>
            </Box>
          </>
        )}
        {pinnedChats.length > 0 && <Divider sx={{ borderColor: 'divider' }} />}
        <Box sx={{ pt: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.75 }}>
            <ChatOutlinedIcon sx={{ color: 'text.secondary', fontSize: 15 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 0.9 }}>
              {chatListTitle}
            </Typography>
          </Box>
          {roots.length ? (
            <List disablePadding>{roots.map((chat) => renderTree(chat))}</List>
          ) : (
            <Typography sx={{ px: 0.75, py: 0.5, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              {emptyMessage}
            </Typography>
          )}
        </Box>
        </Box>
      )}
    </Box>
  )
}

function ChatHistoryPanel({
  chats,
  activeChatId,
  onCreateChat,
  onSelectChat,
  onTogglePinned,
  onRenameChat,
  onDeleteChat,
  chatListTitle = 'ALL CHATS',
  emptyMessage = 'Start a chat to see it here.',
  showChatActions = true,
  isCollapsed,
  isOpen,
  onClose,
}) {
  const contentProps = {
    chats,
    activeChatId,
    onCreateChat,
    onSelectChat,
    onTogglePinned,
    onRenameChat,
    onDeleteChat,
    chatListTitle,
    emptyMessage,
    showChatActions,
    onClose,
  }

  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          flex: `0 0 ${isCollapsed ? 0 : panelWidth}px`,
          transition: 'flex-basis 180ms ease',
        }}
      >
        <ChatHistoryContent
          {...contentProps}
          isCollapsed={isCollapsed}
        />
      </Box>
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={onClose}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: panelWidth, maxWidth: '86vw', border: 0 },
        }}
      >
        <ChatHistoryContent {...contentProps} isCollapsed={false} />
      </Drawer>
    </>
  )
}

export default ChatHistoryPanel
