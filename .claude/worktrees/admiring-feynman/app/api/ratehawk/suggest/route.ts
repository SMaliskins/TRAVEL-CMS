import { NextRequest, NextResponse } from "next/server";
import { suggestHotels } from "@/lib/ratehawk/client";
import { getApiUser } from "@/lib/auth/getApiUser";

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    const keyId = process.env.RATEHAWK_KEY_ID;
    const apiKey = process.env.RATEHAWK_API_KEY;
    if (!keyId || !apiKey) {
      return NextResponse.json(
        { error: "RateHawk API not configured", data: null },
        { status: 503 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const { query, language = "en" } = body;
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required", data: null }, { status: 400 });
    }
    const { hotels, regions } = await suggestHotels(query, language, keyId, apiKey);
    return NextResponse.json({ data: { hotels, regions }, error: null });
  } catch (err) {
    console.error("[ratehawk/suggest]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Suggest failed", data: null },
      { status: 500 }
    );
  }
}
