import React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { AutoAwesome } from '@mui/icons-material'
import type { IcebreakerSuggestion } from '@/types'

interface Props {
  icebreaker: IcebreakerSuggestion | null
  loading?: boolean
  onRefresh?: () => void | Promise<void>
  compact?: boolean
}

const IcebreakerPanel: React.FC<Props> = ({ icebreaker, loading = false, onRefresh, compact = false }) => {
  const hasContent = !!icebreaker

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 1.5 : 2,
        borderRadius: 3,
        bgcolor: 'rgba(25, 118, 210, 0.04)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" mb={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesome fontSize="small" color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            AI 聊天破冰助手
          </Typography>
        </Stack>
        {onRefresh && (
          <Button size="small" onClick={onRefresh} disabled={loading}>
            刷新建议
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
        根据双方兴趣标签生成聊天建议，仅供参考。
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" py={1}>
          <CircularProgress size={20} />
        </Box>
      )}

      {!loading && hasContent && (
        <Stack spacing={1.5}>
          {icebreaker.common_tags.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                共同标签
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.75}>
                {icebreaker.common_tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}

          <Section title="开场白" items={icebreaker.opening_lines} />
          <Section title="话题建议" items={icebreaker.topic_suggestions} />
          <Section title="互动建议" items={icebreaker.interaction_ideas} />
          <Section title="小游戏" items={icebreaker.mini_games} />

          <Divider />
          <Typography variant="caption" color="text.secondary">
            {icebreaker.used_ai ? '已使用 OpenRouter 生成' : '已使用规则模板生成'}
          </Typography>
        </Stack>
      )}

      {!loading && !hasContent && (
        <Typography variant="body2" color="text.secondary">
          暂无建议
        </Typography>
      )}
    </Paper>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        {title}
      </Typography>
      <Stack spacing={0.75}>
        {items.map((item) => (
          <Box key={item} sx={{ px: 1.25, py: 0.9, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="body2">{item}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

export default IcebreakerPanel
