// @ts-ignore Deno
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface QuestionContext {
  id: string
  title: string
  content: string
  category?: string | null
}

export interface AiAnswerRecord {
  id: string
  question_id: string
  content: string
  created_at: string
}

export interface KnowledgeReference {
  id: string
  title: string
  category: string | null
  source: string | null
}

export interface GenerateAiAnswerResult {
  answer: AiAnswerRecord
  cached: boolean
  model: string | null
  keywords: string[]
  references: KnowledgeReference[]
  used_fallback: boolean
}

interface KnowledgeDocument {
  id: number | string
  title: string
  content: string
  category: string | null
  keywords: string[] | null
  source: string | null
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free'
const MAX_REFERENCES = 5

const CHINESE_STOP_WORDS = new Set([
  '请问', '一下', '一个', '这个', '那个', '我们', '你们', '他们', '同学',
  '老师', '学校', '校园', '问题', '情况', '有没有', '怎么', '如何', '为什么',
  '什么', '哪里', '哪个', '是否', '可以', '需要', '想问', '想请教', '想了解',
  '知道', '帮忙', '谢谢', '就是', '还是', '然后', '但是', '如果', '因为',
  '关于', '相关', '目前', '最近', '还有', '一下子',
])

const EN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'at', 'with',
  'is', 'are', 'be', 'do', 'does', 'did', 'how', 'what', 'when', 'where',
  'which', 'can', 'could', 'should', 'would', 'about', 'please', 'help',
])

const CATEGORY_HINTS: Record<string, string[]> = {
  '课程': ['课程', '选课', '教务', '学分', '绩点', '成绩', '考试', '补考', '重修', '老师', '课表', '实验'],
  '考研': ['考研', '保研', '复试', '推免', '初试', '调剂', '参考书', '政治', '英语', '数学', '专业课'],
  '实习': ['实习', '秋招', '春招', '简历', '面试', '网申', '校招', '招聘', 'offer', '内推'],
  '生活': ['宿舍', '食堂', '快递', '洗衣', '门禁', '澡堂', '图书馆', '校园卡', '电费', '医保'],
  '校园服务': ['办事', '证明', '盖章', '辅导员', '学工', '财务', '奖学金', '资助', '转专业', '教务处'],
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function countOccurrences(source: string, keyword: string): number {
  if (!source || !keyword) return 0

  let count = 0
  let startIndex = 0

  while (true) {
    const index = source.indexOf(keyword, startIndex)
    if (index === -1) break
    count += 1
    startIndex = index + keyword.length
  }

  return count
}

function collectLatinTerms(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z][a-z0-9+#./_-]{1,20}/g) ?? []
  return matches.filter((term) => !EN_STOP_WORDS.has(term))
}

function collectChineseTerms(text: string): string[] {
  const chunks = text.match(/[\u4e00-\u9fff]{2,24}/g) ?? []
  const terms: string[] = []

  for (const chunk of chunks) {
    if (chunk.length <= 4 && !CHINESE_STOP_WORDS.has(chunk)) {
      terms.push(chunk)
      continue
    }

    for (const size of [4, 3, 2]) {
      for (let index = 0; index <= chunk.length - size; index += 1) {
        const token = chunk.slice(index, index + size)
        if (!CHINESE_STOP_WORDS.has(token)) {
          terms.push(token)
        }
      }
    }
  }

  return terms
}

function rankTerms(terms: string[], limit: number): string[] {
  const scores = new Map<string, number>()

  for (const term of terms) {
    const cleaned = normalizeWhitespace(term)
    if (!cleaned || cleaned.length < 2) continue
    if (/^\d+$/.test(cleaned)) continue

    const current = scores.get(cleaned) ?? 0
    scores.set(cleaned, current + 1)
  }

  return [...scores.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1]
      return left[0].length - right[0].length
    })
    .slice(0, limit)
    .map(([term]) => term)
}

export function extractKeywords(question: QuestionContext): string[] {
  const title = normalizeWhitespace(toText(question.title))
  const content = normalizeWhitespace(toText(question.content))

  const weightedTerms = [
    ...collectChineseTerms(title),
    ...collectChineseTerms(title),
    ...collectLatinTerms(title),
    ...collectLatinTerms(title),
    ...collectChineseTerms(content),
    ...collectLatinTerms(content),
  ]

  return rankTerms(weightedTerms, 8)
}

function inferCategory(question: QuestionContext, keywords: string[]): string | null {
  if (question.category?.trim()) return question.category.trim()

  const text = `${question.title} ${question.content} ${keywords.join(' ')}`
  let bestCategory: string | null = null
  let bestScore = 0

  for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
    let score = 0
    for (const hint of hints) {
      if (text.includes(hint)) score += 1
    }
    if (score > bestScore) {
      bestCategory = category
      bestScore = score
    }
  }

  return bestCategory
}

function scoreKnowledgeDoc(
  doc: KnowledgeDocument,
  keywords: string[],
  preferredCategory: string | null
): number {
  const title = toText(doc.title)
  const content = toText(doc.content)
  const docKeywords = (doc.keywords ?? []).filter(Boolean)

  let score = 0

  if (preferredCategory && doc.category === preferredCategory) {
    score += 3
  }

  for (const keyword of keywords) {
    if (docKeywords.some((item) => item.includes(keyword) || keyword.includes(item))) {
      score += 4
    }

    const titleHits = countOccurrences(title, keyword)
    if (titleHits > 0) {
      score += titleHits * 3
    }

    const contentHits = countOccurrences(content, keyword)
    if (contentHits > 0) {
      score += Math.min(contentHits, 5)
    }
  }

  return score
}

async function fetchKnowledgeBaseCandidates(
  supabase: SupabaseClient,
  preferredCategory: string | null
): Promise<KnowledgeDocument[]> {
  const columns = 'id, title, content, category, keywords, source'
  const merged = new Map<string, KnowledgeDocument>()

  if (preferredCategory) {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select(columns)
      .eq('is_active', true)
      .eq('category', preferredCategory)
      .limit(50)

    if (error) throw error

    for (const row of data ?? []) {
      merged.set(String(row.id), row as KnowledgeDocument)
    }
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('knowledge_base')
    .select(columns)
    .eq('is_active', true)
    .limit(100)

  if (fallbackError) throw fallbackError

  for (const row of fallbackRows ?? []) {
    merged.set(String(row.id), row as KnowledgeDocument)
  }

  return [...merged.values()]
}

async function retrieveKnowledgeDocs(
  supabase: SupabaseClient,
  question: QuestionContext,
  keywords: string[]
): Promise<KnowledgeDocument[]> {
  const preferredCategory = inferCategory(question, keywords)
  const candidates = await fetchKnowledgeBaseCandidates(supabase, preferredCategory)

  return candidates
    .map((doc) => ({
      doc,
      score: scoreKnowledgeDoc(doc, keywords, preferredCategory),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_REFERENCES)
    .map((item) => item.doc)
}

function buildReferences(docs: KnowledgeDocument[]): KnowledgeReference[] {
  return docs.map((doc) => ({
    id: String(doc.id),
    title: toText(doc.title),
    category: doc.category ?? null,
    source: doc.source ?? null,
  }))
}

function formatKnowledgeContext(docs: KnowledgeDocument[]): string {
  if (docs.length === 0) {
    return '未检索到直接匹配的校园资料。'
  }

  return docs
    .map((doc, index) => {
      const metadata = uniqueStrings([
        doc.category ?? '',
        doc.source ?? '',
        ...(doc.keywords ?? []).slice(0, 5),
      ]).join(' / ')

      return [
        `资料${index + 1}: ${toText(doc.title)}`,
        metadata ? `标签: ${metadata}` : '',
        `内容: ${truncate(normalizeWhitespace(toText(doc.content)), 320)}`,
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')
}

function buildFallbackReferenceAnswer(
  question: QuestionContext,
  docs: KnowledgeDocument[]
): string {
  if (docs.length === 0) {
    return [
      `针对“${question.title}”，资料库中暂未检索到可以直接回答的问题条目。`,
      '建议补充更具体的课程名称、学院、部门、时间或地点，再重新生成参考回答。',
      '在人工回答出现前，也可以先查看教务、学工、学院通知或相关办事指南进行确认。',
    ].join('\n\n')
  }

  const docSummary = docs
    .slice(0, 3)
    .map((doc, index) => `${index + 1}. ${toText(doc.title)}：${truncate(normalizeWhitespace(toText(doc.content)), 90)}`)
    .join('\n')

  return [
    `围绕“${question.title}”，我从校园资料库中检索到了以下可能相关的信息：`,
    docSummary,
    '以上内容为资料摘要整理，仅供参考。若问题涉及具体时间、流程或政策，请以学院、部门或学校最新通知为准。',
  ].join('\n\n')
}

async function generateOpenRouterAnswer(
  question: QuestionContext,
  keywords: string[],
  docs: KnowledgeDocument[]
): Promise<{ content: string; model: string | null }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
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

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 420,
      messages: [
        {
          role: 'system',
          content: [
            '你是 Quipster 的校园问答 AI 助手。',
            '你只可以根据给出的校园资料库内容生成“参考回答”，不要编造不存在的校规、流程、时间、地点或联系方式。',
            '如果资料不够，必须明确说明“资料库中暂无直接答案”，并给出下一步查询建议。',
            '输出中文，保持简洁、清晰、适合作为校园问答区的自动参考回答。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `问题标题：${question.title}`,
            `问题内容：${question.content}`,
            `提取关键词：${keywords.join('、') || '无'}`,
            '',
            '校园资料库检索结果：',
            formatKnowledgeContext(docs),
            '',
            '请生成一个参考回答，格式要求：',
            '1. 第一段直接回答或说明资料不足。',
            '2. 第二段概括你参考了哪些资料方向。',
            '3. 第三段给出下一步建议。',
          ].join('\n'),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = truncate(await response.text(), 500)
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`)
  }

  const payload = await response.json() as {
    model?: string
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>
      }
    }>
  }

  const firstChoice = payload.choices?.[0]
  const rawContent = firstChoice?.message?.content

  let content = ''
  if (typeof rawContent === 'string') {
    content = rawContent
  } else if (Array.isArray(rawContent)) {
    content = rawContent
      .map((part) => (part?.type === 'text' ? part.text ?? '' : ''))
      .join('')
  }

  const normalized = normalizeWhitespace(content)
  if (!normalized) {
    throw new Error('OpenRouter response did not include answer content')
  }

  return {
    content: normalized,
    model: payload.model ?? model,
  }
}

function mapAiAnswerRecord(row: { id: number | string; question_id: number | string; content: string; created_at: string }): AiAnswerRecord {
  return {
    id: String(row.id),
    question_id: String(row.question_id),
    content: toText(row.content),
    created_at: row.created_at,
  }
}

export async function getStoredAiAnswer(
  supabase: SupabaseClient,
  questionId: string
): Promise<AiAnswerRecord | null> {
  const { data, error } = await supabase
    .from('ai_answers')
    .select('id, question_id, content, created_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapAiAnswerRecord(data as { id: number | string; question_id: number | string; content: string; created_at: string })
}

export async function generateAndStoreAiAnswer(
  supabase: SupabaseClient,
  question: QuestionContext,
  options?: { force?: boolean }
): Promise<GenerateAiAnswerResult> {
  const force = options?.force === true

  if (!force) {
    const existingAnswer = await getStoredAiAnswer(supabase, question.id)
    if (existingAnswer) {
      return {
        answer: existingAnswer,
        cached: true,
        model: null,
        keywords: extractKeywords(question),
        references: [],
        used_fallback: false,
      }
    }
  }

  const keywords = extractKeywords(question)
  const docs = await retrieveKnowledgeDocs(supabase, question, keywords)

  let content = ''
  let model: string | null = null
  let usedFallback = false

  try {
    const generated = await generateOpenRouterAnswer(question, keywords, docs)
    content = generated.content
    model = generated.model
  } catch (error) {
    console.error('AI answer generation failed, fallback to retrieval summary:', error)
    content = buildFallbackReferenceAnswer(question, docs)
    usedFallback = true
  }

  const { error: deleteError } = await supabase
    .from('ai_answers')
    .delete()
    .eq('question_id', question.id)

  if (deleteError) throw deleteError

  const { data: insertedAnswer, error: insertError } = await supabase
    .from('ai_answers')
    .insert({
      question_id: question.id,
      content,
    })
    .select('id, question_id, content, created_at')
    .single()

  if (insertError) throw insertError

  const { error: questionUpdateError } = await supabase
    .from('questions')
    .update({ has_ai_answer: true })
    .eq('id', question.id)

  if (questionUpdateError) {
    console.error('Failed to update questions.has_ai_answer:', questionUpdateError)
  }

  return {
    answer: mapAiAnswerRecord(insertedAnswer as { id: number | string; question_id: number | string; content: string; created_at: string }),
    cached: false,
    model,
    keywords,
    references: buildReferences(docs),
    used_fallback: usedFallback,
  }
}
