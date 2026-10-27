import { useState } from 'react'
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Popover,
  Typography,
} from '@mui/material'

function getInitials(email) {
  return email.slice(0, 1).toUpperCase()
}

function CaseAccessAvatars({ members }) {
  const [anchorEl, setAnchorEl] = useState(null)

  if (members.length === 0) return null

  const visibleCount = members.length > 4 ? 3 : members.length
  const visibleMembers = members.slice(0, visibleCount)
  const overflowCount = members.length - visibleMembers.length

  return (
    <>
      <ButtonBase
        aria-label={`View ${members.length} people with access to this case`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: 0.25,
          borderRadius: 20,
          '&:focus-visible': { outline: '2px solid #78907b', outlineOffset: 2 },
        }}
      >
        {visibleMembers.map((member, index) => (
          <Avatar
            key={member.id}
            sx={{
              width: 27,
              height: 27,
              ml: index === 0 ? 0 : -0.75,
              border: '2px solid #fbfbf9',
              bgcolor: ['#eaf0e9', '#e9edf4', '#f3ece4', '#eeeaf4'][index % 4],
              color: '#526b59',
              fontSize: 9,
              fontWeight: 700,
              zIndex: visibleMembers.length - index,
            }}
          >
            {getInitials(member.email)}
          </Avatar>
        ))}
        {overflowCount > 0 && (
          <Avatar
            sx={{
              width: 27,
              height: 27,
              ml: -0.75,
              border: '2px solid #fbfbf9',
              bgcolor: '#eef0ec',
              color: '#68736a',
              fontSize: 8,
              fontWeight: 700,
            }}
          >
            +{overflowCount}
          </Avatar>
        )}
      </ButtonBase>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Case access members',
            sx: { mt: 1, width: 290, borderRadius: 2.5 },
          },
        }}
      >
        <Paper elevation={0} sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
              Case access
            </Typography>
            <Typography sx={{ mt: 0.3, color: '#858c85', fontSize: 'caption.fontSize' }}>
              {members.length} {members.length === 1 ? 'person has' : 'people have'} access to this case
            </Typography>
          </Box>
          <Divider />
          <List dense disablePadding sx={{ maxHeight: 300, overflowY: 'auto', py: 0.5 }}>
            {members.map((member, index) => (
              <ListItem key={member.id} sx={{ px: 1.75, py: 0.75 }}>
                <ListItemAvatar sx={{ minWidth: 39 }}>
                  <Avatar
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: ['#eaf0e9', '#e9edf4', '#f3ece4', '#eeeaf4'][index % 4],
                      color: '#526b59',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(member.email)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.email}
                  secondary={`${member.role} · ${member.status}`}
                  slotProps={{
                    primary: {
                      sx: {
                        overflow: 'hidden',
                        color: '#48524a',
                        fontSize: 'body2.fontSize',
                        fontWeight: 600,
                        textOverflow: 'ellipsis',
                      },
                    },
                    secondary: { sx: { mt: 0.25, color: '#858c85', fontSize: 'caption.fontSize' } },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Popover>
    </>
  )
}

export default CaseAccessAvatars
