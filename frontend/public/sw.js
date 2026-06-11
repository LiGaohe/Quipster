/**
 * Service Worker - API 缓存策略
 * 用于缓存 Supabase API 响应，减少首次访问延迟
 */

const CACHE_NAME = 'quipster-api-cache-v1'
const STATIC_CACHE_NAME = 'quipster-static-v1'

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// API 缓存策略配置
const API_CACHE_CONFIG = {
  // 健康检查 - 缓存 5 分钟
  '/functions/v1/health': {
    maxAge: 5 * 60 * 1000,
    strategy: 'cache-first',
  },
  // 用户信息 - 缓存 1 分钟
  '/functions/v1/auth/me': {
    maxAge: 60 * 1000,
    strategy: 'network-first',
  },
  // 帖子列表 - 缓存 30 秒
  '/functions/v1/posts': {
    maxAge: 30 * 1000,
    strategy: 'network-first',
  },
  // 事件列表 - 缓存 1 分钟
  '/functions/v1/events': {
    maxAge: 60 * 1000,
    strategy: 'network-first',
  },
  // 群组列表 - 缓存 2 分钟
  '/functions/v1/groups': {
    maxAge: 2 * 60 * 1000,
    strategy: 'network-first',
  },
}

// 缓存项结构
interface CacheItem {
  data: unknown
  timestamp: number
  maxAge: number
}

/**
 * 安装事件 - 缓存静态资源
 */
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  // 立即激活
  ;(self as unknown as ServiceWorkerGlobalScope).skipWaiting()
})

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  // 立即控制所有客户端
  ;(self as unknown as ServiceWorkerGlobalScope).clients.claim()
})

/**
 * 请求拦截 - 实现缓存策略
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event
  const url = new URL(request.url)

  // 仅处理 GET 请求
  if (request.method !== 'GET') {
    return
  }

  // 静态资源 - 缓存优先
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME))
    return
  }

  // API 请求 - 根据配置选择策略
  if (isAPIRequest(url.pathname)) {
    const config = getCacheConfig(url.pathname)
    if (config) {
      if (config.strategy === 'cache-first') {
        event.respondWith(cacheFirstWithExpiry(request, config.maxAge))
      } else {
        event.respondWith(networkFirstWithExpiry(request, config.maxAge))
      }
    } else {
      // 默认：网络优先，不缓存
      event.respondWith(fetch(request))
    }
    return
  }

  // 其他请求 - 网络优先
  event.respondWith(networkFirst(request))
})

/**
 * 判断是否为静态资源
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  )
}

/**
 * 判断是否为 API 请求
 */
function isAPIRequest(pathname: string): boolean {
  return pathname.startsWith('/functions/v1/')
}

/**
 * 获取缓存配置
 */
function getCacheConfig(
  pathname: string
): { maxAge: number; strategy: string } | null {
  for (const [path, config] of Object.entries(API_CACHE_CONFIG)) {
    if (pathname.startsWith(path)) {
      return config
    }
  }
  return null
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

/**
 * 带过期时间的缓存优先策略
 */
async function cacheFirstWithExpiry(
  request: Request,
  maxAge: number
): Promise<Response> {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  if (cached) {
    const cachedItem = await cached.clone().json().catch(() => null)
    if (cachedItem && isCacheValid(cachedItem, maxAge)) {
      return cached
    }
  }

  const response = await fetch(request)
  if (response.ok) {
    const cacheItem: CacheItem = {
      data: await response.clone().json(),
      timestamp: Date.now(),
      maxAge,
    }
    const cacheResponse = new Response(JSON.stringify(cacheItem), {
      headers: { 'Content-Type': 'application/json' },
    })
    cache.put(request, cacheResponse)
  }
  return response
}

/**
 * 带过期时间的网络优先策略
 */
async function networkFirstWithExpiry(
  request: Request,
  maxAge: number
): Promise<Response> {
  const cache = await caches.open(CACHE_NAME)

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cacheItem: CacheItem = {
        data: await response.clone().json(),
        timestamp: Date.now(),
        maxAge,
      }
      const cacheResponse = new Response(JSON.stringify(cacheItem), {
        headers: { 'Content-Type': 'application/json' },
      })
      cache.put(request, cacheResponse)
    }
    return response
  } catch (error) {
    // 网络失败，尝试使用缓存
    const cached = await cache.match(request)
    if (cached) {
      const cachedItem = await cached.clone().json().catch(() => null)
      if (cachedItem && isCacheValid(cachedItem, maxAge)) {
        return new Response(JSON.stringify(cachedItem.data), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    throw error
  }
}

/**
 * 网络优先策略
 */
async function networkFirst(request: Request): Promise<Response> {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw new Error('Network failed and no cache available')
  }
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(cachedItem: CacheItem, maxAge: number): boolean {
  return Date.now() - cachedItem.timestamp < maxAge
}

// TypeScript 类型声明
declare const self: ServiceWorkerGlobalScope

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}

interface FetchEvent extends Event {
  request: Request
  respondWith(response: Promise<Response> | Response): void
}