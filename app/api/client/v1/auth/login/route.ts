import { NextRequest } from 'next/server'
import { supabaseAdmin, isServiceRoleKeySet } from '@/lib/supabaseAdmin'
import { authenticateReferralPortalCredentials } from '@/lib/client-auth/resolvePartyForReferralLogin'
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  isClientJwtConfiguredForProduction,
} from '@/lib/client-auth/jwt'
import {
  assertSameOriginForWebSession,
  serializeClientCookie,
  shouldSetWebSessionCookies,
  ACCESS_MAX_AGE_SEC,
  REFRESH_MAX_AGE_SEC,
  CLIENT_ACCESS_COOKIE,
  CLIENT_REFRESH_COOKIE,
} from '@/lib/client-auth/web-session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    if (process.env.NODE_ENV === 'production') {
      if (!isServiceRoleKeySet() || !isClientJwtConfiguredForProduction()) {
        return Response.json({ data: null, error: 'LOGIN_SERVER_MISCONFIGURED' }, { status: 503 })
      }
    }

    const auth = await authenticateReferralPortalCredentials(
      supabaseAdmin,
      body.email,
      body.password
    )
    if (!auth) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    const profile = { id: auth.profileId, crm_client_id: auth.crmClientId }

    // Issue tokens
    const tokenPayload = { clientId: profile.id, crmClientId: profile.crm_client_id, sub: profile.id }
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    // Store refresh token hash + update last login
    await supabaseAdmin
      .from('client_profiles')
      .update({
        refresh_token_hash: hashToken(refreshToken),
        last_login_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    const res = Response.json({ data: { accessToken, refreshToken, clientId: profile.id }, error: null })

    if (shouldSetWebSessionCookies(req)) {
      try {
        assertSameOriginForWebSession(req)
      } catch {
        return Response.json({ data: null, error: 'FORBIDDEN' }, { status: 403 })
      }
      res.headers.append('Set-Cookie', serializeClientCookie(CLIENT_ACCESS_COOKIE, accessToken, ACCESS_MAX_AGE_SEC))
      res.headers.append('Set-Cookie', serializeClientCookie(CLIENT_REFRESH_COOKIE, refreshToken, REFRESH_MAX_AGE_SEC))
    }

    return res
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
