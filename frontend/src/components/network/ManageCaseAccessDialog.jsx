import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Typography,
} from '@mui/material'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'

function ManageCaseAccessDialog({ member, cases, onClose, onToggleAccess }) {
  return (
    <Dialog open={Boolean(member)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ color: '#303a32', fontSize: 16, fontWeight: 700 }}>
        Manage case access
      </DialogTitle>
      {member && (
        <>
          <DialogContent>
            <Typography sx={{ mb: 1.5, color: '#7f8880', fontSize: 'body2.fontSize' }}>
              Choose which cases <strong>{member.email}</strong> can access.
            </Typography>
            {cases.length === 0 ? (
              <Typography sx={{ py: 2, color: '#929992', fontSize: 'body2.fontSize' }}>
                No cases have been created yet. New cases will appear here.
              </Typography>
            ) : (
              <FormGroup>
                {cases.map((caseItem) => (
                  <FormControlLabel
                    key={caseItem.id}
                    control={
                      <Checkbox
                        checked={member.caseAccess.includes(caseItem.id)}
                        onChange={(event) =>
                          onToggleAccess(member.id, caseItem.id, event.target.checked)
                        }
                        size="small"
                      />
                    }
                    label={
                      <Typography sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#48524a', fontSize: 'body2.fontSize' }}>
                        <FolderOutlinedIcon sx={{ color: '#78907b', fontSize: 15 }} />
                        {caseItem.title}
                      </Typography>
                    }
                    sx={{
                      minHeight: 42,
                      px: 1,
                      borderBottom: '1px solid #eff0ec',
                    }}
                  />
                ))}
              </FormGroup>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} variant="contained" sx={{ fontSize: 'body2.fontSize' }}>
              Done
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

export default ManageCaseAccessDialog
