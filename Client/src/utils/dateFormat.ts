/**
 * Date formatting utilities for MyTravelConcierge mobile app.
 * All dates displayed as dd.mm.yyyy per project rule 6.11.
 */

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

export function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  if (!from && !to) return '—'
  const dFrom = from ? new Date(from) : null
  const dTo = to ? new Date(to) : null

  if (dFrom && dTo && dFrom.getFullYear() === dTo.getFullYear()) {
    return `${formatDateShort(from)} — ${formatDate(to)}`
  }
  return `${formatDate(from)} — ${formatDate(to)}`
}

export function calcDaysNights(
  from: string | null | undefined,
  to: string | null | undefined
): string | null {
  if (!from || !to) return null
  const dFrom = new Date(from)
  const dTo = new Date(to)
  if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) return null

  const ms = dTo.getTime() - dFrom.getTime()
  const days = Math.round(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return null

  const nights = days - 1
  return `${days} ${days === 1 ? 'day' : 'days'} / ${nights} ${nights === 1 ? 'night' : 'nights'}`
}

export function calcDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const trip = new Date(dateStr)
  if (isNaN(trip.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  trip.setHours(0, 0, 0, 0)
  return Math.ceil((trip.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
