// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'
import { analyzeContentModeration, submitModerationReport } from '../_shared/content-moderation.ts'

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // CORS 预检处理
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const method = req.method
  const segments = getPathSegments(url, 'posts')

  const debugInfo = {
    method,
    pathname: url.pathname,
    segments,
    segmentsLength: segments.length,
    conditions: {
      GET_segments0: method === 'GET' && segments.length === 0,
      POST_segments0: method === 'POST' && segments.length === 0,
      POST_2_like: method === 'POST' && segments.length === 2 && segments[1] === 'like',
      POST_2_comment: method === 'POST' && segments.length === 2 && segments[1] === 'comment',
    }
  }

  try {
    // ── GET /posts ── 动态列表 ─────────────────────────────────────
    if (method === 'GET' && segments.length === 0) {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const { page, limit, offset } = parsePagination(url)
      const filterUserId = url.searchParams.get('user_id')

      const supabase = createAdminClient()

      // 查询 posts，关联 users 获取用户信息
      let query = supabase
        .from('posts')
        .select(
          `id, content, image_urls, visibility, audit_status, created_at,
           users!posts_user_id_fkey(id, nickname, avatar_url)`,
          { count: 'exact' }
        )
        .eq('type', 'post')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }

      const { data: postRows, error: postErr, count } = await query

      if (postErr) return err(postErr.message, 500)

      const posts = postRows ?? []

      const enriched = await Promise.all(
        posts.map(async (post: {
          id: string
          content: string
          image_urls: string[] | null
          visibility: number
          audit_status: string
          created_at: string
          users: { id: string; nickname: string; avatar_url: string } | null
        }) => {
          const { count: likeCount } = await supabase
            .from('likes')
            .select('id', { count: 'exact', head: true })
            .eq('target_type', 'post')
            .eq('target_id', post.id)

          const { data: likeRow } = await supabase
            .from('likes')
            .select('user_id')
            .eq('user_id', me)
            .eq('target_type', 'post')
            .eq('target_id', post.id)
            .maybeSingle()

          const { count: commentCount } = await supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'comment')
            .eq('post_id', post.id)

          return {
            id: post.id,
            user: post.users ?? null,
            content: post.content,
            image_urls: post.image_urls ?? [],
            visibility: post.visibility,
            audit_status: post.audit_status,
            like_count: likeCount ?? 0,
            comment_count: commentCount ?? 0,
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

      let body: { content?: string; image_urls?: string[] }
      try {
        body = await req.json()
      } catch {
        return err('请求体不是有效 JSON', 400)
      }

      const { content, image_urls = [] } = body

      if (!content || content.trim() === '') return err('content 不能为空', 400)
      if (content.trim().length > 500) return err('content 不能超过 500 字', 400)
      if (!Array.isArray(image_urls)) return err('image_urls 必须是数组', 400)
      if (image_urls.length > 9) return err('最多上传 9 张图片', 400)

      const supabase = createAdminClient()
      const moderation = await analyzeContentModeration({
        target_type: 'post',
        content: content.trim(),
      })

      const { data: newPost, error: insertErr } = await supabase
        .from('posts')
        .insert({
          user_id: me,
          content: content.trim(),
          image_urls,
          type: 'post',
          audit_status: moderation.audit_status,
          audited_by: moderation.needs_admin_review ? null : me,
          audited_at: moderation.needs_admin_review ? null : new Date().toISOString(),
        })
        .select('id, user_id, content, image_urls, created_at, audit_status')
        .single()

      if (insertErr) return err(insertErr.message, 500)

      if (moderation.needs_admin_review) {
        await submitModerationReport(
          supabase,
          me,
          { target_type: 'post', target_id: newPost.id },
          moderation.summary,
          [
            `风险等级：${moderation.risk_level}`,
            `命中关键词：${moderation.matched_keywords.join('、') || '无'}`,
            ...moderation.reasons,
          ]
        )
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id, nickname, avatar_url')
        .eq('id', me)
        .maybeSingle()

      return ok({
        success: true,
        data: {
          id: newPost.id,
          user: profile ?? { id: me, nickname: null, avatar_url: null },
          content: newPost.content,
          images: newPost.image_urls ?? [],
          audit_status: newPost.audit_status,
          like_count: 0,
          comment_count: 0,
          is_liked: false,
          created_at: newPost.created_at,
        },
      }, 201)
    }

    // ── POST /posts/:id/like ── 点赞/取消点赞 ──────────────────────
    if (method === 'POST' && segments.length === 2 && segments[1] === 'like') {
      const [user, authResp] = await requireAuth(req)
      if (authResp) return authResp
      const me = user!.id

      const postId = segments[0]
      const supabase = createAdminClient()

      const { data: postRow, error: postCheckErr } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .eq('type', 'post')
        .maybeSingle()

      if (postCheckErr) return err(postCheckErr.message, 500)
      if (!postRow) return err('帖子不存在', 404)

      const { data: likeRow, error: likeCheckErr } = await supabase
        .from('likes')
        .select('user_id')
        .eq('user_id', me)
        .eq('target_type', 'post')
        .eq('target_id', postId)
        .maybeSingle()

      if (likeCheckErr) return err(likeCheckErr.message, 500)

      if (likeRow) {
        const { error: deleteErr } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', me)
          .eq('target_type', 'post')
          .eq('target_id', postId)

        if (deleteErr) return err(deleteErr.message, 500)

        const { count: likeCount } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('target_type', 'post')
          .eq('target_id', postId)

        return ok({ success: true, is_liked: false, like_count: likeCount ?? 0 })
      } else {
        const { error: insertErr } = await supabase
          .from('likes')
          .insert({ user_id: me, target_type: 'post', target_id: postId })

        if (insertErr) return err(insertErr.message, 500)

        const { count: likeCount } = await supabase
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('target_type', 'post')
          .eq('target_id', postId)

        return ok({ success: true, is_liked: true, like_count: likeCount ?? 0 })
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
      const moderation = await analyzeContentModeration({
        target_type: 'comment',
        content: content.trim(),
      })

      const { data: postRow, error: postCheckErr } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .eq('type', 'post')
        .maybeSingle()

      if (postCheckErr) return err(postCheckErr.message, 500)
      if (!postRow) return err('帖子不存在', 404)

      const { data: newComment, error: commentErr } = await supabase
        .from('posts')
        .insert({
          post_id: postId,
          user_id: me,
          content: content.trim(),
          type: 'comment',
          audit_status: moderation.audit_status,
          audited_by: moderation.needs_admin_review ? null : me,
          audited_at: moderation.needs_admin_review ? null : new Date().toISOString(),
        })
        .select('id, content, created_at, audit_status')
        .single()

      if (commentErr) return err(commentErr.message, 500)

      const { data: profile } = await supabase
        .from('users')
        .select('id, nickname, avatar_url')
        .eq('id', me)
        .maybeSingle()

      return ok({
        success: true,
        data: {
          id: newComment.id,
          user: profile ?? { id: me, nickname: null, avatar_url: null },
          content: newComment.content,
          audit_status: newComment.audit_status,
          created_at: newComment.created_at,
        },
      }, 201)
    }

    // ── GET /posts/:id/comments ── 获取评论列表 ────────────────────
    if (method === 'GET' && segments.length === 2 && segments[1] === 'comments') {
      const postId = segments[0]
      const supabase = createAdminClient()

      const { data: postRow, error: postCheckErr } = await supabase
        .from('posts')
        .select('id')
        .eq('id', postId)
        .eq('type', 'post')
        .maybeSingle()

      if (postCheckErr) return err(postCheckErr.message, 500)
      if (!postRow) return err('帖子不存在', 404)

      const { data: comments, error: commentsErr } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          audit_status,
          users!posts_user_id_fkey(id, nickname, avatar_url)
        `)
        .eq('type', 'comment')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (commentsErr) return err(commentsErr.message, 500)

      const formatted = (comments ?? []).map((c: any) => ({
        id: c.id,
        user: c.users ?? { id: null, nickname: null, avatar_url: null },
        content: c.content,
        audit_status: c.audit_status,
        created_at: c.created_at,
      }))

      return ok({ success: true, data: formatted })
    }

    return err(`Not Found: ${JSON.stringify(debugInfo)}`, 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(message, 500)
  }
})
