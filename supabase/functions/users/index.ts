// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// users/index.ts — 用户资料管理
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // 处理 CORS 预检
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  // segments: [] → /users, ['uuid'] → /users/:id
  const segments = getPathSegments(url, 'users')

  try {
    // GET /users → 搜索用户
    if (req.method === 'GET' && segments.length === 0) {
      return await handleSearch(req, url)
    }

    // GET /users/:id → 获取指定用户资料
    if (req.method === 'GET' && segments.length === 1) {
      return await handleGetUser(req, segments[0])
    }

    // PUT /users/:id → 更新用户资料
    if (req.method === 'PUT' && segments.length === 1) {
      return await handleUpdateUser(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Server Error'
    return err(message, 500)
  }
})

// ----------------------------------------------------------------
// GET /users/:id — 获取指定用户资料
// ----------------------------------------------------------------
async function handleGetUser(req: Request, userId: string): Promise<Response> {
  const [, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, email, nickname, avatar_url, gender, major, grade, bio, credit_score, visibility, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return err('查询失败，请稍后重试', 500)
  }
  if (!profile) {
    return err('用户不存在', 404)
  }

  return ok({ success: true, data: profile })
}

// ----------------------------------------------------------------
// PUT /users/:id — 更新用户资料
// ----------------------------------------------------------------
async function handleUpdateUser(req: Request, userId: string): Promise<Response> {
  const [currentUser, authErr] = await requireAuth(req)
  if (authErr) return authErr

  // 只能修改自己的资料
  if (currentUser!.id !== userId) {
    return err('无权修改其他用户的资料', 403)
  }

  let body: {
    nickname?: string
    avatar_url?: string
    gender?: string
    major?: string
    grade?: string
    bio?: string
    visibility?: number
  }
  try {
    body = await req.json()
  } catch {
    return err('请求体格式错误', 400)
  }

  // 验证 nickname（如果提供）
  if (body.nickname !== undefined) {
    const trimmed = body.nickname.trim()
    if (trimmed.length < 2 || trimmed.length > 20) {
      return err('昵称长度需在 2-20 字符之间', 400)
    }
    body.nickname = trimmed
  }

  const admin = createAdminClient()

  // 检查昵称唯一性（排除当前用户）
  if (body.nickname !== undefined) {
    const { data: existingProfile, error: checkError } = await admin
      .from('profiles')
      .select('id')
      .eq('nickname', body.nickname)
      .neq('id', userId)
      .maybeSingle()

    if (checkError) {
      return err('服务器错误，请稍后重试', 500)
    }
    if (existingProfile) {
      return err('昵称已被使用，请换一个昵称', 400)
    }
  }

  // 构建更新对象，只包含提供的字段
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowedFields = ['nickname', 'avatar_url', 'gender', 'major', 'grade', 'bio', 'visibility'] as const
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updatePayload[field] = body[field]
    }
  }

  const { data: updated, error: updateError } = await admin
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('id, email, nickname, avatar_url, gender, major, grade, bio, credit_score, visibility, created_at, updated_at')
    .maybeSingle()

  if (updateError) {
    return err('更新失败，请稍后重试', 500)
  }
  if (!updated) {
    return err('用户不存在', 404)
  }

  return ok({ success: true, data: updated })
}

// ----------------------------------------------------------------
// GET /users — 搜索用户
// ----------------------------------------------------------------
async function handleSearch(req: Request, url: URL): Promise<Response> {
  const [, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const keyword = url.searchParams.get('keyword')?.trim() ?? ''
  const major = url.searchParams.get('major')?.trim() ?? ''
  const grade = url.searchParams.get('grade')?.trim() ?? ''
  const { page, limit, offset } = parsePagination(url)

  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select('id, nickname, avatar_url, major, grade', { count: 'exact' })
    .eq('visibility', 1)

  if (keyword) {
    // ILIKE 匹配 nickname 或 major
    query = query.or(`nickname.ilike.%${keyword}%,major.ilike.%${keyword}%`)
  }
  if (major) {
    query = query.eq('major', major)
  }
  if (grade) {
    query = query.eq('grade', grade)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) {
    return err('搜索失败，请稍后重试', 500)
  }

  return ok({
    success: true,
    data: data ?? [],
    pagination: buildPagination(page, limit, count ?? 0),
  })
}
