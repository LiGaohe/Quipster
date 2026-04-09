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
    if (req.method === 'GET' && segments.length === 0) {
      return await listEvents(req, url)
    }

    if (req.method === 'POST' && segments.length === 0) {
      return await createEvent(req)
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'signup') {
      return await signupEvent(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[events] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

async function listEvents(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const status = url.searchParams.get('status')?.trim() ?? ''

  const db = createAdminClient()

  const now = new Date().toISOString()

  let query = db
    .from('activities')
    .select(
      `id, title, description, image_url, creator_user_id,
       start_time, end_time, location, max_participants, created_at`,
      { count: 'exact' }
    )
    .order('start_time', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status === 'upcoming') {
    query = query.gt('start_time', now)
  } else if (status === 'on_going') {
    query = query.lte('start_time', now).or(`end_time.is.null,end_time.gt.${now}`)
  } else if (status === 'ended') {
    query = query.lt('end_time', now)
  }

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

  const creatorIds: string[] = [...new Set(eventList.map((e: any) => e.creator_user_id))]
  const { data: users } = await db
    .from('users')
    .select('id, nickname, avatar_url')
    .in('id', creatorIds)

  const profileMap = new Map<string, any>()
  for (const p of users ?? []) profileMap.set(p.id, p)

  const eventIds: string[] = eventList.map((e: any) => e.id)

  const { data: participants } = await db
    .from('activity_participants')
    .select('activity_id, user_id')

  const participantCountMap = new Map<string, number>()
  const signedSet = new Set<string>()
  for (const p of participants ?? []) {
    if (!participantCountMap.has(p.activity_id)) {
      participantCountMap.set(p.activity_id, 0)
    }
    participantCountMap.set(p.activity_id, participantCountMap.get(p.activity_id)! + 1)
    if (p.user_id === user!.id) {
      signedSet.add(p.activity_id)
    }
  }

  const list = eventList.map((e: any) => {
    const creator = profileMap.get(e.creator_user_id)
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      image_url: e.image_url,
      organizer: creator
        ? { id: creator.id, nickname: creator.nickname, avatar_url: creator.avatar_url }
        : { id: e.creator_user_id, nickname: null, avatar_url: null },
      start_time: e.start_time,
      end_time: e.end_time,
      location: e.location,
      max_participants: e.max_participants,
      current_participants: participantCountMap.get(e.id) ?? 0,
      is_signed_up: signedSet.has(e.id),
    }
  })

  return ok({ data: list, pagination: buildPagination(page, limit, count ?? 0) })
}

async function createEvent(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { title, description, image_url, start_time, end_time, location, max_participants } =
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
    .from('activities')
    .insert({
      title: title.trim(),
      description: description ?? null,
      image_url: image_url ?? null,
      creator_user_id: user!.id,
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

async function signupEvent(req: Request, eventId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!eventId) return err('缺少活动 ID', 400)

  const db = createAdminClient()

  const { data: event, error: findErr } = await db
    .from('activities')
    .select('id, max_participants')
    .eq('id', eventId)
    .maybeSingle()

  if (findErr) {
    console.error('[events] find event error:', findErr)
    return err('查询活动失败', 500)
  }
  if (!event) return err('活动不存在', 404)

  const { count: currentCount } = await db
    .from('activity_participants')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', eventId)

  if (
    event.max_participants !== null &&
    (currentCount ?? 0) >= event.max_participants
  ) {
    return err('活动名额已满', 400)
  }

  const { data: existing } = await db
    .from('activity_participants')
    .select('activity_id')
    .eq('activity_id', eventId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (existing) return err('已报名该活动', 400)

  const { error: signupErr } = await db.from('activity_participants').insert({
    activity_id: eventId,
    user_id: user!.id,
    status: 'registered',
  })

  if (signupErr) {
    console.error('[events] signup error:', signupErr)
    return err('报名失败', 500)
  }

  return ok({ success: true, message: '报名成功' })
}
