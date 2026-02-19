import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_code, status, order_type,
        date_from, date_to,
        amount_total, amount_paid,
        client_display_name, countries_cities,
        created_at, updated_at
      `)
      .eq('client_party_id', client.crmClientId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[client/bookings] fetch error:', error.message)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    return Response.json({ data: orders ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
