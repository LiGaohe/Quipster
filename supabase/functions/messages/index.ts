// @ts-ignore Deno
import { createAdminClient } from '../_shared/supabase.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { ok, err } from '../_shared/response.ts'

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

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const method = req.method

  try {
    if (method === 'POST') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const senderId = user!.id

      let body: { receiver_id?: string; conversation_id?: string | number; content?: string; message_type?: string }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { receiver_id, conversation_id, content, message_type = 'text' } = body

      if (!content || content.trim() === '') return err('content 不能为空', 400)
      if (message_type !== 'text' && message_type !== 'image') return err('message_type 必须为 text 或 image', 400)

      const supabase = createAdminClient()

      let conversationId: number

      if (conversation_id) {
        const convIdNum = typeof conversation_id === 'string' ? parseInt(conversation_id, 10) : conversation_id
        if (isNaN(convIdNum)) return err('无效的 conversation_id', 400)

        const { data: membership } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('conversation_id', convIdNum)
          .eq('user_id', senderId)
          .maybeSingle()

        if (!membership) return err('无权在该会话中发送消息', 403)

        conversationId = convIdNum
      } else if (receiver_id) {
        if (receiver_id === senderId) return err('不能给自己发送消息', 400)

        const { data: senderConvs, error: senderErr } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', senderId)

        if (senderErr) return err(senderErr.message, 500)

        const { data: receiverConvs, error: receiverErr } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', receiver_id)

        if (receiverErr) return err(receiverErr.message, 500)

        const senderConvIds = new Set(senderConvs?.map((c) => c.conversation_id) ?? [])
        const sharedConvId = receiverConvs?.find((c) => senderConvIds.has(c.conversation_id))?.conversation_id

        if (sharedConvId) {
          conversationId = sharedConvId
        } else {
          const { data: newConv, error: insertConvErr } = await supabase
            .from('conversations')
            .insert({ is_group: false, creator_user_id: senderId })
            .select('id')
            .single()

          if (insertConvErr) return err(insertConvErr.message, 500)
          conversationId = newConv.id

          const { error: memberErr } = await supabase
            .from('conversation_members')
            .insert([
              { conversation_id: conversationId, user_id: senderId, role: 'owner' },
              { conversation_id: conversationId, user_id: receiver_id, role: 'member' },
            ])

          if (memberErr) return err(memberErr.message, 500)
        }
      } else {
        return err('必须提供 receiver_id 或 conversation_id', 400)
      }

      const { data: newMsg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: senderId,
          content: content.trim(),
          message_type,
        })
        .select('id, sender_user_id, content, message_type, created_at')
        .single()

      if (msgErr) return err(msgErr.message, 500)

      return ok({ success: true, data: { ...newMsg, conversation_id: conversationId } }, 201)
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
