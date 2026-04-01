// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// user-tags/index.ts — 用户标签管理
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // 处理 CORS 预检
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  // segments: [] → /user-tags, ['uuid'] → /user-tags/:userId
  const segments = getPathSegments(url, 'user-tags')

  try {
    // GET /user-tags/:userId → 获取某用户的标签
    if (req.method === 'GET' && segments.length === 1) {
      return await handleGetUserTags(req, segments[0])
    }

    // POST /user-tags → 设置当前用户的标签
    if (req.method === 'POST' && segments.length === 0) {
      return await handleSetUserTags(req)
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Server Error'
    return err(message, 500)
  }
})

// ----------------------------------------------------------------
// GET /user-tags/:userId — 获取某用户的标签
// ----------------------------------------------------------------
async function handleGetUserTags(req: Request, userId: string): Promise<Response> {
  const [, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const admin = createAdminClient()

  // JOIN user_tags 和 tags，获取标签详情
  const { data, error } = await admin
    .from('user_tags')
    .select('tag_id, tags(id, name)')
    .eq('user_id', userId)

  if (error) {
    return err('获取用户标签失败，请稍后重试', 500)
  }

  // 整理返回格式
  const result = (data ?? []).map((row: { tag_id: number; tags: { id: number; name: string } | null }) => ({
    tag_id: row.tag_id,
    tag_name: row.tags?.name ?? null,
  }))

  return ok({ success: true, data: result })
}

// ----------------------------------------------------------------
// POST /user-tags — 设置当前用户的标签（全量替换）
// ----------------------------------------------------------------
async function handleSetUserTags(req: Request): Promise<Response> {
  const [currentUser, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: { tag_ids?: number[] }
  try {
    body = await req.json()
  } catch {
    return err('请求体格式错误', 400)
  }

  const { tag_ids } = body

  if (!Array.isArray(tag_ids)) {
    return err('tag_ids 必须是数组', 400)
  }

  // 验证所有元素都是正整数
  if (!tag_ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return err('tag_ids 中的元素必须是正整数', 400)
  }

  const userId = currentUser!.id
  const admin = createAdminClient()

  // 如果提供了 tag_ids，先验证这些 tag 是否都存在
  if (tag_ids.length > 0) {
    const { data: existingTags, error: tagsCheckError } = await admin
      .from('tags')
      .select('id')
      .in('id', tag_ids)

    if (tagsCheckError) {
      return err('验证标签失败，请稍后重试', 500)
    }

    if ((existingTags ?? []).length !== tag_ids.length) {
      return err('包含不存在的标签 ID', 400)
    }
  }

  // 事务：先删除当前用户所有标签，再重新插入
  const { error: deleteError } = await admin
    .from('user_tags')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    return err('更新标签失败，请稍后重试', 500)
  }

  // 如果 tag_ids 不为空，则批量插入
  if (tag_ids.length > 0) {
    const insertRows = tag_ids.map((tag_id) => ({ user_id: userId, tag_id }))

    const { error: insertError } = await admin.from('user_tags').insert(insertRows)

    if (insertError) {
      return err('更新标签失败，请稍后重试', 500)
    }
  }

  return ok({ success: true, message: '标签设置成功' })
}
