import type { Metadata } from 'next'
import { ReferralDashboard } from './ReferralDashboard'

export const metadata: Metadata = {
  title: 'Overview',
}

export default function ReferralPortalHomePage() {
  return <ReferralDashboard />
}
