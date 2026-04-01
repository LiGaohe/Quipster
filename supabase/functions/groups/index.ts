// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// groups/index.ts — 兴趣社群
//
// GET  /groups            → 社群列表（keyword 搜索，分页）
// POST /groups            → 创建社群
// POST /groups/:id/join   → 加入社群
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // 处理 CORS 预检
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const segments = getPathSegments(url, 'groups')
  // segments[]:
  //   []           → GET /groups  or  POST /groups
  //   [':id', 'join'] → POST /groups/:id/join

  try {
    // ── GET /groups ─────────────────────────────────────────
    if (req.method === 'GET' && segments.length === 0) {
      return await listGroups(req, url)
    }

    // ── POST /groups ─────────────────────────────────────────
    if (req.method === 'POST' && segments.length === 0) {
      return await createGroup(req)
    }

    // ── POST /groups/:id/join ─────────────────────────────────
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'join') {
      return await joinGroup(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[groups] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

// ── 列表 ─────────────────────────────────────────────────────
async function listGroups(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''

  const db = createAdminClient()

  // 构造查询
  let query = db
    .from('groups')
    .select('id, name, description, cover_url, member_count', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (keyword) {
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
  }

  const { data: groups, error, count } = await query

  if (error) {
    console.error('[groups] list query error:', error)
    return err('获取社群列表失败', 500)
  }

  // 查询当前用户已加入的社群 id 集合
  const groupIds: string[] = (groups ?? []).map((g: any) => g.id)
  let joinedSet = new Set<string>()

  if (groupIds.length > 0) {
    const { data: memberships } = await db
      .from('group_members')
      .select('group_id')
      .eq('user_id', user!.id)
      .in('group_id', groupIds)

    if (memberships) {
      for (const m of memberships) joinedSet.add(m.group_id)
    }
  }

  const list = (groups ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    cover_url: g.cover_url,
    member_count: g.member_count,
    is_joined: joinedSet.has(g.id),
  }))

  return ok({
    data: list,
    pagination: buildPagination(page, limit, count ?? 0),
  })
}

// ── 创建 ─────────────────────────────────────────────────────
async function createGroup(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { name, description, cover_url, tags } = body ?? {}

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return err('社群名称至少需要 2 个字符')
  }

  const db = createAdminClient()

  // 插入社群
  const { data: group, error: insertErr } = await db
    .from('groups')
    .insert({
      name: name.trim(),
      description: description ?? null,
      cover_url: cover_url ?? null,
      creator_id: user!.id,
    })
    .select('id')
    .single()

  if (insertErr || !group) {
    console.error('[groups] create group error:', insertErr)
    return err('创建社群失败', 500)
  }

  const groupId: string = group.id

  // 创建者自动成为 creator 成员
  const { error: memberErr } = await db.from('group_members').insert({
    group_id: groupId,
    user_id: user!.id,
    role: 'creator',
  })

  if (memberErr) {
    console.error('[groups] insert creator member error:', memberErr)
    // 不阻断流程，仅记录
  }

  // 插入标签关联
  if (Array.isArray(tags) && tags.length > 0) {
    const tagRows = tags
      .filter((t: any) => typeof t === 'number')
      .map((tagId: number) => ({ group_id: groupId, tag_id: tagId }))

    if (tagRows.length > 0) {
      const { error: tagErr } = await db.from('group_tags').insert(tagRows)
      if (tagErr) {
        console.error('[groups] insert group_tags error:', tagErr)
      }
    }
  }

  return ok({ success: true, message: '社群创建成功', data: { id: groupId } }, 201)
}

// ── 加入 ─────────────────────────────────────────────────────
async function joinGroup(req: Request, groupId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!groupId) return err('缺少社群 ID', 400)

  const db = createAdminClient()

  // 检查社群是否存在
  const { data: group, error: findErr } = await db
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .maybeSingle()

  if (findErr) {
    console.error('[groups] find group error:', findErr)
    return err('查询社群失败', 500)
  }
  if (!group) return err('社群不存在', 404)

  // 检查是否已加入
  const { data: existing } = await db
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (existing) return err('已加入该社群', 400)

  // 加入
  const { error: joinErr } = await db.from('group_members').insert({
    group_id: groupId,
    user_id: user!.id,
    role: 'member',
  })

  if (joinErr) {
    console.error('[groups] join group error:', joinErr)
    return err('加入社群失败', 500)
  }

  return ok({ success: true, message: '加入成功' })
}
