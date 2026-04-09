import type { Metadata } from 'next'
import { ReferralForgotPasswordForm } from './ReferralForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Reset password',
}

export default function ReferralForgotPasswordPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <ReferralForgotPasswordForm />
    </div>
  )
}
