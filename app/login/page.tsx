"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Show config error if Supabase not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  return (
    <div className="flex min-h-screen items-center justify-center">
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

        <button
          onClick={handleLogin}
          className="w-full bg-black text-white p-2"
        >
          Login
        </button>

        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
}