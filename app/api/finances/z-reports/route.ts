import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { canManageCashJournal } from "@/lib/auth/paymentPermissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "z-reports";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageCashJournal(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden", message: "You cannot manage Z-reports." }, { status: 403 });
    }
    const { companyId, userId } = apiUser;

    const formData = await request.formData();
    const reportDate = String(formData.get("report_date") || "").slice(0, 10);
    const amountRaw = String(formData.get("z_amount") || "");
    const currency = String(formData.get("currency") || "EUR").toUpperCase();
    const note = String(formData.get("note") || "").trim();
    const file = formData.get("file") as File | null;

    const zAmount = Number(amountRaw);
    if (!reportDate || !Number.isFinite(zAmount) || zAmount < 0) {
      return NextResponse.json({ error: "report_date and valid z_amount are required" }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from("z_reports")
      .select("*")
      .eq("company_id", companyId)
      .eq("report_date", reportDate)
      .maybeSingle();

    let fileFields: Record<string, unknown> = {};
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
        return NextResponse.json({ error: "Invalid file type. Allowed: PDF, images" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large. Maximum 15MB" }, { status: 400 });
      }

      const safe = sanitizeFileName(file.name);
      const filePath = `${companyId}/${reportDate}/${Date.now()}_${safe}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });

      if (upload.error?.message?.includes("not found")) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
        });
        const retry = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
        if (retry.error) {
          console.error("[z-reports] upload retry error:", retry.error);
          return NextResponse.json({ error: "Failed to upload Z-report file" }, { status: 500 });
        }
      } else if (upload.error) {
        console.error("[z-reports] upload error:", upload.error);
        return NextResponse.json({ error: "Failed to upload Z-report file" }, { status: 500 });
      }

      if (existing?.file_path) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([String(existing.file_path)]);
      }

      fileFields = {
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
      };
    } else if (!existing?.file_path) {
      return NextResponse.json({ error: "Z-report photo/PDF is required" }, { status: 400 });
    }

    const payload = {
      company_id: companyId,
      report_date: reportDate,
      z_amount: Math.round(zAmount * 100) / 100,
      currency,
      note: note || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
      ...fileFields,
    };

    const query = existing?.id
      ? supabaseAdmin.from("z_reports").update(payload).eq("id", existing.id).eq("company_id", companyId)
      : supabaseAdmin.from("z_reports").insert({ ...payload, created_by: userId });

    const { data, error } = await query.select().single();
    if (error) {
      console.error("[z-reports] save error:", error);
      return NextResponse.json({ error: "Failed to save Z-report" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[z-reports] POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
