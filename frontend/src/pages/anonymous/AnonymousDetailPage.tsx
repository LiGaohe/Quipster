import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
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
import { ArrowBack, AutoAwesome, Comment, Favorite, FavoriteBorder, Refresh, Send, WarningAmber } from '@mui/icons-material'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { anonymousApi } from '@/api/anonymous'
import { useAppSelector } from '@/store/hooks'
import type { AnonymousComment, AnonymousPost, AnonymousSupportInfo } from '@/types'

const emotionColorMap: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  positive: 'success',
  neutral: 'default',
  anxiety: 'warning',
  stress: 'warning',
  sadness: 'error',
}

const auditLabelMap: Record<string, string> = {
  pending: '待审',
  passed: '通过',
  flagged: '已标记',
  rejected: '已拒绝',
}

const AnonymousDetailPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)

  const [post, setPost] = useState<AnonymousPost | null>(null)
  const [supportInfo, setSupportInfo] = useState<AnonymousSupportInfo | null>(null)
  const [comments, setComments] = useState<AnonymousComment[]>([])
  const [loadingPost, setLoadingPost] = useState(true)
  const [loadingComments, setLoadingComments] = useState(false)
  const [loadingSupport, setLoadingSupport] = useState(false)
  const [liking, setLiking] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [analyzingEmotion, setAnalyzingEmotion] = useState(false)

  const commentInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!postId) return
    const load = async () => {
      try {
        setLoadingPost(true)
        const res = await anonymousApi.getPost(postId)
        setPost(res.data.data ?? null)
      } catch {
        toast.error('加载帖子失败')
      } finally {
        setLoadingPost(false)
      }
    }
    load()
  }, [postId])

  useEffect(() => {
    if (!postId) return
    const load = async () => {
      try {
        setLoadingComments(true)
        const res = await anonymousApi.getComments(postId)
        setComments(res.data.data ?? [])
      } catch {
        setComments([])
      } finally {
        setLoadingComments(false)
      }
    }
    load()
  }, [postId])

  useEffect(() => {
    if (!postId) return
    const load = async () => {
      try {
        setLoadingSupport(true)
        const res = await anonymousApi.getSupportInfo(postId)
        setSupportInfo(res.data.data ?? null)
      } catch {
        setSupportInfo(null)
      } finally {
        setLoadingSupport(false)
      }
    }
    load()
  }, [postId])

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

  const handleAnalyzeEmotion = async () => {
    if (!postId || !post) return
    try {
      setAnalyzingEmotion(true)
      const res = await anonymousApi.analyzeEmotion(postId)
      const newSupportInfo = res.data.data ?? null
      setSupportInfo(newSupportInfo)
      if (newSupportInfo) {
        setPost({
          ...post,
          emotion_type: newSupportInfo.emotion_type ?? null,
          emotion_label: newSupportInfo.emotion_label ?? null,
          emotion_score: newSupportInfo.emotion_score ?? null,
          support_resources: newSupportInfo.support_resources,
        })
      }
      toast.success('情绪识别已更新')
    } catch {
      toast.error('情绪识别失败，请稍后重试')
    } finally {
      setAnalyzingEmotion(false)
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

  const emotionType = supportInfo?.emotion_type ?? post.emotion_type
  const emotionLabel = supportInfo?.emotion_label ?? post.emotion_label
  const emotionScore = supportInfo?.emotion_score ?? post.emotion_score
  const supportResources = supportInfo?.support_resources ?? post.support_resources ?? []

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {post.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          {formatTime(post.created_at)}
        </Typography>

        {post.tags && post.tags.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            {post.tags.map((tag) => (
              <Chip key={`${tag.id}-${tag.name}`} label={tag.name} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
          {post.content}
        </Typography>

        {post.audit_status && post.audit_status !== 'passed' && (
          <Box mt={1.5} display="flex" alignItems="center" gap={0.75}>
            <WarningAmber fontSize="small" color="warning" />
            <Typography variant="caption" color="warning.main">
              风险标记：{auditLabelMap[post.audit_status] ?? post.audit_status}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

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

      <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'warning.light', bgcolor: 'warning.50' }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} mb={1.5}>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <AutoAwesome color="warning" fontSize="small" />
              <Typography variant="h6" fontWeight={700}>AI 情绪识别</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              用于识别树洞文本中的情绪倾向，并在负面情绪较明显时提供支持建议。
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={analyzingEmotion ? <CircularProgress size={14} color="inherit" /> : <Refresh />}
            onClick={handleAnalyzeEmotion}
            disabled={analyzingEmotion}
          >
            重新识别
          </Button>
        </Box>

        {loadingSupport ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : emotionType ? (
          <>
            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mb={1.5}>
              <Chip
                label={emotionLabel ?? '已识别'}
                color={emotionColorMap[emotionType] ?? 'default'}
                size="small"
              />
              {typeof emotionScore === 'number' && (
                <Typography variant="body2" color="text.secondary">
                  置信度约 {(emotionScore * 100).toFixed(0)}%
                </Typography>
              )}
            </Box>

            {supportResources.length > 0 ? (
              <Box>
                {supportResources.map((item, index) => (
                  <Typography key={`${index}-${item.slice(0, 16)}`} variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                    {index + 1}. {item}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Alert severity="info">当前文本未触发额外支持建议。</Alert>
            )}

            {(supportInfo?.support_posts?.length ?? 0) > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>相关树洞</Typography>
                {supportInfo?.support_posts.map((item) => (
                  <Box
                    key={item.id}
                    onClick={() => navigate(`/anonymous/${item.id}`)}
                    sx={{
                      py: 0.5,
                      px: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="body2" color="primary.main">
                      • {item.title}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {(supportInfo?.support_events?.length ?? 0) > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>推荐活动</Typography>
                {supportInfo?.support_events.map((item) => (
                  <Box
                    key={item.id}
                    onClick={() => navigate(`/events/${item.id}`)}
                    sx={{
                      py: 0.5,
                      px: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="body2" color="primary.main">
                      • {item.title}{item.start_time ? ` · ${formatTime(item.start_time)}` : ''}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        ) : (
          <Alert severity="info">当前还没有生成情绪识别结果，你可以手动触发一次分析。</Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          评论 ({comments.length})
        </Typography>

        {loadingComments ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
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
                {comment.audit_status && comment.audit_status !== 'passed' && (
                  <Box mt={0.5} display="flex" alignItems="center" gap={0.5}>
                    <WarningAmber fontSize="inherit" color="warning" />
                    <Typography variant="caption" color="warning.main">
                      风险标记：{auditLabelMap[comment.audit_status] ?? comment.audit_status}
                    </Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  {timeAgo(comment.created_at)}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Paper>

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
