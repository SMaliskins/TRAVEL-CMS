'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { t } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'

export function ReferralResetPasswordForm() {
  const router = useRouter()
  const { prefs } = useUserPreferences('referral')
  const lang = prefs.language
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null)

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    setHasRecoveryToken(hash.includes('type=recovery') || hash.includes('access_token'))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t(lang, 'referralPortal.errorPasswordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t(lang, 'referralPortal.errorPasswordMismatch'))
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSuccess(true)
    await supabase.auth.signOut()
    setTimeout(() => router.replace('/referral/login'), 2000)
  }

  if (!isSupabaseConfigured) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
        {t(lang, 'referralPortal.errorServerMisconfigured')}
      </p>
    )
  }

  if (hasRecoveryToken === null) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a5c] border-t-transparent"
          aria-label={t(lang, 'referralPortal.loading')}
        />
      </div>
    )
  }

  if (!hasRecoveryToken) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-lg font-semibold text-[#1a3a5c]">{t(lang, 'referralPortal.resetTitle')}</h1>
        <p className="text-sm text-slate-600">{t(lang, 'referralPortal.resetNoToken')}</p>
        <p className="text-xs text-slate-500">{t(lang, 'referralPortal.resetNoTokenHint')}</p>
        <Link
          href="/referral/forgot-password"
          className="inline-block text-sm font-medium text-[#1a3a5c] underline hover:text-[#152f4d]"
        >
          {t(lang, 'referralPortal.requestNewResetLink')}
        </Link>
        <div>
          <Link href="/referral/login" className="text-sm text-slate-600 underline hover:text-[#1a3a5c]">
            {t(lang, 'referralPortal.backToReferralLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[#1a3a5c]">{t(lang, 'referralPortal.resetTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t(lang, 'referralPortal.resetSubtitle')}</p>
      </div>
      {success ? (
        <p className="text-sm text-green-700">{t(lang, 'referralPortal.resetSuccess')}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="ref-new-pw" className="mb-1 block text-sm font-medium text-slate-700">
              {t(lang, 'referralPortal.newPassword')}
            </label>
            <input
              id="ref-new-pw"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-[#1a3a5c] focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
            />
          </div>
          <div>
            <label htmlFor="ref-confirm-pw" className="mb-1 block text-sm font-medium text-slate-700">
              {t(lang, 'referralPortal.confirmNewPassword')}
            </label>
            <input
              id="ref-confirm-pw"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            className="w-full rounded-lg bg-[#1a3a5c] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#152f4d]"
          >
            {t(lang, 'referralPortal.updatePassword')}
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
