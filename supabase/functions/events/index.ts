// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// events/index.ts — 校园活动
//
// GET  /events              → 活动列表（keyword, status 过滤，分页）
// POST /events              → 创建活动
// POST /events/:id/signup   → 报名活动
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const segments = getPathSegments(url, 'events')

  try {
    // ── GET /events ──────────────────────────────────────────
    if (req.method === 'GET' && segments.length === 0) {
      return await listEvents(req, url)
    }

    // ── POST /events ─────────────────────────────────────────
    if (req.method === 'POST' && segments.length === 0) {
      return await createEvent(req)
    }

    // ── POST /events/:id/signup ──────────────────────────────
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'signup') {
      return await signupEvent(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[events] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

// ── 列表 ─────────────────────────────────────────────────────
async function listEvents(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const status = url.searchParams.get('status')?.trim() ?? ''

  const db = createAdminClient()

  const now = new Date().toISOString()

  // 先获取活动（带 organizer）并计数
  // 使用 RPC 或者分步查询。这里用分步：先按条件查 events，再关联 users。
  let query = db
    .from('events')
    .select(
      `id, title, description, cover_url, organizer_id,
       start_time, end_time, location, max_participants, current_participants, created_at`,
      { count: 'exact' }
    )
    .order('start_time', { ascending: true })
    .range(offset, offset + limit - 1)

  // status 过滤
  if (status === 'upcoming') {
    query = query.gt('start_time', now)
  } else if (status === 'on_going') {
    query = query.lte('start_time', now).or(`end_time.is.null,end_time.gt.${now}`)
  } else if (status === 'ended') {
    query = query.lt('end_time', now)
  }

  // keyword 过滤
  if (keyword) {
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
  }

  const { data: events, error, count } = await query

  if (error) {
    console.error('[events] list query error:', error)
    return err('获取活动列表失败', 500)
  }

  const eventList = events ?? []
  if (eventList.length === 0) {
    return ok({ data: [], pagination: buildPagination(page, limit, count ?? 0) })
  }

  // 批量获取 organizer 信息
  const organizerIds: string[] = [...new Set(eventList.map((e: any) => e.organizer_id))]
  const { data: users } = await db
    .from('users')
    .select('id, nickname, avatar_url')
    .in('id', organizerIds)

  const profileMap = new Map<string, any>()
  for (const p of users ?? []) profileMap.set(p.id, p)

  // 批量查询当前用户报名情况
  const eventIds: string[] = eventList.map((e: any) => e.id)
  const { data: signups } = await db
    .from('event_signups')
    .select('event_id')
    .eq('user_id', user!.id)
    .in('event_id', eventIds)

  const signedSet = new Set<string>()
  for (const s of signups ?? []) signedSet.add(s.event_id)

  const list = eventList.map((e: any) => {
    const organizer = profileMap.get(e.organizer_id)
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      cover_url: e.cover_url,
      organizer: organizer
        ? { id: organizer.id, nickname: organizer.nickname, avatar_url: organizer.avatar_url }
        : { id: e.organizer_id, nickname: null, avatar_url: null },
      start_time: e.start_time,
      end_time: e.end_time,
      location: e.location,
      max_participants: e.max_participants,
      current_participants: e.current_participants,
      is_signed_up: signedSet.has(e.id),
    }
  })

  return ok({ data: list, pagination: buildPagination(page, limit, count ?? 0) })
}

// ── 创建 ─────────────────────────────────────────────────────
async function createEvent(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { title, description, cover_url, start_time, end_time, location, max_participants } =
    body ?? {}

  if (!title || typeof title !== 'string' || !title.trim()) {
    return err('活动标题不能为空')
  }

  if (!start_time || typeof start_time !== 'string') {
    return err('start_time 不能为空')
  }

  const parsedStart = new Date(start_time)
  if (isNaN(parsedStart.getTime())) {
    return err('start_time 格式不合法，请使用 ISO 8601 格式')
  }

  if (end_time !== undefined && end_time !== null) {
    const parsedEnd = new Date(end_time)
    if (isNaN(parsedEnd.getTime())) {
      return err('end_time 格式不合法，请使用 ISO 8601 格式')
    }
    if (parsedEnd <= parsedStart) {
      return err('end_time 必须晚于 start_time')
    }
  }

  const db = createAdminClient()

  const { data: event, error: insertErr } = await db
    .from('events')
    .insert({
      title: title.trim(),
      description: description ?? null,
      cover_url: cover_url ?? null,
      organizer_id: user!.id,
      start_time: parsedStart.toISOString(),
      end_time: end_time ? new Date(end_time).toISOString() : null,
      location: location ?? null,
      max_participants: typeof max_participants === 'number' ? max_participants : null,
    })
    .select('id')
    .single()

  if (insertErr || !event) {
    console.error('[events] create event error:', insertErr)
    return err('创建活动失败', 500)
  }

  return ok({ success: true, message: '活动创建成功', data: { id: event.id } }, 201)
}

// ── 报名 ─────────────────────────────────────────────────────
async function signupEvent(req: Request, eventId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!eventId) return err('缺少活动 ID', 400)

  const db = createAdminClient()

  // 检查活动是否存在
  const { data: event, error: findErr } = await db
    .from('events')
    .select('id, max_participants, current_participants')
    .eq('id', eventId)
    .maybeSingle()

  if (findErr) {
    console.error('[events] find event error:', findErr)
    return err('查询活动失败', 500)
  }
  if (!event) return err('活动不存在', 404)

  // 检查是否满员
  if (
    event.max_participants !== null &&
    event.current_participants >= event.max_participants
  ) {
    return err('活动名额已满', 400)
  }

  // 检查是否已报名
  const { data: existing } = await db
    .from('event_signups')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (existing) return err('已报名该活动', 400)

  // 插入报名记录（current_participants 由触发器自动更新）
  const { error: signupErr } = await db.from('event_signups').insert({
    event_id: eventId,
    user_id: user!.id,
  })

  if (signupErr) {
    console.error('[events] signup error:', signupErr)
    return err('报名失败', 500)
  }

  return ok({ success: true, message: '报名成功' })
}
