import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
  Alert,
  Stack,
} from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import StarOutlinedIcon from '@mui/icons-material/StarOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { usersApi } from '@/api/users'
import { tagsApi } from '@/api/tags'
import { useAppSelector } from '@/store/hooks'
import type { User, UserTag } from '@/types'

// ─── Credit badge colour helper ───────────────────────────────────────────────

function creditColor(score: number): 'success' | 'warning' | 'error' | 'default' {
  if (score >= 90) return 'success'
  if (score >= 60) return 'warning'
  if (score >= 30) return 'error'
  return 'default'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { userId } = useParams<{ userId?: string }>()
  const navigate = useNavigate()
  const currentUser = useAppSelector((s) => s.auth.user)

  // Resolve which user to display
  const targetId = userId ?? currentUser?.id ?? ''
  const isSelf = !userId || userId === currentUser?.id

  const [user, setUser] = useState<User | null>(null)
  const [tags, setTags] = useState<UserTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!targetId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([usersApi.getUser(targetId), tagsApi.getUserTags(targetId)])
      .then(([userRes, tagsRes]) => {
        if (cancelled) return
        if (userRes.data.data) setUser(userRes.data.data)
        if (tagsRes.data.data) setTags(tagsRes.data.data)
      })
      .catch(() => {
        if (!cancelled) setError('加载用户信息失败，请稍后重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [targetId])

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error ?? '用户不存在'}</Alert>
      </Box>
    )
  }

  const avatarLetter = user.nickname?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        }}
      >
        {/* Cover gradient */}
        <Box
          sx={{
            height: 120,
            background: 'linear-gradient(135deg, #1565C0 0%, #2196F3 60%, #64B5F6 100%)',
          }}
        />

        {/* Avatar + Edit button row */}
        <Box
          sx={{
            px: { xs: 2.5, sm: 4 },
            pb: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            mt: '-40px',
          }}
        >
          <Avatar
            src={user.avatar_url}
            alt={user.nickname}
            sx={{
              width: 88,
              height: 88,
              border: '4px solid #fff',
              fontSize: '2rem',
              bgcolor: 'primary.main',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {!user.avatar_url && avatarLetter}
          </Avatar>

          {isSelf && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditOutlinedIcon />}
              onClick={() => navigate('/profile/edit')}
              sx={{ mb: 1 }}
            >
              编辑资料
            </Button>
          )}
        </Box>

        {/* User info */}
        <Box sx={{ px: { xs: 2.5, sm: 4 }, pt: 2, pb: 3 }}>
          {/* Nickname & credit */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              mb: 0.5,
            }}
          >
            <Typography variant="h5" fontWeight={700}>
              {user.nickname}
            </Typography>
            <Chip
              icon={<StarOutlinedIcon fontSize="small" />}
              label={`信用分 ${user.credit_score}`}
              size="small"
              color={creditColor(user.credit_score)}
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          </Box>

          {/* Email */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {user.email}
          </Typography>

          {/* Meta info */}
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
            {user.major && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SchoolOutlinedIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {user.major}
                </Typography>
              </Box>
            )}
            {user.grade && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PersonOutlineIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {user.grade}
                </Typography>
              </Box>
            )}
            {user.gender && (
              <Typography variant="body2" color="text.secondary">
                {user.gender}
              </Typography>
            )}
          </Stack>

          {/* Bio */}
          {user.bio && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.7 }}>
                {user.bio}
              </Typography>
            </>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 1, display: 'block', mb: 1.5 }}
              >
                兴趣标签
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tags.map((t) => (
                  <Chip
                    key={t.tag_id}
                    label={t.tag_name}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}

          {/* Visibility note (self only) */}
          {isSelf && user.visibility === 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                你的资料目前设为不公开，其他用户无法搜索到你
              </Alert>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
