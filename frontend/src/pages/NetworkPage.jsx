import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from '@mui/material'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import ChatSidebar from '../components/chat/ChatSidebar'
import InviteMemberDialog from '../components/network/InviteMemberDialog'
import ManageCaseAccessDialog from '../components/network/ManageCaseAccessDialog'
import TeamMembersTable from '../components/network/TeamMembersTable'
import { useCases } from '../cases/useCases'

function NetworkPage() {
  const {
    cases: allCases,
    teamMembers,
    inviteTeamMember,
    updateTeamMemberRole,
    updateTeamMemberCaseAccess,
    removeTeamMember,
  } = useCases()
  const cases = allCases.filter((caseItem) => !caseItem.isDefault)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [memberForAccess, setMemberForAccess] = useState(null)
  const [memberToRemove, setMemberToRemove] = useState(null)

  function handleRemoveMember() {
    if (!memberToRemove) return
    removeTeamMember(memberToRemove.id)
    if (memberForAccess?.id === memberToRemove.id) setMemberForAccess(null)
    setMemberToRemove(null)
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#fbfbf9' }}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <Box
        component="main"
        sx={{
          display: 'flex',
          minWidth: 0,
          flex: 1,
          flexDirection: 'column',
          px: { xs: 2, sm: 3, lg: 5 },
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            minHeight: { xs: 62, md: 73 },
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid #efefeb',
          }}
        >
          <IconButton
            aria-label="Open navigation"
            onClick={() => setIsSidebarOpen(true)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#777f78' }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <HubOutlinedIcon sx={{ color: '#63836f', fontSize: 19 }} />
          <Typography sx={{ color: '#303632', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Network
          </Typography>
        </Box>

        <Box sx={{ width: '100%', maxWidth: 1120, mx: 'auto', pt: { xs: 3, md: 5 }, pb: 5 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
            <Box>
              <Typography
                component="h1"
                sx={{
                  color: '#27312b',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: { xs: 25, md: 30 },
                  fontWeight: 700,
                  letterSpacing: '-1px',
                }}
              >
                Your network
              </Typography>
              <Typography sx={{ mt: 0.75, color: '#858c85', fontSize: 'body2.fontSize' }}>
                Invite your team, assign roles, and control access to each case.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PersonAddAlt1OutlinedIcon />}
              onClick={() => setIsInviteOpen(true)}
              sx={{ mt: { xs: 0, sm: 0.5 }, fontSize: 'caption.fontSize' }}
            >
              Invite member
            </Button>
          </Box>

          <Alert severity="info" icon={false} sx={{ mb: 2, border: '1px solid #e2e9e1', bgcolor: '#f5f8f4', color: '#647466', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
            Roles and case access are temporary in-memory prototype data and reset on reload. Invitations are not emailed, and these settings do not enforce access until connected to authentication and a backend.
          </Alert>

          <TeamMembersTable
            members={teamMembers}
            cases={cases}
            onInvite={() => setIsInviteOpen(true)}
            onRoleChange={updateTeamMemberRole}
            onManageAccess={setMemberForAccess}
            onRemove={setMemberToRemove}
          />

          <Paper
            variant="outlined"
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mt: 2, p: 1.75, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
          >
            <HubOutlinedIcon sx={{ mt: 0.1, color: '#78907b', fontSize: 17 }} />
            <Box>
              <Typography sx={{ color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 700 }}>
                Role and case permissions
              </Typography>
              <Typography sx={{ mt: 0.35, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
                Workspace roles describe a member’s general responsibility. Case access is managed separately for each member, so access can be limited to selected matters.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>

      <InviteMemberDialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        members={teamMembers}
        onInvite={inviteTeamMember}
      />
      <ManageCaseAccessDialog
        member={memberForAccess}
        cases={cases}
        onClose={() => setMemberForAccess(null)}
        onToggleAccess={updateTeamMemberCaseAccess}
      />
      <Dialog open={Boolean(memberToRemove)} onClose={() => setMemberToRemove(null)}>
        <DialogTitle sx={{ color: '#303a32', fontSize: 15, fontWeight: 700 }}>
          Remove network member?
        </DialogTitle>
        <DialogContent sx={{ color: '#737d75', fontSize: 'body2.fontSize' }}>
          {memberToRemove?.email} will be removed from this workspace’s member list and lose its assigned case access.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMemberToRemove(null)} sx={{ fontSize: 'caption.fontSize' }}>Cancel</Button>
          <Button onClick={handleRemoveMember} color="error" variant="contained" sx={{ fontSize: 'caption.fontSize' }}>
            Remove member
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default NetworkPage
