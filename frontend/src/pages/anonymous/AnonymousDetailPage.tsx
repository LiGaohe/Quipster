import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, Comment, Favorite, FavoriteBorder, Send } from '@mui/icons-material'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { anonymousApi } from '@/api/anonymous'
import { useAppSelector } from '@/store/hooks'
import type { AnonymousComment, AnonymousPost } from '@/types'

const AnonymousDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)

  const [post, setPost] = useState<AnonymousPost | null>(null)
  const [comments, setComments] = useState<AnonymousComment[]>([])
  const [loadingPost, setLoadingPost] = useState(true)
  const [liking, setLiking] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const commentInputRef = useRef<HTMLInputElement>(null)

  // Load post by scanning list (no dedicated GET /anonymous-posts/:id endpoint)
  useEffect(() => {
    if (!postId) return
    const load = async () => {
      try {
        setLoadingPost(true)
        // Load multiple pages if needed; for now fetch with high limit
        const res = await anonymousApi.getPosts({ limit: 100, sort: 'latest' })
        const found = (res.data.data ?? []).find((p) => p.id === postId) ?? null
        setPost(found)
      } catch {
        toast.error('加载失败')
      } finally {
        setLoadingPost(false)
      }
    }
    load()
  }, [postId])

  // Note: The current API does not expose a GET comments endpoint for anonymous posts.
  // Comments are submitted via POST and echoed back; we maintain a local list.
  // If a future API provides GET /anonymous-posts/:id/comments, replace this.

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return iso
    }
  }

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
    } catch {
      return iso
    }
  }

  const handleLike = async () => {
    if (!post) return
    if (!currentUser) { toast.info('请先登录'); return }
    try {
      setLiking(true)
      const res = await anonymousApi.likePost(post.id)
      setPost({ ...post, is_liked: res.data.is_liked, like_count: res.data.like_count })
    } catch {
      toast.error('操作失败')
    } finally {
      setLiking(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!post) return
    if (!currentUser) { toast.info('请先登录'); return }
    if (!commentText.trim()) return
    try {
      setSubmittingComment(true)
      const res = await anonymousApi.commentPost(post.id, commentText.trim())
      const newComment = res.data.data
      if (newComment) {
        setComments((prev) => [...prev, newComment])
        setPost({ ...post, comment_count: post.comment_count + 1 })
      }
      setCommentText('')
    } catch {
      toast.error('评论失败，请重试')
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loadingPost) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!post) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">帖子不存在或已被删除</Typography>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>

      {/* Post Content */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {post.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          {formatTime(post.created_at)}
        </Typography>

        {post.tags.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            {post.tags.map((tag) => (
              <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
          {post.content}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box display="flex" alignItems="center" gap={3}>
          <Box
            display="flex"
            alignItems="center"
            gap={0.5}
            onClick={handleLike}
            sx={{
              cursor: 'pointer',
              color: post.is_liked ? 'error.main' : 'text.secondary',
              '&:hover': { opacity: 0.8 },
            }}
          >
            {liking ? (
              <CircularProgress size={18} color="inherit" />
            ) : post.is_liked ? (
              <Favorite />
            ) : (
              <FavoriteBorder />
            )}
            <Typography variant="body2">{post.like_count}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
            <Comment />
            <Typography variant="body2">{post.comment_count}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Comments */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          评论 ({comments.length})
        </Typography>

        {comments.length === 0 ? (
          <Box py={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">暂无评论，来说点什么吧～</Typography>
          </Box>
        ) : (
          comments.map((comment, idx) => (
            <Box key={comment.id}>
              {idx > 0 && <Divider sx={{ my: 1.5 }} />}
              <Box py={1}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {comment.content}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  {timeAgo(comment.created_at)}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* Comment Input */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>发表评论</Typography>
        <Box display="flex" gap={1} alignItems="flex-end">
          <TextField
            inputRef={commentInputRef}
            placeholder={currentUser ? '说点什么吧（匿名）...' : '请先登录后评论'}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmitComment()
              }
            }}
            fullWidth
            multiline
            maxRows={4}
            disabled={!currentUser}
            size="small"
          />
          <Button
            variant="contained"
            endIcon={submittingComment ? <CircularProgress size={14} color="inherit" /> : <Send />}
            onClick={handleSubmitComment}
            disabled={!currentUser || !commentText.trim() || submittingComment}
            sx={{ flexShrink: 0 }}
          >
            发送
          </Button>
        </Box>
      </Paper>
    </Container>
  )
}

export default AnonymousDetailPage
