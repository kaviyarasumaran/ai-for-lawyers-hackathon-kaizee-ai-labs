import { Box, Paper, Typography } from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined'

export default function CauseListStats({ items = [], courts = [], stats = null }) {
  const total = stats?.total ?? items.length
  const courtCount = stats?.courtCount ?? (courts.length || new Set(items.map((i) => i.courtNumber)).size)

  const admissions = stats?.admissions ?? items.filter((i) =>
    (i.category || '').toLowerCase().includes('admission') || (i.category || '').toLowerCase().includes('motion'),
  ).length

  const forOrders = stats?.forOrders ?? items.filter((i) =>
    (i.category || '').toLowerCase().includes('order'),
  ).length

  const finalHearings = stats?.finalHearings ?? items.filter((i) =>
    (i.category || '').toLowerCase().includes('final hearing'),
  ).length

  const cards = [
    { label: 'Total Listed Cases', value: total, icon: AssignmentOutlinedIcon, color: '#336142' },
    { label: 'Courts Sitting', value: courtCount, icon: GavelOutlinedIcon, color: '#2c5a85' },
    { label: 'Motions / Admissions', value: admissions, icon: AccessTimeOutlinedIcon, color: '#855e2c' },
    { label: 'For Orders', value: forOrders, icon: FactCheckOutlinedIcon, color: '#7a3b85' },
    { label: 'Final Hearings', value: finalHearings, icon: HowToVoteOutlinedIcon, color: '#85322c' },
  ]

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          sm: 'repeat(3, 1fr)',
          md: 'repeat(5, 1fr)',
        },
        gap: 1.5,
        mb: 3,
      }}
    >
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Paper
          key={label}
          variant="outlined"
          sx={{
            p: 1.75,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'background.paper',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f2f6f2',
              color,
              flex: 'none',
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {value}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}
