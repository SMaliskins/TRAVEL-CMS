import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

function resolveGitDir(): string | null {
  const gitEntryPath = join(process.cwd(), ".git");
  try {
    const stat = statSync(gitEntryPath);
    if (stat.isDirectory()) {
      return gitEntryPath;
    }

    const gitFileContent = readFileSync(gitEntryPath, "utf8");
    const match = gitFileContent.match(/^gitdir:\s*(.+)\s*$/im);
    if (!match?.[1]) return null;

    const gitDirPath = match[1].trim();
    return isAbsolute(gitDirPath) ? gitDirPath : join(process.cwd(), gitDirPath);
  } catch {
    return null;
  }
}

function resolveShaFromGitFiles(): string {
  const gitDir = resolveGitDir();
  if (!gitDir) return "";

  try {
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return head;

    const refMatch = head.match(/^ref:\s*(.+)$/i);
    if (!refMatch?.[1]) return "";
    const ref = refMatch[1].trim();

    // Normal ref file
    try {
      const refSha = readFileSync(join(gitDir, ref), "utf8").trim();
      if (/^[0-9a-f]{40}$/i.test(refSha)) return refSha;
    } catch {
      // continue to packed-refs fallback
    }

    // Packed refs fallback
    const packedRefs = readFileSync(join(gitDir, "packed-refs"), "utf8");
    const line = packedRefs
      .split(/\r?\n/)
      .find((l) => l.endsWith(` ${ref}`) && /^[0-9a-f]{40}\s+/.test(l));

    if (!line) return "";
    return line.split(/\s+/)[0] || "";
  } catch {
    return "";
  }
}

function resolveCommitSha(): string {
  // 1) Prefer direct .git lookup (works in local/dev even with stale env)
  const fromGitFiles = resolveShaFromGitFiles();
  if (fromGitFiles) return fromGitFiles;

  // 2) Fallback to git CLI
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    // 3) Last resort: env
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
