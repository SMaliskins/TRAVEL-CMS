import { NextResponse } from "next/server";
import { execSync } from "node:child_process";

function resolveCommitSha(): string {
  // Prefer actual git HEAD in local/dev to avoid stale env values.
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    const fromEnv =
      process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA;

    return fromEnv?.trim() || "";
  }
}

export async function GET() {
  const sha = resolveCommitSha();
  return NextResponse.json(
    {
      sha,
      shortSha: sha ? sha.slice(0, 7) : "",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
