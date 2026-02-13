"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Show config error if Supabase not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
        <div className="w-full max-w-md space-y-4 p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-2xl font-bold text-red-800">Configuration Error</h1>
          <p className="text-red-700">
            Supabase is not configured. Environment variables were not available during build.
          </p>
          <div className="bg-red-100 p-3 rounded text-sm font-mono text-red-800">
            <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET"}</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET"}</p>
          </div>
          <p className="text-red-600 text-sm">
            Fix: In Vercel Dashboard → Settings → Environment Variables, ensure variables are set for Production, then redeploy.
          </p>
        </div>
        {/* Version display */}
        <div className="absolute bottom-4 right-4 text-xs text-gray-400">
          v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  };

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    setError("");
    setIsSendingReset(true);

    try {
      const redirectTo = typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset-password`
        : "/auth/reset-password";

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetError) throw resetError;

      setResetSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setIsSendingReset(false);
    }
  };

  if (showReset) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold">TRAVEL CMS</h1>
          <p className="text-sm text-gray-600">Reset password</p>

          {resetSuccess ? (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Reset link sent! Check your email at <strong>{email}</strong>
            </div>
          ) : (
            <>
              <input
                className="w-full border p-2"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                onClick={handleSendResetLink}
                disabled={isSendingReset}
                className="w-full bg-black text-white p-2 disabled:opacity-50"
              >
                {isSendingReset ? "Sending..." : "Send reset link"}
              </button>
            </>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            onClick={() => { setShowReset(false); setError(""); setResetSuccess(false); }}
            className="w-full border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            ← Back to login
          </button>
        </div>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400">
          v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center relative">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">TRAVEL CMS</h1>

        <input
          className="w-full border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-sm font-medium text-blue-600 underline hover:text-blue-700"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-black text-white p-2"
        >
          Login
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      {/* Version display (login page has no sidebar) */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
      </div>
    </div>
  );
}