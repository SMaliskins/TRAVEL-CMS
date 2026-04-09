import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CLIENT_REFRESH_COOKIE } from '@/lib/client-auth/web-session'
import { verifyRefreshTokenForMiddleware } from '@/lib/client-auth/refresh-verify'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/referral')) {
    return NextResponse.next()
  }

  const referralPublicPaths = new Set([
    '/referral/login',
    '/referral/forgot-password',
    '/referral/reset-password',
  ])
  if (referralPublicPaths.has(pathname)) {
    return NextResponse.next()
  }

  const raw = request.cookies.get(CLIENT_REFRESH_COOKIE)?.value
  if (!raw) {
    return NextResponse.redirect(new URL('/referral/login', request.url))
  }

  try {
    const token = decodeURIComponent(raw)
    await verifyRefreshTokenForMiddleware(token)
  } catch {
    return NextResponse.redirect(new URL('/referral/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/referral', '/referral/:path*'],
}
