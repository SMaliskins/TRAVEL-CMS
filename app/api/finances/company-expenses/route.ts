import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = ["supervisor", "finance"];
const BUCKET_NAME = "company-expense-invoices";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp"];

function canAccessCompanyExpenses(role: string): boolean {
  return ALLOWED_ROLES.includes(role.toLowerCase());
}

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessCompanyExpenses(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden. Supervisor or Finance only." }, { status: 403 });
    }

    const { companyId } = apiUser;
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const supplierSearch = searchParams.get("supplier")?.trim();
    const amountMin = searchParams.get("amountMin");
    const amountMax = searchParams.get("amountMax");
    const search = searchParams.get("search")?.trim();

    const baseSelect = "id, company_id, supplier, invoice_date, amount, currency, description, created_at, created_by";
    const selectWithFile = "id, company_id, supplier, invoice_date, amount, currency, description, file_path, file_name, created_at, created_by";

    let query = supabaseAdmin
      .from("company_expense_invoices")
      .select(selectWithFile)
      .eq("company_id", companyId)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("invoice_date", dateFrom);
    if (dateTo) query = query.lte("invoice_date", dateTo);
    if (supplierSearch) {
      query = query.ilike("supplier", `%${supplierSearch}%`);
    }
    if (amountMin != null && amountMin !== "") {
      const n = parseFloat(amountMin);
      if (!isNaN(n)) query = query.gte("amount", n);
    }
    if (amountMax != null && amountMax !== "") {
      const n = parseFloat(amountMax);
      if (!isNaN(n)) query = query.lte("amount", n);
    }
    if (search) {
      query = query.or(`supplier.ilike.%${search}%,description.ilike.%${search}%`);
    }

    let result = await query;

    if (result.error) {
      const missingColumn = result.error.code === "42703" || result.error.message?.includes("does not exist");
      if (missingColumn) {
        let fallbackQuery = supabaseAdmin
          .from("company_expense_invoices")
          .select(baseSelect)
          .eq("company_id", companyId)
          .order("invoice_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (dateFrom) fallbackQuery = fallbackQuery.gte("invoice_date", dateFrom);
        if (dateTo) fallbackQuery = fallbackQuery.lte("invoice_date", dateTo);
        if (supplierSearch) fallbackQuery = fallbackQuery.ilike("supplier", `%${supplierSearch}%`);
        if (amountMin != null && amountMin !== "") {
          const n = parseFloat(amountMin);
          if (!isNaN(n)) fallbackQuery = fallbackQuery.gte("amount", n);
        }
        if (amountMax != null && amountMax !== "") {
          const n = parseFloat(amountMax);
          if (!isNaN(n)) fallbackQuery = fallbackQuery.lte("amount", n);
        }
        if (search) fallbackQuery = fallbackQuery.or(`supplier.ilike.%${search}%,description.ilike.%${search}%`);
        const fallbackResult = await fallbackQuery;
        result = fallbackResult as typeof result;
      }
    }

    if (result.error) {
      console.error("[company-expenses] GET error:", result.error);
      return NextResponse.json({ error: "Failed to fetch company expenses" }, { status: 500 });
    }

    const rows = (result.data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      file_path: "file_path" in r ? r.file_path : null,
      file_name: "file_name" in r ? r.file_name : null,
    }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("[company-expenses] GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessCompanyExpenses(apiUser.role)) {
      return NextResponse.json({ error: "Forbidden. Supervisor or Finance only." }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let supplier: string;
    let invoiceDate: string;
    let amount: number;
    let currency: string;
    let description: string | null;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      supplier = (formData.get("supplier") as string)?.trim() ?? "";
      invoiceDate = (formData.get("invoice_date") as string) ?? "";
      const amountVal = formData.get("amount");
      amount = typeof amountVal === "string" ? parseFloat(amountVal) : Number(amountVal);
      currency = (formData.get("currency") as string)?.trim() || "EUR";
      const descVal = formData.get("description");
      description = typeof descVal === "string" ? descVal.trim() || null : null;
      file = formData.get("file") as File | null;
    } else {
      const body = await request.json();
      supplier = typeof body.supplier === "string" ? body.supplier.trim() : "";
      invoiceDate = body.invoice_date;
      amount = typeof body.amount === "number" ? body.amount : parseFloat(body.amount);
      currency = typeof body.currency === "string" ? (body.currency || "EUR") : "EUR";
      description = typeof body.description === "string" ? body.description.trim() || null : null;
    }

    if (!invoiceDate || typeof invoiceDate !== "string") {
      return NextResponse.json({ error: "invoice_date is required" }, { status: 400 });
    }
    if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }

    let file_path: string | null = null;
    let file_name: string | null = null;
    let mime_type: string | null = null;

    if (file && file.size > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
        return NextResponse.json({ error: "Invalid file type. Allowed: PDF, PNG, JPG, WebP" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large. Maximum 15MB" }, { status: 400 });
      }
      const ts = Date.now();
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      file_path = `${apiUser.companyId}/${ts}_${sanitized}`;
      file_name = file.name;

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(file_path, buffer, { contentType: file.type || "application/pdf", upsert: false });

      if (uploadErr) {
        if (uploadErr.message?.includes("Bucket not found")) {
          await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: false });
          const { error: retry } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(file_path, buffer, { contentType: file.type || "application/pdf", upsert: false });
          if (retry) {
            console.error("[company-expenses] upload retry error:", retry);
            return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
          }
        } else {
          console.error("[company-expenses] upload error:", uploadErr);
          return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
        }
      }
    }

    const basePayload = {
      company_id: apiUser.companyId,
      supplier: supplier || "—",
      invoice_date: invoiceDate,
      amount,
      currency: currency || "EUR",
      description,
      created_by: apiUser.userId,
    };
    const payloadWithFile =
      file_path && file_name
        ? { ...basePayload, file_path, file_name, mime_type: mime_type || null }
        : basePayload;

    const selectFields = "id, company_id, supplier, invoice_date, amount, currency, description, created_at";
    const selectWithFile = "id, company_id, supplier, invoice_date, amount, currency, description, file_path, file_name, created_at";

    let result = await supabaseAdmin
      .from("company_expense_invoices")
      .insert(payloadWithFile)
      .select(file_path ? selectWithFile : selectFields)
      .single();

    if (result.error) {
      const isMissingColumn =
        result.error.message?.includes("does not exist") ||
        result.error.code === "42703" ||
        /column.*file_path|file_name|mime_type/i.test(result.error.message || "");
      if (isMissingColumn && file_path) {
        result = await supabaseAdmin
          .from("company_expense_invoices")
          .insert(basePayload)
          .select(selectFields)
          .single();
        if (result.error) {
          console.error("[company-expenses] POST fallback insert error:", result.error);
          return NextResponse.json({
            error: "Failed to create company expense",
            details: result.error.message,
          }, { status: 500 });
        }
      } else {
        console.error("[company-expenses] POST error:", result.error);
        return NextResponse.json({
          error: "Failed to create company expense",
          details: result.error.message,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("[company-expenses] POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
