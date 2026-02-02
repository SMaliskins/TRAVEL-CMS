import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateEmbedding } from "@/lib/embeddings";
import { createClient } from "@supabase/supabase-js";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const client = createClient(url, key);
  const { data: { user } } = await client.auth.getUser(token);
  return user;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    const companyId = profile?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "No company" }, { status: 403 });
    }

    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
    const threshold = Math.min(Math.max(Number(body.threshold) || 0.3, 0), 1);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const embedding = await generateEmbedding(query);

    const { data, error } = await supabaseAdmin.rpc("search_order_service_semantic", {
      query_embedding: embedding,
      p_company_id: companyId,
      match_limit: limit,
      match_threshold: threshold,
    });

    if (error) {
      console.error("search_order_service_semantic error:", error);
      return NextResponse.json(
        { error: "Semantic search failed", details: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as { service_id: string; order_id: string; similarity: number }[];
    const orderIds = [...new Set(rows.map((r) => r.order_id))];

    const { data: orders } = orderIds.length > 0
      ? await supabaseAdmin
          .from("orders")
          .select("id, order_code")
          .in("id", orderIds)
      : { data: [] };

    const orderCodeMap = new Map((orders || []).map((o: { id: string; order_code: string }) => [o.id, o.order_code]));

    const results = rows.map((r) => ({
      serviceId: r.service_id,
      orderId: r.order_id,
      orderCode: orderCodeMap.get(r.order_id) || null,
      similarity: r.similarity,
    }));

    const orderCodes = [...new Set(results.map((r) => r.orderCode).filter(Boolean))] as string[];

    return NextResponse.json({ results, orderCodes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
