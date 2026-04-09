// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { ok, err, buildPagination, parsePagination } from '../_shared/response.ts'
import { requireAuth, getPathSegments } from '../_shared/auth.ts'

// ============================================================
// anonymous-posts/index.ts — 匿名树洞
//
// 重要：所有响应中绝对不返回 user_id（匿名！）
//
// GET  /anonymous-posts                → 列表（tag, sort, 分页）
// POST /anonymous-posts                → 发帖
// POST /anonymous-posts/:id/like       → 点赞 / 取消点赞（toggle）
// POST /anonymous-posts/:id/comment    → 评论
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const segments = getPathSegments(url, 'anonymous-posts')

  try {
    if (req.method === 'GET' && segments.length === 0) {
      return await listPosts(req, url)
    }

    if (req.method === 'POST' && segments.length === 0) {
      return await createPost(req)
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'like') {
      return await toggleLike(req, segments[0])
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'comment') {
      return await addComment(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[anonymous-posts] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

async function listPosts(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const tagParam = url.searchParams.get('tag')
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest'

  const db = createAdminClient()

  let query = db
    .from('anonymous_posts')
    .select('id, title, content, tag, emotion_type, is_hot, created_at', { count: 'exact' })
    .eq('type', 'post')
    .range(offset, offset + limit - 1)

  if (sort === 'popular') {
    query = query.order('is_hot', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (tagParam) {
    query = query.eq('tag', tagParam)
  }

  const { data: posts, error, count } = await query

  if (error) {
    console.error('[anonymous-posts] list query error:', error)
    return err('获取帖子列表失败', 500)
  }

  const postList = posts ?? []
  if (postList.length === 0) {
    return ok({ data: [], pagination: buildPagination(page, limit, 0) })
  }

  const postIds: string[] = postList.map((p: any) => p.id)

  const { data: likesData } = await db
    .from('likes')
    .select('target_id')
    .eq('target_type', 'anonymous_post')
    .in('target_id', postIds)

  const likeCountMap = new Map<string, number>()
  for (const l of likesData ?? []) {
    const id = String(l.target_id)
    likeCountMap.set(id, (likeCountMap.get(id) ?? 0) + 1)
  }

  const { data: commentsData } = await db
    .from('anonymous_posts')
    .select('parent_id')
    .eq('type', 'comment')
    .in('parent_id', postIds)

  const commentCountMap = new Map<string, number>()
  for (const c of commentsData ?? []) {
    const id = String(c.parent_id)
    commentCountMap.set(id, (commentCountMap.get(id) ?? 0) + 1)
  }

  const { data: userLikes } = await db
    .from('likes')
    .select('target_id')
    .eq('target_type', 'anonymous_post')
    .eq('user_id', user!.id)
    .in('target_id', postIds)

  const likedSet = new Set<string>()
  for (const l of userLikes ?? []) likedSet.add(String(l.target_id))

  const list = postList.map((p: any) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    tag: p.tag,
    emotion_type: p.emotion_type,
    is_hot: p.is_hot,
    like_count: likeCountMap.get(String(p.id)) ?? 0,
    comment_count: commentCountMap.get(String(p.id)) ?? 0,
    is_liked: likedSet.has(String(p.id)),
    created_at: p.created_at,
  }))

  return ok({ data: list, pagination: buildPagination(page, limit, count ?? 0) })
}

async function createPost(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { title, content, tag } = body ?? {}

  if (!title || typeof title !== 'string' || !title.trim()) {
    return err('标题不能为空')
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return err('内容不能为空')
  }

  const db = createAdminClient()

  const { data: post, error: insertErr } = await db
    .from('anonymous_posts')
    .insert({
      user_id: user!.id,
      title: title.trim(),
      content: content.trim(),
      tag: tag ?? null,
      type: 'post',
    })
    .select('id')
    .single()

  if (insertErr || !post) {
    console.error('[anonymous-posts] create post error:', insertErr)
    return err('发帖失败', 500)
  }

  return ok({ success: true, message: '发布成功', data: { id: post.id } }, 201)
}

async function toggleLike(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  const { data: post, error: findErr } = await db
    .from('anonymous_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()

  if (findErr) {
    console.error('[anonymous-posts] find post error:', findErr)
    return err('查询帖子失败', 500)
  }
  if (!post) return err('帖子不存在', 404)

  const { data: existing } = await db
    .from('likes')
    .select('id')
    .eq('target_type', 'anonymous_post')
    .eq('target_id', postId)
    .eq('user_id', user!.id)
    .maybeSingle()

  let isLiked: boolean

  if (existing) {
    const { error: delErr } = await db
      .from('likes')
      .delete()
      .eq('id', existing.id)

    if (delErr) {
      console.error('[anonymous-posts] delete like error:', delErr)
      return err('取消点赞失败', 500)
    }
    isLiked = false
  } else {
    const { error: likeErr } = await db
      .from('likes')
      .insert({ target_type: 'anonymous_post', target_id: parseInt(postId, 10), user_id: user!.id })

    if (likeErr) {
      console.error('[anonymous-posts] insert like error:', likeErr)
      return err('点赞失败', 500)
    }
    isLiked = true
  }

  const { count: likeCount } = await db
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', 'anonymous_post')
    .eq('target_id', postId)

  return ok({ success: true, is_liked: isLiked, like_count: likeCount ?? 0 })
}

async function addComment(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!postId) return err('缺少帖子 ID', 400)

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { content } = body ?? {}

  if (!content || typeof content !== 'string' || !content.trim()) {
    return err('评论内容不能为空')
  }

  const db = createAdminClient()

  const { data: post, error: findErr } = await db
    .from('anonymous_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()

  if (findErr) {
    console.error('[anonymous-posts] find post for comment error:', findErr)
    return err('查询帖子失败', 500)
  }
  if (!post) return err('帖子不存在', 404)

  const { data: comment, error: insertErr } = await db
    .from('anonymous_posts')
    .insert({
      user_id: user!.id,
      content: content.trim(),
      type: 'comment',
      parent_id: parseInt(postId, 10),
    })
    .select('id, content, created_at')
    .single()

  if (insertErr || !comment) {
    console.error('[anonymous-posts] insert comment error:', insertErr)
    return err('评论失败', 500)
  }

  return ok(
    {
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
      },
    },
    201
  )
}
