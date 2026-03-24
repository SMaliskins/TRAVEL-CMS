import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

function addAmounts(
  target: Record<string, number>,
  rows: { currency: string | null; commission_amount: string | number | null }[] | null
) {
  for (const r of rows || []) {
    const c = (r.currency || 'EUR').toUpperCase()
    target[c] = (target[c] || 0) + Number(r.commission_amount ?? 0)
  }
}

function addSettlementAmounts(
  target: Record<string, number>,
  rows: { currency: string | null; amount: string | number | null }[] | null
) {
  for (const r of rows || []) {
    const c = (r.currency || 'EUR').toUpperCase()
    target[c] = (target[c] || 0) + Number(r.amount ?? 0)
  }
}

function availableByCurrency(accrued: Record<string, number>, settled: Record<string, number>) {
  const keys = new Set([...Object.keys(accrued), ...Object.keys(settled)])
  const out: Record<string, number> = {}
  for (const k of keys) {
    out[k] = (accrued[k] || 0) - (settled[k] || 0)
  }
  return out
}

/**
 * Referral commission overview for the mobile client app.
 * Requires client_party.show_referral_in_app for the logged-in party.
 */
export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('client_profiles')
      .select('crm_client_id')
      .eq('id', client.clientId)
      .single()

    if (profileErr || !profile) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    const partyId = profile.crm_client_id as string

    const { data: cp } = await supabaseAdmin
      .from('client_party')
      .select('show_referral_in_app')
      .eq('party_id', partyId)
      .maybeSingle()

    if (!cp?.show_referral_in_app) {
      return Response.json({ data: null, error: 'REFERRAL_APP_DISABLED' }, { status: 403 })
    }

    const { data: party, error: partyErr } = await supabaseAdmin
      .from('party')
      .select('id, company_id')
      .eq('id', partyId)
      .single()

    if (partyErr || !party) {
      return Response.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    const companyId = party.company_id as string

    const { data: refMeta } = await supabaseAdmin
      .from('referral_party')
      .select('party_id, default_currency, is_active')
      .eq('party_id', partyId)
      .eq('company_id', companyId)
      .maybeSingle()

    const [plannedRes, accruedRes, settledRes, linesRes, recentSettlements] = await Promise.all([
      supabaseAdmin
        .from('referral_accrual_line')
        .select('currency, commission_amount')
        .eq('referral_party_id', partyId)
        .eq('company_id', companyId)
        .eq('status', 'planned'),
      supabaseAdmin
        .from('referral_accrual_line')
        .select('currency, commission_amount')
        .eq('referral_party_id', partyId)
        .eq('company_id', companyId)
        .eq('status', 'accrued'),
      supabaseAdmin
        .from('referral_settlement_entry')
        .select('currency, amount')
        .eq('referral_party_id', partyId)
        .eq('company_id', companyId),
      supabaseAdmin
        .from('referral_accrual_line')
        .select('id, commission_amount, currency, status, created_at, base_amount, order_id')
        .eq('referral_party_id', partyId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(75),
      supabaseAdmin
        .from('referral_settlement_entry')
        .select('id, amount, currency, note, entry_date, created_at')
        .eq('referral_party_id', partyId)
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const plannedByCurrency: Record<string, number> = {}
    const accruedByCurrency: Record<string, number> = {}
    const settledByCurrency: Record<string, number> = {}

    addAmounts(plannedByCurrency, plannedRes.error ? null : plannedRes.data)
    addAmounts(accruedByCurrency, accruedRes.error ? null : accruedRes.data)
    addSettlementAmounts(settledByCurrency, settledRes.error ? null : settledRes.data)

    const rawLines = linesRes.error ? [] : linesRes.data || []
    const orderIds = [...new Set(rawLines.map((l) => l.order_id).filter(Boolean))] as string[]
    let orderCodeById: Record<string, string> = {}
    if (orderIds.length > 0) {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, order_code')
        .eq('company_id', companyId)
        .in('id', orderIds)
      for (const o of orders || []) {
        orderCodeById[o.id as string] = String(o.order_code ?? '')
      }
    }

    const lines = rawLines.map((l) => ({
      id: l.id,
      commissionAmount: Number(l.commission_amount ?? 0),
      currency: (l.currency || 'EUR').toUpperCase(),
      status: l.status,
      createdAt: l.created_at,
      baseAmount: Number(l.base_amount ?? 0),
      orderCode: l.order_id ? orderCodeById[l.order_id as string] || null : null,
    }))

    const settlements = (recentSettlements.error ? [] : recentSettlements.data || []).map((s) => ({
      id: s.id,
      amount: Number(s.amount ?? 0),
      currency: (s.currency || 'EUR').toUpperCase(),
      note: s.note,
      entryDate: s.entry_date,
      createdAt: s.created_at,
    }))

    return Response.json({
      data: {
        hasReferralRole: !!refMeta,
        referralActive: refMeta?.is_active !== false,
        defaultCurrency: refMeta?.default_currency || 'EUR',
        plannedByCurrency,
        accruedByCurrency,
        settledByCurrency,
        availableByCurrency: availableByCurrency(accruedByCurrency, settledByCurrency),
        lines,
        settlements,
      },
      error: null,
    })
  } catch {
    return unauthorizedResponse()
  }
}
