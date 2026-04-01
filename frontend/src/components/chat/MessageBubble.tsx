import React from 'react'
import { Box, Typography } from '@mui/material'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Message } from '@/types'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  const formattedTime = (() => {
    try {
      return format(new Date(message.created_at), 'HH:mm', { locale: zhCN })
    } catch {
      return ''
    }
  })()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isOwn ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        mb: 1.5,
        px: 2,
      }}
    >
      <Box
        sx={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isOwn ? 'flex-end' : 'flex-start',
        }}
      >
        <Box
          sx={{
            px: 1.75,
            py: 1,
            borderRadius: isOwn
              ? '18px 18px 4px 18px'
              : '18px 18px 18px 4px',
            bgcolor: isOwn ? 'primary.main' : 'grey.200',
            color: isOwn ? 'primary.contrastText' : 'text.primary',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
            {message.content}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 0.4, mx: 0.5 }}
        >
          {formattedTime}
        </Typography>
      </Box>
    </Box>
  )
}

export default MessageBubble
