import type { Metadata } from 'next'
import { ReferralResetPasswordForm } from './ReferralResetPasswordForm'

export const metadata: Metadata = {
  title: 'New password',
}

export default function ReferralResetPasswordPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <ReferralResetPasswordForm />
    </div>
  )
}
