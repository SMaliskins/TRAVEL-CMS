import crypto from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function getRawKey(): Buffer | null {
  const raw = process.env.APP_DATA_ENCRYPTION_KEY?.trim();
  if (!raw) return null;

  // Prefer base64-encoded 32-byte key.
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // Fall through to UTF-8 mode.
  }

  // Fallback for local/dev compatibility: raw text must be 32 bytes.
  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;

  return null;
}

export function hasDataEncryptionKey(): boolean {
  return getRawKey() !== null;
}

export function isEncryptedValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  if (isEncryptedValue(plain)) return plain;

  const key = getRawKey();
  if (!key) return plain;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${PREFIX}${payload}`;
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncryptedValue(value)) return value;

  const key = getRawKey();
  if (!key) return null;

  try {
    const payload = value.slice(PREFIX.length);
    const data = Buffer.from(payload, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = data.subarray(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
