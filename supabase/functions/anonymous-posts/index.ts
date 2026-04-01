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
// GET  /anonymous-posts                → 列表（tag_id, sort, 分页）
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
  // segments[]:
  //   []                      → GET / POST /anonymous-posts
  //   [':id', 'like']         → POST /anonymous-posts/:id/like
  //   [':id', 'comment']      → POST /anonymous-posts/:id/comment

  try {
    // ── GET /anonymous-posts ─────────────────────────────────
    if (req.method === 'GET' && segments.length === 0) {
      return await listPosts(req, url)
    }

    // ── POST /anonymous-posts ────────────────────────────────
    if (req.method === 'POST' && segments.length === 0) {
      return await createPost(req)
    }

    // ── POST /anonymous-posts/:id/like ───────────────────────
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'like') {
      return await toggleLike(req, segments[0])
    }

    // ── POST /anonymous-posts/:id/comment ────────────────────
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'comment') {
      return await addComment(req, segments[0])
    }

    return err('Not Found', 404)
  } catch (e) {
    console.error('[anonymous-posts] unhandled error:', e)
    return err('服务器内部错误', 500)
  }
})

// ── 列表 ─────────────────────────────────────────────────────
async function listPosts(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const tagIdParam = url.searchParams.get('tag_id')
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest'

  const db = createAdminClient()

  // 构造查询：绝不 select user_id
  let query = db
    .from('anonymous_posts')
    .select('id, title, content, like_count, comment_count, created_at', { count: 'exact' })
    .range(offset, offset + limit - 1)

  // 排序
  if (sort === 'popular') {
    query = query
      .order('like_count', { ascending: false })
      .order('comment_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  // tag_id 过滤：通过 IN 子查询（Supabase JS SDK 用 filter + in 实现）
  let tagId: number | null = null
  if (tagIdParam) {
    tagId = parseInt(tagIdParam, 10)
    if (isNaN(tagId)) tagId = null
  }

  if (tagId !== null) {
    // 先获取含该 tag 的 post_id 列表
    const { data: tagLinks, error: tagErr } = await db
      .from('anonymous_post_tags')
      .select('post_id')
      .eq('tag_id', tagId)

    if (tagErr) {
      console.error('[anonymous-posts] tag filter error:', tagErr)
      return err('标签过滤失败', 500)
    }

    const postIds: string[] = (tagLinks ?? []).map((t: any) => t.post_id)
    if (postIds.length === 0) {
      return ok({ data: [], pagination: buildPagination(page, limit, 0) })
    }

    query = query.in('id', postIds)
  }

  const { data: posts, error, count } = await query

  if (error) {
    console.error('[anonymous-posts] list query error:', error)
    return err('获取帖子列表失败', 500)
  }

  const postList = posts ?? []
  if (postList.length === 0) {
    return ok({ data: [], pagination: buildPagination(page, limit, count ?? 0) })
  }

  const postIds: string[] = postList.map((p: any) => p.id)

  // 批量获取每个帖子的 tags
  const { data: postTags } = await db
    .from('anonymous_post_tags')
    .select('post_id, tags(id, name)')
    .in('post_id', postIds)

  // 构建 postId → tags[] 映射
  const tagsMap = new Map<string, Array<{ id: number; name: string }>>()
  for (const pt of postTags ?? []) {
    const tag = pt.tags as any
    if (!tagsMap.has(pt.post_id)) tagsMap.set(pt.post_id, [])
    if (tag) tagsMap.get(pt.post_id)!.push({ id: tag.id, name: tag.name })
  }

  // 批量查询当前用户点赞情况
  const { data: likes } = await db
    .from('anonymous_post_likes')
    .select('post_id')
    .eq('user_id', user!.id)
    .in('post_id', postIds)

  const likedSet = new Set<string>()
  for (const l of likes ?? []) likedSet.add(l.post_id)

  // 组装响应（绝不包含 user_id）
  const list = postList.map((p: any) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    tags: tagsMap.get(p.id) ?? [],
    like_count: p.like_count,
    comment_count: p.comment_count,
    is_liked: likedSet.has(p.id),
    created_at: p.created_at,
  }))

  return ok({ data: list, pagination: buildPagination(page, limit, count ?? 0) })
}

// ── 发帖 ─────────────────────────────────────────────────────
async function createPost(req: Request): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  let body: any
  try {
    body = await req.json()
  } catch {
    return err('请求体解析失败，请提供合法的 JSON')
  }

  const { title, content, tags } = body ?? {}

  if (!title || typeof title !== 'string' || !title.trim()) {
    return err('标题不能为空')
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return err('内容不能为空')
  }

  const db = createAdminClient()

  // 插入帖子（user_id 存储在数据库，但不返回给客户端）
  const { data: post, error: insertErr } = await db
    .from('anonymous_posts')
    .insert({
      user_id: user!.id,
      title: title.trim(),
      content: content.trim(),
    })
    .select('id')
    .single()

  if (insertErr || !post) {
    console.error('[anonymous-posts] create post error:', insertErr)
    return err('发帖失败', 500)
  }

  const postId: string = post.id

  // 插入标签关联
  if (Array.isArray(tags) && tags.length > 0) {
    const tagRows = tags
      .filter((t: any) => typeof t === 'number')
      .map((tagId: number) => ({ post_id: postId, tag_id: tagId }))

    if (tagRows.length > 0) {
      const { error: tagErr } = await db.from('anonymous_post_tags').insert(tagRows)
      if (tagErr) {
        console.error('[anonymous-posts] insert post_tags error:', tagErr)
      }
    }
  }

  return ok({ success: true, message: '发布成功', data: { id: postId } }, 201)
}

// ── 点赞 / 取消点赞（toggle）────────────────────────────────
async function toggleLike(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  // 检查帖子是否存在（只取 id，不取 user_id）
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

  // 检查是否已点赞
  const { data: existing } = await db
    .from('anonymous_post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user!.id)
    .maybeSingle()

  let isLiked: boolean

  if (existing) {
    // 取消点赞
    const { error: delErr } = await db
      .from('anonymous_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user!.id)

    if (delErr) {
      console.error('[anonymous-posts] delete like error:', delErr)
      return err('取消点赞失败', 500)
    }
    isLiked = false
  } else {
    // 点赞
    const { error: likeErr } = await db
      .from('anonymous_post_likes')
      .insert({ post_id: postId, user_id: user!.id })

    if (likeErr) {
      console.error('[anonymous-posts] insert like error:', likeErr)
      return err('点赞失败', 500)
    }
    isLiked = true
  }

  // 读取最新 like_count（由触发器或手动更新维护）
  const { data: updated, error: countErr } = await db
    .from('anonymous_posts')
    .select('like_count')
    .eq('id', postId)
    .single()

  if (countErr || !updated) {
    console.error('[anonymous-posts] read like_count error:', countErr)
    return err('获取点赞数失败', 500)
  }

  return ok({ success: true, is_liked: isLiked, like_count: updated.like_count })
}

// ── 评论 ─────────────────────────────────────────────────────
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

  // 检查帖子是否存在（不取 user_id）
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

  // 插入评论（user_id 存储在数据库，不返回）
  const { data: comment, error: insertErr } = await db
    .from('anonymous_comments')
    .insert({
      post_id: postId,
      user_id: user!.id,
      content: content.trim(),
    })
    .select('id, content, created_at')
    .single()

  if (insertErr || !comment) {
    console.error('[anonymous-posts] insert comment error:', insertErr)
    return err('评论失败', 500)
  }

  // 返回评论数据，绝不包含 user_id
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
