// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

const VALID_TARGET_TYPES = ['user', 'post', 'comment', 'message'] as const
type TargetType = typeof VALID_TARGET_TYPES[number]

/** 验证字符串是否可被当作数值 ID 或 UUID 使用 */
function isValidTargetId(value: string): boolean {
  return /^\d+$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** 检查当前用户是否为管理员 */
async function requireAdmin(req: Request): Promise<[string, null] | [null, Response]> {
  const [user, authResp] = await requireAuth(req)
  if (authResp) return [null, authResp]

  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle()

  if (error || !profile || (profile as { role: string }).role !== 'admin') {
    return [null, err('需要管理员权限', 403)]
  }

  return [user!.id, null]
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'reports')

  try {
    // ── POST /reports ── 提交举报 ────────────────────────────────────
    if (method === 'POST' && segments.length === 0) {
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

    // ── GET /reports ── 管理员获取举报列表 ─────────────────────────────
    if (method === 'GET' && segments.length === 0) {
      const [adminId, adminResp] = await requireAdmin(req)
      if (adminResp) return adminResp

      const supabase = createAdminClient()
      const status = url.searchParams.get('status') || 'pending'

      const { data: reports, error: reportsErr } = await supabase
        .from('reports')
        .select(`
          id,
          reporter_user_id,
          target_type,
          target_id,
          reason,
          description,
          status,
          handler_user_id,
          resolution,
          handler_note,
          created_at,
          resolved_at
        `)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(50)

      if (reportsErr) return err(reportsErr.message, 500)

      // 获取举报人信息
      const reporterIds = [...new Set((reports ?? []).map((r: { reporter_user_id: string }) => r.reporter_user_id))]
      let reporterMap: Record<string, { nickname: string; email: string }> = {}
      if (reporterIds.length > 0) {
        const { data: reporters } = await supabase
          .from('users')
          .select('id, nickname, email')
          .in('id', reporterIds)
        for (const r of (reporters ?? []) as { id: string; nickname: string; email: string }[]) {
          reporterMap[r.id] = { nickname: r.nickname, email: r.email }
        }
      }

      return ok({
        success: true,
        data: (reports ?? []).map((r: {
          id: number
          reporter_user_id: string
          target_type: string
          target_id: number
          reason: string
          description: string | null
          status: string
          handler_user_id: string | null
          resolution: string | null
          handler_note: string | null
          created_at: string
          resolved_at: string | null
        }) => ({
          ...r,
          reporter: reporterMap[r.reporter_user_id] || null,
        })),
      })
    }

    // ── PATCH /reports/:id ── 管理员审核举报 ────────────────────────────
    if (method === 'PATCH' && segments.length === 1) {
      const [adminId, adminResp] = await requireAdmin(req)
      if (adminResp) return adminResp

      const reportId = Number(segments[0])
      if (Number.isNaN(reportId)) return err('无效的举报 ID', 400)

      let body: {
        resolution?: string
        handler_note?: string
      }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { resolution, handler_note } = body
      if (!resolution || !['approve', 'reject'].includes(resolution)) {
        return err('resolution 必须为 approve 或 reject', 400)
      }

      const supabase = createAdminClient()

      // 查询举报记录
      const { data: report, error: reportErr } = await supabase
        .from('reports')
        .select('id, status, target_type, target_id, reporter_user_id')
        .eq('id', reportId)
        .maybeSingle()

      if (reportErr) return err(reportErr.message, 500)
      if (!report) return err('举报记录不存在', 404)
      if ((report as { status: string }).status !== 'pending') {
        return err('该举报已被处理', 400)
      }

      // 更新举报状态
      const { error: updateErr } = await supabase
        .from('reports')
        .update({
          status: resolution === 'approve' ? 'resolved' : 'rejected',
          handler_user_id: adminId,
          resolution,
          handler_note: handler_note || null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', reportId)

      if (updateErr) return err(updateErr.message, 500)

      // 如果审核通过，扣减被举报用户的信用分，并删除/隐藏违规内容
      if (resolution === 'approve') {
        const typedReport = report as { target_type: string; target_id: number; reporter_user_id: string }

        // 根据 target_type 查找被举报内容的作者，并删除/隐藏内容
        let offenderUserId: string | null = null

        if (typedReport.target_type === 'post') {
          const { data: post } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', typedReport.target_id)
            .maybeSingle()
          offenderUserId = (post as { user_id: string } | null)?.user_id ?? null
          // 删除违规帖子
          if (post) {
            await supabase
              .from('posts')
              .delete()
              .eq('id', typedReport.target_id)
          }
        } else if (typedReport.target_type === 'comment') {
          const { data: comment } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', typedReport.target_id)
            .maybeSingle()
          offenderUserId = (comment as { user_id: string } | null)?.user_id ?? null
          // 删除违规评论
          if (comment) {
            await supabase
              .from('posts')
              .delete()
              .eq('id', typedReport.target_id)
          }
        } else if (typedReport.target_type === 'message') {
          const { data: msg } = await supabase
            .from('messages')
            .select('sender_id')
            .eq('id', typedReport.target_id)
            .maybeSingle()
          offenderUserId = (msg as { sender_id: string } | null)?.sender_id ?? null
          // 删除违规消息
          if (msg) {
            await supabase
              .from('messages')
              .delete()
              .eq('id', typedReport.target_id)
          }
        } else if (typedReport.target_type === 'user') {
          offenderUserId = String(typedReport.target_id)
        }

        if (offenderUserId) {
          // 扣减信用分 10 分
          const { data: offender } = await supabase
            .from('users')
            .select('credit_score')
            .eq('id', offenderUserId)
            .maybeSingle()

          if (offender) {
            const newScore = Math.max(0, (offender as { credit_score: number }).credit_score - 10)
            await supabase
              .from('users')
              .update({ credit_score: newScore })
              .eq('id', offenderUserId)

            // 记录信用变更
            await supabase
              .from('credit_records')
              .insert({
                user_id: offenderUserId,
                change: -10,
                reason: '举报审核通过，违规扣分',
              })
          }
        }
      }

      // 记录管理员操作日志
      await supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: adminId,
          action_type: resolution === 'approve' ? 'report_approve' : 'report_reject',
          target_type: 'report',
          target_id: reportId,
          details: handler_note || null,
        })

      return ok({
        success: true,
        message: resolution === 'approve' ? '举报已确认，已扣减违规用户信用分' : '举报已驳回',
      })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
