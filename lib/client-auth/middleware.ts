import { NextRequest } from 'next/server'
import { verifyAccessToken, verifyRefreshToken, hashToken, ClientTokenPayload } from './jwt'
import { CLIENT_ACCESS_COOKIE, CLIENT_REFRESH_COOKIE } from './web-session'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function getAuthenticatedClient(req: NextRequest): Promise<ClientTokenPayload> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      return await verifyAccessToken(token)
    } catch {
      throw new Error('UNAUTHORIZED')
    }
  }

  const accessCookie = req.cookies.get(CLIENT_ACCESS_COOKIE)?.value
  if (accessCookie) {
    try {
      const decoded = decodeURIComponent(accessCookie)
      return await verifyAccessToken(decoded)
    } catch {
      throw new Error('UNAUTHORIZED')
    }
  }

  throw new Error('UNAUTHORIZED')
}

/**
 * Logout: allow access Bearer/cookie, or valid refresh cookie (access may be expired in browser).
 */
export async function getAuthenticatedClientForLogout(req: NextRequest): Promise<ClientTokenPayload> {
  try {
    return await getAuthenticatedClient(req)
  } catch {
    const raw = req.cookies.get(CLIENT_REFRESH_COOKIE)?.value
    if (!raw) throw new Error('UNAUTHORIZED')
    const refreshToken = decodeURIComponent(raw)
    let payload: ClientTokenPayload
    try {
      payload = await verifyRefreshToken(refreshToken)
    } catch {
      throw new Error('UNAUTHORIZED')
    }
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('refresh_token_hash')
      .eq('id', payload.clientId)
      .single()
    if (!profile || profile.refresh_token_hash !== hashToken(refreshToken)) {
      throw new Error('UNAUTHORIZED')
    }
    return payload
  }
}

export function unauthorizedResponse(): Response {
  return Response.json({ data: null, error: 'Unauthorized' }, { status: 401 })
}
