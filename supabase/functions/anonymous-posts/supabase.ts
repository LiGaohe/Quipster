// @ts-ignore Deno
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore Deno
const SUPABASE_URL: string = Deno.env.get('SUPABASE_URL')!
// @ts-ignore Deno
const SUPABASE_SERVICE_ROLE_KEY: string = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// @ts-ignore Deno
const SUPABASE_ANON_KEY: string = Deno.env.get('SUPABASE_ANON_KEY')!

/**
 * 管理员客户端（绕过 RLS），用于 Edge Functions 内部数据操作
 */
export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * 匿名客户端，用于触发 Supabase Auth 的注册/登录流程
 */
export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * 以用户 JWT 创建有上下文的客户端（符合 RLS）
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export { SUPABASE_URL, SUPABASE_ANON_KEY }
