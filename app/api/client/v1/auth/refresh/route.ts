import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyRefreshToken, signAccessToken, signRefreshToken, hashToken } from '@/lib/client-auth/jwt'
import {
  assertSameOriginForWebSession,
  serializeClientCookie,
  ACCESS_MAX_AGE_SEC,
  REFRESH_MAX_AGE_SEC,
  CLIENT_ACCESS_COOKIE,
  CLIENT_REFRESH_COOKIE,
} from '@/lib/client-auth/web-session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const fromBody = body && typeof body.refreshToken === 'string' ? body.refreshToken : null
    const rawCookie = req.cookies.get(CLIENT_REFRESH_COOKIE)?.value
    const fromCookie = rawCookie ? decodeURIComponent(rawCookie) : null

    const refreshToken = fromBody ?? fromCookie
    if (!refreshToken) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    if (fromCookie && !fromBody) {
      try {
        assertSameOriginForWebSession(req)
      } catch {
        return Response.json({ data: null, error: 'FORBIDDEN' }, { status: 403 })
      }
    }

    // Verify JWT signature first
    let payload: { clientId: string; crmClientId: string; sub: string }
    try {
      payload = await verifyRefreshToken(refreshToken)
    } catch {
      return Response.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Verify token hash matches DB (detect token reuse attacks)
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, refresh_token_hash')
      .eq('id', payload.clientId)
      .single()

    if (!profile || profile.refresh_token_hash !== hashToken(refreshToken)) {
      return Response.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Issue new token pair (rotation — invalidates old refresh token)
    const tokenPayload = { clientId: profile.id, crmClientId: profile.crm_client_id, sub: profile.id }
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    // Store new refresh token hash (invalidates old one)
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: hashToken(newRefreshToken) })
      .eq('id', profile.id)

    const res = Response.json({ data: { accessToken: newAccessToken, refreshToken: newRefreshToken }, error: null })

    if (fromCookie) {
      res.headers.append('Set-Cookie', serializeClientCookie(CLIENT_ACCESS_COOKIE, newAccessToken, ACCESS_MAX_AGE_SEC))
      res.headers.append('Set-Cookie', serializeClientCookie(CLIENT_REFRESH_COOKIE, newRefreshToken, REFRESH_MAX_AGE_SEC))
    }

    return res
  } catch (err) {
    console.error('Refresh error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
