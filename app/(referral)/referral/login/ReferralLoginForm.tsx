'use client'

import { useUserPreferences } from '@/hooks/useUserPreferences'
import { t } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { hasReferralSession, webLogin } from '../lib/referral-web-api'

export function ReferralLoginForm() {
  const router = useRouter()
  const { prefs } = useUserPreferences()
  const lang = prefs.language
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (await hasReferralSession()) {
          if (!cancelled) router.replace('/referral')
        }
      } catch {
        /* stay on login */
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await webLogin(email.trim(), password)
      router.replace('/referral')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.startsWith('referralPortal.')) {
        setError(t(lang, msg))
      } else {
        setError(t(lang, 'referralPortal.errorSignInFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a5c] border-t-transparent"
          aria-label={t(lang, 'referralPortal.loading')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#1a3a5c]">{t(lang, 'referralPortal.loginTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t(lang, 'referralPortal.loginSubtitle')}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="ref-email" className="mb-1 block text-sm font-medium text-slate-700">
            {t(lang, 'referralPortal.email')}
          </label>
          <input
            id="ref-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
          />
        </div>
        <div>
          <label htmlFor="ref-password" className="mb-1 block text-sm font-medium text-slate-700">
            {t(lang, 'referralPortal.password')}
          </label>
          <input
            id="ref-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
          />
        </div>
        {error ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#152f4d] disabled:opacity-60"
        >
          {loading ? t(lang, 'referralPortal.signingIn') : t(lang, 'referralPortal.signIn')}
        </button>
      </form>
    </div>
  )
}
