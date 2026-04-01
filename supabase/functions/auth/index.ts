// @ts-ignore Deno
import { handleCors } from '../_shared/cors.ts'
import { createAdminClient, createAnonClient } from '../_shared/supabase.ts'
import { ok, err } from '../_shared/response.ts'
import { requireAuth, extractToken } from '../_shared/auth.ts'

// ============================================================
// auth/index.ts — 注册 / 登录 / 登出
// ============================================================

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  // 处理 CORS 预检
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  const url = new URL(req.url)
  const pathname = url.pathname

  try {
    // POST /auth/register
    if (req.method === 'POST' && pathname.endsWith('/register')) {
      return await handleRegister(req)
    }

    // POST /auth/login
    if (req.method === 'POST' && pathname.endsWith('/login')) {
      return await handleLogin(req)
    }

    // POST /auth/logout
    if (req.method === 'POST' && pathname.endsWith('/logout')) {
      return await handleLogout(req)
    }

    return err('Not Found', 404)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal Server Error'
    return err(message, 500)
  }
})

// ----------------------------------------------------------------
// 注册
// ----------------------------------------------------------------
async function handleRegister(req: Request): Promise<Response> {
  let body: { email?: string; password?: string; nickname?: string }
  try {
    body = await req.json()
  } catch {
    return err('请求体格式错误', 400)
  }

  const { email, password, nickname } = body

  // 验证邮箱格式
  if (!email || typeof email !== 'string') {
    return err('邮箱不能为空', 400)
  }
  const allowedDomains = ['@tongji.edu.cn', '@stu.tongji.edu.cn']
  const emailLower = email.toLowerCase().trim()
  if (!allowedDomains.some((d) => emailLower.endsWith(d))) {
    return err('仅支持同济大学邮箱（@tongji.edu.cn 或 @stu.tongji.edu.cn）', 400)
  }

  // 验证密码
  if (!password || typeof password !== 'string' || password.length < 6) {
    return err('密码长度不能少于 6 位', 400)
  }

  // 验证昵称
  if (!nickname || typeof nickname !== 'string') {
    return err('昵称不能为空', 400)
  }
  const trimmedNickname = nickname.trim()
  if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
    return err('昵称长度需在 2-20 字符之间', 400)
  }

  const admin = createAdminClient()

  // 检查昵称是否已存在
  const { data: existingProfile, error: checkError } = await admin
    .from('profiles')
    .select('id')
    .eq('nickname', trimmedNickname)
    .maybeSingle()

  if (checkError) {
    return err('服务器错误，请稍后重试', 500)
  }
  if (existingProfile) {
    return err('昵称已被使用，请换一个昵称', 400)
  }

  // 创建用户
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: emailLower,
    password,
    email_confirm: true,
    user_metadata: { nickname: trimmedNickname },
  })

  if (createError || !createData.user) {
    const msg = createError?.message ?? '注册失败'
    if (msg.toLowerCase().includes('already registered') || msg.includes('already exists')) {
      return err('该邮箱已注册', 400)
    }
    return err(msg, 400)
  }

  const newUser = createData.user

  // 确保 profiles 记录存在（触发器可能有延迟，手动兜底）
  const { data: existsProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', newUser.id)
    .maybeSingle()

  if (!existsProfile) {
    await admin.from('profiles').insert({
      id: newUser.id,
      email: emailLower,
      nickname: trimmedNickname,
    })
  }

  return ok(
    {
      success: true,
      message: '注册成功，请查收邮箱验证邮件',
      user: { id: newUser.id, email: newUser.email },
    },
    201
  )
}

// ----------------------------------------------------------------
// 登录
// ----------------------------------------------------------------
async function handleLogin(req: Request): Promise<Response> {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return err('请求体格式错误', 400)
  }

  const { email, password } = body

  if (!email || !password) {
    return err('邮箱和密码不能为空', 400)
  }

  const anon = createAnonClient()
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  })

  if (signInError || !signInData.session || !signInData.user) {
    return err('邮箱或密码错误', 401)
  }

  const { session, user } = signInData

  // 查询 profiles 获取用户详细信息
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, nickname, avatar_url, credit_score')
    .eq('id', user.id)
    .maybeSingle()

  return ok({
    success: true,
    message: '登录成功',
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    },
    user: {
      id: user.id,
      email: user.email,
      nickname: profile?.nickname ?? null,
      avatar_url: profile?.avatar_url ?? null,
      credit_score: profile?.credit_score ?? 100,
    },
  })
}

// ----------------------------------------------------------------
// 登出
// ----------------------------------------------------------------
async function handleLogout(req: Request): Promise<Response> {
  const [, authErr] = await requireAuth(req)
  if (authErr) return authErr

  const token = extractToken(req)
  if (!token) {
    return err('未提供认证令牌', 401)
  }

  const admin = createAdminClient()
  const { error: signOutError } = await admin.auth.admin.signOut(token)

  if (signOutError) {
    return err('登出失败，请稍后重试', 500)
  }

  return ok({ success: true, message: '已退出登录' })
}
