import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'
import { conciergeTools } from '@/lib/client-concierge/tools'
import { buildConciergeSystemPrompt } from '@/lib/client-concierge/systemPrompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const client = await getAuthenticatedClient(req)

    const body = await req.json().catch(() => null)
    if (!body || typeof body.message !== 'string' || !body.message.trim()) {
      return Response.json({ data: null, error: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const { message, sessionId, language = 'ru' } = body as {
      message: string
      sessionId?: string
      language?: string
    }

    type SessionRow = { id: string; messages: Anthropic.Messages.MessageParam[] }

    // Get or create session
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

    // Get client info for system prompt
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

    // Build message history and add new user message
    const messages: Anthropic.Messages.MessageParam[] = [
      ...(session.messages ?? []),
      { role: 'user', content: message },
    ]

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      tools: conciergeTools,
      messages,
    })

    // Extract text from response
    const assistantText = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Add assistant response to history
    const updatedMessages: Anthropic.Messages.MessageParam[] = [
      ...messages,
      { role: 'assistant', content: response.content },
    ]

    // Save session
    await supabaseAdmin
      .from('concierge_sessions')
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    return Response.json({
      data: {
        sessionId: session.id,
        message: assistantText,
        toolUse: response.content.filter((b) => b.type === 'tool_use'),
        stopReason: response.stop_reason,
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
