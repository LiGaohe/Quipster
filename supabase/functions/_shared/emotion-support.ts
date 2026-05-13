// @ts-ignore Deno
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type EmotionType = 'positive' | 'neutral' | 'anxiety' | 'stress' | 'sadness'

export interface EmotionAnalysisResult {
  emotion_type: EmotionType
  emotion_score: number
  support_resources: string[]
  triggers: string[]
  matched_keywords: string[]
  support_posts: Array<{ id: string; title: string }>
  support_events: Array<{ id: string; title: string; start_time: string | null }>
  used_ai: boolean
}

interface EmotionRule {
  type: EmotionType
  keywords: string[]
  weight: number
}

interface AnonymousPostContext {
  id: string
  title: string
  content: string
  tag?: string | null
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free'

const EMOTION_RULES: EmotionRule[] = [
  {
    type: 'positive',
    weight: 1.0,
    keywords: ['开心', '高兴', '轻松', '温暖', '幸福', '满意', '顺利', '治愈', '感谢', '兴奋', '期待', '有希望', '松弛', '舒服'],
  },
  {
    type: 'neutral',
    weight: 0.6,
    keywords: ['记录', '分享', '最近', '日常', '想法', '感受', '讨论', '吐槽', '请教', '咨询'],
  },
  {
    type: 'anxiety',
    weight: 1.3,
    keywords: ['焦虑', '慌', '害怕', '不安', '担心', '睡不着', '失眠', '紧张', '崩溃边缘', '心慌', '喘不过气', '怕来不及', '压得喘不过气'],
  },
  {
    type: 'stress',
    weight: 1.2,
    keywords: ['压力', '好累', '很累', '撑不住', '太忙', 'ddl', '截止', '熬夜', '复习不完', '赶作业', '赶论文', '崩了', '疲惫', '身心俱疲'],
  },
  {
    type: 'sadness',
    weight: 1.4,
    keywords: ['难过', '伤心', '委屈', '想哭', '哭了', '孤独', '没人理解', '失落', '绝望', '沮丧', '抑郁', '自责', '没有意义', '撑不下去'],
  },
]

const CRISIS_KEYWORDS = [
  '不想活', '活不下去', '结束自己', '自杀', '轻生', '伤害自己', '自残', '不如死', '消失算了',
]

const BASE_SUPPORT_RESOURCES = [
  '如果你感到情绪持续低落，可以先联系信任的同学、室友、辅导员或家人，避免独自承受。',
  '建议优先保证睡眠、饮食和短时休息，把当前问题拆成更小的可执行步骤。',
]

const NEGATIVE_SUPPORT_RESOURCES = [
  '如果压力主要来自学业或时间安排，建议尽快和任课老师、导师、辅导员或同学沟通，先处理最紧急事项。',
  '如果情绪已经明显影响睡眠、进食或日常功能，建议尽快联系学校心理中心或专业心理咨询资源。',
]

const CRISIS_SUPPORT_RESOURCES = [
  '如果你已经有强烈的自伤或轻生想法，请立即联系身边可信任的人陪伴你，并尽快前往医院急诊或拨打当地紧急援助电话。',
  '如果你现在一个人，请不要独处，立刻联系室友、同学、辅导员、家人或校园安保获得现实陪伴与帮助。',
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function countKeywordHits(text: string, keyword: string): number {
  let count = 0
  let index = 0

  while (true) {
    const found = text.indexOf(keyword, index)
    if (found === -1) break
    count += 1
    index = found + keyword.length
  }

  return count
}

function scoreEmotionByRules(text: string): {
  emotionType: EmotionType
  score: number
  matchedKeywords: string[]
  triggers: string[]
} {
  const normalized = normalizeWhitespace(text)
  const scores = new Map<EmotionType, number>([
    ['positive', 0],
    ['neutral', 0.4],
    ['anxiety', 0],
    ['stress', 0],
    ['sadness', 0],
  ])

  const matchedKeywords: string[] = []

  for (const rule of EMOTION_RULES) {
    for (const keyword of rule.keywords) {
      const hits = countKeywordHits(normalized, keyword)
      if (hits <= 0) continue
      matchedKeywords.push(keyword)
      scores.set(rule.type, (scores.get(rule.type) ?? 0) + hits * rule.weight)
    }
  }

  const triggers = CRISIS_KEYWORDS.filter((keyword) => normalized.includes(keyword))
  if (triggers.length > 0) {
    scores.set('sadness', (scores.get('sadness') ?? 0) + triggers.length * 3)
    scores.set('anxiety', (scores.get('anxiety') ?? 0) + triggers.length * 1.5)
  }

  let emotionType: EmotionType = 'neutral'
  let topScore = scores.get('neutral') ?? 0.4

  for (const [type, score] of scores.entries()) {
    if (score > topScore) {
      emotionType = type
      topScore = score
    }
  }

  const negativePeak = Math.max(
    scores.get('anxiety') ?? 0,
    scores.get('stress') ?? 0,
    scores.get('sadness') ?? 0,
  )

  let score = 0.18
  if (emotionType === 'positive') {
    score = clamp(0.5 + topScore * 0.08, 0.5, 0.92)
  } else if (emotionType === 'neutral') {
    score = clamp(0.35 + topScore * 0.06, 0.35, 0.68)
  } else {
    score = clamp(0.45 + negativePeak * 0.1, 0.45, triggers.length > 0 ? 0.98 : 0.94)
  }

  return {
    emotionType,
    score: Number(score.toFixed(2)),
    matchedKeywords: Array.from(new Set(matchedKeywords)),
    triggers,
  }
}

async function maybeRefineEmotionWithAi(
  post: AnonymousPostContext,
  ruleResult: {
    emotionType: EmotionType
    score: number
    matchedKeywords: string[]
    triggers: string[]
  }
): Promise<{ emotionType: EmotionType; score: number; usedAi: boolean }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    return { emotionType: ruleResult.emotionType, score: ruleResult.score, usedAi: false }
  }

  const model = Deno.env.get('OPENROUTER_MODEL')?.trim() || DEFAULT_OPENROUTER_MODEL
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

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content: [
              '你是一个校园匿名树洞情绪识别器。',
              '请基于文本判断情绪类型，只允许输出 JSON。',
              'emotion_type 只能是 positive、neutral、anxiety、stress、sadness 之一。',
              'emotion_score 为 0 到 1 之间的小数。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `标题：${post.title}`,
              `内容：${post.content}`,
              `规则初判：${ruleResult.emotionType}`,
              `规则得分：${ruleResult.score}`,
              `命中关键词：${ruleResult.matchedKeywords.join('、') || '无'}`,
              '',
              '只输出如下 JSON：{"emotion_type":"neutral","emotion_score":0.52}',
            ].join('\n'),
          },
        ],
      }),
    })

    if (!response.ok) {
      return { emotionType: ruleResult.emotionType, score: ruleResult.score, usedAi: false }
    }

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
    if (!jsonMatch) {
      return { emotionType: ruleResult.emotionType, score: ruleResult.score, usedAi: false }
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      emotion_type?: EmotionType
      emotion_score?: number
    }

    const allowedTypes: EmotionType[] = ['positive', 'neutral', 'anxiety', 'stress', 'sadness']
    const emotionType = allowedTypes.includes(parsed.emotion_type as EmotionType)
      ? parsed.emotion_type as EmotionType
      : ruleResult.emotionType

    const score = typeof parsed.emotion_score === 'number'
      ? Number(clamp(parsed.emotion_score, 0, 1).toFixed(2))
      : ruleResult.score

    return { emotionType, score, usedAi: true }
  } catch {
    return { emotionType: ruleResult.emotionType, score: ruleResult.score, usedAi: false }
  }
}

async function findSupportPosts(
  supabase: SupabaseClient,
  postId: string,
  emotionType: EmotionType
): Promise<Array<{ id: string; title: string }>> {
  if (!['anxiety', 'stress', 'sadness'].includes(emotionType)) return []

  const { data, error } = await supabase
    .from('anonymous_posts')
    .select('id, title, emotion_type, created_at')
    .eq('type', 'post')
    .neq('id', postId)
    .eq('emotion_type', emotionType)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error) {
    console.error('findSupportPosts error:', error)
    return []
  }

  return (data ?? []).map((item: { id: number | string; title: string | null }) => ({
    id: String(item.id),
    title: item.title?.trim() || '匿名树洞帖子',
  }))
}

async function findSupportEvents(
  supabase: SupabaseClient,
  emotionType: EmotionType
): Promise<Array<{ id: string; title: string; start_time: string | null }>> {
  if (!['anxiety', 'stress', 'sadness'].includes(emotionType)) return []

  const now = new Date().toISOString()
  const keywords = emotionType === 'stress'
    ? ['讲座', '减压', '运动', '放松', '交流']
    : emotionType === 'anxiety'
    ? ['讲座', '交流', '支持', '分享', '沙龙']
    : ['交流', '陪伴', '分享', '活动', '讲座']

  const filters = keywords.map((keyword) => `title.ilike.%${keyword}%,description.ilike.%${keyword}%`)

  const { data, error } = await supabase
    .from('activities')
    .select('id, title, event_time, start_time, description')
    .eq('activity_type', 'event')
    .gte('event_time', now)
    .or(filters.join(','))
    .order('event_time', { ascending: true })
    .limit(3)

  if (error) {
    console.error('findSupportEvents error:', error)
    return []
  }

  return (data ?? []).map((item: { id: number | string; title: string; event_time?: string | null; start_time?: string | null }) => ({
    id: String(item.id),
    title: item.title,
    start_time: item.start_time ?? item.event_time ?? null,
  }))
}

function buildSupportResources(
  emotionType: EmotionType,
  score: number,
  triggers: string[],
  supportPosts: Array<{ id: string; title: string }>,
  supportEvents: Array<{ id: string; title: string; start_time: string | null }>
): string[] {
  const resources = [...BASE_SUPPORT_RESOURCES]

  if (['anxiety', 'stress', 'sadness'].includes(emotionType)) {
    resources.push(...NEGATIVE_SUPPORT_RESOURCES)
  }

  if (triggers.length > 0 || (emotionType === 'sadness' && score >= 0.85)) {
    resources.push(...CRISIS_SUPPORT_RESOURCES)
  }

  if (supportPosts.length > 0) {
    resources.push(`你也可以看看社区里相似经历的树洞帖子：${supportPosts.map((item) => item.title).join('、')}。`)
  }

  if (supportEvents.length > 0) {
    resources.push(`近期可关注的活动：${supportEvents.map((item) => item.title).join('、')}。`)
  }

  return Array.from(new Set(resources)).slice(0, 6)
}

export async function analyzeEmotionAndSupport(
  supabase: SupabaseClient,
  post: AnonymousPostContext
): Promise<EmotionAnalysisResult> {
  const text = normalizeWhitespace(`${post.title} ${post.content} ${post.tag ?? ''}`)
  const ruleResult = scoreEmotionByRules(text)
  const refined = await maybeRefineEmotionWithAi(post, ruleResult)

  const supportPosts = await findSupportPosts(supabase, post.id, refined.emotionType)
  const supportEvents = await findSupportEvents(supabase, refined.emotionType)
  const supportResources = buildSupportResources(
    refined.emotionType,
    refined.score,
    ruleResult.triggers,
    supportPosts,
    supportEvents,
  )

  return {
    emotion_type: refined.emotionType,
    emotion_score: refined.score,
    support_resources: supportResources,
    triggers: ruleResult.triggers,
    matched_keywords: ruleResult.matchedKeywords,
    support_posts: supportPosts,
    support_events: supportEvents,
    used_ai: refined.usedAi,
  }
}

export async function persistEmotionAnalysis(
  supabase: SupabaseClient,
  post: AnonymousPostContext
): Promise<EmotionAnalysisResult> {
  const analysis = await analyzeEmotionAndSupport(supabase, post)

  const { error } = await supabase
    .from('anonymous_posts')
    .update({
      emotion_type: analysis.emotion_type,
      emotion_score: analysis.emotion_score,
      support_resources: analysis.support_resources,
    })
    .eq('id', post.id)

  if (error) throw error

  return analysis
}

export function summarizeEmotionLabel(emotionType: EmotionType): string {
  switch (emotionType) {
    case 'positive':
      return '积极'
    case 'neutral':
      return '中性'
    case 'anxiety':
      return '焦虑'
    case 'stress':
      return '压力'
    case 'sadness':
      return '悲伤'
    default:
      return '中性'
  }
}

export function buildFallbackSupportSummary(result: EmotionAnalysisResult): string {
  const label = summarizeEmotionLabel(result.emotion_type)
  return truncate(`当前识别到的主要情绪倾向为${label}，置信度约 ${(result.emotion_score * 100).toFixed(0)}%。`, 120)
}
