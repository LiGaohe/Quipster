// @ts-ignore Deno
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL: string = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY: string = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })
  return null
}

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function buildPagination(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.ceil(total / limit) }
}

function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
  return { page, limit, offset: (page - 1) * limit }
}

interface AuthUser { id: string; email: string }

function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = extractToken(req)
  if (!token) return null
  try {
    const admin = createAdminClient()
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return null
    return { id: user.id, email: user.email! }
  } catch { return null }
}

async function requireAuth(req: Request): Promise<[AuthUser, null] | [null, Response]> {
  const user = await getAuthUser(req)
  if (!user) {
    return [null, new Response(JSON.stringify({ error: '未认证，请先登录' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })]
  }
  return [user, null]
}

function getPathSegments(url: URL, functionName: string): string[] {
  const pathname = url.pathname
  const prefix = `/${functionName}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  return rest.split('/').filter(Boolean)
}

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
      // 匹配算法：专业权重30% + 标签权重70%
      // - 专业相同：专业分 = 30分
      // - 标签匹配：标签分 = (共同标签数 / max(用户A标签数, 用户B标签数)) × 70
      // - 总分 = 专业分 + 标签分

      // 获取当前用户的专业信息
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

          const commonTagNames = myTagNames.filter(name => candTagNames.includes(name))

          // 计算专业匹配分（权重30%）
          const majorScore = (myMajor && candidate.major && myMajor === candidate.major) ? 30 : 0

          // 计算标签匹配分（权重70%）
          const denominator = Math.max(myTagIds.length, candTagIds.length)
          const tagScore = denominator > 0
            ? Math.round((commonTagNames.length / denominator) * 70)
            : 0

          // 总匹配分
          const match_score = majorScore + tagScore

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

        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            is_group: false,
            creator_user_id: me,
          })
          .select('id')
          .single()

        if (!convErr && newConv) {
          await supabase
            .from('conversation_members')
            .insert([
              { conversation_id: newConv.id, user_id: me, role: 'member' },
              { conversation_id: newConv.id, user_id: target_user_id, role: 'member' },
            ])
        }
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
