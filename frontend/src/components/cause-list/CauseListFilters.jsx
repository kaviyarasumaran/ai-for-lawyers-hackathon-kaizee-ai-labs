import {
  Box,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded'

export default function CauseListFilters({
  searchQuery,
  onSearchChange,
  selectedCourt,
  onCourtChange,
  selectedCategory,
  onCategoryChange,
  selectedSession,
  onSessionChange,
  courts = [],
  totalFiltered,
  totalItems,
}) {
  const categories = [
    { id: 'all', label: 'All Listings' },
    { id: 'admission', label: 'Motions & Admissions' },
    { id: 'orders', label: 'For Orders' },
    { id: 'final', label: 'Final Hearing' },
    { id: 'special', label: 'Specially Ordered' },
  ]

  const sessions = [
    { id: 'all', label: 'All Sessions' },
    { id: 'morning', label: 'Morning (10:30 AM)' },
    { id: 'afternoon', label: 'Afternoon (02:15 PM)' },
  ]

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2.5,
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        borderColor: 'divider',
      }}
    >
      {/* Top Search & Court Selection Row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 1.75 }}>
        <TextField
          size="small"
          placeholder="Search case number, party, counsel, item number, or judge..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                fontSize: '0.875rem',
                minWidth: { xs: '100%', sm: 340, md: 460 },
              },
            },
          }}
          sx={{ flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontWeight: 500 }}>
            Court:
          </Typography>
          <Select
            size="small"
            value={selectedCourt}
            onChange={(e) => onCourtChange(e.target.value)}
            sx={{
              minWidth: 160,
              borderRadius: 2,
              fontSize: '0.8125rem',
              height: 38,
            }}
          >
            <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}>
              All Court Halls ({courts.length})
            </MenuItem>
            {courts.map((court) => (
              <MenuItem key={court} value={court} sx={{ fontSize: '0.8125rem' }}>
                {court}
              </MenuItem>
            ))}
          </Select>
        </Box>

        <Typography sx={{ ml: 'auto', fontSize: '0.8125rem', color: 'text.secondary' }}>
          Showing <strong>{totalFiltered}</strong> of {totalItems} items
        </Typography>
      </Box>

      {/* Category Tabs & Session Filter */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={selectedCategory}
          onChange={(_, val) => onCategoryChange(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'none',
              px: 1.5,
              py: 0.5,
            },
          }}
        >
          {categories.map((cat) => (
            <Tab key={cat.id} value={cat.id} label={cat.label} />
          ))}
        </Tabs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {sessions.map((sess) => (
            <Chip
              key={sess.id}
              label={sess.label}
              size="small"
              clickable
              color={selectedSession === sess.id ? 'primary' : 'default'}
              variant={selectedSession === sess.id ? 'filled' : 'outlined'}
              onClick={() => onSessionChange(sess.id)}
              sx={{ fontSize: '0.75rem', height: 26 }}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  )
}
