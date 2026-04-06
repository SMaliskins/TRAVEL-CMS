'use client'

import { useUserPreferences } from '@/hooks/useUserPreferences'
import { t } from '@/lib/i18n'
import type { UILang } from '@/lib/i18n'
import { useEffect } from 'react'

const LANGS: UILang[] = ['en', 'ru', 'lv']

export function ReferralPortalShell({ children }: { children: React.ReactNode }) {
  const { prefs, updatePrefs, isMounted } = useUserPreferences()

  useEffect(() => {
    document.documentElement.lang = prefs.language === 'lv' ? 'lv' : prefs.language === 'ru' ? 'ru' : 'en'
  }, [prefs.language])

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-900">
      <a
        href="#referral-main"
        className="fixed left-4 top-4 z-[100] -translate-y-[120%] rounded-md bg-white px-3 py-2 text-sm font-medium text-[#1a3a5c] opacity-0 shadow-lg transition-[opacity,transform] focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/90"
      >
        {t(prefs.language, 'referralPortal.skipToContent')}
      </a>
      <header className="border-b border-slate-200/80 bg-[#1a3a5c] px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <span className="font-semibold tracking-wide text-white">
            {t(prefs.language, 'referralPortal.headerTitle')}
          </span>
          {isMounted ? (
            <div
              className="flex shrink-0 gap-1 rounded-md bg-white/10 p-0.5"
              role="group"
              aria-label="Language"
            >
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => updatePrefs({ language: code })}
                  className={
                    prefs.language === code
                      ? 'rounded px-2 py-1 text-xs font-semibold uppercase text-[#1a3a5c] bg-white'
                      : 'rounded px-2 py-1 text-xs font-medium uppercase text-white/80 hover:bg-white/10'
                  }
                >
                  {code}
                </button>
              ))}
            </div>
          ) : (
            <span className="w-[88px]" aria-hidden />
          )}
        </div>
      </header>
      <main id="referral-main" className="mx-auto max-w-lg px-4 py-5" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
