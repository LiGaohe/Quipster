import React, { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material'
import {
  ArrowBack,
  CalendarMonth,
  CheckCircle,
  LocationOn,
  People,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { eventsApi } from '@/api/events'
import { useAppSelector } from '@/store/hooks'
import type { Event } from '@/types'

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    if (!eventId) return
    const load = async () => {
      try {
        setLoading(true)
        // Fetch single event by loading the events list and finding the matching one.
        // (No dedicated GET /events/:id endpoint in current API — fetch list with large limit
        //  and find the item, or just load the first page and rely on list state.)
        const res = await eventsApi.getEvents({ limit: 100 })
        const found = (res.data.data ?? []).find((e) => e.id === eventId) ?? null
        setEvent(found)
      } catch {
        toast.error('加载活动详情失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId])

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return iso
    }
  }

  const handleSignup = async () => {
    if (!event) return
    if (!currentUser) {
      toast.info('请先登录')
      return
    }
    try {
      setSigning(true)
      await eventsApi.signupEvent(event.id)
      const newSignedUp = !event.is_signed_up
      const newCount = newSignedUp
        ? event.current_participants + 1
        : event.current_participants - 1
      setEvent({ ...event, is_signed_up: newSignedUp, current_participants: newCount })
      toast.success(newSignedUp ? '报名成功' : '已取消报名')
    } catch {
      toast.error('操作失败，请重试')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!event) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">活动不存在或已被删除</Typography>
        </Box>
      </Container>
    )
  }

  const isFull =
    event.max_participants !== undefined &&
    event.current_participants >= event.max_participants

  const participantPercent =
    event.max_participants
      ? Math.min((event.current_participants / event.max_participants) * 100, 100)
      : null

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>

      {/* Cover */}
      {event.cover_url ? (
        <Box
          component="img"
          src={event.cover_url}
          alt={event.title}
          sx={{
            width: '100%',
            height: { xs: 200, sm: 320 },
            objectFit: 'cover',
            borderRadius: 3,
            mb: 3,
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: { xs: 200, sm: 320 },
            background: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)',
            borderRadius: 3,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalendarMonth sx={{ fontSize: 80, color: 'white', opacity: 0.6 }} />
        </Box>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        {/* Title */}
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {event.title}
        </Typography>

        {/* Time */}
        <Box display="flex" alignItems="center" gap={1} mb={1.5} color="text.secondary">
          <CalendarMonth />
          <Box>
            <Typography variant="body1">
              开始：{formatTime(event.start_time)}
            </Typography>
            {event.end_time && (
              <Typography variant="body1">
                结束：{formatTime(event.end_time)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Location */}
        {event.location && (
          <Box display="flex" alignItems="center" gap={1} mb={2} color="text.secondary">
            <LocationOn />
            <Typography variant="body1">{event.location}</Typography>
          </Box>
        )}

        {/* Description */}
        {event.description && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {event.description}
            </Typography>
          </>
        )}
      </Paper>

      {/* Organizer */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>主办方</Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar src={event.organizer.avatar_url} sx={{ width: 48, height: 48 }}>
            {event.organizer.nickname[0]}
          </Avatar>
          <Box>
            <Typography fontWeight={600}>{event.organizer.nickname}</Typography>
            {event.organizer.major && (
              <Typography variant="caption" color="text.secondary">{event.organizer.major}</Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Participants */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>报名情况</Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <People color="action" />
            <Typography>
              已报名 <strong>{event.current_participants}</strong>
              {event.max_participants ? ` / ${event.max_participants}` : ''} 人
            </Typography>
          </Box>
          {isFull && <Chip label="已满员" color="warning" size="small" />}
        </Box>
        {participantPercent !== null && (
          <LinearProgress
            variant="determinate"
            value={participantPercent}
            sx={{ borderRadius: 4, height: 8 }}
            color={participantPercent >= 90 ? 'warning' : 'primary'}
          />
        )}

        <Button
          variant={event.is_signed_up ? 'outlined' : 'contained'}
          size="large"
          startIcon={event.is_signed_up ? <CheckCircle /> : undefined}
          onClick={handleSignup}
          disabled={signing || (!event.is_signed_up && isFull)}
          sx={{ mt: 2 }}
          fullWidth
        >
          {signing ? (
            <CircularProgress size={20} color="inherit" />
          ) : event.is_signed_up ? (
            '取消报名'
          ) : (
            '立即报名'
          )}
        </Button>
      </Paper>
    </Container>
  )
}

export default EventDetailPage
