import { Box, Paper, Typography } from '@mui/material'

export default function KbMetricCard({ icon, label, value, detail, tone }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        minWidth: 0,
        alignItems: 'center',
        gap: 1.5,
        p: { xs: 1.75, sm: 2.25 },
        borderColor: '#e8eae5',
        borderRadius: 2.5,
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          width: 40,
          height: 40,
          flex: 'none',
          placeItems: 'center',
          borderRadius: 2.25,
          color: tone,
          bgcolor: `${tone}14`,
          '& .MuiSvgIcon-root': { fontSize: 21 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: '#929992', fontSize: 'caption.fontSize', fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography sx={{ mt: 0.125, color: '#2f3831', fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography noWrap sx={{ mt: 0.25, color: '#a0a59f', fontSize: 'caption.fontSize' }}>
          {detail}
        </Typography>
      </Box>
    </Paper>
  )
}
