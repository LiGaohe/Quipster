import { Box, Typography, Paper } from '@mui/material'
import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1565C0 0%, #2196F3 50%, #64B5F6 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1.5,
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>Q</Typography>
        </Box>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, letterSpacing: 1 }}>
          Quipster
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
          同济大学校园兴趣社交平台
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.97)',
        }}
      >
        <Outlet />
      </Paper>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mt: 3 }}>
        © 2026 Quipster · 同济大学
      </Typography>
    </Box>
  )
}
