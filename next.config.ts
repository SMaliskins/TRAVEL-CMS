import type { NextConfig } from "next";
import packageJson from "./package.json";

const appVersion = packageJson.version;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

// Build-time check: Log version and env vars
console.log("=== BUILD INFO ===");
console.log("APP VERSION:", appVersion);
console.log("BUILD TIME:", new Date().toISOString());
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET");
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "NOT SET");
console.log("==================");

export default nextConfig;
