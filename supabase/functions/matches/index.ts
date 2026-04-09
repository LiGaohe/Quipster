// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'matches')

  try {
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const { page, limit, offset } = parsePagination(url)
      const supabase = createAdminClient()

      // 1. 获取我的标签
      const { data: myTags, error: myTagErr } = await supabase
        .from('user_tags')
        .select('tag_id, tags(name)')
        .eq('user_id', me)

      if (myTagErr) return err(myTagErr.message, 500)

      const myTagIds = (myTags ?? []).map((row: { tag_id: number }) => row.tag_id)
      const myTagNames = (myTags ?? [])
        .map((row: { tags: { name: string } | null }) => row.tags?.name)
        .filter(Boolean) as string[]

      // 2. 查询我已经操作过的用户（使用 matches 表）
      const { data: actionedRows, error: actionedErr } = await supabase
        .from('matches')
        .select('target_user_id')
        .eq('user_id', me)

      if (actionedErr) return err(actionedErr.message, 500)

      const excludedIds: string[] = [me, ...(actionedRows ?? []).map((r: { target_user_id: string }) => r.target_user_id)]

      // 3. 查询候选用户（visibility=1 或 NULL，排除已操作）
      const { data: candidates, error: candErr, count } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, major', { count: 'exact' })
        .or('visibility.eq.1,visibility.is.null')
        .not('id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
        .range(offset, offset + limit - 1)

      if (candErr) {
        if (candErr.code === 'PGRST103') {
          return ok({
            success: true,
            data: [],
            pagination: buildPagination(page, limit, 0),
          })
        }
        return err(candErr.message, 500)
      }

      const candidateList = candidates ?? []

      if (candidateList.length === 0) {
        return ok({
          success: true,
          data: [],
          pagination: buildPagination(page, limit, count ?? 0),
        })
      }

      // 4. 对每个候选用户计算共同标签和匹配分数
      const enriched = await Promise.all(
        candidateList.map(async (candidate: { id: string; nickname: string; avatar_url: string; major: string }) => {
          const { data: candTagRows } = await supabase
            .from('user_tags')
            .select('tag_id, tags(name)')
            .eq('user_id', candidate.id)

          const candTagIds = (candTagRows ?? []).map((r: { tag_id: number }) => r.tag_id)
          const candTagNames = (candTagRows ?? [])
            .map((r: { tags: { name: string } | null }) => r.tags?.name)
            .filter(Boolean) as string[]

          const commonTagNames = myTagNames.filter(name => candTagNames.includes(name))

          const denominator = Math.max(myTagIds.length, candTagIds.length)
          const match_score = denominator > 0
            ? Math.round((commonTagNames.length / denominator) * 100)
            : 0

          return {
            user_id: candidate.id,
            nickname: candidate.nickname,
            avatar_url: candidate.avatar_url,
            major: candidate.major,
            common_tags: commonTagNames,
            match_score,
          }
        })
      )

      enriched.sort((a, b) => b.match_score - a.match_score)

      return ok({
        success: true,
        data: enriched,
        pagination: buildPagination(page, limit, count ?? 0),
      })
    }

    if (method === 'POST' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      let body: { target_user_id?: string; action?: string }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { target_user_id, action } = body

      if (!target_user_id) return err('target_user_id 不能为空', 400)
      if (action !== 'like' && action !== 'dislike') {
        return err('action 必须为 like 或 dislike', 400)
      }
      if (target_user_id === me) return err('不能对自己操作', 400)

      const supabase = createAdminClient()

      // 使用 matches 表记录操作
      const { error: upsertErr } = await supabase
        .from('matches')
        .upsert(
          { user_id: me, target_user_id, action },
          { onConflict: 'user_id,target_user_id' }
        )

      if (upsertErr) return err(upsertErr.message, 500)

      // 检查是否互相喜欢
      let isMatched = false
      if (action === 'like') {
        const { data: reverseMatch, error: reverseErr } = await supabase
          .from('matches')
          .select('id')
          .eq('user_id', target_user_id)
          .eq('target_user_id', me)
          .eq('action', 'like')
          .maybeSingle()

        if (!reverseErr && reverseMatch) {
          isMatched = true
          await supabase
            .from('matches')
            .update({ is_matched: true, matched_at: new Date().toISOString() })
            .eq('user_id', me)
            .eq('target_user_id', target_user_id)
        }
      }

      return ok({ success: true, is_matched: isMatched })
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
