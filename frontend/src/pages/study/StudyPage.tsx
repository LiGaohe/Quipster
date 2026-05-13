import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { Add, Group, Person } from '@mui/icons-material'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { studyApi } from '@/api/study'
import type { StudyTask } from '@/types'

type StatusFilter = 'all' | 'open' | 'closed'

interface CreateFormState {
  title: string
  description: string
  target_count: number | ''
}

const DEFAULT_FORM: CreateFormState = {
  title: '',
  description: '',
  target_count: 2,
}

interface StudyTaskCardProps {
  task: StudyTask
  onJoin: (taskId: string) => void
  joining: boolean
}

const StudyTaskCard: React.FC<StudyTaskCardProps> = ({ task, onJoin, joining }) => {
  const isFull = task.status === 'closed' || task.current_count >= task.target_count
  const progress =
    task.target_count > 0
      ? Math.min((task.current_count / task.target_count) * 100, 100)
      : 0

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={0.5}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{
              flex: 1,
              mr: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.title}
          </Typography>
          <Chip
            label={isFull ? '已满' : '招募中'}
            size="small"
            color={isFull ? 'default' : 'success'}
            sx={{ flexShrink: 0 }}
          />
        </Box>

        {task.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            mb={1}
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {task.description}
          </Typography>
        )}

        <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
          <Avatar
            src={task.creator.avatar_url}
            alt={task.creator.nickname}
            sx={{ width: 22, height: 22, fontSize: 12 }}
          >
            {task.creator.nickname?.[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {task.creator.nickname}
          </Typography>
        </Box>

        <Box mb={1}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.4}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Group fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                {task.current_count} / {task.target_count} 人
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={isFull ? 'inherit' : 'success'}
            sx={{ borderRadius: 4, height: 6 }}
          />
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {format(parseISO(task.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
          </Typography>
          <Button
            size="small"
            variant="contained"
            disabled={isFull || joining}
            onClick={() => onJoin(task.id)}
            startIcon={<Person />}
          >
            加入
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

const StudyPage: React.FC = () => {
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = useCallback(
    async (nextPage: number, replace: boolean) => {
      setLoading(true)
      try {
        const res = await studyApi.getTasks({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page: nextPage,
          limit: 10,
        })
        const list = res.data.data ?? []
        setTasks((prev) => (replace ? list : [...prev, ...list]))
        const pag = res.data.pagination
        setPage(nextPage)
        setHasMore(pag ? nextPage < pag.pages : false)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [statusFilter]
  )

  useEffect(() => {
    fetchTasks(1, true)
  }, [fetchTasks])

  const handleJoin = async (taskId: string) => {
    setJoiningId(taskId)
    try {
      const res = await studyApi.joinTask(taskId)
      if (res.data.success) {
        setSnackbar({ open: true, message: '加入成功', severity: 'success' })
        fetchTasks(1, true)
      } else {
        setSnackbar({ open: true, message: res.data.message ?? '加入失败', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: '加入失败，请稍后重试', severity: 'error' })
    } finally {
      setJoiningId(null)
    }
  }

  const handleCreateSubmit = async () => {
    if (!form.title.trim()) {
      setFormError('任务标题不能为空')
      return
    }
    if (form.target_count === '' || Number(form.target_count) < 2) {
      setFormError('目标人数至少为 2')
      return
    }
    setFormError('')
    setSubmitting(true)
    try {
      const res = await studyApi.createTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        target_count: Number(form.target_count),
      })
      if (res.data.success) {
        setSnackbar({ open: true, message: '任务发起成功', severity: 'success' })
        setDialogOpen(false)
        setForm(DEFAULT_FORM)
        fetchTasks(1, true)
      } else {
        setFormError(res.data.message ?? '发起失败')
      }
    } catch {
      setFormError('发起失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDialogClose = () => {
    if (submitting) return
    setDialogOpen(false)
    setForm(DEFAULT_FORM)
    setFormError('')
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          学习搭子
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="small"
          onClick={() => setDialogOpen(true)}
        >
          发起任务
        </Button>
      </Box>

      <Box mb={3}>
        <ToggleButtonGroup
          exclusive
          value={statusFilter}
          onChange={(_e, val) => val && setStatusFilter(val)}
          size="small"
          fullWidth
        >
          <ToggleButton value="all">全部</ToggleButton>
          <ToggleButton value="open">招募中</ToggleButton>
          <ToggleButton value="closed">已满</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && tasks.length === 0 && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {!loading && tasks.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="body1" color="text.secondary">
            暂无学习任务
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            点击"发起任务"招募你的学习搭子吧！
          </Typography>
        </Box>
      )}

      <Stack spacing={2}>
        {tasks.map((task) => (
          <StudyTaskCard
            key={task.id}
            task={task}
            onJoin={handleJoin}
            joining={joiningId === task.id}
          />
        ))}
      </Stack>

      {hasMore && !loading && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Button onClick={() => fetchTasks(page + 1, false)} variant="outlined" size="small">
            加载更多
          </Button>
        </Box>
      )}
      {loading && tasks.length > 0 && (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>发起学习任务</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="任务标题"
              required
              fullWidth
              size="small"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例：一起备考四六级"
            />
            <TextField
              label="任务描述"
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="详细描述一下你的学习计划..."
            />
            <TextField
              label="目标人数"
              required
              fullWidth
              size="small"
              type="number"
              inputProps={{ min: 2 }}
              value={form.target_count}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  target_count: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
              placeholder="至少 2 人"
            />
            {formError && (
              <Alert severity="error" sx={{ py: 0 }}>
                {formError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="contained" onClick={handleCreateSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={18} /> : '发起'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default StudyPage
