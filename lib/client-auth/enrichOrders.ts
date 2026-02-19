import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface RawOrder {
  id: string
  amount_total: number | null
  amount_paid: number | null
  [key: string]: unknown
}

/**
 * Calculate amount_total from active services (matching CRM logic).
 * orders.amount_total is often 0; the real total comes from SUM(order_services.client_price).
 */
export async function enrichOrdersWithTotals<T extends RawOrder>(orders: T[]): Promise<T[]> {
  if (orders.length === 0) return orders

  const orderIds = orders.map((o) => o.id)

  const { data: services } = await supabaseAdmin
    .from('order_services')
    .select('order_id, client_price, res_status')
    .in('order_id', orderIds)
    .neq('res_status', 'cancelled')

  if (!services) return orders

  const totalsMap = new Map<string, number>()
  for (const s of services) {
    const current = totalsMap.get(s.order_id) ?? 0
    totalsMap.set(s.order_id, current + (Number(s.client_price) || 0))
  }

  return orders.map((o) => {
    const fromServices = totalsMap.get(o.id) ?? 0
    return {
      ...o,
      amount_total: fromServices > 0 ? fromServices : (Number(o.amount_total) || 0),
    }
  })
}
