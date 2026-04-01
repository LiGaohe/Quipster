import React, { useCallback, useEffect, useState } from 'react'
import {
  Avatar,
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
import { Add, CheckCircle, QuestionAnswer } from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { questionsApi } from '@/api/questions'
import { tagsApi } from '@/api/tags'
import { useAppSelector } from '@/store/hooks'
import type { CreateQuestionDto, GetQuestionsParams, Question, Tag } from '@/types'

type StatusFilter = 'all' | 'open' | 'closed'
type SortFilter = 'latest' | 'hotests'

// ─── Create Question Dialog ───────────────────────────────────────────────────

interface CreateQuestionDialogProps {
  open: boolean
  onClose: () => void
  allTags: Tag[]
  onCreated: () => void
}

const CreateQuestionDialog: React.FC<CreateQuestionDialogProps> = ({
  open,
  onClose,
  allTags,
  onCreated,
}) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleTagChange = (e: SelectChangeEvent<number[]>) => {
    setSelectedTags(e.target.value as number[])
  }

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('请填写问题标题'); return }
    if (!content.trim()) { toast.error('请填写问题内容'); return }
    try {
      setSubmitting(true)
      const dto: CreateQuestionDto = {
        title: title.trim(),
        content: content.trim(),
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      }
      await questionsApi.createQuestion(dto)
      toast.success('提问成功')
      setTitle('')
      setContent('')
      setSelectedTags([])
      onCreated()
      onClose()
    } catch {
      toast.error('提问失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>提问</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="问题标题 *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          inputProps={{ maxLength: 200 }}
          placeholder="请简洁描述你的问题..."
        />
        <TextField
          label="问题详情 *"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          fullWidth
          multiline
          rows={5}
          inputProps={{ maxLength: 2000 }}
          placeholder="详细描述你遇到的情况..."
        />
        {allTags.length > 0 && (
          <FormControl fullWidth size="small">
            <InputLabel>添加标签（可选）</InputLabel>
            <Select
              multiple
              value={selectedTags}
              onChange={handleTagChange}
              input={<OutlinedInput label="添加标签（可选）" />}
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
          {submitting ? <CircularProgress size={18} color="inherit" /> : '提交'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: Question
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question }) => {
  const navigate = useNavigate()

  const truncate = (text: string, max = 120) =>
    text.length > max ? text.slice(0, max) + '...' : text

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
    } catch {
      return iso
    }
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardActionArea onClick={() => navigate(`/questions/${question.id}`)}>
        <CardContent>
          {/* Title Row */}
          <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
            <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1, lineHeight: 1.4 }}>
              {question.title}
            </Typography>
            {question.has_accepted_answer && (
              <CheckCircle sx={{ color: 'success.main', flexShrink: 0, mt: 0.3 }} />
            )}
          </Box>

          {/* Content Truncated */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
            {truncate(question.content)}
          </Typography>

          {/* Tags */}
          {question.tags.length > 0 && (
            <Box display="flex" flexWrap="wrap" gap={0.5} mb={1.5}>
              {question.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
              ))}
            </Box>
          )}

          {/* Footer */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                src={question.user.avatar_url}
                sx={{ width: 22, height: 22, fontSize: 11 }}
              >
                {question.user.nickname[0]}
              </Avatar>
              <Typography variant="caption" color="text.secondary">
                {question.user.nickname}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {timeAgo(question.created_at)}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
              <QuestionAnswer fontSize="small" />
              <Typography variant="caption">{question.answer_count} 个回答</Typography>
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

// ─── Questions Page ───────────────────────────────────────────────────────────

const QuestionsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortFilter, setSortFilter] = useState<SortFilter>('latest')
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const currentUser = useAppSelector((state) => state.auth.user)

  // Load tags
  useEffect(() => {
    tagsApi.getAllTags().then((res) => {
      setAllTags(res.data.data ?? [])
    }).catch(() => {})
  }, [])

  const fetchQuestions = useCallback(
    async (reset = false) => {
      try {
        setLoading(true)
        const currentPage = reset ? 1 : page
        const params: GetQuestionsParams = {
          page: currentPage,
          limit: 15,
          sort: sortFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          tag_id: selectedTagId ?? undefined,
        }
        const res = await questionsApi.getQuestions(params)
        const newItems = res.data.data ?? []
        if (reset) {
          setQuestions(newItems)
          setPage(2)
        } else {
          setQuestions((prev) => [...prev, ...newItems])
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
    [statusFilter, sortFilter, selectedTagId, page]
  )

  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchQuestions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sortFilter, selectedTagId])

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>校园问答</Typography>
        {currentUser && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} size="small">
            提问
          </Button>
        )}
      </Box>

      {/* Filters Row */}
      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        {/* Status */}
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_e, v) => v && setStatusFilter(v)}
          size="small"
        >
          <ToggleButton value="all">全部</ToggleButton>
          <ToggleButton value="open">开放</ToggleButton>
          <ToggleButton value="closed">已解决</ToggleButton>
        </ToggleButtonGroup>

        {/* Sort */}
        <ToggleButtonGroup
          value={sortFilter}
          exclusive
          onChange={(_e, v) => v && setSortFilter(v)}
          size="small"
        >
          <ToggleButton value="latest">最新</ToggleButton>
          <ToggleButton value="hotests">最热</ToggleButton>
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
          {allTags.slice(0, 10).map((tag) => (
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

      {/* Questions */}
      {questions.length === 0 && !loading ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">暂无问题，来提第一个问题吧！</Typography>
        </Box>
      ) : (
        questions.map((q) => <QuestionCard key={q.id} question={q} />)
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      {!loading && hasMore && questions.length > 0 && (
        <Box display="flex" justifyContent="center" mt={2}>
          <Button variant="outlined" onClick={() => fetchQuestions(false)}>加载更多</Button>
        </Box>
      )}

      {!hasMore && questions.length > 0 && (
        <Box textAlign="center" mt={2}>
          <Typography variant="caption" color="text.secondary">已加载全部问题</Typography>
        </Box>
      )}

      <CreateQuestionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        allTags={allTags}
        onCreated={() => fetchQuestions(true)}
      />
    </Container>
  )
}

export default QuestionsPage
