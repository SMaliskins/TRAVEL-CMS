import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

let _stripe: Stripe | null = null
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-18.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

export async function GET(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const requestId = req.nextUrl.searchParams.get('request_id')
    if (!requestId) {
      return Response.json({ data: null, error: 'Missing request_id' }, { status: 400 })
    }

    const { data: booking } = await supabaseAdmin
      .from('concierge_booking_requests')
      .select('*')
      .eq('partner_order_id', requestId)
      .eq('client_id', client.clientId)
      .single()

    if (!booking) {
      return Response.json({ data: null, error: 'Booking request not found' }, { status: 404 })
    }

    if (booking.stripe_checkout_session_id) {
      return Response.json({
        data: { checkoutUrl: null, message: 'Payment session already created' },
        error: null,
      })
    }

    const nights = Math.max(
      1,
      Math.ceil(
        (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    )

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (booking.client_currency || 'EUR').toLowerCase(),
            product_data: {
              name: `${booking.hotel_name} — ${nights} night${nights > 1 ? 's' : ''}`,
              description: [
                booking.room_name,
                booking.meal,
                `${booking.check_in} → ${booking.check_out}`,
                booking.guest_first_name && booking.guest_last_name
                  ? `Guest: ${booking.guest_first_name} ${booking.guest_last_name}`
                  : null,
              ]
                .filter(Boolean)
                .join(' | '),
              images: booking.hotel_image_url ? [booking.hotel_image_url] : undefined,
            },
            unit_amount: Math.round(parseFloat(booking.client_amount) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_request_id: booking.id,
        partner_order_id: booking.partner_order_id,
        hotel_hid: String(booking.hotel_hid),
      },
      success_url: `${baseUrl}/api/client/v1/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/api/client/v1/booking/cancel?request_id=${requestId}`,
    })

    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({
        status: 'payment_pending',
        stripe_checkout_session_id: session.id,
      })
      .eq('id', booking.id)

    return Response.json({
      data: { checkoutUrl: session.url },
      error: null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Booking checkout error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
