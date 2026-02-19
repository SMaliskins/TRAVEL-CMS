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

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, order_code, status, order_type,
        date_from, date_to,
        amount_total, amount_paid,
        client_display_name, countries_cities,
        created_at, updated_at
      `)
      .eq('id', id)
      .eq('client_party_id', client.crmClientId)
      .single()

    if (error || !order) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    const { data: services } = await supabaseAdmin
      .from('order_services')
      .select(`
        id, category, service_name,
        service_date_from, service_date_to,
        res_status, client_price,
        supplier_name, ref_nr
      `)
      .eq('order_id', id)
      .neq('res_status', 'cancelled')
      .order('service_date_from', { ascending: true })

    return Response.json({
      data: { ...order, services: services ?? [] },
      error: null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Bookings error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
