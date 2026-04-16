"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  getSupabaseProjectUrlFromRecoveryHash,
  recoveryFragmentHasAccessToken,
} from "@/lib/auth/supabaseRecoveryUrl";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [bootDone, setBootDone] = useState(false);
  const [recoveryOk, setRecoveryOk] = useState(false);
  const [authClient, setAuthClient] = useState<SupabaseClient | null>(null);
  const [initError, setInitError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (!hash || !recoveryFragmentHasAccessToken(hash)) {
        if (!cancelled) setBootDone(true);
        return;
      }

      const baseUrl = getSupabaseProjectUrlFromRecoveryHash(hash);
      if (!baseUrl) {
        if (!cancelled) setBootDone(true);
        return;
      }

      const norm = (u: string) => u.replace(/\/$/, "").toLowerCase();
      const central = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

      try {
        let client: SupabaseClient;
        if (norm(baseUrl) === norm(central)) {
          client = supabase;
        } else {
          const res = await fetch(
            `/api/auth/public-anon-key?supabaseUrl=${encodeURIComponent(baseUrl)}`
          );
          if (!res.ok) {
            if (!cancelled) {
              setInitError(
                "This reset link does not match a known project. Request a new reset link from the login page."
              );
            }
            return;
          }
          const { anonKey } = (await res.json()) as { anonKey: string };
          client = createClient(baseUrl, anonKey);
        }

        let { data: { session } } = await client.auth.getSession();
        if (!session && hash) {
          const p = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
          const at = p.get("access_token");
          const rt = p.get("refresh_token");
          if (at && rt) {
            await client.auth.setSession({ access_token: at, refresh_token: rt });
            ({ data: { session } } = await client.auth.getSession());
          }
        }
        if (!session) {
          await new Promise((r) => setTimeout(r, 50));
          const { data: { session: s2 } } = await client.auth.getSession();
          if (!s2) {
            if (!cancelled) {
              setInitError(
                "Could not activate the reset session. Request a new reset link from the login page."
              );
            }
            return;
          }
        }

        if (!cancelled) {
          setAuthClient(client);
          setRecoveryOk(true);
        }
      } catch {
        if (!cancelled) {
          setInitError("Something went wrong. Request a new reset link from the login page.");
        }
      } finally {
        if (!cancelled) setBootDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
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

    const client = authClient;
    if (!client) {
      setError("Session not ready. Please refresh the page.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const { error: updateError } = await client.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    await client.auth.signOut();
    setTimeout(() => router.push("/login"), 2000);
  };

  if (!bootDone) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center relative px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold">TRAVEL CMS</h1>
          <p className="text-red-600 text-sm">{initError}</p>
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

  if (!recoveryOk) {
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
