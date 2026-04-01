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
  const segments = getPathSegments(url, 'posts')

  try {
    // ── GET /posts ── 动态列表 ─────────────────────────────────────
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const { page, limit, offset } = parsePagination(url)
      const filterUserId = url.searchParams.get('user_id')

      const supabase = createAdminClient()

      // 查询 posts，关联 profiles 获取用户信息
      let query = supabase
        .from('posts')
        .select(
          `id, content, images, like_count, comment_count, created_at,
           profiles!posts_user_id_fkey(id, nickname, avatar_url)`,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }

      const { data: postRows, error: postErr, count } = await query

      if (postErr) return err(postErr.message, 500)

      const posts = postRows ?? []

      // 为每个帖子查询当前用户是否已点赞
      const enriched = await Promise.all(
        posts.map(async (post: {
          id: string
          content: string
          images: string[] | null
          like_count: number
          comment_count: number
          created_at: string
          profiles: { id: string; nickname: string; avatar_url: string } | null
        }) => {
          const { data: likeRow } = await supabase
            .from('post_likes')
            .select('user_id')
            .eq('user_id', me)
            .eq('post_id', post.id)
            .maybeSingle()

          return {
            id: post.id,
            user: post.profiles ?? null,
            content: post.content,
            images: post.images ?? [],
            like_count: post.like_count,
            comment_count: post.comment_count,
            is_liked: likeRow !== null,
            created_at: post.created_at,
          }
        })
      )

      return ok({
        success: true,
        data: enriched,
        pagination: buildPagination(page, limit, count ?? 0),
      })
    }

    // ── POST /posts ── 发布动态 ────────────────────────────────────
    if (method === 'POST' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      let body: { content?: string; images?: string[] }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { content, images = [] } = body

      if (!content || content.trim() === '') return err('content 不能为空', 400)
      if (content.trim().length > 500) return err('content 不能超过 500 字', 400)
      if (!Array.isArray(images)) return err('images 必须是数组', 400)
      if (images.length > 9) return err('最多上传 9 张图片', 400)

      const supabase = createAdminClient()

      const { data: newPost, error: insertErr } = await supabase
        .from('posts')
        .insert({ user_id: me, content: content.trim(), images })
        .select('id, user_id, content, images, like_count, comment_count, created_at')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      return ok({ success: true, data: newPost }, 201)
    }

    // ── POST /posts/:id/like ── 点赞/取消点赞 ──────────────────────
    if (method === 'POST' && segments.length === 2 && segments[1] === 'like') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const postId = segments[0]
      const supabase = createAdminClient()

      // 检查帖子是否存在
      const { data: postRow, error: postCheckErr } = await supabase
        .from('posts')
        .select('id, like_count')
        .eq('id', postId)
        .maybeSingle()

      if (postCheckErr) return err(postCheckErr.message, 500)
      if (!postRow) return err('帖子不存在', 404)

      // 检查是否已点赞
      const { data: likeRow, error: likeCheckErr } = await supabase
        .from('post_likes')
        .select('user_id')
        .eq('user_id', me)
        .eq('post_id', postId)
        .maybeSingle()

      if (likeCheckErr) return err(likeCheckErr.message, 500)

      if (likeRow) {
        // 已点赞 → 取消点赞
        const { error: deleteErr } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', me)
          .eq('post_id', postId)

        if (deleteErr) return err(deleteErr.message, 500)

        // 读取最新 like_count（触发器已更新）
        const { data: updatedPost } = await supabase
          .from('posts')
          .select('like_count')
          .eq('id', postId)
          .single()

        return ok({ success: true, is_liked: false, like_count: updatedPost?.like_count ?? 0 })
      } else {
        // 未点赞 → 点赞
        const { error: insertErr } = await supabase
          .from('post_likes')
          .insert({ user_id: me, post_id: postId })

        if (insertErr) return err(insertErr.message, 500)

        // 读取最新 like_count（触发器已更新）
        const { data: updatedPost } = await supabase
          .from('posts')
          .select('like_count')
          .eq('id', postId)
          .single()

        return ok({ success: true, is_liked: true, like_count: updatedPost?.like_count ?? 0 })
      }
    }

    // ── POST /posts/:id/comment ── 评论 ────────────────────────────
    if (method === 'POST' && segments.length === 2 && segments[1] === 'comment') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const postId = segments[0]

      let body: { content?: string }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { content } = body

      if (!content || content.trim() === '') return err('评论内容不能为空', 400)

      const supabase = createAdminClient()

      // 检查帖子是否存在
      const { data: postRow, error: postCheckErr } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .maybeSingle()

      if (postCheckErr) return err(postCheckErr.message, 500)
      if (!postRow) return err('帖子不存在', 404)

      // 插入评论
      const { data: newComment, error: commentErr } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: me, content: content.trim() })
        .select('id, content, created_at')
        .single()

      if (commentErr) return err(commentErr.message, 500)

      // 获取评论者信息
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nickname, avatar_url')
        .eq('id', me)
        .maybeSingle()

      return ok({
        success: true,
        data: {
          id: newComment.id,
          user: profile ?? { id: me, nickname: null, avatar_url: null },
          content: newComment.content,
          created_at: newComment.created_at,
        },
      }, 201)
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
