// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { ok } from '../_shared/response.ts'

// ============================================================
// health/index.ts — 健康检查端点（无需认证）
// 用于 UptimeRobot 等监控服务保持 Supabase 项目活跃
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Quipster API',
    version: '1.0.0',
  })
})