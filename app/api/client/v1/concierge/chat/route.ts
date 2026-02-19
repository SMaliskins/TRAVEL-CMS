import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/client/v1/concierge/hotels/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: toolInput.city,
            checkIn: toolInput.check_in,
            checkOut: toolInput.check_out,
            guests: toolInput.guests ?? 2,
            rooms: toolInput.rooms ?? 1,
          }),
        }
      )
      const data = await res.json()
      return JSON.stringify(data.data ?? data.error ?? 'No results')
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

    if (toolName === 'search_transfers') {
      return JSON.stringify({
        note: 'Transfer search is not yet available. Please contact your travel agent for transfer arrangements.',
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

    const { message, sessionId, language = 'en' } = body as {
      message: string
      sessionId?: string
      language?: string
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
      { displayName: party?.display_name ?? 'Client', id: client.clientId },
      language
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
