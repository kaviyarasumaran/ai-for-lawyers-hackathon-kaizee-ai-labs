import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import teamRoles from './teamRoles'

function TeamMembersTable({ members, cases, onInvite, onRoleChange, onManageAccess, onRemove }) {
  return (
    <Paper
      variant="outlined"
      sx={{ overflow: 'hidden', borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, p: 2 }}>
        <Box>
          <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Team members
          </Typography>
          <Typography sx={{ mt: 0.4, color: '#858c85', fontSize: 'caption.fontSize' }}>
            {members.length} {members.length === 1 ? 'person' : 'people'} in your network
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1OutlinedIcon />}
          onClick={onInvite}
          sx={{ flexShrink: 0, fontSize: 'caption.fontSize' }}
        >
          Invite member
        </Button>
      </Box>

      {members.length === 0 ? (
        <Box sx={{ display: 'flex', minHeight: 230, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center', borderTop: '1px solid #eff0ec' }}>
          <Avatar sx={{ mb: 1.5, bgcolor: '#edf2ed', color: '#63836f', width: 42, height: 42 }}>
            <PersonAddAlt1OutlinedIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Typography sx={{ color: '#48524a', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            Your network is ready to grow
          </Typography>
          <Typography sx={{ maxWidth: 330, mt: 0.5, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
            Invite a teammate, choose their workspace role, and grant access to specific cases.
          </Typography>
          <Button onClick={onInvite} sx={{ mt: 1, fontSize: 'caption.fontSize' }}>
            Invite your first member
          </Button>
        </Box>
      ) : (
        <TableContainer sx={{ borderTop: '1px solid #eff0ec' }}>
          <Table size="small" aria-label="Network members">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fbfcfa' }}>
                <TableCell sx={{ color: '#858c85', fontSize: 'caption.fontSize', fontWeight: 700 }}>MEMBER</TableCell>
                <TableCell sx={{ color: '#858c85', fontSize: 'caption.fontSize', fontWeight: 700 }}>ROLE</TableCell>
                <TableCell sx={{ color: '#858c85', fontSize: 'caption.fontSize', fontWeight: 700 }}>STATUS</TableCell>
                <TableCell sx={{ color: '#858c85', fontSize: 'caption.fontSize', fontWeight: 700 }}>CASE ACCESS</TableCell>
                <TableCell align="right" sx={{ color: '#858c85', fontSize: 'caption.fontSize', fontWeight: 700 }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} hover>
                  <TableCell sx={{ minWidth: 190, py: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 29, height: 29, bgcolor: '#eaf0e9', color: '#587260', fontSize: 10, fontWeight: 700 }}>
                        {member.email.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ overflow: 'hidden', color: '#48524a', fontSize: 'caption.fontSize', fontWeight: 600, textOverflow: 'ellipsis' }}>
                          {member.email}
                        </Typography>
                        <Typography sx={{ mt: 0.2, color: '#929992', fontSize: 'caption.fontSize' }}>
                          Invited {new Date(member.invitedAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    <Select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      onChange={(event) => onRoleChange(member.id, event.target.value)}
                      size="small"
                      sx={{ minWidth: 115, fontSize: 'body2.fontSize', '& .MuiSelect-select': { py: 0.65 } }}
                    >
                      {teamRoles.map((role) => (
                        <MenuItem key={role} value={role} sx={{ fontSize: 'caption.fontSize' }}>
                          {role}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={member.status}
                      size="small"
                      sx={{
                        height: 21,
                        bgcolor: member.status === 'Active' ? '#eaf3eb' : '#f6f1e5',
                        color: member.status === 'Active' ? '#53745d' : '#987b3d',
                        fontSize: 'caption.fontSize',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 125 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#69736b', fontSize: 'caption.fontSize' }}>
                      <FolderOutlinedIcon sx={{ fontSize: 14 }} />
                      {member.caseAccess.length} of {cases.length} cases
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Manage case access">
                      <Button
                        size="small"
                        startIcon={<ManageAccountsOutlinedIcon />}
                        onClick={() => onManageAccess(member)}
                        sx={{ fontSize: 'caption.fontSize' }}
                      >
                        Access
                      </Button>
                    </Tooltip>
                    <Tooltip title="Remove member">
                      <IconButton
                        aria-label={`Remove ${member.email}`}
                        onClick={() => onRemove(member)}
                        size="small"
                        sx={{ ml: 0.5, color: '#9a6b65' }}
                      >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  )
}

export default TeamMembersTable
