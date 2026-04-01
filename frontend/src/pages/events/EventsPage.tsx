import React, { useEffect, useState, useCallback } from 'react'
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  LinearProgress,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  Add,
  CalendarMonth,
  CheckCircle,
  LocationOn,
  People,
  Search,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { eventsApi } from '@/api/events'
import { useAppSelector } from '@/store/hooks'
import type { Event, CreateEventDto, GetEventsParams } from '@/types'

type StatusTab = 'all' | 'upcoming' | 'on_going' | 'ended'

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'upcoming', label: '即将开始' },
  { value: 'on_going', label: '进行中' },
  { value: 'ended', label: '已结束' },
]

// ─── Create Event Dialog ─────────────────────────────────────────────────────

interface CreateEventDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const CreateEventDialog: React.FC<CreateEventDialogProps> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState<CreateEventDto>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    max_participants: undefined,
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: keyof CreateEventDto) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = field === 'max_participants' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('请填写活动标题')
      return
    }
    if (!form.start_time) {
      toast.error('请选择开始时间')
      return
    }
    try {
      setSubmitting(true)
      const dto: CreateEventDto = {
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        start_time: form.start_time,
        end_time: form.end_time || undefined,
        location: form.location?.trim() || undefined,
        max_participants: form.max_participants,
      }
      await eventsApi.createEvent(dto)
      toast.success('活动创建成功')
      setForm({ title: '', description: '', start_time: '', end_time: '', location: '', max_participants: undefined })
      onCreated()
      onClose()
    } catch {
      toast.error('创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>创建活动</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="活动标题 *"
          value={form.title}
          onChange={handleChange('title')}
          fullWidth
          inputProps={{ maxLength: 100 }}
        />
        <TextField
          label="活动描述"
          value={form.description}
          onChange={handleChange('description')}
          fullWidth
          multiline
          rows={3}
          inputProps={{ maxLength: 500 }}
        />
        <TextField
          label="开始时间 *"
          type="datetime-local"
          value={form.start_time}
          onChange={handleChange('start_time')}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="结束时间"
          type="datetime-local"
          value={form.end_time}
          onChange={handleChange('end_time')}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="活动地点"
          value={form.location}
          onChange={handleChange('location')}
          fullWidth
          inputProps={{ maxLength: 200 }}
        />
        <TextField
          label="报名人数上限"
          type="number"
          value={form.max_participants ?? ''}
          onChange={handleChange('max_participants')}
          fullWidth
          inputProps={{ min: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>取消</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <CircularProgress size={18} color="inherit" /> : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

interface EventCardProps {
  event: Event
  onSignupChange: (eventId: string, signedUp: boolean, newCount: number) => void
}

const EventCard: React.FC<EventCardProps> = ({ event, onSignupChange }) => {
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)
  const [signing, setSigning] = useState(false)

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return iso
    }
  }

  const isFull =
    event.max_participants !== undefined &&
    event.current_participants >= event.max_participants

  const handleSignup = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentUser) {
      toast.info('请先登录')
      return
    }
    try {
      setSigning(true)
      await eventsApi.signupEvent(event.id)
      const newCount = event.is_signed_up
        ? event.current_participants - 1
        : event.current_participants + 1
      onSignupChange(event.id, !event.is_signed_up, newCount)
      toast.success(event.is_signed_up ? '已取消报名' : '报名成功')
    } catch {
      toast.error('操作失败，请重试')
    } finally {
      setSigning(false)
    }
  }

  const participantPercent =
    event.max_participants
      ? Math.min((event.current_participants / event.max_participants) * 100, 100)
      : null

  return (
    <Card
      sx={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
      onClick={() => navigate(`/events/${event.id}`)}
    >
      {event.cover_url ? (
        <CardMedia
          component="img"
          height={160}
          image={event.cover_url}
          alt={event.title}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            background: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalendarMonth sx={{ fontSize: 48, color: 'white', opacity: 0.7 }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h6" fontWeight={600} noWrap>
          {event.title}
        </Typography>

        <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
          <CalendarMonth fontSize="small" />
          <Typography variant="body2">{formatTime(event.start_time)}</Typography>
        </Box>

        {event.location && (
          <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
            <LocationOn fontSize="small" />
            <Typography variant="body2" noWrap>{event.location}</Typography>
          </Box>
        )}

        {/* Organizer */}
        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
          <Avatar
            src={event.organizer.avatar_url}
            sx={{ width: 24, height: 24, fontSize: 12 }}
          >
            {event.organizer.nickname[0]}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {event.organizer.nickname}
          </Typography>
        </Box>

        {/* Participants */}
        <Box mt="auto" pt={1}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
            <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
              <People fontSize="small" />
              <Typography variant="caption">
                {event.current_participants}
                {event.max_participants ? ` / ${event.max_participants}` : ''} 人
              </Typography>
            </Box>
            {isFull && (
              <Chip label="已满员" size="small" color="warning" variant="outlined" />
            )}
          </Box>
          {participantPercent !== null && (
            <LinearProgress
              variant="determinate"
              value={participantPercent}
              sx={{ borderRadius: 4, height: 4 }}
              color={participantPercent >= 90 ? 'warning' : 'primary'}
            />
          )}
        </Box>

        <Button
          variant={event.is_signed_up ? 'outlined' : 'contained'}
          size="small"
          startIcon={event.is_signed_up ? <CheckCircle /> : undefined}
          onClick={handleSignup}
          disabled={signing || (!event.is_signed_up && isFull)}
          sx={{ mt: 1 }}
          fullWidth
        >
          {signing ? (
            <CircularProgress size={16} color="inherit" />
          ) : event.is_signed_up ? (
            '已报名'
          ) : (
            '报名'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Events Page ──────────────────────────────────────────────────────────────

const EventsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState<StatusTab>('all')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchEvents = useCallback(
    async (reset = false) => {
      try {
        setLoading(true)
        const currentPage = reset ? 1 : page
        const params: GetEventsParams = {
          page: currentPage,
          limit: 12,
          keyword: keyword || undefined,
          status: tabValue === 'all' ? undefined : tabValue,
        }
        const res = await eventsApi.getEvents(params)
        const newItems = res.data.data ?? []
        if (reset) {
          setEvents(newItems)
          setPage(2)
        } else {
          setEvents((prev) => [...prev, ...newItems])
          setPage((p) => p + 1)
        }
        const { pagination } = res.data
        setHasMore(pagination ? currentPage < pagination.pages : false)
      } catch {
        toast.error('加载活动失败')
      } finally {
        setLoading(false)
      }
    },
    [tabValue, keyword, page]
  )

  // Reset and reload when tab or search changes
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchEvents(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, keyword])

  const handleSearch = () => {
    setKeyword(searchInput.trim())
  }

  const handleSignupChange = (eventId: string, signedUp: boolean, newCount: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, is_signed_up: signedUp, current_participants: newCount }
          : e
      )
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={700}>活动</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} size="small">
          创建活动
        </Button>
      </Box>

      {/* Status Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_e, v) => setTabValue(v as StatusTab)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {STATUS_TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} />
        ))}
      </Tabs>

      {/* Search */}
      <Box display="flex" gap={1} mb={3}>
        <TextField
          placeholder="搜索活动..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="outlined" size="small" onClick={handleSearch}>搜索</Button>
      </Box>

      {/* Events Grid */}
      {events.length === 0 && !loading ? (
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">暂无活动</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.id}>
              <EventCard event={event} onSignupChange={handleSignupChange} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Load More */}
      {!loading && hasMore && events.length > 0 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Button variant="outlined" onClick={() => fetchEvents(false)}>加载更多</Button>
        </Box>
      )}

      {!hasMore && events.length > 0 && (
        <Box textAlign="center" mt={3}>
          <Typography variant="caption" color="text.secondary">已加载全部活动</Typography>
        </Box>
      )}

      <CreateEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => fetchEvents(true)}
      />
    </Container>
  )
}

export default EventsPage
