import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { MODELS } from '@/lib/ai/config'
import { checkAiUsageLimit } from '@/lib/ai/usageLimit'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'
import { suggestHotels, prebookFromSerp } from '@/lib/ratehawk/client'
import { searchAll } from '@/lib/providers/aggregator'
import { createRateHawkProvider } from '@/lib/providers/ratehawk/adapter'
import { createGoGlobalProvider } from '@/lib/providers/goglobal/adapter'
import type { HotelProvider, HotelSearchParams } from '@/lib/providers/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface SearchResultEntry {
  provider: string
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
      const city = toolInput.city as string
      const checkIn = toolInput.check_in as string
      const checkOut = toolInput.check_out as string
      const guests = (toolInput.guests as number) ?? 2
      const nationality = (toolInput.nationality as string) ?? undefined
      const cityCode = (toolInput.city_code as number) ?? undefined

      const providers: HotelProvider[] = []
      let regionId: number | undefined

      const rhKeyId = process.env.RATEHAWK_KEY_ID
      const rhApiKey = process.env.RATEHAWK_API_KEY
      if (rhKeyId && rhApiKey) {
        const suggestions = await suggestHotels(city, 'en', rhKeyId, rhApiKey)
        const regions = suggestions.regions ?? []
        if (regions.length > 0) {
          regionId = typeof regions[0].id === 'number'
            ? regions[0].id
            : parseInt(String(regions[0].id), 10)
          providers.push(createRateHawkProvider())
        }
      }

      if (process.env.GOGLOBAL_AGENCY_ID && process.env.GOGLOBAL_PASSWORD && cityCode) {
        providers.push(createGoGlobalProvider())
      }

      if (providers.length === 0) {
        return { result: JSON.stringify({ error: `No providers available or no region found for "${city}". Try a different city name.` }) }
      }

      const searchParams: HotelSearchParams = {
        cityName: city,
        regionId,
        cityCode,
        checkIn,
        checkOut,
        adults: guests,
        nationality,
        currency: 'EUR',
        maxResults: 5,
      }

      const aggregated = await searchAll(providers, searchParams)
      const markupMul = 1 + ctx.hotelMarkup / 100

      const searchEntries: SearchResultEntry[] = []
      const hotels = aggregated.hotels.map((hotel) => {
        const bestRate = hotel.rates[0]
        if (!bestRate) return null

        const clientPrice = ctx.hotelMarkup > 0
          ? Math.ceil(hotel.bestPrice * markupMul * 100) / 100
          : hotel.bestPrice

        searchEntries.push({
          provider: bestRate.provider,
          hid: bestRate.provider === 'ratehawk' ? parseInt(hotel.id, 10) || 0 : 0,
          name: hotel.name,
          matchHash: (bestRate.providerMetadata?.matchHash as string) ?? undefined,
          bookHash: (bestRate.providerMetadata?.bookHash as string) ?? undefined,
          checkIn, checkOut, guests,
          ratehawkAmount: bestRate.provider === 'ratehawk' ? bestRate.totalPrice : 0,
          clientAmount: clientPrice,
          currency: hotel.currency,
          roomName: bestRate.roomName,
          meal: bestRate.mealPlanOriginal || bestRate.mealPlan,
          hotelStars: hotel.starRating,
          hotelAddress: hotel.address,
          hotelImage: hotel.images[0],
        })

        const providerPrices = hotel.providers.map((prov) => {
          const provRate = hotel.rates.find((r) => r.provider === prov)
          if (!provRate) return null
          const cp = ctx.hotelMarkup > 0
            ? Math.ceil(provRate.totalPrice * markupMul * 100) / 100
            : provRate.totalPrice
          return {
            provider: prov,
            price: `${cp} ${provRate.currency}`,
            cancellation: provRate.cancellationType,
          }
        }).filter(Boolean)

        return {
          name: hotel.name,
          stars: hotel.starRating,
          guestRating: hotel.reviewScore,
          reviewCount: hotel.reviewCount,
          address: hotel.address,
          totalPrice: `${clientPrice} ${hotel.currency}`,
          bestProvider: hotel.bestPriceProvider,
          providerPrices,
          meal: bestRate.mealPlanOriginal || bestRate.mealPlan,
          room: bestRate.roomName,
          cancellation: bestRate.cancellationType,
          freeCancellationBefore: bestRate.freeCancellationBefore,
          images: hotel.images.slice(0, 3),
        }
      }).filter(Boolean)

      return {
        result: JSON.stringify({
          city,
          dates: `${checkIn} — ${checkOut}`,
          guests,
          providers: providers.map((p) => p.name),
          hotels,
          errors: aggregated.errors.length > 0 ? aggregated.errors : undefined,
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

    // Check AI usage limit
    if (toolCtx.companyId) {
      const usage = await checkAiUsageLimit(toolCtx.companyId)
      if (!usage.allowed) {
        return Response.json(
          { data: null, error: 'AI_LIMIT_REACHED', message: `AI usage limit reached (${usage.used}/${usage.limit} this month).` },
          { status: 429 }
        )
      }
    }

    let assistantText = ''
    const MAX_TOOL_LOOPS = 5

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const response = await anthropic.messages.create({
        model: MODELS.ANTHROPIC_CHAT,
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
