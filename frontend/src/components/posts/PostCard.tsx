import React, { useEffect, useState } from 'react'
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Avatar,
  IconButton,
  Typography,
  Box,
  Collapse,
  Divider,
  TextField,
  Button,
  ImageList,
  ImageListItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  FavoriteBorder,
  Favorite,
  ChatBubbleOutline,
  FlagOutlined,
  Send,
  WarningAmber,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { toggleLike, addComment } from '@/store/slices/postsSlice'
import { governanceApi } from '@/api/governance'
import { postsApi } from '@/api/posts'
import type { Post, Comment } from '@/types'

interface PostCardProps {
  post: Post
}

const REPORT_REASONS = [
  '垃圾广告',
  '不实信息',
  '涉黄/涉暴',
  '人身攻击',
  '其他违规',
]

const auditLabelMap: Record<string, string> = {
  pending: '待审',
  passed: '通过',
  flagged: '已标记',
  rejected: '已拒绝',
}

const auditColorMap: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  pending: 'default',
  passed: 'success',
  flagged: 'warning',
  rejected: 'error',
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)

  const formattedDate = (() => {
    try {
      return format(new Date(post.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })
    } catch {
      return post.created_at
    }
  })()

  useEffect(() => {
    if (commentsOpen && comments.length === 0) {
      fetchComments()
    }
  }, [commentsOpen])

  const fetchComments = async () => {
    setCommentsLoading(true)
    try {
      const res = await postsApi.getComments(post.id)
      if (res.data.data) {
        setComments(res.data.data)
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleLike = async () => {
    if (likeLoading) return
    setLikeLoading(true)
    try {
      await dispatch(toggleLike(post.id))
    } finally {
      setLikeLoading(false)
    }
  }

  const handleCommentSubmit = async () => {
    const trimmed = commentText.trim()
    if (!trimmed) return
    setCommentSubmitting(true)
    try {
      const result = await dispatch(addComment({ postId: post.id, content: trimmed }))
      if (addComment.fulfilled.match(result)) {
        const newComment = result.payload.comment as Comment
        setComments((prev) => [...prev, newComment])
        setCommentText('')
      }
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleReportSubmit = async () => {
    if (!reportReason) return
    setReportSubmitting(true)
    try {
      await governanceApi.report({
        target_type: 'post',
        target_id: post.id,
        reason: reportReason,
        description: reportDescription || undefined,
      })
      setReportSuccess(true)
    } catch {
      // ignore
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleReportClose = () => {
    setReportOpen(false)
    setReportReason('')
    setReportDescription('')
    setReportSuccess(false)
  }

  return (
    <>
      <Card sx={{ mb: 2, borderRadius: 2, boxShadow: 1 }}>
        <CardHeader
          avatar={
            <Avatar
              src={post.user.avatar_url}
              alt={post.user.nickname}
              sx={{ cursor: 'pointer' }}
              onClick={() => navigate(`/profile/${post.user.id}`)}
            >
              {post.user.nickname?.[0]?.toUpperCase()}
            </Avatar>
          }
          title={
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate(`/profile/${post.user.id}`)}
            >
              {post.user.nickname}
            </Typography>
          }
          subheader={
            <Typography variant="caption" color="text.secondary">
              {formattedDate}
            </Typography>
          }
          action={
            <Tooltip title="举报">
              <IconButton size="small" onClick={() => setReportOpen(true)}>
                <FlagOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />

        <CardContent sx={{ pt: 0 }}>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.content}
          </Typography>

          {post.audit_status && post.audit_status !== 'passed' && (
            <Box mt={1} display="flex" alignItems="center" gap={1}>
              <WarningAmber fontSize="small" color="warning" />
              <Typography variant="caption" color="warning.main">
                风险标记：{auditLabelMap[post.audit_status] ?? post.audit_status}
              </Typography>
            </Box>
          )}

          {post.images && post.images.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <ImageList
                cols={post.images.length === 1 ? 1 : post.images.length === 2 ? 2 : 3}
                gap={4}
                sx={{ mt: 0, mb: 0 }}
              >
                {post.images.map((src, idx) => (
                  <ImageListItem key={idx}>
                    <img
                      src={src}
                      alt={`图片${idx + 1}`}
                      loading="lazy"
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}
        </CardContent>

        <Divider />

        <CardActions sx={{ px: 2, py: 0.5 }}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <IconButton
              size="small"
              onClick={handleLike}
              disabled={likeLoading}
              color={post.is_liked ? 'error' : 'default'}
            >
              {post.is_liked ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {post.like_count}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={0.5} ml={1}>
            <IconButton
              size="small"
              onClick={() => setCommentsOpen((prev) => !prev)}
            >
              <ChatBubbleOutline fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {post.comment_count}
            </Typography>
          </Box>
        </CardActions>

        <Collapse in={commentsOpen} timeout="auto" unmountOnExit>
          <Divider />
          <Box sx={{ px: 2, py: 1.5 }}>
            {commentsLoading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={20} />
              </Box>
            ) : (
              <>
                {comments.length > 0 && (
                  <Box mb={2}>
                    {comments.map((comment, idx) => (
                      <Box key={comment.id}>
                        {idx > 0 && <Divider sx={{ my: 1 }} />}
                        <Box display="flex" alignItems="flex-start" gap={1} py={0.5}>
                          <Avatar
                            src={comment.user.avatar_url}
                            alt={comment.user.nickname}
                            sx={{ width: 24, height: 24, fontSize: 12 }}
                          >
                            {comment.user.nickname?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box flex={1}>
                            <Typography variant="caption" fontWeight={600} display="block">
                              {comment.user.nickname}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
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
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                              {format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box display="flex" gap={1} alignItems="flex-start">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="写下你的评论..."
                    multiline
                    maxRows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    inputProps={{ maxLength: 200 }}
                  />
                  <IconButton
                    color="primary"
                    onClick={handleCommentSubmit}
                    disabled={commentSubmitting || !commentText.trim()}
                    size="small"
                    sx={{ mt: 0.5 }}
                  >
                    {commentSubmitting ? <CircularProgress size={18} /> : <Send fontSize="small" />}
                  </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {commentText.length}/200
                </Typography>
              </>
            )}
          </Box>
        </Collapse>
      </Card>

      {/* 举报 Dialog */}
      <Dialog open={reportOpen} onClose={handleReportClose} maxWidth="xs" fullWidth>
        <DialogTitle>举报该动态</DialogTitle>
        <DialogContent>
          {reportSuccess ? (
            <Typography color="success.main">举报已提交，感谢你的反馈！</Typography>
          ) : (
            <>
              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                <InputLabel>举报原因</InputLabel>
                <Select
                  value={reportReason}
                  label="举报原因"
                  onChange={(e) => setReportReason(e.target.value)}
                >
                  {REPORT_REASONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                label="补充说明（可选）"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                sx={{ mt: 2 }}
                inputProps={{ maxLength: 200 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReportClose}>
            {reportSuccess ? '关闭' : '取消'}
          </Button>
          {!reportSuccess && (
            <Button
              variant="contained"
              color="error"
              onClick={handleReportSubmit}
              disabled={reportSubmitting || !reportReason}
            >
              {reportSubmitting ? <CircularProgress size={18} /> : '提交举报'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

export default PostCard
