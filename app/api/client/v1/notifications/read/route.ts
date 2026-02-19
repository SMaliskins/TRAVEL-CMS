import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    if (body.all === true) {
      await supabaseAdmin
        .from('client_notifications')
        .update({ read: true })
        .eq('client_id', client.clientId)
        .eq('read', false)
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      await supabaseAdmin
        .from('client_notifications')
        .update({ read: true })
        .eq('client_id', client.clientId)
        .in('id', body.ids)
    } else {
      return Response.json({ data: null, error: 'Provide { all: true } or { ids: [...] }' }, { status: 400 })
    }

    return Response.json({ data: { success: true }, error: null })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    return Response.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
