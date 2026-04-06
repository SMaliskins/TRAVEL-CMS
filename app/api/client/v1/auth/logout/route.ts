import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClientForLogout, unauthorizedResponse } from '@/lib/client-auth/middleware'
import {
  assertSameOriginForWebSession,
  clearClientSessionCookieHeaders,
  CLIENT_ACCESS_COOKIE,
  CLIENT_REFRESH_COOKIE,
} from '@/lib/client-auth/web-session'

export async function POST(req: NextRequest) {
  try {
    const hasSessionCookie =
      Boolean(req.cookies.get(CLIENT_ACCESS_COOKIE)?.value) ||
      Boolean(req.cookies.get(CLIENT_REFRESH_COOKIE)?.value)

    let client
    try {
      client = await getAuthenticatedClientForLogout(req)
    } catch {
      return unauthorizedResponse()
    }

    if (hasSessionCookie) {
      try {
        assertSameOriginForWebSession(req)
      } catch {
        return Response.json({ data: null, error: 'FORBIDDEN' }, { status: 403 })
      }
    }

    // Invalidate refresh token by clearing hash
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: null })
      .eq('id', client.clientId)

    const res = Response.json({ data: { success: true }, error: null })
    for (const c of clearClientSessionCookieHeaders()) {
      res.headers.append('Set-Cookie', c)
    }
    return res
  } catch {
    return unauthorizedResponse()
  }
}
