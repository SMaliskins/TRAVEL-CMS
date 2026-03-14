import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getProjectStorageUsage } from "@/lib/supabase/provisioning";
import { sendEmail } from "@/lib/email/sendEmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select(`
      id, name, supabase_project_ref, supabase_configured, supabase_status,
      tariff_plan_id, resend_api_key,
      tariff_plans:tariff_plan_id (storage_limit_gb)
    `)
    .eq("supabase_configured", true)
    .eq("supabase_status", "active");

  if (error || !companies) {
    return NextResponse.json({ error: error?.message || "No companies" }, { status: 500 });
  }

  const results: { companyId: string; name: string; status: string }[] = [];

  for (const company of companies) {
    if (!company.supabase_project_ref) continue;

    try {
      const usage = await getProjectStorageUsage(company.supabase_project_ref);

      const planData = company.tariff_plans as unknown as { storage_limit_gb: number } | null;
      const storageLimitGb = planData?.storage_limit_gb || 1;
      const storageLimitBytes = storageLimitGb * 1024 * 1024 * 1024;
      const usagePercent = storageLimitBytes > 0
        ? Math.round((usage.storageUsedBytes / storageLimitBytes) * 10000) / 100
        : 0;

      let alertLevel: string = "none";
      if (usagePercent >= 100) alertLevel = "critical_100";
      else if (usagePercent >= 90) alertLevel = "warning_90";
      else if (usagePercent >= 80) alertLevel = "warning_80";

      await supabaseAdmin.from("storage_usage_log").insert({
        company_id: company.id,
        storage_used_bytes: usage.storageUsedBytes,
        storage_limit_bytes: storageLimitBytes,
        db_size_bytes: usage.dbSizeBytes,
        usage_percent: usagePercent,
        alert_sent: alertLevel !== "none",
        alert_level: alertLevel,
      });

      await supabaseAdmin
        .from("companies")
        .update({
          storage_used_bytes: usage.storageUsedBytes,
          storage_checked_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (alertLevel !== "none") {
        await sendStorageAlert(company, usagePercent, usage.storageUsedBytes, storageLimitBytes, alertLevel);
      }

      results.push({ companyId: company.id, name: company.name, status: `${usagePercent}% - ${alertLevel}` });
    } catch (err) {
      console.error(`[Storage CRON] Error for company ${company.id}:`, err);
      results.push({ companyId: company.id, name: company.name, status: "error" });
    }
  }

  return NextResponse.json({
    checked: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}

async function sendStorageAlert(
  company: { id: string; name: string; resend_api_key?: string },
  usagePercent: number,
  usedBytes: number,
  limitBytes: number,
  alertLevel: string
) {
  const { data: supervisors } = await supabaseAdmin
    .from("user_profiles")
    .select("email, first_name")
    .eq("company_id", company.id)
    .in("role", ["supervisor", "Supervisor"]);

  if (!supervisors?.length) return;

  const formatBytes = (b: number) => {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const urgency = alertLevel === "critical_100" ? "CRITICAL" : "WARNING";
  const subject = `[${urgency}] Storage usage at ${usagePercent.toFixed(1)}% — ${company.name}`;

  const body = `
    <h2>Storage Usage Alert</h2>
    <p><strong>${company.name}</strong> storage usage has reached <strong>${usagePercent.toFixed(1)}%</strong>.</p>
    <table style="border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:4px 12px 4px 0; color:#666;">Used:</td><td style="font-weight:bold;">${formatBytes(usedBytes)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#666;">Limit:</td><td style="font-weight:bold;">${formatBytes(limitBytes)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#666;">Usage:</td><td style="font-weight:bold; color:${alertLevel === 'critical_100' ? '#dc2626' : '#d97706'};">${usagePercent.toFixed(1)}%</td></tr>
    </table>
    ${alertLevel === "critical_100"
      ? "<p style='color:#dc2626;font-weight:bold;'>File uploads may be blocked. Please upgrade your plan or clean up unused files.</p>"
      : "<p>Consider upgrading your plan or removing unused files to avoid disruption.</p>"
    }
    <p style="margin-top:16px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/settings/database" style="background:#2563eb; color:#fff; padding:8px 16px; border-radius:6px; text-decoration:none;">View Storage Settings</a></p>
  `;

  for (const supervisor of supervisors) {
    if (!supervisor.email) continue;
    try {
      await sendEmail(
        supervisor.email,
        subject,
        body,
        undefined,
        undefined,
        { companyId: company.id }
      );
    } catch (err) {
      console.error(`[Storage Alert] Failed to send to ${supervisor.email}:`, err);
    }
  }
}
