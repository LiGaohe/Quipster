// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'answers')

  // segments[0] = answerId, segments[1] = 'accept'
  const isAcceptRoute =
    method === 'POST' &&
    segments.length >= 2 &&
    segments[0] !== '' &&
    segments[1] === 'accept'

  try {
    // ── POST /answers/:id/accept ── 采纳答案 ─────────────────────────
    if (isAcceptRoute) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const answerId = segments[0]

      const supabase = createAdminClient()

      // 查询答案及其所属问题
      const { data: answer, error: aErr } = await supabase
        .from('answers')
        .select('id, user_id, question_id, is_accepted')
        .eq('id', answerId)
        .maybeSingle()

      if (aErr) return err(aErr.message, 500)
      if (!answer) return err('答案不存在', 404)

      const { data: question, error: qErr } = await supabase
        .from('questions')
        .select('id, user_id, has_accepted_answer, status')
        .eq('id', answer.question_id)
        .maybeSingle()

      if (qErr) return err(qErr.message, 500)
      if (!question) return err('对应问题不存在', 404)

      // 验证当前用户是问题的提问者
      if (question.user_id !== me) {
        return err('只有提问者才能采纳答案', 403)
      }

      // 检查问题是否已有采纳答案
      if (question.has_accepted_answer) {
        return err('已有采纳答案', 400)
      }

      // 采纳答案
      const { error: updateAnswerErr } = await supabase
        .from('answers')
        .update({ is_accepted: true })
        .eq('id', answerId)

      if (updateAnswerErr) return err(updateAnswerErr.message, 500)

      // 更新问题状态
      const { error: updateQuestionErr } = await supabase
        .from('questions')
        .update({ has_accepted_answer: true, status: 'closed' })
        .eq('id', answer.question_id)

      if (updateQuestionErr) return err(updateQuestionErr.message, 500)

      // 给答题者加信用分
      const { error: creditInsertErr } = await supabase
        .from('credit_records')
        .insert({
          user_id: answer.user_id,
          type: 'increase',
          amount: 5,
          reason: '回答被采纳',
        })

      if (creditInsertErr) return err(creditInsertErr.message, 500)

      const { error: creditUpdateErr } = await supabase.rpc('increment_credit_score', {
        p_user_id: answer.user_id,
        p_amount: 5,
      })

      // 如果 RPC 不存在，则直接 UPDATE（兜底方案）
      if (creditUpdateErr) {
        const { data: profileData, error: profileFetchErr } = await supabase
          .from('users')
          .select('credit_score')
          .eq('id', answer.user_id)
          .maybeSingle()

        if (profileFetchErr) return err(profileFetchErr.message, 500)

        const currentScore: number = (profileData as { credit_score: number } | null)?.credit_score ?? 0
        const newScore = Math.min(100, currentScore + 5)

        const { error: profileUpdateErr } = await supabase
          .from('users')
          .update({ credit_score: newScore })
          .eq('id', answer.user_id)

        if (profileUpdateErr) return err(profileUpdateErr.message, 500)
      }

      return ok({ success: true, message: '已采纳为最佳答案' })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
