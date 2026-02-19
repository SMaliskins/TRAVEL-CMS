import { NextRequest } from 'next/server'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { suggestHotels, searchHotelsByRegion } from '@/lib/ratehawk/client'

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedClient(req)

    const body = await req.json().catch(() => null)
    if (!body || typeof body.city !== 'string' || !body.checkIn || !body.checkOut) {
      return Response.json(
        { data: null, error: 'VALIDATION_ERROR: city, checkIn, checkOut required' },
        { status: 400 }
      )
    }

    const { city, checkIn, checkOut, guests = 2 } = body as {
      city: string
      checkIn: string
      checkOut: string
      guests: number
    }

    if (isNaN(Date.parse(checkIn)) || isNaN(Date.parse(checkOut))) {
      return Response.json(
        { data: null, error: 'VALIDATION_ERROR: checkIn and checkOut must be valid dates' },
        { status: 400 }
      )
    }

    const keyId = process.env.RATEHAWK_KEY_ID
    const apiKey = process.env.RATEHAWK_API_KEY

    if (!keyId || !apiKey) {
      console.error('RateHawk credentials not configured')
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const suggestions = await suggestHotels(city, 'en', keyId, apiKey)

    const regions = suggestions.regions ?? []
    if (regions.length === 0) {
      return Response.json({
        data: {
          hotels: [],
          totalCount: 0,
          searchParams: { city, checkIn, checkOut, guests },
          note: `No region found for "${city}". Try a different city name.`,
        },
        error: null,
      })
    }

    const regionId = typeof regions[0].id === 'number'
      ? regions[0].id
      : parseInt(String(regions[0].id), 10)

    const serpHotels = await searchHotelsByRegion(
      regionId, checkIn, checkOut, guests, keyId, apiKey, 'EUR', 5
    )

    const result = serpHotels.map((h) => {
      const cheapestRate = h.rates?.[0]
      const payment = cheapestRate?.payment_options?.payment_types?.[0]
      return {
        name: h.name,
        stars: h.star_rating ?? null,
        address: h.address ?? null,
        pricePerNight: payment ? `${payment.show_amount} ${payment.show_currency_code}` : null,
        totalPrice: payment ? payment.show_amount : null,
        currency: payment?.show_currency_code ?? 'EUR',
        meal: cheapestRate?.meal ?? null,
        roomName: cheapestRate?.room_name ?? null,
      }
    })

    return Response.json({
      data: {
        hotels: result,
        totalCount: result.length,
        region: regions[0].name,
        searchParams: { city, checkIn, checkOut, guests },
      },
      error: null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Hotel search error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
