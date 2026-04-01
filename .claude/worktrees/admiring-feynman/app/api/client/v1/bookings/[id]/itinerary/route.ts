import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const client = await getAuthenticatedClient(req)
    const { id } = await params

    // Verify ownership
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('client_party_id', client.crmClientId)
      .single()

    if (orderError || !order) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    const { data: services, error } = await supabaseAdmin
      .from('order_services')
      .select(`
        id, category, service_name,
        service_date_from, service_date_to,
        res_status, client_price,
        supplier_name, ref_nr, ticket_nr,
        flight_segments, cabin_class, baggage
      `)
      .eq('order_id', id)
      .order('service_date_from', { ascending: true })

    if (error) {
      console.error('[client/bookings/itinerary] fetch error:', error.message)
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    return Response.json({ data: services ?? [], error: null })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Bookings error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
