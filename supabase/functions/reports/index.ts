// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

const VALID_TARGET_TYPES = ['user', 'post', 'comment', 'message'] as const
type TargetType = typeof VALID_TARGET_TYPES[number]

/** 验证字符串是否可被当作数值 ID 或 UUID 使用 */
function isValidTargetId(value: string): boolean {
  return /^\d+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const method = req.method

  try {
    // ── POST /reports ── 提交举报 ────────────────────────────────────
    if (method === 'POST') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      let body: {
        target_type?: string
        target_id?: string
        reason?: string
        description?: string
      }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { target_type, target_id, reason, description } = body

      // 验证 target_type
      if (!target_type || !(VALID_TARGET_TYPES as readonly string[]).includes(target_type)) {
        return err(
          `target_type 必须为以下之一: ${VALID_TARGET_TYPES.join(', ')}`,
          400
        )
      }

      // 验证 target_id 为合法数值 ID 或 UUID
      if (!target_id || !isValidTargetId(target_id)) {
        return err('target_id 必须是合法的 ID', 400)
      }

      // 验证 reason 非空
      if (!reason || reason.trim() === '') {
        return err('举报原因不能为空', 400)
      }

      const supabase = createAdminClient()

      const { error: insertErr } = await supabase
        .from('reports')
        .insert({
          reporter_user_id: me,
          target_type: target_type as TargetType,
          target_id: Number(target_id),
          reason: reason.trim(),
          description: description?.trim() ?? null,
        })

      if (insertErr) return err(insertErr.message, 500)

      return ok({ success: true, message: '举报已提交，感谢您的反馈' }, 201)
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
