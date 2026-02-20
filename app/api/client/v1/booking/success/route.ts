import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Booking Confirmed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f0fdf4}
.card{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-width:360px}
.icon{font-size:64px;margin-bottom:16px}h1{color:#16a34a;margin:0 0 8px}p{color:#666;margin:4px 0}
.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#1a73e8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style></head>
<body><div class="card">
<div class="icon">✅</div>
<h1>Payment Successful!</h1>
<p>Your hotel booking is being confirmed.</p>
<p>You will receive a notification shortly.</p>
<p style="font-size:12px;color:#aaa;margin-top:16px">Session: ${sessionId ?? 'N/A'}</p>
<a class="btn" href="javascript:void(0)" onclick="window.close()">Close</a>
</div></body></html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}
