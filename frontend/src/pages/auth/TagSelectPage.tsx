import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Typography,
  Alert,
  LinearProgress,
} from '@mui/material'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { tagsApi } from '@/api/tags'
import type { Tag } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupedTags {
  category: string
  tags: Tag[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TagSelectPage() {
  const navigate = useNavigate()

  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loadingTags, setLoadingTags] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch all tags on mount
  useEffect(() => {
    let cancelled = false
    setLoadingTags(true)
    setFetchError(null)

    tagsApi
      .getAllTags()
      .then((res) => {
        if (!cancelled && res.data.data) {
          setAllTags(res.data.data)
        }
      })
      .catch(() => {
        if (!cancelled) setFetchError('获取标签失败，请刷新重试')
      })
      .finally(() => {
        if (!cancelled) setLoadingTags(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Group tags by category
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
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleFinish = async () => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      await tagsApi.setUserTags(Array.from(selectedIds))
      navigate('/', { replace: true })
    } catch {
      setSubmitError('保存失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    navigate('/', { replace: true })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1565C0 0%, #2196F3 50%, #64B5F6 100%)',
        p: { xs: 2, sm: 4 },
        pt: { xs: 4, sm: 6 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, sm: 5 },
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1565C0, #2196F3)',
              mb: 2,
              boxShadow: '0 4px 16px rgba(33,150,243,0.4)',
            }}
          >
            <LocalOfferOutlinedIcon sx={{ fontSize: 32, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={700} color="primary.dark" gutterBottom>
            选择兴趣标签
          </Typography>
          <Typography variant="body2" color="text.secondary">
            选择你感兴趣的话题，帮助我们为你推荐更合适的内容和伙伴
          </Typography>
        </Box>

        {/* Selected count indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            已选 {selectedIds.size} 个标签
          </Typography>
          {selectedIds.size > 0 && (
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
          value={Math.min((selectedIds.size / 5) * 100, 100)}
          sx={{ mb: 3, borderRadius: 2, height: 6 }}
          color={selectedIds.size >= 3 ? 'success' : 'primary'}
        />

        {/* Error states */}
        {fetchError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {fetchError}
          </Alert>
        )}
        {submitError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {submitError}
          </Alert>
        )}

        {/* Tag List */}
        {loadingTags ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {groupedTags.map((group, index) => (
              <Box key={group.category}>
                {index > 0 && <Divider sx={{ mb: 3 }} />}
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    display: 'block',
                    mb: 1.5,
                  }}
                >
                  {group.category}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {group.tags.map((tag) => {
                    const selected = selectedIds.has(tag.id)
                    return (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        clickable
                        onClick={() => toggleTag(tag.id)}
                        color={selected ? 'primary' : 'default'}
                        variant={selected ? 'filled' : 'outlined'}
                        icon={
                          selected ? (
                            <CheckCircleIcon fontSize="small" />
                          ) : undefined
                        }
                        sx={{
                          fontWeight: selected ? 600 : 400,
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            transform: 'translateY(-1px)',
                            boxShadow: selected
                              ? '0 4px 12px rgba(33,150,243,0.35)'
                              : '0 2px 8px rgba(0,0,0,0.1)',
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

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mt: 5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Button
            variant="outlined"
            fullWidth
            onClick={handleSkip}
            disabled={submitting}
            sx={{ py: 1.4 }}
          >
            跳过
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleFinish}
            disabled={submitting || loadingTags}
            sx={{ py: 1.4, fontSize: '1rem' }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : '完 成'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
