import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler, Controller } from 'react-hook-form'
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { usersApi } from '@/api/users'
import { updateUser } from '@/store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { UpdateUserDto } from '@/types'

// ─── Form field shape (mirrors UpdateUserDto + visibility as boolean) ─────────

interface EditProfileFormValues {
  nickname: string
  gender: string
  major: string
  grade: string
  bio: string
  visibility: boolean // true = public (1), false = private (0)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const currentUser = useAppSelector((s) => s.auth.user)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileFormValues>({
    defaultValues: {
      nickname: '',
      gender: '',
      major: '',
      grade: '',
      bio: '',
      visibility: true,
    },
  })

  // Pre-fill form with current user data when it becomes available
  useEffect(() => {
    if (currentUser) {
      reset({
        nickname: currentUser.nickname ?? '',
        gender: currentUser.gender ?? '',
        major: currentUser.major ?? '',
        grade: currentUser.grade ?? '',
        bio: currentUser.bio ?? '',
        visibility: currentUser.visibility === 1,
      })
    }
  }, [currentUser, reset])

  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const onSubmit: SubmitHandler<EditProfileFormValues> = async (data) => {
    if (!currentUser) return
    setSubmitError(null)

    const dto: UpdateUserDto = {
      nickname: data.nickname || undefined,
      gender: data.gender || undefined,
      major: data.major || undefined,
      grade: data.grade || undefined,
      bio: data.bio || undefined,
      visibility: data.visibility ? 1 : 0,
    }

    try {
      const res = await usersApi.updateUser(currentUser.id, dto)
      if (res.data.data) {
        dispatch(updateUser(res.data.data))
      }
      navigate('/profile', { replace: true })
    } catch {
      setSubmitError('保存失败，请稍后重试')
    }
  }

  // Redirect if not logged in
  if (!currentUser) {
    navigate('/login', { replace: true })
    return null
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title="返回">
          <IconButton onClick={() => navigate(-1)} size="small">
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" fontWeight={700}>
          编辑资料
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          p: { xs: 2.5, sm: 4 },
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        }}
      >
        {submitError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {submitError}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
        >
          {/* ── Basic info ── */}
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            基本信息
          </Typography>

          <TextField
            label="昵称"
            fullWidth
            error={!!errors.nickname}
            helperText={errors.nickname?.message}
            {...register('nickname', {
              required: '昵称不能为空',
              minLength: { value: 2, message: '昵称至少 2 个字符' },
              maxLength: { value: 20, message: '昵称最多 20 个字符' },
            })}
          />

          {/* Gender select */}
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>性别</InputLabel>
                <Select label="性别" {...field}>
                  <MenuItem value="">保密</MenuItem>
                  <MenuItem value="男">男</MenuItem>
                  <MenuItem value="女">女</MenuItem>
                </Select>
              </FormControl>
            )}
          />

          <TextField
            label="专业"
            fullWidth
            placeholder="例如：计算机科学与技术"
            {...register('major')}
          />

          <TextField
            label="年级"
            fullWidth
            placeholder="例如：2022级"
            {...register('grade')}
          />

          <Divider />

          {/* ── Bio ── */}
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            个人简介
          </Typography>

          <TextField
            label="个人简介"
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            placeholder="介绍一下你自己…"
            inputProps={{ maxLength: 300 }}
            helperText={`${errors.bio?.message ?? '最多 300 字'}`}
            error={!!errors.bio}
            {...register('bio', {
              maxLength: { value: 300, message: '个人简介最多 300 字' },
            })}
          />

          <Divider />

          {/* ── Privacy ── */}
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            隐私设置
          </Typography>

          <Controller
            name="visibility"
            control={control}
            render={({ field }) => (
              <FormControl component="fieldset">
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="公开资料"
                />
                <FormHelperText>
                  {field.value
                    ? '其他用户可以搜索并查看你的个人资料'
                    : '你的资料对其他用户不可见'}
                </FormHelperText>
              </FormControl>
            )}
          />

          {/* ── Submit ── */}
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
              sx={{ py: 1.4 }}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveOutlinedIcon />
                )
              }
              sx={{ py: 1.4, fontSize: '1rem' }}
            >
              {isSubmitting ? '保存中…' : '保存'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
