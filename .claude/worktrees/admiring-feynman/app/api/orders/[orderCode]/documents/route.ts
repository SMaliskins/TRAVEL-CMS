import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET_NAME = "order-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp"];

async function getCompanyId(userId: string): Promise<string | null> {
  const { data: p } = await supabaseAdmin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
  if (p?.company_id) return p.company_id as string;
  const { data: up } = await supabaseAdmin.from("user_profiles").select("company_id").eq("id", userId).maybeSingle();
  return (up?.company_id as string) ?? null;
}

async function getOrderAndVerify(
  orderCode: string,
  companyId: string | null
): Promise<{ orderId: string; companyId: string } | { error: Response }> {
  const code = decodeURIComponent(orderCode);
  let order: { id: string; company_id: string } | null = null;
  let error: { message?: string } | null = null;
  try {
    const res = await supabaseAdmin.from("orders").select("id, company_id").eq("order_code", code).single();
    order = res.data;
    error = res.error;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(msg)) {
      return { error: NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 }) };
    }
    throw e;
  }
  if (error || !order) {
    const isNetwork = /fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(error?.message || "");
    if (isNetwork) {
      return { error: NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 }) };
    }
    return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) };
  }
  if (companyId && order.company_id !== companyId)
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { orderId: order.id, companyId: order.company_id };
}

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user } } = await client.auth.getUser(token);
    return user;
  }
  const cookie = request.headers.get("cookie") || "";
  if (cookie) {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Cookie: cookie } },
    });
    const { data: { user } } = await client.auth.getUser();
    return user;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const companyId = await getCompanyId(user.id);
    const orderResult = await getOrderAndVerify(orderCode, companyId);
    if ("error" in orderResult) return orderResult.error;

    const { data: docs, error } = await supabaseAdmin
      .from("order_documents")
      .select("id, document_type, file_name, file_path, file_size, mime_type, created_at, amount, currency, invoice_number, supplier_name, invoice_date, parsed_amount, parsed_currency, parsed_invoice_number, parsed_supplier, parsed_invoice_date")
      .eq("order_id", orderResult.orderId)
      .order("created_at", { ascending: false });

    if (error) {
      if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(error.message || "")) {
        return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
      }
      console.error("[Documents] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    const withUrls = await Promise.all(
      (docs || []).map(async (d) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .createSignedUrl(d.file_path, 60 * 60);
        return { ...d, download_url: signed?.signedUrl || null };
      })
    );

    return NextResponse.json({ documents: withUrls });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(msg)) {
      return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
    }
    console.error("[Documents] GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const companyId = await getCompanyId(user.id);
    if (!companyId) return NextResponse.json({ error: "Company not found" }, { status: 400 });
    const orderResult = await getOrderAndVerify(orderCode, companyId);
    if ("error" in orderResult) return orderResult.error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("document_type") as string) || "invoice";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext || "")) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PDF, images" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 15MB" }, { status: 400 });
    }

    const ts = Date.now();
    const fileExt = file.name.split(".").pop() || "pdf";
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const filePath = `${orderResult.companyId}/${orderResult.orderId}/${ts}_${sanitized}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, { contentType: file.type || "application/pdf", upsert: false });

    if (uploadErr) {
      const isNetworkErr = /fetch failed|ECONNREFUSED|ETIMEDOUT|network/i.test(uploadErr.message || "");
      if (isNetworkErr) {
        return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
      }
      if (uploadErr.message?.includes("not found")) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
        });
        const { error: retry } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, { contentType: file.type || "application/pdf", upsert: false });
        if (retry) {
          console.error("[Documents] Retry upload error:", retry);
          return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
        }
      } else {
        console.error("[Documents] Upload error:", uploadErr);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
      }
    }

    const { data: doc, error: insertErr } = await supabaseAdmin
      .from("order_documents")
      .insert({
        company_id: orderResult.companyId,
        order_id: orderResult.orderId,
        document_type: docType === "invoice" ? "invoice" : "other",
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      const isNetworkErr = /fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(insertErr.message || "");
      if (isNetworkErr) {
        return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
      }
      console.error("[Documents] Insert error:", insertErr);
      const hint = /does not exist|relation/.test(insertErr.message || "")
        ? ". Run migration add_order_documents.sql"
        : "";
      return NextResponse.json({
        error: `Failed to save document${hint}`,
      }, { status: 500 });
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60);
    return NextResponse.json({
      document: { ...doc, download_url: signed?.signedUrl || null },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(msg)) {
      return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
    }
    console.error("[Documents] POST:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
