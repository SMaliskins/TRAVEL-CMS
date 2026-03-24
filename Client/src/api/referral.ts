import { apiClient } from './client'

export interface ReferralOverview {
  hasReferralRole: boolean
  referralActive: boolean
  defaultCurrency: string
  plannedByCurrency: Record<string, number>
  accruedByCurrency: Record<string, number>
  settledByCurrency: Record<string, number>
  availableByCurrency: Record<string, number>
  lines: Array<{
    id: string
    commissionAmount: number
    currency: string
    status: string
    createdAt: string
    baseAmount: number
    orderCode: string | null
  }>
  settlements: Array<{
    id: string
    amount: number
    currency: string
    note: string | null
    entryDate: string
    createdAt: string
  }>
}

export const referralApi = {
  getOverview: (): Promise<ReferralOverview> =>
    apiClient.get('/referral/overview').then((r) => r.data.data),
}
