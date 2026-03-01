"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Plane, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-2xl font-bold text-red-800">Configuration Error</h1>
          <p className="text-red-700">
            Supabase is not configured. Environment variables were not available during build.
          </p>
          <div className="bg-red-100 p-3 rounded text-sm font-mono text-red-800">
            <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET"}</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET"}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Invalid email or password"
        : error.message);
      return;
    }

    router.push("/dashboard");
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Left panel — branding with video background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-blue-900">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/Vid/856486-hd_1920_1080_30fps.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.75) 0%, rgba(67,56,202,0.8) 50%, rgba(55,48,163,0.75) 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div
            className={`flex items-center gap-3 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ring-2 ring-white/30 shadow-lg">
              <Plane size={22} className="text-white" />
            </div>
            <span className="text-white text-xl font-semibold tracking-tight">TravelCMS</span>
          </div>

          <div
            className={`max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            style={{ transitionDelay: "400ms" }}
          >
            <h1 className="text-4xl font-bold text-white leading-tight mb-4 drop-shadow-sm">
              Your travel business, streamlined
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              Manage bookings, invoices, clients, and finances — all in one platform built for modern travel agencies.
            </p>
            <div className="mt-8 flex gap-8">
              {[
                { value: "500+", label: "Bookings managed" },
                { value: "12", label: "Countries" },
                { value: "99.9%", label: "Uptime" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`text-center transition-all duration-600 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
                  style={{ transitionDelay: `${600 + i * 100}ms` }}
                >
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-blue-200 text-xs mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`text-blue-200 text-sm transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: "900ms" }}
          >
            © {new Date().getFullYear()} TravelCMS. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right panel — login form with staggered entrance */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-50 to-gray-100 px-6 py-12 min-h-screen">
        {/* Ambient floating dots — constant subtle motion */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[15%] right-[20%] w-2 h-2 rounded-full bg-blue-400/30 animate-ambient-float" style={{ animationDelay: "0s" }} />
          <div className="absolute top-[40%] left-[15%] w-3 h-3 rounded-full bg-blue-300/25 animate-ambient-float" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-[35%] right-[25%] w-2 h-2 rounded-full bg-indigo-400/20 animate-ambient-float" style={{ animationDelay: "4s" }} />
          <div className="absolute top-[70%] left-[20%] w-2.5 h-2.5 rounded-full bg-sky-400/25 animate-ambient-float" style={{ animationDelay: "6s" }} />
          <div className="absolute top-[25%] right-[30%] w-1.5 h-1.5 rounded-full bg-blue-500/30 animate-ambient-float" style={{ animationDelay: "8s" }} />
          <div className="absolute bottom-[20%] left-[30%] w-2 h-2 rounded-full bg-indigo-300/20 animate-ambient-float" style={{ animationDelay: "10s" }} />
        </div>
        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div
            className={`flex items-center gap-3 mb-10 lg:hidden transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Plane size={22} className="text-white" />
            </div>
            <span className="text-gray-900 text-xl font-semibold tracking-tight">TravelCMS</span>
          </div>

          <div
            className={`mb-8 transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "200ms" }}
          >
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div
              className={`transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "300ms" }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 hover:border-gray-400"
              />
            </div>

            <div
              className={`transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all duration-200 hover:border-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 animate-login-fade-in"
              >
                {error}
              </div>
            )}

            <div
              className={`transition-all duration-600 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "500ms" }}
            >
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:animate-none animate-pulse-glow"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>

          <div
            className={`mt-8 text-center transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: "600ms" }}
          >
            <p className="text-xs text-gray-400">
              v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
