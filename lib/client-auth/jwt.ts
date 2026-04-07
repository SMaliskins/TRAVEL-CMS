import { SignJWT, jwtVerify } from 'jose'
import crypto from 'crypto'
import { CLIENT_JWT_PURPOSE, DUMMY_SERVICE_ROLE, type ClientJwtPurpose } from './clientJwtPurpose'
import { deriveClientJwtKeyNode } from './deriveClientJwtKeyNode'

const DEV_ACCESS_FALLBACK = 'dev-access-secret-change-in-prod'
const DEV_REFRESH_FALLBACK = 'dev-refresh-secret-change-in-prod'
const DEV_INVITATION_FALLBACK = 'dev-invitation-secret-change-in-prod'

type JwtEnvName =
  | 'CLIENT_JWT_ACCESS_SECRET'
  | 'CLIENT_JWT_REFRESH_SECRET'
  | 'CLIENT_JWT_INVITATION_SECRET'

function signingKey(
  envName: JwtEnvName,
  devFallback: string,
  purpose: ClientJwtPurpose
): Uint8Array {
  const explicit = process.env[envName]?.trim()
  if (explicit && explicit !== devFallback) {
    return new TextEncoder().encode(explicit)
  }
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (sr && sr !== DUMMY_SERVICE_ROLE) {
    return deriveClientJwtKeyNode(purpose, sr)
  }
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    throw new Error(
      `[SECURITY] Set ${envName} or ensure SUPABASE_SERVICE_ROLE_KEY is configured (same key as CRM server)`
    )
  }
  if (!explicit) {
    console.warn(`[SECURITY] ${envName} is not set. Using development fallback secret.`)
  }
  return new TextEncoder().encode(devFallback)
}

function accessSecret(): Uint8Array {
  return signingKey('CLIENT_JWT_ACCESS_SECRET', DEV_ACCESS_FALLBACK, 'access')
}
function refreshSecret(): Uint8Array {
  return signingKey('CLIENT_JWT_REFRESH_SECRET', DEV_REFRESH_FALLBACK, 'refresh')
}
function invitationSecret(): Uint8Array {
  return signingKey('CLIENT_JWT_INVITATION_SECRET', DEV_INVITATION_FALLBACK, 'invitation')
}

export interface ClientTokenPayload {
  clientId: string // client_profiles.id
  crmClientId: string // client_profiles.crm_client_id → party.id
  sub: string // same as clientId
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
