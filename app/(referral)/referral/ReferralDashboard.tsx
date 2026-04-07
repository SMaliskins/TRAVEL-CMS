'use client'

import { useUserPreferences } from '@/hooks/useUserPreferences'
import { t } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { formatDateLocale } from './lib/format-date'
import type { ReferralOverview } from './lib/types'
import { getReferralOverview, webLogout } from './lib/referral-web-api'

function money(amount: number, currency: string) {
  const n = Math.round(amount * 100) / 100
  return `${n.toFixed(2)} ${currency}`
}

function CurrencyTotals({
  title,
  by,
}: {
  title: string
  by: Record<string, number>
}) {
  const keys = Object.keys(by).filter((k) => Math.abs(by[k] ?? 0) > 0.0001)
  if (keys.length === 0) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-slate-600">{title}</span>
        <span className="text-sm text-slate-400">—</span>
      </div>
    )
  }
  return (
    <div className="mb-2">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</div>
      {keys.map((c) => (
        <div key={c} className="flex items-center justify-between py-0.5">
          <span className="text-sm text-slate-600">{c}</span>
          <span className="text-sm font-semibold text-[#1a3a5c]">{money(by[c] ?? 0, c)}</span>
        </div>
      ))}
    </div>
  )
}

export function ReferralDashboard() {
  const router = useRouter()
  const { prefs } = useUserPreferences()
  const lang = prefs.language
  const [data, setData] = useState<ReferralOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const d = await getReferralOverview()
      setData(d)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ERR'
      if (msg === 'UNAUTHORIZED') {
        router.replace('/referral/login')
        return
      }
      if (msg === 'REFERRAL_APP_DISABLED') {
        setError(t(lang, 'referralPortal.errorReferralDisabled'))
      } else {
        setError(t(lang, 'referralPortal.errorLoadFailed'))
      }
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router, lang])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  async function onSignOut() {
    await webLogout()
    router.replace('/referral/login')
    router.refresh()
  }

  function onRefresh() {
    setRefreshing(true)
    load()
  }

  function statusLabel(raw: string) {
    const s = raw.toLowerCase()
    if (s === 'accrued') return t(lang, 'referralPortal.statusAccrued')
    return t(lang, 'referralPortal.statusPlanned')
  }

  function partnerTypeLabel(raw: string | null) {
    if (!raw) return null
    const k = `referralPortal.partyType.${raw.toLowerCase().replace(/\s+/g, '_')}` as const
    const tr = t(lang, k)
    return tr === k ? raw : tr
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-[#1a3a5c] border-t-transparent"
          aria-label={t(lang, 'referralPortal.loading')}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          {error}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              void onSignOut()
            }}
            className="text-sm font-semibold text-[#1a3a5c] underline-offset-2 hover:underline"
          >
            {t(lang, 'referralPortal.signOut')}
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
        {t(lang, 'referralPortal.noData')}
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            void onSignOut()
          }}
          className="text-sm font-semibold text-[#1a3a5c] underline-offset-2 hover:underline"
        >
          {t(lang, 'referralPortal.signOut')}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-sm font-medium text-[#1a3a5c] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {refreshing ? t(lang, 'referralPortal.refreshing') : t(lang, 'referralPortal.refresh')}
        </button>
      </div>

      {!data.hasReferralRole && (
        <div className="rounded-lg border border-amber-200 bg-[#fff8e6] px-3 py-3 text-sm leading-relaxed text-[#5c4a21]">
          {t(lang, 'referralPortal.bannerSetupIncomplete')}
        </div>
      )}

      {data.hasReferralRole && !data.referralActive && (
        <div
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-3 text-sm leading-relaxed text-slate-800"
          role="status"
        >
          {t(lang, 'referralPortal.bannerInactive')}
        </div>
      )}

      <section className="rounded-xl border border-[#e8eef4] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-[#1a3a5c]">{t(lang, 'referralPortal.profileTitle')}</h2>
        <p className="text-lg font-semibold text-[#1a3a5c]">{data.partnerProfile.displayName}</p>
        <dl className="mt-3 space-y-2 text-sm">
          {data.partnerProfile.email ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{t(lang, 'referralPortal.labelEmail')}</dt>
              <dd className="break-all text-slate-800">{data.partnerProfile.email}</dd>
            </div>
          ) : null}
          {data.partnerProfile.phone ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{t(lang, 'referralPortal.labelPhone')}</dt>
              <dd className="text-slate-800">{data.partnerProfile.phone}</dd>
            </div>
          ) : null}
          {data.partnerProfile.partyType ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{t(lang, 'referralPortal.labelAccountType')}</dt>
              <dd className="text-slate-800">{partnerTypeLabel(data.partnerProfile.partyType)}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-slate-500">{t(lang, 'referralPortal.labelDefaultCurrency')}</dt>
            <dd className="text-slate-800">{data.defaultCurrency}</dd>
          </div>
          {data.agencyName ? (
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-slate-500">{t(lang, 'referralPortal.labelAgency')}</dt>
              <dd className="text-slate-800">{data.agencyName}</dd>
            </div>
          ) : null}
          {data.referralNotes ? (
            <div className="mt-2 rounded-md bg-slate-50 px-3 py-2">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {t(lang, 'referralPortal.labelReferralNotes')}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-800">{data.referralNotes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-[#1a3a5c]">{t(lang, 'referralPortal.balances')}</h2>
        <CurrencyTotals title={t(lang, 'referralPortal.planned')} by={data.plannedByCurrency} />
        <CurrencyTotals title={t(lang, 'referralPortal.accrued')} by={data.accruedByCurrency} />
        <CurrencyTotals title={t(lang, 'referralPortal.settled')} by={data.settledByCurrency} />
        <CurrencyTotals title={t(lang, 'referralPortal.available')} by={data.availableByCurrency} />
      </section>

      <h3 className="text-[15px] font-bold text-[#1a3a5c]">{t(lang, 'referralPortal.commissionLines')}</h3>
      {data.lines.length === 0 ? (
        <p className="text-sm text-slate-400">{t(lang, 'referralPortal.noLines')}</p>
      ) : (
        <ul className="space-y-2">
          {data.lines.map((line) => (
            <li
              key={line.id}
              className="rounded-lg border border-[#e8eef4] bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-[#1a3a5c]">
                  {money(line.commissionAmount, line.currency)}
                </span>
                <span
                  className={
                    line.status === 'accrued'
                      ? 'rounded-md bg-[#e6f4ea] px-2 py-0.5 text-xs font-bold text-[#1b5e20]'
                      : 'rounded-md bg-[#e8eef4] px-2 py-0.5 text-xs font-bold text-slate-600'
                  }
                >
                  {statusLabel(line.status)}
                </span>
              </div>
              {line.orderCode ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t(lang, 'referralPortal.orderPrefix')} {line.orderCode}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {t(lang, 'referralPortal.basePrefix')} {money(line.baseAmount, line.currency)} ·{' '}
                {formatDateLocale(lang, line.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="text-[15px] font-bold text-[#1a3a5c]">{t(lang, 'referralPortal.settlements')}</h3>
      {data.settlements.length === 0 ? (
        <p className="text-sm text-slate-400">{t(lang, 'referralPortal.noSettlements')}</p>
      ) : (
        <ul className="space-y-2">
          {data.settlements.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-[#e8eef4] bg-white px-3 py-3 shadow-sm"
            >
              <p className="text-base font-bold text-[#1a3a5c]">{money(s.amount, s.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateLocale(lang, s.entryDate)}</p>
              {s.note ? <p className="mt-2 text-sm text-slate-700">{s.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
