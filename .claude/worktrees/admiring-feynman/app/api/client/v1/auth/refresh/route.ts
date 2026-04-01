import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyRefreshToken, signAccessToken, signRefreshToken, hashToken } from '@/lib/client-auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.refreshToken !== 'string') {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Verify JWT signature first
    let payload: { clientId: string; crmClientId: string; sub: string }
    try {
      payload = await verifyRefreshToken(body.refreshToken)
    } catch {
      return Response.json({ data: null, error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Verify token hash matches DB (detect token reuse attacks)
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, refresh_token_hash')
      .eq('id', payload.clientId)
      .single()

    if (!profile || profile.refresh_token_hash !== hashToken(body.refreshToken)) {
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

    return Response.json({ data: { accessToken: newAccessToken, refreshToken: newRefreshToken }, error: null })
  } catch (err) {
    console.error('Refresh error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
