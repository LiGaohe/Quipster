// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method

  try {
    // ── GET /matches ── 推荐用户列表 ───────────────────────────────
    if (method === 'GET') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const { page, limit, offset } = parsePagination(url)

      const supabase = createAdminClient()

      // 1. 获取当前用户的所有标签
      const { data: myTagRows, error: myTagErr } = await supabase
        .from('user_tags')
        .select('tag_id')
        .eq('user_id', me)

      if (myTagErr) return err(myTagErr.message, 500)

      const myTagIds: number[] = (myTagRows ?? []).map((r: { tag_id: number }) => r.tag_id)

      // 2. 获取已经操作过的目标用户 id
      const { data: actionedRows, error: actionedErr } = await supabase
        .from('matches')
        .select('target_user_id')
        .eq('user_id', me)

      if (actionedErr) return err(actionedErr.message, 500)

      const excludedIds: string[] = [me, ...(actionedRows ?? []).map((r: { target_user_id: string }) => r.target_user_id)]

      // 3. 查询候选用户（visibility=1，排除已操作）
      const { data: candidates, error: candErr, count } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url, major', { count: 'exact' })
        .eq('visibility', 1)
        .not('id', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
        .range(offset, offset + limit - 1)

      if (candErr) return err(candErr.message, 500)

      const candidateList = candidates ?? []

      // 4. 对每个候选用户计算共同标签和匹配分数
      const enriched = await Promise.all(
        candidateList.map(async (candidate: { id: string; nickname: string; avatar_url: string; major: string }) => {
          // 获取候选用户标签
          const { data: candTagRows } = await supabase
            .from('user_tags')
            .select('tag_id')
            .eq('user_id', candidate.id)

          const candTagIds: number[] = (candTagRows ?? []).map((r: { tag_id: number }) => r.tag_id)

          // 计算共同标签 id
          const commonTagIds = myTagIds.filter(tid => candTagIds.includes(tid))

          // 获取共同标签名
          let commonTagNames: string[] = []
          if (commonTagIds.length > 0) {
            const { data: tagNameRows } = await supabase
              .from('tags')
              .select('name')
              .in('id', commonTagIds)
            commonTagNames = (tagNameRows ?? []).map((r: { name: string }) => r.name)
          }

          // 计算匹配分数
          const denominator = Math.max(myTagIds.length, candTagIds.length)
          const match_score = denominator > 0
            ? Math.round((commonTagIds.length / denominator) * 100)
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

      // 5. 按 match_score 降序排列
      enriched.sort((a, b) => b.match_score - a.match_score)

      return ok({
        success: true,
        data: enriched,
        pagination: buildPagination(page, limit, count ?? 0),
      })
    }

    // ── POST /matches ── 记录 like/dislike 操作 ────────────────────
    if (method === 'POST') {
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
      if (action !== 'like' && action !== 'dislike') return err('action 必须为 like 或 dislike', 400)
      if (target_user_id === me) return err('不能对自己操作', 400)

      const supabase = createAdminClient()

      // 1. UPSERT matches 记录
      const { error: upsertErr } = await supabase
        .from('matches')
        .upsert(
          { user_id: me, target_user_id, action },
          { onConflict: 'user_id,target_user_id' }
        )

      if (upsertErr) return err(upsertErr.message, 500)

      // 2. 仅当 action='like' 时检查是否互相喜欢
      if (action === 'like') {
        const { data: reverseMatch, error: reverseErr } = await supabase
          .from('matches')
          .select('id')
          .eq('user_id', target_user_id)
          .eq('target_user_id', me)
          .eq('action', 'like')
          .maybeSingle()

        if (reverseErr) return err(reverseErr.message, 500)

        if (reverseMatch) {
          // 互相喜欢 —— 更新两条记录 is_matched=true
          const { error: updateErr1 } = await supabase
            .from('matches')
            .update({ is_matched: true })
            .eq('user_id', me)
            .eq('target_user_id', target_user_id)

          if (updateErr1) return err(updateErr1.message, 500)

          const { error: updateErr2 } = await supabase
            .from('matches')
            .update({ is_matched: true })
            .eq('user_id', target_user_id)
            .eq('target_user_id', me)

          if (updateErr2) return err(updateErr2.message, 500)

          // 自动创建 conversation（user1_id < user2_id）
          const user1_id = me < target_user_id ? me : target_user_id
          const user2_id = me < target_user_id ? target_user_id : me

          const { error: convErr } = await supabase
            .from('conversations')
            .upsert(
              { user1_id, user2_id },
              { onConflict: 'user1_id,user2_id', ignoreDuplicates: true }
            )

          if (convErr) return err(convErr.message, 500)

          return ok({ success: true, is_matched: true, message: '匹配成功！' })
        }
      }

      return ok({ success: true, is_matched: false, message: '操作成功' })
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
