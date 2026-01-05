import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Log env vars during build to verify they are set
  ...(process.env.NODE_ENV === "production" && {
    // This runs at build time - if you see "undefined" in Vercel logs, env vars are not set
    onDemandEntries: {
      // Trigger a log message
    },
  }),
};

// Build-time check: Log if NEXT_PUBLIC vars are available
console.log("=== BUILD TIME ENV CHECK ===");
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET");
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET");
console.log("============================");

export default nextConfig;
