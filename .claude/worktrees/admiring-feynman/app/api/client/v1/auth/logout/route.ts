import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    // Invalidate refresh token by clearing hash
    await supabaseAdmin
      .from('client_profiles')
      .update({ refresh_token_hash: null })
      .eq('id', client.clientId)

    return Response.json({ data: { success: true }, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
