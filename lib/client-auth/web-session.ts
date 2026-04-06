import type { NextRequest } from 'next/server'

/** Web referral PWA: httpOnly cookies (same-origin only). Mobile app ignores these and uses JSON tokens. */
export const CLIENT_ACCESS_COOKIE = 'client_at'
export const CLIENT_REFRESH_COOKIE = 'client_rt'

export const ACCESS_MAX_AGE_SEC = 15 * 60 // align with JWT access TTL
export const REFRESH_MAX_AGE_SEC = 30 * 24 * 60 * 60 // 30d

function cookieBaseAttrs(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `; Path=/; HttpOnly; SameSite=Lax${secure}`
}

/** Serialize one Set-Cookie value (token may contain = so we encode) */
export function serializeClientCookie(name: string, value: string, maxAgeSec: number): string {
  const v = encodeURIComponent(value)
  return `${name}=${v}; Max-Age=${maxAgeSec}${cookieBaseAttrs()}`
}

export function clearClientSessionCookieHeaders(): string[] {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const dead = 'Max-Age=0; Path=/; HttpOnly; SameSite=Lax' + secure
  return [
    `${CLIENT_ACCESS_COOKIE}=; ${dead}`,
    `${CLIENT_REFRESH_COOKIE}=; ${dead}`,
  ]
}

/**
 * Browser referral flow: set access + refresh as httpOnly so API routes can read Authorization-equivalent from cookies.
 * Header X-Client-Channel: web-referral — or ?sessionCookie=1 on POST URL.
 */
export function shouldSetWebSessionCookies(req: NextRequest): boolean {
  const h = req.headers.get('x-client-channel')?.toLowerCase().trim()
  if (h === 'web-referral') return true
  const q = req.nextUrl.searchParams.get('sessionCookie')
  if (q === '1' || q === 'true') return true
  return false
}

/**
 * State-changing requests from the browser with cookies should come from same origin (CSRF).
 * Skips when no Origin (e.g. some server-side calls) — those typically don't send session cookies.
 */
function sameOriginAllowingLoopbackAliases(a: string, b: string): boolean {
  if (a === b) return true
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    if (ua.origin === ub.origin) return true
    const loop = new Set(['localhost', '127.0.0.1'])
    if (
      ua.protocol === ub.protocol &&
      ua.port === ub.port &&
      loop.has(ua.hostname) &&
      loop.has(ub.hostname)
    ) {
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function assertSameOriginForWebSession(req: NextRequest): void {
  const origin = req.headers.get('origin')
  if (!origin) return
  if (!sameOriginAllowingLoopbackAliases(origin, req.nextUrl.origin)) {
    throw new Error('CSRF_ORIGIN')
  }
}
