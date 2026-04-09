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
  const segments = getPathSegments(url, 'conversations')

  try {
    // ── GET /conversations ── 获取当前用户所有会话 ─────────────────
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const supabase = createAdminClient()

      // 查询用户所有会话
      const { data: convRows, error: convErr } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id, created_at')
        .or(`user1_id.eq.${me},user2_id.eq.${me}`)

      if (convErr) return err(convErr.message, 500)

      const conversations = convRows ?? []

      // 对每个会话丰富数据
      const enriched = await Promise.all(
        conversations.map(async (conv: { id: string; user1_id: string; user2_id: string; created_at: string }) => {
          const peerId = conv.user1_id === me ? conv.user2_id : conv.user1_id

          // 获取对方用户信息
          const { data: peerProfile } = await supabase
            .from('users')
            .select('id, nickname, avatar_url')
            .eq('id', peerId)
            .maybeSingle()

          // 获取最后一条消息
          const { data: lastMsgRow } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // 计算未读消息数
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('receiver_id', me)
            .eq('is_read', false)

          return {
            conversation_id: conv.id,
            peer_user: peerProfile ?? { id: peerId, nickname: null, avatar_url: null },
            last_message: lastMsgRow ?? null,
            unread_count: unreadCount ?? 0,
            _last_message_time: lastMsgRow?.created_at ?? conv.created_at,
          }
        })
      )

      // 按最后消息时间降序排列
      enriched.sort((a, b) => {
        const ta = new Date(a._last_message_time).getTime()
        const tb = new Date(b._last_message_time).getTime()
        return tb - ta
      })

      // 去除内部排序字段
      const result = enriched.map(({ _last_message_time: _omit, ...rest }) => rest)

      return ok({ success: true, data: result })
    }

    // ── GET /conversations/:id/messages ── 获取指定会话消息历史 ────
    if (method === 'GET' && segments.length === 2 && segments[1] === 'messages') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const conversationId = segments[0]
      const supabase = createAdminClient()

      // 验证用户是该会话的参与者
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (convErr) return err(convErr.message, 500)
      if (!conv) return err('会话不存在', 404)
      if (conv.user1_id !== me && conv.user2_id !== me) return err('无权访问该会话', 403)

      // 分页，默认 limit=50
      const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50))
      const offset = (page - 1) * limit

      // 可选 before 时间戳过滤
      const before = url.searchParams.get('before')

      let query = supabase
        .from('messages')
        .select('id, conversation_id, sender_id, receiver_id, content, message_type, is_read, created_at', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data: msgRows, error: msgErr, count } = await query

      if (msgErr) return err(msgErr.message, 500)

      // 标记消息为已读
      const { error: readErr } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', me)
        .eq('is_read', false)

      if (readErr) return err(readErr.message, 500)

      // 按时间正序返回给前端
      const messages = (msgRows ?? []).reverse()

      return ok({
        success: true,
        data: messages,
        pagination: buildPagination(page, limit, count ?? 0),
      })
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
