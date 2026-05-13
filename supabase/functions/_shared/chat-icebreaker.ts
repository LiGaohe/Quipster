// @ts-ignore Deno
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface IcebreakerResult {
  common_tags: string[]
  opening_lines: string[]
  topic_suggestions: string[]
  interaction_ideas: string[]
  mini_games: string[]
  used_ai: boolean
  model: string | null
}

interface UserProfile {
  id: string
  nickname: string
  major: string | null
  bio: string | null
}

interface ProfileRow {
  id: string
  nickname: string
  major: string | null
  bio: string | null
}

interface TagRow {
  user_id: string
  tags: { name: string } | null
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free'

const TAG_HOOKS = [
  {
    keywords: ['电影', '影视', '追剧', '剧集'],
    topic: '最近看过什么值得安利的电影或剧集',
    activity: '互相推荐一部最近最喜欢的作品，再聊聊为什么喜欢',
    game: '用一句话给最近看过的内容打分',
  },
  {
    keywords: ['音乐', '歌单', '乐队', '唱歌'],
    topic: '最近单曲循环的歌和喜欢的音乐风格',
    activity: '互换一张歌单，看看谁的品味更像自己',
    game: '各自用一首歌形容今天的状态',
  },
  {
    keywords: ['游戏', '电竞', '手游', '主机'],
    topic: '最近在玩的游戏或者最想入坑的游戏',
    activity: '各自推荐一个最适合解压的小玩法',
    game: '用三个词介绍自己最常玩的游戏',
  },
  {
    keywords: ['摄影', '拍照', '相机', '修图'],
    topic: '最近拍到的好照片和喜欢的拍照风格',
    activity: '互发一张手机里最满意的照片，讲讲拍摄故事',
    game: '用一个校园场景猜对方最想拍什么',
  },
  {
    keywords: ['运动', '跑步', '健身', '球类'],
    topic: '平时最喜欢的运动和最近的锻炼节奏',
    activity: '约一个轻量运动目标，比如散步、跑步或打球',
    game: '二选一：早起跑步还是晚饭后散步',
  },
  {
    keywords: ['美食', '吃饭', '奶茶', '咖啡', '甜品'],
    topic: '学校里最喜欢的食堂窗口或校外美食',
    activity: '互相推荐一个“闭眼不踩雷”的吃喝清单',
    game: '用一个菜/饮料形容今天的心情',
  },
  {
    keywords: ['学习', '课程', '考试', '作业', '实验'],
    topic: '最近在忙的课程、考试或者项目进度',
    activity: '交换一个学习资料或复习小技巧',
    game: '用 3 个关键词介绍最近的学习状态',
  },
  {
    keywords: ['旅行', '出游', '周末', '散步', '徒步'],
    topic: '最想去的地方和最近想放松的方式',
    activity: '各自列一个周末半日游清单',
    game: '如果现在能立刻出发，最想去哪里',
  },
]

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function take(values: string[], max: number): string[] {
  return uniqueStrings(values).slice(0, max)
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function normalizeList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/[\n,，;；、]/).map((item) => item.trim()).filter(Boolean)
  }

  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const maybeText = (item as { text?: unknown }).text
        return typeof maybeText === 'string' ? maybeText.trim() : ''
      }
      return ''
    })
    .filter(Boolean)
}

function findTagHook(tag: string) {
  return TAG_HOOKS.find((hook) =>
    hook.keywords.some((keyword) => tag.includes(keyword) || keyword.includes(tag))
  )
}

function buildTagDrivenIdeas(commonTags: string[]) {
  const topics: string[] = []
  const activities: string[] = []
  const miniGames: string[] = []

  for (const tag of commonTags) {
    const hook = findTagHook(tag)
    if (hook) {
      topics.push(hook.topic)
      activities.push(hook.activity)
      miniGames.push(hook.game)
      continue
    }

    topics.push(`聊聊你们是怎么喜欢上“${tag}”的`)
    activities.push(`互相推荐一个和“${tag}”有关的内容`)
    miniGames.push(`用一个词形容“${tag}”，再解释原因`)
  }

  return {
    topics: take(topics, 4),
    activities: take(activities, 4),
    miniGames: take(miniGames, 4),
  }
}

function buildFallbackIcebreaker(
  currentUser: UserProfile,
  peerUser: UserProfile,
  commonTags: string[]
): IcebreakerResult {
  const sharedMajor = currentUser.major && currentUser.major === peerUser.major
    ? currentUser.major
    : null

  const tagIdeas = buildTagDrivenIdeas(commonTags)

  const openingLines = take([
    commonTags.length > 0
      ? `你们都喜欢${commonTags.slice(0, 2).join('、')}，可以先从这个切入。`
      : '可以先从最近在忙什么开始，压力会更小。',
    sharedMajor
      ? `既然都在${sharedMajor}，可以聊聊课程、资料或者老师避坑经验。`
      : '先问问对方最近在学校里发现了什么好玩的地方。',
    currentUser.bio || peerUser.bio
      ? '如果资料里有提到特别喜欢的事情，可以先从那里展开。'
      : '也可以先做个简单自我介绍，再聊周末计划。',
  ], 3)

  const topicSuggestions = take([
    ...tagIdeas.topics,
    sharedMajor ? `聊聊${sharedMajor}相关课程、项目或者复习经验` : '',
    '最近在校园里最想分享的一件小事',
    '如果周末有半天空闲，最想去哪里放松一下',
  ], 4)

  const interactionIdeas = take([
    ...tagIdeas.activities,
    '互相推荐一个最近在听的歌、看的剧或刷到的内容',
    '各自发一张手机里最近保存的图，猜猜背后的故事',
    '一起用 3 个词形容今天的状态',
  ], 4)

  const miniGames = take([
    ...tagIdeas.miniGames,
    '3 个关键词介绍自己',
    '二选一：奶茶还是咖啡，早起还是晚睡',
    '10 秒接龙：每人补一个词',
  ], 4)

  return {
    common_tags: take(commonTags, 5),
    opening_lines: openingLines,
    topic_suggestions: topicSuggestions,
    interaction_ideas: interactionIdeas,
    mini_games: miniGames,
    used_ai: false,
    model: null,
  }
}

async function fetchProfiles(
  supabase: SupabaseClient,
  userIds: [string, string]
): Promise<Map<string, UserProfile>> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, major, bio')
    .in('id', userIds)

  if (error) throw error

  const map = new Map<string, UserProfile>()
  for (const row of (data ?? []) as ProfileRow[]) {
    map.set(row.id, {
      id: row.id,
      nickname: row.nickname,
      major: row.major ?? null,
      bio: row.bio ?? null,
    })
  }
  return map
}

async function fetchTags(
  supabase: SupabaseClient,
  userIds: [string, string]
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('user_tags')
    .select('user_id, tags(name)')
    .in('user_id', userIds)

  if (error) throw error

  const map = new Map<string, string[]>()
  for (const row of (data ?? []) as TagRow[]) {
    const tagName = row.tags?.name?.trim()
    if (!tagName) continue
    const list = map.get(row.user_id) ?? []
    list.push(tagName)
    map.set(row.user_id, list)
  }

  for (const userId of userIds) {
    map.set(userId, uniqueStrings(map.get(userId) ?? []))
  }

  return map
}

function buildOpenRouterHeaders(apiKey: string): Record<string, string> {
  const siteUrl = Deno.env.get('OPENROUTER_SITE_URL')?.trim()
  const appName = Deno.env.get('OPENROUTER_APP_NAME')?.trim() || 'Quipster'

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': appName,
  }

  if (siteUrl) {
    headers['HTTP-Referer'] = siteUrl
  }

  return headers
}

async function generateWithOpenRouter(
  currentUser: UserProfile,
  peerUser: UserProfile,
  commonTags: string[],
  fallback: IcebreakerResult
): Promise<IcebreakerResult | null> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return null

  const model = Deno.env.get('OPENROUTER_MODEL')?.trim() || DEFAULT_OPENROUTER_MODEL
  const timeout = 45000

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  let response: Response
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: buildOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 360,
        messages: [
          {
            role: 'system',
            content: [
              '你是 Quipster 的校园社交 AI 聊天破冰助手。',
              '请根据两位用户资料生成首次聊天建议，只输出 JSON。',
              '允许的字段只有 opening_lines、topic_suggestions、interaction_ideas、mini_games。',
              '每个字段都必须是中文字符串数组，数量控制在 2 到 4 条。',
              '内容要自然、轻松、具体，不要油腻，不要冒犯，不要涉及隐私。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `用户A：${currentUser.nickname}`,
              `专业：${currentUser.major ?? '未填写'}`,
              `简介：${truncate(currentUser.bio ?? '未填写', 120)}`,
              `共同标签：${commonTags.join('、') || '无'}`,
              '',
              `用户B：${peerUser.nickname}`,
              `专业：${peerUser.major ?? '未填写'}`,
              `简介：${truncate(peerUser.bio ?? '未填写', 120)}`,
              `共同标签：${commonTags.join('、') || '无'}`,
              '',
              '请输出如下 JSON 格式：',
              '{"opening_lines":["..."],"topic_suggestions":["..."],"interaction_ideas":["..."],"mini_games":["..."]}',
            ].join('\n'),
          },
        ],
      }),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('[chat-icebreaker] OpenRouter API timeout or error:', error)
    return null
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) return null

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>
      }
    }>
  }

  const rawContent = payload.choices?.[0]?.message?.content
  const content = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent)
    ? rawContent.map((part) => (part?.type === 'text' ? part.text ?? '' : '')).join('')
    : ''

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  const openingLines = take(
    normalizeList(parsed.opening_lines ?? parsed.openers ?? parsed.opening_line),
    3
  )
  const topicSuggestions = take(
    normalizeList(parsed.topic_suggestions ?? parsed.topics ?? parsed.topic),
    4
  )
  const interactionIdeas = take(
    normalizeList(parsed.interaction_ideas ?? parsed.activities ?? parsed.interactions),
    4
  )
  const miniGames = take(
    normalizeList(parsed.mini_games ?? parsed.games ?? parsed.game),
    4
  )

  return {
    common_tags: fallback.common_tags,
    opening_lines: openingLines.length > 0 ? openingLines : fallback.opening_lines,
    topic_suggestions: topicSuggestions.length > 0 ? topicSuggestions : fallback.topic_suggestions,
    interaction_ideas: interactionIdeas.length > 0 ? interactionIdeas : fallback.interaction_ideas,
    mini_games: miniGames.length > 0 ? miniGames : fallback.mini_games,
    used_ai: true,
    model,
  }
}

export async function generateIcebreakerSuggestions(
  supabase: SupabaseClient,
  currentUserId: string,
  peerUserId: string
): Promise<IcebreakerResult> {
  const profiles = await fetchProfiles(supabase, [currentUserId, peerUserId])
  const tags = await fetchTags(supabase, [currentUserId, peerUserId])

  const currentUser = profiles.get(currentUserId) ?? {
    id: currentUserId,
    nickname: '用户A',
    major: null,
    bio: null,
  }

  const peerUser = profiles.get(peerUserId) ?? {
    id: peerUserId,
    nickname: '用户B',
    major: null,
    bio: null,
  }

  const currentTags = tags.get(currentUserId) ?? []
  const peerTags = tags.get(peerUserId) ?? []
  const commonTags = uniqueStrings(currentTags.filter((tag) => peerTags.includes(tag)))

  const fallback = buildFallbackIcebreaker(currentUser, peerUser, commonTags)

  try {
    const refined = await generateWithOpenRouter(currentUser, peerUser, commonTags, fallback)
    return refined ?? fallback
  } catch (error) {
    console.error('[chat-icebreaker] generation failed, fallback to template:', error)
    return fallback
  }
}
