/**
 * One-off: Update user email from finance@gtr.lv to payment@gtr.lv
 *
 * Usage: node scripts/update-user-email.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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
      if (key) env[key] = val;
    }
  } catch {
    /* file not found — skip */
  }
}

const env = {};
loadEnvFile(env, ".env");
loadEnvFile(env, ".env.local");

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OLD_EMAIL = "finance@gtr.lv";
const NEW_EMAIL = "payment@gtr.lv";

async function main() {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Error listing users:", error.message);
      process.exit(1);
    }

    const user = data.users.find((u) => u.email === OLD_EMAIL);
    if (user) {
      const { data: updated, error: updateErr } =
        await supabase.auth.admin.updateUserById(user.id, { email: NEW_EMAIL });
      if (updateErr) {
        console.error("Error updating email:", updateErr.message);
        process.exit(1);
      }
      console.log(`Updated: ${OLD_EMAIL} → ${NEW_EMAIL} (id: ${user.id})`);
      return;
    }

    if (data.users.length < perPage) break;
    page++;
  }

  console.log(`User ${OLD_EMAIL} not found.`);
}

main();
