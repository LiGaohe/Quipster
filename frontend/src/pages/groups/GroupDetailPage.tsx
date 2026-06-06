import React, { useEffect, useState, useRef } from 'react'
import {
  Avatar,
  AvatarGroup,
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
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  TextField,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material'
import {
  ArrowBack,
  CalendarMonth,
  CheckCircle,
  Edit,
  Group,
  LocationOn,
  People,
  PersonAdd,
  PersonRemove,
  Chat,
  Add,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { groupsApi } from '@/api/groups'
import { eventsApi } from '@/api/events'
import { supabase } from '@/lib/supabase'
import type { Group as GroupType, GroupMember, Event, CreateEventDto } from '@/types'

const CoverSkeleton: React.FC = () => (
  <Skeleton variant="rectangular" width="100%" height={200} />
)

interface EditDialogProps {
  open: boolean
  onClose: () => void
  group: GroupType | null
  onSuccess: () => void
}

const EditDialog: React.FC<EditDialogProps> = ({ open, onClose, group, onSuccess }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description ?? '')
      setAvatarUrl(group.avatar_url ?? '')
    }
  }, [group])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `group-avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!group || !name.trim()) return

    setLoading(true)
    try {
      await groupsApi.updateGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        avatar_url: avatarUrl || undefined,
      })
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Update error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>编辑社群</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={avatarUrl}
              sx={{ width: 64, height: 64, cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Group />
            </Avatar>
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '上传中...' : '更换头像'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileSelect}
            />
          </Box>

          <TextField
            label="社群名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={!name.trim()}
            helperText={!name.trim() ? '社群名称不能为空' : ''}
          />

          <TextField
            label="社群描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface CreateEventDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  groupId: number
}

const CreateEventDialog: React.FC<CreateEventDialogProps> = ({ open, onClose, onCreated, groupId }) => {
  const [form, setForm] = useState<CreateEventDto>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    max_participants: undefined,
    group_id: groupId,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setForm((prev) => ({ ...prev, group_id: groupId }))
  }, [groupId])

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
        group_id: groupId,
      }
      await eventsApi.createEvent(dto)
      toast.success('活动创建成功')
      setForm({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        max_participants: undefined,
        group_id: groupId,
      })
      onCreated()
      onClose()
    } catch (error: any) {
      toast.error(error?.response?.data?.error || '创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>创建社群活动</DialogTitle>
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

interface EventCardProps {
  event: Event
  onSignupChange: (eventId: string, signedUp: boolean, newCount: number) => void
}

const EventCard: React.FC<EventCardProps> = ({ event, onSignupChange }) => {
  const navigate = useNavigate()
  const [signing, setSigning] = useState(false)

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return iso
    }
  }

  const isFull =
    event.max_participants != null &&
    event.current_participants >= event.max_participants

  const handleSignup = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
          height={140}
          image={event.cover_url}
          alt={event.title}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 140,
            background: 'linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalendarMonth sx={{ fontSize: 40, color: 'white', opacity: 0.7 }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
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

        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
          <Avatar
            src={event.organizer.avatar_url}
            sx={{ width: 20, height: 20, fontSize: 10 }}
          >
            {event.organizer.nickname?.[0]}
          </Avatar>
          <Typography variant="caption" color="text.secondary">
            {event.organizer.nickname}
          </Typography>
        </Box>

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

const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const [group, setGroup] = useState<GroupType | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [groupError, setGroupError] = useState<string | null>(null)

  const [members, setMembers] = useState<GroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const [joinLoading, setJoinLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    if (!groupId) return
    setGroupLoading(true)
    setGroupError(null)

    groupsApi
      .getGroupById(groupId)
      .then((res) => {
        setGroup(res.data.data ?? null)
      })
      .catch(() => {
        setGroupError('加载社群信息失败，请稍后重试')
      })
      .finally(() => setGroupLoading(false))
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    setMembersLoading(true)
    groupsApi
      .getGroupMembers(groupId, { page: 1, limit: 20 })
      .then((res) => {
        setMembers(res.data.data ?? [])
      })
      .catch(() => {
        setMembers([])
      })
      .finally(() => setMembersLoading(false))
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    setEventsLoading(true)
    eventsApi
      .getEvents({ group_id: Number(groupId), page: 1, limit: 10 })
      .then((res) => {
        const now = new Date()
        setEvents((res.data.data ?? []).filter((e) => {
          if (e.end_time && new Date(e.end_time) < now) return false
          return true
        }))
      })
      .catch(() => {
        setEvents([])
      })
      .finally(() => setEventsLoading(false))
  }, [groupId])

  const handleJoin = async () => {
    if (!group || !groupId || joinLoading) return
    setJoinLoading(true)
    try {
      await groupsApi.joinGroup(groupId)
      setGroup((prev) =>
        prev ? { ...prev, is_joined: true, member_count: prev.member_count + 1 } : prev
      )
      setSnackbar({ open: true, message: '加入成功', severity: 'success' })
      groupsApi
        .getGroupMembers(groupId, { page: 1, limit: 20 })
        .then((res) => setMembers(res.data.data ?? []))
    } catch {
      setSnackbar({ open: true, message: '加入失败', severity: 'error' })
    } finally {
      setJoinLoading(false)
    }
  }

  const handleLeave = async () => {
    if (!group || !groupId || joinLoading) return
    setJoinLoading(true)
    try {
      await groupsApi.leaveGroup(groupId)
      setGroup((prev) =>
        prev
          ? { ...prev, is_joined: false, member_count: Math.max(0, prev.member_count - 1) }
          : prev
      )
      setSnackbar({ open: true, message: '已退出社群', severity: 'success' })
      groupsApi
        .getGroupMembers(groupId, { page: 1, limit: 20 })
        .then((res) => setMembers(res.data.data ?? []))
    } catch {
      setSnackbar({ open: true, message: '退出失败', severity: 'error' })
    } finally {
      setJoinLoading(false)
    }
  }

  const handleEnterChat = async () => {
    if (!group || !groupId) return
    try {
      const res = await groupsApi.getGroupChat(groupId)
      const conversationId = res.data.data?.conversation_id
      if (conversationId) {
        navigate(`/chat/${conversationId}`)
      }
    } catch (error) {
      setSnackbar({ open: true, message: '进入群聊失败', severity: 'error' })
    }
  }

  const handleEditSuccess = () => {
    if (!groupId) return
    groupsApi
      .getGroupById(groupId)
      .then((res) => {
        setGroup(res.data.data ?? null)
        setSnackbar({ open: true, message: '社群信息已更新', severity: 'success' })
      })
      .catch(() => {
        setSnackbar({ open: true, message: '刷新失败', severity: 'error' })
      })
  }

  const handleEventCreated = () => {
    if (!groupId) return
    eventsApi
      .getEvents({ group_id: Number(groupId), page: 1, limit: 10 })
      .then((res) => {
        const now = new Date()
        setEvents((res.data.data ?? []).filter((e) => {
          if (e.end_time && new Date(e.end_time) < now) return false
          return true
        }))
      })
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

  const isOwner = group?.my_role === 'owner'

  if (groupLoading) {
    return (
      <Box>
        <Box px={2} pt={1}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBack />
          </IconButton>
        </Box>
        <CoverSkeleton />
        <Container maxWidth="md" sx={{ py: 2 }}>
          <Skeleton variant="text" width="60%" height={36} />
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="75%" />
        </Container>
      </Box>
    )
  }

  if (groupError || !group) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Group sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            {groupError ?? '社群不存在'}
          </Typography>
          <Button variant="outlined" onClick={() => navigate(-1)}>
            返回
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Box>
      <Box
        position="relative"
        sx={{
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 100%)',
            pointerEvents: 'none',
          },
        }}
      >
        {group.cover_url ? (
          <Box
            component="img"
            src={group.cover_url}
            alt={group.name}
            sx={{
              width: '100%',
              height: 200,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <Box
            height={200}
            sx={{
              background: `hsl(${(group.name.charCodeAt(0) * 37) % 360}, 55%, 60%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Group sx={{ fontSize: 80, color: 'white', opacity: 0.7 }} />
          </Box>
        )}

        <IconButton
          onClick={() => navigate(-1)}
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.35)',
            color: 'white',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <ArrowBack />
        </IconButton>
      </Box>

      <Container maxWidth="md" sx={{ py: 2 }}>
        <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Box
            display="flex"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={2}
            flexWrap="wrap"
          >
            <Box flex={1} minWidth={0}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                {group.avatar_url && (
                  <Avatar src={group.avatar_url} sx={{ width: 48, height: 48 }}>
                    <Group />
                  </Avatar>
                )}
                <Typography variant="h5" fontWeight={700}>
                  {group.name}
                </Typography>
              </Box>

              {group.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {group.description}
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                {group.member_count.toLocaleString()} 位成员
              </Typography>
            </Box>

            <Box display="flex" gap={1} flexWrap="wrap">
              {isOwner && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setEditDialogOpen(true)}
                  startIcon={<Edit fontSize="small" />}
                  sx={{ borderRadius: 2 }}
                >
                  编辑
                </Button>
              )}

              {group.is_joined && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleEnterChat}
                  startIcon={<Chat fontSize="small" />}
                  sx={{ borderRadius: 2 }}
                >
                  进入群聊
                </Button>
              )}

              <Button
                variant={group.is_joined ? 'outlined' : 'contained'}
                color={group.is_joined ? 'inherit' : 'primary'}
                onClick={group.is_joined ? handleLeave : handleJoin}
                disabled={joinLoading}
                startIcon={
                  joinLoading ? (
                    <CircularProgress size={16} />
                  ) : group.is_joined ? (
                    <PersonRemove fontSize="small" />
                  ) : (
                    <PersonAdd fontSize="small" />
                  )
                }
                sx={{ borderRadius: 2, flexShrink: 0 }}
              >
                {group.is_joined ? '退出社群' : '加入社群'}
              </Button>
            </Box>
          </Box>
        </Paper>

        <Typography variant="h6" fontWeight={600} mb={1.5}>
          成员
        </Typography>

        {membersLoading ? (
          <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Box display="flex" gap={1}>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} variant="circular" width={36} height={36} />
              ))}
            </Box>
          </Paper>
        ) : members.length > 0 ? (
          <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
              <AvatarGroup max={8}>
                {members.map((member) => (
                  <Avatar
                    key={member.user_id}
                    src={member.avatar_url}
                    sx={{ width: 36, height: 36 }}
                    title={`${member.nickname || '用户'}${member.role === 'owner' ? ' (创建者)' : member.role === 'admin' ? ' (管理员)' : ''}`}
                  >
                    {member.nickname?.[0] || '?'}
                  </Avatar>
                ))}
              </AvatarGroup>
              {members.length > 8 && (
                <Typography variant="body2" color="text.secondary">
                  +{(members.length - 8).toLocaleString()} 人
                </Typography>
              )}
            </Box>
          </Paper>
        ) : (
          <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              暂无成员
            </Typography>
          </Paper>
        )}

        <Divider sx={{ mb: 3 }} />

        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            社群活动
          </Typography>
          {group.is_joined && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => setCreateEventDialogOpen(true)}
            >
              创建活动
            </Button>
          )}
        </Box>

        {eventsLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : events.length === 0 ? (
          <Box
            textAlign="center"
            py={6}
            border="1px dashed"
            borderColor="divider"
            borderRadius={2}
          >
            <Typography variant="body2" color="text.secondary">
              {group.is_joined ? '暂无活动，创建第一个活动吧！' : '暂无活动，加入社群后可以创建活动'}
            </Typography>
          </Box>
        ) : (
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)' }} gap={2}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} onSignupChange={handleSignupChange} />
            ))}
          </Box>
        )}
      </Container>

      <EditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        group={group}
        onSuccess={handleEditSuccess}
      />

      <CreateEventDialog
        open={createEventDialogOpen}
        onClose={() => setCreateEventDialogOpen(false)}
        onCreated={handleEventCreated}
        groupId={Number(groupId)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default GroupDetailPage
