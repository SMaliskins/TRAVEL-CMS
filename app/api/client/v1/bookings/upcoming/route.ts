import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

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
      .gte('date_from', today)
      .order('date_from', { ascending: true })

    if (error) {
      console.error('[client/bookings/upcoming] fetch error:', error.message)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    return Response.json({ data: orders ?? [], error: null })
  } catch {
    return unauthorizedResponse()
  }
}
