"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if URL has recovery hash (from email link)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    setHasRecoveryToken(hash.includes("type=recovery") || hash.includes("access_token"));
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-2xl font-bold text-red-800">Configuration Error</h1>
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  };

  // Still checking for token
  if (hasRecoveryToken === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  // No recovery token - user landed here directly
  if (!hasRecoveryToken) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">TRAVEL CMS</h1>
          <p className="text-gray-600">
            Use the link from your email to reset your password.
          </p>
          <p className="text-sm text-gray-500">
            The link may have expired. Request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-blue-600 hover:underline"
          >
            Request new reset link
          </Link>
          <br />
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center relative">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">TRAVEL CMS</h1>
        <h2 className="text-lg text-gray-600">Set new password</h2>

        {success ? (
          <p className="text-green-600">
            Password updated. Redirecting to login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full border p-2"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
            <input
              className="w-full border p-2"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="submit" className="w-full bg-black text-white p-2">
              Update password
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
