import { useMemo, useState } from 'react'
import { Alert, Box, Paper, Typography } from '@mui/material'
import { useCases } from '../../cases/useCases'
import MessageConversationList from './MessageConversationList'
import MessageThread from './MessageThread'

function MessagesInbox() {
  const { teamMembers } = useCases()
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [messagesByMember, setMessagesByMember] = useState({})
  const [search, setSearch] = useState('')
  const selectedMember = teamMembers.find((member) => member.id === selectedMemberId)
  const visibleMembers = useMemo(
    () => teamMembers.filter((member) => member.email.toLowerCase().includes(search.trim().toLowerCase())),
    [search, teamMembers],
  )

  function sendMessage(memberId, content) {
    const message = {
      id: crypto.randomUUID(),
      content,
      sentAt: new Date().toISOString(),
    }
    setMessagesByMember((current) => ({
      ...current,
      [memberId]: [...(current[memberId] ?? []), message],
    }))
  }

  return (
    <Box sx={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column' }}>
      <Alert severity="info" icon={false} sx={{ mb: 2, fontSize: 'caption.fontSize' }}>
        Messaging is a UI prototype. Messages stay in this browser session and are not delivered to team members.
      </Alert>
      <Paper
        variant="outlined"
        sx={{
          display: 'grid',
          minHeight: 0,
          flex: 1,
          gridTemplateColumns: { xs: '1fr', md: 'minmax(250px, 320px) minmax(0, 1fr)' },
          overflow: 'hidden',
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          boxShadow: 'none',
        }}
      >
        <Box
          sx={{
            display: { xs: selectedMember ? 'none' : 'flex', md: 'flex' },
            minWidth: 0,
            flexDirection: 'column',
            borderRight: { md: '1px solid' },
            borderColor: 'divider',
          }}
        >
          <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
              Team conversations
            </Typography>
            <Typography sx={{ mt: 0.25, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              {teamMembers.length} workspace {teamMembers.length === 1 ? 'member' : 'members'}
            </Typography>
          </Box>
          <MessageConversationList
            members={visibleMembers}
            selectedMemberId={selectedMemberId}
            messagesByMember={messagesByMember}
            search={search}
            onSearchChange={setSearch}
            onSelect={setSelectedMemberId}
          />
        </Box>
        <Box sx={{ display: { xs: selectedMember ? 'flex' : 'none', md: 'flex' }, minWidth: 0, flexDirection: 'column' }}>
          {selectedMember ? (
            <MessageThread
              member={selectedMember}
              messages={messagesByMember[selectedMember.id] ?? []}
              onBack={() => setSelectedMemberId(null)}
              onSend={(content) => sendMessage(selectedMember.id, content)}
            />
          ) : (
            <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                  Select a conversation
                </Typography>
                <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: 'body2.fontSize' }}>
                  Choose a workspace member to open your conversation.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

export default MessagesInbox
