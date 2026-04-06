import type { Metadata, Viewport } from 'next'
import { ReferralPortalShell } from './ReferralPortalShell'

export const metadata: Metadata = {
  title: { default: 'Referral', template: '%s · Referral' },
  description: 'Referral partner balances, commission lines, and settlements',
  manifest: '/referral.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'Referral',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#1a3a5c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function ReferralPortalLayout({ children }: { children: React.ReactNode }) {
  return <ReferralPortalShell>{children}</ReferralPortalShell>
}
