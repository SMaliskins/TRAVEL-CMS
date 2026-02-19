import { NextRequest } from 'next/server'
import { verifyAccessToken, ClientTokenPayload } from './jwt'

export async function getAuthenticatedClient(req: NextRequest): Promise<ClientTokenPayload> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED')
  }
  const token = authHeader.split(' ')[1]
  try {
    return await verifyAccessToken(token)
  } catch {
    throw new Error('UNAUTHORIZED')
  }
}

export function unauthorizedResponse(): Response {
  return Response.json({ data: null, error: 'Unauthorized' }, { status: 401 })
}
