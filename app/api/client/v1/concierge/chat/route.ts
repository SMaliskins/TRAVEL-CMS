import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'
import { suggestHotels, searchHotelsByRegion } from '@/lib/ratehawk/client'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  clientId: string,
  crmClientId: string
): Promise<string> {
  try {
    if (toolName === 'search_hotels') {
      const keyId = process.env.RATEHAWK_KEY_ID
      const apiKey = process.env.RATEHAWK_API_KEY
      if (!keyId || !apiKey) return JSON.stringify({ error: 'Hotel search not configured' })

      const city = toolInput.city as string
      const checkIn = toolInput.check_in as string
      const checkOut = toolInput.check_out as string
      const guests = (toolInput.guests as number) ?? 2

      const suggestions = await suggestHotels(city, 'en', keyId, apiKey)
      const regions = suggestions.regions ?? []

      if (regions.length === 0) {
        return JSON.stringify({ error: `No region found for "${city}". Try a different city name.` })
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
          totalPrice: payment ? `${payment.show_amount} ${payment.show_currency_code}` : 'price unavailable',
          meal: cheapestRate?.meal ?? 'no meal info',
          room: cheapestRate?.room_name ?? null,
        }
      })

      return JSON.stringify({
        region: regions[0].name,
        dates: `${checkIn} — ${checkOut}`,
        guests,
        hotels: result,
      })
    }

    if (toolName === 'get_client_trips') {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('order_code, status, countries_cities, date_from, date_to, amount_total')
        .eq('client_party_id', crmClientId)
        .order('date_from', { ascending: true })
        .limit(10)
      return JSON.stringify(orders ?? [])
    }

    if (toolName === 'get_trip_itinerary') {
      const orderCode = toolInput.order_code as string
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, order_code, status, countries_cities, date_from, date_to')
        .eq('client_party_id', crmClientId)
        .eq('order_code', orderCode)
        .single()

      if (!order) {
        return JSON.stringify({ error: `Order ${orderCode} not found` })
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

      return JSON.stringify({
        order: {
          code: order.order_code,
          status: order.status,
          destination: order.countries_cities,
          dates: `${order.date_from} — ${order.date_to}`,
        },
        services: services ?? [],
      })
    }

    if (toolName === 'search_transfers') {
      return JSON.stringify({
        note: 'Transfer booking is available through your travel agent. I can help you prepare a transfer request with all the details (pickup, destination, date, time, passengers) and forward it to your agent.',
        params: toolInput,
      })
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  } catch (err) {
    return JSON.stringify({ error: `Tool execution failed: ${err instanceof Error ? err.message : 'unknown'}` })
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
      .select('display_name')
      .eq('id', profileData?.crm_client_id)
      .single()

    const systemPrompt = buildConciergeSystemPrompt(
      { displayName: party?.display_name ?? 'Client', id: client.clientId }
    )

    let messages: Anthropic.Messages.MessageParam[] = [
      ...(session.messages ?? []),
      { role: 'user', content: message },
    ]

    let assistantText = ''
    const MAX_TOOL_LOOPS = 3

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
        const result = await executeToolCall(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          client.clientId,
          profileData?.crm_client_id ?? ''
        )
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
