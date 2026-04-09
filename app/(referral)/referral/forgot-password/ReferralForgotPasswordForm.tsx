'use client'

import Link from 'next/link'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { t } from '@/lib/i18n'
import { useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'

export function ReferralForgotPasswordForm() {
  const { prefs } = useUserPreferences('referral')
  const lang = prefs.language
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (!email.trim()) {
      setError(t(lang, 'referralPortal.errorValidation'))
      return
    }
    if (!isSupabaseConfigured) {
      setError(t(lang, 'referralPortal.errorServerMisconfigured'))
      return
    }
    setLoading(true)
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/referral/reset-password`
          : '/referral/reset-password'
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (supaErr) {
        setError(supaErr.message)
        return
      }
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
        {t(lang, 'referralPortal.errorServerMisconfigured')}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#1a3a5c]">{t(lang, 'referralPortal.forgotTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t(lang, 'referralPortal.forgotSubtitle')}</p>
      </div>
      {success ? (
        <div className="space-y-3">
          <p className="text-sm text-green-700">{t(lang, 'referralPortal.forgotSuccess')}</p>
          <p className="text-xs text-slate-600">{t(lang, 'referralPortal.forgotSpamHint')}</p>
          <Link
            href="/referral/login"
            className="inline-block text-sm font-medium text-[#1a3a5c] underline hover:text-[#152f4d]"
          >
            {t(lang, 'referralPortal.backToReferralLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="ref-forgot-email" className="mb-1 block text-sm font-medium text-slate-700">
              {t(lang, 'referralPortal.email')}
            </label>
            <input
              id="ref-forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? t(lang, 'referralPortal.sendingReset') : t(lang, 'referralPortal.sendResetLink')}
          </button>
        </form>
      )}
      {!success ? (
        <Link
          href="/referral/login"
          className="block text-center text-sm text-slate-600 underline hover:text-[#1a3a5c]"
        >
          {t(lang, 'referralPortal.backToReferralLogin')}
        </Link>
      ) : null}
    </div>
  )
}
