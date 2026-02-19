import { NextRequest } from 'next/server'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import {
  suggestHotels,
  getHotelContentsBatch,
  RateHawkHotelContent,
} from '@/lib/ratehawk/client'

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

    const { city, checkIn, checkOut, guests = 2, rooms = 1 } = body as {
      city: string
      checkIn: string
      checkOut: string
      guests: number
      rooms: number
    }

    // Validate date format
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

    // Step 1: Suggest hotels by city name (RateHawk autocomplete)
    // NOTE: RateHawk does not expose a public availability/pricing search via this API tier.
    // suggestHotels returns hotel/region metadata only (no pricing or availability).
    // Pricing search requires the ETG Affiliate API booking flow (separate integration).
    const suggestions = await suggestHotels(city, 'en', keyId, apiKey)

    const hotelIds = (suggestions.hotels ?? []).slice(0, 5).map((h) => h.hid)

    // Step 2: Fetch detailed content for suggested hotels
    let hotels: RateHawkHotelContent[] = []
    if (hotelIds.length > 0) {
      hotels = await getHotelContentsBatch(hotelIds, 'en', keyId, apiKey)
    }

    // Shape response: include suggestion metadata merged with content
    const suggestMap = new Map(suggestions.hotels.map((s) => [s.hid, s]))

    const result = hotels.map((h) => {
      const sug = suggestMap.get(h.hid)
      return {
        hid: h.hid,
        id: h.id ?? sug?.id,
        name: h.name,
        address: h.address ?? null,
        latitude: h.latitude ?? null,
        longitude: h.longitude ?? null,
        phone: h.phone ?? null,
        region: h.region ?? null,
        room_groups: h.room_groups ?? null,
        meal_types: h.meal_types ?? null,
      }
    })

    return Response.json({
      data: {
        hotels: result,
        totalCount: result.length,
        // Search params echo — checkIn/checkOut/guests/rooms stored for future pricing integration
        searchParams: { city, checkIn, checkOut, guests, rooms },
        note: 'Availability and pricing search requires ETG booking API integration (pending)',
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
