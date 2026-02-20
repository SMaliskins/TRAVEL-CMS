import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get('request_id')

  if (requestId) {
    await supabaseAdmin
      .from('concierge_booking_requests')
      .update({ status: 'cancelled' })
      .eq('partner_order_id', requestId)
      .in('status', ['pending_selection', 'payment_pending'])
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Booking Cancelled</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fef2f2}
.card{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-width:360px}
.icon{font-size:64px;margin-bottom:16px}h1{color:#dc2626;margin:0 0 8px}p{color:#666;margin:4px 0}
.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#1a73e8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="card">
<div class="icon">❌</div>
<h1>Payment Cancelled</h1>
<p>Your booking was not completed.</p>
<p>You can try again from the Concierge chat.</p>
<a class="btn" href="javascript:void(0)" onclick="window.close()">Close</a>
</div></body></html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}
