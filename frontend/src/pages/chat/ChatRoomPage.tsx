import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { ArrowBack, Send, Groups, WarningAmber } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import IcebreakerPanel from '@/components/chat/IcebreakerPanel'
import { matchesApi } from '@/api/matches'
import { supabase } from '@/lib/supabase'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  receiveMessage,
  setActiveConversation,
} from '@/store/slices/chatSlice'
import type { IcebreakerSuggestion, Message } from '@/types'

const auditLabelMap: Record<string, string> = {
  pending: '待审',
  passed: '通过',
  flagged: '已标记',
  rejected: '已拒绝',
}

function formatMessageTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'HH:mm', { locale: zhCN })
  } catch {
    return ''
  }
}

interface BubbleProps {
  message: Message
  isSelf: boolean
}

const MessageBubble: React.FC<BubbleProps> = ({ message, isSelf }) => {
  return (
    <Box
      display="flex"
      flexDirection={isSelf ? 'row-reverse' : 'row'}
      alignItems="flex-end"
      gap={1}
      mb={1.5}
    >
      <Box
        sx={{
          maxWidth: '72%',
          px: 1.8,
          py: 1,
          borderRadius: isSelf ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          backgroundColor: isSelf ? 'primary.main' : 'grey.200',
          color: isSelf ? 'primary.contrastText' : 'text.primary',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        <Typography variant="body2">{message.content}</Typography>
        {message.audit_status && message.audit_status !== 'passed' && (
          <Box mt={0.75} display="flex" alignItems="center" gap={0.5}>
            <WarningAmber fontSize="inherit" />
            <Typography variant="caption">
              风险标记：{auditLabelMap[message.audit_status] ?? message.audit_status}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ flexShrink: 0, alignSelf: 'flex-end', pb: 0.2 }}
      >
        {formatMessageTime(message.created_at)}
      </Typography>
    </Box>
  )
}

const ChatRoomPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const currentUser = useAppSelector((state) => state.auth.user)
  const conversations = useAppSelector((state) => state.chat.conversations)
  const messages = useAppSelector((state) =>
    conversationId ? (state.chat.messages[conversationId] ?? []) : []
  )
  const loadingMessages = useAppSelector((state) => state.chat.loadingMessages)

  const conversation = conversations.find(
    (c) => String(c.conversation_id) === String(conversationId)
  )

  const isGroup = conversation?.is_group ?? false
  const peerUser = conversation?.peer_user
  const groupName = conversation?.name || '群聊'

  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [icebreaker, setIcebreaker] = useState<IcebreakerSuggestion | null>(null)
  const [icebreakerLoading, setIcebreakerLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    if (conversations.length === 0) {
      dispatch(fetchConversations())
    }
  }, [dispatch, conversations.length])

  useEffect(() => {
    if (!conversationId) return
    dispatch(setActiveConversation(conversationId))
    dispatch(fetchMessages({ conversationId, page: 1 }))
  }, [dispatch, conversationId])

  useEffect(() => {
    scrollToBottom('auto')
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!peerUser || isGroup) {
      setIcebreaker(null)
      return
    }

    let cancelled = false

    const loadIcebreaker = async () => {
      setIcebreakerLoading(true)
      try {
        const res = await matchesApi.getIcebreaker(peerUser.id)
        if (!cancelled) {
          setIcebreaker(res.data.data ?? null)
        }
      } catch {
        if (!cancelled) {
          setIcebreaker(null)
        }
      } finally {
        if (!cancelled) {
          setIcebreakerLoading(false)
        }
      }
    }

    loadIcebreaker()

    return () => {
      cancelled = true
    }
  }, [peerUser, isGroup])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          dispatch(
            receiveMessage({
              conversationId,
              message: payload.new as Message,
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dispatch, conversationId])

  const handleSend = useCallback(async () => {
    const content = inputValue.trim()
    if (!content || sending) return

    if (!isGroup && !peerUser) return

    setSending(true)
    setInputValue('')
    try {
      if (isGroup) {
        await dispatch(
          sendMessage({
            conversation_id: conversationId,
            content,
            message_type: 'text',
          })
        )
      } else {
        await dispatch(
          sendMessage({
            receiver_id: peerUser!.id,
            content,
            message_type: 'text',
          })
        )
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [dispatch, inputValue, peerUser, sending, isGroup, conversationId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const displayName = isGroup ? groupName : (peerUser?.nickname || '未知用户')
  const displayAvatar = isGroup ? undefined : peerUser?.avatar_url
  const displayInfo = isGroup ? null : [peerUser?.major, peerUser?.grade].filter(Boolean).join(' · ')

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100dvh"
      bgcolor="background.default"
    >
      <Paper
        elevation={1}
        square
        sx={{
          zIndex: 10,
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Toolbar disableGutters variant="dense" sx={{ minHeight: 56 }}>
          <IconButton edge="start" onClick={() => navigate(-1)} sx={{ mr: 0.5 }}>
            <ArrowBack />
          </IconButton>

          {isGroup ? (
            <>
              <Avatar
                sx={{ width: 36, height: 36, mr: 1.5, bgcolor: 'primary.main' }}
              >
                <Groups />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2}>
                  {displayName}
                </Typography>
              </Box>
            </>
          ) : peerUser ? (
            <>
              <Avatar
                src={displayAvatar}
                alt={displayName}
                sx={{ width: 36, height: 36, mr: 1.5 }}
              >
                {displayName?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2}>
                  {displayName}
                </Typography>
                {displayInfo && (
                  <Typography variant="caption" color="text.secondary" lineHeight={1}>
                    {displayInfo}
                  </Typography>
                )}
              </Box>
            </>
          ) : (
            <Typography variant="subtitle1" fontWeight={600}>
              聊天
            </Typography>
          )}
        </Toolbar>
      </Paper>

      <Box
        flex={1}
        overflow="auto"
        px={2}
        py={2}
        display="flex"
        flexDirection="column"
      >
        {!isGroup && peerUser && (
          <Box mb={2}>
            <IcebreakerPanel
              icebreaker={icebreaker}
              loading={icebreakerLoading}
              onRefresh={async () => {
                try {
                  setIcebreakerLoading(true)
                  const res = await matchesApi.getIcebreaker(peerUser.id)
                  setIcebreaker(res.data.data ?? null)
                } finally {
                  setIcebreakerLoading(false)
                }
              }}
              compact
            />
          </Box>
        )}

        {loadingMessages && messages.length === 0 && (
          <Box display="flex" justifyContent="center" pt={4}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loadingMessages && messages.length === 0 && (
          <Box display="flex" justifyContent="center" pt={4}>
            <Typography variant="body2" color="text.secondary">
              暂无消息，快来打个招呼吧！
            </Typography>
          </Box>
        )}

        {messages.map((msg) => {
          const isSelf = msg.sender_user_id === currentUser?.id
          return (
            <MessageBubble key={msg.id} message={msg} isSelf={isSelf} />
          )
        })}

        <div ref={messagesEndRef} />
      </Box>

      <Paper
        elevation={3}
        square
        sx={{
          px: 2,
          py: 1.5,
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="md" disableGutters>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="发送消息..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    color="primary"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || sending}
                    edge="end"
                  >
                    {sending ? (
                      <CircularProgress size={20} />
                    ) : (
                      <Send fontSize="small" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              },
            }}
          />
        </Container>
      </Paper>
    </Box>
  )
}

export default ChatRoomPage
