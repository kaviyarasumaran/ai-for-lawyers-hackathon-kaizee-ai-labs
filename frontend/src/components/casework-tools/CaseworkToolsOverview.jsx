import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { Link } from '@tanstack/react-router'
import { caseworkTools } from '../../casework-tools/tools'

function CaseworkToolsOverview() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 1.5,
      }}
    >
      {caseworkTools.map(({ id, title, description, path, icon: Icon }) => (
        <Card
          key={id}
          variant="outlined"
          sx={{ borderRadius: 2.5, boxShadow: 'none' }}
        >
          <CardActionArea component={Link} to={path} sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', minHeight: 140, alignItems: 'flex-start', gap: 1.5, p: 2 }}>
              <Box
                aria-hidden="true"
                sx={{
                  display: 'grid',
                  width: 38,
                  height: 38,
                  flex: 'none',
                  placeItems: 'center',
                  borderRadius: 2,
                  color: 'primary.main',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(78, 121, 87, 0.15)' : '#eaf2e9',
                  '& svg': { fontSize: 20 },
                }}
              >
                <Icon />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ color: 'text.primary', fontSize: '0.9375rem', fontWeight: 700 }}>
                  {title}
                </Typography>
                <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                  {description}
                </Typography>
              </Box>
              <ArrowForwardRoundedIcon sx={{ mt: 0.25, color: 'text.secondary', fontSize: 17 }} />
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  )
}

export default CaseworkToolsOverview
