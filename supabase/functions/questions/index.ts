// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'questions')

  const hasId = segments.length >= 1 && segments[0] !== ''
  const isAnswersRoute = hasId && segments[1] === 'answers'

  try {
    if (method === 'GET' && !hasId) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp

      const { page, limit, offset } = parsePagination(url)
      const sort = url.searchParams.get('sort') ?? 'latest'

      const supabase = createAdminClient()

      let query = supabase
        .from('questions')
        .select('*', { count: 'exact' })

      if (sort === 'hotests') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      query = query.range(offset, offset + limit - 1)

      const { data: questions, error: qErr, count } = await query

      if (qErr) return err(qErr.message, 500)

      const questionList = questions ?? []

      const enriched = await Promise.all(
        questionList.map(async (q: {
          id: string
          user_id: string
          title: string
          content: string
          category: string | null
          is_solved: boolean
          has_ai_answer: boolean
          created_at: string
        }) => {
          const { count: answerCount } = await supabase
            .from('answers')
            .select('id', { count: 'exact', head: true })
            .eq('question_id', q.id)

          const { data: acceptedAnswer } = await supabase
            .from('answers')
            .select('id')
            .eq('question_id', q.id)
            .eq('is_accepted', true)
            .maybeSingle()

          const { data: profile } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', q.user_id)
            .maybeSingle()

          const { data: tagRows } = await supabase
            .from('question_tags')
            .select('tags(id, name)')
            .eq('question_id', q.id)

          const tags = tagRows
            ?.map((row: { tags: { id: number; name: string } | null }) => row.tags)
            .filter((t): t is { id: number; name: string } => t !== null) ?? []

          return {
            id: q.id,
            title: q.title,
            content: q.content,
            tags,
            category: q.category,
            status: q.is_solved ? 'closed' : 'open',
            answer_count: answerCount ?? 0,
            has_accepted_answer: !!acceptedAnswer,
            user: profile ?? { id: q.user_id, nickname: null, avatar_url: null },
            created_at: q.created_at,
          }
        })
      )

      return ok({
        success: true,
        data: enriched,
        pagination: buildPagination(page, limit, count ?? 0),
      })
    }

    if (method === 'POST' && !hasId) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      let body: { title?: string; content?: string; category?: string; tags?: number[] }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { title, content, category, tags } = body

      if (!title || title.trim().length < 5) return err('标题至少需要 5 个字符', 400)
      if (!content || content.trim() === '') return err('问题内容不能为空', 400)

      const supabase = createAdminClient()

      const { data: newQuestion, error: insertErr } = await supabase
        .from('questions')
        .insert({ user_id: me, title: title.trim(), content: content.trim(), category: category ?? null })
        .select('id')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      const questionId = newQuestion.id

      if (tags && tags.length > 0) {
        const tagInserts = tags.map((tagId) => ({
          question_id: questionId,
          tag_id: tagId,
        }))
        const { error: tagErr } = await supabase
          .from('question_tags')
          .insert(tagInserts)
        if (tagErr) console.error('Failed to insert question tags:', tagErr.message)
      }

      return ok({ success: true, message: '问题发布成功', data: { id: questionId } }, 201)
    }

    if (method === 'GET' && isAnswersRoute) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp

      const questionId = segments[0]

      const supabase = createAdminClient()

      const { data: question, error: qErr } = await supabase
        .from('questions')
        .select('id')
        .eq('id', questionId)
        .maybeSingle()

      if (qErr) return err(qErr.message, 500)
      if (!question) return err('问题不存在或已删除', 404)

      const { data: answers, error: aErr } = await supabase
        .from('answers')
        .select('*')
        .eq('question_id', questionId)
        .order('is_accepted', { ascending: false })
        .order('created_at', { ascending: true })

      if (aErr) return err(aErr.message, 500)

      const answerList = answers ?? []

      const enriched = await Promise.all(
        answerList.map(async (a: {
          id: string
          question_id: string
          user_id: string
          content: string
          is_accepted: boolean
          like_count: number
          created_at: string
        }) => {
          const { data: profile } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', a.user_id)
            .maybeSingle()

          return {
            id: a.id,
            content: a.content,
            user: profile ?? { id: a.user_id, nickname: null, avatar_url: null },
            is_accepted: a.is_accepted,
            like_count: a.like_count,
            created_at: a.created_at,
          }
        })
      )

      return ok({ success: true, data: enriched })
    }

    if (method === 'POST' && isAnswersRoute) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const questionId = segments[0]

      const supabase = createAdminClient()

      const { data: question, error: qErr } = await supabase
        .from('questions')
        .select('id, is_solved')
        .eq('id', questionId)
        .maybeSingle()

      if (qErr) return err(qErr.message, 500)
      if (!question) return err('问题不存在', 404)
      if (question.is_solved) return err('该问题已关闭，无法继续回答', 400)

      let body: { content?: string }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { content } = body

      if (!content || content.trim() === '') return err('回答内容不能为空', 400)

      const { data: newAnswer, error: insertErr } = await supabase
        .from('answers')
        .insert({ question_id: questionId, user_id: me, content: content.trim() })
        .select('id')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      return ok({ success: true, message: '回答发布成功', data: { id: newAnswer.id } }, 201)
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
