// @ts-ignore Deno
import { handleCors } from './cors.ts'
import { createAdminClient } from './supabase.ts'
import { ok, err, buildPagination, parsePagination } from './response.ts'
import { requireAuth, getPathSegments } from './auth.ts'
import { persistEmotionAnalysis, summarizeEmotionLabel } from '../_shared/emotion-support.ts'
import { analyzeContentModeration, submitModerationReport } from '../_shared/content-moderation.ts'

// ============================================================
// anonymous-posts/index.ts — 匿名树洞
//
// 重要：所有响应中绝对不返回 user_id（匿名！）
//
// GET  /anonymous-posts                → 列表（tag, sort, 分页）
// GET  /anonymous-posts/:id            → 详情
// GET  /anonymous-posts/:id/comments   → 评论列表
// GET  /anonymous-posts/:id/support    → 情绪支持信息
// POST /anonymous-posts                → 发帖
// POST /anonymous-posts/:id/analyze-emotion → 手动重算情绪识别
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

    if (req.method === 'GET' && segments.length === 1) {
      return await getPostDetail(req, segments[0])
    }

    if (req.method === 'GET' && segments.length === 2 && segments[1] === 'comments') {
      return await listComments(req, segments[0])
    }

    if (req.method === 'GET' && segments.length === 2 && segments[1] === 'support') {
      return await getSupportInfo(req, segments[0])
    }

    if (req.method === 'POST' && segments.length === 0) {
      return await createPost(req)
    }

    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'analyze-emotion') {
      return await analyzeEmotion(req, segments[0])
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

function isNumericString(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
}

async function resolveAnonymousTagMap(db: ReturnType<typeof createAdminClient>, rawTags: Array<string | null | undefined>) {
  const numericTagIds = Array.from(
    new Set(
      rawTags
        .filter((tag): tag is string => isNumericString(tag))
        .map((tag) => Number(tag))
    )
  )

  if (numericTagIds.length === 0) {
    return new Map<number, string>()
  }

  const { data } = await db
    .from('tags')
    .select('id, name')
    .in('id', numericTagIds)

  const tagMap = new Map<number, string>()
  for (const row of data ?? []) {
    tagMap.set(row.id, row.name)
  }

  return tagMap
}

function buildAnonymousTagObjects(rawTag: string | null | undefined, tagMap: Map<number, string>) {
  if (!rawTag) return []
  if (isNumericString(rawTag)) {
    const id = Number(rawTag)
    return [{ id, name: tagMap.get(id) ?? rawTag }]
  }
  return [{ id: -1, name: rawTag }]
}

async function listPosts(req: Request, url: URL): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const { page, limit, offset } = parsePagination(url)
  const tagParam = url.searchParams.get('tag')
  const tagId = url.searchParams.get('tag_id')
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest'

  const db = createAdminClient()

  let query = db
    .from('anonymous_posts')
    .select('id, title, content, tag, emotion_type, is_hot, audit_status, created_at', { count: 'exact' })
    .eq('type', 'post')
    .range(offset, offset + limit - 1)

  if (sort === 'popular') {
    query = query.order('is_hot', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const effectiveTag = tagParam ?? tagId

  if (effectiveTag) {
    query = query.eq('tag', effectiveTag)
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
  const tagMap = await resolveAnonymousTagMap(db, postList.map((p: any) => p.tag))

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
    id: String(p.id),
    title: p.title,
    content: p.content,
    tags: buildAnonymousTagObjects(p.tag, tagMap),
    emotion_type: p.emotion_type,
    emotion_label: p.emotion_type ? summarizeEmotionLabel(p.emotion_type) : null,
    audit_status: p.audit_status,
    is_hot: p.is_hot,
    like_count: likeCountMap.get(String(p.id)) ?? 0,
    comment_count: commentCountMap.get(String(p.id)) ?? 0,
    is_liked: likedSet.has(String(p.id)),
    created_at: p.created_at,
  }))

  return ok({ data: list, pagination: buildPagination(page, limit, count ?? 0) })
}

async function getPostDetail(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr
  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  const { data: post, error } = await db
    .from('anonymous_posts')
    .select('id, title, content, tag, emotion_type, emotion_score, support_resources, audit_status, is_hot, created_at')
    .eq('id', postId)
    .eq('type', 'post')
    .maybeSingle()

  if (error) {
    console.error('[anonymous-posts] detail query error:', error)
    return err('获取帖子详情失败', 500)
  }
  if (!post) return err('帖子不存在或已被删除', 404)
  const tagMap = await resolveAnonymousTagMap(db, [post.tag])

  const { count: likeCount } = await db
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', 'anonymous_post')
    .eq('target_id', postId)

  const { count: commentCount } = await db
    .from('anonymous_posts')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'comment')
    .eq('parent_id', postId)

  const { data: likeRow } = await db
    .from('likes')
    .select('id')
    .eq('target_type', 'anonymous_post')
    .eq('target_id', postId)
    .eq('user_id', user!.id)
    .maybeSingle()

  return ok({
    success: true,
    data: {
      id: String(post.id),
      title: post.title,
      content: post.content,
      tags: buildAnonymousTagObjects(post.tag, tagMap),
      emotion_type: post.emotion_type,
      emotion_label: post.emotion_type ? summarizeEmotionLabel(post.emotion_type) : null,
      emotion_score: post.emotion_score,
      support_resources: post.support_resources ?? [],
      audit_status: post.audit_status,
      is_hot: post.is_hot,
      like_count: likeCount ?? 0,
      comment_count: commentCount ?? 0,
      is_liked: !!likeRow,
      created_at: post.created_at,
    },
  })
}

async function listComments(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr
  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  const { data: post, error: postError } = await db
    .from('anonymous_posts')
    .select('id')
    .eq('id', postId)
    .eq('type', 'post')
    .maybeSingle()

  if (postError) return err('查询帖子失败', 500)
  if (!post) return err('帖子不存在', 404)

  const { data: comments, error } = await db
    .from('anonymous_posts')
    .select('id, content, created_at, audit_status')
    .eq('type', 'comment')
    .eq('parent_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[anonymous-posts] comments query error:', error)
    return err('获取评论失败', 500)
  }

  return ok({
    success: true,
    data: (comments ?? []).map((comment: { id: number | string; content: string; created_at: string; audit_status?: string }) => ({
      id: String(comment.id),
      content: comment.content,
      audit_status: comment.audit_status ?? 'pending',
      created_at: comment.created_at,
    })),
  })
}

async function getSupportInfo(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr
  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  const { data: post, error } = await db
    .from('anonymous_posts')
    .select('id, title, content, tag, emotion_type, emotion_score, support_resources, audit_status')
    .eq('id', postId)
    .eq('type', 'post')
    .maybeSingle()

  if (error) return err('获取情绪支持信息失败', 500)
  if (!post) return err('帖子不存在', 404)

  if (!post.emotion_type) {
    return ok({
      success: true,
      data: {
        emotion_type: null,
        emotion_label: null,
        emotion_score: post.emotion_score ?? null,
        support_resources: post.support_resources ?? [],
        audit_status: post.audit_status,
        support_posts: [],
        support_events: [],
      },
    })
  }

  const eventKeywordFilters = post.emotion_type === 'stress'
    ? ['讲座', '减压', '运动', '放松', '交流']
    : post.emotion_type === 'anxiety'
    ? ['讲座', '交流', '支持', '分享', '沙龙']
    : post.emotion_type === 'sadness'
    ? ['交流', '陪伴', '分享', '活动', '讲座']
    : []

  const supportPostsPromise = db
    .from('anonymous_posts')
    .select('id, title, emotion_type, created_at')
    .eq('type', 'post')
    .neq('id', postId)
    .eq('emotion_type', post.emotion_type)
    .order('created_at', { ascending: false })
    .limit(3)

  const supportEventsPromise = db
    .from('activities')
    .select('id, title, event_time, start_time')
    .eq('activity_type', 'event')
    .gte('event_time', new Date().toISOString())
    .or(eventKeywordFilters.map((keyword) => `title.ilike.%${keyword}%,description.ilike.%${keyword}%`).join(','))
    .order('event_time', { ascending: true })
    .limit(3)

  const [{ data: supportPosts }, { data: supportEvents }] = await Promise.all([
    supportPostsPromise,
    supportEventsPromise,
  ])

  return ok({
    success: true,
    data: {
      emotion_type: post.emotion_type,
      emotion_label: post.emotion_type ? summarizeEmotionLabel(post.emotion_type) : null,
      emotion_score: post.emotion_score,
      support_resources: post.support_resources ?? [],
      audit_status: post.audit_status,
      support_posts: (supportPosts ?? []).map((item: { id: number | string; title: string | null }) => ({
        id: String(item.id),
        title: item.title?.trim() || '匿名树洞帖子',
      })),
      support_events: (supportEvents ?? []).map((item: { id: number | string; title: string; event_time?: string | null; start_time?: string | null }) => ({
        id: String(item.id),
        title: item.title,
        start_time: item.start_time ?? item.event_time ?? null,
      })),
    },
  })
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

  const { title, content, tag, tags } = body ?? {}

  if (!title || typeof title !== 'string' || !title.trim()) {
    return err('标题不能为空')
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return err('内容不能为空')
  }

  const normalizedTag =
    typeof tag === 'string' && tag.trim()
      ? tag.trim()
      : Array.isArray(tags) && tags.length > 0
      ? String(tags[0])
      : null

  const db = createAdminClient()
  const moderation = await analyzeContentModeration({
    target_type: 'anonymous_post',
    title: title.trim(),
    content: content.trim(),
  })

  const { data: post, error: insertErr } = await db
    .from('anonymous_posts')
    .insert({
      user_id: user!.id,
      title: title.trim(),
      content: content.trim(),
      tag: normalizedTag,
      type: 'post',
      audit_status: moderation.audit_status,
      audited_by: moderation.needs_admin_review ? null : user!.id,
      audited_at: moderation.needs_admin_review ? null : new Date().toISOString(),
    })
    .select('id, title, content, tag, audit_status')
    .single()

  if (insertErr || !post) {
    console.error('[anonymous-posts] create post error:', insertErr)
    return err('发帖失败', 500)
  }

  if (moderation.needs_admin_review) {
    await submitModerationReport(
      db,
      user!.id,
      { target_type: 'anonymous_post', target_id: post.id },
      moderation.summary,
      [
        `风险等级：${moderation.risk_level}`,
        `命中关键词：${moderation.matched_keywords.join('、') || '无'}`,
        ...moderation.reasons,
      ]
    )
  }

  EdgeRuntime.waitUntil((async () => {
    try {
      await persistEmotionAnalysis(db, {
        id: String(post.id),
        title: post.title ?? title.trim(),
        content: post.content ?? content.trim(),
        tag: post.tag ?? normalizedTag,
      })
    } catch (analysisError) {
      console.error('[anonymous-posts] auto emotion analysis failed:', analysisError)
    }
  })())

  return ok({ success: true, message: '发布成功', data: { id: post.id } }, 201)
}

async function analyzeEmotion(req: Request, postId: string): Promise<Response> {
  const [user, authErr] = await requireAuth(req)
  if (authErr) return authErr
  if (!postId) return err('缺少帖子 ID', 400)

  const db = createAdminClient()

  const { data: post, error } = await db
    .from('anonymous_posts')
    .select('id, title, content, tag')
    .eq('id', postId)
    .eq('type', 'post')
    .maybeSingle()

  if (error) return err('获取帖子失败', 500)
  if (!post) return err('帖子不存在', 404)

  const result = await persistEmotionAnalysis(db, {
    id: String(post.id),
    title: post.title ?? '',
    content: post.content ?? '',
    tag: post.tag ?? null,
  })

  return ok({
    success: true,
    data: {
      emotion_type: result.emotion_type,
      emotion_label: summarizeEmotionLabel(result.emotion_type),
      emotion_score: result.emotion_score,
      support_resources: result.support_resources,
      support_posts: result.support_posts,
      support_events: result.support_events,
    },
    meta: {
      matched_keywords: result.matched_keywords,
      triggers: result.triggers,
      used_ai: result.used_ai,
    },
  })
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

  const moderation = await analyzeContentModeration({
    target_type: 'comment',
    content: content.trim(),
  })

  const { data: comment, error: insertErr } = await db
    .from('anonymous_posts')
    .insert({
      user_id: user!.id,
      content: content.trim(),
      type: 'comment',
      parent_id: parseInt(postId, 10),
      audit_status: moderation.audit_status,
      audited_by: moderation.needs_admin_review ? null : user!.id,
      audited_at: moderation.needs_admin_review ? null : new Date().toISOString(),
    })
    .select('id, content, created_at, audit_status')
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
        audit_status: comment.audit_status,
        created_at: comment.created_at,
      },
    },
    201
  )
}
