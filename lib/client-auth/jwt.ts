import { SignJWT, jwtVerify } from 'jose'
import crypto from 'crypto'

const DEV_ACCESS_FALLBACK = 'dev-access-secret-change-in-prod'
const DEV_REFRESH_FALLBACK = 'dev-refresh-secret-change-in-prod'
const DEV_INVITATION_FALLBACK = 'dev-invitation-secret-change-in-prod'

function readJwtSecret(
  envName: "CLIENT_JWT_ACCESS_SECRET" | "CLIENT_JWT_REFRESH_SECRET" | "CLIENT_JWT_INVITATION_SECRET",
  devFallback: string,
  strict: boolean
): string {
  const value = process.env[envName]?.trim()
  const isProd = process.env.NODE_ENV === 'production'

  if (value && value !== devFallback) return value

  if (isProd && strict) {
    throw new Error(`[SECURITY] ${envName} must be set in production`)
  }

  if (!value) {
    console.warn(`[SECURITY] ${envName} is not set. Using development fallback secret.`)
  }

  return devFallback
}

function accessSecret(strict = true): Uint8Array {
  return new TextEncoder().encode(readJwtSecret('CLIENT_JWT_ACCESS_SECRET', DEV_ACCESS_FALLBACK, strict))
}
function refreshSecret(strict = true): Uint8Array {
  return new TextEncoder().encode(readJwtSecret('CLIENT_JWT_REFRESH_SECRET', DEV_REFRESH_FALLBACK, strict))
}
function invitationSecret(strict = true): Uint8Array {
  return new TextEncoder().encode(readJwtSecret('CLIENT_JWT_INVITATION_SECRET', DEV_INVITATION_FALLBACK, strict))
}

export interface ClientTokenPayload {
  clientId: string      // client_profiles.id
  crmClientId: string   // client_profiles.crm_client_id → party.id
  sub: string           // same as clientId
}

export async function signAccessToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({ clientId: payload.clientId, crmClientId: payload.crmClientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.clientId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessSecret())
}

export async function signRefreshToken(payload: ClientTokenPayload): Promise<string> {
  return new SignJWT({ clientId: payload.clientId, crmClientId: payload.crmClientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.clientId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(refreshSecret())
}

export async function signInvitationToken(crmClientId: string, agentId: string): Promise<string> {
  return new SignJWT({ crmClientId, agentId, type: 'invitation' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(invitationSecret())
}

export async function verifyAccessToken(token: string): Promise<ClientTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret())
  return {
    clientId: payload['clientId'] as string,
    crmClientId: payload['crmClientId'] as string,
    sub: payload.sub as string,
  }
}

export async function verifyRefreshToken(token: string): Promise<ClientTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret())
  return {
    clientId: payload['clientId'] as string,
    crmClientId: payload['crmClientId'] as string,
    sub: payload.sub as string,
  }
}

export async function verifyInvitationToken(token: string): Promise<{
  crmClientId: string
  agentId: string
  type: string
}> {
  const { payload } = await jwtVerify(token, invitationSecret())
  return {
    crmClientId: payload['crmClientId'] as string,
    agentId: payload['agentId'] as string,
    type: payload['type'] as string,
  }
}

/** SHA-256 hash of a token — used for storing refresh tokens in DB */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
