/**
 * Service Worker 注册工具
 * 用于缓存 API 响应，减少重复请求延迟
 */

const SW_URL = '/sw.js'
const SW_SCOPE = '/'

/**
 * 注册 Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // 仅在生产环境且支持 Service Worker 时注册
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  // 仅在 HTTPS 或 localhost 下注册
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
  if (!isSecure) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: SW_SCOPE,
    })

    // 检查更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新版本已安装，提示用户刷新
            console.log('新版本已就绪，刷新页面以更新')
          }
        })
      }
    })

    return registration
  } catch (error) {
    console.error('Service Worker 注册失败:', error)
    return null
  }
}

/**
 * 注销 Service Worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.unregister()
      return true
    }
    return false
  } catch (error) {
    console.error('Service Worker 注销失败:', error)
    return false
  }
}

/**
 * 检查 Service Worker 状态
 */
export async function checkServiceWorkerStatus(): Promise<{
  supported: boolean
  registered: boolean
  controlled: boolean
}> {
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator

  if (!supported) {
    return { supported: false, registered: false, controlled: false }
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      supported: true,
      registered: !!registration,
      controlled: !!navigator.serviceWorker.controller,
    }
  } catch {
    return { supported: true, registered: false, controlled: false }
  }
}