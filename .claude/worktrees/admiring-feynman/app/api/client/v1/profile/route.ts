import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { toTitleCaseForDisplay } from '@/utils/nameFormat'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const { data: profile, error } = await supabaseAdmin
      .from('client_profiles')
      .select('id, crm_client_id, avatar_url, referral_code, invited_by_agent_id, created_at, last_login_at')
      .eq('id', client.clientId)
      .single()

    if (error || !profile) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    // party table has: id, display_name, party_type, email, phone (no first_name/last_name)
    const { data: party } = await supabaseAdmin
      .from('party')
      .select('id, display_name, email, phone')
      .eq('id', profile.crm_client_id)
      .single()

    return Response.json({
      data: {
        id: profile.id,
        displayName: party?.display_name ?? null,
        email: party?.email ?? null,
        phone: party?.phone ?? null,
        avatarUrl: profile.avatar_url,
        referralCode: profile.referral_code,
        invitedByAgentId: profile.invited_by_agent_id,
        createdAt: profile.created_at,
        lastLoginAt: profile.last_login_at,
      },
      error: null,
    })
  } catch {
    return unauthorizedResponse()
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Fields allowed to update in client_profiles
    const profileUpdates: Record<string, unknown> = {}
    if (typeof body.avatarUrl === 'string') profileUpdates.avatar_url = body.avatarUrl
    if (typeof body.notificationToken === 'string') profileUpdates.notification_token = body.notificationToken

    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin
        .from('client_profiles')
        .update(profileUpdates)
        .eq('id', client.clientId)
    }

    // Fields allowed to update in party table (display_name, phone only)
    // Standard format: first letter of each name part uppercase, rest lowercase
    const partyUpdates: Record<string, unknown> = {}
    if (typeof body.displayName === 'string') partyUpdates.display_name = toTitleCaseForDisplay(body.displayName)
    if (typeof body.phone === 'string') partyUpdates.phone = body.phone

    if (Object.keys(partyUpdates).length > 0) {
      const { data: profile } = await supabaseAdmin
        .from('client_profiles')
        .select('crm_client_id')
        .eq('id', client.clientId)
        .single()

      if (profile) {
        await supabaseAdmin
          .from('party')
          .update(partyUpdates)
          .eq('id', profile.crm_client_id)
      }
    }

    return Response.json({ data: { success: true }, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
