import { createAdminClient } from './supabase.ts'

// ============================================================
// JWT 认证辅助工具
// ============================================================

export interface AuthUser {
  id: string
  email: string
}

/**
 * 从请求头中提取 Bearer Token
 */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7).trim()
}

/**
 * 验证 JWT 并返回当前用户信息，失败返回 null
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = extractToken(req)
  if (!token) return null

  try {
    const admin = createAdminClient()
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return null
    return { id: user.id, email: user.email! }
  } catch {
    return null
  }
}

/**
 * 要求认证，失败时返回 401 响应
 * 使用方式：const [user, resp] = await requireAuth(req); if (resp) return resp;
 */
import { corsHeaders } from './cors.ts'

export async function requireAuth(
  req: Request
): Promise<[AuthUser, null] | [null, Response]> {
  const user = await getAuthUser(req)
  if (!user) {
    const resp = new Response(
      JSON.stringify({ error: '未认证，请先登录' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    return [null, resp]
  }
  return [user, null]
}

/**
 * 解析 URL 中函数名之后的路径片段
 * 例如 /functions/v1/posts/UUID/like → ['UUID', 'like']
 */
export function getPathSegments(url: URL, functionName: string): string[] {
  const prefix = `/functions/v1/${functionName}`
  const pathname = url.pathname
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  return rest.split('/').filter(Boolean)
}
