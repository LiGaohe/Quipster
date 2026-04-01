import React from 'react'
import { Box, Button, Container, Typography } from '@mui/material'
import { Home } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        textAlign="center"
        gap={3}
      >
        <Typography
          variant="h1"
          fontWeight={900}
          sx={{
            fontSize: { xs: '6rem', sm: '9rem' },
            color: 'primary.main',
            lineHeight: 1,
            letterSpacing: '-4px',
          }}
        >
          404
        </Typography>

        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            页面不存在
          </Typography>
          <Typography variant="body1" color="text.secondary">
            你访问的页面已被删除或从未存在过
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<Home />}
          onClick={() => navigate('/')}
          sx={{ borderRadius: 3, px: 4 }}
        >
          回到首页
        </Button>
      </Box>
    </Container>
  )
}

export default NotFoundPage
