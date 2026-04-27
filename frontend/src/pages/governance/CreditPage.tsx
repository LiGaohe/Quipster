import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import {
  ArrowDownward,
  ArrowUpward,
  EmojiEvents,
  Warning,
} from '@mui/icons-material'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { governanceApi } from '@/api/governance'
import type { CreditInfo, CreditRecord } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface CreditLevel {
  label: string
  color: 'success' | 'warning' | 'error'
  hexColor: string
  description: string
}

function getCreditLevel(score: number): CreditLevel {
  if (score >= 90)
    return {
      label: '优秀',
      color: 'success',
      hexColor: '#2e7d32',
      description: '可使用所有功能',
    }
  if (score >= 70)
    return {
      label: '良好',
      color: 'success',
      hexColor: '#388e3c',
      description: '正常使用',
    }
  if (score >= 50)
    return {
      label: '一般',
      color: 'warning',
      hexColor: '#f57c00',
      description: '部分功能受限',
    }
  return {
    label: '较差',
    color: 'error',
    hexColor: '#c62828',
    description: '核心功能受限',
  }
}

function getProgressColor(score: number): string {
  if (score >= 80) return '#4caf50'
  if (score >= 60) return '#ff9800'
  return '#f44336'
}

const LEVEL_DESCRIPTIONS: Array<{ range: string; label: string; desc: string }> = [
  { range: '90–100', label: '优秀', desc: '可使用所有功能' },
  { range: '70–89', label: '良好', desc: '正常使用' },
  { range: '50–69', label: '一般', desc: '部分功能受限' },
  { range: '0–49', label: '较差', desc: '核心功能受限' },
]

// ─── CreditRecordItem ─────────────────────────────────────────────────────────

interface CreditRecordItemProps {
  record: CreditRecord
  isLast: boolean
}

const CreditRecordItem: React.FC<CreditRecordItemProps> = ({ record, isLast }) => {
  const isIncrease = record.type === 'increase'

  return (
    <Box>
      <Box display="flex" alignItems="flex-start" gap={1.5} py={1.5}>
        {/* Icon column */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: isIncrease ? 'success.light' : 'error.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isIncrease ? (
            <ArrowUpward sx={{ fontSize: 16, color: 'success.dark' }} />
          ) : (
            <ArrowDownward sx={{ fontSize: 16, color: 'error.dark' }} />
          )}
        </Box>

        {/* Content */}
        <Box flex={1} minWidth={0}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.25}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1, mr: 1 }}>
              {record.reason}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: isIncrease ? 'success.main' : 'error.main', flexShrink: 0 }}
            >
              {isIncrease ? '+' : '-'}
              {record.amount}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {format(parseISO(record.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
          </Typography>
        </Box>
      </Box>
      {!isLast && <Divider />}
    </Box>
  )
}

// ─── CreditPage ───────────────────────────────────────────────────────────────

const CreditPage: React.FC = () => {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await governanceApi.getCredit()
        if (res.data.success && res.data.data) {
          setCreditInfo(res.data.data)
        } else {
          setError('获取信用信息失败')
        }
      } catch {
        setError('获取信用信息失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !creditInfo) {
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Alert severity="error">{error || '数据加载失败'}</Alert>
      </Container>
    )
  }

  const score = creditInfo.credit_score
  const level = getCreditLevel(score)
  const progressColor = getProgressColor(score)
  const lowCredit = score < 60
  const records = creditInfo.records ?? []

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        信用中心
      </Typography>

      {/* Warning banner */}
      {lowCredit && (
        <Alert
          severity="warning"
          icon={<Warning fontSize="inherit" />}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          你的信用分低于 60 分，部分核心功能已受限，请注意规范使用平台。
        </Alert>
      )}

      {/* Score card */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 2,
          background: `linear-gradient(135deg, ${level.hexColor}18 0%, ${level.hexColor}08 100%)`,
          border: `1px solid ${level.hexColor}30`,
        }}
      >
        <CardContent sx={{ pb: '16px !important' }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <EmojiEvents sx={{ color: level.hexColor, fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              我的信用分
            </Typography>
          </Box>

          <Box display="flex" alignItems="flex-end" gap={2} mb={2}>
            <Typography
              variant="h2"
              fontWeight={800}
              sx={{ color: level.hexColor, lineHeight: 1 }}
            >
              {score}
            </Typography>
            <Box mb={0.5}>
              <Chip
                label={level.label}
                size="small"
                color={level.color}
                sx={{ fontWeight: 700, mb: 0.25 }}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {level.description}
              </Typography>
            </Box>
          </Box>

          {/* Progress bar */}
          <Box>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                0
              </Typography>
              <Typography variant="caption" color="text.secondary">
                100 分
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: `${progressColor}22`,
                '& .MuiLinearProgress-bar': {
                  bgcolor: progressColor,
                  borderRadius: 5,
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Level descriptions */}
      <Card sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
            信用等级说明
          </Typography>
          <Stack spacing={1}>
            {LEVEL_DESCRIPTIONS.map((item) => (
              <Box
                key={item.range}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56 }}>
                    {item.range}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {item.label}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {item.desc}
                </Typography>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Change records */}
      <Typography variant="subtitle1" fontWeight={700} mb={1.5}>
        变更记录
      </Typography>

      {records.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography variant="body2" color="text.secondary">
            暂无变更记录
          </Typography>
        </Box>
      ) : (
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ py: 0, '&:last-child': { pb: 0 } }}>
            {records.map((record, index) => (
              <CreditRecordItem
                key={index}
                record={record}
                isLast={index === records.length - 1}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </Container>
  )
}

export default CreditPage
