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
// GET  /groups/:id        → 获取社群详情
// PUT  /groups/:id        → 编辑社群
// POST /groups/:id/join   → 加入社群
// POST /groups/:id/leave  → 退出社群
// GET  /groups/:id/chat   → 获取社群聊天会话ID
// GET  /groups/:id/members → 获取社群成员列表
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const segments = getPathSegments(url, 'groups')

  try {
    if (req.method === 'GET' && segments.length === 0) {
      return await listGroups(req, url)
    }

    if (req.method === 'POST' && segments.length === 0) {
      return await createGroup(req)
    }

    if (req.method === 'GET' && segments.length === 1) {
      return await getGroup(req, segments[0])
    }

    if (req.method === 'PUT' && segments.length === 1) {
      return await updateGroup(req, segments[0])
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'join') {
      return await joinGroup(req, segments[0])
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'leave') {
      return await leaveGroup(req, segments[0])
    }

    if (req.method === 'GET' && segments.length === 2 && segments[1] === 'chat') {
      return await getGroupChat(req, segments[0])
    }

    if (req.method === 'GET' && segments.length === 2 && segments[1] === 'members') {
      return await getGroupMembers(req, segments[0], url)
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[groups] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

async function listGroups(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const keyword = url.searchParams.get('keyword')?.trim() ?? ''

  const db = createAdminClient()

  let query = db
    .from('groups')
    .select('id, name, description, avatar_url, created_at', { count: 'exact' })
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

  const groupIds: number[] = (groups ?? []).map((g: any) => g.id)
  let joinedSet = new Set<number>()
  let memberCountMap = new Map<number, number>()

  if (groupIds.length > 0) {
    const { data: memberships } = await db
      .from('conversation_members')
      .select('group_id, user_id')
      .in('group_id', groupIds)

    if (memberships) {
      for (const m of memberships) {
        if (!memberCountMap.has(m.group_id)) {
          memberCountMap.set(m.group_id, 0)
        }
        memberCountMap.set(m.group_id, memberCountMap.get(m.group_id)! + 1)
        if (m.user_id === user!.id) {
          joinedSet.add(m.group_id)
        }
      }
    }
  }

  const list = (groups ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    avatar_url: g.avatar_url,
    member_count: memberCountMap.get(g.id) ?? 0,
    is_joined: joinedSet.has(g.id),
  }))

  return ok({
    data: list,
    pagination: buildPagination(page, limit, count ?? 0),
  })
}

async function getGroup(req: Request, groupIdStr: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  const db = createAdminClient()

  const { data: group, error } = await db
    .from('groups')
    .select('id, name, description, avatar_url, creator_user_id, created_at, conversation_id')
    .eq('id', groupId)
    .maybeSingle()

  if (error) {
    console.error('[groups] get group error:', error)
    return err('获取社群信息失败', 500)
  }
  if (!group) return err('社群不存在', 404)

  const { data: memberships } = await db
    .from('conversation_members')
    .select('user_id, role')
    .eq('group_id', groupId)

  const memberCount = memberships?.length ?? 0
  const myMembership = memberships?.find((m: any) => m.user_id === user!.id)
  const isJoined = !!myMembership
  const myRole = myMembership?.role ?? null

  return ok({
    data: {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar_url: group.avatar_url,
      creator_user_id: group.creator_user_id,
      created_at: group.created_at,
      conversation_id: group.conversation_id,
      member_count: memberCount,
      is_joined: isJoined,
      my_role: myRole,
    },
  })
}

async function getGroupChat(req: Request, groupIdStr: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  const db = createAdminClient()

  const { data: membership } = await db
    .from('conversation_members')
    .select('conversation_id')
    .eq('group_id', groupId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (!membership) return err('未加入该社群，无法进入群聊', 403)

  return ok({
    data: {
      conversation_id: membership.conversation_id,
    },
  })
}

async function updateGroup(req: Request, groupIdStr: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { name, description, avatar_url } = body ?? {}

  const db = createAdminClient()

  const { data: group, error: findErr } = await db
    .from('groups')
    .select('id, creator_user_id')
    .eq('id', groupId)
    .maybeSingle()

  if (findErr) {
    console.error('[groups] find group error:', findErr)
    return err('查询社群失败', 500)
  }
  if (!group) return err('社群不存在', 404)

  if (group.creator_user_id !== user!.id) {
    return err('只有社群创建者才能编辑社群', 403)
  }

  const updates: Record<string, any> = {}
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return err('社群名称至少需要 2 个字符')
    }
    updates.name = name.trim()
  }
  if (description !== undefined) {
    updates.description = description?.trim() ?? null
  }
  if (avatar_url !== undefined) {
    updates.avatar_url = avatar_url?.trim() ?? null
  }

  if (Object.keys(updates).length === 0) {
    return err('没有需要更新的内容')
  }

  const { error: updateErr } = await db
    .from('groups')
    .update(updates)
    .eq('id', groupId)

  if (updateErr) {
    console.error('[groups] update group error:', updateErr)
    return err('更新社群失败', 500)
  }

  return ok({ success: true, message: '社群信息已更新' })
}

async function createGroup(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { name, description, avatar_url, tags } = body ?? {}

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return err('社群名称至少需要 2 个字符')
  }

  const db = createAdminClient()

  const { data: group, error: insertErr } = await db
    .from('groups')
    .insert({
      name: name.trim(),
      description: description ?? null,
      avatar_url: avatar_url ?? null,
      creator_user_id: user!.id,
    })
    .select('id')
    .single()

  if (insertErr || !group) {
    console.error('[groups] create group error:', insertErr)
    return err('创建社群失败', 500)
  }

  const groupId: number = group.id

  const { data: conversation, error: convErr } = await db
    .from('conversations')
    .insert({
      name: name.trim(),
      is_group: true,
      creator_user_id: user!.id,
      group_id: groupId,
    })
    .select('id')
    .single()

  if (convErr || !conversation) {
    console.error('[groups] create conversation error:', convErr)
    await db.from('groups').delete().eq('id', groupId)
    return err('创建社群会话失败', 500)
  }

  const conversationId: number = conversation.id

  const { error: memberErr } = await db.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: user!.id,
    role: 'owner',
    related_type: 'group',
    group_id: groupId,
  })

  if (memberErr) {
    console.error('[groups] insert creator member error:', memberErr)
  }

  await db
    .from('groups')
    .update({ conversation_id: conversationId })
    .eq('id', groupId)

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

async function joinGroup(req: Request, groupIdStr: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  const db = createAdminClient()

  const { data: group, error: findErr } = await db
    .from('groups')
    .select('id, conversation_id')
    .eq('id', groupId)
    .maybeSingle()

  if (findErr) {
    console.error('[groups] find group error:', findErr)
    return err('查询社群失败', 500)
  }
  if (!group) return err('社群不存在', 404)

  const { data: existing } = await db
    .from('conversation_members')
    .select('conversation_id')
    .eq('group_id', groupId)
    .eq('user_id', user!.id)
    .maybeSingle()

  if (existing) return err('已加入该社群', 400)

  let conversationId = group.conversation_id

  if (!conversationId) {
    const { data: conv } = await db
      .from('conversations')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle()

    if (conv) {
      conversationId = conv.id
      await db.from('groups').update({ conversation_id: conversationId }).eq('id', groupId)
    } else {
      const { data: groupInfo } = await db
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()

      const { data: newConv, error: convErr } = await db
        .from('conversations')
        .insert({
          name: groupInfo?.name ?? '社群',
          is_group: true,
          creator_user_id: user!.id,
          group_id: groupId,
        })
        .select('id')
        .single()

      if (convErr || !newConv) {
        console.error('[groups] create conversation for join error:', convErr)
        return err('加入社群失败', 500)
      }

      conversationId = newConv.id
      await db.from('groups').update({ conversation_id: conversationId }).eq('id', groupId)
    }
  }

  const { error: joinErr } = await db.from('conversation_members').insert({
    conversation_id: conversationId,
    user_id: user!.id,
    role: 'member',
    related_type: 'group',
    group_id: groupId,
  })

  if (joinErr) {
    console.error('[groups] join group error:', joinErr)
    return err('加入社群失败', 500)
  }

  return ok({ success: true, message: '加入成功' })
}

async function leaveGroup(req: Request, groupIdStr: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  const db = createAdminClient()

  const { data: group, error: findErr } = await db
    .from('groups')
    .select('id, creator_user_id')
    .eq('id', groupId)
    .maybeSingle()

  if (findErr) {
    console.error('[groups] find group error:', findErr)
    return err('查询社群失败', 500)
  }
  if (!group) return err('社群不存在', 404)

  if (group.creator_user_id === user!.id) {
    return err('创建者不能退出社群，请转让或解散', 400)
  }

  const { error: leaveErr } = await db
    .from('conversation_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user!.id)

  if (leaveErr) {
    console.error('[groups] leave group error:', leaveErr)
    return err('退出社群失败', 500)
  }

  return ok({ success: true, message: '已退出社群' })
}

async function getGroupMembers(req: Request, groupIdStr: string, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const groupId = parseInt(groupIdStr, 10)
  if (isNaN(groupId)) return err('无效的社群 ID', 400)

  const { page, limit, offset } = parsePagination(url)

  const db = createAdminClient()

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

  const { data: memberships, error: memberErr, count } = await db
    .from('conversation_members')
    .select('user_id, role, joined_at, users(id, nickname, avatar_url)', { count: 'exact' })
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (memberErr) {
    console.error('[groups] get members error:', memberErr)
    return err('获取成员列表失败', 500)
  }

  const members = (memberships ?? []).map((m: any) => ({
    user_id: m.user_id,
    nickname: m.users?.nickname ?? null,
    avatar_url: m.users?.avatar_url ?? null,
    role: m.role,
    joined_at: m.joined_at,
  }))

  return ok({
    data: members,
    pagination: buildPagination(page, limit, count ?? 0),
  })
}
