import { useEffect } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Link,
  Paper,
  InputAdornment,
} from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import SchoolIcon from '@mui/icons-material/School'
import { loginUser, clearError } from '@/store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { LoginDto } from '@/types'

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, user } = useAppSelector((s) => s.auth)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>()

  // Redirect away if already logged in
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // Clear stale errors when component mounts
  useEffect(() => {
    dispatch(clearError())
  }, [dispatch])

  const onSubmit: SubmitHandler<LoginDto> = async (data) => {
    const result = await dispatch(loginUser(data))
    if (loginUser.fulfilled.match(result)) {
      navigate('/', { replace: true })
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1565C0 0%, #2196F3 50%, #64B5F6 100%)',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 4,
          p: { xs: 3, sm: 5 },
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* Logo & Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1565C0, #2196F3)',
              mb: 2,
              boxShadow: '0 4px 16px rgba(33,150,243,0.4)',
            }}
          >
            <SchoolIcon sx={{ fontSize: 40, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} color="primary.dark" gutterBottom>
            Quipster
          </Typography>
          <Typography variant="body2" color="text.secondary">
            同济大学校园社交平台
          </Typography>
        </Box>

        {/* Error Banner */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
        >
          <TextField
            label="同济邮箱"
            type="email"
            fullWidth
            autoComplete="email"
            autoFocus
            error={!!errors.email}
            helperText={errors.email?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            {...register('email', {
              required: '请输入邮箱',
              pattern: {
                value: /^[^\s@]+@(stu\.)?tongji\.edu\.cn$/i,
                message: '请使用同济大学邮箱（@tongji.edu.cn 或 @stu.tongji.edu.cn）',
              },
            })}
          />

          <TextField
            label="密码"
            type="password"
            fullWidth
            autoComplete="current-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            {...register('password', {
              required: '请输入密码',
              minLength: { value: 6, message: '密码至少 6 位' },
            })}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={loading}
            sx={{ mt: 0.5, py: 1.5, fontSize: '1rem' }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '登 录'}
          </Button>
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            还没有账号？{' '}
            <Link
              component={RouterLink}
              to="/register"
              underline="hover"
              fontWeight={600}
              color="primary"
            >
              去注册
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
