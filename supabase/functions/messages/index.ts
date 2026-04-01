// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth } from '../_shared/auth.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const method = req.method

  try {
    // ── POST /messages ── 发送消息 ─────────────────────────────────
    if (method === 'POST') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const senderId = user!.id

      let body: { receiver_id?: string; content?: string; message_type?: string }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { receiver_id, content, message_type = 'text' } = body

      if (!receiver_id) return err('receiver_id 不能为空', 400)
      if (!content || content.trim() === '') return err('content 不能为空', 400)
      if (message_type !== 'text' && message_type !== 'image') return err('message_type 必须为 text 或 image', 400)
      if (receiver_id === senderId) return err('不能给自己发送消息', 400)

      const supabase = createAdminClient()

      // 查找或创建 conversation（user1_id < user2_id 保证唯一）
      const user1_id = senderId < receiver_id ? senderId : receiver_id
      const user2_id = senderId < receiver_id ? receiver_id : senderId

      // 先尝试查找已有的 conversation
      const { data: existingConv, error: selectErr } = await supabase
        .from('conversations')
        .select('id')
        .eq('user1_id', user1_id)
        .eq('user2_id', user2_id)
        .maybeSingle()

      if (selectErr) return err(selectErr.message, 500)

      let conversationId: string

      if (existingConv) {
        conversationId = existingConv.id
      } else {
        // 创建新会话，使用 upsert 避免竞态条件
        const { data: newConv, error: insertConvErr } = await supabase
          .from('conversations')
          .upsert(
            { user1_id, user2_id },
            { onConflict: 'user1_id,user2_id' }
          )
          .select('id')
          .single()

        if (insertConvErr) return err(insertConvErr.message, 500)
        conversationId = newConv.id
      }

      // 插入消息
      const { data: newMsg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          receiver_id,
          content: content.trim(),
          message_type,
        })
        .select('id, sender_id, receiver_id, content, message_type, created_at')
        .single()

      if (msgErr) return err(msgErr.message, 500)

      return ok({ success: true, data: newMsg }, 201)
    }

    return err('Method Not Allowed', 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
