import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  SelectChangeEvent,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { Add, Comment, Favorite, FavoriteBorder, WarningAmber } from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { anonymousApi } from '@/api/anonymous'
import { tagsApi } from '@/api/tags'
import { useAppSelector } from '@/store/hooks'
import type { AnonymousPost, CreateAnonymousPostDto, GetAnonymousPostsParams, Tag } from '@/types'

const emotionChipColorMap: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
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

// ─── Create Post Dialog ───────────────────────────────────────────────────────

interface CreatePostDialogProps {
  open: boolean
  onClose: () => void
  allTags: Tag[]
  onCreated: () => void
}

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({ open, onClose, allTags, onCreated }) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleTagChange = (e: SelectChangeEvent<number[]>) => {
    setSelectedTags(e.target.value as number[])
  }

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('请填写标题'); return }
    if (!content.trim()) { toast.error('请填写内容'); return }
    try {
      setSubmitting(true)
      const dto: CreateAnonymousPostDto = {
        title: title.trim(),
        content: content.trim(),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      }
      await anonymousApi.createPost(dto)
      toast.success('发布成功')
      setTitle('')
      setContent('')
      setSelectedTags([])
      onCreated()
      onClose()
    } catch {
      toast.error('发布失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>发布树洞</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="标题 *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          inputProps={{ maxLength: 100 }}
        />
        <TextField
          label="内容 *"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          fullWidth
          multiline
          rows={5}
          inputProps={{ maxLength: 2000 }}
        />
        {allTags.length > 0 && (
          <FormControl fullWidth size="small">
            <InputLabel>选择标签（可多选）</InputLabel>
            <Select
              multiple
              value={selectedTags}
              onChange={handleTagChange}
              input={<OutlinedInput label="选择标签（可多选）" />}
              renderValue={(selected) =>
                allTags
                  .filter((t) => (selected as number[]).includes(t.id))
                  .map((t) => t.name)
                  .join(', ')
              }
            >
              {allTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>{tag.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={18} color="inherit" /> : '发布'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: AnonymousPost
  onLikeChange: (postId: string, isLiked: boolean, count: number) => void
}

const AnonPostCard: React.FC<PostCardProps> = ({ post, onLikeChange }) => {
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)
  const [liking, setLiking] = useState(false)

  const truncate = (text: string, max = 100) =>
    text.length > max ? text.slice(0, max) + '...' : text

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
    } catch {
      return iso
    }
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentUser) { toast.info('请先登录'); return }
    try {
      setLiking(true)
      const res = await anonymousApi.likePost(post.id)
      onLikeChange(post.id, res.data.is_liked, res.data.like_count)
    } catch {
      toast.error('操作失败')
    } finally {
      setLiking(false)
    }
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardActionArea onClick={() => navigate(`/anonymous/${post.id}`)}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom noWrap>
            {post.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
            {truncate(post.content)}
          </Typography>

          {post.tags && post.tags.length > 0 && (
            <Box display="flex" flexWrap="wrap" gap={0.5} mb={1.5}>
              {post.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
              ))}
            </Box>
          )}

          {post.emotion_type && post.emotion_label && (
            <Box mb={1.5}>
              <Chip
                label={`情绪：${post.emotion_label}`}
                size="small"
                color={emotionChipColorMap[post.emotion_type] ?? 'default'}
              />
            </Box>
          )}

          {post.audit_status && post.audit_status !== 'passed' && (
            <Box mb={1.5} display="flex" alignItems="center" gap={0.75}>
              <WarningAmber fontSize="small" color="warning" />
              <Typography variant="caption" color="warning.main">
                风险标记：{auditLabelMap[post.audit_status] ?? post.audit_status}
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {timeAgo(post.created_at)}
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                onClick={handleLike}
                sx={{ cursor: 'pointer', color: post.is_liked ? 'error.main' : 'text.secondary' }}
              >
                {liking ? (
                  <CircularProgress size={16} color="inherit" />
                ) : post.is_liked ? (
                  <Favorite fontSize="small" />
                ) : (
                  <FavoriteBorder fontSize="small" />
                )}
                <Typography variant="caption">{post.like_count}</Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
                <Comment fontSize="small" />
                <Typography variant="caption">{post.comment_count}</Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

// ─── Anonymous Page ───────────────────────────────────────────────────────────

const AnonymousPage: React.FC = () => {
  const [sort, setSort] = useState<'latest' | 'popular'>('latest')
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [posts, setPosts] = useState<AnonymousPost[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Load tags once
  useEffect(() => {
    tagsApi.getAllTags().then((res) => {
      setAllTags((res.data.data ?? []).slice(0, 10))
    }).catch(() => {})
  }, [])

  const fetchPosts = useCallback(
    async (reset = false) => {
      try {
        setLoading(true)
        const currentPage = reset ? 1 : page
        const params: GetAnonymousPostsParams = {
          page: currentPage,
          limit: 15,
          sort,
          tag_id: selectedTagId ?? undefined,
        }
        const res = await anonymousApi.getPosts(params)
        const newItems = res.data.data ?? []
        if (reset) {
          setPosts(newItems)
          setPage(2)
        } else {
          setPosts((prev) => [...prev, ...newItems])
          setPage((p) => p + 1)
        }
        const { pagination } = res.data
        setHasMore(pagination ? currentPage < pagination.pages : false)
      } catch {
        toast.error('加载失败')
      } finally {
        setLoading(false)
      }
    },
    [sort, selectedTagId, page]
  )

  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchPosts(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, selectedTagId])

  const handleLikeChange = (postId: string, isLiked: boolean, count: number) => {
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, is_liked: isLiked, like_count: count } : p)
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>匿名树洞</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} size="small">
          发布树洞
        </Button>
      </Box>

      {/* Sort Toggle */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <ToggleButtonGroup
          value={sort}
          exclusive
          onChange={(_e, v) => v && setSort(v)}
          size="small"
        >
          <ToggleButton value="latest">最新</ToggleButton>
          <ToggleButton value="popular">热门</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
          <Chip
            label="全部"
            onClick={() => setSelectedTagId(null)}
            color={selectedTagId === null ? 'primary' : 'default'}
            variant={selectedTagId === null ? 'filled' : 'outlined'}
            size="small"
          />
          {allTags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.name}
              onClick={() => setSelectedTagId(tag.id === selectedTagId ? null : tag.id)}
              color={selectedTagId === tag.id ? 'primary' : 'default'}
              variant={selectedTagId === tag.id ? 'filled' : 'outlined'}
              size="small"
            />
          ))}
        </Box>
      )}

      {/* Posts */}
      {posts.length === 0 && !loading ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">暂无内容，快来发布第一条树洞吧！</Typography>
        </Box>
      ) : (
        posts.map((post) => (
          <AnonPostCard key={post.id} post={post} onLikeChange={handleLikeChange} />
        ))
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && hasMore && posts.length > 0 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Button variant="outlined" onClick={() => fetchPosts(false)}>加载更多</Button>
        </Box>
      )}

      {!hasMore && posts.length > 0 && (
        <Box textAlign="center" mt={2}>
          <Typography variant="caption" color="text.secondary">已经到底了～</Typography>
        </Box>
      )}

      <CreatePostDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        allTags={allTags}
        onCreated={() => fetchPosts(true)}
      />
    </Container>
  )
}

export default AnonymousPage
