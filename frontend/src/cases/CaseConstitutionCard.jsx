import { Box, Button, Link as MuiLink, Paper, Typography } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'

export default function CaseConstitutionCard({ onOpenCaseChat }) {
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: { xs: 1.75, sm: 2 }, borderColor: '#e8eae5', borderRadius: 2.5, boxShadow: 'none' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <GavelOutlinedIcon sx={{ color: '#78907b', fontSize: 17 }} />
        <Typography sx={{ color: '#303a32', fontSize: 'body2.fontSize', fontWeight: 700 }}>
          Indian Constitution
        </Typography>
      </Box>
      <Typography sx={{ mt: 0.75, color: '#858c85', fontSize: 'caption.fontSize', lineHeight: 1.7 }}>
        No constitutional provisions have been identified for this case. Check applicability against the case documents before relying on any provision.
      </Typography>
      <MuiLink
        href="https://www.indiacode.nic.in/"
        target="_blank"
        rel="noreferrer"
        underline="hover"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          mt: 1.25,
          color: '#4e7957',
          fontSize: 'body2.fontSize',
          fontWeight: 600,
        }}
      >
        India Code official legislation portal
        <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
      </MuiLink>
      <Button
        onClick={onOpenCaseChat}
        startIcon={<AutoAwesomeOutlinedIcon />}
        sx={{ display: 'flex', mt: 0.75, fontSize: 'caption.fontSize' }}
      >
        Explore with AI
      </Button>
    </Paper>
  )
}
