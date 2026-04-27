// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

/** 根据信用分计算等级 */
function getCreditLevel(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 50) return '一般'
  return '较差'
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const method = req.method

  try {
    // ── GET /credit ── 获取当前用户信用信息 ──────────────────────────
    if (method === 'GET') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const supabase = createAdminClient()

      // 查询信用分
      const { data: profile, error: profileErr } = await supabase
        .from('users')
        .select('credit_score')
        .eq('id', me)
        .maybeSingle()

      if (profileErr) return err(profileErr.message, 500)
      if (!profile) return err('用户不存在', 404)

      const creditScore: number = (profile as { credit_score: number }).credit_score ?? 0
      const level = getCreditLevel(creditScore)

      // 查询最近 50 条信用记录
      const { data: records, error: recordsErr } = await supabase
        .from('credit_records')
        .select('change, reason, created_at')
        .eq('user_id', me)
        .order('created_at', { ascending: false })
        .limit(50)

      if (recordsErr) {
        console.error('[credit] get records error:', JSON.stringify(recordsErr))
        return err(recordsErr.message, 500)
      }

      return ok({
        success: true,
        data: {
          credit_score: creditScore,
          level,
          records: (records ?? []).map((r: {
            change: number
            reason: string
            created_at: string
          }) => ({
            type: r.change >= 0 ? 'increase' : 'decrease',
            amount: Math.abs(r.change),
            reason: r.reason,
            created_at: r.created_at,
          })),
        },
      })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
