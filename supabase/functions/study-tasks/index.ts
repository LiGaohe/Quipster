// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// study-tasks/index.ts — 学习搭子
//
// 使用 activities 表，task_type 区分学习任务
//
// GET  /study-tasks              → 任务列表（分页）
// POST /study-tasks              → 发布任务
// POST /study-tasks/:id/join     → 申请加入
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'study-tasks')

  const hasId = segments.length >= 1 && segments[0] !== ''
  const isJoinRoute = hasId && segments[1] === 'join'

  try {
    if (method === 'GET' && !hasId) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp

      const { page, limit, offset } = parsePagination(url)
      const statusFilter = url.searchParams.get('status')

      const supabase = createAdminClient()

      let query = supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('task_type', 'study')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (statusFilter === 'open') {
        query = query.eq('status', 'upcoming')
      } else if (statusFilter === 'closed') {
        query = query.neq('status', 'upcoming')
      }

      const { data: tasks, error: tErr, count } = await query

      if (tErr) return err(tErr.message, 500)

      const taskList = tasks ?? []

      const enriched = await Promise.all(
        taskList.map(async (task: {
          id: string
          creator_user_id: string
          title: string
          description: string | null
          max_members: number | null
          status: string
          created_at: string
        }) => {
          const { data: creator } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', task.creator_user_id)
            .maybeSingle()

          const { count: currentCount } = await supabase
            .from('activity_participants')
            .select('id', { count: 'exact', head: true })
            .eq('activity_id', task.id)

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            target_count: task.max_members ?? 2,
            current_count: currentCount ?? 0,
            creator: creator ?? { id: task.creator_user_id, nickname: null, avatar_url: null },
            status: task.status ?? 'upcoming',
            created_at: task.created_at,
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

      let body: { title?: string; description?: string; target_count?: number }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { title, description, target_count } = body

      if (!title || title.trim() === '') return err('标题不能为空', 400)
      if (!target_count || target_count < 2) return err('目标人数至少为 2', 400)

      const supabase = createAdminClient()

      const { data: newTask, error: insertErr } = await supabase
        .from('activities')
        .insert({
          creator_user_id: me,
          title: title.trim(),
          description: description?.trim() ?? null,
          max_members: target_count,
          task_type: 'study',
          activity_type: 'study_task',
          status: 'upcoming',
          event_time: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      const taskId = newTask.id

      const { error: memberErr } = await supabase
        .from('activity_participants')
        .insert({ activity_id: taskId, user_id: me, status: 'registered' })

      if (memberErr) return err(memberErr.message, 500)

      return ok({ success: true, message: '任务发布成功', data: { id: taskId } }, 201)
    }

    if (method === 'POST' && isJoinRoute) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const taskId = segments[0]

      const supabase = createAdminClient()

      const { data: task, error: tErr } = await supabase
        .from('activities')
        .select('id, status, max_members')
        .eq('id', taskId)
        .maybeSingle()

      if (tErr) return err(tErr.message, 500)
      if (!task) return err('任务不存在', 404)
      if (task.status !== 'upcoming') return err('该任务已关闭，无法申请加入', 400)

      const { data: existingMember, error: memberCheckErr } = await supabase
        .from('activity_participants')
        .select('id, status')
        .eq('activity_id', taskId)
        .eq('user_id', me)
        .maybeSingle()

      if (memberCheckErr) return err(memberCheckErr.message, 500)
      if (existingMember) return err('您已申请或加入过该任务', 400)

      const { count: currentCount } = await supabase
        .from('activity_participants')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', taskId)

      if (task.max_members && (currentCount ?? 0) >= task.max_members) {
        return err('该任务人数已满', 400)
      }

      const { error: insertErr } = await supabase
        .from('activity_participants')
        .insert({ activity_id: taskId, user_id: me, status: 'registered' })

      if (insertErr) return err(insertErr.message, 500)

      return ok({ success: true, message: '加入成功' })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
