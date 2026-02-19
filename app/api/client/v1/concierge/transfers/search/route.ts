import { NextRequest } from 'next/server'
import { getAuthenticatedClient, unauthorizedResponse } from '@/lib/client-auth/middleware'

export async function POST(req: NextRequest) {
  try {
    await getAuthenticatedClient(req)

    const body = await req.json().catch(() => null)
    if (!body || typeof body.from !== 'string' || typeof body.to !== 'string' || !body.date) {
      return Response.json(
        { data: null, error: 'VALIDATION_ERROR: from, to, date required' },
        { status: 400 }
      )
    }

    const { from, to, date, passengers = 1 } = body as {
      from: string
      to: string
      date: string
      passengers: number
    }

    if (isNaN(Date.parse(date))) {
      return Response.json(
        { data: null, error: 'VALIDATION_ERROR: date must be a valid date' },
        { status: 400 }
      )
    }

    // Transfer search via SIXT/Blacklane — integration pending
    // Returns empty results (not an error — integration not yet available)
    return Response.json({
      data: {
        transfers: [],
        totalCount: 0,
        searchParams: { from, to, date, passengers },
        message: 'Transfer search integration coming soon (SIXT/Blacklane)',
      },
      error: null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return unauthorizedResponse()
    }
    console.error('Transfer search error:', err)
    return Response.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
