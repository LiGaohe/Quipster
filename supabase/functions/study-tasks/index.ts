// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'study-tasks')

  // segments[0] = taskId, segments[1] = 'join'
  const hasId = segments.length >= 1 && segments[0] !== ''
  const isJoinRoute = hasId && segments[1] === 'join'

  try {
    // ── GET /study-tasks ── 任务列表 ────────────────────────────────
    if (method === 'GET' && !hasId) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp

      const { page, limit, offset } = parsePagination(url)
      const tagId = url.searchParams.get('tag_id')
      const statusFilter = url.searchParams.get('status')

      const supabase = createAdminClient()

      let query = supabase
        .from('study_tasks')
        .select(
          tagId
            ? '*, study_task_tags!inner(tag_id)'
            : '*',
          { count: 'exact' }
        )

      if (tagId) {
        query = query.eq('study_task_tags.tag_id', parseInt(tagId, 10))
      }

      if (statusFilter === 'open' || statusFilter === 'closed') {
        query = query.eq('status', statusFilter)
      }

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

      const { data: tasks, error: tErr, count } = await query

      if (tErr) return err(tErr.message, 500)

      const taskList = tasks ?? []

      // 为每个任务获取 creator 和 tags
      const enriched = await Promise.all(
        taskList.map(async (task: {
          id: string
          creator_id: string
          title: string
          description: string | null
          target_count: number
          current_count: number
          status: string
          created_at: string
        }) => {
          // 获取创建者信息
          const { data: creator } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', task.creator_id)
            .maybeSingle()

          // 获取任务标签
          const { data: tagRows } = await supabase
            .from('study_task_tags')
            .select('tags(id, name)')
            .eq('task_id', task.id)

          const tags = (tagRows ?? []).map((row: { tags: { id: number; name: string } | null }) =>
            row.tags ? { id: row.tags.id, name: row.tags.name } : null
          ).filter(Boolean)

          return {
            id: task.id,
            title: task.title,
            description: task.description,
            tags,
            target_count: task.target_count,
            current_count: task.current_count,
            creator: creator ?? { id: task.creator_id, nickname: null, avatar_url: null },
            status: task.status,
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

    // ── POST /study-tasks ── 发布任务 ───────────────────────────────
    if (method === 'POST' && !hasId) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      let body: { title?: string; description?: string; tags?: number[]; target_count?: number }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { title, description, tags, target_count } = body

      if (!title || title.trim() === '') return err('标题不能为空', 400)
      if (!target_count || target_count < 2) return err('目标人数至少为 2', 400)

      const supabase = createAdminClient()

      // 插入任务
      const { data: newTask, error: insertErr } = await supabase
        .from('study_tasks')
        .insert({
          creator_id: me,
          title: title.trim(),
          description: description?.trim() ?? null,
          target_count,
        })
        .select('id')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      const taskId = newTask.id

      // 创建者自动加入（status='approved'）
      const { error: memberErr } = await supabase
        .from('study_task_members')
        .insert({ task_id: taskId, user_id: me, status: 'approved' })

      if (memberErr) return err(memberErr.message, 500)

      // 插入标签关联
      if (tags && tags.length > 0) {
        const tagRows = tags.map((tagId: number) => ({ task_id: taskId, tag_id: tagId }))
        const { error: tagErr } = await supabase.from('study_task_tags').insert(tagRows)
        if (tagErr) return err(tagErr.message, 500)
      }

      return ok({ success: true, message: '任务发布成功', data: { id: taskId } }, 201)
    }

    // ── POST /study-tasks/:id/join ── 申请加入 ──────────────────────
    if (method === 'POST' && isJoinRoute) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const taskId = segments[0]

      const supabase = createAdminClient()

      // 查询任务是否存在且开放
      const { data: task, error: tErr } = await supabase
        .from('study_tasks')
        .select('id, status, target_count, current_count')
        .eq('id', taskId)
        .maybeSingle()

      if (tErr) return err(tErr.message, 500)
      if (!task) return err('任务不存在', 404)
      if (task.status !== 'open') return err('该任务已关闭，无法申请加入', 400)

      // 检查是否已申请或已加入
      const { data: existingMember, error: memberCheckErr } = await supabase
        .from('study_task_members')
        .select('id, status')
        .eq('task_id', taskId)
        .eq('user_id', me)
        .maybeSingle()

      if (memberCheckErr) return err(memberCheckErr.message, 500)
      if (existingMember) return err('您已申请或加入过该任务', 400)

      // 检查是否已满
      if (task.current_count >= task.target_count) {
        return err('该任务人数已满', 400)
      }

      // 提交申请
      const { error: insertErr } = await supabase
        .from('study_task_members')
        .insert({ task_id: taskId, user_id: me, status: 'pending' })

      if (insertErr) return err(insertErr.message, 500)

      return ok({ success: true, message: '申请已提交' })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
