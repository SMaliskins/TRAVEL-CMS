import type { ReferralOverview } from './types'

const BASE = '/api/client/v1'

export type WalletPlatform = 'apple' | 'google'

/** Returns whether a pass file was downloaded; `not_configured` when backend Phase B is not wired yet. */
export async function requestWalletPass(
  platform: WalletPlatform
): Promise<'downloaded' | 'not_configured'> {
  let res = await fetch(`${BASE}/referral/wallet-pass?platform=${platform}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (res.status === 401) {
    const ok = await tryRefresh()
    if (!ok) {
      throw new Error('UNAUTHORIZED')
    }
    res = await fetch(`${BASE}/referral/wallet-pass?platform=${platform}`, {
      credentials: 'include',
      cache: 'no-store',
    })
  }
  const ct = res.headers.get('content-type') || ''
  if (res.ok && ct.includes('application/vnd.apple.pkpass')) {
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'referral.pkpass'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return 'downloaded'
  }
  if (res.status === 501) {
    return 'not_configured'
  }
  if (res.status === 403) {
    throw new Error('REFERRAL_APP_DISABLED')
  }
  throw new Error('LOAD_FAILED')
}

async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  if (!res.ok) return false
  const json = await res.json().catch(() => null)
  return Boolean(json?.data?.accessToken)
}

export async function webLogin(email: string, password: string): Promise<{ clientId: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Channel': 'web-referral',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const err = json?.error
    if (err === 'VALIDATION_ERROR') throw new Error('referralPortal.errorValidation')
    if (err === 'FORBIDDEN') throw new Error('referralPortal.errorSessionBlocked')
    if (
      res.status >= 500 ||
      err === 'LOGIN_SERVER_MISCONFIGURED' ||
      err === 'INTERNAL_ERROR'
    ) {
      throw new Error('referralPortal.errorServerMisconfigured')
    }
    throw new Error('referralPortal.errorInvalidCredentials')
  }
  return { clientId: json.data.clientId as string }
}

export async function webLogout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function getReferralOverview(): Promise<ReferralOverview> {
  let res = await fetch(`${BASE}/referral/overview`, { credentials: 'include', cache: 'no-store' })
  if (res.status === 401) {
    const ok = await tryRefresh()
    if (!ok) {
      throw new Error('UNAUTHORIZED')
    }
    res = await fetch(`${BASE}/referral/overview`, { credentials: 'include', cache: 'no-store' })
  }
  const json = await res.json().catch(() => null)
  if (res.status === 403) {
    throw new Error('REFERRAL_APP_DISABLED')
  }
  if (!res.ok || !json?.data) {
    throw new Error('LOAD_FAILED')
  }
  return json.data as ReferralOverview
}

/** True if the user appears logged in (overview not 401). */
export async function hasReferralSession(): Promise<boolean> {
  let res = await fetch(`${BASE}/referral/overview`, { credentials: 'include', cache: 'no-store' })
  if (res.status === 401) {
    const ok = await tryRefresh()
    if (!ok) return false
    res = await fetch(`${BASE}/referral/overview`, { credentials: 'include', cache: 'no-store' })
  }
  return res.status !== 401
}
