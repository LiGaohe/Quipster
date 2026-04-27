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
import { PeopleAlt, Groups } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isThisYear } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchConversations } from '@/store/slices/chatSlice'

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

const ChatListPage: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const conversations = useAppSelector((state) => state.chat.conversations)
  const loadingConversations = useAppSelector((state) => state.chat.loadingConversations)

  useEffect(() => {
    dispatch(fetchConversations())
  }, [dispatch])

  if (loadingConversations && conversations.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

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
          const { conversation_id, peer_user, last_message, unread_count, is_group, name } = conv
          const hasUnread = unread_count > 0

          const displayName = is_group ? (name || '群聊') : (peer_user?.nickname || '未知用户')
          const displayAvatar = is_group ? undefined : peer_user?.avatar_url

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
                  <ListItemAvatar>
                    <Badge
                      badgeContent={unread_count}
                      color="error"
                      max={99}
                      invisible={!hasUnread}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                      {is_group ? (
                        <Avatar
                          sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}
                        >
                          <Groups />
                        </Avatar>
                      ) : (
                        <Avatar
                          src={displayAvatar}
                          alt={displayName}
                          sx={{ width: 48, height: 48 }}
                        >
                          {displayName?.[0]?.toUpperCase()}
                        </Avatar>
                      )}
                    </Badge>
                  </ListItemAvatar>

                  <ListItemText
                    sx={{ ml: 0.5 }}
                    primary={
                      <Typography
                        variant="subtitle1"
                        fontWeight={hasUnread ? 700 : 500}
                        noWrap
                      >
                        {displayName}
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

      {loadingConversations && conversations.length > 0 && (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Container>
  )
}

export default ChatListPage
