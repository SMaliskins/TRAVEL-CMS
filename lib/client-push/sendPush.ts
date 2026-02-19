import { supabaseAdmin } from '@/lib/supabaseAdmin'

interface PushPayload {
  title: string
  body: string
  type?: string
  refId?: string
}

export async function sendPushToClient(
  clientPartyId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('client_profiles')
      .select('id, notification_token')
      .eq('crm_client_id', clientPartyId)
      .single()

    if (!profile) {
      console.log('[sendPushToClient] No client_profile found for crm_client_id:', clientPartyId)
      return
    }

    console.log('[sendPushToClient] Inserting notification for client_id:', profile.id)

    const { error: insertError } = await supabaseAdmin.from('client_notifications').insert({
      client_id: profile.id,
      title: payload.title,
      body: payload.body,
      type: payload.type ?? 'order_update',
      ref_id: payload.refId ?? null,
    })

    if (insertError) {
      console.error('[sendPushToClient] Insert error:', insertError.message)
      return
    }

    console.log('[sendPushToClient] Notification inserted successfully')

    if (profile.notification_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: profile.notification_token,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: {
            type: payload.type ?? 'order_update',
            refId: payload.refId ?? null,
          },
        }),
      })
    }
  } catch (err) {
    console.error('[sendPushToClient] Error:', err)
  }
}
