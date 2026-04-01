import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  type SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material'
import { Add, Group, Search } from '@mui/icons-material'
import { groupsApi } from '@/api/groups'
import { tagsApi } from '@/api/tags'
import type { CreateGroupDto, Group as GroupType, Tag } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// ─── Create Group Dialog ──────────────────────────────────────────────────────

interface CreateGroupDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (group: GroupType) => void
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load tags when dialog opens
  useEffect(() => {
    if (!open) return
    setTagsLoading(true)
    tagsApi
      .getAllTags()
      .then((res) => {
        setAllTags(res.data.data ?? [])
      })
      .catch(() => {
        // ignore, tags are optional
      })
      .finally(() => setTagsLoading(false))
  }, [open])

  const handleTagChange = (event: SelectChangeEvent<number[]>) => {
    const value = event.target.value
    setSelectedTagIds(typeof value === 'string' ? [] : (value as number[]))
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setCoverUrl('')
    setSelectedTagIds([])
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请填写社群名称')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const dto: CreateGroupDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        cover_url: coverUrl.trim() || undefined,
        tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      }
      const res = await groupsApi.createGroup(dto)
      const newGroupId = res.data.data?.id
      if (newGroupId) {
        // Build a local Group object to hand back
        const created: GroupType = {
          id: newGroupId,
          name: name.trim(),
          description: description.trim() || undefined,
          cover_url: coverUrl.trim() || undefined,
          member_count: 1,
          is_joined: true,
        }
        onCreated(created)
        handleClose()
      }
    } catch {
      setError('创建失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const tagNameById = (id: number) => allTags.find((t) => t.id === id)?.name ?? String(id)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创建社群</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <TextField
            label="社群名称"
            required
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 50 }}
            size="small"
          />

          <TextField
            label="社群描述"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            inputProps={{ maxLength: 300 }}
            size="small"
          />

          <TextField
            label="封面图 URL（可选）"
            fullWidth
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            size="small"
          />

          {/* Tags multi-select */}
          <FormControl fullWidth size="small" disabled={tagsLoading}>
            <InputLabel>兴趣标签（可多选）</InputLabel>
            <Select
              multiple
              value={selectedTagIds}
              onChange={handleTagChange}
              input={<OutlinedInput label="兴趣标签（可多选）" />}
              renderValue={(selected) =>
                (selected as number[]).map(tagNameById).join('、')
              }
              MenuProps={{ PaperProps: { style: { maxHeight: 240 } } }}
            >
              {tagsLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  加载中…
                </MenuItem>
              ) : (
                allTags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    <Checkbox checked={selectedTagIds.includes(tag.id)} size="small" />
                    <ListItemText primary={tag.name} />
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          创建
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: GroupType
  onJoinToggle: (groupId: string, joined: boolean) => void
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onJoinToggle }) => {
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    if (group.is_joined || joining) return
    setJoining(true)
    try {
      await groupsApi.joinGroup(group.id)
      onJoinToggle(group.id, true)
    } catch {
      // ignore
    } finally {
      setJoining(false)
    }
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        boxShadow: 1,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      {/* Cover image or colored placeholder */}
      {group.cover_url ? (
        <CardMedia
          component="img"
          height="120"
          image={group.cover_url}
          alt={group.name}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          height={120}
          sx={{
            background: `hsl(${(group.name.charCodeAt(0) * 37) % 360}, 60%, 70%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Group sx={{ fontSize: 48, color: 'white', opacity: 0.8 }} />
        </Box>
      )}

      <CardContent sx={{ flex: 1, pb: 0 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom noWrap>
          {group.name}
        </Typography>

        {group.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 1,
            }}
          >
            {group.description}
          </Typography>
        )}

        <Typography variant="caption" color="text.disabled">
          {group.member_count.toLocaleString()} 位成员
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          size="small"
          variant={group.is_joined ? 'outlined' : 'contained'}
          color={group.is_joined ? 'inherit' : 'primary'}
          disabled={group.is_joined || joining}
          onClick={handleJoin}
          startIcon={joining ? <CircularProgress size={14} /> : undefined}
          fullWidth
          sx={{ borderRadius: 2 }}
        >
          {group.is_joined ? '已加入' : '加入'}
        </Button>
      </CardActions>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const LIMIT = 12

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupType[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const debouncedKeyword = useDebounce(keyword, 300)

  // Reset & reload when keyword changes
  const initialized = useRef(false)

  const loadGroups = useCallback(
    async (pageNum: number, kw: string, replace: boolean) => {
      setLoading(true)
      try {
        const res = await groupsApi.getGroups({
          keyword: kw || undefined,
          page: pageNum,
          limit: LIMIT,
        })
        const fetched = res.data.data ?? []
        const pagination = res.data.pagination

        setGroups((prev) => (replace ? fetched : [...prev, ...fetched]))
        setHasMore(pageNum < pagination.pages)
        setPage(pageNum)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Initial load & keyword change
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    loadGroups(1, debouncedKeyword, true)
  }, [debouncedKeyword, loadGroups])

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadGroups(page + 1, debouncedKeyword, false)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, page, debouncedKeyword, loadGroups])

  const handleJoinToggle = (groupId: string, joined: boolean) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, is_joined: joined, member_count: g.member_count + (joined ? 1 : -1) }
          : g
      )
    )
  }

  const handleGroupCreated = (newGroup: GroupType) => {
    setGroups((prev) => [newGroup, ...prev])
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700}>
          兴趣社群
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
          size="small"
        >
          创建社群
        </Button>
      </Box>

      {/* Search bar */}
      <TextField
        fullWidth
        size="small"
        placeholder="搜索社群..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
      />

      {/* Group grid */}
      {groups.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Group sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            {debouncedKeyword ? `未找到与"${debouncedKeyword}"相关的社群` : '暂无社群，来创建第一个吧！'}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        {groups.map((group) => (
          <Grid item key={group.id} xs={12} sm={6} md={4} lg={3}>
            <GroupCard group={group} onJoinToggle={handleJoinToggle} />
          </Grid>
        ))}
      </Grid>

      {/* Loading indicator */}
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* No more data */}
      {!hasMore && groups.length > 0 && (
        <Box textAlign="center" py={2}>
          <Typography variant="caption" color="text.secondary">
            已加载全部社群
          </Typography>
        </Box>
      )}

      {/* Sentinel for infinite scroll */}
      <Box ref={sentinelRef} sx={{ height: 1 }} />

      {/* Create group dialog */}
      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleGroupCreated}
      />
    </Container>
  )
}

export default GroupsPage
