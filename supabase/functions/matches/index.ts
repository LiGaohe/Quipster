// @ts-ignore Deno
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors } from '../_shared/cors.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'
import { generateIcebreakerSuggestions } from '../_shared/chat-icebreaker.ts'

const SUPABASE_URL: string = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY: string = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type MatchAction = 'like' | 'dislike' | 'pass' | 'super_like'

function normalizeAction(action: string): MatchAction | null {
  if (action === 'like' || action === 'dislike' || action === 'pass' || action === 'super_like') {
    return action
  }
  return null
}

function storageAction(action: MatchAction): 'like' | 'pass' | 'super_like' {
  if (action === 'dislike') return 'pass'
  return action
}

async function findExistingConversation(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<number | null> {
  const { data: rowsA, error: errA } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userA)

  if (errA) throw errA

  const { data: rowsB, error: errB } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userB)

  if (errB) throw errB

  const idsA = new Set((rowsA ?? []).map((row: { conversation_id: number }) => row.conversation_id))
  const sharedIds = (rowsB ?? [])
    .map((row: { conversation_id: number }) => row.conversation_id)
    .filter((conversationId: number) => idsA.has(conversationId))

  if (sharedIds.length === 0) return null

  const { data: conversationRows, error: convErr } = await supabase
    .from('conversations')
    .select('id, is_group')
    .in('id', sharedIds)
    .eq('is_group', false)

  if (convErr) throw convErr

  return conversationRows?.[0]?.id ?? null
}

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'matches')

  const debugInfo = {
    method,
    pathname: url.pathname,
    segments,
    segmentsLength: segments.length,
    conditions: {
      GET_segments0: method === 'GET' && segments.length === 0,
      POST_segments0: method === 'POST' && segments.length === 0,
      GET_icebreaker: method === 'GET' && segments.length === 1 && segments[0] === 'icebreaker',
    }
  }
  console.log('[matches] debug:', JSON.stringify(debugInfo, null, 2))

  try {
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const { page, limit, offset } = parsePagination(url)
      const supabase = createAdminClient()

      const { data: myTags, error: myTagErr } = await supabase
        .from('user_tags')
        .select('tag_id, tags(name)')
        .eq('user_id', me)

      if (myTagErr) return err(myTagErr.message, 500)

      const myTagIds = (myTags ?? []).map((row: { tag_id: number }) => row.tag_id)
      const myTagNames = (myTags ?? [])
        .map((row: { tags: { name: string } | null }) => row.tags?.name)
        .filter(Boolean) as string[]

      const { data: actionedRows, error: actionedErr } = await supabase
        .from('matches')
        .select('target_user_id')
        .eq('user_id', me)

      if (actionedErr) return err(actionedErr.message, 500)

      const excludedIds: string[] = [me, ...(actionedRows ?? []).map((r: { target_user_id: string }) => r.target_user_id)]

      const { data: candidates, error: candErr, count } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, major', { count: 'exact' })
        .or('visibility.eq.1,visibility.is.null')
        .not('id', 'in', `(${excludedIds.map((id) => `"${id}"`).join(',')})`)
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

      const { data: myProfile } = await supabase
        .from('users')
        .select('major')
        .eq('id', me)
        .single()

      const myMajor = myProfile?.major ?? ''

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

          const commonTagNames = myTagNames.filter((name) => candTagNames.includes(name))
          const majorScore = (myMajor && candidate.major && myMajor === candidate.major) ? 30 : 0
          const denominator = Math.max(myTagIds.length, candTagIds.length)
          const tagScore = denominator > 0
            ? Math.round((commonTagNames.length / denominator) * 70)
            : 0

          return {
            user_id: candidate.id,
            nickname: candidate.nickname,
            avatar_url: candidate.avatar_url,
            major: candidate.major,
            common_tags: commonTagNames,
            match_score: majorScore + tagScore,
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

    if (method === 'GET' && segments.length === 1 && segments[0] === 'icebreaker') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const peerUserId = url.searchParams.get('peer_user_id')?.trim()
      if (!peerUserId) return err('peer_user_id 不能为空', 400)
      if (peerUserId === me) return err('不能为自己生成破冰建议', 400)

      const supabase = createAdminClient()
      const { data: peerExists, error: peerErr } = await supabase
        .from('users')
        .select('id')
        .eq('id', peerUserId)
        .maybeSingle()

      if (peerErr) return err(peerErr.message, 500)
      if (!peerExists) return err('用户不存在', 404)

      const icebreaker = await generateIcebreakerSuggestions(supabase, me, peerUserId)
      return ok({ success: true, data: icebreaker })
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
      const normalizedAction = action ? normalizeAction(action) : null

      if (!target_user_id) return err('target_user_id 不能为空', 400)
      if (!normalizedAction) return err('action 必须为 like、dislike、pass 或 super_like', 400)
      if (target_user_id === me) return err('不能对自己操作', 400)

      const supabase = createAdminClient()
      const storedAction = storageAction(normalizedAction)
      const now = new Date().toISOString()

      const { error: upsertErr } = await supabase
        .from('matches')
        .upsert(
          { user_id: me, target_user_id, action: storedAction },
          { onConflict: 'user_id,target_user_id' }
        )

      if (upsertErr) return err(upsertErr.message, 500)

      let isMatched = false
      let conversationId: number | null = null
      let icebreaker = null

      if (storedAction === 'like') {
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
            .update({ is_matched: true, matched_at: now })
            .eq('user_id', me)
            .eq('target_user_id', target_user_id)

          await supabase
            .from('matches')
            .update({ is_matched: true, matched_at: now })
            .eq('user_id', target_user_id)
            .eq('target_user_id', me)

          conversationId = await findExistingConversation(supabase, me, target_user_id)

          if (!conversationId) {
            const { data: newConv, error: convErr } = await supabase
              .from('conversations')
              .insert({
                is_group: false,
                creator_user_id: me,
              })
              .select('id')
              .single()

            if (!convErr && newConv) {
              conversationId = newConv.id
              const { error: memberErr } = await supabase
                .from('conversation_members')
                .insert([
                  { conversation_id: conversationId, user_id: me, role: 'member' },
                  { conversation_id: conversationId, user_id: target_user_id, role: 'member' },
                ])

              if (memberErr) console.error('[matches] create members failed:', memberErr)
            }
          }

          try {
            icebreaker = await generateIcebreakerSuggestions(supabase, me, target_user_id)
          } catch (error) {
            console.error('[matches] icebreaker generation failed:', error)
          }
        }
      }

      return ok({
        success: true,
        is_matched: isMatched,
        message: isMatched ? '匹配成功' : '操作已记录',
        conversation_id: conversationId,
        icebreaker,
      })
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
