#!/usr/bin/env node
/**
 * Local benchmark for the MAP-01 batch geocoder.
 * Reads .env.local, pulls all countries_cities from orders, parses them the
 * same way app/api/dashboard/map/route.ts does, then measures:
 *   (a) one chunked batch SELECT against city_geocache,
 *   (b) one batch UPSERT (no-op — we insert 0 rows, just to time the call shape).
 * This is what the serverless function does end-to-end when the cache is warm.
 *
 * Usage:
 *   node scripts/bench-map-geocoder.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const s = createClient(url, key, { auth: { persistSession: false } });

function normalize(x) {
  return (x || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDestination(raw) {
  if (!raw) return { city: "", country: "" };
  if (raw.includes("|")) {
    const segs = raw.split("|").map((s) => s.trim()).filter(Boolean);
    for (const seg of segs) {
      if (seg.startsWith("origin:") || seg.startsWith("return:")) continue;
      const parts = seg.split(",").map((x) => x.trim());
      return { city: parts[0] || "", country: parts[1] || "" };
    }
    const first = (segs[0] || "").replace(/^(origin|return):/, "").trim();
    const parts = first.split(",").map((x) => x.trim());
    return { city: parts[0] || "", country: parts[1] || "" };
  }
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], country: parts[1] };
  return { city: parts[0] || "", country: "" };
}

const t0 = Date.now();
const { data: orders, error: oErr } = await s
  .from("orders")
  .select("id, countries_cities, status")
  .neq("status", "Cancelled");
if (oErr) throw oErr;
const tAfterOrders = Date.now();

const seen = new Set();
const uniquePairs = [];
for (const o of orders || []) {
  const { city, country } = parseDestination(o.countries_cities);
  if (!city) continue;
  const key = `${normalize(city)}|${normalize(country)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniquePairs.push({ queryNorm: normalize(city), countryNorm: normalize(country) });
}
const tAfterParse = Date.now();

const queryNorms = Array.from(new Set(uniquePairs.map((p) => p.queryNorm)));
const CHUNK = 200;
const cacheRows = [];
const selectTimings = [];
for (let i = 0; i < queryNorms.length; i += CHUNK) {
  const slice = queryNorms.slice(i, i + CHUNK);
  const st = Date.now();
  const { data, error } = await s
    .from("city_geocache")
    .select("query_norm, country_norm, city, country, lat, lng, source, approximate")
    .in("query_norm", slice);
  const dt = Date.now() - st;
  selectTimings.push(dt);
  if (error) throw error;
  cacheRows.push(...(data || []));
}
const tAfterSelect = Date.now();

const cacheByKey = new Map(cacheRows.map((r) => [`${r.query_norm}|${r.country_norm}`, r]));
let hits = 0;
let unmappedHits = 0;
let misses = 0;
for (const p of uniquePairs) {
  const row = cacheByKey.get(`${p.queryNorm}|${p.countryNorm}`);
  if (row && row.lat !== null && row.lng !== null) hits++;
  else if (row && row.source === "unmapped") unmappedHits++;
  else misses++;
}
const tAfterResolve = Date.now();

// Simulate a tiny UPSERT to measure that codepath (one dummy row, then delete).
const st2 = Date.now();
const { error: upErr } = await s.from("city_geocache").upsert(
  [{ query_norm: "__bench__", country_norm: "__bench__", city: null, country: null, lat: null, lng: null, source: "unmapped", approximate: true }],
  { onConflict: "query_norm,country_norm" }
);
const upsertMs = Date.now() - st2;
if (upErr) console.error("UPSERT error:", upErr);
await s.from("city_geocache").delete().eq("query_norm", "__bench__").eq("country_norm", "__bench__");

console.log("orders loaded:           ", (orders || []).length, "in", tAfterOrders - t0, "ms");
console.log("unique (city,country):   ", uniquePairs.length, "(parse took", tAfterParse - tAfterOrders, "ms)");
console.log("unique query_norms:      ", queryNorms.length);
console.log("batch SELECT chunks:     ", selectTimings.length, "timings(ms)=", selectTimings, "total=", tAfterSelect - tAfterParse);
console.log("cache hits (with coords):", hits);
console.log("cache hits (unmapped):   ", unmappedHits);
console.log("MISSES (no row in cache):", misses, "  → these fall through to alias/builtin, up to 3 go to Nominatim");
console.log("resolve pass (in-mem):   ", tAfterResolve - tAfterSelect, "ms");
console.log("UPSERT (1 row roundtrip):", upsertMs, "ms");
console.log("─────────────────────────");
console.log("TOTAL (orders+select+upsert, excludes Nominatim):", Date.now() - t0, "ms");
console.log("Worst case added by Nominatim: NOMINATIM_TOTAL_BUDGET_MS = 5000 ms");
