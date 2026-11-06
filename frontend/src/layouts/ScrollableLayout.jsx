import { useState } from 'react'
import { Box, useTheme } from '@mui/material'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import ChatSidebar from '../components/chat/ChatSidebar'
import ChatHeader from '../components/chat/ChatHeader'
import ChatHistoryPanel from '../components/chat/ChatHistoryPanel'
import { useCases } from '../hooks'

export default function ScrollableLayout({
  children,
  title: propTitle,
  matterType: propMatterType,
  isCaseChat: propIsCaseChat,
  attachmentCount = 0,
  onViewFiles,
  onRename,
  caseAccessMembers: propCaseAccessMembers,
  headerActions,
  showHistoryPanel = false,
  chats = [],
  activeChatId,
  onSelectChat,
  onCreateChat,
  onTogglePinned,
  onDeleteChat,
  maxWidth = '1320px',
  contentSx = {},
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const location = useLocation()
  const navigate = useNavigate()
  const { cases = [], teamMembers = [] } = useCases()
  const pathname = location?.pathname || ''

  const handleCreateChat = onCreateChat || (() => navigate({ to: '/' }))

  let title = propTitle
  let matterType = propMatterType
  let isCaseChat = propIsCaseChat ?? false
  let caseAccessMembers = propCaseAccessMembers ?? []

  if (!title) {
    if (pathname.startsWith('/cases/')) {
      const caseId = pathname.split('/')[2]
      const currentCase = cases.find((c) => c.id === caseId)
      if (currentCase) {
        title = currentCase.title
        matterType = currentCase.isDefault ? undefined : currentCase.matterType
        isCaseChat = true
        caseAccessMembers = teamMembers.filter((m) => m.caseAccess?.includes(caseId))
      } else {
        title = 'Case Details'
      }
    } else if (pathname === '/cases') {
      title = 'Case Matters'
      matterType = 'Directory'
    } else if (pathname === '/judgment-validity') {
      title = 'Judgment Validity Tracking'
      matterType = 'AI Indian Legal Citator'
    } else if (pathname === '/cause-list') {
      title = 'Daily Court Cause List'
      matterType = 'Madras High Court Board Tracker'
    } else if (pathname === '/knowledge-base') {
      title = 'Legal Knowledge Base'
      matterType = 'Central Authority & Statutes'
    } else if (pathname === '/notifications') {
      title = 'Notifications'
      matterType = 'Alerts & Filings'
    } else if (pathname === '/messages') {
      title = 'Team Messages'
      matterType = 'Internal Communications'
    } else if (pathname.startsWith('/casework-tools')) {
      title = 'Casework Tools'
      matterType = 'Practice Workflows'
    } else if (pathname === '/settings') {
      title = 'Settings'
      matterType = 'Preferences'
    } else if (pathname === '/network') {
      title = 'Legal Network'
      matterType = 'Team & Collaborators'
    } else {
      title = 'Counsel AI'
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: isDark ? 'background.default' : '#fbfbf9',
        width: '100%',
      }}
    >
      {/* Sidebar navigation */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Optional Chat History Drawer / Panel */}
      {showHistoryPanel && (
        <ChatHistoryPanel
          chats={chats}
          activeChatId={activeChatId}
          onCreateChat={handleCreateChat}
          onSelectChat={onSelectChat}
          onTogglePinned={onTogglePinned}
          onDeleteChat={onDeleteChat}
          chatListTitle={isCaseChat ? 'CASE CHAT' : 'ALL CHATS'}
          isCollapsed={isHistoryCollapsed}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          isCaseChat={isCaseChat}
        />
      )}

      {/* Scrollable Main Viewport */}
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          flexDirection: 'column',
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: { xs: 2, sm: 3, lg: 5 },
          pb: 6,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Sticky Header sharing ChatHeader */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: isDark ? 'background.default' : '#fbfbf9',
            width: '100%',
          }}
        >
          <ChatHeader
            isCaseChat={isCaseChat}
            onMenuClick={() => setIsSidebarOpen(true)}
            onHistoryClick={showHistoryPanel ? () => setIsHistoryOpen(true) : undefined}
            onToggleHistoryPanel={
              showHistoryPanel
                ? () => setIsHistoryCollapsed((collapsed) => !collapsed)
                : undefined
            }
            isHistoryCollapsed={isHistoryCollapsed}
            onCreateChat={handleCreateChat}
            attachmentCount={attachmentCount}
            onViewFiles={onViewFiles}
            onRenameChat={onRename}
            caseTitle={title}
            matterType={matterType}
            caseAccessMembers={caseAccessMembers}
          />
          {headerActions && (
            <Box sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              {headerActions}
            </Box>
          )}
        </Box>

        {/* Scrollable Content Container */}
        <Box
          sx={{
            width: '100%',
            maxWidth,
            mx: 'auto',
            mt: 2.5,
            flex: 1,
            ...contentSx,
          }}
        >
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  )
}
