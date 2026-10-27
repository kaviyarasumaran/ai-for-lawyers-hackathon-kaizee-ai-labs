import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
} from '@mui/material'
import { Link, useNavigate } from '@tanstack/react-router'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { useState } from 'react'
import { useCases } from '../../hooks'
import NewCaseDialog from '../../cases/NewCaseDialog'
import SidebarAccountMenu from './SidebarAccountMenu'

const sidebarWidth = 272

function SidebarContent({ onClose, onCreateCase, cases }) {
  const isDark = useTheme().palette.mode === 'dark'
  const recentCases = cases
    .filter((caseItem) => !caseItem.isDefault)
    .slice()
    .sort((first, second) => second.lastActivityAt.localeCompare(first.lastActivityAt))
    .slice(0, 5)

  return (
    <Box
      sx={{
        display: 'flex',
        width: sidebarWidth,
        height: '100%',
        flexDirection: 'column',
        p: '25px 17px 16px',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, mb: 3.625 }}>
        <Box
          aria-hidden="true"
          sx={{
            display: 'grid',
            width: 34,
            height: 34,
            placeItems: 'center',
            borderRadius: '11px',
            color: '#fff',
            bgcolor: 'primary.main',
          }}
        >
          <GavelOutlinedIcon sx={{ fontSize: 23 }} />
        </Box>
        <Typography sx={{ color: 'text.primary', fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800, letterSpacing: '-.9px' }}>
          Counsel<Box component="span" sx={{ color: '#4b8a6d' }}>.</Box>
        </Typography>
        <Button
          aria-label="Close navigation"
          onClick={onClose}
          sx={{
            display: { xs: 'grid', md: 'none' },
            minWidth: 34,
            width: 34,
            height: 34,
            ml: 'auto',
            p: 0,
            color: 'text.secondary',
          }}
        >
          <CloseRoundedIcon />
        </Button>
      </Box>

      <Button
        onClick={onCreateCase}
        startIcon={<AddRoundedIcon />}
        sx={{
          minHeight: 44,
          justifyContent: 'flex-start',
          gap: 0.25,
          px: 1.5,
          border: '1px solid #dfe6df',
          borderRadius: 2.25,
          borderColor: 'divider',
          bgcolor: 'background.default',
          color: 'text.primary',
          fontSize: 'body2.fontSize',
          '&:hover': { borderColor: isDark ? '#526858' : '#b9cdbf', bgcolor: isDark ? '#232f27' : '#fbfdfb' },
          '& .MuiButton-startIcon': { color: 'primary.main' },
        }}
      >
        New case
      </Button>

      <Box sx={{ mt: 3.625 }}>
        <Typography sx={{ mb: 1.125, ml: 1.25, color: 'text.secondary', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 1.05 }}>
          WORKSPACE
        </Typography>
        <List disablePadding>
          <ListItemButton
            component={Link}
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 38,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <ChatOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="AI Assistant"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize', fontWeight: 600 } } }}
            />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/cases"
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 38,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&.active:hover': { bgcolor: isDark ? '#304536' : '#e4eee4' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <ExploreOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Discover"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize', fontWeight: 600 } } }}
            />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/knowledge-base"
            activeProps={{ className: 'active' }}
            sx={{
              minHeight: 38,
              mt: 0.375,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <DescriptionOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Knowledge Base"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize' } } }}
            />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/notifications"
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 38,
              mt: 0.375,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <NotificationsNoneOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Notifications"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize' } } }}
            />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/messages"
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 38,
              mt: 0.375,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <ForumOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Messages"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize' } } }}
            />
          </ListItemButton>
        </List>
      </Box>

      <Box sx={{ mt: 3.875 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.125, ml: 1.25 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 'caption.fontSize', fontWeight: 700, letterSpacing: 1.05 }}>
            RECENT CASES
          </Typography>
          <IconButton
            aria-label="View all cases"
            component={Link}
            to="/cases"
            activeProps={{ className: 'active' }}
            size="small"
            sx={{ width: 23, height: 23, mr: 0.5, color: 'text.secondary' }}
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        {recentCases.length === 0 ? (
          <Typography sx={{ px: 1.25, py: 1, color: 'text.secondary', fontSize: 'body2.fontSize', lineHeight: 1.6 }}>
            Your cases will appear here.
          </Typography>
        ) : (
          <List disablePadding>
            {recentCases.map((caseItem) => (
              <ListItemButton
                component={Link}
                key={caseItem.id}
                onClick={onClose}
                to="/cases/$caseId/chat/$chatId"
                params={{ caseId: caseItem.id, chatId: caseItem.chatId ?? caseItem.id }}
                activeProps={{ className: 'active' }}
                sx={{
                  minHeight: 38,
                  gap: 0.75,
                  px: 1.25,
                  py: 0,
                  borderRadius: 1.75,
                  color: 'text.secondary',
                  '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
                  '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 25, color: 'inherit' }}>
                  <FolderOutlinedIcon sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText
                  primary={caseItem.title}
                  slotProps={{
                    primary: {
                      noWrap: true,
                      sx: { overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'caption.fontSize' },
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>

      <Box sx={{ mt: 'auto' }}>
        <List disablePadding sx={{ mb: 1.25 }}>
          <ListItemButton
            component={Link}
            to="/network"
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 36,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <HubOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Network"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize', fontWeight: 600 } } }}
            />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/settings"
            activeProps={{ className: 'active' }}
            onClick={onClose}
            sx={{
              minHeight: 36,
              px: 1.25,
              py: 0,
              borderRadius: 1.75,
              color: 'text.secondary',
              '&.active': { color: 'primary.main', bgcolor: isDark ? '#293a2f' : '#e9f0e9' },
              '&:hover': { bgcolor: isDark ? '#26332b' : '#eef2ec' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 26, color: 'inherit' }}>
              <SettingsOutlinedIcon sx={{ fontSize: 17 }} />
            </ListItemIcon>
            <ListItemText
              primary="Settings"
              slotProps={{ primary: { sx: { fontSize: 'body2.fontSize', fontWeight: 600 } } }}
            />
          </ListItemButton>
        </List>
        <SidebarAccountMenu onClose={onClose} />
      </Box>
    </Box>
  )
}

function ChatSidebar({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { cases } = useCases()
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false)

  function handleCreateCase(caseItem) {
    setIsNewCaseOpen(false)
    onClose()
    navigate({
      to: '/cases/$caseId/chat/$chatId',
      params: { caseId: caseItem.id, chatId: caseItem.chatId ?? caseItem.id },
    })
  }

  return (
    <>
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarWidth,
          flex: `0 0 ${sidebarWidth}px`,
          borderRight: '1px solid',
          borderColor: 'divider',
        }}
      >
        <SidebarContent onClose={onClose} onCreateCase={() => setIsNewCaseOpen(true)} cases={cases} />
      </Box>
      <Drawer
        anchor="left"
        onClose={onClose}
        open={isOpen}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: sidebarWidth, maxWidth: '86vw', border: 0 },
        }}
      >
        <SidebarContent onClose={onClose} onCreateCase={() => setIsNewCaseOpen(true)} cases={cases} />
      </Drawer>
      <NewCaseDialog
        open={isNewCaseOpen}
        onClose={() => setIsNewCaseOpen(false)}
        onCreated={handleCreateCase}
      />
    </>
  )
}

export default ChatSidebar
