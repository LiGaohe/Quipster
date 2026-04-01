import { Box, Typography, SvgIconProps } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'
import type { SvgIconComponent } from '@mui/icons-material'

interface Props {
  message?: string
  icon?: React.ReactNode
}

export default function EmptyState({ message = '暂无内容', icon }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        color: 'text.secondary',
      }}
    >
      <Box sx={{ mb: 2, opacity: 0.4, fontSize: 64, lineHeight: 1 }}>
        {icon ?? <InboxIcon sx={{ fontSize: 64 }} />}
      </Box>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  )
}
