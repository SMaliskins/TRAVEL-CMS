import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getApiUser } from "@/lib/auth/getApiUser";
import { fetchOrderRowByRouteParam } from "@/lib/orders/orderFromRouteParam";

const BUCKET_NAME = "order-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp"];

async function getOrderAndVerify(
  orderCodeParam: string,
  companyId: string | null
): Promise<{ orderId: string; companyId: string } | { error: Response }> {
  if (!companyId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const found = await fetchOrderRowByRouteParam(supabaseAdmin, companyId, orderCodeParam);
    if (!found) {
      return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) };
    }
    const id = found.row.id as string;
    const cid = found.row.company_id as string;
    if (cid !== companyId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { orderId: id, companyId: cid };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(msg)) {
      return { error: NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 }) };
    }
    throw e;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderCode: string }> }
) {
  try {
    const { orderCode } = await params;
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId } = apiUser;
    const orderResult = await getOrderAndVerify(orderCode, companyId);
    if ("error" in orderResult) return orderResult.error;

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get("limit");
    const limit =
      limitRaw === null || limitRaw === ""
        ? null
        : Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 30));
    const offset =
      limit !== null ? Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0) : 0;

    const selectCols =
      "id, document_type, file_name, file_path, file_size, mime_type, created_at, amount, currency, invoice_number, supplier_name, invoice_date, parsed_amount, parsed_currency, parsed_invoice_number, parsed_supplier, parsed_invoice_date";

    let q = supabaseAdmin
      .from("order_documents")
      .select(selectCols, limit !== null ? { count: "exact" } : undefined)
      .eq("order_id", orderResult.orderId)
      .order("created_at", { ascending: false });

    if (limit !== null) {
      q = q.range(offset, offset + limit - 1);
    }

    const { data: docs, error, count } = await q;

    if (error) {
      if (/fetch failed|ECONNREFUSED|ETIMEDOUT|network|TypeError/i.test(error.message || "")) {
        return NextResponse.json({ error: "Database connection failed. Please try again later." }, { status: 503 });
      }
      console.error("[Documents] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }

    const list = docs || [];
    /** ORDER_PAGE_PERF_SPEC Step 6: one Storage call instead of N× createSignedUrl */
    let withUrls = list.map((d) => ({ ...d, download_url: null as string | null }));
    const paths = list.map((d) => d.file_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      const { data: signedRows, error: batchSignError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .createSignedUrls(paths, 60 * 60);
      if (!batchSignError && signedRows?.length) {
        const urlByPath = new Map<string, string | null>();
        for (const row of signedRows) {
          const r = row as { path?: string; signedUrl?: string | null };
          if (r.path) urlByPath.set(r.path, r.signedUrl ?? null);
        }
        withUrls = list.map((d) => ({
          ...d,
          download_url: d.file_path ? urlByPath.get(d.file_path) ?? null : null,
        }));
      } else {
        withUrls = await Promise.all(
          list.map(async (d) => {
            if (!d.file_path) return { ...d, download_url: null as string | null };
            const { data: signed } = await supabaseAdmin.storage
              .from(BUCKET_NAME)
              .createSignedUrl(d.file_path, 60 * 60);
            return { ...d, download_url: signed?.signedUrl || null };
          })
        );
      }
    }

    const payload: {
      documents: typeof withUrls;
      pagination?: { offset: number; limit: number; total: number };
    } = { documents: withUrls };
    if (limit !== null) {
      payload.pagination = {
        offset,
        limit,
        total: typeof count === "number" ? count : withUrls.length,
      };
    }
    return NextResponse.json(payload);
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
    const apiUser = await getApiUser(request);
    if (!apiUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { companyId, userId } = apiUser;
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
        uploaded_by: userId,
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
