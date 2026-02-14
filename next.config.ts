import type { NextConfig } from "next";
import packageJson from "./package.json";
import { execSync } from "node:child_process";

const appVersion = packageJson.version;
const gitCommitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  (() => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "";
    }
  })();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_COMMIT_SHA: gitCommitSha,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
