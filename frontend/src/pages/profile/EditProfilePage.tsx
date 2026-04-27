import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler, Controller } from 'react-hook-form'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  LinearProgress,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { usersApi } from '@/api/users'
import { tagsApi } from '@/api/tags'
import { updateUser } from '@/store/slices/authSlice'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import type { UpdateUserDto, Tag, UserTag } from '@/types'

// ─── Form field shape (mirrors UpdateUserDto + visibility as boolean) ─────────

interface EditProfileFormValues {
  nickname: string
  gender: string
  major: string
  grade: string
  bio: string
  visibility: boolean // true = public (1), false = private (0)
}

interface GroupedTags {
  category: string
  tags: Tag[]
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

  // 兴趣标签状态
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [loadingTags, setLoadingTags] = useState(true)
  const [tagsError, setTagsError] = useState<string | null>(null)

  // 按分类分组标签
  const groupedTags: GroupedTags[] = useMemo(() => {
    const map = new Map<string, Tag[]>()
    for (const tag of allTags) {
      const list = map.get(tag.category) ?? []
      list.push(tag)
      map.set(tag.category, list)
    }
    return Array.from(map.entries()).map(([category, tags]) => ({ category, tags }))
  }, [allTags])

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

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

  // 加载所有标签和用户已选标签
  useEffect(() => {
    if (!currentUser) return

    let cancelled = false
    setLoadingTags(true)
    setTagsError(null)

    Promise.all([
      tagsApi.getAllTags(),
      tagsApi.getUserTags(currentUser.id),
    ])
      .then(([allTagsRes, userTagsRes]) => {
        if (cancelled) return
        if (allTagsRes.data.data) {
          setAllTags(allTagsRes.data.data)
        }
        if (userTagsRes.data.data) {
          const userTagIds = (userTagsRes.data.data as UserTag[])
            .map((t) => t.tag_id)
            .filter((id): id is number => id !== null)
          setSelectedTagIds(new Set(userTagIds))
        }
      })
      .catch(() => {
        if (!cancelled) setTagsError('加载标签失败')
      })
      .finally(() => {
        if (!cancelled) setLoadingTags(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser])

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
      // 并行保存用户资料和兴趣标签
      await Promise.all([
        usersApi.updateUser(currentUser.id, dto),
        tagsApi.setUserTags(Array.from(selectedTagIds)),
      ])

      // 重新获取用户信息以更新 store
      const res = await usersApi.getUser(currentUser.id)
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
                  <MenuItem value="male">男</MenuItem>
                  <MenuItem value="female">女</MenuItem>
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

          {/* ── Interest Tags ── */}
          <Typography
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
          >
            兴趣标签
          </Typography>

          {tagsError && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {tagsError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              已选 {selectedTagIds.size} 个标签
            </Typography>
            {selectedTagIds.size > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  不错的选择！
                </Typography>
              </Box>
            )}
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min((selectedTagIds.size / 5) * 100, 100)}
            sx={{ mb: 2, borderRadius: 2, height: 6 }}
            color={selectedTagIds.size >= 3 ? 'success' : 'primary'}
          />

          {loadingTags ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groupedTags.map((group, index) => (
                <Box key={group.category}>
                  {index > 0 && <Divider sx={{ mb: 2 }} />}
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}
                  >
                    {group.category}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {group.tags.map((tag) => {
                      const selected = selectedTagIds.has(tag.id)
                      return (
                        <Chip
                          key={tag.id}
                          label={tag.name}
                          clickable
                          onClick={() => toggleTag(tag.id)}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          icon={selected ? <CheckCircleIcon fontSize="small" /> : undefined}
                          sx={{
                            fontWeight: selected ? 600 : 400,
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            },
                          }}
                        />
                      )
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

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
