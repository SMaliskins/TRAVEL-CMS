import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  verifyInvitationToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
} from '@/lib/client-auth/jwt'

function validateBody(body: unknown): { invitationToken: string; password: string } | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.invitationToken !== 'string') return null
  if (typeof b.password !== 'string') return null
  if (b.password.length < 8) return null
  return { invitationToken: b.invitationToken, password: b.password }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const input = validateBody(body)
    if (!input) {
      return Response.json(
        { data: null, error: 'VALIDATION_ERROR: invitationToken and password (min 8 chars) required' },
        { status: 400 }
      )
    }

    // Verify invitation token
    let invitation: { crmClientId: string; agentId: string; type: string }
    try {
      invitation = await verifyInvitationToken(input.invitationToken)
    } catch {
      return Response.json({ data: null, error: 'Invalid or expired invitation token' }, { status: 400 })
    }

    if (invitation.type !== 'invitation') {
      return Response.json({ data: null, error: 'Invalid token type' }, { status: 400 })
    }

    // Check if already registered
    const { data: existing } = await supabaseAdmin
      .from('client_profiles')
      .select('id')
      .eq('crm_client_id', invitation.crmClientId)
      .single()

    if (existing) {
      return Response.json({ data: null, error: 'Client already registered' }, { status: 409 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, 12)

    // Create initial refresh token hash placeholder
    const initialRefreshToken = crypto.randomUUID()
    const initialRefreshTokenHash = hashToken(initialRefreshToken)

    // Create client profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('client_profiles')
      .insert({
        crm_client_id: invitation.crmClientId,
        password_hash: passwordHash,
        refresh_token_hash: initialRefreshTokenHash,
        invited_by_agent_id: invitation.agentId || null,
      })
      .select('id, crm_client_id')
      .single()

    if (profileError || !profile) {
      console.error('Failed to create client profile:', profileError)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    // Issue tokens
    const tokenPayload = {
      clientId: profile.id as string,
      crmClientId: profile.crm_client_id as string,
      sub: profile.id as string,
    }
    const [accessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ])

    // Store hashed refresh token and set last_login_at
    await supabaseAdmin
      .from('client_profiles')
      .update({
        refresh_token_hash: hashToken(newRefreshToken),
        last_login_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    return Response.json(
      { data: { accessToken, refreshToken: newRefreshToken, clientId: profile.id }, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('Register error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
