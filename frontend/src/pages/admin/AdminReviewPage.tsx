import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  Flag,
  AdminPanelSettings,
} from '@mui/icons-material'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import http from '@/lib/http'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportItem {
  id: number
  reporter_user_id: string
  target_type: string
  target_id: number
  reason: string
  description: string | null
  status: string
  handler_user_id: string | null
  resolution: string | null
  handler_note: string | null
  created_at: string
  resolved_at: string | null
  reporter: { nickname: string; email: string } | null
}

// ─── Target type labels ──────────────────────────────────────────────────────

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: '用户',
  post: '动态',
  comment: '评论',
  message: '消息',
}

// ─── AdminReviewPage ─────────────────────────────────────────────────────────

const AdminReviewPage: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null)
  const [handlerNote, setHandlerNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await http.get('/reports?status=pending')
      if (res.data.success) {
        setReports(res.data.data ?? [])
      } else {
        setError('获取举报列表失败')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('403') ? '需要管理员权限' : '获取举报列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleReview = (report: ReportItem) => {
    setSelectedReport(report)
    setHandlerNote('')
    setReviewDialogOpen(true)
  }

  const handleSubmitReview = async (resolution: 'approve' | 'reject') => {
    if (!selectedReport) return
    setSubmitting(true)
    try {
      const res = await http.patch(`/reports/${selectedReport.id}`, {
        resolution,
        handler_note: handlerNote || undefined,
      })
      if (res.data.success) {
        setSnackbar({
          open: true,
          message: resolution === 'approve' ? '举报已确认，违规内容已删除，已扣减发布者信用分' : '举报已驳回',
          severity: 'success',
        })
        setReviewDialogOpen(false)
        fetchReports()
      } else {
        setSnackbar({ open: true, message: '操作失败', severity: 'error' })
      }
    } catch {
      setSnackbar({ open: true, message: '操作失败', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <AdminPanelSettings color="primary" />
        <Typography variant="h5" fontWeight={700}>
          举报审核
        </Typography>
        <Chip label={`${reports.length} 条待处理`} size="small" color="warning" sx={{ ml: 1 }} />
      </Box>

      {reports.length === 0 ? (
        <Box textAlign="center" py={8}>
          <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            暂无待处理的举报
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {reports.map((report) => (
            <Card key={report.id} sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Flag color="error" fontSize="small" />
                    <Chip
                      label={TARGET_TYPE_LABELS[report.target_type] || report.target_type}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      ID: {report.target_id}
                    </Typography>
                  </Box>
                  <Chip label="待处理" size="small" color="warning" />
                </Box>

                <Typography variant="body2" fontWeight={600} mb={0.5}>
                  {report.reason}
                </Typography>

                {report.description && (
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    {report.description}
                  </Typography>
                )}

                <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    举报人：{report.reporter?.nickname || '未知'} · {format(parseISO(report.created_at), 'MM月dd日 HH:mm', { locale: zhCN })}
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleReview(report)}
                  >
                    审核
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Review dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>审核举报</DialogTitle>
        <DialogContent>
          {selectedReport && (
            <>
              <Typography variant="body2" fontWeight={600} mb={1}>
                {selectedReport.reason}
              </Typography>
              {selectedReport.description && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {selectedReport.description}
                </Typography>
              )}
              <TextField
                label="处理意见（可选）"
                multiline
                rows={2}
                fullWidth
                value={handlerNote}
                onChange={(e) => setHandlerNote(e.target.value)}
                size="small"
                sx={{ mt: 1 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => handleSubmitReview('reject')}
            color="inherit"
            disabled={submitting}
            startIcon={<Cancel />}
          >
            驳回
          </Button>
          <Button
            onClick={() => handleSubmitReview('approve')}
            color="error"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            确认违规并扣分
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default AdminReviewPage
