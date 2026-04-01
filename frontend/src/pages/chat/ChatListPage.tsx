import React, { useEffect } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'
import { PeopleAlt } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isThisYear } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchConversations } from '@/store/slices/chatSlice'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: zhCN })
    }
    if (isThisYear(date)) {
      return format(date, 'MM-dd', { locale: zhCN })
    }
    return format(date, 'yyyy-MM-dd', { locale: zhCN })
  } catch {
    return dateStr
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const ChatListPage: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const conversations = useAppSelector((state) => state.chat.conversations)
  const loadingConversations = useAppSelector((state) => state.chat.loadingConversations)

  useEffect(() => {
    dispatch(fetchConversations())
  }, [dispatch])

  // ── Loading state ──
  if (loadingConversations && conversations.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  // ── Empty state ──
  if (!loadingConversations && conversations.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={2}
          textAlign="center"
        >
          <PeopleAlt sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            暂无会话，去匹配新朋友吧
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/match')}
            sx={{ mt: 1 }}
          >
            去匹配
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        消息
      </Typography>

      <List disablePadding>
        {conversations.map((conv, index) => {
          const { conversation_id, peer_user, last_message, unread_count } = conv
          const hasUnread = unread_count > 0

          return (
            <React.Fragment key={conversation_id}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => navigate(`/chat/${conversation_id}`)}
                  sx={{
                    borderRadius: 2,
                    '&:hover': { backgroundColor: 'action.hover' },
                    py: 1.2,
                  }}
                >
                  {/* Avatar with unread badge */}
                  <ListItemAvatar>
                    <Badge
                      badgeContent={unread_count}
                      color="error"
                      max={99}
                      invisible={!hasUnread}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      <Avatar
                        src={peer_user.avatar_url}
                        alt={peer_user.nickname}
                        sx={{ width: 48, height: 48 }}
                      >
                        {peer_user.nickname?.[0]?.toUpperCase()}
                      </Avatar>
                    </Badge>
                  </ListItemAvatar>

                  {/* Nickname + last message preview */}
                  <ListItemText
                    sx={{ ml: 0.5 }}
                    primary={
                      <Typography
                        variant="subtitle1"
                        fontWeight={hasUnread ? 700 : 500}
                        noWrap
                      >
                        {peer_user.nickname}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        color={hasUnread ? 'text.primary' : 'text.secondary'}
                        noWrap
                        fontWeight={hasUnread ? 500 : 400}
                      >
                        {last_message?.content ?? '暂无消息'}
                      </Typography>
                    }
                  />

                  {/* Timestamp */}
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-end"
                    ml={1}
                    minWidth={40}
                  >
                    {last_message && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {formatTime(last_message.created_at)}
                      </Typography>
                    )}
                  </Box>
                </ListItemButton>
              </ListItem>

              {index < conversations.length - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </React.Fragment>
          )
        })}
      </List>

      {/* Refresh loading indicator at bottom */}
      {loadingConversations && conversations.length > 0 && (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Container>
  )
}

export default ChatListPage
