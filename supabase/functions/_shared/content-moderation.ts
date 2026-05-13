// @ts-ignore Deno
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ContentTargetType = 'post' | 'comment' | 'anonymous_post' | 'message'
export type ModerationRiskLevel = 'safe' | 'low' | 'medium' | 'high'
export type ModerationAuditStatus = 'pending' | 'passed' | 'flagged' | 'rejected'

export interface ContentModerationInput {
  target_type: ContentTargetType
  content: string
  title?: string | null
}

export interface ContentModerationResult {
  audit_status: ModerationAuditStatus
  risk_level: ModerationRiskLevel
  risk_score: number
  matched_keywords: string[]
  reasons: string[]
  summary: string
  used_ai: boolean
  model: string | null
  needs_admin_review: boolean
}

export interface ModerationReportTarget {
  target_type: 'post' | 'comment' | 'anonymous_post' | 'message'
  target_id: string | number
}

interface RuleGroup {
  label: string
  keywords: string[]
  weight: number
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_OPENROUTER_MODEL = 'openrouter/free'

const RULE_GROUPS: RuleGroup[] = [
  { label: '自伤/轻生', keywords: ['自杀', '轻生', '不想活', '活不下去', '自残', '结束自己', '割腕', '跳楼'], weight: 3.6 },
  { label: '暴力威胁', keywords: ['弄死你', '杀了你', '杀死你', '砍死', '炸死', '报复社会', '血洗'], weight: 3.2 },
  { label: '色情低俗', keywords: ['裸聊', '约炮', '色情网', '成人视频', '色情网', '成人视频', '自拍偷拍'], weight: 2.8 },
  { label: '仇恨辱骂', keywords: ['傻逼', '贱人', '废物', '死全家', '去死', '畜生', '变态'], weight: 2.2 },
  { label: '诈骗引流', keywords: ['刷单', '返利', '博彩', '下注', '兼职', '代购', '推广', '加微信', '加vx', '私聊我', '转账', '验证码', '贷款'], weight: 2.0 },
  { label: '广告垃圾', keywords: ['广告', '引流', '推广', '优惠券', '秒杀', '代理', '代发', '群发'], weight: 1.2 },
  { label: '隐私泄露', keywords: ['身份证', '银行卡', '密码', '手机号', '电话号', '联系方式', '住址', '家庭住址'], weight: 2.0 },
  { label: '毒品赌博', keywords: ['毒品', '大麻', '冰毒', '海洛因', '赌博', '赌场', '下注', '赌局'], weight: 3.0 },
]

const PATTERN_RULES: Array<{ label: string; pattern: RegExp; weight: number }> = [
  { label: '手机号', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g, weight: 1.8 },
  { label: '邮箱', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, weight: 1.4 },
  { label: '外链', pattern: /https?:\/\/\S+/gi, weight: 1.2 },
  { label: '身份证号', pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g, weight: 2.0 },
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function countOccurrences(source: string, keyword: string): number {
  if (!source || !keyword) return 0

  let count = 0
  let startIndex = 0
  while (true) {
    const found = source.indexOf(keyword, startIndex)
    if (found === -1) break
    count += 1
    startIndex = found + keyword.length
  }

  return count
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function severityRank(level: ModerationRiskLevel): number {
  switch (level) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function riskLevelFromScore(score: number, keywordCount: number): ModerationRiskLevel {
  if (score >= 0.82 || keywordCount >= 4) return 'high'
  if (score >= 0.52 || keywordCount >= 2) return 'medium'
  if (score >= 0.18 || keywordCount >= 1) return 'low'
  return 'safe'
}

function summarizeRiskLevel(level: ModerationRiskLevel): string {
  switch (level) {
    case 'high':
      return '高风险'
    case 'medium':
      return '中风险'
    case 'low':
      return '低风险'
    default:
      return '安全'
  }
}

function summarizeAuditStatus(status: ModerationAuditStatus): string {
  switch (status) {
    case 'passed':
      return '已通过'
    case 'flagged':
      return '已标记'
    case 'rejected':
      return '已拒绝'
    default:
      return '待审'
  }
}

function buildSummary(
  riskLevel: ModerationRiskLevel,
  matchedKeywords: string[],
  reasons: string[]
): string {
  if (riskLevel === 'safe') {
    return '未发现明显违规风险'
  }

  const keywordText = matchedKeywords.length > 0 ? `命中关键词：${matchedKeywords.slice(0, 4).join('、')}` : ''
  const reasonText = reasons.slice(0, 2).join('；')
  return truncate([`当前内容存在${summarizeRiskLevel(riskLevel)}风险`, keywordText, reasonText].filter(Boolean).join('，'), 140)
}

function analyzeByRules(text: string): {
  riskLevel: ModerationRiskLevel
  riskScore: number
  matchedKeywords: string[]
  reasons: string[]
} {
  const normalized = normalizeWhitespace(text)
  const matchedKeywords: string[] = []
  const reasons: string[] = []

  let rawScore = 0

  for (const group of RULE_GROUPS) {
    let groupHits = 0
    for (const keyword of group.keywords) {
      const hits = countOccurrences(normalized, keyword)
      if (hits <= 0) continue
      matchedKeywords.push(keyword)
      groupHits += hits
    }

    if (groupHits > 0) {
      rawScore += groupHits * group.weight
      reasons.push(`命中${group.label}词`)
    }
  }

  for (const rule of PATTERN_RULES) {
    const matches = normalized.match(rule.pattern) ?? []
    if (matches.length === 0) continue
    rawScore += matches.length * rule.weight
    matchedKeywords.push(rule.label)
    reasons.push(`命中${rule.label}`)
  }

  const riskLevel = riskLevelFromScore(rawScore / 10, uniqueStrings(matchedKeywords).length)

  return {
    riskLevel,
    riskScore: Number(clamp(rawScore / 10, 0, 1).toFixed(2)),
    matchedKeywords: uniqueStrings(matchedKeywords),
    reasons: uniqueStrings(reasons),
  }
}

async function maybeRefineWithOpenRouter(
  input: ContentModerationInput,
  ruleResult: {
    riskLevel: ModerationRiskLevel
    riskScore: number
    matchedKeywords: string[]
    reasons: string[]
  }
): Promise<{ riskLevel: ModerationRiskLevel; usedAi: boolean; model: string | null }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey || ruleResult.riskLevel === 'safe') {
    return { riskLevel: ruleResult.riskLevel, usedAi: false, model: null }
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
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content: [
              '你是 Quipster 的中文内容审核器。',
              '请只基于用户输入判断是否存在敏感词、违规内容、风险内容。',
              '只允许输出 JSON，不要输出多余解释。',
              'risk_level 只能是 safe、low、medium、high 之一。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `内容类型：${input.target_type}`,
              input.title ? `标题：${input.title}` : '',
              `正文：${input.content}`,
              `规则初判：${ruleResult.riskLevel}（${ruleResult.riskScore}）`,
              `命中关键词：${ruleResult.matchedKeywords.join('、') || '无'}`,
              '',
              '请输出如下 JSON：{"risk_level":"medium","reasons":["..."],"matched_keywords":["..."]}',
            ].join('\n'),
          },
        ],
      }),
    })

    if (!response.ok) {
      return { riskLevel: ruleResult.riskLevel, usedAi: false, model: null }
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
      return { riskLevel: ruleResult.riskLevel, usedAi: false, model: null }
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      risk_level?: ModerationRiskLevel
      reasons?: string[]
      matched_keywords?: string[]
    }

    const allowed: ModerationRiskLevel[] = ['safe', 'low', 'medium', 'high']
    const parsedLevel = allowed.includes(parsed.risk_level as ModerationRiskLevel)
      ? parsed.risk_level as ModerationRiskLevel
      : ruleResult.riskLevel

    const riskLevel = severityRank(parsedLevel) > severityRank(ruleResult.riskLevel)
      ? parsedLevel
      : ruleResult.riskLevel

    return { riskLevel, usedAi: true, model }
  } catch {
    return { riskLevel: ruleResult.riskLevel, usedAi: false, model: null }
  }
}

export async function analyzeContentModeration(
  input: ContentModerationInput
): Promise<ContentModerationResult> {
  const text = normalizeWhitespace([input.title ?? '', input.content].filter(Boolean).join('\n'))
  const ruleResult = analyzeByRules(text)
  const refined = await maybeRefineWithOpenRouter(input, ruleResult)

  const finalRiskLevel = refined.riskLevel
  const auditStatus: ModerationAuditStatus = finalRiskLevel === 'safe' ? 'passed' : 'flagged'
  const summary = buildSummary(finalRiskLevel, ruleResult.matchedKeywords, ruleResult.reasons)

  return {
    audit_status: auditStatus,
    risk_level: finalRiskLevel,
    risk_score: ruleResult.riskScore,
    matched_keywords: ruleResult.matchedKeywords,
    reasons: ruleResult.reasons,
    summary,
    used_ai: refined.usedAi,
    model: refined.model,
    needs_admin_review: auditStatus !== 'passed',
  }
}

export function summarizeModerationStatus(status: ModerationAuditStatus): string {
  return summarizeAuditStatus(status)
}

export async function submitModerationReport(
  supabase: SupabaseClient,
  reporterUserId: string,
  target: ModerationReportTarget,
  summary: string,
  details: string[]
): Promise<void> {
  const targetId = typeof target.target_id === 'number'
    ? target.target_id
    : Number.parseInt(String(target.target_id), 10)

  if (Number.isNaN(targetId)) return

  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_user_id: reporterUserId,
      target_type: target.target_type,
      target_id: targetId,
      reason: summary || 'AI 内容识别标记',
      description: details.length > 0 ? details.join('；') : 'AI 内容识别自动提交审核',
      status: 'pending',
    })

  if (error) {
    console.error('[moderation] submit report failed:', error)
  }
}
