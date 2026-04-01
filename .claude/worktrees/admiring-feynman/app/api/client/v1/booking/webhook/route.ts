import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  createBookingForm,
  startBooking,
  checkBookingStatus,
} from '@/lib/ratehawk/client'

let _stripe: Stripe | null = null
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-18.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!
}

async function finalizeRateHawkBooking(bookingId: string) {
  const { data: booking } = await supabaseAdmin
    .from('concierge_booking_requests')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking || !booking.book_hash || !booking.partner_order_id) {
    console.error(`Booking ${bookingId}: missing book_hash or partner_order_id`)
    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({ status: 'booking_failed', error_message: 'Missing book_hash or partner_order_id' })
      .eq('id', bookingId)
    return
  }

  const keyId = process.env.RATEHAWK_KEY_ID
  const apiKey = process.env.RATEHAWK_API_KEY
  if (!keyId || !apiKey) {
    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({ status: 'booking_failed', error_message: 'RateHawk API not configured' })
      .eq('id', bookingId)
    return
  }

  try {
    const form = await createBookingForm(
      booking.book_hash,
      booking.partner_order_id,
      '127.0.0.1',
      keyId,
      apiKey
    )

    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({ ratehawk_order_id: form.orderId })
      .eq('id', bookingId)

    await startBooking(
      {
        partnerOrderId: booking.partner_order_id,
        guestFirstName: booking.guest_first_name || 'Guest',
        guestLastName: booking.guest_last_name || 'Guest',
        guestEmail: booking.guest_email || 'guest@mytravelconcierge.com',
        guestPhone: booking.guest_phone || '+37100000000',
        paymentType: form.paymentType,
        paymentAmount: form.amount,
        paymentCurrency: form.currencyCode,
      },
      keyId,
      apiKey
    )

    let confirmed = false
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 3000))
      const status = await checkBookingStatus(booking.partner_order_id, keyId, apiKey)

      if (status.status === 'ok') {
        await supabaseAdmin
          .from('concierge_booking_requests')
          .update({
            status: 'booking_confirmed',
            error_message: null,
          })
          .eq('id', bookingId)

        await createOrderService(booking, status.confirmationNumber)
        confirmed = true
        break
      }

      if (status.status === 'error') {
        await supabaseAdmin
          .from('concierge_booking_requests')
          .update({
            status: 'booking_failed',
            error_message: status.errorMessage ?? 'RateHawk booking failed',
          })
          .eq('id', bookingId)
        return
      }
    }

    if (!confirmed) {
      await supabaseAdmin
        .from('concierge_booking_requests')
        .update({
          status: 'booking_failed',
          error_message: 'Booking confirmation timed out after 30s',
        })
        .eq('id', bookingId)
    }
  } catch (err) {
    console.error(`Booking ${bookingId} RateHawk error:`, err)
    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({
        status: 'booking_failed',
        error_message: err instanceof Error ? err.message : 'Unknown RateHawk error',
      })
      .eq('id', bookingId)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createOrderService(booking: any, confirmationNumber?: string) {
  const { data: profile } = await supabaseAdmin
    .from('client_profiles')
    .select('crm_client_id')
    .eq('id', booking.client_id)
    .single()

  if (!profile?.crm_client_id) return

  const { data: party } = await supabaseAdmin
    .from('party')
    .select('company_id')
    .eq('id', profile.crm_client_id)
    .single()

  const { data: existingOrder } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('client_party_id', profile.crm_client_id)
    .gte('date_from', booking.check_in)
    .lte('date_from', booking.check_out)
    .limit(1)
    .single()

  let orderId = existingOrder?.id

  if (!orderId) {
    const { data: newOrder } = await supabaseAdmin
      .from('orders')
      .insert({
        client_party_id: profile.crm_client_id,
        company_id: party?.company_id ?? booking.company_id,
        status: 'confirmed',
        date_from: booking.check_in,
        date_to: booking.check_out,
        countries_cities: booking.hotel_address ?? 'Hotel booking',
        source: 'concierge',
      })
      .select('id')
      .single()
    orderId = newOrder?.id
  }

  if (!orderId) return

  await supabaseAdmin.from('order_services').insert({
    order_id: orderId,
    company_id: party?.company_id ?? booking.company_id,
    category: 'accommodation',
    service_name: `${booking.hotel_name} — ${booking.room_name ?? 'Room'}`,
    service_date_from: booking.check_in,
    service_date_to: booking.check_out,
    hotel_name: booking.hotel_name,
    hotel_star_rating: booking.hotel_stars,
    hotel_room: booking.room_name,
    hotel_board: booking.meal,
    supplier_name: 'RateHawk',
    ref_nr: confirmationNumber ?? booking.partner_order_id,
    res_status: 'confirmed',
    purchase_price: booking.ratehawk_amount,
    purchase_currency: booking.ratehawk_currency,
    sell_price: booking.client_amount,
    sell_currency: booking.client_currency,
    source: 'concierge',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return Response.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, getWebhookSecret())
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.payment_status === 'paid') {
      const bookingRequestId = session.metadata?.booking_request_id

      if (bookingRequestId) {
        await supabaseAdmin
          .from('concierge_booking_requests')
          .update({
            status: 'paid',
            stripe_payment_intent_id: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          })
          .eq('id', bookingRequestId)

        finalizeRateHawkBooking(bookingRequestId).catch((err) => {
          console.error('Background RateHawk booking failed:', err)
        })
      }
    }
  }

  return Response.json({ received: true })
}
