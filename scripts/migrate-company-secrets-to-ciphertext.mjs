/**
 * Migrate company secrets from plaintext columns to ciphertext columns.
 *
 * Modes:
 * - Dry run (default): inspect and report what would be changed
 * - Apply: write ciphertext values
 * - Optional null plaintext: set legacy plaintext columns to NULL when ciphertext exists
 *
 * Usage:
 *   node scripts/migrate-company-secrets-to-ciphertext.mjs --dry-run
 *   node scripts/migrate-company-secrets-to-ciphertext.mjs --apply
 *   node scripts/migrate-company-secrets-to-ciphertext.mjs --apply --null-plaintext
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import crypto from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function loadEnvFile(env, filepath) {
  try {
    const content = readFileSync(filepath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (key && env[key] === undefined) env[key] = val;
    }
  } catch {
    // skip missing file
  }
}

function getArg(flag) {
  return process.argv.includes(flag);
}

function mask(value) {
  if (!value) return "null";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isEncryptedValue(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function getRawKey(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // ignore
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;
  return null;
}

function encryptSecret(plain, key) {
  if (!plain) return null;
  if (isEncryptedValue(plain)) return plain;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${PREFIX}${payload}`;
}

const FIELD_MAP = [
  { plaintext: "resend_api_key", ciphertext: "resend_api_key_ciphertext" },
  { plaintext: "openai_api_key_encrypted", ciphertext: "openai_api_key_ciphertext" },
  { plaintext: "anthropic_api_key_encrypted", ciphertext: "anthropic_api_key_ciphertext" },
  { plaintext: "supabase_anon_key", ciphertext: "supabase_anon_key_ciphertext" },
  { plaintext: "supabase_service_role_key", ciphertext: "supabase_service_role_key_ciphertext" },
];

async function main() {
  const apply = getArg("--apply");
  const dryRun = getArg("--dry-run") || !apply;
  const nullPlaintext = getArg("--null-plaintext");

  const env = {};
  loadEnvFile(env, ".env");
  loadEnvFile(env, ".env.local");

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = getRawKey(env.APP_DATA_ENCRYPTION_KEY);

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local");
    process.exit(1);
  }
  if (!encKey) {
    console.error("Missing/invalid APP_DATA_ENCRYPTION_KEY. Must be 32-byte raw or base64-encoded 32-byte key.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fields = ["id", ...FIELD_MAP.flatMap((f) => [f.plaintext, f.ciphertext])].join(", ");
  const { data: companies, error } = await supabase.from("companies").select(fields);
  if (error) {
    console.error("Failed to read companies:", error.message);
    process.exit(1);
  }

  let rowsScanned = 0;
  let rowsWithChanges = 0;
  let valuesEncrypted = 0;
  let valuesNullified = 0;

  for (const company of companies || []) {
    rowsScanned += 1;
    const patch = {};
    let changed = false;

    for (const { plaintext, ciphertext } of FIELD_MAP) {
      const plain = company[plaintext];
      const cipher = company[ciphertext];
      const hasPlain = typeof plain === "string" && plain.length > 0;
      const hasCipher = typeof cipher === "string" && cipher.length > 0;

      if (hasPlain && !hasCipher) {
        const encrypted = encryptSecret(plain, encKey);
        if (!encrypted) continue;
        patch[ciphertext] = encrypted;
        changed = true;
        valuesEncrypted += 1;
      }

      if (nullPlaintext) {
        const willHaveCipher = hasCipher || Boolean(patch[ciphertext]);
        if (hasPlain && willHaveCipher) {
          patch[plaintext] = null;
          changed = true;
          valuesNullified += 1;
        }
      }
    }

    if (!changed) continue;
    rowsWithChanges += 1;

    if (dryRun) {
      const touchedFields = Object.keys(patch);
      console.log(`[DRY-RUN] company=${company.id} fields=${touchedFields.join(", ")}`);
    } else {
      const { error: updateError } = await supabase.from("companies").update(patch).eq("id", company.id);
      if (updateError) {
        console.error(`Failed updating company ${company.id}:`, updateError.message);
        continue;
      }
      console.log(`[APPLY] company=${company.id} updated (${Object.keys(patch).length} fields)`);
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Null plaintext: ${nullPlaintext ? "yes" : "no"}`);
  console.log(`Rows scanned: ${rowsScanned}`);
  console.log(`Rows with changes: ${rowsWithChanges}`);
  console.log(`Values encrypted: ${valuesEncrypted}`);
  console.log(`Values nullified: ${valuesNullified}`);
  console.log(`Encryption key loaded: ${mask(env.APP_DATA_ENCRYPTION_KEY || "")}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
