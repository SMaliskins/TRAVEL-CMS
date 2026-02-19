import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { signAccessToken, signRefreshToken, hashToken } from '@/lib/client-auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const email = body.email.toLowerCase().trim()

    // Find CRM party by email
    const { data: party } = await supabaseAdmin
      .from('party')
      .select('id, email')
      .eq('email', email)
      .single()

    if (!party) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    // Find client profile
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, password_hash')
      .eq('crm_client_id', party.id)
      .single()

    if (!profile) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(body.password, profile.password_hash)
    if (!valid) {
      return Response.json({ data: null, error: 'Invalid credentials' }, { status: 401 })
    }

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

    return Response.json({ data: { accessToken, refreshToken, clientId: profile.id }, error: null })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
