import { NextRequest, NextResponse } from "next/server";
import { getHotelContent, getHotelContentsBatch } from "@/lib/ratehawk/client";

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RATEHAWK_KEY_ID;
    const apiKey = process.env.RATEHAWK_API_KEY;
    if (!keyId || !apiKey) {
      return NextResponse.json(
        { error: "RateHawk API not configured", data: null },
        { status: 503 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const { hids, language = "en" } = body;
    const ids = Array.isArray(hids) ? hids.filter((x): x is number => typeof x === "number") : [];
    if (!ids.length) {
      return NextResponse.json({ error: "hids required", data: null }, { status: 400 });
    }
    const data =
      ids.length === 1
        ? await getHotelContent(ids, language, keyId, apiKey)
        : await getHotelContentsBatch(ids, language, keyId, apiKey);
    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error("[ratehawk/hotel-content]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hotel content failed", data: null },
      { status: 500 }
    );
  }
}
