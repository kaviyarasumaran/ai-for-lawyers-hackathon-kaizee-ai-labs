import {
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemIcon,
  ListItemButton,
  Typography,
  useTheme,
} from '@mui/material'
import { Link } from '@tanstack/react-router'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import { caseworkTools } from '../../casework-tools/tools'
import ChatHistoryRow from './ChatHistoryRow'

const panelWidth = 256

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
        <ChatHistoryRow
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
                  <ChatHistoryRow
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
