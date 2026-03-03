#!/usr/bin/env node
/**
 * Run add_order_documents_parsed_fields migration.
 * Requires DATABASE_URL in .env (from Supabase Dashboard > Settings > Database > Connection string)
 */
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL or SUPABASE_DB_URL in .env");
    console.error("Get it from: Supabase Dashboard > Project Settings > Database > Connection string (URI)");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("Install pg: npm install pg");
    process.exit(1);
  }

  const migrationPath = join(__dirname, "..", "migrations", "add_order_documents_parsed_fields.sql");
  const stream = createReadStream(migrationPath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let sql = "";
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    sql += line + "\n";
  }

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const client = new pg.default.Client({ connectionString: dbUrl });
  try {
    await client.connect();
    for (const stmt of statements) {
      if (stmt) {
        await client.query(stmt + ";");
        console.log("OK:", stmt.substring(0, 60) + "...");
      }
    }
    console.log("Migration completed.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
