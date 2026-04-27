import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material'
import { Close, Favorite, FavoriteBorder } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { matchesApi } from '@/api/matches'
import type { MatchUser } from '@/types'

const CARD_TRANSITION = 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease'

type SlideDir = 'left' | 'right' | null

const MatchPage: React.FC = () => {
  const navigate = useNavigate()

  const [queue, setQueue] = useState<MatchUser[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [slideDir, setSlideDir] = useState<SlideDir>(null)
  const [matchedUser, setMatchedUser] = useState<MatchUser | null>(null)
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const [page, setPage] = useState(1)
  const [isFetching, setIsFetching] = useState(false)

  const loadMore = useCallback(async (nextPage: number) => {
    if (isFetching) return
    setIsFetching(true)
    setLoading(true)
    try {
      const res = await matchesApi.getMatches({ page: nextPage, limit: 10 })
      const newUsers = res.data.data ?? []
      if (newUsers.length === 0) {
        setNoMore(true)
      } else {
        setQueue((prev) => [...prev, ...newUsers])
        setPage(nextPage)
      }
    } catch {
      setNoMore(true)
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    loadMore(1)
  }, [loadMore])

  const current = queue[currentIndex]

  // Pre-load more when near end
  useEffect(() => {
    if (!noMore && queue.length - currentIndex <= 3 && !loading) {
      loadMore(page + 1)
    }
  }, [currentIndex, queue.length, noMore, loading, page, loadMore])

  const handleAction = async (action: 'like' | 'dislike') => {
    if (!current || actionLoading) return
    const dir: SlideDir = action === 'like' ? 'right' : 'left'
    setSlideDir(dir)
    setActionLoading(true)

    try {
      const res = await matchesApi.recordAction({
        target_user_id: current.user_id,
        action,
      })
      if (res.data.is_matched) {
        setMatchedUser(current)
        setMatchDialogOpen(true)
      }
    } catch {
      // ignore
    }

    // Wait for animation then advance
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setSlideDir(null)
      setActionLoading(false)
    }, 380)
  }

  const getCardTransform = () => {
    if (slideDir === 'left') return 'translateX(-120%) rotate(-20deg)'
    if (slideDir === 'right') return 'translateX(120%) rotate(20deg)'
    return 'translateX(0) rotate(0deg)'
  }

  const isExhausted = !loading && (noMore || currentIndex >= queue.length)

  return (
    <Container maxWidth="xs" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={700} textAlign="center" mb={3}>
        发现新朋友
      </Typography>

      {/* Empty state */}
      {isExhausted && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            暂时没有更多推荐啦
          </Typography>
          <Typography variant="body2" color="text.secondary">
            完善你的个人资料和兴趣标签，以获得更多匹配！
          </Typography>
          <Button
            variant="outlined"
            sx={{ mt: 3 }}
            onClick={() => navigate('/profile/edit')}
          >
            完善资料
          </Button>
        </Box>
      )}

      {/* Loading initial */}
      {loading && currentIndex >= queue.length && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* Card */}
      {current && (
        <Box
          sx={{
            position: 'relative',
            transition: CARD_TRANSITION,
            transform: getCardTransform(),
            opacity: slideDir ? 0 : 1,
            willChange: 'transform',
          }}
        >
          <Box
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: 4,
              bgcolor: 'background.paper',
              minHeight: 440,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Avatar section */}
            <Box
              sx={{
                bgcolor: 'primary.light',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 5,
              }}
            >
              <Avatar
                src={current.avatar_url}
                alt={current.nickname}
                sx={{ width: 100, height: 100, fontSize: 36, boxShadow: 3 }}
              >
                {current.nickname?.[0]?.toUpperCase()}
              </Avatar>
            </Box>

            {/* Info section */}
            <Box sx={{ p: 3, flex: 1 }}>
              <Typography variant="h5" fontWeight={700} textAlign="center" gutterBottom>
                {current.nickname}
              </Typography>

              {current.major && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                  mb={2}
                >
                  {current.major}
                </Typography>
              )}

              {/* Match score */}
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                gap={0.5}
                mb={2}
              >
                <Favorite sx={{ color: 'error.main', fontSize: 18 }} />
                <Typography variant="body2" fontWeight={600} color="error.main">
                  匹配度 {current.match_score}%
                </Typography>
              </Box>

              {/* Common tags */}
              {current.common_tags.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    mb={0.5}
                    textAlign="center"
                  >
                    共同兴趣
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.75} justifyContent="center">
                    {current.common_tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Action buttons */}
          <Box
            display="flex"
            justifyContent="center"
            gap={4}
            mt={3}
          >
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              disabled={actionLoading}
              onClick={() => handleAction('dislike')}
              sx={{
                borderRadius: '50%',
                minWidth: 64,
                minHeight: 64,
                fontSize: 26,
                p: 0,
              }}
            >
              <FavoriteBorder fontSize="large" sx={{ color: 'text.secondary' }} />
            </Button>

            <Button
              variant="contained"
              color="error"
              size="large"
              disabled={actionLoading}
              onClick={() => handleAction('like')}
              sx={{
                borderRadius: '50%',
                minWidth: 64,
                minHeight: 64,
                fontSize: 26,
                p: 0,
                boxShadow: 3,
              }}
            >
              <Favorite fontSize="large" />
            </Button>
          </Box>

          <Box display="flex" justifyContent="center" gap={6} mt={1}>
            <Typography variant="caption" color="text.secondary">
              跳过
            </Typography>
            <Typography variant="caption" color="error.main">
              感兴趣
            </Typography>
          </Box>
        </Box>
      )}

      {/* Match success dialog */}
      <Dialog
        open={matchDialogOpen}
        onClose={() => setMatchDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <IconButton
          size="small"
          onClick={() => setMatchDialogOpen(false)}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <Close />
        </IconButton>

        <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
          <Favorite sx={{ color: 'error.main', fontSize: 48 }} />
          <Typography variant="h5" fontWeight={700} mt={1}>
            匹配成功！
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ textAlign: 'center' }}>
          {matchedUser && (
            <>
              <Avatar
                src={matchedUser.avatar_url}
                alt={matchedUser.nickname}
                sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5 }}
              >
                {matchedUser.nickname?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body1">
                你和 <strong>{matchedUser.nickname}</strong> 互相感兴趣，可以开始聊天了！
              </Typography>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', pb: 3, gap: 1 }}>
          <Button variant="outlined" onClick={() => setMatchDialogOpen(false)}>
            继续浏览
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setMatchDialogOpen(false)
              navigate('/chat')
            }}
          >
            去聊天
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default MatchPage
