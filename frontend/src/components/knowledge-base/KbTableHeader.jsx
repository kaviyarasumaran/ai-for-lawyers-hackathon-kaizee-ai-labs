import { Alert, Box, InputAdornment, TextField, Typography } from '@mui/material'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'

export default function KbTableHeader({
  activeFolderName,
  visibleCount,
  isFolder,
  search,
  onSearchChange,
  activeTasks = 0,
}) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          flexDirection: { xs: 'column', sm: 'row' },
          p: 2,
          borderBottom: '1px solid #eff0ec',
        }}
      >
        <Box>
          <Typography sx={{ color: '#303832', fontSize: 'body2.fontSize', fontWeight: 700 }}>
            {activeFolderName ?? 'All documents'}
          </Typography>
          <Typography sx={{ mt: 0.25, color: '#969d96', fontSize: 'caption.fontSize' }}>
            {visibleCount} document{visibleCount === 1 ? '' : 's'}
            {isFolder ? ' in this folder' : ' across your library'}
          </Typography>
        </Box>
        <TextField
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search documents"
          size="small"
          sx={{
            width: { xs: '100%', sm: 210 },
            '& .MuiInputBase-root': { height: 35, fontSize: 'body2.fontSize', bgcolor: '#fff' },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: '#9ba19b', fontSize: 17 }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {activeTasks > 0 && (
        <Alert
          icon={<UploadFileOutlinedIcon sx={{ fontSize: 17 }} />}
          severity="info"
          sx={{
            mx: 2,
            mt: 1.5,
            py: 0,
            border: '1px solid #e0eaf1',
            bgcolor: '#f5f9fb',
            color: '#536d7c',
            '& .MuiAlert-message': { fontSize: 'caption.fontSize' },
          }}
        >
          {activeTasks} document{activeTasks === 1 ? '' : 's'} being processed in the background. You can keep working.
        </Alert>
      )}
    </>
  )
}
