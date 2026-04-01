// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// ============================================================
// tags/index.ts — 获取所有标签
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // 处理 CORS 预检
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  try {
    // GET /tags
    if (req.method === 'GET') {
      return await handleGetTags(req)
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Server Error'
    return err(message, 500)
  }
})

// ----------------------------------------------------------------
// GET /tags — 返回全部标签
// ----------------------------------------------------------------
async function handleGetTags(req: Request): Promise<Response> {
  const [, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tags')
    .select('id, name, category')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    return err('获取标签失败，请稍后重试', 500)
  }

  return ok({ success: true, data: data ?? [] })
}
