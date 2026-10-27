import { Avatar, Box, Button, InputBase, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded'
import { useNavigate } from '@tanstack/react-router'

function getInitials(email) {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function MessageConversationList({
  members,
  selectedMemberId,
  messagesByMember,
  search,
  onSearchChange,
  onSelect,
}) {
  const navigate = useNavigate()

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mx: 1.5,
          my: 1.25,
          px: 1.25,
          py: 0.75,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          color: 'text.secondary',
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 18 }} />
        <InputBase
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search people"
          inputProps={{ 'aria-label': 'Search people' }}
          sx={{ flex: 1, fontSize: 'body2.fontSize' }}
        />
      </Box>
      {members.length ? (
        <List disablePadding sx={{ overflowY: 'auto', pb: 1 }}>
          {members.map((member) => {
            const messages = messagesByMember[member.id] ?? []
            const lastMessage = messages.at(-1)
            return (
              <ListItemButton
                key={member.id}
                selected={selectedMemberId === member.id}
                onClick={() => onSelect(member.id)}
                sx={{
                  gap: 1.25,
                  alignItems: 'flex-start',
                  px: 1.75,
                  py: 1.25,
                  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'action.selected' },
                }}
              >
                <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.light', color: 'primary.dark', fontSize: 'body2.fontSize', fontWeight: 700 }}>
                  {getInitials(member.email)}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography noWrap sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 600 }}>
                        {member.email}
                      </Typography>
                      {lastMessage && (
                        <Typography sx={{ flex: 'none', color: 'text.secondary', fontSize: 'caption.fontSize' }}>
                          {new Date(lastMessage.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
                      <Typography component="span" noWrap sx={{ color: 'text.secondary', fontSize: 'caption.fontSize' }}>
                        {lastMessage?.content ?? `${member.role} · ${member.status}`}
                      </Typography>
                      {member.status === 'Pending' && (
                        <Typography component="span" sx={{ flex: 'none', color: 'warning.main', fontSize: 'caption.fontSize' }}>
                          Invited
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            )
          })}
        </List>
      ) : (
        <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 'body2.fontSize' }}>
            {search ? 'No matching people found.' : 'No workspace members yet.'}
          </Typography>
          {!search && (
            <Button
              onClick={() => navigate({ to: '/network' })}
              startIcon={<PeopleOutlineRoundedIcon />}
              size="small"
              sx={{ mt: 1 }}
            >
              Go to Network
            </Button>
          )}
        </Box>
      )}
    </>
  )
}

export default MessageConversationList
