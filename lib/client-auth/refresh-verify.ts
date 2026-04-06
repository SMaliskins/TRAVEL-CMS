/**
 * Edge-safe refresh JWT verify (no Node `crypto` import) for Next.js middleware.
 */
import { jwtVerify } from 'jose'

const DEV_REFRESH_FALLBACK = 'dev-refresh-secret-change-in-prod'

function refreshSecret(): Uint8Array {
  const value = process.env.CLIENT_JWT_REFRESH_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production'
  if (value && value !== DEV_REFRESH_FALLBACK) {
    return new TextEncoder().encode(value)
  }
  if (isProd) {
    throw new Error('[SECURITY] CLIENT_JWT_REFRESH_SECRET must be set in production')
  }
  if (!value) {
    console.warn('[SECURITY] CLIENT_JWT_REFRESH_SECRET is not set. Using development fallback secret.')
  }
  return new TextEncoder().encode(DEV_REFRESH_FALLBACK)
}

/** Returns if JWT is valid and not expired; throws otherwise. */
export async function verifyRefreshTokenForMiddleware(token: string): Promise<void> {
  await jwtVerify(token, refreshSecret())
}
