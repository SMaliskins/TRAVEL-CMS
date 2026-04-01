import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const { data: notifications, error } = await supabaseAdmin
      .from('client_notifications')
      .select('id, title, body, type, ref_id, read, created_at')
      .eq('client_id', client.clientId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return Response.json({ data: null, error: error.message }, { status: 500 })
    }

    const { count } = await supabaseAdmin
      .from('client_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.clientId)
      .eq('read', false)

    return Response.json({
      data: notifications ?? [],
      unreadCount: count ?? 0,
      error: null,
    })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    return Response.json({ data: null, error: 'Internal error' }, { status: 500 })
  }
}
