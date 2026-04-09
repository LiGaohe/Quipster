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
  const segments = getPathSegments(url, 'conversations')

  try {
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const supabase = createAdminClient()

      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', me)

      if (memberErr) return err(memberErr.message, 500)

      const conversationIds = (memberRows ?? []).map((m: { conversation_id: string }) => m.conversation_id)

      if (conversationIds.length === 0) {
        return ok({ success: true, data: [] })
      }

      const { data: convRows, error: convErr } = await supabase
        .from('conversations')
        .select('id, name, is_group, created_at')
        .in('id', conversationIds)

      if (convErr) return err(convErr.message, 500)

      const conversations = convRows ?? []

      const enriched = await Promise.all(
        conversations.map(async (conv: { id: string; name: string | null; is_group: boolean; created_at: string }) => {
          const { data: members } = await supabase
            .from('conversation_members')
            .select('user_id, users(id, nickname, avatar_url)')
            .eq('conversation_id', conv.id)

          const memberList = (members ?? []).filter((m: any) => m.user_id !== me)
          const peerUser = memberList.length > 0 && memberList[0].users
            ? memberList[0].users
            : { id: null, nickname: conv.name ?? '未知会话', avatar_url: null }

          const { data: lastMsgRow } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_user_id', me)
            .eq('status', 'sent')

          return {
            conversation_id: conv.id,
            name: conv.name,
            is_group: conv.is_group,
            peer_user: conv.is_group ? null : peerUser,
            last_message: lastMsgRow ?? null,
            unread_count: unreadCount ?? 0,
            _last_message_time: lastMsgRow?.created_at ?? conv.created_at,
          }
        })
      )

      enriched.sort((a, b) => {
        const ta = new Date(a._last_message_time).getTime()
        const tb = new Date(b._last_message_time).getTime()
        return tb - ta
      })

      const result = enriched.map(({ _last_message_time: _omit, ...rest }) => rest)

      return ok({ success: true, data: result })
    }

    if (method === 'GET' && segments.length === 2 && segments[1] === 'messages') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const conversationId = segments[0]
      const supabase = createAdminClient()

      const { data: membership } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', me)
        .maybeSingle()

      if (!membership) return err('无权访问该会话', 403)

      const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10) || 50))
      const offset = (page - 1) * limit

      const before = url.searchParams.get('before')

      let query = supabase
        .from('messages')
        .select('id, conversation_id, sender_user_id, content, message_type, status, created_at', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data: msgRows, error: msgErr, count } = await query

      if (msgErr) return err(msgErr.message, 500)

      const { error: readErr } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('conversation_id', conversationId)
        .neq('sender_user_id', me)
        .eq('status', 'sent')

      if (readErr) console.error('[conversations] mark read error:', readErr)

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
