import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material'
import teamRoles from './teamRoles'

function InviteMemberDialog({ open, onClose, members, onInvite }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Attorney')
  const [error, setError] = useState('')

  function handleClose() {
    setEmail('')
    setRole('Attorney')
    setError('')
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (members.some((member) => member.email === normalizedEmail)) {
      setError('This person is already on your network.')
      return
    }

    onInvite({ email: normalizedEmail, role })
    handleClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ component: 'form', onSubmit: handleSubmit }}
    >
      <DialogTitle sx={{ color: '#303a32', fontSize: 16, fontWeight: 700 }}>
        Invite to your network
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: '10px !important' }}>
        {error && <Alert severity="error" sx={{ fontSize: 'body2.fontSize' }}>{error}</Alert>}
        <TextField
          autoFocus
          required
          type="email"
          label="Email address"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError('')
          }}
          size="small"
          fullWidth
        />
        <TextField
          select
          label="Network role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          size="small"
          fullWidth
        >
          {teamRoles.map((teamRole) => (
            <MenuItem key={teamRole} value={teamRole}>
              {teamRole}
            </MenuItem>
          ))}
        </TextField>
        <Alert severity="info" icon={false} sx={{ fontSize: 'caption.fontSize', lineHeight: 1.6 }}>
          This demo records the invite locally. No email is sent until an invitation service is connected.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ fontSize: 'body2.fontSize' }}>Cancel</Button>
        <Button type="submit" variant="contained" sx={{ fontSize: 'body2.fontSize' }}>
          Send invite
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default InviteMemberDialog
