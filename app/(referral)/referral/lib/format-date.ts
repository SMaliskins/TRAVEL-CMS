const EM_DASH = '\u2014'

function localeTag(lang: string): string {
  if (lang === 'ru') return 'ru-RU'
  if (lang === 'lv') return 'lv-LV'
  return 'en-GB'
}

/** Locale-aware short date for referral portal */
export function formatDateLocale(lang: string, dateStr: string | null | undefined): string {
  if (!dateStr) return EM_DASH
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return EM_DASH
  return new Intl.DateTimeFormat(localeTag(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** @deprecated use formatDateLocale with language */
export function formatDate(dateStr: string | null | undefined): string {
  return formatDateLocale('en', dateStr)
}
