import React, { useEffect, useState } from 'react'
import {
  Avatar,
  Box,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowBack, AutoAwesome, CheckCircle, Refresh, Send } from '@mui/icons-material'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { questionsApi } from '@/api/questions'
import { useAppSelector } from '@/store/hooks'
import type { AiAnswer, Answer, Question } from '@/types'

const QuestionDetailPage: React.FC = () => {
  const { questionId } = useParams<{ questionId: string }>()
  const navigate = useNavigate()
  const currentUser = useAppSelector((state) => state.auth.user)

  const [question, setQuestion] = useState<Question | null>(null)
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loadingQuestion, setLoadingQuestion] = useState(true)
  const [loadingAiAnswer, setLoadingAiAnswer] = useState(false)
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [answerText, setAnswerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [generatingAiAnswer, setGeneratingAiAnswer] = useState(false)

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })
    } catch {
      return iso
    }
  }

  const timeAgo = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN })
    } catch {
      return iso
    }
  }

  // Load question
  useEffect(() => {
    if (!questionId) return
    const load = async () => {
      try {
        setLoadingQuestion(true)
        const res = await questionsApi.getQuestion(questionId)
        setQuestion(res.data.data ?? null)
      } catch {
        toast.error('加载问题失败')
      } finally {
        setLoadingQuestion(false)
      }
    }
    load()
  }, [questionId])

  // Load answers
  useEffect(() => {
    if (!questionId) return
    const load = async () => {
      try {
        setLoadingAnswers(true)
        const res = await questionsApi.getAnswers(questionId)
        setAnswers(res.data.data ?? [])
      } catch {
        toast.error('加载回答失败')
      } finally {
        setLoadingAnswers(false)
      }
    }
    load()
  }, [questionId])

  useEffect(() => {
    if (!questionId) return
    const load = async () => {
      try {
        setLoadingAiAnswer(true)
        const res = await questionsApi.getAiAnswer(questionId)
        setAiAnswer(res.data.data ?? null)
      } catch {
        setAiAnswer(null)
      } finally {
        setLoadingAiAnswer(false)
      }
    }
    load()
  }, [questionId])

  const reloadAnswers = async () => {
    if (!questionId) return
    const res = await questionsApi.getAnswers(questionId)
    setAnswers(res.data.data ?? [])
  }

  const handleSubmitAnswer = async () => {
    if (!questionId || !question) return
    if (!currentUser) { toast.info('请先登录'); return }
    if (!answerText.trim()) return
    try {
      setSubmitting(true)
      await questionsApi.submitAnswer(questionId, answerText.trim())
      await reloadAnswers()
      setQuestion({ ...question, answer_count: question.answer_count + 1 })
      setAnswerText('')
      toast.success('回答成功')
    } catch {
      toast.error('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateAiAnswer = async (force = false) => {
    if (!questionId) return
    try {
      setGeneratingAiAnswer(true)
      const res = await questionsApi.generateAiAnswer(questionId, force)
      setAiAnswer(res.data.data ?? null)
      toast.success(force ? 'AI 参考回答已刷新' : 'AI 参考回答已生成')
    } catch {
      toast.error('AI 参考回答生成失败，请稍后重试')
    } finally {
      setGeneratingAiAnswer(false)
    }
  }

  const handleAccept = async (answerId: string) => {
    if (!question) return
    try {
      setAcceptingId(answerId)
      await questionsApi.acceptAnswer(answerId)
      // Mark accepted locally
      setAnswers((prev) =>
        prev.map((a) => ({ ...a, is_accepted: a.id === answerId }))
      )
      setQuestion({ ...question, has_accepted_answer: true })
      toast.success('已采纳该回答')
    } catch {
      toast.error('采纳失败，请重试')
    } finally {
      setAcceptingId(null)
    }
  }

  const isQuestioner = currentUser && question && currentUser.id === question.user.id
  const hasAccepted = answers.some((a) => a.is_accepted)
  // A user can answer if: logged in, question is open (no accepted answer), and is NOT the questioner
  const canAnswer = !!currentUser && !isQuestioner && !hasAccepted

  if (loadingQuestion) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!question) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>
        <Box textAlign="center" py={8}>
          <Typography color="text.secondary">问题不存在或已被删除</Typography>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>返回</Button>

      {/* Question */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1} mb={1}>
          <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1, lineHeight: 1.4 }}>
            {question.title}
          </Typography>
          {question.has_accepted_answer && (
            <Chip
              icon={<CheckCircle />}
              label="已解决"
              color="success"
              size="small"
              sx={{ flexShrink: 0 }}
            />
          )}
        </Box>

        {/* Tags */}
        {(question.tags?.length ?? 0) > 0 && (
          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            {question.tags?.map((tag) => (
              <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
            ))}
          </Box>
        )}

        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: 2 }}>
          {question.content}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {/* Asker Info */}
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar src={question.user.avatar_url} sx={{ width: 36, height: 36 }}>
            {question.user.nickname[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{question.user.nickname}</Typography>
            <Typography variant="caption" color="text.secondary">
              提问于 {formatTime(question.created_at)}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'primary.light', bgcolor: 'primary.50' }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2} mb={1.5}>
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <AutoAwesome color="primary" fontSize="small" />
              <Typography variant="h6" fontWeight={700}>AI 参考回答</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              基于校园资料库检索生成，仅供参考，不替代人工回答和学校最新通知。
            </Typography>
          </Box>
          <Button
            size="small"
            variant={aiAnswer ? 'outlined' : 'contained'}
            startIcon={
              generatingAiAnswer ? (
                <CircularProgress size={14} color="inherit" />
              ) : aiAnswer ? (
                <Refresh />
              ) : (
                <AutoAwesome />
              )
            }
            onClick={() => handleGenerateAiAnswer(!!aiAnswer)}
            disabled={generatingAiAnswer}
          >
            {aiAnswer ? '重新生成' : '生成回答'}
          </Button>
        </Box>

        {loadingAiAnswer ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : aiAnswer ? (
          <>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {aiAnswer.content}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
              生成时间：{formatTime(aiAnswer.created_at)}
            </Typography>
          </>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            当前还没有生成 AI 参考回答。你可以手动生成一份，供提问者和浏览者先做参考。
          </Alert>
        )}
      </Paper>

      {/* Answers */}
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {answers.length} 个回答
      </Typography>

      {loadingAnswers ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : answers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Typography color="text.secondary">暂无回答，快来帮忙解答吧！</Typography>
        </Paper>
      ) : (
        answers.map((answer) => (
          <Paper
            key={answer.id}
            sx={{
              p: 3,
              mb: 2,
              border: answer.is_accepted ? '2px solid' : '1px solid',
              borderColor: answer.is_accepted ? 'success.main' : 'divider',
              position: 'relative',
            }}
          >
            {/* Accepted Badge */}
            {answer.is_accepted && (
              <Box
                display="flex"
                alignItems="center"
                gap={0.5}
                sx={{ color: 'success.main', mb: 1 }}
              >
                <CheckCircle fontSize="small" />
                <Typography variant="caption" fontWeight={600} color="success.main">
                  已采纳
                </Typography>
              </Box>
            )}

            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, mb: 2 }}>
              {answer.content}
            </Typography>

            <Divider sx={{ mb: 1.5 }} />

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1}>
                <Avatar src={answer.user.avatar_url} sx={{ width: 28, height: 28, fontSize: 12 }}>
                  {answer.user.nickname[0]}
                </Avatar>
                <Box>
                  <Typography variant="caption" fontWeight={600}>{answer.user.nickname}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {timeAgo(answer.created_at)}
                  </Typography>
                </Box>
              </Box>

              {/* Accept Button: only questioner, only if not yet accepted */}
              {isQuestioner && !hasAccepted && !answer.is_accepted && (
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={
                    acceptingId === answer.id ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <CheckCircle />
                    )
                  }
                  onClick={() => handleAccept(answer.id)}
                  disabled={acceptingId !== null}
                >
                  采纳
                </Button>
              )}
            </Box>
          </Paper>
        ))
      )}

      {/* Answer Input */}
      {currentUser && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {canAnswer ? '我来回答' : hasAccepted ? '问题已解决' : isQuestioner ? '这是你的问题' : ''}
          </Typography>
          {canAnswer ? (
            <>
              <TextField
                placeholder="请输入你的回答..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                fullWidth
                multiline
                rows={4}
                inputProps={{ maxLength: 2000 }}
                sx={{ mb: 1.5 }}
              />
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  endIcon={
                    submitting ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <Send />
                    )
                  }
                  onClick={handleSubmitAnswer}
                  disabled={!answerText.trim() || submitting}
                >
                  提交回答
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {hasAccepted
                ? '该问题已有采纳答案，不再接受新回答。'
                : isQuestioner
                ? '你不能回答自己的问题。'
                : ''}
            </Typography>
          )}
        </Paper>
      )}

      {!currentUser && (
        <Paper sx={{ p: 3, mt: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">请先登录后再参与回答</Typography>
        </Paper>
      )}
    </Container>
  )
}

export default QuestionDetailPage
