/**
 * AI parse cache — best-effort dedup of identical parse requests.
 *
 * Hash key = sha256(documentType + normalised intake content).
 * Reads are PK lookups; writes only happen on confidence >= 0.7 to avoid
 * poisoning the cache with low-quality results.
 *
 * Failures (table missing, network) are swallowed: the cache is a pure
 * optimisation; the parse pipeline must keep working without it.
 */

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DocumentType } from "./parseSchemas";
import type { IntakeResult } from "./documentIntake";

/** Cache entries older than this are treated as stale on read. */
const CACHE_TTL_DAYS = 90;

export function buildCacheKey(documentType: DocumentType, intake: IntakeResult): string {
  // The intake already exposes a stable hash of file bytes / text input.
  // We mix in the documentType because the same PDF could in theory be
  // parsed under different schemas (e.g. invoice vs expense).
  return createHash("sha256")
    .update(documentType)
    .update("\u0000")
    .update(intake.fileHash)
    .update("\u0000")
    .update(intake.contentMode)
    .digest("hex");
}

export interface CacheHit<T> {
  data: T;
  confidence: number;
  model: string | null;
  provider: string | null;
}

export async function readCache<T>(
  hash: string,
  documentType: DocumentType,
): Promise<CacheHit<T> | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_parse_cache")
      .select("parsed_data, confidence, model, provider, created_at")
      .eq("hash", hash)
      .eq("document_type", documentType)
      .maybeSingle();
    if (error || !data) return null;

    const ageMs = Date.now() - new Date(data.created_at as string).getTime();
    if (ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;

    // Fire-and-forget hit-count bump.
    void supabaseAdmin
      .from("ai_parse_cache")
      .update({
        hit_count: 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq("hash", hash)
      .then(() => undefined);

    return {
      data: data.parsed_data as T,
      confidence: Number(data.confidence) || 0,
      model: (data.model as string) || null,
      provider: (data.provider as string) || null,
    };
  } catch {
    return null;
  }
}

export async function writeCache(
  hash: string,
  documentType: DocumentType,
  parsed: unknown,
  confidence: number,
  model: string,
  provider: string,
): Promise<void> {
  if (confidence < 0.7) return;
  try {
    await supabaseAdmin.from("ai_parse_cache").upsert(
      {
        hash,
        document_type: documentType,
        parsed_data: parsed,
        confidence,
        model,
        provider,
        last_hit_at: new Date().toISOString(),
      },
      { onConflict: "hash" },
    );
  } catch {
    // Cache write failures must never break the parse path.
  }
}
