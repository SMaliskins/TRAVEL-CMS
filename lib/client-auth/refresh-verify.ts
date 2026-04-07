/**
 * Edge-safe refresh JWT verify (Web Crypto only) for Next.js middleware.
 * Signing key matches Node `jwt.ts`: HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, purpose) or explicit CLIENT_JWT_REFRESH_SECRET.
 */
import { jwtVerify } from 'jose'
import { CLIENT_JWT_PURPOSE, DUMMY_SERVICE_ROLE } from './clientJwtPurpose'

const DEV_REFRESH_FALLBACK = 'dev-refresh-secret-change-in-prod'

async function refreshSigningKey(): Promise<Uint8Array> {
  const explicit = process.env.CLIENT_JWT_REFRESH_SECRET?.trim()
  if (explicit && explicit !== DEV_REFRESH_FALLBACK) {
    return new TextEncoder().encode(explicit)
  }
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (sr && sr !== DUMMY_SERVICE_ROLE) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(sr),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(CLIENT_JWT_PURPOSE.refresh))
    return new Uint8Array(sig)
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] Set CLIENT_JWT_REFRESH_SECRET or SUPABASE_SERVICE_ROLE_KEY (same as CRM server)'
    )
  }
  if (!explicit) {
    console.warn('[SECURITY] CLIENT_JWT_REFRESH_SECRET is not set. Using development fallback secret.')
  }
  return new TextEncoder().encode(DEV_REFRESH_FALLBACK)
}

/** Returns if JWT is valid and not expired; throws otherwise. */
export async function verifyRefreshTokenForMiddleware(token: string): Promise<void> {
  const secret = await refreshSigningKey()
  await jwtVerify(token, secret)
}
