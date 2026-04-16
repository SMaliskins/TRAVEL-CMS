"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { getStaffPasswordResetRedirectUrl } from "@/lib/auth/passwordResetRedirect";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-2xl font-bold text-red-800">Configuration Error</h1>
          <p className="text-red-700 mt-2">Supabase is not configured.</p>
          <Link href="/login" className="mt-4 inline-block text-blue-600 underline">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm) {
      setError("Email is required");
      return;
    }

    setLoading(true);

    try {
      const resolveRes = await fetch("/api/auth/resolve-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm }),
      });

      const resolved = await resolveRes.json().catch(() => ({}));

      if (!resolveRes.ok) {
        setError(
          typeof resolved?.error === "string"
            ? resolved.error
            : "Could not verify your account. Please try again."
        );
        setLoading(false);
        return;
      }

      if (resolved.suspended) {
        setError(resolved.message || "Account suspended");
        setLoading(false);
        return;
      }

      const redirectTo = getStaffPasswordResetRedirectUrl();

      const usedDedicated =
        Boolean(resolved.dedicated && resolved.supabaseUrl && resolved.supabaseAnonKey);

      const authClient = usedDedicated
        ? createClient(resolved.supabaseUrl as string, resolved.supabaseAnonKey as string)
        : supabase;

      let { error: resetErr } = await authClient.auth.resetPasswordForEmail(emailNorm, {
        redirectTo,
      });

      if (resetErr && usedDedicated) {
        resetErr = (await supabase.auth.resetPasswordForEmail(emailNorm, { redirectTo })).error;
      }

      if (resetErr) {
        setError(resetErr.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center relative">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">TRAVEL CMS</h1>
        <h2 className="text-lg text-gray-600">Reset password</h2>

        {success ? (
          <div className="space-y-4">
            <p className="text-green-600">
              Check your email. We sent you a link to reset your password.
            </p>
            <p className="text-sm text-gray-600">
              If you don&apos;t see the email, check your spam folder.
            </p>
            <Link
              href="/login"
              className="block text-center text-blue-600 hover:underline"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full border p-2"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white p-2 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </form>
        )}

        <Link
          href="/login"
          className="block text-center text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Login
        </Link>
      </div>

      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
      </div>
    </div>
  );
}
