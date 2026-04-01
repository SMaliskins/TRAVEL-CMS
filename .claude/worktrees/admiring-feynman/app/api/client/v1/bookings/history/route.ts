import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { enrichOrdersWithTotals } from '@/lib/client-auth/enrichOrders'

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const today = new Date().toISOString().split('T')[0]

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
      .lt('date_to', today)
      .order('date_to', { ascending: false })

    if (error) {
      console.error('[client/bookings/history] fetch error:', error.message)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const enriched = await enrichOrdersWithTotals(orders ?? [])
    return Response.json({ data: enriched, error: null })
  } catch {
    return unauthorizedResponse()
  }
}
