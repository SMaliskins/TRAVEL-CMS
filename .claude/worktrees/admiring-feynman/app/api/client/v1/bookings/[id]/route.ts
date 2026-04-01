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
        supplier_name, ref_nr, ticket_nr,
        flight_segments, cabin_class, ticket_numbers,
        boarding_passes, hotel_board, hotel_room, hotel_bed_type,
        hotel_name, hotel_star_rating,
        transfer_type, pickup_location, dropoff_location, pickup_time,
        payment_deadline_deposit, payment_deadline_final,
        split_group_id
      `)
      .eq('order_id', id)
      .neq('res_status', 'cancelled')
      .order('service_date_from', { ascending: true })

    const svcList = services ?? []

    const serviceIds = svcList.map((s) => s.id)
    let travellerMap: Record<string, string[]> = {}
    let travellerNameMap: Record<string, string> = {}

    if (serviceIds.length > 0) {
      const { data: st } = await supabaseAdmin
        .from('order_service_travellers')
        .select('service_id, traveller_id')
        .in('service_id', serviceIds)
      if (st) {
        travellerMap = st.reduce((acc, r) => {
          if (!acc[r.service_id]) acc[r.service_id] = []
          acc[r.service_id].push(r.traveller_id)
          return acc
        }, {} as Record<string, string[]>)
      }

      const allTravellerIds = [...new Set(Object.values(travellerMap).flat())]
      if (allTravellerIds.length > 0) {
        const { data: parties } = await supabaseAdmin
          .from('party')
          .select('id, last_name, first_name')
          .in('id', allTravellerIds)
        if (parties) {
          for (const p of parties) {
            travellerNameMap[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
          }
        }
      }
    }

    const enrichedServices = svcList.map((s) => ({
      ...s,
      traveller_ids: travellerMap[s.id] ?? [],
      traveller_names: (travellerMap[s.id] ?? [])
        .map((tid: string) => travellerNameMap[tid])
        .filter(Boolean),
    }))

    const amountTotal = enrichedServices.reduce(
      (sum, s) => sum + (Number(s.client_price) || 0), 0
    )
    const amountPaid = Number(order.amount_paid) || 0
    const amountDebt = Math.max(0, amountTotal - amountPaid)

    const deposits = enrichedServices
      .map((s) => s.payment_deadline_deposit)
      .filter(Boolean)
      .sort()
    const finals = enrichedServices
      .map((s) => s.payment_deadline_final)
      .filter(Boolean)
      .sort()

    const today = new Date().toISOString().split('T')[0]
    let overdueDays = 0
    const earliestDue = deposits[0] || finals[0]
    if (earliestDue && earliestDue < today && amountDebt > 0) {
      const diff = new Date(today).getTime() - new Date(earliestDue).getTime()
      overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
    }

    return Response.json({
      data: {
        ...order,
        amount_total: amountTotal,
        amount_paid: amountPaid,
        amount_debt: amountDebt,
        payment_dates: {
          deposit: deposits[0] ?? null,
          final: finals[0] ?? null,
        },
        overdue_days: overdueDays,
        services: enrichedServices,
      },
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
