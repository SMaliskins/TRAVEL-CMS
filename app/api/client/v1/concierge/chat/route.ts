import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'
import {
  suggestHotels, searchHotelsByRegion, getHotelContentsBatch, getHotelReviewsSummary,
  prebookFromSerp,
} from '@/lib/ratehawk/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface SearchResultEntry {
  hid: number
  name: string
  matchHash?: string
  bookHash?: string
  checkIn: string
  checkOut: string
  guests: number
  ratehawkAmount: number
  clientAmount: number
  currency: string
  roomName?: string
  meal?: string
  hotelStars?: number
  hotelAddress?: string
  hotelImage?: string
}

interface ToolContext {
  clientId: string
  crmClientId: string
  companyId?: string
  sessionId: string
  hotelMarkup: number
  lastSearchResults?: SearchResultEntry[]
}

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ result: string; lastSearchResults?: SearchResultEntry[] }> {
  try {
    if (toolName === 'search_hotels') {
      const keyId = process.env.RATEHAWK_KEY_ID
      const apiKey = process.env.RATEHAWK_API_KEY
      if (!keyId || !apiKey) return { result: JSON.stringify({ error: 'Hotel search not configured' }) }

      const city = toolInput.city as string
      const checkIn = toolInput.check_in as string
      const checkOut = toolInput.check_out as string
      const guests = (toolInput.guests as number) ?? 2

      const suggestions = await suggestHotels(city, 'en', keyId, apiKey)
      const regions = suggestions.regions ?? []

      if (regions.length === 0) {
        return { result: JSON.stringify({ error: `No region found for "${city}". Try a different city name.` }) }
      }

      const regionId = typeof regions[0].id === 'number'
        ? regions[0].id
        : parseInt(String(regions[0].id), 10)

      const serpHotels = await searchHotelsByRegion(
        regionId, checkIn, checkOut, guests, keyId, apiKey, 'EUR', 5
      )

      const hids = serpHotels.map((h) => h.hid).filter(Boolean)

      const [hotelContents, reviewSummaries] = await Promise.all([
        hids.length > 0 ? getHotelContentsBatch(hids, 'en', keyId, apiKey) : [],
        hids.length > 0 ? getHotelReviewsSummary(hids, 'en', keyId, apiKey) : [],
      ])
      const nameMap = new Map(hotelContents.map((c) => [c.hid, c]))
      const reviewMap = new Map(reviewSummaries.map((r) => [r.hid, r]))

      const markupMul = 1 + ctx.hotelMarkup / 100

      const searchEntries: SearchResultEntry[] = []
      const result = serpHotels.map((h, idx) => {
        const content = nameMap.get(h.hid)
        const review = reviewMap.get(h.hid)
        const cheapestRate = h.rates?.[0]
        const payment = cheapestRate?.payment_options?.payment_types?.[0]
        const rawPrice = payment?.show_amount ?? 0
        const clientPrice = ctx.hotelMarkup > 0
          ? Math.ceil(rawPrice * markupMul * 100) / 100
          : rawPrice

        searchEntries.push({
          hid: h.hid,
          name: content?.name || h.name || `Hotel #${h.hid}`,
          matchHash: cheapestRate?.match_hash,
          bookHash: cheapestRate?.book_hash,
          checkIn, checkOut, guests,
          ratehawkAmount: rawPrice,
          clientAmount: clientPrice,
          currency: payment?.show_currency_code ?? 'EUR',
          roomName: cheapestRate?.room_name,
          meal: cheapestRate?.meal,
          hotelStars: content?.star_rating ?? h.star_rating,
          hotelAddress: content?.address || h.address,
          hotelImage: content?.images?.[0],
        })

        const guestScore = content?.review_score ?? review?.reviewScore ?? null
        const guestReviewCount = content?.number_of_reviews ?? review?.reviewCount ?? null

        const amenityGroupsSummary = content?.amenity_groups?.map((g) =>
          `${g.group_name}: ${g.amenities.join(', ')}`
        ).join('; ') ?? content?.facts?.join(', ') ?? null

        const roomsSummary = content?.room_groups?.map((rg) => {
          const parts = [rg.name]
          if (rg.name_struct?.bedding_type) parts.push(`bed: ${rg.name_struct.bedding_type}`)
          if (rg.room_class && rg.room_class !== 'room') parts.push(`type: ${rg.room_class}`)
          if (rg.room_amenities?.length) parts.push(`amenities: ${rg.room_amenities.slice(0, 8).join(', ')}`)
          return parts.join(' | ')
        }) ?? null

        const roomImages = content?.room_groups
          ?.flatMap((rg) => (rg.images ?? []).map((url) => ({ room: rg.name, url })))
          .slice(0, 4) ?? null

        return {
          name: content?.name || h.name || `Hotel #${h.hid}`,
          stars: content?.star_rating ?? h.star_rating ?? null,
          guestRating: guestScore,
          reviewCount: guestReviewCount,
          kind: content?.kind ?? null,
          hotelChain: content?.hotel_chain ?? null,
          yearBuilt: content?.year_built ?? null,
          yearRenovated: content?.year_renovated ?? null,
          floorsAndRooms: content?.floors_number || content?.rooms_number
            ? `${content?.floors_number ?? '?'} floors, ${content?.rooms_number ?? '?'} rooms`
            : null,
          distanceToCenter: content?.distance_center
            ? `${Math.round(content.distance_center / 100) / 10} km`
            : null,
          description: content?.description ?? null,
          address: content?.address || h.address || null,
          totalPrice: payment ? `${clientPrice} ${payment.show_currency_code}` : 'price unavailable',
          meal: cheapestRate?.meal ?? 'no meal info',
          room: cheapestRate?.room_name ?? null,
          amenities: amenityGroupsSummary,
          roomTypes: roomsSummary,
          checkIn: content?.check_in_time ?? null,
          checkOut: content?.check_out_time ?? null,
          images: content?.images?.slice(0, 3) ?? null,
          roomImages: roomImages,
        }
      })

      return {
        result: JSON.stringify({
          region: regions[0].name,
          dates: `${checkIn} — ${checkOut}`,
          guests,
          hotels: result,
          note: 'If the client wants to book one of these hotels, use select_hotel_for_booking with the hotel number (1-based) and guest name.',
        }),
        lastSearchResults: searchEntries,
      }
    }

    if (toolName === 'get_client_trips') {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('order_code, status, countries_cities, date_from, date_to, amount_total')
        .eq('client_party_id', ctx.crmClientId)
        .order('date_from', { ascending: true })
        .limit(10)
      return { result: JSON.stringify(orders ?? []) }
    }

    if (toolName === 'get_trip_itinerary') {
      const orderCode = toolInput.order_code as string
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, order_code, status, countries_cities, date_from, date_to')
        .eq('client_party_id', ctx.crmClientId)
        .eq('order_code', orderCode)
        .single()

      if (!order) {
        return { result: JSON.stringify({ error: `Order ${orderCode} not found` }) }
      }

      const { data: services } = await supabaseAdmin
        .from('order_services')
        .select(`
          category, service_name,
          service_date_from, service_date_to,
          res_status, supplier_name, ref_nr,
          flight_segments, cabin_class,
          hotel_name, hotel_star_rating, hotel_room, hotel_board, hotel_bed_type,
          transfer_type, pickup_location, dropoff_location, pickup_time
        `)
        .eq('order_id', order.id)
        .neq('res_status', 'cancelled')
        .order('service_date_from', { ascending: true })

      return { result: JSON.stringify({
        order: {
          code: order.order_code,
          status: order.status,
          destination: order.countries_cities,
          dates: `${order.date_from} — ${order.date_to}`,
        },
        services: services ?? [],
      }) }
    }

    if (toolName === 'search_transfers') {
      return { result: JSON.stringify({
        note: 'Transfer booking is available through your travel agent. I can help you prepare a transfer request with all the details (pickup, destination, date, time, passengers) and forward it to your agent.',
        params: toolInput,
      }) }
    }

    if (toolName === 'select_hotel_for_booking') {
      const hotelIndex = (toolInput.hotel_index as number) - 1
      const guestFirstName = toolInput.guest_first_name as string
      const guestLastName = toolInput.guest_last_name as string

      const searchResults = ctx.lastSearchResults
      if (!searchResults || searchResults.length === 0) {
        return { result: JSON.stringify({ error: 'No recent hotel search results. Please search for hotels first.' }) }
      }
      if (hotelIndex < 0 || hotelIndex >= searchResults.length) {
        return { result: JSON.stringify({ error: `Invalid hotel number. Choose between 1 and ${searchResults.length}.` }) }
      }

      const selected = searchResults[hotelIndex]
      const keyId = process.env.RATEHAWK_KEY_ID
      const apiKey = process.env.RATEHAWK_API_KEY

      let bookHash = selected.bookHash
      let finalAmount = selected.clientAmount
      let finalCurrency = selected.currency

      if (!bookHash && selected.matchHash && keyId && apiKey) {
        const prebook = await prebookFromSerp(selected.matchHash, keyId, apiKey, 10)
        if (!prebook.available || !prebook.book_hash) {
          return { result: JSON.stringify({ error: 'This hotel rate is no longer available. Please search again.' }) }
        }
        bookHash = prebook.book_hash
        if (prebook.amount) {
          const markupMul = 1 + ctx.hotelMarkup / 100
          finalAmount = ctx.hotelMarkup > 0 ? Math.ceil(prebook.amount * markupMul * 100) / 100 : prebook.amount
          finalCurrency = prebook.currency ?? selected.currency
        }
      }

      const partnerOrderId = crypto.randomUUID()

      const { error: insertError } = await supabaseAdmin
        .from('concierge_booking_requests')
        .insert({
          client_id: ctx.clientId,
          company_id: ctx.companyId ?? null,
          session_id: ctx.sessionId,
          status: 'pending_selection',
          hotel_hid: selected.hid,
          hotel_name: selected.name,
          hotel_address: selected.hotelAddress,
          hotel_stars: selected.hotelStars,
          hotel_image_url: selected.hotelImage,
          check_in: selected.checkIn,
          check_out: selected.checkOut,
          guests: selected.guests,
          room_name: selected.roomName,
          meal: selected.meal,
          match_hash: selected.matchHash,
          book_hash: bookHash,
          ratehawk_amount: selected.ratehawkAmount,
          ratehawk_currency: selected.currency,
          client_amount: finalAmount,
          client_currency: finalCurrency,
          markup_percent: ctx.hotelMarkup,
          partner_order_id: partnerOrderId,
          guest_first_name: guestFirstName,
          guest_last_name: guestLastName,
        })

      if (insertError) {
        return { result: JSON.stringify({ error: `Could not save booking request: ${insertError.message}` }) }
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
      const paymentUrl = `${baseUrl}/api/client/v1/booking/checkout?request_id=${partnerOrderId}`

      return { result: JSON.stringify({
        status: 'booking_saved',
        hotel: selected.name,
        stars: selected.hotelStars,
        room: selected.roomName,
        meal: selected.meal,
        dates: `${selected.checkIn} — ${selected.checkOut}`,
        totalPrice: `${finalAmount} ${finalCurrency}`,
        guestName: `${guestFirstName} ${guestLastName}`,
        paymentUrl,
        message: `Booking request created. To complete the booking, the client should proceed to payment using the link above. The price is ${finalAmount} ${finalCurrency} for the entire stay.`,
      }) }
    }

    return { result: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }
  } catch (err) {
    return { result: JSON.stringify({ error: `Tool execution failed: ${err instanceof Error ? err.message : 'unknown'}` }) }
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const body = await req.json().catch(() => null)
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const { message, sessionId } = body as {
      message: string
      sessionId?: string
    }

    type SessionRow = { id: string; messages: Anthropic.Messages.MessageParam[] }

    let session: SessionRow | null = null

    if (sessionId) {
      const { data } = await supabaseAdmin
        .from('concierge_sessions')
        .select('id, messages')
        .eq('id', sessionId)
        .eq('client_id', client.clientId)
        .single()
      session = data as SessionRow | null
    }

    if (!session) {
      const { data } = await supabaseAdmin
        .from('concierge_sessions')
        .insert({ client_id: client.clientId, messages: [] })
        .select('id, messages')
        .single()
      session = data as SessionRow | null
    }

    if (!session) {
      return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const { data: profileData } = await supabaseAdmin
      .from('client_profiles')
      .select('crm_client_id')
      .eq('id', client.clientId)
      .single()

    const { data: party } = await supabaseAdmin
      .from('party')
      .select('display_name, company_id')
      .eq('id', profileData?.crm_client_id)
      .single()

    let hotelMarkup = 0
    if (party?.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('concierge_hotel_markup')
        .eq('id', party.company_id)
        .single()
      hotelMarkup = parseFloat(company?.concierge_hotel_markup) || 0
    }

    const systemPrompt = buildConciergeSystemPrompt(
      { displayName: party?.display_name ?? 'Client', id: client.clientId }
    )

    let messages: Anthropic.Messages.MessageParam[] = [
      ...(session.messages ?? []),
      { role: 'user', content: message },
    ]

    const toolCtx: ToolContext = {
      clientId: client.clientId,
      crmClientId: profileData?.crm_client_id ?? '',
      companyId: party?.company_id ?? undefined,
      sessionId: session.id,
      hotelMarkup,
    }

    let assistantText = ''
    const MAX_TOOL_LOOPS = 5

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        tools: conciergeTools,
        messages,
      })

      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
      ]

      assistantText = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')

      if (response.stop_reason !== 'tool_use') break

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      )

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const toolBlock of toolUseBlocks) {
        const { result, lastSearchResults } = await executeToolCall(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          toolCtx
        )
        if (lastSearchResults) {
          toolCtx.lastSearchResults = lastSearchResults
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        })
      }

      messages = [
        ...messages,
        { role: 'user', content: toolResults },
      ]
    }

    await supabaseAdmin
      .from('concierge_sessions')
      .update({
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    return Response.json({
      data: {
        sessionId: session.id,
        message: assistantText || 'I processed your request. Is there anything else I can help with?',
        stopReason: 'end_turn',
      },
      error: null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Concierge chat error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
