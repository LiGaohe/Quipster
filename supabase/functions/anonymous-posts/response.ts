import { corsHeaders } from './cors.ts'

// ============================================================
// 统一响应工具
// ============================================================

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject { [key: string]: JsonValue }
interface JsonArray extends Array<JsonValue> {}

/** 成功响应 */
export function ok(data: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** 错误响应 */
export function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** 构建标准分页信息 */
export function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  }
}

/** 从查询参数安全解析分页参数 */
export function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))
  return { page, limit, offset: (page - 1) * limit }
}
