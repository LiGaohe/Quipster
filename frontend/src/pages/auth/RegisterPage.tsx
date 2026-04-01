import { useEffect, useState } from 'react'
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
  Snackbar,
} from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import SchoolIcon from '@mui/icons-material/School'
import { registerUser, clearError } from '@/store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { RegisterDto } from '@/types'

// ─── Component ───────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error } = useAppSelector((s) => s.auth)
  const [successOpen, setSuccessOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterDto>()

  useEffect(() => {
    dispatch(clearError())
  }, [dispatch])

  const onSubmit: SubmitHandler<RegisterDto> = async (data) => {
    const result = await dispatch(registerUser(data))
    if (registerUser.fulfilled.match(result)) {
      setSuccessOpen(true)
      // Navigate after the snackbar has been visible for a moment
      setTimeout(() => navigate('/login', { replace: true }), 2000)
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
            创建账号
          </Typography>
          <Typography variant="body2" color="text.secondary">
            加入同济大学校园社交平台
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
            label="昵称"
            fullWidth
            autoComplete="nickname"
            error={!!errors.nickname}
            helperText={errors.nickname?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            {...register('nickname', {
              required: '请输入昵称',
              minLength: { value: 2, message: '昵称至少 2 个字符' },
              maxLength: { value: 20, message: '昵称最多 20 个字符' },
            })}
          />

          <TextField
            label="密码"
            type="password"
            fullWidth
            autoComplete="new-password"
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
            {loading ? <CircularProgress size={24} color="inherit" /> : '注 册'}
          </Button>
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            已有账号？{' '}
            <Link
              component={RouterLink}
              to="/login"
              underline="hover"
              fontWeight={600}
              color="primary"
            >
              去登录
            </Link>
          </Typography>
        </Box>
      </Paper>

      {/* Success Snackbar */}
      <Snackbar
        open={successOpen}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%', borderRadius: 2 }}>
          注册成功，请查收验证邮件
        </Alert>
      </Snackbar>
    </Box>
  )
}
