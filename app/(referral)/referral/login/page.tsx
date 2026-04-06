import type { Metadata } from 'next'
import { ReferralLoginForm } from './ReferralLoginForm'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function ReferralLoginPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <ReferralLoginForm />
    </div>
  )
}
