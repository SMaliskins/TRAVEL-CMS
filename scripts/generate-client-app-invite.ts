/**
 * Generate a 24h JWT for POST /api/client/v1/auth/register (first-time app signup).
 *
 * Usage (from repo root, same Node env as Next — load .env.local):
 *   npx tsx scripts/generate-client-app-invite.ts <party_uuid> [agent_profiles_user_uuid]
 *
 * party_uuid     = party.id in CRM (the influencer / client card)
 * agent UUID     = optional; auth.users.id that exists in public.profiles(user_id). If omitted, invitation has no inviter (DB stores NULL).
 *
 * Signing matches the API: optional CLIENT_JWT_INVITATION_SECRET, else derived from SUPABASE_SERVICE_ROLE_KEY (same as CRM).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { SignJWT } from 'jose'
import { deriveClientJwtKeyNode } from '../lib/client-auth/deriveClientJwtKeyNode'
import { DUMMY_SERVICE_ROLE } from '../lib/client-auth/clientJwtPurpose'

const DEV_FALLBACK = 'dev-invitation-secret-change-in-prod'

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function invitationSecret(): Uint8Array {
  const v = process.env.CLIENT_JWT_INVITATION_SECRET?.trim()
  if (v && v !== DEV_FALLBACK) {
    return new TextEncoder().encode(v)
  }
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (sr && sr !== DUMMY_SERVICE_ROLE) {
    return deriveClientJwtKeyNode('invitation', sr)
  }
  console.warn('[invite] No CLIENT_JWT_INVITATION_SECRET or SUPABASE_SERVICE_ROLE_KEY — using dev fallback (must match API server).')
  return new TextEncoder().encode(DEV_FALLBACK)
}

async function main() {
  loadEnvLocal()
  const partyId = process.argv[2]?.trim()
  const agentIdArg = process.argv[3]?.trim()
  if (!partyId) {
    console.error(
      'Usage: npx tsx scripts/generate-client-app-invite.ts <party_uuid> [agent_auth_user_uuid]\n' +
        '  agent_auth_user_uuid = optional; must exist as profiles.user_id if provided.'
    )
    process.exit(1)
  }
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRe.test(partyId)) {
    console.error('Invalid party UUID')
    process.exit(1)
  }
  const agentId =
    agentIdArg && uuidRe.test(agentIdArg) ? agentIdArg : ''

  const token = await new SignJWT({
    crmClientId: partyId,
    agentId,
    type: 'invitation',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(invitationSecret())

  const q = encodeURIComponent(token)
  console.log('\n--- Client app invitation (24h) ---\n')
  console.log('JWT:\n', token)
  console.log('\nDeep link (open on device with app installed):\n')
  console.log(`  mytravelconcierge://register?invitationToken=${q}`)
  console.log('\nPlain path (same):\n')
  console.log(`  mytravelconcierge://register?invitationToken=<paste JWT>`)
  console.log('\nAfter install, user sets password on Register; then uses email + password to sign in.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
