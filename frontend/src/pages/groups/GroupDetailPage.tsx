import React, { useEffect, useState } from 'react'
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material'
import { ArrowBack, Group, PersonAdd, PersonRemove } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { groupsApi } from '@/api/groups'
import { postsApi } from '@/api/posts'
import PostCard from '@/components/posts/PostCard'
import type { Group as GroupType, Post } from '@/types'

// ─── Cover Skeleton ───────────────────────────────────────────────────────────

const CoverSkeleton: React.FC = () => (
  <Skeleton variant="rectangular" width="100%" height={200} />
)

// ─── Member Placeholder ───────────────────────────────────────────────────────

const MembersPlaceholder: React.FC<{ count: number }> = ({ count }) => {
  // Show placeholder avatars — real member list API is not available yet
  const placeholderCount = Math.min(count, 8)
  return (
    <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
      <AvatarGroup max={8}>
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <Avatar
            key={i}
            sx={{
              width: 36,
              height: 36,
              bgcolor: `hsl(${(i * 47) % 360}, 60%, 65%)`,
              fontSize: 14,
            }}
          >
            {String.fromCharCode(65 + (i % 26))}
          </Avatar>
        ))}
      </AvatarGroup>
      {count > 8 && (
        <Typography variant="body2" color="text.secondary">
          +{(count - 8).toLocaleString()} 人
        </Typography>
      )}
    </Box>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const [group, setGroup] = useState<GroupType | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [groupError, setGroupError] = useState<string | null>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)

  const [joinLoading, setJoinLoading] = useState(false)

  // ── Load group detail ──
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

  // ── Load group posts (best-effort: filter by group via user_id placeholder) ──
  // The posts API doesn't yet support group_id filter, so we show a best-effort
  // empty state when no posts are returned.
  useEffect(() => {
    if (!groupId) return
    setPostsLoading(true)
    postsApi
      .getPosts({ page: 1, limit: 10 })
      .then((res) => {
        // In production, backend would filter by group_id; for now show empty
        setPosts([])
      })
      .catch(() => {
        setPosts([])
      })
      .finally(() => setPostsLoading(false))
  }, [groupId])

  // ── Join / Leave ──
  const handleJoin = async () => {
    if (!group || !groupId || joinLoading) return
    setJoinLoading(true)
    try {
      await groupsApi.joinGroup(groupId)
      setGroup((prev) =>
        prev ? { ...prev, is_joined: true, member_count: prev.member_count + 1 } : prev
      )
    } catch {
      // ignore
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
    } catch {
      // ignore
    } finally {
      setJoinLoading(false)
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (groupLoading) {
    return (
      <Box>
        {/* Back button */}
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

  // ─── Error state ───────────────────────────────────────────────────────────
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

  // ─── Normal render ─────────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── Back button overlay ── */}
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

        {/* Back button on top of cover */}
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
        {/* ── Group info card ── */}
        <Paper elevation={0} variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
          <Box
            display="flex"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={2}
            flexWrap="wrap"
          >
            <Box flex={1} minWidth={0}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {group.name}
              </Typography>

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

            {/* Join / Leave button */}
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
        </Paper>

        {/* ── Members section ── */}
        <Typography variant="h6" fontWeight={600} mb={1.5}>
          成员
        </Typography>

        {group.member_count > 0 ? (
          <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <MembersPlaceholder count={group.member_count} />
          </Paper>
        ) : (
          <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              暂无成员
            </Typography>
          </Paper>
        )}

        <Divider sx={{ mb: 3 }} />

        {/* ── Posts section ── */}
        <Typography variant="h6" fontWeight={600} mb={2}>
          社群动态
        </Typography>

        {postsLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!postsLoading && posts.length === 0 && (
          <Box
            textAlign="center"
            py={6}
            border="1px dashed"
            borderColor="divider"
            borderRadius={2}
          >
            <Typography variant="body2" color="text.secondary">
              暂无帖子，加入社群后发布第一条动态吧！
            </Typography>
          </Box>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </Container>
    </Box>
  )
}

export default GroupDetailPage
